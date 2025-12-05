# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform for generating AI-powered videos, images, music, and AI chatbot conversations. It offers robust user authentication, a credit-based usage system, an administrative panel, advanced image-to-video capabilities, extensive image editing tools, and a versatile AI chatbot with streaming responses. The platform aims to become a leading solution in the AI content generation market, consolidating diverse creative AI tools. This project also includes a complete Social Media Hub integration for AI-powered social media management, supporting 9 platforms with an AI Strategist, Content Calendar, and Analytics Dashboard.

## User Preferences
I prefer simple language and detailed explanations. I want an iterative development process, where I'm asked before major changes are made. Do not make changes to the `server/storage.ts` or `client/src/App.tsx` files without explicit approval.

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, Tailwind CSS, and Shadcn UI for a modern, responsive interface with full dark mode support. Public-facing landing pages feature admin-managed dynamic content. The platform features a 3-column app interface (left sidebar + center form + right preview panel) for improved navigation and UX, with a focus on mobile responsiveness and consistent layout across all tools. All video embeds utilize PeerTube exclusively. A welcome onboarding system guides new users with a video and slideshow.

### Technical Implementations
-   **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter, TanStack Query.
-   **Backend**: Express.js and Node.js with TypeScript.
-   **Database**: PostgreSQL (Neon) with Drizzle ORM, including JSONB storage for dynamic content.
-   **Authentication**: JWT-based with Google OAuth and local email/password, incorporating Safari/iOS cookie fixes. Admin access uses a hardcoded email whitelist. **Important**: The Replit development webview runs in an iframe on a different domain, which blocks cross-origin cookies. Authentication will NOT work in the dev preview - always test auth features on the production site (artivio.ai) or open the app in a new browser tab using the full URL.
-   **Asynchronous Operations**: Webhook-based callbacks for AI model APIs with 10-minute timeout protection and production-safe URL generation.
-   **Credit Management**: Automatic refunds for failed generations and smart credit cost previews.
-   **Database-Driven Pricing**: ALL pricing is 100% database-driven with no hardcoded values. The `pricing` table contains model-specific costs that take effect immediately when changed in Admin Panel → Settings → AI Generation Settings. Frontend uses `usePricing()` hook with `getModelCost()` for real-time lookups. Backend logs warnings for any missing models. Model naming uses composite keys for variants (e.g., `4o-image-1`, `flux-kontext-pro`, `topaz-video-2x-15s`, `midjourney-v7-text2img`).
-   **Storage**: AWS S3 integration for scalable cloud storage with a feature flag (`USE_S3=true`) and local fallback. Signed URLs valid for 7 days.
-   **AI Chat**: Server-Sent Events (SSE) for real-time responses from Deepseek and OpenAI models, with markdown rendering and conversation grouping.
-   **Video Processing**: Server-side FFmpeg-based video editor/combiner, with processing handled by AWS Lambda for scalability. Videos are normalized to 30fps, 720p max resolution, 44100Hz audio.
-   **API Key Management**: Round-robin rotation for external AI service API keys.
-   **Payment**: Stripe integration for subscription management and webhooks with transaction-based idempotency.
-   **Security Headers**: Helmet-based security hardening with CSP, X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy. x-powered-by disabled to hide server info. Environment-aware CSP relaxation for Vite HMR in development.
-   **Generation Queue**: Real-time dashboard widget for tracking AI generations with cursor-based pagination.
-   **Social Media Integration**: Backend services for social media platform connections, content planning, and analytics.
-   **Audio Processing**: All voice services (cloning, TTS, ASR) exclusively use Fish Audio. Microphone recording handles `audio/webm;codecs=opus` MIME type.
-   **Google Analytics Integration**: GA4 Data API integration for admin site traffic analytics. Uses service account authentication with 5-minute report caching and 1-minute realtime caching. Displays live visitors, total users, page views, sessions, avg duration, traffic sources, top pages, geographic data, and device breakdown. Located at `server/services/googleAnalytics.ts` with admin endpoint at `/api/admin/site-analytics`.

### Feature Specifications
-   **AI Video Generation**: Supports Veo 3.1, Runway Gen-3, Seedance Pro/Lite, Wan 2.5, Kling 2.5 Turbo, Grok Imagine, Sora 2 Pro with image-to-video capabilities, model-specific aspect ratios, and advanced features.
-   **AI Image Generation**: Integrates Seedream 4.0, 4o Image API, Flux Kontext, Nano Banana for text-to-image and advanced editing. Includes Topaz Image Upscaler and AI Background Remover.
-   **AI Music Generation**: Utilizes Suno V3.5, V4, V4.5, V4.5 Plus, and V5, supporting custom lyrics and extended durations.
-   **AI Sound Effects**: ElevenLabs Sound Effect V2 with customizable parameters.
-   **AI Text-to-Speech**: Fish Audio TTS with S1 model, multi-language support.
-   **AI Image Analysis**: OpenAI GPT-4o Vision API for comprehensive analysis.
-   **Video Editor/Combiner**: Drag-and-drop FFmpeg-based tool for combining AI-generated videos.
-   **QR Code Generator**: Client-side with logo embedding and customization.
-   **AI Chat**: Deepseek and OpenAI model support with streaming responses and conversation history.
-   **Voice Cloning**: Fish Audio API for voice model creation via audio uploads or microphone.
-   **Speech-to-Text**: Fish Audio ASR API for synchronous transcription.
-   **InfiniteTalk Lip Sync**: Lip-synced videos from images and audio using Kie.ai.
-   **Admin Panel**: Comprehensive user, API key, Stripe, and home page content management.
-   **Subscription Plans**: Stripe-powered automated and manual admin assignments (Free Trial, Starter, Professional, Business).
-   **Credit Boost**: One-time credit purchase for users running low on credits. Shows "Need a Boost?" button in sidebar when credits ≤ 20% of monthly plan credits. Configurable via Admin Panel → Credit Boost tab (enable/disable, credits amount, price in cents, Stripe product/price IDs). Uses embedded Stripe checkout with `mode: 'payment'`. Webhook grants credits on successful payment. Stored in `plan_economics` table (singleton).
-   **Topaz Video Upscaler**: Standalone page for AI-powered video upscaling.
-   **Social Media Hub**: AI Strategist (powered by GPT-4o-mini), Content Calendar, and Analytics Dashboard for 9 social platforms. Features four automation levels: Manual (text-only plans), AI Suggests (prompts only), Semi-Automatic (images auto-generated via Kie.ai), and Full Automation (all media auto-generated). Media generation uses credit pre-authorization with atomic deduction/refund, job queue tracking via generations table (socialPostId, creditsHeld fields), webhook callbacks for completion, and frontend polling for real-time status updates. Located at `server/services/socialMediaGeneration.ts`.
-   **Social Media Poster Add-on**: $25/month subscription (Stripe Product: prod_TWdKgoLE1kfn4o, Price: price_1SZa3PKvkQlROMzf7X2POgZX) powered by GetLate.dev API for social posting. Supports 10 platforms (Instagram, TikTok, LinkedIn, YouTube, Facebook, X, Threads, Pinterest, Bluesky, Reddit). Uses platform invite flow for OAuth connections. All social endpoints gated behind `requireSocialPoster` middleware.
-   **Multi-Platform Posting**: Content Calendar supports scheduling posts to multiple platforms simultaneously with per-platform content type selection (post, story, reel, short, carousel, thread), platform-specific options (privacy settings, first comment, draft mode), and namespaced `platformSpecificData` storage to avoid field collisions. UI shows all target platforms in calendar cards with icon stacking.
-   **Social Brand Kit**: Comprehensive brand identity management for social media (tables prefixed with `social_` to avoid conflicts with video editor brand kits). Includes: business overview, competitors, customer demographics, visual identity (logos, colors, fonts), brand voice, and content preferences. Supports website URL tracking, automated brand asset scanning, and AI-generated content plans (1-week/30-day). Database tables: `social_brand_kits`, `social_brand_materials`, `social_brand_assets`, `social_brand_scan_jobs`, `ai_content_plans`.
-   **Social Hub Asset Library**: Dedicated marketing-approved media library for Social Media Hub, separate from the main AI generation library. Supports three provenance types: `imported` (from main library), `uploaded` (direct uploads), and `ai_generated` (future AI outputs). Features: direct file uploads to S3 with auto-type detection (image/video/audio), single and bulk import from main library with duplicate detection, metadata editing (title, description, tags), and soft deletion. AI agents use only assets from this curated library. API routes: `/api/social/hub-assets/*`. Database table: `social_hub_assets`.
-   **Content Execution Agent**: Background scheduler for automated social media posting. Runs every 5 minutes when active. Features: GetLate.dev API integration for multi-platform posting, retry logic (2 retries within run + 3 total attempts across runs), explicit per-run metrics (attempted/succeeded/failed), cumulative totals, and real-time status dashboard with start/stop controls. Posts revert to "approved" on transient failures (up to 3 attempts) before permanent rejection. Located at `server/services/contentExecutionAgent.ts`.
-   **Social Analytics Dashboard**: Comprehensive posting analytics with platform-specific breakdowns. Features: (1) Total/published/scheduled/failed post counts, (2) Success rate tracking, (3) AI vs manual post ratio, (4) Content type breakdown (posts, reels, stories, etc.), (5) Best posting times analysis, (6) Posting activity timeline, (7) Platform filter and time range selectors (7/30/90 days). Note: External engagement metrics (followers, impressions, likes) require native platform APIs not currently available through GetLate.dev. Located at `server/services/socialAnalyticsService.ts`.
-   **AI Support System**: 24/7 automated customer support with dual submission paths (in-app form + email). AI agent (GPT-4o) classifies tickets by category/priority/sentiment, generates responses, auto-replies for high-confidence simple queries, and escalates complex issues. Database tables: `support_tickets`, `support_messages`. User-facing support page at `/support` with FAQ section and ticket history. Admin dashboard in Admin Panel → Support tab for ticket management with AI insights. Email workflow: support@artivio.ai → Postmark inbound webhook → AI processing → auto-reply or escalation to escalations@artivio.ai. Located at `server/services/aiSupportAgent.ts`.

### System Design Choices
The project features a modular structure with a database schema supporting users, generations, conversations, and API keys. Video processing uses server-side FFmpeg with asynchronous job processing. Landing page content is managed via a singleton database row with JSONB. The generation queue provides real-time monitoring and smart retry functionality.

## External Dependencies

-   **Kie.ai API**: Core AI service for video, image, music generation, and InfiniteTalk Lip Sync.
-   **Deepseek API**: AI chat models (general chat feature).
-   **OpenAI API**: AI chat models, GPT-4o Vision for image analysis, and GPT-4o-mini for Social Media Hub AI Strategist.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.
-   **Replit Auth**: User authentication.
-   **ElevenLabs**: AI Sound Effect V2.
-   **Fish Audio**: All voice services (cloning, TTS, ASR).
-   **FFmpeg 6.1.1**: Server-side video processing.
-   **Stripe**: Payment processing for subscriptions.
-   **AWS S3**: Cloud storage for user uploads.
-   **AWS Lambda**: Serverless computing for video processing.
-   **Loops.so**: Email marketing platform.
-   **Rewardful**: Affiliate program.
-   **GetLate.dev**: Social media posting API (replaces Upload-Post). Uses platform invite OAuth flow.
-   **Postmark**: Transactional email service for support system (inbound email webhook + outbound auto-replies and escalation emails).