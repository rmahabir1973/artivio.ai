import { db } from "./db";
import { subscriptionPlans } from "@shared/schema";
import { eq } from "drizzle-orm";

// Default subscription plans with marketing copy and Stripe IDs
export const defaultPlans = [
  {
    name: "free",
    displayName: "7 Day Free Trial",
    description: "Experience the full power of AI creation with no commitment. Perfect for exploring all our features risk-free.",
    price: 0,
    monthlyPrice: 0,
    annualPrice: 0,
    billingPeriod: "trial",
    trialDays: 7,
    creditsPerMonth: 1000,
    creditRolloverLimit: 0,
    savingsPercentage: 0,
    features: [
      "1,000 credits to start creating",
      "Access to all AI models and features",
      "Generate videos, images, and music",
      "7-day trial period",
      "No credit card required"
    ],
    stripeProductId: null,
    stripePriceId: null,
    isActive: true,
    sortOrder: 0,
  },
  {
    name: "starter-monthly",
    displayName: "Starter",
    description: "Everything you need to bring your creative ideas to life. Perfect for individuals and content creators getting started with AI.",
    price: 1900, // $19.00/month
    monthlyPrice: 1900,
    annualPrice: null,
    billingPeriod: "monthly",
    creditsPerMonth: 4000,
    creditRolloverLimit: 2000,
    savingsPercentage: 0,
    features: [
      "4,000 credits per month",
      "Access to all AI models (Veo, Runway, Suno, etc.)",
      "Generate unlimited videos, images & music",
      "Priority support via email",
      "Rollover up to 2,000 unused credits"
    ],
    stripeProductId: "prod_TUAOGMBKxiYbwT",
    stripePriceId: "price_1SXC65KvkQIROMzfKMV2IETR",
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "starter-yearly",
    displayName: "Starter (Annual)",
    description: "Everything you need to bring your creative ideas to life. Save 35% with annual billing!",
    price: 14800, // $148/year
    monthlyPrice: null,
    annualPrice: 14800,
    billingPeriod: "annual",
    creditsPerMonth: 4000,
    creditRolloverLimit: 2000,
    savingsPercentage: 35,
    features: [
      "4,000 credits per month",
      "Access to all AI models (Veo, Runway, Suno, etc.)",
      "Generate unlimited videos, images & music",
      "Priority support via email",
      "Rollover up to 2,000 unused credits",
      "Save 35% with annual billing"
    ],
    stripeProductId: "prod_TUAOGMBKxiYbwT",
    stripePriceId: "price_1SXCABKvkQIROMzfCUt5gQFq",
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "pro-monthly",
    displayName: "Professional",
    description: "Unlock your full creative potential with our most popular plan. Ideal for professionals, agencies, and businesses scaling their content production.",
    price: 4900, // $49.00/month
    monthlyPrice: 4900,
    annualPrice: null,
    billingPeriod: "monthly",
    creditsPerMonth: 10000,
    creditRolloverLimit: 5000,
    savingsPercentage: 0,
    features: [
      "10,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Priority support (email & chat)",
      "Rollover up to 5,000 unused credits",
      "Early access to new features & models"
    ],
    stripeProductId: "prod_TUAOGMBKxiYbwT",
    stripePriceId: "price_1SXCUZKvkQIROMzflhWxr4hz",
    isActive: true,
    sortOrder: 3,
  },
  {
    name: "pro-yearly",
    displayName: "Professional (Annual)",
    description: "Unlock your full creative potential and save 35% with annual billing. Perfect for professionals and businesses.",
    price: 38400, // $384/year
    monthlyPrice: null,
    annualPrice: 38400,
    billingPeriod: "annual",
    creditsPerMonth: 10000,
    creditRolloverLimit: 5000,
    savingsPercentage: 35,
    features: [
      "10,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Priority support (email & chat)",
      "Rollover up to 5,000 unused credits",
      "Early access to new features & models",
      "Save 35% with annual billing"
    ],
    stripeProductId: "prod_TUAOGMBKxiYbwT",
    stripePriceId: "price_1SXCVhKvkQIROMzfOktck8wI",
    isActive: true,
    sortOrder: 4,
  },
  {
    name: "business-monthly",
    displayName: "Business",
    description: "Scale your content production with powerful AI tools. Perfect for growing businesses and marketing teams.",
    price: 9900, // $99/month
    monthlyPrice: 9900,
    annualPrice: null,
    billingPeriod: "monthly",
    creditsPerMonth: 20000,
    creditRolloverLimit: 10000,
    savingsPercentage: 0,
    features: [
      "20,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Priority support (email & chat)",
      "Rollover up to 10,000 unused credits",
      "Early access to new features & models",
      "Dedicated account manager"
    ],
    stripeProductId: "prod_TUAOGMBKxiYbwT",
    stripePriceId: "price_1SXCWefvkQIROMzfH2Mgwnvv",
    isActive: true,
    sortOrder: 5,
  },
  {
    name: "business-yearly",
    displayName: "Business (Annual)",
    description: "Scale your content production and save 35% with annual billing. Perfect for growing businesses and marketing teams.",
    price: 76800, // $768/year
    monthlyPrice: null,
    annualPrice: 76800,
    billingPeriod: "annual",
    creditsPerMonth: 20000,
    creditRolloverLimit: 10000,
    savingsPercentage: 35,
    features: [
      "20,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Priority support (email & chat)",
      "Rollover up to 10,000 unused credits",
      "Early access to new features & models",
      "Dedicated account manager",
      "Save 35% with annual billing"
    ],
    stripeProductId: "prod_TUAOGMBKxiYbwT",
    stripePriceId: "price_1SXCX9KvkQIROMzf8mRWcyyy",
    isActive: true,
    sortOrder: 6,
  },
  {
    name: "agency-monthly",
    displayName: "Agency",
    description: "Enterprise-grade AI content generation at scale. Perfect for agencies, studios, and large organizations.",
    price: 24900, // $249/month
    monthlyPrice: 24900,
    annualPrice: null,
    billingPeriod: "monthly",
    creditsPerMonth: 50000,
    creditRolloverLimit: 25000,
    savingsPercentage: 0,
    features: [
      "50,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Premium 24/7 support (email, chat & phone)",
      "Rollover up to 25,000 unused credits",
      "Early access to new features & models",
      "Dedicated account manager",
      "Custom integration support"
    ],
    stripeProductId: "prod_TUAOGMBKxiYbwT",
    stripePriceId: "price_1SXCYOKvkQIROMzfu2heHfcM",
    isActive: true,
    sortOrder: 7,
  },
  {
    name: "agency-yearly",
    displayName: "Agency (Annual)",
    description: "Enterprise-grade AI at scale with 35% savings. Perfect for agencies, studios, and large organizations.",
    price: 194220, // $1,942.20/year
    monthlyPrice: null,
    annualPrice: 194220,
    billingPeriod: "annual",
    creditsPerMonth: 50000,
    creditRolloverLimit: 25000,
    savingsPercentage: 35,
    features: [
      "50,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Premium 24/7 support (email, chat & phone)",
      "Rollover up to 25,000 unused credits",
      "Early access to new features & models",
      "Dedicated account manager",
      "Custom integration support",
      "Save 35% with annual billing"
    ],
    stripeProductId: "prod_TUAOGMBKxiYbwT",
    stripePriceId: "price_1SXCYKKvkQIROMzfCRlLjHb1",
    isActive: true,
    sortOrder: 8,
  },
];

/**
 * Initialize subscription plans in the database
 * Creates default plans if they don't exist
 * Updates existing plans if they already exist
 * IMPORTANT: Preserves admin-configured Stripe IDs to avoid overwriting
 */
export async function initializePlans() {
  console.log('📋 Initializing subscription plans...');
  
  for (const planData of defaultPlans) {
    try {
      // Check if plan already exists
      const [existingPlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.name, planData.name))
        .limit(1);

      if (existingPlan) {
        // Update existing plan but PRESERVE admin-configured Stripe IDs
        // Only use seed Stripe IDs if no IDs are set in the database
        const updateData = {
          ...planData,
          // Preserve existing Stripe IDs if they're already set in the database
          stripePriceId: existingPlan.stripePriceId || planData.stripePriceId,
          stripeProductId: existingPlan.stripeProductId || planData.stripeProductId,
          updatedAt: new Date(),
        };
        
        await db
          .update(subscriptionPlans)
          .set(updateData)
          .where(eq(subscriptionPlans.name, planData.name));
        console.log(`  ✓ Updated plan: ${planData.displayName}`);
      } else {
        // Create new plan
        await db
          .insert(subscriptionPlans)
          .values(planData);
        console.log(`  ✓ Created plan: ${planData.displayName}`);
      }
    } catch (error) {
      console.error(`  ✗ Error initializing plan ${planData.displayName}:`, error);
    }
  }
  
  console.log('✓ Subscription plans initialized successfully');
}
