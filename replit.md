# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform for generating AI-powered videos, images, music, and AI chatbot conversations. It provides robust user authentication, a credit-based usage system, an administrative panel, advanced image-to-video capabilities, extensive image editing tools, and a versatile AI chatbot with streaming responses. The platform aims to become a leading solution in the AI content generation market, consolidating diverse creative AI tools.

## User Preferences
I prefer simple language and detailed explanations. I want an iterative development process, where I'm asked before major changes are made. Do not make changes to the `server/storage.ts` or `client/src/App.tsx` files without explicit approval.

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, Tailwind CSS, and Shadcn UI for a modern, responsive interface with full dark mode support. Public-facing landing pages feature admin-managed dynamic content.

**Dashboard Redesign (Complete)**:
The platform underwent a major UI transformation from marketing-style layout to a professional 3-column app interface (left sidebar + center form + right preview panel) similar to Viddo AI for improved navigation and UX.

- **Phase 1 (Complete)**: Foundation components created - AppSidebar with full navigation, ThreeColumnLayout wrapper, and PreviewPanel component with idle/generating/completed/failed states
- **Phase 2 (Complete)**: All generation pages (Video, Image, Sora) redesigned with unified 3-column layout, collapsible model comparison sections, and consistent UX
- **Phase 3 (Complete)**: All authenticated pages integrated with sidebar. Home page uses full-width dashboard layout wrapped in SidebarInset. All 10 tool pages (Music, Chat, Voice Clone, Text-to-Speech, Speech-to-Text, Analyze Image, Talking Avatars, Audio Converter, Video Editor, QR Generator) updated with SidebarInset wrapper for consistent sidebar integration. Fixed critical Footer component bug - removed nested anchor tags to eliminate React hook call and DOM nesting warnings.
- **Phase 4 (Complete)**: Mobile responsive design and end-to-end testing across all pages and devices
- **Phase 5 (Complete)**: Professional Video Editor with advanced timeline controls - database schema with thumbnailUrl field, FFmpeg thumbnail generation, TimelinePreview component with video player and scrubber control, drag-and-drop timeline UI using dnd-kit, and complete audio trimming for Suno background music with trim controls, volume slider, fade in/out controls, and FFmpeg atrim filter integration using ffprobe for accurate duration measurement
- **Phase 6 (Complete)**: Critical Mobile Layout Fixes - Resolved production iOS Safari scroll blocking issues by replacing fixed-height containers (`h-full overflow-y-auto`) with natural document scrolling (`min-h-screen overflow-x-hidden`). Applied fix across Home page, History page, and ThreeColumnLayout component (used by Image Generation). Prevents horizontal overflow and allows full vertical scrolling on mobile devices.
- **Phase 7 (Complete)**: History Page Fallback Displays - Added colorful fallback displays for non-visual generation types (sound effects, text-to-speech, voice clone, speech-to-text, analyze image, audio converter, talking avatars, QR generator, chat, video editor) with type-specific icons and gradient backgrounds instead of black preview boxes. Updated TimelinePreview component with CORS support for video metadata loading.

### Technical Implementations
-   **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter, TanStack Query.
-   **Backend**: Express.js and Node.js with TypeScript.
-   **Database**: PostgreSQL (Neon) with Drizzle ORM.
-   **Authentication & Onboarding**: JWT-based authentication system with access tokens (memory) and refresh tokens (httpOnly cookies). Google OAuth and local (email/password) authentication supported. Safari/iOS OAuth cookie fix uses HTML meta refresh (200 OK) instead of 302 redirect to bypass ITP restrictions. New users redirected to /pricing for subscription selection. Production-ready flow with credit assignment and robust error recovery.
-   **Asynchronous Operations**: Kie.ai integrations use webhook-based callbacks for real-time status updates, intelligent filtering of intermediate states, and comprehensive error detection across various model APIs (Runway, Veo, Bytedance models, Suno, ElevenLabs TTS, ElevenLabs Sound Effects). All ElevenLabs services (TTS, Sound Effects) use `/api/v1/jobs/createTask` endpoint with unified webhook callback system. Includes 10-minute timeout protection for generations.
-   **Centralized URL Management**: Production-safe URL generation via `server/urlUtils.ts` prioritizes a single production URL for all webhooks and callbacks.
-   **Credit Management**: Automatic credit refund system for failed generations and atomic job cancellation with race-condition-safe refunds.
-   **Image Hosting**: Temporary system for user-uploaded images, converting base64 to public URLs with validation and cleanup.
-   **API Key Management**: Round-robin rotation for up to 20 Kie.ai API keys.
-   **Streaming Chat**: AI chat uses Server-Sent Events (SSE) for real-time responses from Deepseek and OpenAI models.
-   **Mobile Routing Resilience**: Production-grade routing system prevents infinite loading on slow networks.
-   **Admin Authentication**: Hardcoded email whitelist for direct admin access.
-   **Home Page Content Management**: Admin-controlled dynamic landing page with JSONB storage for showcase videos and FAQs.
-   **Stripe Webhook Idempotency**: Transaction-based deduplication system prevents duplicate credit grants from Stripe webhooks.
-   **Generation Queue System**: Real-time dashboard widget tracking AI generations with status indicators and quick actions.
-   **Smart Credit Warnings**: Pre-generation credit cost preview system with tiered warnings and burn rate display.
-   **Download Proxy System**: CORS-safe backend proxy for authenticated downloads of generated content.
-   **Generations Pagination**: Cursor-based pagination system for `/api/generations` endpoint with 15 items per page (configurable 1-30). Uses keyset pagination on (user_id, created_at, id) with database index `generations_user_created_idx`. Frontend implements "Load More" button via `useInfiniteQuery` to browse all generations while avoiding Google Cloud Run 4-second timeout.

### Feature Specifications
-   **AI Video Generation**: Supports Veo 3.1 Quality, Veo 3.1 Fast, Runway Gen-3, Seedance Pro/Lite, Wan 2.5, Kling 2.5 Turbo, Grok Imagine, and Sora 2 Pro models with image-to-video capabilities. Model order: Veo 3.1 Fast (default), Veo 3.1 Quality, Runway Gen-3, Seedance 1.0 Lite, Seedance 1.0 Pro, Wan 2.5, Kling 2.5 Turbo. Model-specific aspect ratio and duration support with frontend filtering and backend validation. **Veo 3.1 Quality** supports synchronized audio with 8s duration and image-to-video (1 reference image), aspect ratios 16:9/9:16. **Veo 3.1 Fast** supports fast generation with image-to-video (up to 3 reference images), 8s duration, aspect ratios 16:9/9:16. **Runway Gen-3** features duration-based pricing (5s/60cr, 10s/150cr from Kie.ai at 12/30 Kie credits respectively), hardcoded 720p resolution with multi-layer protection. **Seedance Pro** features duration+resolution-based pricing with 6 pricing tiers (5s: 480p/70cr, 720p/150cr, 1080p/350cr | 10s: 480p/140cr, 720p/300cr, 1080p/700cr from Kie.ai), aspect ratio support (21:9, 16:9, 4:3, 1:1, 3:4, 9:16), 5s and 10s durations, camera-fixed toggle, and seed parameter. **Seedance Lite** features resolution-based pricing (480p/100 credits, 720p/225 credits, 1080p/500 credits from Kie.ai at 20/45/100 Kie credits respectively), aspect ratio support (16:9, 4:3, 1:1, 3:4, 9:16, 9:21), 10s duration only, camera-fixed toggle, and seed parameter. Both Seedance models support proper image-to-video handling where aspect ratio is omitted (determined by input image). **Wan 2.5** features duration+resolution-based pricing with 4 tiers (5s: 720p/300cr, 1080p/500cr | 10s: 720p/500cr, 1080p/1000cr from Kie.ai at 60/100/100/200 Kie credits respectively), negative prompt support, enable prompt expansion toggle (defaults to true), and seed parameter. **Kling 2.5 Turbo** features generation type and duration-based pricing with 3 tiers (T2V: 210cr at 42 Kie credits | I2V 5s: 210cr at 42 Kie credits | I2V 10s: 420cr at 84 Kie credits from Kie.ai), aspect ratio support for T2V only (16:9, 9:16, 1:1 - I2V aspect ratio determined by input image), negative prompt support (max 2496 chars), cfg_scale parameter (0-1, defaults to 0.5), and 5s/10s durations. Database schema uses numeric type for decimal Kie.ai credit costs. Includes advanced features like Sora 2 Pro Storyboard for multi-scene videos.
-   **AI Image Generation**: Integrates Seedream 4.0, 4o Image API, Flux Kontext, and Nano Banana for text-to-image and advanced editing with multi-image uploads. **4o Image API** features quantity-based pricing (1 image/6cr, 2 images/7cr, 4 images/8cr), supports aspect ratios 1:1/2:3/3:2, and image-to-image editing with mask support. **Flux Kontext** features dual-tier model options (Pro/5cr or Max/10cr), supports all 6 aspect ratios (16:9, 21:9, 4:3, 1:1, 3:4, 9:16), PNG/JPEG output formats, and prompt upsampling toggle for enhanced generation. All other models (Nano Banana, Seedream 4.0, Midjourney v7) support traditional quality/style/output format options.
-   **AI Music Generation**: Utilizes Suno V3.5, V4, V4.5, V4.5 Plus, and V5, supporting custom lyrics, extended durations, and 57 diverse genre options.
-   **AI Sound Effects**: ElevenLabs Sound Effect V2 with customizable duration (1-22s), prompt influence, loop option, and multiple output formats (MP3, Opus, PCM).
-   **AI Text-to-Speech**: ElevenLabs TTS Multilingual V2 with 20+ pre-made voices, adjustable stability/similarity/style/speed parameters, and multi-language support.
-   **AI Image Analysis**: Uses OpenAI GPT-4o Vision API for comprehensive image analysis.
-   **Video Editor/Combiner**: Server-side FFmpeg-based tool to combine AI-generated videos with a drag-and-drop interface.
-   **QR Code Generator**: Client-side QR code generator with logo embedding, customization, live preview, and PNG/SVG download (no credits required).
-   **AI Chat**: Dual provider support (Deepseek, OpenAI) with streaming responses, model selection, persistent conversation history, multi-line input, and a Stop button.
-   **Voice Cloning**: Integrates ElevenLabs via Kie.ai, supporting audio uploads and recording.
-   **Admin Panel**: Comprehensive user management, API key management, Stripe integration configuration, and home page content management.
-   **Subscription Plans**: Supports manual admin assignment and Stripe-powered automated subscriptions (Free, Starter, Pro).
-   **Dynamic Landing Page**: Public-facing landing page with admin-managed content.
-   **Topaz Image Upscaler**: Standalone page for AI-powered image upscaling with 2X (10cr), 4X (20cr), and 8X (40cr) options. Uses `/api/v1/jobs/createTask` endpoint with webhook callbacks for real-time status updates.
-   **Topaz Video Upscaler**: Standalone page for AI-powered video upscaling with 1X (72cr), 2X (72cr), and 4X (72cr) options. Flat 72 Kie.ai credits per Kie.ai pricing. Uses `/api/v1/jobs/createTask` endpoint with model "topaz/video-upscale" and webhook callbacks for real-time status updates.

### System Design Choices
The project features a modular structure with a database schema supporting users, generations, conversations, API keys, and specialized tables. Video processing uses server-side FFmpeg with asynchronous job processing. Landing page content is managed via a singleton database row with JSONB. The generation queue provides real-time monitoring and smart retry functionality.

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