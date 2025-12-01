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
-   **Authentication**: JWT-based with Google OAuth and local email/password, incorporating Safari/iOS cookie fixes. Admin access uses a hardcoded email whitelist.
-   **Asynchronous Operations**: Webhook-based callbacks for AI model APIs with 10-minute timeout protection and production-safe URL generation.
-   **Credit Management**: Automatic refunds for failed generations and smart credit cost previews.
-   **Storage**: AWS S3 integration for scalable cloud storage with a feature flag (`USE_S3=true`) and local fallback. Signed URLs valid for 7 days.
-   **AI Chat**: Server-Sent Events (SSE) for real-time responses from Deepseek and OpenAI models, with markdown rendering and conversation grouping.
-   **Video Processing**: Server-side FFmpeg-based video editor/combiner, with processing handled by AWS Lambda for scalability. Videos are normalized to 30fps, 720p max resolution, 44100Hz audio.
-   **API Key Management**: Round-robin rotation for external AI service API keys.
-   **Payment**: Stripe integration for subscription management and webhooks with transaction-based idempotency.
-   **Generation Queue**: Real-time dashboard widget for tracking AI generations with cursor-based pagination.
-   **Social Media Integration**: Backend services for social media platform connections, content planning, and analytics.
-   **Audio Processing**: All voice services (cloning, TTS, ASR) exclusively use Fish Audio. Microphone recording handles `audio/webm;codecs=opus` MIME type.

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
-   **Topaz Video Upscaler**: Standalone page for AI-powered video upscaling.
-   **Social Media Hub**: AI Strategist, Content Calendar, and Analytics Dashboard for 9 social platforms.
-   **Social Media Poster Add-on**: $25/month subscription (Stripe Product: prod_TWdKgoLE1kfn4o, Price: price_1SZa3PKvkQlROMzf7X2POgZX) powered by GetLate.dev API for social posting. Supports 10 platforms (Instagram, TikTok, LinkedIn, YouTube, Facebook, X, Threads, Pinterest, Bluesky, Reddit). Uses platform invite flow for OAuth connections. All social endpoints gated behind `requireSocialPoster` middleware.

### System Design Choices
The project features a modular structure with a database schema supporting users, generations, conversations, and API keys. Video processing uses server-side FFmpeg with asynchronous job processing. Landing page content is managed via a singleton database row with JSONB. The generation queue provides real-time monitoring and smart retry functionality.

## External Dependencies

-   **Kie.ai API**: Core AI service for video, image, music generation, and InfiniteTalk Lip Sync.
-   **Deepseek API**: AI chat models.
-   **OpenAI API**: AI chat models and GPT-4o Vision for image analysis.
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