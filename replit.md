# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform for generating AI-powered videos, images, music, and AI chatbot conversations. It offers robust user authentication, a credit-based usage system, an administrative panel, advanced image-to-video capabilities, extensive image editing tools, and a versatile AI chatbot with streaming responses. The platform aims to become a leading solution in the AI content generation market, consolidating diverse creative AI tools.

**PRODUCTION STATUS**: Site is LIVE at https://artivio.ai - All webhooks and callbacks point to production URL.

## User Preferences
I prefer simple language and detailed explanations. I want an iterative development process, where I'm asked before major changes are made. Do not make changes to the `server/storage.ts` or `client/src/App.tsx` files without explicit approval.

## Recent Changes (November 18, 2025)
-   **Landing Page Pricing Section Simplified**: Replaced full pricing card grid with streamlined "Get Started For Free" CTA card:
    - Removed detailed subscription plan cards (Free, Starter, Pro) from landing page
    - Added simple CTA card with "FREE TO START" badge, free tier messaging (1,000 credits/month, no credit card)
    - Dual CTAs: "Get Started Free" (primary gradient) and "View All Plans" (outline) both linking to `/pricing`
    - Preserved section ID "pricing" for anchor navigation compatibility
    - Removed unused `plans` query to reduce API calls on landing page
-   **Landing Page Comprehensive Redesign Completed**: Successfully implemented all 8 user-requested updates with full end-to-end testing:
    1. **16:9 Video Placeholders**: All showcase sections now use `aspect-video` class for proper 16:9 aspect ratio
    2. **Benefits Bar**: Three-column section with icons displaying "No Watermarks", "Commercial Use", "Low Monthly Fees"
    3. **Showcase Videos Section**: Grid layout (3 per row, responsive) pulling from `homePageContent.showcaseVideos` with 16:9 aspect ratio
    4. **FAQ Section**: Accordion-based FAQ pulling from `homePageContent.faqs` backend data
    5. **~~Pricing Section~~** → **Simplified CTA**: Now shows "Get Started For Free" card instead of full pricing grid (directs to `/pricing`)
    6. **Platform Compatibility**: Icon grid showing Mac OS (Apple), Windows PC (Laptop), iOS, Android support
    7. **3 Easy Steps**: Numbered card layout: "Choose Your Tool", "Describe Your Vision", "Download & Share"
    8. **All Features Section**: Comprehensive grid of 9 feature cards with icons, descriptions, and credit costs
-   **Technical Implementation**: Hero section uses `useMemo` for Vimeo URL normalization to prevent React hook violations. Added proper `import React` for classic JSX transform. All sections mobile-optimized with Tailwind responsive breakpoints.
-   **Backend Integration**: FAQ and showcase videos from `/api/homepage` (homePageContent table). Detailed pricing available on dedicated `/pricing` page.
-   **Testing**: E2E tests passed - all requirements verified working with proper rendering, navigation, and data integration
-   **Quality Assurance**: Architect review confirmed production-ready implementation with no crashes or layout regressions

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, Tailwind CSS, and Shadcn UI for a modern, responsive interface with full dark mode support.

### Technical Implementations
-   **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter, TanStack Query.
-   **Backend**: Express.js and Node.js with TypeScript.
-   **Database**: PostgreSQL (Neon) with Drizzle ORM.
-   **Authentication & Onboarding**: Production-ready flow with plan selection before Replit Auth signup, credit assignment based on chosen plan, and robust error recovery.
-   **Asynchronous Operations**: Kie.ai integrations use webhook-based callbacks for real-time status updates, intelligently filtering intermediate states. Enhanced error detection catches all error formats with model-specific payload parsing:
    - **Runway**: Uses `code: 200/400/500` with `data.video_url` (snake_case) and `msg` field for errors
    - **Veo**: Uses `code: 200/400/422/500/501` with `data.info.resultUrls` array and `msg` field for errors
    - **Bytedance Playground API Models (Seedance, Wan, Kling, Seedream, Grok, Sora 2, Topaz Image/Video Upscaling)**: Use `/api/v1/jobs/createTask` endpoint with nested `input` object, `code: 200/501`, JSON-stringified `data.resultJson`, and `data.failMsg` for errors  
    - **Suno**: Multi-stage callbacks (`text`, `first`, `complete`) with official API format `data.data[].audio_url` parsing. Fixed callback handler to properly extract audio URLs from snake_case fields and finalize generations even when result URL extraction fails (prevents stuck processing state)
    - **Error Detection**: Catches HTTP error codes (4xx, 5xx), errorCode fields, and all format variations
    - **Timeout Protection**: 10-minute automatic timeout prevents stuck generations
-   **Centralized URL Management**: Production-safe URL generation via `server/urlUtils.ts` prioritizes PRODUCTION_URL (https://artivio.ai) for all webhooks and callbacks. Site is live in production.
-   **Credit Management**: Automatic credit refund system for failed generations and an atomic job cancellation system with race-condition-safe credit refunds.
-   **Image Hosting**: Temporary system for user-uploaded images, converting base64 to public URLs with validation and cleanup.
-   **API Key Management**: Round-robin rotation for up to 20 Kie.ai API keys.
-   **Streaming Chat**: AI chat uses Server-Sent Events (SSE) for real-time responses from Deepseek and OpenAI models.
-   **Mobile Routing Resilience**: Production-grade routing system prevents infinite loading on slow networks with timeouts and graceful handling.
-   **Admin Authentication**: Hardcoded email whitelist for direct admin access.
-   **Home Page Content Management**: Admin-controlled dynamic landing page with JSONB storage for showcase videos and FAQs. Supports Vimeo video embeds for the three main feature sections (video, image, music) with icon placeholders when URLs are not provided.
-   **Stripe Webhook Idempotency**: Transaction-based deduplication system prevents duplicate credit grants from Stripe webhooks.
-   **Generation Queue System**: Real-time dashboard widget tracking AI generations with status indicators, quick actions (retry, download), and smart auto-refresh.
-   **Smart Credit Warnings**: Pre-generation credit cost preview system with tiered warnings and burn rate display.
-   **Favorite Workflows & Templates**: Database foundation for user-personalized content and prompt templates.
-   **Email Marketing Integration**: Automated Loops.so email funnel for free trial user conversion with PII scrubbing and robust logging.
-   **Download Proxy System**: CORS-safe backend proxy for authenticated downloads of generated content.

### Feature Specifications
-   **AI Video Generation**: Supports Veo 3.1, Runway Aleph, Seedance, Wan 2.5, Kling 2.5 Turbo, Grok Imagine, and Sora 2 Pro models with image-to-video capabilities and specific logic for Kie.ai API constraints. Model-specific aspect ratio and duration support with frontend filtering and backend validation:
    - **Aspect Ratios**:
      - Veo (3, 3.1, 3.1 Fast) & Runway (Gen-3, Aleph): 16:9, 9:16 only
      - Seedance (1.0 Pro/Lite): 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 (most flexible)
      - Wan 2.5 & Kling 2.5 Turbo: 16:9, 9:16, 1:1
      - Grok Imagine: Image-to-video only (requires 1 reference image)
      - Sora 2 Pro: Landscape (16:9) or Portrait (9:16)
    - **Durations**:
      - Veo (3, 3.1, 3.1 Fast): 8 seconds only (fixed)
      - Runway (Gen-3, Aleph): 5s, 10s (8s NOT supported)
      - Seedance (1.0 Pro/Lite), Wan 2.5 & Kling 2.5 Turbo: 5s, 10s
      - Grok Imagine: Fixed duration (API-determined)
      - Sora 2 Pro T2V/I2V: 10s, 15s
      - Sora 2 Pro Storyboard: 10s, 15s, 25s (multi-scene)
    - **Special Features**:
      - Grok Imagine: Mode control (fun, normal, spicy), can use previously generated Grok images via task_id
      - Sora 2 Pro Storyboard: Multi-scene videos (2-3 scenes) with precise per-scene timing control and exact total duration validation
      - **Sora 2 Implementation**: Dedicated `/generate/sora` page with tabbed interface for Text-to-Video, Image-to-Video, and Pro Storyboard modes. Storyboard uses functional state updates to prevent race conditions, integer-only duration sliders, and auto-redistribution when total duration or scene count changes. Backend validates scene count (2-3), integer durations, prompt presence, and exact sum matching. Fixed aspect ratio parameter mismatch: backend now converts frontend format ("16:9"/"9:16") to Bytedance API format ("landscape"/"portrait"). Fixed image upload state closure bug using functional state updates.
-   **AI Image Generation**: Integrates Seedream 4.0 (up to 4K resolution), 4o Image API, Flux Kontext, and Nano Banana for text-to-image and advanced editing with multi-image uploads.
-   **AI Music Generation**: Utilizes Suno V3.5, V4, V4.5, V4.5 Plus, and V5, supporting custom lyrics and extended durations. Features 57 genre options including Caribbean (Chutney Soca, Raga Soca, Soca, Calypso, Parang Soca, Steelband), Rock subgenres, Electronic/EDM styles, International music (K-Pop, Afrobeat, Latin Pop, Reggaeton), and specialty genres (Sea Shanty, Video Game Music, Anime/J-Pop, Movie Soundtrack).
-   **AI Image Analysis**: Uses OpenAI GPT-4o Vision API for comprehensive image analysis.
-   **Video Editor/Combiner**: Server-side FFmpeg-based tool to combine AI-generated videos with drag-and-drop interface and background processing.
-   **QR Code Generator**: Client-side QR code generator using `qr-code-styling` library with logo embedding, customization options (size, colors, dot/corner styles), live preview, and PNG/SVG download. No credits required (user-requested free feature).
-   **AI Chat**: Dual provider support (Deepseek, OpenAI) with streaming responses, model selection, and persistent conversation history. Features multi-line textarea input (like ChatGPT/Claude), keyboard shortcuts (Enter to send, Shift+Enter for new line), and Stop button to abort streaming responses mid-generation.
-   **Voice Cloning**: Integrates ElevenLabs via Kie.ai, supporting audio uploads and recording.
-   **Admin Panel**: Comprehensive user management, API key management, Stripe integration configuration, and home page content management.
-   **Subscription Plans**: Supports manual admin assignment and Stripe-powered automated subscriptions (Free, Starter, Pro).
-   **Dynamic Landing Page**: Public-facing landing page with admin-managed content including hero sections, showcase videos, and FAQs.

### System Design Choices
The project features a modular structure. The database schema supports `users`, `generations`, `conversations`, `api_keys`, and specialized tables for various features. Video processing uses server-side FFmpeg with asynchronous job processing. Landing page content is managed via a singleton database row with JSONB. The generation queue provides real-time monitoring and smart retry functionality.

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