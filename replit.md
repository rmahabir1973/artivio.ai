# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform for generating AI-powered videos, images, music, and AI chatbot conversations using Kie.ai's powerful API models. The platform features user authentication, credit-based usage, admin panel with user management, round-robin API key rotation for load balancing, image-to-video capabilities with reference image support, comprehensive image editing with multi-image uploads, and AI chatbot with streaming responses supporting Deepseek and OpenAI models.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter (routing), TanStack Query
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **AI APIs**: 
  - Kie.ai (video, image, music generation)
  - Deepseek & OpenAI (chat/conversation)

## Features Implemented

### User Features
1. **Authentication**: Secure login via Replit Auth supporting Google, GitHub, email/password
2. **AI Video Generation**: 
   - Veo 3.1 (1080p with synchronized audio)
   - Veo 3.1 Fast (faster, lower-cost rendering)
   - Runway Aleph (advanced scene reasoning)
   - **Image-to-Video**: Upload up to 3 reference images for Veo models
3. **AI Image Generation**:
   - 4o Image API (high-fidelity visuals)
   - Flux Kontext (vivid, coherent scenes)
   - Nano Banana (fast, precise generation)
   - **Two Modes**:
     - Text-to-Image: Generate images from text prompts
     - Image Editing: Upload up to 10 images with editing prompts
   - **Advanced Options**: Output format (PNG/JPEG/WebP), quality (standard/HD), aspect ratio
4. **AI Music Generation**:
   - Suno V3.5, V4, V4.5
   - Custom lyrics support
   - Up to 8 minutes duration
5. **AI Chat**:
   - **Dual Provider Support**: Deepseek and OpenAI
   - **Streaming Responses**: Real-time message streaming via Server-Sent Events
   - **Model Selection**: Choose from multiple models (Deepseek Chat/Reasoner, GPT-4o/4o-mini, o1/o1-mini)
   - **Conversation Management**: Persistent conversation history with sidebar navigation
   - **Credit Integration**: Transparent per-message costs (5-50 credits)
6. **Credit System**: Track and manage user credits with transparent cost display
7. **Generation History**: View, download, and manage all generated content
8. **Dashboard**: Statistics and recent generations overview
9. **Dark Mode**: Full light/dark theme support

### Admin Features
1. **User Management**: View all users, edit credits, delete users
2. **API Key Management**: 
   - Support for up to 20 Kie.ai API keys
   - Round-robin rotation for load balancing
   - Activate/deactivate keys
   - Usage tracking per key
3. **Analytics**: Track total generations, success rates, user activity

## Database Schema

### Tables
- **users**: User profiles with credits, admin status
- **sessions**: Secure session storage for authentication
- **api_keys**: Round-robin API key management with usage tracking
- **generations**: Complete history of all AI generations with status tracking
- **conversations**: Chat conversation metadata (userId, title, provider, model)
- **messages**: Individual chat messages (conversationId, role, content, creditsCost)

## API Endpoints

### Authentication
- `GET /api/login` - Start OAuth login flow
- `GET /api/logout` - End user session
- `GET /api/callback` - OAuth callback
- `GET /api/auth/user` - Get current user info

### Generation
- `POST /api/generate/video` - Generate AI video
- `POST /api/generate/image` - Generate AI image
- `POST /api/generate/music` - Generate AI music
- `GET /api/generations` - Get all user generations
- `GET /api/generations/recent` - Get recent generations
- `GET /api/stats` - Get user statistics

### Callback System (Kie.ai Webhooks)
- `POST /api/callback/kie/:generationId` - Receive generation completion callbacks from Kie.ai
  - Updates generation status from "processing" to "completed" or "failed"
  - Extracts result URLs from callback data (resultUrls[], videoUrl, imageUrl, audioUrl)
  - No authentication required (webhook endpoint)

### Chat
- `GET /api/chat/conversations` - List all user conversations
- `GET /api/chat/conversations/:id` - Get messages for a conversation
- `POST /api/chat/send` - Send message with streaming response (SSE)
- `DELETE /api/chat/conversations/:id` - Delete a conversation
- `PATCH /api/chat/conversations/:id/title` - Update conversation title

### Admin
- `GET /api/admin/users` - Get all users
- `PATCH /api/admin/users/:userId/credits` - Update user credits
- `DELETE /api/admin/users/:userId` - Delete user
- `GET /api/admin/api-keys` - Get all API keys
- `POST /api/admin/api-keys` - Add new API key
- `PATCH /api/admin/api-keys/:keyId` - Toggle API key status

## Environment Variables Required

### Kie.ai API Keys (minimum 1, maximum 20)
- `KIE_API_KEY_1` through `KIE_API_KEY_20`

### Chat API Keys
- `DEEPSEEK_API_KEY` - For Deepseek chat models
- `OPENAI_API_KEY` - For OpenAI chat models

### Database (automatically provided)
- `DATABASE_URL`

### Session (automatically provided)
- `SESSION_SECRET`

### Replit Auth (automatically provided)
- `REPL_ID`
- `ISSUER_URL` (defaults to https://replit.com/oidc)

## Round-Robin API Key System

The platform implements intelligent round-robin rotation:
1. All active API keys are tracked in the database
2. Each request uses the least-used active key
3. Usage count increments automatically
4. Keys can be activated/deactivated via admin panel
5. Automatic initialization from environment variables

## Callback System (Async Generation Completion)

When a generation is submitted, Kie.ai processes it asynchronously. The platform implements a callback system to receive completion notifications:

### How It Works
1. User submits generation request (video/image/music)
2. Server creates generation record with status "pending"
3. Background function calls Kie.ai API with callback URL: `https://{domain}/api/callback/kie/{generationId}`
4. Server logs: "📞 Sending callback URL to Kie.ai..."
5. Generation status updates to "processing"
6. Kie.ai processes generation in background
7. **When complete**, Kie.ai POSTs result data to our callback endpoint
8. Server extracts result URL and updates status to "completed"
9. User sees completed generation in History with download link

### Callback Endpoint Details
- **Route**: `POST /api/callback/kie/:generationId`
- **Authentication**: None (webhook from Kie.ai)
- **Payload**: Extracts URLs from resultUrls[], result_urls[], videoUrl, imageUrl, audioUrl, url
- **Response**: Updates generation status and stores result URL
- **Logging**: Full callback data logged for debugging

### Result URL Extraction
The callback handler checks multiple fields for result URLs (Kie.ai format varies by API):
- `data.resultUrls[0]` (video - primary)
- `data.result_urls[0]` (video - alternative)
- `resultUrls[0]` (root level array)
- `videoUrl`, `imageUrl`, `audioUrl` (direct fields)
- `url`, `data.url` (generic fields)

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/ (Shadcn components)
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── credit-display.tsx
│   │   │   ├── generation-card.tsx
│   │   │   └── theme-toggle.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── use-toast.ts
│   │   ├── pages/
│   │   │   ├── landing.tsx
│   │   │   ├── home.tsx
│   │   │   ├── generate-video.tsx
│   │   │   ├── generate-image.tsx
│   │   │   ├── generate-music.tsx
│   │   │   ├── chat.tsx
│   │   │   ├── history.tsx
│   │   │   └── admin.tsx
│   │   ├── lib/
│   │   │   ├── queryClient.ts
│   │   │   ├── authUtils.ts
│   │   │   └── utils.ts
│   │   ├── App.tsx
│   │   └── index.css
│   └── index.html
├── server/
│   ├── db.ts (Database connection)
│   ├── storage.ts (Data access layer)
│   ├── replitAuth.ts (Authentication middleware)
│   ├── kieai.ts (Kie.ai API integration)
│   ├── chatService.ts (Deepseek & OpenAI chat integration)
│   ├── imageHosting.ts (Image hosting & cleanup)
│   ├── routes.ts (API endpoints)
│   └── index.ts (Server entry point)
├── shared/
│   └── schema.ts (Database schema & types)
└── design_guidelines.md
```

## Getting Started

1. **Add Kie.ai API Keys**: Configure at least one KIE_API_KEY_* environment variable
2. **Run the Application**: The workflow automatically starts the development server
3. **Login**: Use the sign-in button to authenticate
4. **Start Generating**: Navigate to Video/Image/Music generation pages
5. **Admin Access**: First user can be made admin by updating `isAdmin` in database

## Model Costs (Credits)

### Video
- Veo 3.1: 500 credits
- Veo 3.1 Fast: 300 credits
- Runway Aleph: 400 credits

### Image
- 4o Image: 100 credits
- Flux Kontext: 150 credits
- Nano Banana: 50 credits

### Music
- Suno V3.5: 200 credits
- Suno V4: 250 credits
- Suno V4.5: 300 credits

### Chat (per message)
- Deepseek Chat: 5 credits
- Deepseek Reasoner: 15 credits
- GPT-4o: 50 credits
- GPT-4o Mini: 10 credits
- o1: 30 credits
- o1 Mini: 20 credits

## Image Hosting System

### Overview
The platform implements a temporary file hosting system to solve Kie.ai's requirement for public HTTPS URLs (base64 not supported):

### Architecture
1. **Upload Endpoint**: `POST /api/upload/images` receives base64 data URIs
2. **Storage**: Files saved to `/uploads` directory with unique filenames
3. **Public Access**: Express static middleware serves files at `/uploads/:filename`
4. **Security**: Comprehensive validation at multiple layers
5. **Cleanup**: Automatic file removal after use

### Security Layers

#### Client-Side (generate-image.tsx)
- Max 10MB per file validation
- MIME type checking (JPEG/PNG/WebP/GIF)
- File count limits (3 for video, 10 for image editing)
- User feedback for validation errors

#### Schema-Level (shared/schema.ts)
- Custom `base64ImageSchema` validator with:
  - Data URI format validation: `data:image/(jpeg|jpg|png|webp|gif);base64,`
  - Whitespace normalization (per RFC 2397)
  - Encoded size cap: 13.5MB (early DoS prevention)
  - Accurate decoded size calculation: `(len * 3) / 4 - paddingCount`
  - Decoded size limit: 10MB max
- Mode isolation enforcement:
  - `text-to-image` mode rejects any referenceImages
  - `image-editing` mode requires at least one referenceImage

#### Server-Side (server/imageHosting.ts)
- Double validation of size and MIME type
- Atomic operations with rollback on partial failures
- Error handling with automatic cleanup
- Logging for debugging and monitoring

#### Express Configuration
- Body size limit: 50MB (accommodates up to 10 validated images)
- Request timeout protection
- CORS headers for security

### File Cleanup Strategy

1. **On Error**: Immediate cleanup of uploaded files when generation fails
2. **Periodic**: Scheduled cleanup every 24 hours removes files older than 1 hour
3. **On Startup**: Cleanup runs immediately when server starts
4. **Manual**: Admin can trigger cleanup if needed

### Size Limits

- **Per Image**: 10MB decoded / 13.5MB encoded
- **Total Request**: 50MB Express body limit
- **Image Count**: 
  - Video (image-to-video): 3 images max
  - Image Editing: 10 images max

## Development Notes

- All users start with 1000 credits
- Credit costs are deducted immediately upon generation request
- Generation happens asynchronously in the background
- Failed generations do not refund credits (future enhancement)
- Admin panel requires `isAdmin` flag on user record
- Image uploads are validated at client, schema, and server levels
- Temporary files auto-cleanup after 1 hour via scheduled job

## Chat Implementation Details

### Streaming Architecture
The chat feature uses Server-Sent Events (SSE) for real-time streaming responses:

1. **Client Request**: POST /api/chat/send with message, provider, model
2. **Server Processing**: 
   - Validates request and deducts credits atomically
   - Creates/retrieves conversation
   - Saves user message to database
   - Initiates streaming response via OpenAI SDK
3. **Streaming Flow**:
   - Server sends chunks as `data: {"content": "..."}\n\n`
   - Client accumulates chunks in streaming message display
   - Final chunk: `data: {"done": true, "conversationId": "..."}\n\n`
4. **Client Completion**:
   - Invalidates conversation and message queries
   - 100ms delay before clearing streaming buffer (ensures query refresh completes)
   - Persisted messages display from server

### Optimistic Updates
- User message displays immediately as optimistic state
- Streaming assistant message accumulates in real-time
- Both clear after query refresh completes

### Provider Models
**Deepseek**:
- deepseek-chat (5 credits/message)
- deepseek-reasoner (15 credits/message)

**OpenAI**:
- gpt-4o (50 credits/message)
- gpt-4o-mini (10 credits/message)
- o1 (30 credits/message)
- o1-mini (20 credits/message)

## Future Enhancements (Agreed Next Phase)

1. Batch generation capabilities
2. Advanced parameter presets and templates
3. Credit purchase and billing integration (Stripe)
4. Generation favorites and collections
5. API usage analytics dashboard
6. Chat conversation export/import
7. Chat context window management for long conversations

Last Updated: 2024-11-14
