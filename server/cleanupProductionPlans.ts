/**
 * Production Plan Cleanup Script
 * 
 * This script helps clean up duplicate plans after migrating to Stripe's single-product architecture.
 * 
 * USAGE:
 *   1. Review what plans will be affected
 *   2. Set DRY_RUN = false to actually make changes
 *   3. Run: npx tsx server/cleanupProductionPlans.ts
 */

import { db } from "./db";
import { subscriptionPlans, userSubscriptions } from "@shared/schema";
import { eq, inArray, not } from "drizzle-orm";

const DRY_RUN = true; // Set to false to actually make changes

async function cleanupPlans() {
  console.log('🔍 Analyzing subscription plans...\n');
  console.log(`Mode: ${DRY_RUN ? '🔒 DRY RUN (no changes will be made)' : '⚠️  LIVE MODE (will make changes)'}\n`);

  // Step 1: Get all plans
  const allPlans = await db
    .select()
    .from(subscriptionPlans)
    .orderBy(subscriptionPlans.sortOrder, subscriptionPlans.createdAt);

  console.log(`📊 Found ${allPlans.length} total plans:\n`);
  
  for (const plan of allPlans) {
    const price = plan.price ? (plan.price / 100).toFixed(2) : '0.00';
    const active = plan.isActive ? '✅' : '❌';
    console.log(`  ${active} ${plan.displayName} (${plan.name})`);
    console.log(`     💰 $${price}/mo | 🎫 ${plan.creditsPerMonth} credits | 🔢 Order: ${plan.sortOrder}`);
    console.log(`     🆔 Plan ID: ${plan.id}`);
    console.log(`     💳 Stripe: ${plan.stripePriceId ? plan.stripePriceId.substring(0, 20) + '...' : 'Not set'}`);
    console.log('');
  }

  // Step 2: Check which plans have active subscriptions
  console.log('\n🔍 Checking for active subscriptions...\n');
  
  const plansWithSubs = await db
    .select({
      planId: userSubscriptions.planId,
      count: db.$count(userSubscriptions.id)
    })
    .from(userSubscriptions)
    .groupBy(userSubscriptions.planId);

  const planSubsMap = new Map(plansWithSubs.map(p => [p.planId, Number(p.count)]));

  for (const plan of allPlans) {
    const subCount = planSubsMap.get(plan.id) || 0;
    if (subCount > 0) {
      console.log(`  ⚠️  ${plan.displayName}: ${subCount} active subscription(s)`);
    }
  }

  // Step 3: Identify plans to keep (only free, starter, pro)
  const plansToKeep = allPlans.filter(plan => 
    ['free', 'starter', 'pro'].includes(plan.name) && plan.isActive
  );

  // Step 4: Identify duplicate plans (same name, older created_at)
  const duplicatePlans = new Map<string, typeof allPlans>();
  
  for (const plan of allPlans) {
    if (!['free', 'starter', 'pro'].includes(plan.name)) {
      continue;
    }
    
    if (!duplicatePlans.has(plan.name)) {
      duplicatePlans.set(plan.name, []);
    }
    duplicatePlans.get(plan.name)!.push(plan);
  }

  const plansToDeactivate: string[] = [];
  
  for (const [name, plans] of Array.from(duplicatePlans.entries())) {
    if (plans.length > 1) {
      // Keep the oldest one (first created), mark others as inactive
      const sorted = [...plans].sort((a, b) => 
        a.createdAt.getTime() - b.createdAt.getTime()
      );
      
      const toKeep = sorted[0];
      const toDeactivate = sorted.slice(1);
      
      console.log(`\n  📝 ${name}: Found ${plans.length} versions`);
      console.log(`     ✅ Keeping: ${toKeep.displayName} (${toKeep.id.substring(0, 8)}...)`);
      
      for (const plan of toDeactivate) {
        const hasSubs = planSubsMap.get(plan.id) || 0;
        if (hasSubs > 0) {
          console.log(`     ⚠️  Cannot deactivate ${plan.displayName} (${plan.id.substring(0, 8)}...) - has ${hasSubs} subscription(s)`);
        } else {
          console.log(`     ❌ Will deactivate: ${plan.displayName} (${plan.id.substring(0, 8)}...)`);
          plansToDeactivate.push(plan.id);
        }
      }
    }
  }

  // Step 5: Deactivate plans that don't match our core 3 (free, starter, pro)
  const corePlanNames = ['free', 'starter', 'pro'];
  const extraPlans = allPlans.filter(plan => 
    !corePlanNames.includes(plan.name) && plan.isActive
  );

  if (extraPlans.length > 0) {
    console.log(`\n  📝 Found ${extraPlans.length} extra plan(s) not in core set:\n`);
    
    for (const plan of extraPlans) {
      const hasSubs = planSubsMap.get(plan.id) || 0;
      if (hasSubs > 0) {
        console.log(`     ⚠️  Cannot deactivate ${plan.displayName} - has ${hasSubs} subscription(s)`);
      } else {
        console.log(`     ❌ Will deactivate: ${plan.displayName} (${plan.name})`);
        plansToDeactivate.push(plan.id);
      }
    }
  }

  // Step 6: Execute cleanup
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`📋 SUMMARY:`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`  Total plans: ${allPlans.length}`);
  console.log(`  Plans to keep active: ${plansToKeep.length}`);
  console.log(`  Plans to deactivate: ${plansToDeactivate.length}`);
  
  if (plansToDeactivate.length === 0) {
    console.log('\n✅ No cleanup needed! Database is already clean.\n');
    return;
  }

  if (!DRY_RUN) {
    console.log('\n⚠️  Proceeding with cleanup...\n');
    
    const result = await db
      .update(subscriptionPlans)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(inArray(subscriptionPlans.id, plansToDeactivate))
      .returning();

    console.log(`✅ Successfully deactivated ${result.length} plan(s)\n`);
  } else {
    console.log('\n🔒 DRY RUN MODE - No changes made');
    console.log('   Set DRY_RUN = false at the top of this script to apply changes\n');
  }
}

cleanupPlans()
  .then(() => {
    console.log('✅ Cleanup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  });
