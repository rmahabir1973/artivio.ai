import Stripe from 'stripe';
import { storage } from './storage';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { stripeEvents, users, subscriptionPlans, userSubscriptions } from '@shared/schema';
import type { SubscriptionPlan } from '@shared/schema';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
});

export async function createCheckoutSession(params: {
  userId: string;
  userEmail: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const { userId, userEmail, planId, successUrl, cancelUrl } = params;

  const plan = await storage.getPlanById(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  if (!plan.stripePriceId) {
    throw new Error('Plan does not have a Stripe price ID configured');
  }

  console.log('[Stripe Checkout] Creating session for plan:', {
    planId: plan.id,
    planName: plan.displayName,
    stripePriceId: plan.stripePriceId,
  });

  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  let customerId = user.stripeCustomerId || undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: {
        userId: userId,
      },
    });
    customerId = customer.id;
    
    // Update user's Stripe customer ID
    const user = await storage.getUser(userId);
    if (user) {
      await storage.upsertUser({
        ...user,
        stripeCustomerId: customerId,
      });
    }
  }

  // Fetch the price from Stripe to get recurring info for inline price_data
  let stripePrice;
  try {
    stripePrice = await stripe.prices.retrieve(plan.stripePriceId);
    console.log('[Stripe Checkout] Successfully retrieved price from Stripe:', plan.stripePriceId);
  } catch (error: any) {
    console.error('[Stripe Checkout] Failed to retrieve price from Stripe:', {
      stripePriceId: plan.stripePriceId,
      planName: plan.displayName,
      error: error.message,
    });
    throw new Error(`Invalid Stripe Price ID for plan "${plan.displayName}". Please update the Stripe Price ID in Admin Panel → Subscription Plans. Error: ${error.message}`);
  }
  
  // Build display name with billing period (e.g., "Starter - Monthly" or "Professional - Annual")
  const billingLabel = plan.billingPeriod === 'annual' ? 'Annual' : 'Monthly';
  const displayName = `${plan.displayName} - ${billingLabel}`;
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{
      price_data: {
        currency: stripePrice.currency,
        unit_amount: stripePrice.unit_amount!,
        recurring: {
          interval: stripePrice.recurring?.interval || 'month',
          interval_count: stripePrice.recurring?.interval_count || 1,
        },
        product_data: {
          name: displayName,
          description: `${plan.creditsPerMonth.toLocaleString()} credits per month`,
        },
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId,
      planId: planId,
      stripePriceId: plan.stripePriceId, // Track original price for proration reference
    },
    subscription_data: {
      metadata: {
        userId: userId,
        planId: planId,
        stripePriceId: plan.stripePriceId, // Store for upgrade/downgrade proration
      },
    },
    allow_promotion_codes: true,
  });

  return session;
}

export async function createCustomerPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session;
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
  console.log('[Stripe Webhook] Processing checkout.session.completed', session.id);

  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  console.log('[Stripe Webhook] handleCheckoutCompleted extracted values:', {
    userId,
    planId,
    subscriptionId,
    customerId,
    eventId,
    allMetadata: session.metadata,
  });

  if (!userId || !planId) {
    console.error('[Stripe Webhook] ❌ Missing userId or planId in metadata - ABORTING', {
      userId,
      planId,
      metadata: session.metadata,
    });
    return;
  }

  // Fetch subscription BEFORE transaction (external API call)
  console.log('[Stripe Webhook] Fetching subscription from Stripe:', subscriptionId);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subData = subscription as any;
  
  // Log ALL subscription fields to debug
  console.log('[Stripe Webhook] Raw subscription object keys:', Object.keys(subData));
  console.log('[Stripe Webhook] Stripe subscription retrieved:', {
    id: subscription.id,
    status: subscription.status,
    currentPeriodStart: subData.current_period_start,
    currentPeriodEnd: subData.current_period_end,
    // Also check snake_case alternatives
    current_period_start_type: typeof subData.current_period_start,
    current_period_end_type: typeof subData.current_period_end,
  });
  
  // Validate period timestamps before using them
  const periodStart = subData.current_period_start;
  const periodEnd = subData.current_period_end;
  
  if (typeof periodStart !== 'number' || typeof periodEnd !== 'number') {
    console.error('[Stripe Webhook] ❌ Invalid period timestamps:', { periodStart, periodEnd });
    throw new Error(`Invalid subscription period timestamps: start=${periodStart}, end=${periodEnd}`);
  }
  
  const currentPeriodStartDate = new Date(periodStart * 1000);
  const currentPeriodEndDate = new Date(periodEnd * 1000);
  
  console.log('[Stripe Webhook] Converted dates:', {
    currentPeriodStartDate: currentPeriodStartDate.toISOString(),
    currentPeriodEndDate: currentPeriodEndDate.toISOString(),
  });

  // Execute ALL mutations in a single transaction for idempotency
  console.log('[Stripe Webhook] Starting database transaction...');
  await db.transaction(async (tx) => {
    // 1. INSERT event record FIRST - if duplicate, this returns empty array
    const [eventRecord] = await tx
      .insert(stripeEvents)
      .values({
        eventId,
        eventType: 'checkout.session.completed',
        objectId: subscriptionId,
        metadata: JSON.stringify({ ...session.metadata, customerId }),
      })
      .onConflictDoNothing()
      .returning();

    // If no record returned, event already processed (idempotency)
    if (!eventRecord) {
      console.log(`[Stripe Webhook] Event ${eventId} already processed, skipping`);
      return;
    }

    // 2. Get plan (read operation within transaction)
    console.log('[Stripe Webhook] Looking up plan:', planId);
    const [plan] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
    if (!plan) {
      console.error('[Stripe Webhook] ❌ Plan not found in database:', planId);
      throw new Error(`Plan not found: ${planId}`);
    }
    console.log('[Stripe Webhook] Plan found:', { id: plan.id, name: plan.displayName, credits: plan.creditsPerMonth });

    // 3. Upsert subscription
    await tx
      .insert(userSubscriptions)
      .values({
        userId,
        planId,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        status: 'active',
        currentPeriodStart: currentPeriodStartDate,
        currentPeriodEnd: currentPeriodEndDate,
        cancelAtPeriodEnd: false,
        creditsGrantedThisPeriod: plan.creditsPerMonth,
      })
      .onConflictDoUpdate({
        target: userSubscriptions.userId,
        set: {
          planId,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          status: 'active',
          currentPeriodStart: currentPeriodStartDate,
          currentPeriodEnd: currentPeriodEndDate,
          cancelAtPeriodEnd: false,
          creditsGrantedThisPeriod: plan.creditsPerMonth,
          updatedAt: new Date(),
        },
      });

    // 4. Grant credits atomically
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const newCredits = (user.credits || 0) + plan.creditsPerMonth;
    await tx.update(users).set({ credits: newCredits }).where(eq(users.id, userId));

    // 5. Update user's Stripe customer ID if not set
    if (!user.stripeCustomerId) {
      await tx.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
    }

    console.log(`[Stripe Webhook] ✅ Checkout completed for user ${userId}: +${plan.creditsPerMonth} credits (Total: ${newCredits})`);
  });
  
  console.log('[Stripe Webhook] ✅ handleCheckoutCompleted finished successfully');
}

export async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string) {
  console.log('[Stripe Webhook] Processing invoice.paid', invoice.id);

  const subscriptionId = (invoice as any).subscription as string;
  
  // Non-subscription invoices: record event only
  if (!subscriptionId) {
    console.log('[Stripe Webhook] Invoice not for subscription, recording event only');
    await db.transaction(async (tx) => {
      await tx
        .insert(stripeEvents)
        .values({
          eventId,
          eventType: 'invoice.paid',
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    });
    return;
  }

  // Fetch subscription BEFORE transaction (external API call)
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subData = subscription as any;
  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;

  if (!userId || !planId) {
    console.error('[Stripe Webhook] Missing userId or planId in subscription metadata');
    return;
  }

  // Validate period timestamps
  const periodStart = subData.current_period_start;
  const periodEnd = subData.current_period_end;
  
  if (typeof periodStart !== 'number' || typeof periodEnd !== 'number') {
    console.error('[Stripe Webhook] ❌ Invalid period timestamps in invoice.paid:', { periodStart, periodEnd });
    throw new Error(`Invalid subscription period timestamps: start=${periodStart}, end=${periodEnd}`);
  }
  
  const currentPeriodStartDate = new Date(periodStart * 1000);
  const currentPeriodEndDate = new Date(periodEnd * 1000);

  const isRenewal = invoice.billing_reason === 'subscription_cycle';

  // Execute ALL mutations in a single transaction for idempotency
  await db.transaction(async (tx) => {
    // 1. INSERT event record FIRST - if duplicate, returns empty array
    const [eventRecord] = await tx
      .insert(stripeEvents)
      .values({
        eventId,
        eventType: 'invoice.paid',
        objectId: subscriptionId,
        metadata: JSON.stringify({ billing_reason: invoice.billing_reason, customerId: subscription.customer }),
      })
      .onConflictDoNothing()
      .returning();

    // If no record returned, event already processed (idempotency)
    if (!eventRecord) {
      console.log(`[Stripe Webhook] Event ${eventId} already processed, skipping`);
      return;
    }

    // 2. Get plan
    const [plan] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // 3. Get existing subscription to check if credits already granted
    const [existingSub] = await tx
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId));

    if (isRenewal) {
      // Check if billing period has changed (new subscription period)
      const periodHasChanged = !existingSub || 
        !existingSub.currentPeriodStart ||
        existingSub.currentPeriodStart.getTime() !== currentPeriodStartDate.getTime();

      // Reset creditsGrantedThisPeriod if we're in a new billing period
      const creditsGrantedThisPeriod = periodHasChanged ? 0 : (existingSub?.creditsGrantedThisPeriod || 0);
      
      // Renewal: Grant credits if not already granted this period
      const shouldGrantCredits = creditsGrantedThisPeriod < plan.creditsPerMonth;

      if (shouldGrantCredits) {
        // Upsert subscription with full credits
        await tx
          .insert(userSubscriptions)
          .values({
            userId,
            planId,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: subscription.customer as string,
            status: 'active',
            currentPeriodStart: currentPeriodStartDate,
            currentPeriodEnd: currentPeriodEndDate,
            cancelAtPeriodEnd: subData.cancel_at_period_end,
            creditsGrantedThisPeriod: plan.creditsPerMonth,
          })
          .onConflictDoUpdate({
            target: userSubscriptions.userId,
            set: {
              planId,
              stripeSubscriptionId: subscriptionId,
              status: 'active',
              currentPeriodStart: currentPeriodStartDate,
              currentPeriodEnd: currentPeriodEndDate,
              cancelAtPeriodEnd: subData.cancel_at_period_end,
              creditsGrantedThisPeriod: plan.creditsPerMonth,
              updatedAt: new Date(),
            },
          });

        // Grant credits
        const [user] = await tx.select().from(users).where(eq(users.id, userId));
        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }

        const newCredits = (user.credits || 0) + plan.creditsPerMonth;
        await tx.update(users).set({ credits: newCredits }).where(eq(users.id, userId));

        console.log(`[Stripe Webhook] ✅ Renewal for user ${userId}: +${plan.creditsPerMonth} credits (Total: ${newCredits})`);
      } else {
        console.log(`[Stripe Webhook] Credits already granted this period for user ${userId}`);
      }
    } else {
      // Non-renewal: Update subscription status only (no credit grant)
      await tx
        .insert(userSubscriptions)
        .values({
          userId,
          planId,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: subscription.customer as string,
          status: 'active',
          currentPeriodStart: currentPeriodStartDate,
          currentPeriodEnd: currentPeriodEndDate,
          cancelAtPeriodEnd: subData.cancel_at_period_end,
          creditsGrantedThisPeriod: existingSub?.creditsGrantedThisPeriod || 0,
        })
        .onConflictDoUpdate({
          target: userSubscriptions.userId,
          set: {
            planId,
            stripeSubscriptionId: subscriptionId,
            status: 'active',
            currentPeriodStart: currentPeriodStartDate,
            currentPeriodEnd: currentPeriodEndDate,
            cancelAtPeriodEnd: subData.cancel_at_period_end,
            updatedAt: new Date(),
          },
        });

      console.log(`[Stripe Webhook] ✅ Invoice paid (non-renewal) for user ${userId}`);
    }
  });
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[Stripe Webhook] Processing invoice.payment_failed', invoice.id);

  const subscriptionId = (invoice as any).subscription as string;
  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in subscription metadata');
    return;
  }

  const existingSubscription = await storage.getUserSubscription(userId);
  if (existingSubscription) {
    await storage.upsertUserSubscription({
      ...existingSubscription,
      status: 'past_due',
    });

    console.log(`[Stripe Webhook] Marked subscription as past_due for user ${userId}`);
  }
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhook] Processing customer.subscription.updated', subscription.id);

  const subData = subscription as any;
  const userId = subscription.metadata?.userId;
  const oldPlanId = subscription.metadata?.planId;

  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in subscription metadata');
    return;
  }

  // Validate period timestamps
  const periodStart = subData.current_period_start;
  const periodEnd = subData.current_period_end;
  
  if (typeof periodStart !== 'number' || typeof periodEnd !== 'number') {
    console.error('[Stripe Webhook] ❌ Invalid period timestamps in subscription.updated:', { periodStart, periodEnd });
    throw new Error(`Invalid subscription period timestamps: start=${periodStart}, end=${periodEnd}`);
  }
  
  const currentPeriodStartDate = new Date(periodStart * 1000);
  const currentPeriodEndDate = new Date(periodEnd * 1000);

  // Get the current price from Stripe subscription
  const currentPriceId = subscription.items?.data?.[0]?.price?.id;
  console.log('[Stripe Webhook] Subscription update details:', {
    userId,
    oldPlanId,
    currentPriceId,
    status: subscription.status,
  });

  const existingSubscription = await storage.getUserSubscription(userId);
  
  // Check if the plan has changed by comparing price IDs
  let newPlan: SubscriptionPlan | null = null;
  let planChanged = false;
  
  if (currentPriceId) {
    // Find the plan that matches the current Stripe price
    const allPlans = await storage.getAllPlans();
    newPlan = allPlans.find((p: SubscriptionPlan) => p.stripePriceId === currentPriceId) || null;
    
    if (!newPlan) {
      console.warn('[Stripe Webhook] ⚠️ No matching plan found for Stripe price:', {
        currentPriceId,
        availablePrices: allPlans.map(p => ({ id: p.id, name: p.displayName, priceId: p.stripePriceId })),
      });
    }
    
    if (newPlan && existingSubscription && newPlan.id !== existingSubscription.planId) {
      planChanged = true;
      console.log('[Stripe Webhook] 🔄 Plan change detected:', {
        oldPlan: existingSubscription.plan?.displayName,
        newPlan: newPlan.displayName,
        oldPlanId: existingSubscription.planId,
        newPlanId: newPlan.id,
      });
    }
  }

  if (existingSubscription) {
    // Calculate credit difference for upgrades
    let creditsToAdd = 0;
    if (planChanged && newPlan) {
      // Get old plan credits - if plan relation not hydrated, fetch it directly
      let oldCredits = existingSubscription.plan?.creditsPerMonth;
      if (oldCredits === undefined && existingSubscription.planId) {
        const oldPlan = await storage.getPlanById(existingSubscription.planId);
        oldCredits = oldPlan?.creditsPerMonth || 0;
        console.log('[Stripe Webhook] Fetched old plan credits directly:', { oldPlanId: existingSubscription.planId, oldCredits });
      }
      oldCredits = oldCredits || 0;
      
      const newCredits = newPlan.creditsPerMonth;
      
      // Only add credits if upgrading (new plan has more credits)
      if (newCredits > oldCredits) {
        creditsToAdd = newCredits - oldCredits;
        console.log('[Stripe Webhook] 📈 Upgrade detected, adding credits:', {
          oldCredits,
          newCredits,
          creditsToAdd,
        });
      } else if (newCredits < oldCredits) {
        console.log('[Stripe Webhook] 📉 Downgrade detected, no credits removed:', {
          oldCredits,
          newCredits,
        });
      }
    }

    // Update subscription with new plan if changed
    await storage.upsertUserSubscription({
      ...existingSubscription,
      planId: newPlan?.id || existingSubscription.planId,
      status: subscription.status as any,
      currentPeriodStart: currentPeriodStartDate,
      currentPeriodEnd: currentPeriodEndDate,
      cancelAtPeriodEnd: subData.cancel_at_period_end,
      canceledAt: subData.canceled_at ? new Date(subData.canceled_at * 1000) : null,
      creditsGrantedThisPeriod: newPlan?.creditsPerMonth || existingSubscription.creditsGrantedThisPeriod,
    });

    // Grant additional credits for upgrades
    if (creditsToAdd > 0) {
      const user = await storage.getUser(userId);
      if (user) {
        const newTotalCredits = (user.credits || 0) + creditsToAdd;
        await storage.updateUser(userId, { credits: newTotalCredits });
        console.log(`[Stripe Webhook] ✅ Granted ${creditsToAdd} upgrade credits to user ${userId} (Total: ${newTotalCredits})`);
      }
    }

    // Update Stripe subscription metadata with new planId
    if (planChanged && newPlan) {
      try {
        await stripe.subscriptions.update(subscription.id, {
          metadata: {
            ...subscription.metadata,
            planId: newPlan.id,
          },
        });
        console.log('[Stripe Webhook] Updated Stripe subscription metadata with new planId:', newPlan.id);
      } catch (error: any) {
        console.error('[Stripe Webhook] Failed to update Stripe metadata:', error.message);
      }
    }

    console.log(`[Stripe Webhook] Updated subscription status to ${subscription.status} for user ${userId}${planChanged ? ` (plan changed to ${newPlan?.displayName})` : ''}`);
  }
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhook] Processing customer.subscription.deleted', subscription.id);

  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in subscription metadata');
    return;
  }

  await storage.removeUserSubscription(userId);

  console.log(`[Stripe Webhook] Deleted subscription for user ${userId}`);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): Stripe.Event {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (error: any) {
    console.error('[Stripe Webhook] Signature verification failed:', error.message);
    throw new Error('Webhook signature verification failed');
  }
}

// =====================================================
// SOCIAL MEDIA POSTER ADD-ON ($25/month)
// =====================================================
import { getLateService, SOCIAL_POSTER_PRODUCT_ID, SOCIAL_POSTER_PRICE_ID } from './getLate';
import { socialProfiles } from '@shared/schema';

export async function createSocialPosterCheckoutSession(params: {
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const { userId, userEmail, successUrl, cancelUrl } = params;

  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  let customerId = user.stripeCustomerId || undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;
    await storage.updateUser(userId, { stripeCustomerId: customerId });
  }

  console.log('[Stripe Checkout] Creating Social Poster add-on session for user:', userId);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{
      price: SOCIAL_POSTER_PRICE_ID,
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      productType: 'social_poster_addon',
    },
    subscription_data: {
      metadata: {
        userId,
        productType: 'social_poster_addon',
      },
    },
  });

  return session;
}

// Embedded checkout for Social Media Poster (in-app purchase)
export async function createSocialPosterEmbeddedCheckout(params: {
  userId: string;
  userEmail: string;
  returnUrl: string;
}): Promise<{ clientSecret: string; sessionId: string }> {
  const { userId, userEmail, returnUrl } = params;

  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  let customerId = user.stripeCustomerId || undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;
    await storage.updateUser(userId, { stripeCustomerId: customerId });
  }

  console.log('[Stripe Embedded Checkout] Creating Social Poster session for user:', userId);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    ui_mode: 'embedded',
    line_items: [{
      price: SOCIAL_POSTER_PRICE_ID,
      quantity: 1,
    }],
    return_url: returnUrl,
    redirect_on_completion: 'if_required',
    metadata: {
      userId,
      productType: 'social_poster_addon',
    },
    subscription_data: {
      metadata: {
        userId,
        productType: 'social_poster_addon',
      },
    },
  });

  if (!session.client_secret) {
    throw new Error('Failed to create embedded checkout session');
  }

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
  };
}

export async function handleSocialPosterCheckout(session: Stripe.Checkout.Session, eventId: string) {
  console.log('[Stripe Webhook] Processing Social Poster checkout', session.id);

  const userId = session.metadata?.userId;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in Social Poster checkout metadata');
    return;
  }

  const user = await storage.getUser(userId);
  if (!user) {
    console.error('[Stripe Webhook] User not found for Social Poster checkout:', userId);
    return;
  }

  try {
    // Check if GetLate is configured
    if (!getLateService.isConfigured()) {
      throw new Error('Social media integration is not configured');
    }

    // Provision GetLate profile
    const userName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined;
    const getLateProfile = await getLateService.ensureUserProfile(userId, userName);
    console.log(`[GetLate] Created profile: ${getLateProfile.name} for user: ${user.email}`);

    // Create social profile in database
    await db.transaction(async (tx) => {
      // Check if profile already exists
      const [existingProfile] = await tx
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId));

      if (!existingProfile) {
        await tx.insert(socialProfiles).values({
          userId,
          getLateProfileId: getLateProfile._id,
          isActive: true,
        });
      } else {
        // Update existing profile with GetLate ID
        await tx
          .update(socialProfiles)
          .set({
            getLateProfileId: getLateProfile._id,
            isActive: true,
          })
          .where(eq(socialProfiles.userId, userId));
      }

      // Update user with Social Poster flag
      await tx
        .update(users)
        .set({
          hasSocialPoster: true,
          socialPosterSubscriptionId: subscriptionId,
        })
        .where(eq(users.id, userId));
    });

    console.log(`[Stripe Webhook] ✅ Social Poster activated for user ${userId} with GetLate profile: ${getLateProfile._id}`);
  } catch (error: any) {
    console.error('[Stripe Webhook] Failed to provision Social Poster:', error.message);
    throw error;
  }
}

export async function handleSocialPosterSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhook] Processing Social Poster subscription.deleted', subscription.id);

  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in Social Poster subscription metadata');
    return;
  }

  // Deactivate Social Poster for user
  await db
    .update(users)
    .set({
      hasSocialPoster: false,
      socialPosterSubscriptionId: null,
    })
    .where(eq(users.id, userId));

  // Also deactivate social profile
  await db
    .update(socialProfiles)
    .set({ isActive: false })
    .where(eq(socialProfiles.userId, userId));

  console.log(`[Stripe Webhook] Social Poster deactivated for user ${userId}`);
}

export function isSocialPosterProduct(lineItems: Stripe.LineItem[] | undefined): boolean {
  if (!lineItems) return false;
  return lineItems.some(item => 
    item.price?.product === SOCIAL_POSTER_PRODUCT_ID ||
    item.price?.id === SOCIAL_POSTER_PRICE_ID
  );
}

export function isSocialPosterSubscription(subscription: Stripe.Subscription): boolean {
  if (!subscription.items?.data) return false;
  return subscription.items.data.some(item =>
    (item.price?.product as string) === SOCIAL_POSTER_PRODUCT_ID ||
    item.price?.id === SOCIAL_POSTER_PRICE_ID
  );
}

// =====================================================
// CREDIT BOOST (One-time purchase)
// =====================================================

export async function createBoostEmbeddedCheckout(params: {
  userId: string;
  userEmail: string;
  returnUrl: string;
}): Promise<{ clientSecret: string; sessionId: string }> {
  const { userId, userEmail, returnUrl } = params;

  // Get boost settings from plan economics
  const economics = await storage.getPlanEconomics();
  if (!economics?.boostEnabled) {
    throw new Error('Credit boost is not currently available');
  }

  if (!economics.boostStripePriceId) {
    throw new Error('Credit boost is not configured in Stripe');
  }

  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  let customerId = user.stripeCustomerId || undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;
    await storage.updateUser(userId, { stripeCustomerId: customerId });
  }

  console.log('[Stripe Embedded Checkout] Creating Credit Boost session for user:', userId);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    ui_mode: 'embedded',
    line_items: [{
      price: economics.boostStripePriceId,
      quantity: 1,
    }],
    return_url: returnUrl,
    redirect_on_completion: 'if_required',
    metadata: {
      userId,
      productType: 'credit_boost',
      boostCredits: String(economics.boostCredits || 300),
    },
  });

  if (!session.client_secret) {
    throw new Error('Failed to create embedded checkout session');
  }

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
  };
}

export async function handleBoostCheckout(session: Stripe.Checkout.Session, eventId: string) {
  console.log('[Stripe Webhook] Processing Credit Boost checkout', session.id);

  const userId = session.metadata?.userId;
  const boostCredits = parseInt(session.metadata?.boostCredits || '0', 10);

  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in Credit Boost checkout metadata');
    return;
  }

  if (boostCredits <= 0) {
    console.error('[Stripe Webhook] Invalid boostCredits in metadata:', boostCredits);
    return;
  }

  const user = await storage.getUser(userId);
  if (!user) {
    console.error('[Stripe Webhook] User not found for Credit Boost checkout:', userId);
    return;
  }

  // Grant credits to user
  const currentCredits = user.credits || 0;
  const newCredits = currentCredits + boostCredits;

  await db
    .update(users)
    .set({ credits: newCredits })
    .where(eq(users.id, userId));

  console.log(`[Stripe Webhook] ✅ Credit Boost completed for user ${userId}: +${boostCredits} credits (${currentCredits} → ${newCredits})`);
}

export function isBoostProduct(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.productType === 'credit_boost';
}
