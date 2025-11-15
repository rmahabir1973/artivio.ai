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
-   **Authentication**: Replit Auth (OpenID Connect).
-   **Asynchronous Operations**: Kie.ai integrations use a webhook-based callback system for real-time status updates of generation tasks.
-   **Image Hosting System**: Temporary system for processing user-uploaded images, converting base64 to public URLs, with validation and automatic cleanup.
-   **Round-Robin API Key Management**: Supports up to 20 Kie.ai API keys with a round-robin rotation for load balancing and resilience.
-   **Credit System**: Transparent credit tracking for all AI generation types, displaying costs per action.
-   **Streaming Chat**: AI chat uses Server-Sent Events (SSE) for real-time, streaming responses from Deepseek and OpenAI models.
-   **Admin Authentication**: Hardcoded email whitelist in `server/routes.ts` for admin access, bypassing database state for `isAdmin` flag.
-   **Stripe Webhook Idempotency**: Production-grade transaction-based deduplication system prevents duplicate credit grants:
    -   All webhook handlers (`handleCheckoutCompleted`, `handleInvoicePaid`) wrapped in database transactions
    -   Event records inserted FIRST with `onConflictDoNothing().returning()` - empty result indicates duplicate
    -   Atomic operations: event insertion, subscription updates, and credit grants all succeed or fail together
    -   Billing period change detection: automatically resets `creditsGrantedThisPeriod` when `current_period_start` changes
    -   Guarantees exactly-once credit delivery even with concurrent webhook retries or network failures
    -   External Stripe API calls made BEFORE transaction to avoid network timeouts within atomic block

### Feature Specifications
-   **AI Video Generation**: Supports Veo 3.1 (standard and fast) and Runway Aleph, with image-to-video capabilities (up to 3 reference images).
-   **AI Image Generation**: Integrates 4o Image API, Flux Kontext, and Nano Banana for text-to-image and advanced editing with multi-image uploads (up to 10).
-   **AI Music Generation**: Utilizes Suno V3.5, V4, and V4.5, supporting custom lyrics and up to 8 minutes duration.
-   **AI Image Analysis**: Uses OpenAI GPT-4o Vision API for comprehensive image analysis (object detection, scene description, OCR, mood, style), with optional custom prompts.
-   **Video Editor/Combiner**: Server-side FFmpeg-based tool to combine 2-20 AI-generated videos, featuring drag-and-drop interface, background processing, and credit deduction.
-   **AI Chat**: Dual provider support (Deepseek and OpenAI), streaming via SSE, model selection, and persistent conversation history.
-   **Voice Cloning**: Integrates ElevenLabs via Kie.ai, supporting audio uploads and management of cloned voices.
-   **Admin Panel**: Comprehensive user management (credit editing, deletion), API key management (activation/deactivation, usage tracking), and Stripe integration configuration with inline editing of Price IDs and Product IDs.
-   **Subscription Plans**: Supports manual admin assignment and Stripe-powered automated subscriptions with Free, Starter, and Pro plans. Admin UI enables easy configuration of Stripe Price IDs without database editing.

### System Design Choices
The project uses a modular structure for client, server, and shared components. The database schema includes tables for `users`, `sessions`, `api_keys`, `generations`, `conversations`, `messages`, `voice_clones`, `video_combinations`, and `video_combination_events`. Video processing utilizes server-side FFmpeg for performance, with asynchronous job processing and real-time status updates.

## External Dependencies

-   **Kie.ai API**: Core AI service for video, image, music generation, and voice cloning.
-   **Deepseek API**: Provides AI chat models (Deepseek Chat, Deepseek Reasoner).
-   **OpenAI API**: Provides AI chat models (GPT-4o, GPT-4o Mini, o1, o1 Mini) and GPT-4o Vision for image analysis.
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.
-   **Replit Auth**: For user authentication.
-   **ElevenLabs**: Integrated via Kie.ai API for voice cloning.
-   **FFmpeg 6.1.1**: System package for server-side video processing.
-   **Stripe**: Payment processing for subscription management.