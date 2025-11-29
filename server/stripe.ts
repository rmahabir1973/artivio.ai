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

  if (!userId || !planId) {
    console.error('[Stripe Webhook] Missing userId or planId in metadata');
    return;
  }

  // Fetch subscription BEFORE transaction (external API call)
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Execute ALL mutations in a single transaction for idempotency
  await db.transaction(async (tx) => {
    // 1. INSERT event record FIRST - if duplicate, this returns empty array
    const [eventRecord] = await tx
      .insert(stripeEvents)
      .values({
        eventId,
        eventType: 'checkout.session.completed',
        objectId: subscriptionId,
        customerId,
        metadata: JSON.stringify(session.metadata),
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    // If no record returned, event already processed (idempotency)
    if (!eventRecord) {
      console.log(`[Stripe Webhook] Event ${eventId} already processed, skipping`);
      return;
    }

    // 2. Get plan (read operation within transaction)
    const [plan] = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // 3. Upsert subscription
    await tx
      .insert(userSubscriptions)
      .values({
        userId,
        planId,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        status: 'active',
        currentPeriodStart: new Date((subscription.current_period_start as any) * 1000),
        currentPeriodEnd: new Date((subscription.current_period_end as any) * 1000),
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
          currentPeriodStart: new Date((subscription.current_period_start as any) * 1000),
          currentPeriodEnd: new Date((subscription.current_period_end as any) * 1000),
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
  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;

  if (!userId || !planId) {
    console.error('[Stripe Webhook] Missing userId or planId in subscription metadata');
    return;
  }

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
        customerId: subscription.customer as string,
        metadata: JSON.stringify({ billing_reason: invoice.billing_reason }),
        createdAt: new Date(),
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
      const newPeriodStart = new Date((subscription as any).current_period_start * 1000);
      const periodHasChanged = !existingSub || 
        !existingSub.currentPeriodStart ||
        existingSub.currentPeriodStart.getTime() !== newPeriodStart.getTime();

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
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
            creditsGrantedThisPeriod: plan.creditsPerMonth,
          })
          .onConflictDoUpdate({
            target: userSubscriptions.userId,
            set: {
              planId,
              stripeSubscriptionId: subscriptionId,
              status: 'active',
              currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
              currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
              cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
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
          currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
          creditsGrantedThisPeriod: existingSub?.creditsGrantedThisPeriod || 0,
        })
        .onConflictDoUpdate({
          target: userSubscriptions.userId,
          set: {
            planId,
            stripeSubscriptionId: subscriptionId,
            status: 'active',
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
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

  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;

  if (!userId) {
    console.error('[Stripe Webhook] Missing userId in subscription metadata');
    return;
  }

  const existingSubscription = await storage.getUserSubscription(userId);
  if (existingSubscription) {
    await storage.upsertUserSubscription({
      ...existingSubscription,
      status: subscription.status as any,
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      canceledAt: (subscription as any).canceled_at ? new Date((subscription as any).canceled_at * 1000) : null,
    });

    console.log(`[Stripe Webhook] Updated subscription status to ${subscription.status} for user ${userId}`);
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
