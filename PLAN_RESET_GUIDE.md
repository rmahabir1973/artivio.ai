# Subscription Plan Reset Guide

## 🚨 What's Causing the 500 Errors

Your production database has **duplicate subscription plans** from when you manually created separate Stripe products. This causes:
- Query failures when fetching plans
- Reorder endpoint throwing 400/500 errors  
- Cascading failures across the admin panel

## ✅ The Safe Fix

I've implemented a **safe plan reset system** that:

1. **Checks for active subscriptions** - Aborts if any exist (protects your customers)
2. **Deletes ALL duplicate plans** - Cleans up the database completely
3. **Creates 3 canonical plans** - Free Trial, Starter, Professional
4. **Prevents future duplicates** - Uniqueness constraints on `name` and `stripePriceId`

## 📋 New Plan Structure

### Free Trial
- **Credits**: 1,000 (one-time)
- **Price**: $0
- **Description**: "Experience the full power of AI creation with no commitment"
- **Features**: Access to all models, 7-day trial, no credit card

### Starter  
- **Credits**: 4,000/month
- **Price**: $19/month or $148/year (~35% off)
- **Description**: "Perfect for individuals and content creators getting started"
- **Features**: All AI models, priority support, 2K credit rollover

### Professional
- **Credits**: 10,000/month
- **Price**: $49/month or $384/year (~35% off)
- **Description**: "Ideal for professionals, agencies, and businesses scaling content"
- **Features**: Premium models, highest priority queue, 5K credit rollover, early access

## 🔧 How to Execute the Reset

### Step 1: Login to Admin Panel
1. Navigate to https://artivio.ai/admin
2. Login with your admin account

### Step 2: Reset Plans (Coming Soon - UI Button)
Currently, you need to call the API directly:

```bash
# Using curl (you'll need your auth cookie)
curl -X POST "https://artivio.ai/api/admin/plans/reset" \
  -H "Cookie: YOUR_COOKIE_HERE"
```

**OR** I can add a UI button to the admin panel.

### Step 3: Configure Stripe IDs
After reset, you'll have 3 clean plans. Now add your Stripe IDs:

1. Go to Admin Panel → Subscription Plans
2. Click "Edit" on each plan
3. Add your Stripe Price ID and Product ID:
   - Starter Monthly: `price_YOUR_STARTER_MONTHLY_ID` → `prod_YOUR_PRODUCT_ID`
   - Professional Monthly: `price_YOUR_PRO_MONTHLY_ID` → `prod_YOUR_PRODUCT_ID`

### Step 4: Test Before Republish
1. Check admin panel loads without 500 errors
2. Verify all 3 plans display correctly
3. Test creating a checkout session
4. Confirm pricing displays properly

### Step 5: Republish
Once verified, republish your app and the 500 errors should be gone!

## 🛡️ Safety Guarantees

- ✅ Won't run if ANY active subscriptions exist
- ✅ Runs in database transaction (all-or-nothing)
- ✅ Schema enforces uniqueness (prevents future duplicates)
- ✅ Preserves all other data (users, generations, etc.)

## ⚠️ Important Notes

**Before resetting:**
- This will delete ALL existing plans
- Any active subscriptions will prevent the reset
- You'll need to re-enter Stripe Price/Product IDs after reset

**If you have active subscriptions:**
- You'll need to manually migrate them or wait for them to expire
- Contact me if you need a migration solution

## 🚀 Next Steps

1. Add UI button to admin panel (optional - makes it easier)
2. Test reset in development environment first
3. Execute production reset
4. Configure Stripe IDs
5. Test and republish

Would you like me to add a UI button to make the reset easier to trigger?
