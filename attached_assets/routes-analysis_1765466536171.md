# Routes.ts Analysis - Issues and Recommendations

## ✅ CONFIRMED FIXES NEEDED

### 1. **CRITICAL: Video Editor Preview Limit (Line 8318)**
**Status:** ✅ Already identified and documented
```typescript
// Line ~8318 - REMOVE THIS LIMIT
const previewClips = project.clips; // Instead of .slice(0, 3)
```

## 🟡 POTENTIAL ISSUES FOUND

### 2. **Memory Leak: In-Memory Video Export Jobs (Line 8133)**
**Issue:** Uses `Map` to store job status without cleanup mechanism
```typescript
const videoExportJobs: Map<string, {...}> = new Map();
```

**Problem:**
- Jobs are never removed from memory
- Will grow indefinitely over time
- Could cause memory exhaustion on long-running servers

**Recommendation:**
```typescript
// Add TTL cleanup
const VIDEO_EXPORT_JOB_TTL = 24 * 60 * 60 * 1000; // 24 hours

setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of videoExportJobs.entries()) {
    if (now - job.createdAt.getTime() > VIDEO_EXPORT_JOB_TTL) {
      videoExportJobs.delete(jobId);
    }
  }
}, 60 * 60 * 1000); // Cleanup every hour
```

### 3. **Race Condition: Concurrent Credit Deduction (Multiple locations)**
**Locations:**
- Line 1638: Image generation
- Line 1710: Video generation
- Line 2188: Music generation
- And many more...

**Issue:** Pattern of check-then-deduct creates race condition window
```typescript
// VULNERABLE PATTERN (repeated throughout)
const user = await storage.deductCreditsAtomic(userId, cost);
if (!user) {
  return res.status(400).json({ message: "Insufficient credits" });
}
// ... start generation ...
```

**Problem:**
- Multiple simultaneous requests could bypass credit checks
- User could submit 10 generations at once, each checking before any deduct

**Current Mitigation:** Uses `deductCreditsAtomic()` which should handle this, but...

**Verification Needed:**
- Check if `deductCreditsAtomic` in storage.ts uses database transactions
- Ensure it has proper locking mechanism (e.g., PostgreSQL row-level locks)

**Recommendation:** Add request-level rate limiting for expensive operations

### 4. **Error: Missing Error Handling in Background Promises (Multiple locations)**
**Examples:**
- Line 1775: `generateVideoInBackground()` - no `.catch()`
- Line 1897: `generateImageInBackground()` - no `.catch()`
- Line 3712: `combineVideosInBackground()` - has `.catch()` ✅

**Issue:** Unhandled promise rejections can crash Node.js process

**Recommendation:** Wrap all background operations:
```typescript
// GOOD PATTERN (like line 3712)
combineVideosInBackground(...)
  .catch(error => {
    console.error('Background operation failed:', error);
  });

// BAD PATTERN (needs fixing)
generateVideoInBackground(...); // No error handling
```

**Action:** Add `.catch()` to all fire-and-forget promises

### 5. **Security: Weak Callback Signature Validation (Line 8276)**
```typescript
// SECURITY ISSUE: Signature validation but fallback allows bypass
if (callbackSecret) {
  // verify signature
} else {
  // Log warning but allow in development
  console.warn('AWS_LAMBDA_CALLBACK_SECRET not set');
}
```

**Problem:**
- Production deployments without `AWS_LAMBDA_CALLBACK_SECRET` are vulnerable
- Should fail closed, not open

**Recommendation:**
```typescript
if (!callbackSecret) {
  console.error('AWS_LAMBDA_CALLBACK_SECRET not configured - rejecting callback');
  return res.status(503).json({ message: "Service not configured" });
}
```

### 6. **Resource Leak: File Upload Without Cleanup (Line 8125)**
**Location:** `/api/video-editor/upload` endpoint

**Issue:** Uploaded files stored locally without cleanup mechanism
```typescript
const localPath = path.join(localDir, filename);
await fs.writeFile(localPath, file.buffer);
```

**Problem:**
- Files accumulate in `public/uploads/video-editor/${userId}/`
- No TTL or cleanup job
- Disk space grows indefinitely

**Recommendation:**
- Add file TTL (e.g., 7 days for editor uploads)
- Implement periodic cleanup job
- Or use S3 lifecycle policies if using S3

### 7. **Performance: No Pagination on Large Queries (Line 1467)**
```typescript
// Line 1467 - Could return massive dataset
const generations = await storage.getUserGenerations(userId);
```

**Issue:** 
- Loads ALL user generations into memory
- User with 10,000+ generations will cause memory issues
- No limit or pagination

**Current Mitigation:** 
- Line 1469 uses pagination for new requests ✅
- But some endpoints still use old pattern

**Recommendation:** Deprecate non-paginated endpoints

### 8. **Logic Error: Inconsistent Timeout Handling (Line 1559)**
```typescript
// Line 1559-1586 - Timeout detection but doesn't update DB
if (elapsedMs > timeoutMs) {
  gen.status = 'failed'; // Only updates in-memory
  gen.errorMessage = '...';
  
  // Queues DB update but doesn't await
  setImmediate(async () => {
    await storage.finalizeGeneration(gen.id, 'failure', {...});
  });
}
```

**Issue:**
- Frontend sees "failed" status immediately
- Database update happens asynchronously
- Refresh page = status reverts to "processing"
- Inconsistent state

**Recommendation:** 
- Either do synchronous DB update (slow)
- Or don't modify in-memory object (better)
- Let dedicated cleanup job handle timeouts

### 9. **Security: Unbounded File Size in Image Upload (Line 8336)**
```typescript
// Line 8336 - Image upload for transitions
const imageUpload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max ✅
  // ...
});
```

**Status:** ✅ Actually OK - has 10MB limit

**But:** Audio upload at line 8215 has 25MB limit - verify this is intentional

### 10. **Code Smell: Duplicate Pattern - DRY Violation**
**Location:** Credit deduction pattern repeated 50+ times

**Example:**
```typescript
// This pattern appears everywhere:
const cost = await getModelCost(model);
const user = await storage.deductCreditsAtomic(userId, cost);
if (!user) {
  return res.status(400).json({ message: "Insufficient credits" });
}
```

**Recommendation:** Extract to middleware:
```typescript
// middleware/creditCheck.ts
export function requireCredits(modelKey: string) {
  return async (req: any, res: any, next: any) => {
    const cost = await getModelCost(modelKey);
    const user = await storage.deductCreditsAtomic(req.user.id, cost);
    if (!user) {
      return res.status(400).json({ message: "Insufficient credits" });
    }
    req.creditCost = cost;
    next();
  };
}

// Usage:
app.post('/api/generate/video', 
  requireJWT, 
  requireCredits('veo-3.1'), 
  async (req: any, res) => {
    // Credit already deducted, cost in req.creditCost
  }
);
```

## 🟢 GOOD PATTERNS FOUND

### ✅ Proper Error Handling Examples
1. **Line 1650-1680:** Image generation with try-catch and credit refund
2. **Line 3712:** Background video combination with `.catch()`
3. **Line 4200-4250:** TTS generation with comprehensive error handling

### ✅ Security Best Practices
1. **Line 242:** JWT middleware requirement on protected routes
2. **Line 8336:** File size limits on uploads
3. **Line 8215:** File type validation on audio uploads

### ✅ Performance Optimizations
1. **Line 1469:** Cursor-based pagination for generations
2. **Line 6640:** In-memory cache with TTL for stock photos
3. **Line 120:** Safe JSON stringifier to prevent circular reference crashes

## 📋 PRIORITY ACTION ITEMS

### High Priority (Fix Now)
1. ✅ **Remove 3-clip limit** in video editor preview (line 8318)
2. ⚠️ **Add cleanup** for `videoExportJobs` Map (memory leak)
3. ⚠️ **Add `.catch()`** to all background promises (crash prevention)
4. ⚠️ **Strengthen callback security** - fail closed, not open (line 8276)

### Medium Priority (Fix Soon)
5. 🔸 **Add file cleanup** for video editor uploads (disk space leak)
6. 🔸 **Verify transaction locks** in `deductCreditsAtomic()`
7. 🔸 **Fix timeout handling** inconsistency (line 1559)
8. 🔸 **Add rate limiting** for expensive operations

### Low Priority (Refactor When Time Permits)
9. 🔹 **Extract credit checking** to middleware (DRY)
10. 🔹 **Deprecate non-paginated** generation endpoints
11. 🔹 **Add request ID** logging for better debugging

## 🎯 RECOMMENDED IMMEDIATE FIXES

### Fix 1: Memory Leak Cleanup (Add to routes.ts)
```typescript
// After line 8133, add cleanup interval
const VIDEO_EXPORT_JOB_TTL = 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  videoExportJobs.forEach((job, jobId) => {
    if (now - job.createdAt.getTime() > VIDEO_EXPORT_JOB_TTL) {
      keysToDelete.push(jobId);
    }
  });
  keysToDelete.forEach(jobId => videoExportJobs.delete(jobId));
  console.log(`[Cleanup] Removed ${keysToDelete.length} expired export jobs`);
}, 60 * 60 * 1000);
```

### Fix 2: Background Promise Error Handling
Search for all instances of:
```typescript
generateVideoInBackground(...);
generateImageInBackground(...);
generateMusicInBackground(...);
```

Add `.catch()` to each:
```typescript
generateVideoInBackground(...).catch(error => {
  console.error('[Background] Video generation failed:', error);
});
```

### Fix 3: Callback Security
```typescript
// Line 8276 - Replace the else block:
if (!callbackSecret) {
  console.error('[Video Editor] AWS_LAMBDA_CALLBACK_SECRET not configured');
  return res.status(503).json({ message: "Service not configured" });
}
```

## 📊 OVERALL ASSESSMENT

**Code Quality:** 🟢 Good (7/10)
- Well-structured with clear separation of concerns
- Comprehensive error handling in most places
- Good use of TypeScript and validation (Zod)

**Security:** 🟡 Moderate (6/10)
- JWT authentication ✅
- API key rotation ✅
- Missing: Rate limiting, callback signature enforcement
- Vulnerable: Weak callback validation, potential credit race conditions

**Performance:** 🟢 Good (7/10)
- Uses pagination ✅
- Has caching ✅
- Atomic credit operations ✅
- Issues: Memory leaks, unbounded queries in some endpoints

**Reliability:** 🟡 Moderate (6/10)
- Good error handling in most places ✅
- Missing: Error handling on some background operations
- Issue: In-memory state that could be lost on restart

## 🔍 VERIFICATION NEEDED

Please verify these in other files:
1. **storage.ts** - Does `deductCreditsAtomic()` use database transactions?
2. **storage.ts** - Does it have row-level locking to prevent race conditions?
3. **videoProcessor.ts** - Does `combineVideos()` clean up temp files?
4. **AWS Lambda** - Is callback signature verification properly implemented?

---

**Generated:** $(date)
**File Analyzed:** server/routes.ts (8641 lines)
**Issues Found:** 10 (3 high priority, 4 medium priority, 3 low priority)
