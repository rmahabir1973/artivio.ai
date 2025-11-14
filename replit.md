# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform designed for generating AI-powered videos, images, music, and AI chatbot conversations. Leveraging Kie.ai's advanced API models, the platform aims to provide a seamless and powerful content creation experience. Key capabilities include robust user authentication, a credit-based usage system, an administrative panel for user and API key management, advanced image-to-video capabilities, extensive image editing tools, and a versatile AI chatbot supporting multiple models with streaming responses. The business vision is to establish Artivio AI as a leading solution in the AI content generation market, offering a wide array of creative tools under one roof.

## User Preferences
I prefer simple language and detailed explanations. I want an iterative development process, where I'm asked before major changes are made. Do not make changes to the `server/storage.ts` or `client/src/App.tsx` files without explicit approval.

## Admin Authentication
Admin access is controlled via a hardcoded email whitelist in `server/routes.ts`. The `/api/auth/user` endpoint checks if the logged-in user's email matches the `ADMIN_EMAILS` array and overrides the `isAdmin` flag accordingly. Current admin emails: `ryan.mahabir@outlook.com` and `admin@artivio.ai`. This approach ensures admin status persists regardless of database state and cannot be overwritten by OAuth login processes. The frontend uses React Query with `staleTime: 0` to always fetch fresh authentication data without caching.

## Subscription Plans & Stripe Integration

### Overview
The platform supports both **manual plan assignments** (admin-controlled) and **Stripe-powered automated subscriptions** (user self-service). Three default plans are seeded on server startup: **Free** (1,000 credits/month), **Starter** (2,500 credits/month at $19.99), and **Pro** (5,000 credits/month at $49.99). Plans are stored in the `subscriptionPlans` table and user assignments in `userSubscriptions`.

### Manual Plan Assignment (Admin)
Admins can manually assign plans to users through the admin panel. When assigning a plan, the system atomically grants plan credits and tracks `creditsGrantedThisPeriod` to prevent double-granting. Credit adjustments calculate the difference between new and previously granted credits, ensuring upgrades grant additional credits and reassignments grant zero. Manual plan assignments set `stripeSubscriptionId` to null and `currentPeriodEnd` to null (open-ended grants). **Credit Policy**: Removing a plan does NOT claw back credits, as credits represent consumed resources and are non-refundable in manual admin operations.

### Stripe Integration (Automated Subscriptions)
Users can purchase subscriptions through the `/billing` page using Stripe Checkout. The integration includes:

**Architecture:**
- `server/stripe.ts`: Stripe client initialization, checkout session creation, customer portal access, and webhook event handlers
- `/api/billing/checkout`: Creates Stripe Checkout Session for subscription purchase
- `/api/billing/portal`: Opens Stripe Customer Portal for subscription management
- `/api/webhooks/stripe`: Handles Stripe webhook events for subscription lifecycle management

**Webhook Events Handled:**
- `checkout.session.completed`: Initial subscription activation and credit grant
- `invoice.paid`: Recurring payment success and credit renewal
- `invoice.payment_failed`: Payment failure handling (marks subscription as `past_due`)
- `customer.subscription.updated`: Subscription changes (plan upgrades/downgrades, cancellations)
- `customer.subscription.deleted`: Subscription termination

**Credit Granting Logic:**
- Credits are granted on `checkout.session.completed` (first payment) and `invoice.paid` with `billing_reason: 'subscription_cycle'` (renewals)
- Idempotency is ensured by checking billing reason to prevent duplicate credit grants
- Failed payments do not claw back credits; subscription is marked `past_due` to allow recovery

**Setup Instructions (Required for Production):**

1. **Create Stripe Products & Prices:**
   - Log into Stripe Dashboard: https://dashboard.stripe.com/products
   - Create products for each plan:
     - **Starter Plan**: Create a product with recurring price of $19.99/month
     - **Pro Plan**: Create a product with recurring price of $49.99/month
   - Note the Price IDs (format: `price_xxxxxxxxxxxxx`)

2. **Update Database with Stripe IDs:**
   - Connect to your production database
   - Update the `subscription_plans` table with the Stripe Price IDs:
     ```sql
     UPDATE subscription_plans SET stripe_price_id = 'price_xxxxxxxxxxxxx' WHERE name = 'Starter';
     UPDATE subscription_plans SET stripe_price_id = 'price_xxxxxxxxxxxxx' WHERE name = 'Pro';
     ```
   - Optionally, add Stripe Product IDs for reference:
     ```sql
     UPDATE subscription_plans SET stripe_product_id = 'prod_xxxxxxxxxxxxx' WHERE name = 'Starter';
     UPDATE subscription_plans SET stripe_product_id = 'prod_xxxxxxxxxxxxx' WHERE name = 'Pro';
     ```

3. **Configure Stripe Webhook:**
   - In Stripe Dashboard, go to: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - Enter webhook URL: `https://artivio.ai/api/webhooks/stripe` (or your production domain)
   - Select events to listen for:
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy the Signing Secret and update the `STRIPE_WEBHOOK_SECRET` environment variable

4. **Verify Secrets:**
   Ensure all Stripe secrets are configured in Replit Secrets:
   - `VITE_STRIPE_PUBLIC_KEY` (starts with `pk_`)
   - `STRIPE_SECRET_KEY` (starts with `sk_`)
   - `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)

**Testing:**
- Use Stripe Test Mode for development/testing
- Test card numbers: https://stripe.com/docs/testing
- Use `stripe listen --forward-to localhost:5000/api/webhooks/stripe` for local webhook testing

**Subscription Flow:**
1. User clicks "Subscribe" on `/billing` page
2. Backend creates Stripe Checkout Session with user metadata
3. User completes payment on Stripe-hosted checkout page
4. Stripe sends `checkout.session.completed` webhook
5. Backend grants credits and activates subscription
6. User is redirected to `/billing/success`
7. On each billing cycle, `invoice.paid` webhook renews credits automatically

**Customer Portal:**
Users with active Stripe subscriptions can access the Stripe Customer Portal to:
- Update payment methods
- View invoices and billing history
- Cancel or change subscription plans

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, Tailwind CSS, and Shadcn UI, ensuring a modern, responsive, and aesthetically pleasing user interface. A dark mode is fully supported for user preference.

### Technical Implementations
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter (routing), TanStack Query for efficient data fetching and state management.
- **Backend**: Express.js and Node.js with TypeScript provide a robust and scalable server environment.
- **Database**: PostgreSQL (Neon) is used for data persistence, managed via Drizzle ORM for type-safe database interactions.
- **Authentication**: Replit Auth (OpenID Connect) handles secure user login.
- **Asynchronous Operations**: Kie.ai integrations utilize a callback system with webhooks to manage asynchronous generation tasks, ensuring real-time status updates.
- **Image Hosting System**: A temporary file hosting system is implemented for processing user-uploaded images, converting base64 data URIs to publicly accessible HTTPS URLs required by Kie.ai. This system includes robust client-side and server-side validation, and an automatic file cleanup strategy.
- **Round-Robin API Key Management**: The system supports up to 20 Kie.ai API keys, employing a round-robin rotation strategy for load balancing and resilience. This ensures efficient utilization of API resources and minimizes single points of failure.
- **Credit System**: A transparent credit system tracks user consumption across all AI generation types, with costs displayed per action.
- **Streaming Chat**: The AI chat feature uses Server-Sent Events (SSE) for real-time, streaming responses from Deepseek and OpenAI models, enhancing user interaction.

### Feature Specifications
- **AI Video Generation**: Supports Veo 3.1 (standard and fast) and Runway Aleph models, with advanced image-to-video capabilities allowing up to 3 reference images.
- **AI Image Generation**: Integrates 4o Image API, Flux Kontext, and Nano Banana. Offers both text-to-image generation and advanced image editing with multi-image uploads (up to 10 images) and customizable output settings.
- **AI Music Generation**: Utilizes Suno V3.5, V4, and V4.5, supporting custom lyrics and up to 8 minutes of duration.
- **AI Image Analysis**: Uses OpenAI GPT-4o Vision API for comprehensive image analysis, including object detection, scene description, OCR, mood detection, and artistic style analysis. Supports optional custom prompts for targeted analysis. *Note: This is an architectural exception - uses OpenAI directly because Kie.ai does not offer image analysis/vision capabilities.*
- **Video Editor/Combiner**: Server-side FFmpeg-based video concatenation allowing users to combine 2-20 AI-generated videos into longer-form content. Features drag-and-drop interface for arranging videos, background processing with status tracking, and automatic credit deduction (75 credits per combination). Perfect for creating YouTube Shorts, TikTok videos, or longer compilations from individual AI-generated clips.
- **AI Chat**: Features dual provider support (Deepseek and OpenAI), streaming responses via SSE, model selection, and persistent conversation history.
- **Voice Cloning**: Integrates ElevenLabs via Kie.ai for voice cloning, supporting audio uploads and management of cloned voices.
- **Admin Panel**: Provides comprehensive user management (credit editing, deletion) and API key management (activation/deactivation, usage tracking).

### System Design Choices
The project adopts a modular structure, separating client, server, and shared components for maintainability and scalability. The database schema includes `users`, `sessions`, `api_keys`, `generations`, `conversations`, `messages`, `voice_clones`, `video_combinations`, and `video_combination_events` tables to support all core functionalities.

**Video Processing Architecture**: The video combiner uses server-side FFmpeg processing for reliability and performance. Videos are downloaded to a temporary directory, validated with ffprobe, concatenated using FFmpeg's concat demuxer, and stored in `public/video-combinations`. Background job processing follows the same asynchronous pattern as other generation features, with real-time status updates tracked in the database.

## External Dependencies

-   **Kie.ai API**: Core AI service for video, image, music generation, and voice cloning.
-   **Deepseek API**: Provides AI chat models (Deepseek Chat, Deepseek Reasoner).
-   **OpenAI API**: Provides AI chat models (GPT-4o, GPT-4o Mini, o1, o1 Mini) and GPT-4o Vision for image analysis. *Note: Image analysis uses OpenAI directly as Kie.ai does not support vision/analysis capabilities.*
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service.
-   **Replit Auth**: For user authentication and identity management (OpenID Connect compatible).
-   **ElevenLabs**: Integrated via Kie.ai API for voice cloning capabilities.
-   **FFmpeg 6.1.1**: System package for server-side video processing (concatenation, validation, and format conversion).