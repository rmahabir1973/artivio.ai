-- ============================================
-- Artivio AI - Plan Cleanup Script
-- ============================================
-- This script helps clean up duplicate plans after migrating to Stripe single-product architecture
--
-- STEP 1: Review all current plans
-- ============================================

SELECT 
  id,
  name,
  display_name,
  price / 100.0 as price_dollars,
  credits_per_month,
  stripe_price_id,
  stripe_product_id,
  is_active,
  sort_order,
  created_at
FROM subscription_plans 
ORDER BY sort_order, created_at;

-- ============================================
-- STEP 2: Check for active subscriptions
-- ============================================
-- See which plans are actively being used by customers

SELECT 
  sp.name,
  sp.display_name,
  COUNT(us.id) as active_subscriptions
FROM subscription_plans sp
LEFT JOIN user_subscriptions us ON us.plan_id = sp.id
WHERE sp.is_active = true
GROUP BY sp.id, sp.name, sp.display_name
ORDER BY active_subscriptions DESC;

-- ============================================
-- STEP 3: Soft-delete old duplicate plans
-- ============================================
-- This will mark as inactive all plans EXCEPT the ones we want to keep
-- DO NOT RUN THIS YET - Review the results from STEP 1 and 2 first!
--
-- We'll keep only these plans:
-- 1. free (7 Day Free Trial) - 1,000 credits
-- 2. starter-monthly - 4,000 credits  
-- 3. starter-yearly - 4,000 credits
-- 4. pro-monthly - 10,000 credits
-- 5. pro-yearly - 10,000 credits
--
-- UNCOMMENT the following when you're ready:

/*
UPDATE subscription_plans 
SET is_active = false, updated_at = NOW()
WHERE name NOT IN ('free', 'starter', 'pro')
  OR id NOT IN (
    SELECT id FROM (
      SELECT id, 
        ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) as rn
      FROM subscription_plans
      WHERE name IN ('free', 'starter', 'pro')
    ) t WHERE t.rn = 1
  );
*/

-- ============================================
-- STEP 4: Update Stripe IDs for active plans  
-- ============================================
-- After running cleanup, update each plan with correct Stripe price/product IDs
-- Replace the price_XXX values with YOUR actual Stripe price IDs

/*
-- Free Trial (no Stripe)
UPDATE subscription_plans 
SET 
  stripe_price_id = NULL,
  stripe_product_id = NULL,
  updated_at = NOW()
WHERE name = 'free';

-- Starter Monthly
UPDATE subscription_plans 
SET 
  stripe_price_id = 'price_YOUR_STARTER_MONTHLY_ID',
  stripe_product_id = 'prod_YOUR_PRODUCT_ID',
  credits_per_month = 4000,
  price = 1900,  -- $19.00
  updated_at = NOW()
WHERE name = 'starter';

-- Pro Monthly  
UPDATE subscription_plans
SET 
  stripe_price_id = 'price_YOUR_PRO_MONTHLY_ID',
  stripe_product_id = 'prod_YOUR_PRODUCT_ID',
  credits_per_month = 10000,
  price = 4900,  -- $49.00
  updated_at = NOW()
WHERE name = 'pro';
*/
