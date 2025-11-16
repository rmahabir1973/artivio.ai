# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform for generating AI-powered videos, images, music, and AI chatbot conversations. It leverages Kie.ai's API models and other AI services to offer a seamless and powerful content creation experience. Key features include robust user authentication, a credit-based usage system, an administrative panel, advanced image-to-video capabilities, extensive image editing tools, and a versatile AI chatbot with streaming responses. The platform's vision is to become a leading solution in the AI content generation market, consolidating diverse creative AI tools.

## User Preferences
I prefer simple language and detailed explanations. I want an iterative development process, where I'm asked before major changes are made. Do not make changes to the `server/storage.ts` or `client/src/App.tsx` files without explicit approval.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, Tailwind CSS, and Shadcn UI, providing a modern, responsive, and aesthetically pleasing user interface with full dark mode support.

### Technical Implementations
-   **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter (routing), TanStack Query.
-   **Backend**: Express.js and Node.js with TypeScript.
-   **Database**: PostgreSQL (Neon) with Drizzle ORM for type-safe interactions.
-   **Authentication & Onboarding**: Production-ready authentication flow with plan selection before signup:
    -   New users start with 0 credits (changed from 1000 default)
    -   Landing page → `/pricing` → Plan selection → Replit Auth
    -   Plan choice stored in signed httpOnly cookie (1 hour expiry) using `cookie-parser` middleware with SESSION_SECRET
    -   `POST /api/public/plan-selection` endpoint validates plan name and sets signed cookie with `credentials: 'include'`
    -   First login atomically assigns selected plan via `storage.assignPlanToUser()` and grants credits (Free: 1000, Starter: 5000, Pro: 15000)
    -   Cookie cleared only after successful plan assignment
    -   Idempotent design: plan assignment only runs when `!user` (first login), preventing duplicate credit grants
    -   Error recovery: cookie preserved on assignment failure, allowing retry on next login
    -   Comprehensive server-side logging tracks entire registration flow for debugging
    -   Fallback behavior: missing or expired cookie defaults to Free plan with warning
    -   Replit Auth (OpenID Connect) for authentication provider.
-   **Asynchronous Operations**: Kie.ai integrations use a webhook-based callback system for real-time status updates of generation tasks. Callback handler intelligently filters intermediate status updates (processing/pending/queued) while always processing final callbacks (success/failure/error), preventing premature failures from partial updates. Database schema includes `externalTaskId` and `statusDetail` fields in `generations` table for tracking provider-specific task IDs and detailed status information.
-   **Centralized URL Management**: Production-safe URL generation via `server/urlUtils.ts` prevents dev domain leakage:
    -   Priority chain: PRODUCTION_URL > REPLIT_DOMAINS > REPLIT_DEV_DOMAIN > localhost
    -   Automatic scheme normalization (adds https:// if missing)
    -   URL validation with graceful fallbacks
    -   Iterates through all REPLIT_DOMAINS entries for resilience
    -   Single source of truth for webhook callbacks, image/audio URLs, and Stripe redirects
    -   Ensures Kie.ai webhooks reach production domain (artivio.ai) instead of transient dev URLs
-   **Automatic Credit Refund System**: Failed generations automatically refund credits using idempotent transaction-based `finalizeGeneration()` method with guarded UPDATE pattern to prevent double-refunds from concurrent webhook retries.
-   **Atomic Job Cancellation System**: User-initiated cancellation with race-condition-safe credit refunds:
    -   Cancel button in Generations Queue with AlertDialog confirmation
    -   Both `cancelGeneration` and `finalizeGeneration` use identical `UPDATE ... WHERE status IN ('pending','processing') RETURNING` guards
    -   Database-enforced mutual exclusion ensures only ONE transaction can transition generation from pending/processing to terminal state
    -   Prevents race conditions between user cancellation and webhook callbacks
    -   Prevents double-refunds and state overwrites
    -   Idempotent design: safe to call multiple times, returns early if already finalized
    -   Toast notifications display refund amounts when credits are returned
    -   Frontend invalidates both /api/generations and /api/user cache for real-time UI updates
-   **Image Hosting System**: Temporary system for processing user-uploaded images, converting base64 to public URLs, with validation and automatic cleanup.
-   **Round-Robin API Key Management**: Supports up to 20 Kie.ai API keys with a round-robin rotation for load balancing and resilience.
-   **Credit System**: Transparent credit tracking for all AI generation types, displaying costs per action.
-   **Streaming Chat**: AI chat uses Server-Sent Events (SSE) for real-time, streaming responses from Deepseek and OpenAI models.
-   **Mobile Routing Resilience**: Production-grade routing system prevents infinite loading on slow networks:
    -   Auth query includes 10-second timeout using AbortController in `useAuth` hook
    -   Graceful timeout handling returns null (unauthenticated) on network delays
    -   Single loading state check in AppContent prevents double-guarding
    -   Public routes (/, /support, /workflows, /privacy, /terms, /contact) always accessible
    -   Resolves "Did you forget to add the page to the router?" error on mobile devices
-   **Admin Authentication**: Hardcoded email whitelist in `server/routes.ts` for admin access, bypassing database state for `isAdmin` flag.
-   **Home Page Content Management**: Admin-controlled dynamic landing page system with JSONB storage for showcase videos and FAQs, supporting hero sections, product features, and Vimeo video embeds.
-   **Stripe Webhook Idempotency**: Production-grade transaction-based deduplication system prevents duplicate credit grants:
    -   All webhook handlers (`handleCheckoutCompleted`, `handleInvoicePaid`) wrapped in database transactions
    -   Event records inserted FIRST with `onConflictDoNothing().returning()` - empty result indicates duplicate
    -   Atomic operations: event insertion, subscription updates, and credit grants all succeed or fail together
    -   Billing period change detection: automatically resets `creditsGrantedThisPeriod` when `current_period_start` changes
    -   Guarantees exactly-once credit delivery even with concurrent webhook retries or network failures
    -   External Stripe API calls made BEFORE transaction to avoid network timeouts within atomic block
-   **Generation Queue System**: Real-time dashboard widget tracking active and recent AI generations:
    -   Auto-refresh every 10 seconds when generations are in progress
    -   Status indicators for pending/processing/completed/failed states
    -   Quick actions: retry button for failed generations, download button for completed content
    -   Retry functionality includes full original parameters (model, prompt, generationType, referenceImages, parameters)
    -   Empty state handling and smart auto-refresh disabling when queue is idle
    -   Integrated into home dashboard with TypeScript interfaces for type safety
-   **Smart Credit Warnings**: Pre-generation credit cost preview system with tiered warnings:
    -   Four warning levels: Insufficient (red), Low (orange), Moderate (yellow), Normal (blue)
    -   Displays burn rate ("X more generations at this rate") with zero-cost guard for free features
    -   Shows before/after credit amounts for informed decision-making
    -   Component ready for integration across all generation pages (video, image, music, chat)
    -   Prevents Infinity in calculations with cost > 0 validation
-   **Favorite Workflows & Templates**: Database foundation for user-personalized content:
    -   `favoriteWorkflows` table linking users to saved workflow templates
    -   `generationTemplates` table storing custom prompt templates with feature-type categorization
    -   Supports parameters storage in JSONB format for flexible template configurations
    -   Designed for future UI implementation of quick-access workflow favorites
-   **Loops.so Email Marketing Integration**: Automated email funnel for free trial user conversion:
    -   Automatic enrollment of Free plan users into 7-day educational funnel during signup
    -   Fire-and-forget error handling prevents email failures from blocking user registration
    -   Production-safe logging with automatic PII scrubbing (emails, names, user IDs redacted)
    -   Admin test endpoints with Zod validation: `GET /api/admin/loops/lists` and `POST /api/admin/loops/test`
    -   Comprehensive documentation in `LOOPS_INTEGRATION.md` with security best practices
    -   Uses structured logger (`server/logger.ts`) for all operations with configurable LOG_LEVEL

### Feature Specifications
-   **AI Video Generation**: Supports Veo 3.1 (standard and fast) and Runway Aleph, with image-to-video capabilities (up to 3 reference images). **Veo Generation Type Logic** (per Kie.ai API constraints): `REFERENCE_2_VIDEO` mode only works with `veo3_fast` model + `16:9` aspect ratio. For standard Veo 3.1 (`veo3`), image-to-video uses `FIRST_AND_LAST_FRAMES_2_VIDEO` for 1-2 images. Multi-reference (3 images) restricted to veo3_fast + 16:9 only. This prevents preflight API rejections and ensures requests reach Kie.ai successfully.
-   **AI Image Generation**: Integrates 4o Image API, Flux Kontext, and Nano Banana for text-to-image and advanced editing with multi-image uploads (up to 10).
-   **AI Music Generation**: Utilizes Suno V3.5, V4, and V4.5, supporting custom lyrics and up to 8 minutes duration.
-   **AI Image Analysis**: Uses OpenAI GPT-4o Vision API for comprehensive image analysis (object detection, scene description, OCR, mood, style), with optional custom prompts.
-   **Video Editor/Combiner**: Server-side FFmpeg-based tool to combine 2-20 AI-generated videos, featuring drag-and-drop interface, background processing, credit deduction, and corrected filter graph using valid FFmpeg `null`/`anull` filters for single-video and no-overlay paths.
-   **AI Chat**: Dual provider support (Deepseek and OpenAI), streaming via SSE, model selection, and persistent conversation history.
-   **Voice Cloning**: Integrates ElevenLabs via Kie.ai, supporting audio uploads (via ref-based file input trigger) and audio recording, with comprehensive error handling and detailed logging for debugging provider failures.
-   **Admin Panel**: Comprehensive user management (credit editing, deletion), API key management (activation/deactivation, usage tracking), Stripe integration configuration with inline editing of Price IDs and Product IDs, and home page content management for controlling landing page hero sections, showcase videos, creator/business sections, and FAQs.
-   **Subscription Plans**: Supports manual admin assignment and Stripe-powered automated subscriptions with Free, Starter, and Pro plans. Admin UI enables easy configuration of Stripe Price IDs without database editing.
-   **Dynamic Landing Page**: Public-facing landing page with admin-managed content including hero section (title, subtitle, video/image), up to 3 Vimeo showcase videos, creators and business product sections, and customizable FAQ section. Content fetched from `/api/homepage` with graceful fallbacks.

### System Design Choices
The project uses a modular structure for client, server, and shared components. The database schema includes tables for `users`, `sessions`, `api_keys`, `generations`, `conversations`, `messages`, `voice_clones`, `video_combinations`, `video_combination_events`, `home_page_content`, `favoriteWorkflows`, and `generationTemplates`. Video processing utilizes server-side FFmpeg for performance, with asynchronous job processing and real-time status updates. Landing page content is managed through a singleton database row with JSONB columns for complex data structures (showcase videos, FAQs). The generation queue system provides real-time monitoring of AI generation jobs with smart retry functionality that preserves all original parameters.

## External Dependencies

-   **Kie.ai API**: Core AI service for video, image, music generation, and voice cloning.
-   **Deepseek API**: Provides AI chat models (Deepseek Chat, Deepseek Reasoner).
-   **OpenAI API**: Provides AI chat models (GPT-4o, GPT-4o Mini, o1, o1 Mini) and GPT-4o Vision for image analysis.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.
-   **Replit Auth**: For user authentication.
-   **ElevenLabs**: Integrated via Kie.ai API for voice cloning.
-   **FFmpeg 6.1.1**: System package for server-side video processing.
-   **Stripe**: Payment processing for subscription management.
-   **Loops.so**: Email marketing platform for automated 7-day funnel enrollment of free trial users.