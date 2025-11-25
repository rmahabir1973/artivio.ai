import { db } from "./db";
import { subscriptionPlans } from "@shared/schema";
import { eq } from "drizzle-orm";

// Default subscription plans with marketing copy
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
    name: "starter",
    displayName: "Starter",
    description: "Everything you need to bring your creative ideas to life. Perfect for individuals and content creators getting started with AI.",
    price: 1900, // $19.00
    monthlyPrice: 1900, // $19.00/month
    annualPrice: 14800, // $148/year (~35% off)
    billingPeriod: "monthly",
    creditsPerMonth: 4000,
    creditRolloverLimit: 2000,
    savingsPercentage: 35,
    features: [
      "4,000 credits per month",
      "Access to all AI models (Veo, Runway, Suno, etc.)",
      "Generate unlimited videos, images & music",
      "Priority support via email",
      "Rollover up to 2,000 unused credits"
    ],
    stripeProductId: null, // Will be set via admin panel
    stripePriceId: null, // Will be set via admin panel
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "pro",
    displayName: "Professional",
    description: "Unlock your full creative potential with our most popular plan. Ideal for professionals, agencies, and businesses scaling their content production.",
    price: 4900, // $49.00
    monthlyPrice: 4900, // $49.00/month
    annualPrice: 38400, // $384/year (~35% off)
    billingPeriod: "monthly",
    creditsPerMonth: 10000,
    creditRolloverLimit: 5000,
    savingsPercentage: 35,
    features: [
      "10,000 credits per month",
      "Access to all premium AI models",
      "Highest priority processing queue",
      "Priority support (email & chat)",
      "Rollover up to 5,000 unused credits",
      "Early access to new features & models"
    ],
    stripeProductId: null, // Will be set via admin panel
    stripePriceId: null, // Will be set via admin panel
    isActive: true,
    sortOrder: 2,
  },
];

/**
 * Initialize subscription plans in the database
 * Creates default plans if they don't exist
 * Updates existing plans if they already exist
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
        // Update existing plan
        await db
          .update(subscriptionPlans)
          .set({
            ...planData,
            updatedAt: new Date(),
          })
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
