import { db } from "./db";
import { subscriptionPlans } from "@shared/schema";
import { eq } from "drizzle-orm";

// Default subscription plans
const defaultPlans = [
  {
    name: "free",
    displayName: "Free",
    description: "Get started with basic features",
    price: 0,
    billingPeriod: "monthly",
    creditsPerMonth: 1000,
    creditRolloverLimit: 500,
    features: [
      "1,000 credits per month",
      "Basic video generation",
      "Basic image generation",
      "Community support"
    ],
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "starter",
    displayName: "Starter",
    description: "Perfect for individuals and small projects",
    price: 1999, // $19.99
    billingPeriod: "monthly",
    creditsPerMonth: 5000,
    creditRolloverLimit: 2500,
    features: [
      "5,000 credits per month",
      "All AI models access",
      "Priority generation queue",
      "Email support",
      "Up to 2,500 credit rollover"
    ],
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "pro",
    displayName: "Pro",
    description: "For professionals and growing teams",
    price: 4999, // $49.99
    billingPeriod: "monthly",
    creditsPerMonth: 15000,
    creditRolloverLimit: 7500,
    features: [
      "15,000 credits per month",
      "All AI models access",
      "Highest priority queue",
      "Priority email & chat support",
      "Up to 7,500 credit rollover",
      "Early access to new features"
    ],
    isActive: true,
    sortOrder: 3,
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
