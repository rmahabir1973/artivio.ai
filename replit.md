# Artivio AI - Complete AI Content Generation Platform

## Overview
Artivio AI is a comprehensive platform for generating AI-powered videos, images, and music using Kie.ai's powerful API models. The platform features user authentication, credit-based usage, admin panel with user management, and round-robin API key rotation for load balancing.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter (routing), TanStack Query
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **AI API**: Kie.ai (video, image, music generation)

## Features Implemented

### User Features
1. **Authentication**: Secure login via Replit Auth supporting Google, GitHub, email/password
2. **AI Video Generation**: 
   - Veo 3.1 (1080p with synchronized audio)
   - Veo 3.1 Fast (faster, lower-cost rendering)
   - Runway Aleph (advanced scene reasoning)
3. **AI Image Generation**:
   - 4o Image API (high-fidelity visuals)
   - Flux Kontext (vivid, coherent scenes)
   - Nano Banana (fast, precise generation)
4. **AI Music Generation**:
   - Suno V3.5, V4, V4.5
   - Custom lyrics support
   - Up to 8 minutes duration
5. **Credit System**: Track and manage user credits with transparent cost display
6. **Generation History**: View, download, and manage all generated content
7. **Dashboard**: Statistics and recent generations overview
8. **Dark Mode**: Full light/dark theme support

### Admin Features
1. **User Management**: View all users, edit credits, delete users
2. **API Key Management**: 
   - Support for up to 20 Kie.ai API keys
   - Round-robin rotation for load balancing
   - Activate/deactivate keys
   - Usage tracking per key
3. **Analytics**: Track total generations, success rates, user activity

## Database Schema

### Tables
- **users**: User profiles with credits, admin status
- **sessions**: Secure session storage for authentication
- **api_keys**: Round-robin API key management with usage tracking
- **generations**: Complete history of all AI generations with status tracking

## API Endpoints

### Authentication
- `GET /api/login` - Start OAuth login flow
- `GET /api/logout` - End user session
- `GET /api/callback` - OAuth callback
- `GET /api/auth/user` - Get current user info

### Generation
- `POST /api/generate/video` - Generate AI video
- `POST /api/generate/image` - Generate AI image
- `POST /api/generate/music` - Generate AI music
- `GET /api/generations` - Get all user generations
- `GET /api/generations/recent` - Get recent generations
- `GET /api/stats` - Get user statistics

### Admin
- `GET /api/admin/users` - Get all users
- `PATCH /api/admin/users/:userId/credits` - Update user credits
- `DELETE /api/admin/users/:userId` - Delete user
- `GET /api/admin/api-keys` - Get all API keys
- `POST /api/admin/api-keys` - Add new API key
- `PATCH /api/admin/api-keys/:keyId` - Toggle API key status

## Environment Variables Required

### Kie.ai API Keys (minimum 1, maximum 20)
- `KIE_API_KEY_1` through `KIE_API_KEY_20`

### Database (automatically provided)
- `DATABASE_URL`

### Session (automatically provided)
- `SESSION_SECRET`

### Replit Auth (automatically provided)
- `REPL_ID`
- `ISSUER_URL` (defaults to https://replit.com/oidc)

## Round-Robin API Key System

The platform implements intelligent round-robin rotation:
1. All active API keys are tracked in the database
2. Each request uses the least-used active key
3. Usage count increments automatically
4. Keys can be activated/deactivated via admin panel
5. Automatic initialization from environment variables

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/ (Shadcn components)
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── credit-display.tsx
│   │   │   ├── generation-card.tsx
│   │   │   └── theme-toggle.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── use-toast.ts
│   │   ├── pages/
│   │   │   ├── landing.tsx
│   │   │   ├── home.tsx
│   │   │   ├── generate-video.tsx
│   │   │   ├── generate-image.tsx
│   │   │   ├── generate-music.tsx
│   │   │   ├── history.tsx
│   │   │   └── admin.tsx
│   │   ├── lib/
│   │   │   ├── queryClient.ts
│   │   │   ├── authUtils.ts
│   │   │   └── utils.ts
│   │   ├── App.tsx
│   │   └── index.css
│   └── index.html
├── server/
│   ├── db.ts (Database connection)
│   ├── storage.ts (Data access layer)
│   ├── replitAuth.ts (Authentication middleware)
│   ├── kieai.ts (Kie.ai API integration)
│   ├── routes.ts (API endpoints)
│   └── index.ts (Server entry point)
├── shared/
│   └── schema.ts (Database schema & types)
└── design_guidelines.md
```

## Getting Started

1. **Add Kie.ai API Keys**: Configure at least one KIE_API_KEY_* environment variable
2. **Run the Application**: The workflow automatically starts the development server
3. **Login**: Use the sign-in button to authenticate
4. **Start Generating**: Navigate to Video/Image/Music generation pages
5. **Admin Access**: First user can be made admin by updating `isAdmin` in database

## Model Costs (Credits)

### Video
- Veo 3.1: 500 credits
- Veo 3.1 Fast: 300 credits
- Runway Aleph: 400 credits

### Image
- 4o Image: 100 credits
- Flux Kontext: 150 credits
- Nano Banana: 50 credits

### Music
- Suno V3.5: 200 credits
- Suno V4: 250 credits
- Suno V4.5: 300 credits

## Development Notes

- All users start with 1000 credits
- Credit costs are deducted immediately upon generation request
- Generation happens asynchronously in the background
- Failed generations do not refund credits (future enhancement)
- Admin panel requires `isAdmin` flag on user record

## Future Enhancements (Agreed Next Phase)

1. Batch generation capabilities
2. Advanced parameter presets and templates
3. Credit purchase and billing integration (Stripe)
4. Generation favorites and collections
5. API usage analytics dashboard

Last Updated: 2024-11-14
