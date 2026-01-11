# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform for generating AI-powered videos, images, music, and AI chatbot conversations. It offers robust user authentication, a credit-based usage system, an administrative panel, and advanced content creation tools. The platform aims to be a leading solution in the AI content generation market, integrating diverse creative AI tools with a complete Social Media Hub for AI-powered social media management across multiple platforms, including an AI Strategist, Content Calendar, and Analytics Dashboard.

## User Preferences
I prefer simple language and detailed explanations. I want an iterative development process, where I'm asked before major changes are made. Do not make changes to the `server/storage.ts` or `client/src/App.tsx` files without explicit approval.

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, Tailwind CSS, and Shadcn UI for a modern, responsive interface with dark mode support. Public landing pages feature admin-managed dynamic content. The platform uses a 3-column app interface (sidebar, center form, preview panel) focused on mobile responsiveness and consistent layout. PeerTube is used exclusively for video embeds. A welcome onboarding system guides new users.

### Technical Implementations
The platform is built with a React/TypeScript/Tailwind CSS frontend and an Express.js/Node.js/TypeScript backend. PostgreSQL (Neon) with Drizzle ORM handles data, including JSONB for dynamic content. Authentication is JWT-based with Google OAuth and local email/password. Asynchronous AI operations use webhook-based callbacks. Credit management includes automatic refunds and smart cost previews, with all pricing being 100% database-driven. AWS S3 handles scalable cloud storage with a local fallback. AI Chat uses Server-Sent Events (SSE) for real-time responses. 

**Video Editor Preview & Processing**:
- **Client-side Preview**: FFmpeg.wasm generates real-time previews for both single-track and multi-track modes (limited to first 3 clips in single-track mode, 10 visual items in multi-track mode) for fast visual feedback
- **Full-Fidelity Export**: AWS Lambda handles complete exports with full audio mixing, text rendering, and all effects
- **Unified Function**: `generateBrowserPreview()` handles both modes, automatically converting timeline formats to FFmpeg compatibility

Video processing uses FFmpeg-based architecture, normalizing videos to 30fps, 720p max, 44100Hz audio. API keys for external services use round-robin rotation. Stripe is integrated for subscription and payment processing. Security is hardened using Helmet. A real-time generation queue dashboard is provided. Social media integration includes backend services for platform connections, planning, and analytics. All voice services utilize Fish Audio. GA4 Data API is integrated for admin site traffic analytics.

### Feature Specifications
Artivio AI supports a wide array of AI generation capabilities:
-   **AI Video Generation**: Integrates various models like Veo 3.1, Runway Gen-3, Seedance Pro/Lite, Wan 2.5, Kling 2.5 Turbo, Grok Imagine, and Sora 2 Pro with image-to-video features.
-   **AI Image Generation**: Utilizes Seedream 4.0, 4o Image API, Flux Kontext, Nano Banana for text-to-image, along with Topaz Image Upscaler and AI Background Remover.
-   **AI Music Generation**: Incorporates Suno V3.5, V4, V4.5, V4.5 Plus, and V5 with custom lyrics support.
-   **AI Sound Effects**: ElevenLabs Sound Effect V2.
-   **AI Text-to-Speech**: Fish Audio TTS (S1 model) with multi-language support.
-   **AI Image Analysis**: OpenAI GPT-4o Vision API.
-   **Video Editor/Combiner**: An FFmpeg-based drag-and-drop tool for combining AI-generated videos, now featuring an OpenCut/CapCut-style unified interface. Layout includes: left icon sidebar for category navigation (media, music, audio, text, overlays, export), collapsible media panel, persistent large preview surface, and bottom timeline with @dnd-kit sorting. Offers clip splitting, trimming, speed control (0.5x-2x), quick previews, multi-track audio mixing, fade in/out effects, aspect ratio conversion (16:9/9:16/1:1), watermark overlay (image with position, size, opacity controls), timed captions (start/end seconds, text, style: default/bold/outline), and cross-layer transitions (CapCut/Camtasia-style visual overlap zones with fade/dissolve/wipe effects between clips on different layers). Component structure: `client/src/pages/video-editor/components/` contains EditorSidebar, PreviewSurface, and TimelineTrack. Cross-layer transitions are stored in `enhancements.crossLayerTransitions` and passed to VPS for FFmpeg processing.
-   **Video Joiner Express**: A simplified mobile-friendly 3-step wizard for quickly combining videos. Step 1: Select videos from library, Step 2: Arrange order with vertical drag-and-drop, Step 3: Choose aspect ratio and export. Uses the same VPS-based FFmpeg processing as the advanced editor but with a streamlined UX. Located at `/video-joiner-express` with sidebar navigation under Video section. Uses useRef for polling lifecycle management with proper cleanup.
-   **QR Code Generator**: Client-side with customization.
-   **AI Chat**: Deepseek and OpenAI model support with streaming responses.
-   **Voice Cloning & Speech-to-Text**: Fish Audio API for voice model creation and synchronous transcription.
-   **InfiniteTalk Lip Sync**: Lip-synced videos from Kie.ai.
-   **Admin Panel**: Comprehensive management for users, API keys, Stripe, and home page content.
-   **Subscription Plans & Credit Boost**: Stripe-powered automated and manual plan assignments, and one-time credit purchases.
-   **Topaz Video Upscaler**: Standalone video upscaling.
-   **Social Media Hub**: Features an AI Strategist (GPT-4o-mini), Content Calendar for scheduling across 9 platforms with automation levels, and an Analytics Dashboard. Includes a Social Media Poster Add-on (GetLate.dev API), Multi-Platform Posting, Social Brand Kit management, and a dedicated Social Hub Asset Library.
-   **Content Execution Agent**: A background scheduler for automated social media posting with retry logic.
-   **AI Support System**: 24/7 automated customer support using GPT-4o for ticket classification, response generation, and escalation.
-   **Content Pipeline Quick Actions**: Context-aware buttons for one-click transformations (e.g., "Create Video" from image, "Add to Video Editor" from video).
-   **Private Investor Deck**: A 15-slide VC pitch deck at `/investor-deck` with scroll snap navigation, Framer Motion animations, and financial projections. Privacy protected via: global X-Robots-Tag middleware (before serveStatic), robots.txt exclusion, and client-side noindex meta tag. IntersectionObserver with slideIndex data attributes ensures accurate progress tracking across viewports. Not exposed in sidebar navigation for unlisted access.

### System Design Choices
The project adopts a modular architecture with a database schema for users, generations, conversations, and API keys. Video processing is handled by server-side FFmpeg with asynchronous job processing. Landing page content is dynamically managed via a database singleton with JSONB. A generation queue provides real-time monitoring and smart retry mechanisms.

## External Dependencies

-   **Kie.ai API**: AI video, image, music generation, and InfiniteTalk Lip Sync.
-   **Deepseek API**: AI chat models.
-   **OpenAI API**: AI chat models, GPT-4o Vision, GPT-4o-mini.
-   **Neon (PostgreSQL)**: Managed database service.
-   **Replit Auth**: User authentication.
-   **ElevenLabs**: AI Sound Effect V2.
-   **Fish Audio**: All voice services (cloning, TTS, ASR).
-   **FFmpeg 6.1.1**: Server-side video processing.
-   **Stripe**: Payment processing.
-   **AWS S3**: Cloud storage.
-   **AWS Lambda**: Serverless computing for video processing.
-   **Loops.so**: Email marketing.
-   **Rewardful**: Affiliate program.
-   **GetLate.dev**: Social media posting API.
-   **Postmark**: Transactional email service.