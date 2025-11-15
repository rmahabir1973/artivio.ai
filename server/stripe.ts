import Stripe from 'stripe';
import { storage } from './storage';
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

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{
      price: plan.stripePriceId,
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: userId,
      planId: planId,
    },
    subscription_data: {
      metadata: {
        userId: userId,
        planId: planId,
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

  // Check if event already processed (idempotency)
  const existingEvent = await storage.getStripeEventById(eventId);
  if (existingEvent) {
    console.log(`[Stripe Webhook] Event ${eventId} already processed, skipping`);
    return;
  }

  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId || !planId) {
    console.error('[Stripe Webhook] Missing userId or planId in metadata');
    return;
  }

  const plan = await storage.getPlanById(planId);
  if (!plan) {
    console.error('[Stripe Webhook] Plan not found:', planId);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Check existing subscription to prevent duplicate credit grants
  const existingSubscription = await storage.getUserSubscription(userId);
  const shouldGrantCredits = !existingSubscription || existingSubscription.creditsGrantedThisPeriod < plan.creditsPerMonth;

  if (shouldGrantCredits) {
    await storage.upsertUserSubscription({
      userId,
      planId,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      status: 'active',
      currentPeriodStart: new Date((subscription.current_period_start as any) * 1000),
      currentPeriodEnd: new Date((subscription.current_period_end as any) * 1000),
      cancelAtPeriodEnd: false,
      creditsGrantedThisPeriod: plan.creditsPerMonth,
    });

    await storage.addCreditsAtomic(userId, plan.creditsPerMonth);

    console.log(`[Stripe Webhook] Granted ${plan.creditsPerMonth} credits to user ${userId}`);
  } else {
    console.log(`[Stripe Webhook] Credits already granted this period for user ${userId}`);
  }

  // Mark event as processed
  await storage.createStripeEvent({
    eventId,
    eventType: 'checkout.session.completed',
    processed: true,
    createdAt: new Date(),
  });
}

export async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string) {
  console.log('[Stripe Webhook] Processing invoice.paid', invoice.id);

  // Check if event already processed (idempotency)
  const existingEvent = await storage.getStripeEventById(eventId);
  if (existingEvent) {
    console.log(`[Stripe Webhook] Event ${eventId} already processed, skipping`);
    return;
  }

  const subscriptionId = (invoice as any).subscription as string;
  if (!subscriptionId) {
    console.log('[Stripe Webhook] Invoice not for subscription, skipping');
    await storage.createStripeEvent({
      eventId,
      eventType: 'invoice.paid',
      processed: true,
      createdAt: new Date(),
    });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;

  if (!userId || !planId) {
    console.error('[Stripe Webhook] Missing userId or planId in subscription metadata');
    return;
  }

  const plan = await storage.getPlanById(planId);
  if (!plan) {
    console.error('[Stripe Webhook] Plan not found:', planId);
    return;
  }

  const existingSubscription = await storage.getUserSubscription(userId);
  
  const isRenewal = invoice.billing_reason === 'subscription_cycle';
  
  if (isRenewal) {
    // Only grant credits if not already granted this period
    const shouldGrantCredits = !existingSubscription || existingSubscription.creditsGrantedThisPeriod < plan.creditsPerMonth;

    if (shouldGrantCredits) {
      await storage.upsertUserSubscription({
        userId,
        planId,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: subscription.customer as string,
        status: 'active',
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        creditsGrantedThisPeriod: plan.creditsPerMonth,
      });

      await storage.addCreditsAtomic(userId, plan.creditsPerMonth);

      console.log(`[Stripe Webhook] Renewal: Granted ${plan.creditsPerMonth} credits to user ${userId}`);
    } else {
      console.log(`[Stripe Webhook] Credits already granted this period for user ${userId}`);
    }
  } else {
    await storage.upsertUserSubscription({
      userId,
      planId,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: subscription.customer as string,
      status: 'active',
      currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      creditsGrantedThisPeriod: existingSubscription?.creditsGrantedThisPeriod || 0,
    });
    
    console.log(`[Stripe Webhook] Invoice paid (non-renewal)`);
  }

  // Mark event as processed
  await storage.createStripeEvent({
    eventId,
    eventType: 'invoice.paid',
    processed: true,
    createdAt: new Date(),
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
