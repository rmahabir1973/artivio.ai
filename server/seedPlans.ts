import { db } from "./db";
import { subscriptionPlans } from "@shared/schema";
import { eq } from "drizzle-orm";

// Default subscription plans with marketing copy
// NOTE: Stripe IDs (stripePriceId, stripeProductId) are NOT set here
// They must be configured via Admin Panel → Subscription Plans
// This ensures admin changes are always authoritative
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
    creditRolloverLimit: 0,
    savingsPercentage: 0,
    features: [
      "4,000 credits per month",
      "Access to all AI models (Veo, Runway, Suno, etc.)",
      "Generate unlimited videos, images & music",
      "Priority support via email",
      "Credits reset monthly"
    ],
    stripeProductId: null, // Set via Admin Panel
    stripePriceId: null,   // Set via Admin Panel
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
    creditRolloverLimit: 0,
    savingsPercentage: 35,
    features: [
      "4,000 credits per month",
      "Access to all AI models (Veo, Runway, Suno, etc.)",
      "Generate unlimited videos, images & music",
      "Priority support via email",
      "Credits reset monthly",
      "Save 35% with annual billing"
    ],
    stripeProductId: null, // Set via Admin Panel
    stripePriceId: null,   // Set via Admin Panel
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
    creditRolloverLimit: 0,
    savingsPercentage: 0,
    features: [
      "10,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Priority support (email & chat)",
      "Credits reset monthly",
      "Early access to new features & models"
    ],
    stripeProductId: null, // Set via Admin Panel
    stripePriceId: null,   // Set via Admin Panel
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
    creditRolloverLimit: 0,
    savingsPercentage: 35,
    features: [
      "10,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Priority support (email & chat)",
      "Credits reset monthly",
      "Early access to new features & models",
      "Save 35% with annual billing"
    ],
    stripeProductId: null, // Set via Admin Panel
    stripePriceId: null,   // Set via Admin Panel
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
    creditRolloverLimit: 0,
    savingsPercentage: 0,
    features: [
      "20,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Priority support (email & chat)",
      "Credits reset monthly",
      "Early access to new features & models",
      "Dedicated account manager"
    ],
    stripeProductId: null, // Set via Admin Panel
    stripePriceId: null,   // Set via Admin Panel
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
    creditRolloverLimit: 0,
    savingsPercentage: 35,
    features: [
      "20,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Priority support (email & chat)",
      "Credits reset monthly",
      "Early access to new features & models",
      "Dedicated account manager",
      "Save 35% with annual billing"
    ],
    stripeProductId: null, // Set via Admin Panel
    stripePriceId: null,   // Set via Admin Panel
    isActive: true,
    sortOrder: 6,
  },
];

/**
 * Initialize subscription plans in the database
 * ONLY creates plans that don't exist - NEVER overwrites existing plans
 * This ensures admin panel changes persist across server restarts
 * 
 * IMPORTANT: Stripe IDs (stripePriceId, stripeProductId) are NOT set by seeding.
 * They must be configured via Admin Panel → Subscription Plans after plans are created.
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
        // Plan exists - DO NOT update it, preserve admin changes
        console.log(`  ⏭️  Skipped plan (already exists): ${planData.displayName}`);
      } else {
        // Create new plan only if it doesn't exist
        // Note: Stripe IDs will need to be set via Admin Panel
        await db
          .insert(subscriptionPlans)
          .values(planData);
        console.log(`  ✓ Created plan: ${planData.displayName} (configure Stripe IDs in Admin Panel)`);
      }
    } catch (error) {
      console.error(`  ✗ Error initializing plan ${planData.displayName}:`, error);
    }
  }
  
  console.log('✓ Subscription plans initialized successfully');
  console.log('📝 Remember: Configure Stripe Price IDs in Admin Panel → Subscription Plans');
}
