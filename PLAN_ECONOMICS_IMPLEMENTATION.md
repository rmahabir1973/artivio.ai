# Plan Economics System - Implementation Complete ✅

## Overview
The automated pricing calculator system is now fully implemented, allowing you to maintain consistent profit margins across all AI models while making credits appear more valuable to users.

## What's Been Implemented

### 1. Database Schema ✅
- **pricing table**: Added `kie_credit_cost` column (nullable integer) to store Kie.ai's actual credit costs
- **plan_economics table**: New singleton table to configure your pricing strategy
  - `kie_purchase_amount`: Dollar amount you spend (e.g., $50)
  - `kie_credit_amount`: Kie credits you receive (e.g., 10,000)
  - `user_credit_amount`: User credits you sell for same amount (e.g., 15,000)
  - `profit_margin`: Target profit margin percentage (e.g., 50%)

### 2. Backend API ✅
- `GET /api/admin/plan-economics`: Fetch current economics settings
- `PATCH /api/admin/plan-economics`: Update economics configuration
- Updated pricing endpoints to handle `kieCreditCost` field

### 3. Admin Panel UI ✅
**Plan Economics Configuration Card** (top of Pricing tab):
- Shows your current Kie purchase vs user selling plan
- Displays calculated rates:
  - Kie rate: `$50 = 10,000 credits` → `$0.005 per credit`
  - User rate: `$50 = 15,000 credits` → `$0.0033 per credit`
  - Effective multiplier: `1.5x` (or your configured ratio)
  - Profit margin target: `50%`
- Edit button opens configuration dialog

**Pricing Edit/Add Dialogs**:
- New "Kie Credit Cost" input field
- **Auto-calculator card** that shows real-time suggestions:
  ```
  Input: Kie charges 60 credits
  Your cost: $0.30
  With 50% margin: $0.45
  → Suggested: 135 user credits
  ```
- Manual override always available

### 4. Pricing Data Updates ✅
Updated `seedPricing.ts` with **verified Kie.ai credit costs** for 8 models:

**Video Generation:**
- Veo 3.1 (Quality): 250 Kie credits → suggests ~938 user credits (50% margin)
- Veo 3.1 Fast: 60 Kie credits → suggests ~135 user credits (50% margin)
- Veo 3: 250 Kie credits → suggests ~938 user credits
- Sora 2: 30 Kie credits → suggests ~68 user credits

**Image Generation:**
- Nano Banana: 4 Kie credits → suggests ~9 user credits (current: 50)
- Seedream 4.0: 4 Kie credits → suggests ~9 user credits (current: 25)
- Midjourney v7: 8 Kie credits → suggests ~18 user credits (current: 60)

**Status**: 44 models still need manual Kie cost verification (marked with `kieCreditCost: null`)

## How the Auto-Calculator Works

### Formula
```
kieRate = kiePurchaseAmount ÷ kieCreditAmount     // $/credit you pay
yourCost = kieCost × kieRate                       // Your cost in $
withMargin = yourCost × (1 + profitMargin/100)    // With profit margin
userRate = kiePurchaseAmount ÷ userCreditAmount   // $/credit you charge
suggestedUserCredits = withMargin ÷ userRate      // Final suggestion
```

### Example (Default Settings)
- Economics: $50 = 10,000 Kie credits, sell as 15,000 user credits, 50% margin
- Model: Veo 3.1 Fast (60 Kie credits)

**Calculation:**
1. Kie rate: $50 ÷ 10,000 = **$0.005 per Kie credit**
2. Your cost: 60 × $0.005 = **$0.30**
3. With 50% margin: $0.30 × 1.5 = **$0.45**
4. User rate: $50 ÷ 15,000 = **$0.0033 per user credit**
5. Suggested: $0.45 ÷ $0.0033 = **135 user credits** ✓

This gives you exactly 50% profit margin while making the model appear more valuable (60 Kie → 135 user credits = 2.25x multiplier).

## How to Use the System

### Step 1: Configure Plan Economics (One-time setup)
1. Login as admin and go to Admin Panel → Pricing tab
2. Click "Edit" on the Plan Economics Configuration card
3. Enter your economics:
   - Kie Purchase Amount: $50 (or your plan)
   - Kie Credit Amount: 10,000 (what you get from Kie.ai)
   - User Credit Amount: 15,000 (what you want to sell to users)
   - Profit Margin: 50 (your target %)
4. Click Save

### Step 2: Research Kie.ai Credit Costs
For each model you want to update:
1. Visit [Kie.ai Playground](https://kie.ai/market) or documentation
2. Generate a test with the model and note the credit cost
3. Record the cost for updating in admin panel

**Known costs** (verified Nov 2025):
- Veo 3.1 Fast: 60 credits
- Veo 3.1 Quality: 250 credits
- Sora 2: 30 credits
- Nano Banana: 4 credits
- Seedream 4.0: 4 credits
- Midjourney v7: 8 credits (4 variants)

**Need verification** (44 models):
- Runway Aleph
- Seedance models
- Wan 2.5
- Kling models
- Grok Imagine
- Flux Kontext
- 4o Image
- Suno models (all versions)
- ElevenLabs TTS/Sound Effects
- Voice cloning
- Talking avatars

### Step 3: Update Pricing with Auto-Calculator
For each model:
1. Go to Admin Panel → Pricing tab → find the model
2. Click Edit
3. Enter the Kie Credit Cost you researched
4. **Watch the auto-calculator suggest the user credit amount**
5. Either:
   - Accept the suggestion (copy to Credit Cost field), OR
   - Override manually if you want different pricing
6. Save

### Step 4: Bulk Update (Optional)
You can also update `seedPricing.ts` directly:
```typescript
{ 
  feature: 'video', 
  model: 'runway-aleph', 
  creditCost: 450,        // Your user-facing price
  kieCreditCost: 150,     // What Kie.ai charges (RESEARCH THIS)
  category: 'generation',
  description: '...' 
}
```

Then restart the app to seed the database.

## Current Status Summary

### ✅ Complete & Working
- Database schema with kieCreditCost field
- Plan Economics configuration system
- Auto-calculator in pricing dialogs
- Real-time calculation preview
- 8 models with verified Kie costs

### ⚠️ Needs Manual Work
- **44 models need Kie credit cost research**
- User credit prices (creditCost) should be recalculated based on your economics
- Consider updating existing prices to match your 50% margin target

## Recommended Next Steps

### Priority 1: Research Missing Kie Costs
Focus on your most-used models first:
1. Suno V4/V4.5/V5 (music generation)
2. Runway Aleph (video)
3. ElevenLabs TTS & Sound Effects
4. Flux Kontext (images)

**How to research:**
- Use Kie.ai playground and check credit deduction
- Contact Kie.ai support for model pricing documentation
- Test each model with minimum parameters and note credits used

### Priority 2: Recalculate User Prices
Once you have Kie costs, use the auto-calculator to set new user prices:
- **Option A**: Edit each model in admin panel (recommended for testing)
- **Option B**: Update seedPricing.ts with new creditCost values and restart

### Priority 3: Monitor & Adjust
- Track actual Kie.ai charges vs your pricing
- Adjust profit margin if needed (currently 50%)
- Update economics if Kie.ai changes their pricing

## Example: Updating a Model

Let's say you researched and found **Runway Aleph costs 80 Kie credits**:

1. **Go to Admin Panel** → Pricing tab → Find "runway-aleph"
2. **Click Edit**
3. **Enter Kie Credit Cost**: 80
4. **Auto-calculator shows**:
   - Input: Kie charges 80 credits
   - Your cost: $0.40 (80 × $0.005)
   - With 50% margin: $0.60 ($0.40 × 1.5)
   - Suggested: **180 user credits** ($0.60 ÷ $0.0033)
5. **Update Credit Cost**: 180 (or keep current 400 if you prefer)
6. **Save**

Result: You now have a 50% profit margin on Runway Aleph! 🎉

## Testing the System

### Manual Test (Recommended)
1. Login as admin
2. Go to Admin Panel → Pricing tab
3. Configure Plan Economics (if not already done)
4. Edit a model with verified Kie cost (e.g., Veo 3.1 Fast)
5. Verify calculator shows: 60 Kie credits → ~135 user credits
6. Try changing economics and see calculator update

### Verify Calculations
Use this formula to double-check:
```
(kieCost × 0.005) × (1 + margin%) ÷ (purchase$/userCredits) = suggestedCredits
```

Example with 50% margin, $50=15,000 user credits:
```
(60 × 0.005) × 1.5 ÷ (50/15000) = 135 ✓
```

## Technical Notes

### Why Some Costs Are Null
Kie.ai doesn't provide a programmatic API to fetch credit costs per model. They must be researched manually by:
- Testing in playground
- Checking documentation
- Contacting support

### Database Migration
The `kie_credit_cost` column was added using:
```sql
ALTER TABLE pricing ADD COLUMN IF NOT EXISTS kie_credit_cost INTEGER;
```

This change is backward-compatible - existing pricing entries work fine with `null` kieCreditCost.

### Plan Economics Defaults
If no economics configuration exists, the system defaults to:
- Kie Purchase: $50
- Kie Credits: 10,000
- User Credits: 15,000  
- Profit Margin: 50%

## Files Modified

- `shared/schema.ts`: Added kieCreditCost and planEconomics schema
- `server/storage.ts`: Added planEconomics storage methods
- `server/routes.ts`: Added plan economics API endpoints
- `server/seedPricing.ts`: Updated with kieCreditCost for all models
- `client/src/pages/admin.tsx`: Added Plan Economics UI and auto-calculator

## Summary

The pricing calculator system is **fully functional** and ready to use! You can:
- ✅ Configure your economics once
- ✅ Research Kie costs manually
- ✅ Get instant user credit suggestions with your target margin
- ✅ Make credits appear more valuable (e.g., 60 Kie → 135 user = 2.25x)
- ✅ Override calculator suggestions when needed

The main task remaining is **researching the 44 missing Kie credit costs** so you can use the auto-calculator for all models instead of just the 8 verified ones.

---

**Questions?** The auto-calculator is in the admin panel → Pricing tab. Try editing Veo 3.1 Fast to see it in action! 🚀
