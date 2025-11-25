#!/bin/bash

# Test script to reset subscription plans
# This will call the admin API endpoint to purge duplicates and recreate canonical plans

echo "🔄 Resetting subscription plans..."
echo ""

# Make the API call (you'll need to be logged in as admin)
curl -X POST "http://localhost:5000/api/admin/plans/reset" \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_ADMIN_COOKIE_HERE" \
  | jq '.'

echo ""
echo "✅ Reset complete!"
echo ""
echo "Next steps:"
echo "1. Login to the admin panel"
echo "2. Navigate to Subscription Plans"
echo "3. Update each plan with your Stripe Price IDs"
echo "4. Republish to production"
