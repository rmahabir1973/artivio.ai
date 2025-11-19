# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform for generating AI-powered videos, images, music, and AI chatbot conversations. It provides robust user authentication, a credit-based usage system, an administrative panel, advanced image-to-video capabilities, extensive image editing tools, and a versatile AI chatbot with streaming responses. The platform aims to become a leading solution in the AI content generation market, consolidating diverse creative AI tools.

## User Preferences
I prefer simple language and detailed explanations. I want an iterative development process, where I'm asked before major changes are made. Do not make changes to the `server/storage.ts` or `client/src/App.tsx` files without explicit approval.

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, Tailwind CSS, and Shadcn UI for a modern, responsive interface with full dark mode support. Public-facing landing pages feature admin-managed dynamic content.

### Technical Implementations
-   **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter, TanStack Query.
-   **Backend**: Express.js and Node.js with TypeScript.
-   **Database**: PostgreSQL (Neon) with Drizzle ORM.
-   **Authentication & Onboarding**: JWT-based authentication system with access tokens (memory) and refresh tokens (httpOnly cookies). Google OAuth and local (email/password) authentication supported. New users redirected to /pricing for subscription selection. Production-ready flow with credit assignment and robust error recovery.
-   **Asynchronous Operations**: Kie.ai integrations use webhook-based callbacks for real-time status updates, intelligent filtering of intermediate states, and comprehensive error detection across various model APIs (Runway, Veo, Bytedance models, Suno). Includes 10-minute timeout protection for generations.
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

### Feature Specifications
-   **AI Video Generation**: Supports Veo 3.1, Runway Aleph, Seedance, Wan 2.5, Kling 2.5 Turbo, Grok Imagine, and Sora 2 Pro models with image-to-video capabilities. Model-specific aspect ratio and duration support with frontend filtering and backend validation. Includes advanced features like Sora 2 Pro Storyboard for multi-scene videos.
-   **AI Image Generation**: Integrates Seedream 4.0, 4o Image API, Flux Kontext, and Nano Banana for text-to-image and advanced editing with multi-image uploads.
-   **AI Music Generation**: Utilizes Suno V3.5, V4, V4.5, V4.5 Plus, and V5, supporting custom lyrics, extended durations, and 57 diverse genre options.
-   **AI Image Analysis**: Uses OpenAI GPT-4o Vision API for comprehensive image analysis.
-   **Video Editor/Combiner**: Server-side FFmpeg-based tool to combine AI-generated videos with a drag-and-drop interface.
-   **QR Code Generator**: Client-side QR code generator with logo embedding, customization, live preview, and PNG/SVG download (no credits required).
-   **AI Chat**: Dual provider support (Deepseek, OpenAI) with streaming responses, model selection, persistent conversation history, multi-line input, and a Stop button.
-   **Voice Cloning**: Integrates ElevenLabs via Kie.ai, supporting audio uploads and recording.
-   **Admin Panel**: Comprehensive user management, API key management, Stripe integration configuration, and home page content management.
-   **Subscription Plans**: Supports manual admin assignment and Stripe-powered automated subscriptions (Free, Starter, Pro).
-   **Dynamic Landing Page**: Public-facing landing page with admin-managed content.

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