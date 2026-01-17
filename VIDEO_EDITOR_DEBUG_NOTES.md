# Video Editor Playback Debug Session - 2025-01-17

## Problem Summary
Video editor plays clips for about 1 second, then freezes and goes black. This happens for multiple clips on the timeline.

## Initial Observations from User's Console Logs
1. **Worker version confirmed**: `[WorkerManager] Initializing with worker version: 2025-01-17-v2`
2. **Videos load successfully**: Both clips show duration of 8s, metadata is correct
3. **Initial frames received**: Frames up to ~0.416666 seconds (about 10 frames at 24fps)
4. **Animation loop runs correctly**: Time progresses (0s -> 1s -> 2s -> etc. up to 10s)
5. **`bufferFrames` called repeatedly**: Main thread is sending messages to worker
6. **BUT**: No worker-side logs appear during playback - worker seems to stop receiving/processing `buffer` messages

## Key Files Involved
- `/client/src/workers/video-decoder.worker.ts` - Web Worker for video decoding
- `/client/src/lib/worker-manager.ts` - Main thread manager for worker communication
- `/client/src/lib/webgl-compositor.ts` - WebGL rendering compositor
- `/client/src/pages/video-editor/components/canvas-preview-pro.tsx` - React component orchestrating playback

## Architecture Flow
1. `CanvasPreviewPro` component initializes `WorkerManager` and `WebGLCompositor`
2. Videos are loaded via `workerManager.loadVideo()` -> worker receives `load` message
3. Worker decodes video with MP4Box.js + WebCodecs VideoDecoder
4. Initial 30 frames decoded via `decodeFirstKeyframe()`
5. During playback:
   - Compositor's RAF loop calls `layerProvider` (buildLayers callback)
   - `buildLayers` calls `workerManager.bufferFrames(time, items)`
   - WorkerManager sends `buffer` message to worker
   - Worker's `bufferFrames()` calls `seekVideo()` for each clip
   - `seekVideo()` decodes more frames and sends them back
   - Main thread caches frames and `getFrame()` retrieves them for rendering

## Suspected Issues
1. **Worker not receiving buffer messages during playback** - Initial `load` messages work, but `buffer` messages seem to be ignored
2. **Possible `isDecoding` lock** - If stuck true, all seek calls would skip
3. **Decoder state issue** - If decoder goes to 'closed' state, frames would be dropped
4. **Skip logic too aggressive** - `seekVideo` skips if `lastDecodedTimestamp > targetTimestamp + 1s`

## Debug Logging Added (Version: 2025-01-17-v3-debug)

### Worker-side debug messages (sent to main thread via `type: 'debug'`)
These appear as `[WORKER:TAG]` in the console:

| Tag | Meaning |
|-----|---------|
| `MSG_RECV` | Worker received a message (type, videoId, time, items count) |
| `BUFFER` | bufferFrames called with time and item count |
| `BUFFER_SKIP` | Item skipped (not ready or out of time range) |
| `BUFFER_SEEK` | Calling seekVideo for specific item |
| `SEEK_SKIP` | seekVideo skipped (not ready, already decoding, etc.) |
| `SEEK_AHEAD` | seekVideo skipped because already decoded past target+1s |
| `SEEK_DONE` | seekVideo completed, shows frames decoded |
| `SEEK_NONE` | seekVideo decoded 0 frames |
| `INIT_START` | decodeFirstKeyframe starting |
| `INIT_BREAK` | decodeFirstKeyframe loop broke early (decoder state changed) |
| `INIT_DECODED` | decodeFirstKeyframe finished decoding |
| `INIT_DONE` | decodeFirstKeyframe flushed successfully |
| `INIT_NOFLUSH` | decodeFirstKeyframe couldn't flush (decoder state issue) |
| `INIT_ERROR` | decodeFirstKeyframe threw error |
| `FRAME_DROP` | Frame dropped in handleFrameOutput (with reason) |

### Main-thread logging
| Log Pattern | Meaning |
|-------------|---------|
| `[WorkerManager] getFrame: ...` | Shows cache status: video ID, requested time, cache key range, size, and whether frame was found |
| `[WorkerManager] bufferFrames called ...` | Confirms main thread sent buffer request |

## What to Look For in Debug Output

### Scenario 1: Worker not receiving messages
If you see `[WorkerManager] bufferFrames called` but NO `[WORKER:MSG_RECV type=buffer]` logs, the worker isn't receiving messages.

### Scenario 2: seekVideo being skipped
If you see `[WORKER:SEEK_SKIP]` or `[WORKER:SEEK_AHEAD]` repeatedly, the worker thinks it has enough frames.

### Scenario 3: Frames being dropped
If you see `[WORKER:FRAME_DROP]` messages, frames are decoded but not sent to main thread.

### Scenario 4: Cache exhausted
If you see `[WorkerManager] getFrame: ... found=false` with a small cache range, frames aren't being replenished.

## Potential Fixes (to implement after identifying root cause)

### If worker stops receiving messages:
- Check for worker crash/error
- Add error boundary in worker message handler
- Consider recreating worker on failure

### If isDecoding gets stuck:
- Add timeout to reset isDecoding after max duration
- Add isDecoding state to debug output

### If skip logic too aggressive:
- Change threshold from 1 second to 3 seconds
- Or decode continuously in background regardless of position

### If decoder state issues:
- Reset and reconfigure decoder when state becomes invalid
- Add periodic state checks

## Code Changes Made

### video-decoder.worker.ts
1. Added `debug()` method to send messages to main thread (line 71-75)
2. Added debug calls in `handleMessage()` (line 81)
3. Added debug calls in `bufferFrames()` (lines 668-696)
4. Added debug calls in `seekVideo()` (lines 528-632)
5. Added debug calls in `decodeFirstKeyframe()` (lines 472-528)
6. Added debug calls in `handleFrameOutput()` (lines 201-239)

### worker-manager.ts
1. Added handler for `debug` message type (lines 89-92)
2. Added logging in `getFrame()` showing cache status (lines 280-335)
3. Updated WORKER_VERSION to `2025-01-17-v3-debug` (line 9)

## Next Steps
1. User tests with new debug build
2. Analyze console output to identify which scenario matches
3. Implement targeted fix based on findings
4. Test fix and iterate if needed
