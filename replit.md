# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform for generating AI-powered videos, images, music, and AI chatbot conversations. It offers robust user authentication, a credit-based usage system, an administrative panel, advanced image-to-video capabilities, extensive image editing tools, and a versatile AI chatbot with streaming responses. The platform aims to become a leading solution in the AI content generation market, consolidating diverse creative AI tools.

## User Preferences
I prefer simple language and detailed explanations. I want an iterative development process, where I'm asked before major changes are made. Do not make changes to the `server/storage.ts` or `client/src/App.tsx` files without explicit approval.

## Recent Updates (Nov 25, 2025)
- **Modernized AI Chat UI**: Added markdown rendering with syntax highlighting, code copy buttons, message formatting, and auto-grouped conversations (Today, Yesterday, This Week, etc.)
- **Replaced Referral Program**: Removed Referral Program and Leaderboard links from sidebar and header, replaced with Affiliate (Rewardful) links. Backend code kept intact for future fixes.
- **Comprehensive Footer**: Updated footer with all features organized by category (AI Video, AI Image, Audio & Music, Tools, Company, Legal) featuring modern design, responsive layout, and hover effects.
- **Redesigned Pricing Page (Viddo AI Style)**: Complete overhaul inspired by Viddo AI with new hero title ("Your Complete AI Creative Studio in One Platform"), video popup modal (configurable in Admin), 40% price savings comparison box, all 4 paid plans with complete feature lists, 7-day free trial section, payment methods display, and 5 FAQ items. Video URL configurable via Admin Panel. Price comparison dynamically displays market vs Artivio pricing.

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, Tailwind CSS, and Shadcn UI for a modern, responsive interface with full dark mode support. Public-facing landing pages feature admin-managed dynamic content. The platform features a 3-column app interface (left sidebar + center form + right preview panel) for improved navigation and UX, with a focus on mobile responsiveness and consistent layout across all tools.

### Technical Implementations
-   **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter, TanStack Query.
-   **Backend**: Express.js and Node.js with TypeScript.
-   **Database**: PostgreSQL (Neon) with Drizzle ORM.
-   **Authentication & Onboarding**: JWT-based authentication with Google OAuth and local email/password. Includes a Safari/iOS OAuth cookie fix and new user redirection to pricing.
-   **Asynchronous Operations**: Kie.ai integrations use webhook-based callbacks for real-time status updates and error detection across various model APIs. Includes 10-minute timeout protection.
-   **Centralized URL Management**: Production-safe URL generation for all webhooks and callbacks.
-   **Credit Management**: Automatic credit refund system for failed generations and atomic job cancellation.
-   **Image Hosting**: Temporary system for user-uploaded images with validation and cleanup.
-   **API Key Management**: Round-robin rotation for up to 20 Kie.ai API keys.
-   **Streaming Chat**: AI chat uses Server-Sent Events (SSE) for real-time responses from Deepseek and OpenAI models.
-   **Mobile Routing Resilience**: Production-grade routing system to prevent infinite loading.
-   **Admin Authentication**: Hardcoded email whitelist for direct admin access.
-   **Home Page Content Management**: Admin-controlled dynamic landing page with JSONB storage.
-   **Stripe Webhook Idempotency**: Transaction-based deduplication for credit grants.
-   **Generation Queue System**: Real-time dashboard widget tracking AI generations.
-   **Smart Credit Warnings**: Pre-generation credit cost preview system.
-   **Download Proxy System**: CORS-safe backend proxy for authenticated downloads.
-   **Generations Pagination**: Cursor-based pagination with a "Load More" button to handle large datasets.

### Feature Specifications
-   **AI Video Generation**: Supports Veo 3.1, Runway Gen-3, Seedance Pro/Lite, Wan 2.5, Kling 2.5 Turbo, Grok Imagine, and Sora 2 Pro with image-to-video capabilities, model-specific aspect ratios, and duration support. Includes advanced features like Sora 2 Pro Storyboard and First & Last Frames mode.
-   **AI Image Generation**: Integrates Seedream 4.0, 4o Image API, Flux Kontext, and Nano Banana for text-to-image and advanced editing with multi-image uploads, aspect ratio support, and various output formats.
-   **AI Music Generation**: Utilizes Suno V3.5, V4, V4.5, V4.5 Plus, and V5, supporting custom lyrics, extended durations, and diverse genre options.
-   **AI Sound Effects**: ElevenLabs Sound Effect V2 with customizable duration, prompt influence, loop option, and multiple output formats.
-   **AI Text-to-Speech**: ElevenLabs TTS Multilingual V2 with numerous pre-made voices, adjustable parameters, and multi-language support.
-   **AI Image Analysis**: Uses OpenAI GPT-4o Vision API for comprehensive image analysis.
-   **Video Editor/Combiner**: Server-side FFmpeg-based tool to combine AI-generated videos with a drag-and-drop interface.
-   **QR Code Generator**: Client-side QR code generator with logo embedding, customization, and live preview.
-   **AI Chat**: Dual provider support (Deepseek, OpenAI) with streaming responses, model selection, and persistent conversation history.
-   **Voice Cloning**: Integrates ElevenLabs via Kie.ai, supporting audio uploads and recording.
-   **InfiniteTalk Lip Sync**: Creates lip-synced videos from images and audio using Kie.ai, featuring resolution-based pricing and seed parameters.
-   **Admin Panel**: Comprehensive user management, API key management, Stripe integration, and home page content management.
-   **Subscription Plans**: Supports manual admin assignment and Stripe-powered automated subscriptions.
-   **Dynamic Landing Page**: Public-facing landing page with admin-managed content.
-   **Topaz Image Upscaler**: Standalone page for AI-powered image upscaling with various magnification options.
-   **Topaz Video Upscaler**: Standalone page for AI-powered video upscaling with duration-based tiered pricing.
-   **Background Remover**: AI-powered background removal using Recraft's model, supporting various image formats.

### System Design Choices
The project features a modular structure with a database schema supporting users, generations, conversations, and API keys. Video processing uses server-side FFmpeg with asynchronous job processing. Landing page content is managed via a singleton database row with JSONB. The generation queue provides real-time monitoring and smart retry functionality.

## CRITICAL: Replit Deployment System

**IMPORTANT FOR ALL AGENTS: READ THIS BEFORE MAKING ANY DEPLOYMENT-RELATED CHANGES**

### How Replit Autoscale Deployment Works

When the user clicks "Publish" in Replit:
1. **Replit runs `npm run build`** - This creates NEW files in `dist/public/` (frontend) and `dist/index.js` (server)
2. **Replit runs `npm run start`** - This runs `NODE_ENV=production node dist/index.js`
3. **Production server serves from `dist/public/`** - NOT the root `public/` folder

### Common Deployment Issue: Published Version Not Updating

**Problem**: User republishes but the published version still shows old code.

**Root Cause**: The `public/` folder at root level may have OLD build files, but this is NOT what production uses. Production uses `dist/public/`. The real issue is usually:
- Replit's deployment using a cached snapshot
- The build not running correctly during publish
- CDN/edge caching on the published domain

**Solution - Force Fresh Deployment**:
1. Go to **Publish** button → **Manage** tab
2. Click **"Shut Down"** to completely stop the current deployment
3. Wait a few seconds
4. Click **"Publish"** again to create a fresh deployment

**DO NOT sync `public/` with `dist/public/` as a fix** - This only affects local development, NOT production deployments.

### File Structure for Deployment

```
/
├── public/                    # LOCAL DEV ONLY - Vite dev server uses this
│   └── assets/               # Stale build files (ignore for production)
├── dist/                     # PRODUCTION BUILD OUTPUT
│   ├── index.js             # Compiled server (serves from dist/public/)
│   └── public/              # Built frontend assets (THIS is what production uses)
│       ├── index.html       # Has correct hashed JS/CSS references
│       └── assets/          # Actual JS/CSS bundles with ReactMarkdown, etc.
```

### Build Verification Commands

```bash
# Check if new code is in build
grep -c "ReactMarkdown" dist/public/assets/index-*.js  # Should return 1+

# Check build hash
cat dist/public/index.html | grep "index-"  # Shows current build hash

# Verify production server path
grep "serveStatic" dist/index.js | head -3  # Shows path resolution
```

### Lip Sync Audio Recording Issue

**Problem**: Audio recordings sent as `audio/mp3` but browsers actually record in `audio/webm` format.
**Solution**: Use `MediaRecorder.isTypeSupported()` to detect correct format and use actual MIME type.

---

## External Dependencies

-   **Kie.ai API**: Core AI service for video, image, music generation, and voice cloning.
-   **Deepseek API**: AI chat models.
-   **OpenAI API**: AI chat models and GPT-4o Vision for image analysis.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.
-   **Replit Auth**: User authentication.
-   **ElevenLabs**: Voice cloning (integrated via Kie.ai).
-   **FFmpeg 6.1.1**: Server-side video processing.
-   **Stripe**: Payment processing for subscriptions.
-   **Loops.so**: Email marketing platform.