import { Express, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { storage } from './storage';
import { requireJWT } from './jwtMiddleware';
import type { PublicApiKey } from '@shared/schema';
import { generateVideo, generateImage, generateMusic } from './kieai';
import { getBaseUrl } from './urlUtils';

// Helper to get callback URL for Kie.ai
function getCallbackUrl(generationId: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/callback/kie/${generationId}`;
}

// Rate limiting in-memory store (per API key)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Generate a secure API key
export function generateApiKey(): { key: string; prefix: string; lastFour: string; hash: string } {
  const key = `art_live_${crypto.randomBytes(24).toString('hex')}`;
  const prefix = key.substring(0, 12);
  const lastFour = key.substring(key.length - 4);
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, prefix, lastFour, hash };
}

// Verify API key and get user info
export async function verifyApiKey(key: string): Promise<{ valid: boolean; apiKey?: PublicApiKey; userId?: string; error?: string }> {
  if (!key || !key.startsWith('art_live_')) {
    return { valid: false, error: 'Invalid API key format' };
  }
  
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const apiKey = await storage.getPublicApiKeyByHash(hash);
  
  if (!apiKey) {
    return { valid: false, error: 'API key not found' };
  }
  
  if (!apiKey.isActive) {
    return { valid: false, error: 'API key is deactivated' };
  }
  
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }
  
  return { valid: true, apiKey, userId: apiKey.userId };
}

// Rate limiting middleware
export function checkRateLimit(apiKey: PublicApiKey): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const limit = apiKey.rateLimit;
  
  const record = rateLimitStore.get(apiKey.id);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(apiKey.id, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetIn: Math.ceil(windowMs / 1000) };
  }
  
  if (record.count >= limit) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetIn: Math.ceil((record.resetTime - now) / 1000) 
    };
  }
  
  record.count++;
  return { 
    allowed: true, 
    remaining: limit - record.count, 
    resetIn: Math.ceil((record.resetTime - now) / 1000) 
  };
}

// Middleware for public API authentication
export function requireApiKey(requiredPermission?: 'video' | 'image' | 'audio') {
  return async (req: Request & { apiKey?: PublicApiKey; apiUserId?: string }, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid Authorization header. Use: Bearer <api_key>',
        });
      }
      
      const key = authHeader.substring(7);
      const verification = await verifyApiKey(key);
      
      if (!verification.valid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: verification.error,
        });
      }
      
      const apiKey = verification.apiKey!;
      
      // Check permission if required
      if (requiredPermission && !apiKey.permissions.includes(requiredPermission)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `This API key does not have permission for ${requiredPermission} generation`,
        });
      }
      
      // Check rate limit
      const rateLimit = checkRateLimit(apiKey);
      res.setHeader('X-RateLimit-Limit', apiKey.rateLimit);
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
      res.setHeader('X-RateLimit-Reset', rateLimit.resetIn);
      
      if (!rateLimit.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${rateLimit.resetIn} seconds.`,
          retryAfter: rateLimit.resetIn,
        });
      }
      
      // Update usage count
      await storage.updatePublicApiKeyUsage(apiKey.id);
      
      // Attach to request
      req.apiKey = apiKey;
      req.apiUserId = verification.userId;
      
      next();
    } catch (error: any) {
      console.error('[PUBLIC API] Auth error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to authenticate API key',
      });
    }
  };
}

// Register public API routes
export function registerPublicApiRoutes(app: Express) {
  
  // ========== API KEY MANAGEMENT ==========
  
  // Create API key (requires JWT auth - user creates their own key)
  app.post('/api/user/api-keys', requireJWT, async (req: any, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const { name, permissions, rateLimit, expiresAt } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      // Generate new API key
      const { key, prefix, lastFour, hash } = generateApiKey();
      
      // Create in database
      const apiKey = await storage.createPublicApiKey({
        userId: req.user.id,
        name,
        keyPrefix: prefix,
        keyHash: hash,
        lastFourChars: lastFour,
        permissions: permissions || ['video', 'image', 'audio'],
        rateLimit: rateLimit || 100,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      
      console.log(`[PUBLIC API] Key created for user ${req.user.id}: ${prefix}...${lastFour}`);
      
      // Return the full key only once - it won't be shown again
      res.status(201).json({
        id: apiKey.id,
        name: apiKey.name,
        key: key, // Full key - only shown once!
        keyPrefix: prefix,
        lastFourChars: lastFour,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        createdAt: apiKey.createdAt,
        message: 'API key created. Save it now - it won\'t be shown again!',
      });
    } catch (error: any) {
      console.error('[PUBLIC API] Create key error:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  });
  
  // List user's API keys (without actual key values)
  app.get('/api/user/api-keys', requireJWT, async (req: any, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const keys = await storage.getUserPublicApiKeys(req.user.id);
      
      // Return without full key values
      res.json(keys.map(k => ({
        id: k.id,
        name: k.name,
        keyPreview: `${k.keyPrefix}...${k.lastFourChars}`,
        permissions: k.permissions,
        rateLimit: k.rateLimit,
        usageCount: k.usageCount,
        lastUsedAt: k.lastUsedAt,
        isActive: k.isActive,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
      })));
    } catch (error: any) {
      console.error('[PUBLIC API] List keys error:', error);
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  });
  
  // Revoke (deactivate) API key
  app.post('/api/user/api-keys/:keyId/revoke', requireJWT, async (req: any, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const { keyId } = req.params;
      
      // Verify key belongs to user
      const keys = await storage.getUserPublicApiKeys(req.user.id);
      const key = keys.find(k => k.id === keyId);
      
      if (!key) {
        return res.status(404).json({ error: 'API key not found' });
      }
      
      await storage.revokePublicApiKey(keyId);
      
      console.log(`[PUBLIC API] Key revoked for user ${req.user.id}: ${key.keyPrefix}...${key.lastFourChars}`);
      
      res.json({ message: 'API key revoked successfully' });
    } catch (error: any) {
      console.error('[PUBLIC API] Revoke key error:', error);
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  });
  
  // Delete API key
  app.delete('/api/user/api-keys/:keyId', requireJWT, async (req: any, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const { keyId } = req.params;
      
      // Verify key belongs to user
      const keys = await storage.getUserPublicApiKeys(req.user.id);
      const key = keys.find(k => k.id === keyId);
      
      if (!key) {
        return res.status(404).json({ error: 'API key not found' });
      }
      
      await storage.deletePublicApiKey(keyId);
      
      console.log(`[PUBLIC API] Key deleted for user ${req.user.id}: ${key.keyPrefix}...${key.lastFourChars}`);
      
      res.json({ message: 'API key deleted successfully' });
    } catch (error: any) {
      console.error('[PUBLIC API] Delete key error:', error);
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  });

  console.log('✓ Public API key management routes registered');

  // ========== PUBLIC API V1 GENERATION ENDPOINTS ==========

  // Video Generation
  app.post('/api/v1/video/generate', requireApiKey('video'), async (req: any, res) => {
    try {
      const userId = req.apiUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { prompt, model, aspectRatio, duration, imageUrl, negativePrompt, seed, webhook } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      
      // Get pricing for the model
      const pricingModel = model || 'wan-2.5';
      const pricingEntry = await storage.getPricingByModel(pricingModel);
      const creditCost = pricingEntry?.creditCost || 100;
      
      // Check credits
      if (user.credits < creditCost) {
        return res.status(402).json({
          error: 'Insufficient credits',
          required: creditCost,
          available: user.credits,
        });
      }
      
      // Deduct credits atomically
      const updatedUser = await storage.deductCreditsAtomic(userId, creditCost);
      if (!updatedUser) {
        return res.status(402).json({ error: 'Insufficient credits' });
      }
      
      // Create generation record
      const generation = await storage.createGeneration({
        userId,
        type: 'video',
        model: pricingModel,
        prompt,
        status: 'pending',
        creditsCost: creditCost,
        seed: seed || null,
        referenceImages: imageUrl ? [imageUrl] : null,
        parameters: {
          aspectRatio: aspectRatio || '16:9',
          duration: duration || 5,
          negativePrompt: negativePrompt || null,
        },
      });
      
      // Return immediately with generation ID - actual processing happens async
      res.status(202).json({
        id: generation.id,
        status: 'pending',
        creditsCost: creditCost,
        creditsRemaining: updatedUser.credits,
        message: 'Video generation started. Use GET /api/v1/generations/:id to check status.',
        webhook: webhook ? 'Webhook will be called on completion' : undefined,
      });
      
      // Trigger actual Kie.ai generation in background (fire and forget)
      console.log(`[PUBLIC API] Video generation started: ${generation.id} by user ${userId}`);
      
      (async () => {
        try {
          await storage.updateGeneration(generation.id, { status: 'processing' });
          
          const callbackUrl = getCallbackUrl(generation.id);
          console.log(`[PUBLIC API] Calling Kie.ai for video ${generation.id} with callback: ${callbackUrl}`);
          
          const { result, keyName } = await generateVideo({
            model: pricingModel,
            prompt,
            generationType: imageUrl ? 'image-to-video' : 'text-to-video',
            referenceImages: imageUrl ? [imageUrl] : undefined,
            parameters: {
              aspectRatio: aspectRatio || '16:9',
              duration: duration || 5,
              negativePrompt: negativePrompt || null,
              callBackUrl: callbackUrl,
            },
          });
          
          // Store task ID for tracking
          const taskId = result?.data?.taskId || result?.taskId;
          if (taskId) {
            await storage.updateGeneration(generation.id, { 
              externalTaskId: taskId,
              apiKeyUsed: keyName,
            });
            console.log(`[PUBLIC API] ✓ Kie.ai video task created: ${taskId}`);
          }
        } catch (error: any) {
          console.error(`[PUBLIC API] Video generation failed for ${generation.id}:`, error.message);
          await storage.finalizeGeneration(generation.id, 'failure', {
            errorMessage: error.message || 'Video generation failed',
          });
          // Refund credits on failure
          await storage.addCreditsAtomic(userId, creditCost);
          console.log(`[PUBLIC API] Credits refunded for failed video: ${creditCost}`);
        }
      })();
      
    } catch (error: any) {
      console.error('[PUBLIC API] Video generation error:', error);
      res.status(500).json({ error: 'Failed to start video generation' });
    }
  });

  // Image Generation
  app.post('/api/v1/image/generate', requireApiKey('image'), async (req: any, res) => {
    try {
      const userId = req.apiUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { prompt, model, aspectRatio, imageUrl, negativePrompt, seed, webhook } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      
      // Get pricing for the model
      const pricingModel = model || 'flux-kontext';
      const pricingEntry = await storage.getPricingByModel(pricingModel);
      const creditCost = pricingEntry?.creditCost || 50;
      
      // Check credits
      if (user.credits < creditCost) {
        return res.status(402).json({
          error: 'Insufficient credits',
          required: creditCost,
          available: user.credits,
        });
      }
      
      // Deduct credits atomically
      const updatedUser = await storage.deductCreditsAtomic(userId, creditCost);
      if (!updatedUser) {
        return res.status(402).json({ error: 'Insufficient credits' });
      }
      
      // Create generation record
      const generation = await storage.createGeneration({
        userId,
        type: 'image',
        model: pricingModel,
        prompt,
        status: 'pending',
        creditsCost: creditCost,
        seed: seed || null,
        referenceImages: imageUrl ? [imageUrl] : null,
        parameters: {
          aspectRatio: aspectRatio || '1:1',
          negativePrompt: negativePrompt || null,
        },
      });
      
      res.status(202).json({
        id: generation.id,
        status: 'pending',
        creditsCost: creditCost,
        creditsRemaining: updatedUser.credits,
        message: 'Image generation started. Use GET /api/v1/generations/:id to check status.',
      });
      
      // Trigger actual Kie.ai generation in background (fire and forget)
      console.log(`[PUBLIC API] Image generation started: ${generation.id} by user ${userId}`);
      
      (async () => {
        try {
          await storage.updateGeneration(generation.id, { status: 'processing' });
          
          const callbackUrl = getCallbackUrl(generation.id);
          console.log(`[PUBLIC API] Calling Kie.ai for image ${generation.id} with callback: ${callbackUrl}`);
          
          const { result, keyName } = await generateImage({
            model: pricingModel,
            prompt,
            mode: imageUrl ? 'image-editing' : 'text-to-image',
            referenceImages: imageUrl ? [imageUrl] : undefined,
            parameters: {
              aspectRatio: aspectRatio || '1:1',
              negativePrompt: negativePrompt || null,
              callBackUrl: callbackUrl,
            },
          });
          
          // Store task ID for tracking
          const taskId = result?.data?.taskId || result?.taskId;
          if (taskId) {
            await storage.updateGeneration(generation.id, { 
              externalTaskId: taskId,
              apiKeyUsed: keyName,
            });
            console.log(`[PUBLIC API] ✓ Kie.ai image task created: ${taskId}`);
          }
          
          // Some models return URL directly
          const resultUrl = result?.imageUrl || result?.data?.imageUrl || result?.url;
          if (resultUrl) {
            await storage.finalizeGeneration(generation.id, 'success', {
              resultUrl,
              apiKeyUsed: keyName,
            });
            console.log(`[PUBLIC API] ✓ Image completed immediately: ${generation.id}`);
          }
        } catch (error: any) {
          console.error(`[PUBLIC API] Image generation failed for ${generation.id}:`, error.message);
          await storage.finalizeGeneration(generation.id, 'failure', {
            errorMessage: error.message || 'Image generation failed',
          });
          // Refund credits on failure
          await storage.addCreditsAtomic(userId, creditCost);
          console.log(`[PUBLIC API] Credits refunded for failed image: ${creditCost}`);
        }
      })();
      
    } catch (error: any) {
      console.error('[PUBLIC API] Image generation error:', error);
      res.status(500).json({ error: 'Failed to start image generation' });
    }
  });

  // Audio/Music Generation  
  app.post('/api/v1/audio/generate', requireApiKey('audio'), async (req: any, res) => {
    try {
      const userId = req.apiUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { prompt, model, duration, lyrics, genre, webhook } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      
      // Get pricing for the model
      const pricingModel = model || 'suno-v4';
      const pricingEntry = await storage.getPricingByModel(pricingModel);
      const creditCost = pricingEntry?.creditCost || 80;
      
      // Check credits
      if (user.credits < creditCost) {
        return res.status(402).json({
          error: 'Insufficient credits',
          required: creditCost,
          available: user.credits,
        });
      }
      
      // Deduct credits atomically
      const updatedUser = await storage.deductCreditsAtomic(userId, creditCost);
      if (!updatedUser) {
        return res.status(402).json({ error: 'Insufficient credits' });
      }
      
      // Create generation record
      const generation = await storage.createGeneration({
        userId,
        type: 'music',
        model: pricingModel,
        prompt: lyrics || prompt,
        status: 'pending',
        creditsCost: creditCost,
        parameters: {
          duration: duration || 30,
          genre: genre || null,
        },
      });
      
      res.status(202).json({
        id: generation.id,
        status: 'pending',
        creditsCost: creditCost,
        creditsRemaining: updatedUser.credits,
        message: 'Audio generation started. Use GET /api/v1/generations/:id to check status.',
      });
      
      // Trigger actual Kie.ai generation in background (fire and forget)
      console.log(`[PUBLIC API] Audio generation started: ${generation.id} by user ${userId}`);
      
      (async () => {
        try {
          await storage.updateGeneration(generation.id, { status: 'processing' });
          
          const callbackUrl = getCallbackUrl(generation.id);
          console.log(`[PUBLIC API] Calling Kie.ai for audio ${generation.id} with callback: ${callbackUrl}`);
          
          const { result, keyName } = await generateMusic({
            model: pricingModel,
            prompt: lyrics || prompt,
            parameters: {
              duration: duration || 30,
              genre: genre || null,
              customMode: !!lyrics,
              callBackUrl: callbackUrl,
            },
          });
          
          // Store task ID for tracking
          const taskId = result?.data?.taskId || result?.taskId;
          if (taskId) {
            await storage.updateGeneration(generation.id, { 
              externalTaskId: taskId,
              apiKeyUsed: keyName,
            });
            console.log(`[PUBLIC API] ✓ Kie.ai audio task created: ${taskId}`);
          }
        } catch (error: any) {
          console.error(`[PUBLIC API] Audio generation failed for ${generation.id}:`, error.message);
          await storage.finalizeGeneration(generation.id, 'failure', {
            errorMessage: error.message || 'Audio generation failed',
          });
          // Refund credits on failure
          await storage.addCreditsAtomic(userId, creditCost);
          console.log(`[PUBLIC API] Credits refunded for failed audio: ${creditCost}`);
        }
      })();
      
    } catch (error: any) {
      console.error('[PUBLIC API] Audio generation error:', error);
      res.status(500).json({ error: 'Failed to start audio generation' });
    }
  });

  // Check generation status
  app.get('/api/v1/generations/:id', requireApiKey(), async (req: any, res) => {
    try {
      const userId = req.apiUserId;
      const { id } = req.params;
      
      const generation = await storage.getGeneration(id);
      
      if (!generation) {
        return res.status(404).json({ error: 'Generation not found' });
      }
      
      // Verify ownership
      if (generation.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      res.json({
        id: generation.id,
        type: generation.type,
        model: generation.model,
        status: generation.status,
        resultUrl: generation.resultUrl,
        creditsCost: generation.creditsCost,
        createdAt: generation.createdAt,
        completedAt: generation.completedAt,
        errorMessage: generation.errorMessage,
      });
      
    } catch (error: any) {
      console.error('[PUBLIC API] Get generation error:', error);
      res.status(500).json({ error: 'Failed to get generation' });
    }
  });

  // List user's generations
  app.get('/api/v1/generations', requireApiKey(), async (req: any, res) => {
    try {
      const userId = req.apiUserId;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const type = req.query.type as string;
      
      const generations = await storage.getRecentGenerations(userId, limit);
      
      const filtered = type 
        ? generations.filter(g => g.type === type)
        : generations;
      
      res.json({
        generations: filtered.map(g => ({
          id: g.id,
          type: g.type,
          model: g.model,
          status: g.status,
          resultUrl: g.resultUrl,
          creditsCost: g.creditsCost,
          createdAt: g.createdAt,
          completedAt: g.completedAt,
        })),
        count: filtered.length,
      });
      
    } catch (error: any) {
      console.error('[PUBLIC API] List generations error:', error);
      res.status(500).json({ error: 'Failed to list generations' });
    }
  });

  // Get user credits balance
  app.get('/api/v1/credits', requireApiKey(), async (req: any, res) => {
    try {
      const userId = req.apiUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        credits: user.credits,
        email: user.email,
      });
      
    } catch (error: any) {
      console.error('[PUBLIC API] Get credits error:', error);
      res.status(500).json({ error: 'Failed to get credits' });
    }
  });

  console.log('✓ Public API V1 generation endpoints registered');
}
