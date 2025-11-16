# Loops.so Email Marketing Integration

## Overview
Artivio AI integrates with Loops.so email marketing platform to automatically enroll new free trial users into a 7-day email funnel. This helps convert trial users into paid subscribers through automated educational content.

## Configuration

### API Key
The integration uses the `LOOPS_API_KEY` secret stored in the environment:
- **Storage**: Environment variable `LOOPS_API_KEY`
- **Security**: Never commit or expose this key in code or documentation
- **Rotation**: If compromised, generate a new key in Loops.so dashboard

### 7-Day Funnel List
The integration adds users to the **"Free Trial 7 Day Funnel"** mailing list.
- Users are enrolled automatically on their first login
- Only Free plan users are enrolled
- Email delivery is managed by Loops.so

## How It Works

### Automatic Enrollment
When a new user signs up with the Free plan:
1. User completes Replit authentication
2. Plan is assigned and credits are granted
3. User is automatically added to the 7-day funnel
4. Loops.so begins sending scheduled emails

### Code Implementation

**Location**: `server/routes.ts`, lines 757-777

```typescript
// After successful first login and plan assignment
if (selectedPlanName === 'Free' && user.email) {
  LoopsService.addToSevenDayFunnel(
    user.email,
    user.name?.split(' ')[0],
    user.name?.split(' ').slice(1).join(' '),
    userId
  ).catch(loopsError => {
    logger.error('LOOPS', 'Failed to add user to 7-day funnel', {
      error: loopsError instanceof Error ? loopsError.message : String(loopsError)
    });
  });
}
```

**Service Layer**: `server/loops.ts`
- `LoopsService.addToSevenDayFunnel()` - Adds contact to funnel
- `LoopsService.getMailingLists()` - Fetches all lists
- Handles API errors gracefully
- Uses structured logging for debugging

## Admin Testing Endpoints

### Fetch All Mailing Lists
**Endpoint**: `GET /api/admin/loops/lists`
**Access**: Admin only
**Returns**: Array of all mailing lists from Loops.so

```bash
curl https://artivio.replit.app/api/admin/loops/lists \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Expected Response**:
```json
{
  "lists": [
    {
      "id": "cm123abc...",
      "name": "Free Trial 7 Day Funnel",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Test Contact Addition
**Endpoint**: `POST /api/admin/loops/test`
**Access**: Admin only
**Purpose**: Manually test adding a contact to the funnel

```bash
curl -X POST https://artivio.replit.app/api/admin/loops/test \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "id": "contact_id_here"
}
```

## Logging and Monitoring

### Structured Logging
All Loops.so operations use the structured logger (`server/logger.ts`):

```typescript
import { logger } from './logger';

// CORRECT: 3-parameter signature (category, message, metadata)
// No PII fields (email, userId, names) in metadata
logger.info('LOOPS', 'Contact created successfully', { 
  listCount: 2
});

logger.error('LOOPS', 'Failed to create contact', { 
  error: err.message
});

// WRONG: Missing category parameter - bypasses PII scrubbing!
// logger.error('Failed to add contact', { error });
```

### Log Levels
- **Production**: Set `LOG_LEVEL=warn` to minimize volume
- **Development**: Use `LOG_LEVEL=info` for detailed tracking
- **Debug**: Use `LOG_LEVEL=debug` for API request/response details

### What Gets Logged
- Successful funnel additions (info level) - no PII
- API failures (error level) - error messages only
- User signup flow integration (info level) - no PII
- **No personally identifiable information** (emails, user IDs, names) is logged

## Error Handling

### Graceful Degradation
The integration uses fire-and-forget error handling:
- Loops.so failures do NOT block user signup
- Errors are logged but users can continue
- Credit grants happen regardless of email enrollment

```typescript
LoopsService.addToSevenDayFunnel(...)
  .catch(loopsError => {
    logger.error('LOOPS', 'Funnel enrollment failed', { 
      error: loopsError.message 
    });
    // User signup continues normally
  });
```

### Common Issues

**Issue**: "Failed to add user to Loops.so"
- **Cause**: Invalid API key or network timeout
- **Solution**: Verify `LOOPS_API_KEY` is correct
- **Impact**: User signup succeeds, email funnel skipped

**Issue**: "Mailing list not found"
- **Cause**: "Free Trial 7 Day Funnel" doesn't exist
- **Solution**: Create the list in Loops.so dashboard
- **Impact**: Contacts won't be enrolled

## Best Practices

### 1. Only Free Plan Users
```typescript
if (selectedPlanName === 'Free' && user.email) {
  // Enroll in funnel
}
```

### 2. Email Validation
```typescript
if (user.email && user.email.includes('@')) {
  // Proceed with enrollment
}
```

### 3. Async Execution
```typescript
// Don't await - use fire-and-forget
LoopsService.addToSevenDayFunnel(...)
  .catch(err => logger.error(...));
```

### 4. PII Protection
- Never log raw emails in production
- Use structured logger which auto-scrubs PII
- UUIDs and user IDs are redacted automatically

## Testing the Integration

### Manual Test Flow
1. Create a new account with a test email
2. Select "Free" plan during signup
3. Complete authentication
4. Check Loops.so dashboard for new contact
5. Verify 7-day funnel enrollment

### Admin Dashboard Test
1. Log in as admin
2. Navigate to `/api/admin/loops/lists`
3. Verify "Free Trial 7 Day Funnel" exists
4. Use `/api/admin/loops/test` to add test contact
5. Check Loops.so for contact creation

### Log Verification
```bash
# Check if user was enrolled
grep "User added to 7-day funnel" logs/app.log

# Check for errors
grep "Failed to add user to Loops.so" logs/app.log
```

## Security Considerations

### API Key Management
- Store key in environment secrets (never hardcode)
- Rotate key if compromised
- Use read-only keys if Loops.so supports it

### PII Protection
- Structured logger automatically redacts:
  - Email addresses
  - User IDs (UUIDs)
  - First/last names
  - Passwords and tokens
- Production logs are JSON formatted
- Development logs are human-readable

### Admin Endpoint Protection
- Both test endpoints require admin authentication
- Uses `isUserAdmin()` hardcoded email whitelist
- Returns 403 Forbidden for non-admins

## Maintenance

### Updating the Funnel Name
If the mailing list name changes in Loops.so:

1. Update `server/loops.ts`:
```typescript
const SEVEN_DAY_FUNNEL_NAME = 'New Funnel Name';
```

2. Restart the server
3. Test with admin endpoint

### Monitoring Enrollment Success
Set up alerts for:
- High error rates in Loops.so calls
- API key expiration
- Missing mailing list errors

### Performance
- Loops.so calls are async (non-blocking)
- No impact on user signup latency
- Failed enrollments don't retry (by design)

## Related Files
- `server/loops.ts` - Loops.so service implementation
- `server/routes.ts` - Integration into signup flow (lines 757-777)
- `server/logger.ts` - Structured logging with PII scrubbing
- `LOOPS_INTEGRATION.md` - This documentation file

## Support
For issues with:
- **Loops.so API**: Check https://loops.so/docs
- **Integration code**: Review `server/loops.ts`
- **Logging**: Check `server/logger.ts` configuration
- **Admin access**: Verify email in `isUserAdmin()` whitelist
