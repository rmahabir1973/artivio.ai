# Artivio AI Public API Documentation

## Overview
The Artivio AI Public API allows external AI agents like Tasklet to generate videos, images, and audio content programmatically. This documentation provides everything needed to integrate with the API.

**Base URL**: `https://your-domain.replit.app/api/v1`

---

## Authentication

All API requests require Bearer token authentication using an API key.

### Getting an API Key
1. Log in to Artivio AI
2. Go to Profile page
3. Click "Create Key" in the API Keys section
4. Copy and securely store the key (it's only shown once)

### Using the API Key
Include the API key in the `Authorization` header:

```
Authorization: Bearer art_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Example Request
```bash
curl -X POST "https://your-domain.replit.app/api/v1/video/generate" \
  -H "Authorization: Bearer art_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A sunset over the ocean", "model": "veo-3.1"}'
```

---

## Rate Limiting

- Default: 100 requests per minute per API key
- Custom limits can be set per key
- Rate limit headers are included in all responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in current window
  - `X-RateLimit-Reset`: Seconds until rate limit resets

### Rate Limit Exceeded Response (429)
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45
}
```

---

## Credit System

All generations consume credits from the user's account. Credit costs vary by model and operation.

### Checking Credit Balance
```
GET /api/v1/credits
```

**Response:**
```json
{
  "credits": 5000,
  "userId": "user_123"
}
```

### Credit Costs by Category

#### Video Generation
| Model | Credits per Generation |
|-------|----------------------|
| veo-3.1 | 100 |
| runway-gen3 | 150 |
| kling-2.5-turbo | 80 |
| seedance-pro | 120 |
| seedance-lite | 60 |
| wan-2.5 | 90 |
| sora-2-pro | 200 |
| grok-imagine | 100 |

#### Image Generation
| Model | Credits per Generation |
|-------|----------------------|
| seedream-4.0 | 50 |
| 4o-image | 40 |
| flux-kontext | 60 |
| nano-banana | 30 |

#### Audio/Music Generation
| Model | Credits per Generation |
|-------|----------------------|
| suno-v5 | 100 |
| suno-v4.5-plus | 80 |
| suno-v4.5 | 60 |
| suno-v4 | 50 |
| suno-v3.5 | 40 |

---

## Endpoints

### 1. Generate Video

```
POST /api/v1/video/generate
```

**Request Body:**
```json
{
  "prompt": "A cinematic shot of a sunset over mountains",
  "model": "veo-3.1",
  "aspectRatio": "16:9",
  "duration": 5,
  "imageUrl": "https://example.com/reference-image.jpg",
  "webhookUrl": "https://your-server.com/webhook"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Description of the video to generate |
| model | string | No | Model to use (default: "veo-3.1") |
| aspectRatio | string | No | "16:9", "9:16", "1:1", "4:3", "3:4" |
| duration | number | No | Duration in seconds (model-dependent) |
| imageUrl | string | No | Reference image URL for image-to-video |
| webhookUrl | string | No | URL to receive completion callback |

**Available Video Models:**
- `veo-3.1` - Google's latest video model
- `runway-gen3` - Runway Gen-3 Alpha
- `kling-2.5-turbo` - Kling fast generation
- `seedance-pro` - Seedance Pro quality
- `seedance-lite` - Seedance fast
- `wan-2.5` - Wan 2.5 model
- `sora-2-pro` - OpenAI Sora 2 Pro
- `grok-imagine` - Grok Imagine

**Response (202 Accepted):**
```json
{
  "success": true,
  "generationId": "gen_abc123xyz",
  "message": "Video generation started",
  "creditsUsed": 100,
  "creditsRemaining": 4900,
  "estimatedTime": "2-5 minutes",
  "statusUrl": "/api/v1/generations/gen_abc123xyz"
}
```

---

### 2. Generate Image

```
POST /api/v1/image/generate
```

**Request Body:**
```json
{
  "prompt": "A photorealistic portrait of a robot",
  "model": "seedream-4.0",
  "aspectRatio": "1:1",
  "style": "photorealistic",
  "webhookUrl": "https://your-server.com/webhook"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Description of the image to generate |
| model | string | No | Model to use (default: "seedream-4.0") |
| aspectRatio | string | No | "1:1", "16:9", "9:16", "4:3", "3:4" |
| style | string | No | Style preset (model-dependent) |
| webhookUrl | string | No | URL to receive completion callback |

**Available Image Models:**
- `seedream-4.0` - High quality image generation
- `4o-image` - GPT-4o image generation
- `flux-kontext` - Flux Kontext model
- `nano-banana` - Fast generation

**Response (202 Accepted):**
```json
{
  "success": true,
  "generationId": "gen_def456uvw",
  "message": "Image generation started",
  "creditsUsed": 50,
  "creditsRemaining": 4850,
  "estimatedTime": "30-60 seconds",
  "statusUrl": "/api/v1/generations/gen_def456uvw"
}
```

---

### 3. Generate Audio/Music

```
POST /api/v1/audio/generate
```

**Request Body:**
```json
{
  "prompt": "An upbeat electronic dance track with heavy bass",
  "model": "suno-v5",
  "duration": 60,
  "genre": "electronic",
  "lyrics": "Optional custom lyrics here",
  "webhookUrl": "https://your-server.com/webhook"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prompt | string | Yes | Description of the music to generate |
| model | string | No | Model to use (default: "suno-v5") |
| duration | number | No | Duration in seconds |
| genre | string | No | Music genre |
| lyrics | string | No | Custom lyrics (if applicable) |
| webhookUrl | string | No | URL to receive completion callback |

**Available Audio Models:**
- `suno-v5` - Latest Suno model
- `suno-v4.5-plus` - Enhanced Suno v4.5
- `suno-v4.5` - Suno v4.5
- `suno-v4` - Suno v4
- `suno-v3.5` - Suno v3.5

**Response (202 Accepted):**
```json
{
  "success": true,
  "generationId": "gen_ghi789rst",
  "message": "Audio generation started",
  "creditsUsed": 100,
  "creditsRemaining": 4750,
  "estimatedTime": "1-3 minutes",
  "statusUrl": "/api/v1/generations/gen_ghi789rst"
}
```

---

### 4. Check Generation Status

```
GET /api/v1/generations/:generationId
```

**Response (Processing):**
```json
{
  "id": "gen_abc123xyz",
  "status": "processing",
  "type": "video",
  "model": "veo-3.1",
  "prompt": "A sunset over mountains",
  "progress": 45,
  "createdAt": "2025-11-28T10:30:00Z",
  "estimatedCompletion": "2025-11-28T10:33:00Z"
}
```

**Response (Completed):**
```json
{
  "id": "gen_abc123xyz",
  "status": "completed",
  "type": "video",
  "model": "veo-3.1",
  "prompt": "A sunset over mountains",
  "resultUrl": "https://storage.example.com/video.mp4",
  "thumbnailUrl": "https://storage.example.com/thumb.jpg",
  "createdAt": "2025-11-28T10:30:00Z",
  "completedAt": "2025-11-28T10:32:45Z",
  "metadata": {
    "duration": 5,
    "aspectRatio": "16:9",
    "resolution": "1080p"
  }
}
```

**Response (Failed):**
```json
{
  "id": "gen_abc123xyz",
  "status": "failed",
  "type": "video",
  "model": "veo-3.1",
  "prompt": "A sunset over mountains",
  "error": "Content moderation filter triggered",
  "createdAt": "2025-11-28T10:30:00Z",
  "failedAt": "2025-11-28T10:31:00Z",
  "creditsRefunded": true
}
```

### Status Values
| Status | Description |
|--------|-------------|
| `pending` | Generation queued |
| `processing` | Currently generating |
| `completed` | Successfully completed |
| `failed` | Generation failed (credits may be refunded) |
| `cancelled` | User cancelled the generation |

---

## Webhook Callbacks

If you provide a `webhookUrl` in your request, Artivio will send a POST request when the generation completes or fails.

### Webhook Payload (Success)
```json
{
  "event": "generation.completed",
  "generationId": "gen_abc123xyz",
  "status": "completed",
  "type": "video",
  "resultUrl": "https://storage.example.com/video.mp4",
  "thumbnailUrl": "https://storage.example.com/thumb.jpg",
  "metadata": {
    "duration": 5,
    "aspectRatio": "16:9"
  },
  "timestamp": "2025-11-28T10:32:45Z"
}
```

### Webhook Payload (Failure)
```json
{
  "event": "generation.failed",
  "generationId": "gen_abc123xyz",
  "status": "failed",
  "type": "video",
  "error": "Content moderation filter triggered",
  "creditsRefunded": true,
  "timestamp": "2025-11-28T10:31:00Z"
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error Type",
  "message": "Human-readable description"
}
```

### Common Error Codes

| HTTP Code | Error | Description |
|-----------|-------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 402 | Payment Required | Insufficient credits |
| 403 | Forbidden | API key lacks required permission |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Insufficient Credits Response (402)
```json
{
  "error": "Insufficient Credits",
  "message": "This generation requires 100 credits but you only have 50",
  "required": 100,
  "available": 50
}
```

---

## Best Practices for Tasklet Integration

### 1. Polling Strategy
When not using webhooks, poll the status endpoint:
- Initial delay: 10 seconds
- Polling interval: 5-10 seconds
- Maximum polls: 60 (5 minutes timeout)

### 2. Error Handling
- Retry 5xx errors with exponential backoff
- Don't retry 4xx errors (except 429)
- For 429, wait for `retryAfter` seconds

### 3. Credit Management
- Check credits before generation to avoid failures
- Monitor `creditsRemaining` in responses
- Notify users when credits are low

### 4. Content Guidelines
- Avoid prompts that may trigger content filters
- Be specific with prompts for better results
- Use reference images for more accurate video generation

---

## Complete Integration Example

```javascript
// Tasklet integration example
const ARTIVIO_API_KEY = "art_live_your_key_here";
const BASE_URL = "https://your-domain.replit.app/api/v1";

async function generateVideo(prompt, options = {}) {
  // Step 1: Check credits
  const creditsResponse = await fetch(`${BASE_URL}/credits`, {
    headers: { "Authorization": `Bearer ${ARTIVIO_API_KEY}` }
  });
  const { credits } = await creditsResponse.json();
  
  if (credits < 100) {
    throw new Error("Insufficient credits for video generation");
  }
  
  // Step 2: Start generation
  const genResponse = await fetch(`${BASE_URL}/video/generate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ARTIVIO_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      model: options.model || "veo-3.1",
      aspectRatio: options.aspectRatio || "16:9",
      duration: options.duration || 5
    })
  });
  
  if (!genResponse.ok) {
    const error = await genResponse.json();
    throw new Error(error.message);
  }
  
  const { generationId } = await genResponse.json();
  
  // Step 3: Poll for completion
  let status = "processing";
  let result = null;
  
  while (status === "processing" || status === "pending") {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
    
    const statusResponse = await fetch(`${BASE_URL}/generations/${generationId}`, {
      headers: { "Authorization": `Bearer ${ARTIVIO_API_KEY}` }
    });
    
    result = await statusResponse.json();
    status = result.status;
  }
  
  if (status === "completed") {
    return result.resultUrl;
  } else {
    throw new Error(result.error || "Generation failed");
  }
}

// Usage
const videoUrl = await generateVideo("A cinematic sunset over mountains", {
  model: "veo-3.1",
  aspectRatio: "16:9",
  duration: 5
});
```

---

## API Key Permissions

API keys can have specific permissions:
- `video` - Access to video generation endpoints
- `image` - Access to image generation endpoints  
- `audio` - Access to audio/music generation endpoints

By default, new keys have all permissions enabled.

---

## Support

For API issues or questions:
- Contact support through the Artivio AI platform
- Check generation status for error details
- Review webhook payloads for failure information
