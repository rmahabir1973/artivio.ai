import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  generateVideo, 
  generateImage, 
  generateMusic, 
  cloneVoice,
  generateTTS,
  transcribeAudio,
  generateKlingAvatar,
  initializeApiKeys 
} from "./kieai";
import { saveBase64Images } from "./imageHosting";
import { saveBase64Audio, saveBase64AudioFiles } from "./audioHosting";
import { chatService, CHAT_COSTS } from "./chatService";
import { 
  generateVideoRequestSchema, 
  generateImageRequestSchema, 
  generateMusicRequestSchema,
  sendMessageRequestSchema,
  cloneVoiceRequestSchema,
  generateTTSRequestSchema,
  generateSTTRequestSchema,
  generateAvatarRequestSchema
} from "@shared/schema";

const MODEL_COSTS = {
  // Video Models (only confirmed Kie.ai endpoints)
  'veo-3': 450,
  'veo-3.1': 500,
  'veo-3.1-fast': 300,
  'runway-gen3-alpha-turbo': 350,
  'runway-aleph': 400,
  // Image Models
  '4o-image': 100,
  'flux-kontext': 150,
  'nano-banana': 50,
  // Music Models
  'suno-v3.5': 200,
  'suno-v4': 250,
  'suno-v4.5': 300,
  // TTS Models
  'eleven_multilingual_v2': 20,
  'eleven_turbo_v2.5': 15,
  // STT Models
  'scribe-v1': 25,
  // Avatar Models
  'kling-ai': 350,
  'infinite-talk': 300,
};

// Helper to get callback URL
function getCallbackUrl(generationId: string): string {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  return `${baseUrl}/api/callback/kie/${generationId}`;
}

// Background generation functions
async function generateVideoInBackground(
  generationId: string, 
  model: string, 
  prompt: string, 
  generationType: string | undefined,
  referenceImages: string[] | undefined,
  veoSubtype: string | undefined,
  parameters: any
) {
  try {
    await storage.updateGeneration(generationId, { status: 'processing' });
    
    // Convert base64 images to hosted URLs
    let hostedImageUrls: string[] | undefined;
    if (referenceImages && referenceImages.length > 0) {
      console.log(`Converting ${referenceImages.length} base64 images to hosted URLs...`);
      hostedImageUrls = await saveBase64Images(referenceImages);
      console.log(`✓ Images hosted successfully:`, hostedImageUrls);
    }
    
    const callbackUrl = getCallbackUrl(generationId);
    console.log(`📞 Sending callback URL to Kie.ai for video ${generationId}: ${callbackUrl}`);
    
    const { result, keyName } = await generateVideo({ 
      model, 
      prompt,
      generationType,
      referenceImages: hostedImageUrls,
      veoSubtype,
      parameters: { ...parameters, callBackUrl: callbackUrl } 
    });
    
    // Kie.ai returns a taskId for async processing
    const taskId = result?.data?.taskId;
    if (!taskId) {
      // If we got direct URL (older API format), use it
      const resultUrl = result?.url || result?.videoUrl || result?.data?.url;
      if (resultUrl) {
        await storage.updateGeneration(generationId, {
          status: 'completed',
          resultUrl,
          apiKeyUsed: keyName,
          completedAt: new Date(),
        });
        return;
      }
      throw new Error('API response missing taskId or video URL');
    }
    
    // Store taskId and mark as processing (will be completed via polling or webhook)
    await storage.updateGeneration(generationId, {
      status: 'processing',
      apiKeyUsed: keyName,
      resultUrl: taskId, // Temporarily store taskId in resultUrl field
    });
    
    console.log(`Video generation task started: ${taskId}`);
  } catch (error: any) {
    console.error('Background video generation failed:', error);
    await storage.updateGeneration(generationId, {
      status: 'failed',
      errorMessage: error.message,
    });
  }
}

async function generateImageInBackground(
  generationId: string, 
  model: string, 
  prompt: string, 
  mode: string,
  referenceImages: string[] | undefined,
  parameters: any
) {
  let hostedImageUrls: string[] | undefined;
  
  try {
    await storage.updateGeneration(generationId, { status: 'processing' });
    
    // Convert base64 images to hosted URLs for editing mode
    if (mode === 'image-editing' && referenceImages && referenceImages.length > 0) {
      console.log(`Converting ${referenceImages.length} base64 images to hosted URLs for editing...`);
      hostedImageUrls = await saveBase64Images(referenceImages);
      console.log(`✓ Images hosted successfully:`, hostedImageUrls);
    }
    
    const callbackUrl = getCallbackUrl(generationId);
    console.log(`📞 Sending callback URL to Kie.ai for image ${generationId}: ${callbackUrl}`);
    
    const { result, keyName } = await generateImage({ 
      model, 
      prompt,
      mode,
      referenceImages: hostedImageUrls,
      parameters: { ...parameters, callBackUrl: callbackUrl } 
    });
    
    // Kie.ai may return taskId or direct URL depending on API
    const taskId = result?.data?.taskId;
    const directUrl = result?.url || result?.imageUrl || result?.data?.url || result?.data?.imageUrl;
    
    if (directUrl) {
      await storage.updateGeneration(generationId, {
        status: 'completed',
        resultUrl: directUrl,
        apiKeyUsed: keyName,
        completedAt: new Date(),
      });
      return;
    }
    
    if (taskId) {
      await storage.updateGeneration(generationId, {
        status: 'processing',
        apiKeyUsed: keyName,
        resultUrl: taskId,
      });
      console.log(`Image generation task started: ${taskId}`);
      return;
    }
    
    throw new Error('API response missing taskId or image URL');
  } catch (error: any) {
    console.error('Background image generation failed:', error);
    
    // Clean up uploaded files on failure
    if (hostedImageUrls && hostedImageUrls.length > 0) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      
      for (const url of hostedImageUrls) {
        const filename = url.split('/').pop();
        if (filename) {
          const filePath = path.join(uploadsDir, filename);
          try {
            await fs.unlink(filePath);
            console.log(`Cleaned up failed upload: ${filePath}`);
          } catch (cleanupError) {
            console.error(`Failed to clean up ${filePath}:`, cleanupError);
          }
        }
      }
    }
    
    await storage.updateGeneration(generationId, {
      status: 'failed',
      errorMessage: error.message,
    });
  }
}

async function generateMusicInBackground(generationId: string, model: string, prompt: string, parameters: any) {
  try {
    await storage.updateGeneration(generationId, { status: 'processing' });
    
    const callbackUrl = getCallbackUrl(generationId);
    console.log(`📞 Sending callback URL to Kie.ai for music ${generationId}: ${callbackUrl}`);
    
    const { result, keyName } = await generateMusic({ 
      model, 
      prompt, 
      parameters: { ...parameters, callBackUrl: callbackUrl } 
    });
    
    // Kie.ai music API returns taskId
    const taskId = result?.data?.taskId;
    const directUrl = result?.url || result?.audioUrl || result?.data?.url || result?.data?.audioUrl;
    
    if (directUrl) {
      await storage.updateGeneration(generationId, {
        status: 'completed',
        resultUrl: directUrl,
        apiKeyUsed: keyName,
        completedAt: new Date(),
      });
      return;
    }
    
    if (taskId) {
      await storage.updateGeneration(generationId, {
        status: 'processing',
        apiKeyUsed: keyName,
        resultUrl: taskId,
      });
      console.log(`Music generation task started: ${taskId}`);
      return;
    }
    
    throw new Error('API response missing taskId or audio URL');
  } catch (error: any) {
    console.error('Background music generation failed:', error);
    await storage.updateGeneration(generationId, {
      status: 'failed',
      errorMessage: error.message,
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize auth - fail-fast if this doesn't work
  // Auth is critical; without it, all protected routes will fail
  try {
    await setupAuth(app);
    console.log('✓ Authentication initialized successfully');
  } catch (error) {
    console.error('FATAL: Failed to setup authentication:', error);
    throw new Error('Cannot start server without authentication. Please check your environment configuration.');
  }
  
  // Initialize API keys in database
  // This can fail gracefully - admin can configure keys later via admin panel
  try {
    await initializeApiKeys();
    console.log('✓ API keys initialized successfully');
  } catch (error) {
    console.warn('Warning: Failed to initialize API keys from environment:', error);
    console.warn('API keys can be configured later via the admin panel.');
  }

  // Auth endpoint
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Kie.ai Callback Endpoint (no auth - called by Kie.ai)
  app.post('/api/callback/kie/:generationId', async (req: any, res) => {
    try {
      const { generationId } = req.params;
      const callbackData = req.body;
      
      console.log(`Received Kie.ai callback for generation ${generationId}:`, JSON.stringify(callbackData));
      
      // Extract result URL from callback data
      // Kie.ai sends result URLs in various nested structures depending on the API
      const resultUrl = (callbackData.data?.info?.resultUrls && callbackData.data.info.resultUrls[0]) ||
                       (callbackData.data?.info?.result_urls && callbackData.data.info.result_urls[0]) ||
                       (callbackData.data?.resultUrls && callbackData.data.resultUrls[0]) ||
                       (callbackData.data?.result_urls && callbackData.data.result_urls[0]) ||
                       callbackData.resultUrls?.[0] ||
                       callbackData.result_urls?.[0] ||
                       callbackData.videoUrl || 
                       callbackData.imageUrl || 
                       callbackData.audioUrl || 
                       callbackData.url || 
                       callbackData.data?.url ||
                       callbackData.data?.videoUrl ||
                       callbackData.data?.imageUrl ||
                       callbackData.data?.audioUrl;
      
      // Check for explicit status from Kie.ai
      const kieStatus = callbackData.status?.toLowerCase();
      const hasError = callbackData.error || callbackData.errorMessage || callbackData.data?.error;
      
      // Determine final status
      let finalStatus: 'completed' | 'failed';
      if (kieStatus === 'failed' || kieStatus === 'error') {
        finalStatus = 'failed';
      } else if (resultUrl) {
        finalStatus = 'completed';
      } else {
        finalStatus = 'failed';
      }
      
      if (finalStatus === 'completed' && resultUrl) {
        await storage.updateGeneration(generationId, {
          status: 'completed',
          resultUrl,
          completedAt: new Date(),
        });
        console.log(`✓ Generation ${generationId} completed successfully with URL: ${resultUrl}`);
      } else {
        const errorMessage = hasError || 
                           callbackData.message || 
                           callbackData.data?.message ||
                           'Generation failed - no result URL provided';
        await storage.updateGeneration(generationId, {
          status: 'failed',
          errorMessage,
        });
        console.log(`✗ Generation ${generationId} failed: ${errorMessage}`);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Callback processing error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Video Generation
  app.post('/api/generate/video', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validationResult = generateVideoRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { model, prompt, generationType, referenceImages, veoSubtype, parameters } = validationResult.data;
      const cost = MODEL_COSTS[model as keyof typeof MODEL_COSTS] || 500;

      // Atomically deduct credits
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create generation record with image-to-video support
      const generation = await storage.createGeneration({
        userId,
        type: 'video',
        generationType,
        model,
        prompt,
        referenceImages,
        parameters: parameters || {},
        status: 'pending',
        creditsCost: cost,
      });

      // Start generation in background (fire and forget)
      generateVideoInBackground(
        generation.id, 
        model, 
        prompt, 
        generationType, 
        referenceImages,
        veoSubtype,
        parameters || {}
      );

      res.json({ generationId: generation.id, message: "Video generation started" });
    } catch (error: any) {
      console.error('Video generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate video" });
    }
  });

  // Image Generation
  app.post('/api/generate/image', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validationResult = generateImageRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { model, prompt, mode, referenceImages, parameters } = validationResult.data;
      
      // Mode-specific validation is now enforced by schema refinement
      // This ensures no referenceImages can reach this point if mode is text-to-image
      
      const cost = MODEL_COSTS[model as keyof typeof MODEL_COSTS] || 100;

      // Atomically deduct credits
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'image',
        model,
        prompt,
        referenceImages,
        parameters: parameters || {},
        status: 'pending',
        creditsCost: cost,
      });

      // Only pass referenceImages to background processing if mode is editing
      generateImageInBackground(
        generation.id, 
        model, 
        prompt, 
        mode,
        mode === 'image-editing' ? referenceImages : undefined,
        parameters || {}
      );

      res.json({ generationId: generation.id, message: "Image generation started" });
    } catch (error: any) {
      console.error('Image generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate image" });
    }
  });

  // Music Generation
  app.post('/api/generate/music', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validationResult = generateMusicRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { model, prompt, parameters } = validationResult.data;
      const cost = MODEL_COSTS[model as keyof typeof MODEL_COSTS] || 200;

      // Atomically deduct credits
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'music',
        model,
        prompt,
        parameters: parameters || {},
        status: 'pending',
        creditsCost: cost,
      });

      generateMusicInBackground(generation.id, model, prompt, parameters || {});

      res.json({ generationId: generation.id, message: "Music generation started" });
    } catch (error: any) {
      console.error('Music generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate music" });
    }
  });

  // Get user generations
  app.get('/api/generations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const generations = await storage.getUserGenerations(userId);
      res.json(generations);
    } catch (error) {
      console.error('Error fetching generations:', error);
      res.status(500).json({ message: "Failed to fetch generations" });
    }
  });

  // Get recent generations
  app.get('/api/generations/recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const generations = await storage.getRecentGenerations(userId, 6);
      res.json(generations);
    } catch (error) {
      console.error('Error fetching recent generations:', error);
      res.status(500).json({ message: "Failed to fetch recent generations" });
    }
  });

  // Get user stats
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ========== CHAT ROUTES ==========

  // Get user conversations
  app.get('/api/chat/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get conversation messages
  app.get('/api/chat/conversations/:conversationId', isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const messages = await storage.getConversationMessages(conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send message (with streaming support)
  app.post('/api/chat/send', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate request
      const validationResult = sendMessageRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { conversationId, message, provider, model } = validationResult.data;

      // Validate model for provider
      if (!chatService.validateModel(provider, model)) {
        return res.status(400).json({ 
          message: `Invalid model '${model}' for provider '${provider}'` 
        });
      }

      // Get credit cost
      const cost = chatService.getCreditCost(model);

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create or get conversation
      let convId = conversationId;
      if (!convId) {
        const conversation = await storage.createConversation({
          userId,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          provider,
          model,
        });
        convId = conversation.id;
      }

      // Save user message
      await storage.createMessage({
        conversationId: convId,
        role: 'user',
        content: message,
        creditsCost: 0,
      });

      // Get conversation history
      const history = await storage.getConversationMessages(convId);
      const chatMessages = history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';

      try {
        // Stream chat response
        for await (const chunk of chatService.streamChat(provider, model, chatMessages)) {
          if (!chunk.done) {
            // Send chunk to client
            res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
            fullResponse += chunk.content;
          } else {
            // Final chunk - save assistant message
            await storage.createMessage({
              conversationId: convId,
              role: 'assistant',
              content: fullResponse,
              creditsCost: cost,
            });

            // Send completion event with conversation ID
            res.write(`data: ${JSON.stringify({ 
              done: true, 
              conversationId: convId,
              content: fullResponse 
            })}\n\n`);
            res.end();
          }
        }
      } catch (streamError: any) {
        console.error('Streaming error:', streamError);
        res.write(`data: ${JSON.stringify({ 
          error: streamError.message || 'Chat error occurred' 
        })}\n\n`);
        res.end();
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || "Failed to send message" });
      }
    }
  });

  // Delete conversation
  app.delete('/api/chat/conversations/:conversationId', isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      await storage.deleteConversation(conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // Update conversation title
  app.patch('/api/chat/conversations/:conversationId/title', isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const { title } = req.body;
      const conversation = await storage.updateConversationTitle(conversationId, title);
      res.json(conversation);
    } catch (error) {
      console.error('Error updating conversation title:', error);
      res.status(500).json({ message: "Failed to update conversation title" });
    }
  });

  // ========== VOICE CLONING ROUTES ==========

  // Clone a voice
  app.post('/api/voice-clone', isAuthenticated, async (req: any, res) => {
    let hostedAudioUrls: string[] | undefined;
    
    try {
      const userId = req.user.claims.sub;

      // Validate request
      const validationResult = cloneVoiceRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { name, description, audioFiles } = validationResult.data;
      const cost = 100; // Voice cloning cost

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Convert base64 audio files to hosted URLs with validation
        console.log(`Converting ${audioFiles.length} base64 audio files to hosted URLs...`);
        hostedAudioUrls = await saveBase64AudioFiles(audioFiles);
        console.log(`✓ Audio files hosted successfully:`, hostedAudioUrls);

        // Call Kie.ai voice cloning API
        const { result, keyName } = await cloneVoice({
          name,
          description,
          audioFiles: hostedAudioUrls,
        });

        // Extract voice ID from result
        const voiceId = result?.data?.voiceId || result?.voiceId || result?.id;
        if (!voiceId) {
          throw new Error('Voice cloning failed - no voice ID returned');
        }

        // Save voice clone to database
        const voiceClone = await storage.createVoiceClone({
          userId,
          name,
          voiceId,
          description: description || '',
          provider: 'elevenlabs',
          isActive: true,
        });

        res.json({ 
          success: true, 
          voiceClone,
          message: "Voice cloned successfully" 
        });
      } catch (error: any) {
        // Refund credits atomically if voice cloning failed
        const currentUser = await storage.getUser(userId);
        if (currentUser) {
          await storage.updateUserCredits(userId, currentUser.credits + cost);
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Voice cloning error:', error);
      res.status(500).json({ message: error.message || "Failed to clone voice" });
    }
  });

  // Get user's cloned voices
  app.get('/api/voice-clones', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const voices = await storage.getUserVoiceClones(userId);
      res.json(voices);
    } catch (error) {
      console.error('Error fetching voice clones:', error);
      res.status(500).json({ message: "Failed to fetch voice clones" });
    }
  });

  // Toggle voice clone active status
  app.patch('/api/voice-clones/:voiceId/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { voiceId } = req.params;
      const { isActive } = req.body;

      // Verify ownership
      const existingVoice = await storage.getVoiceClone(voiceId);
      if (!existingVoice) {
        return res.status(404).json({ message: "Voice clone not found" });
      }
      if (existingVoice.userId !== userId) {
        return res.status(403).json({ message: "Forbidden - not your voice clone" });
      }

      const voice = await storage.toggleVoiceClone(voiceId, isActive);
      res.json(voice);
    } catch (error) {
      console.error('Error toggling voice clone:', error);
      res.status(500).json({ message: "Failed to toggle voice clone" });
    }
  });

  // Delete voice clone
  app.delete('/api/voice-clones/:voiceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { voiceId } = req.params;

      // Verify ownership
      const existingVoice = await storage.getVoiceClone(voiceId);
      if (!existingVoice) {
        return res.status(404).json({ message: "Voice clone not found" });
      }
      if (existingVoice.userId !== userId) {
        return res.status(403).json({ message: "Forbidden - not your voice clone" });
      }

      await storage.deleteVoiceClone(voiceId);
      res.json({ success: true, message: "Voice clone deleted" });
    } catch (error) {
      console.error('Error deleting voice clone:', error);
      res.status(500).json({ message: "Failed to delete voice clone" });
    }
  });

  // ========== TEXT-TO-SPEECH ROUTES ==========

  // Generate TTS
  app.post('/api/tts/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate request
      const validationResult = generateTTSRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { text, voiceId, voiceName, model, parameters } = validationResult.data;
      const cost = MODEL_COSTS[model] || 20;

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create TTS generation record
      const ttsGeneration = await storage.createTtsGeneration({
        userId,
        text,
        voiceId,
        voiceName: voiceName || voiceId,
        model,
        parameters: parameters || null,
        status: 'processing',
        resultUrl: null,
        errorMessage: null,
        creditsCost: cost,
      });

      // Generate TTS in background
      (async () => {
        try {
          const { result } = await generateTTS({
            text,
            voiceId,
            voiceName,
            model,
            parameters,
          });

          // Extract audio URL from result
          const audioUrl = result?.data?.audioUrl || result?.audioUrl || result?.url;
          if (!audioUrl) {
            throw new Error('TTS generation failed - no audio URL returned');
          }

          await storage.updateTtsGeneration(ttsGeneration.id, {
            status: 'completed',
            resultUrl: audioUrl,
            completedAt: new Date(),
          });
        } catch (error: any) {
          console.error('TTS generation error:', error);
          
          // Refund credits on failure
          const currentUser = await storage.getUser(userId);
          if (currentUser) {
            await storage.updateUserCredits(userId, currentUser.credits + cost);
          }

          await storage.updateTtsGeneration(ttsGeneration.id, {
            status: 'failed',
            errorMessage: error.message || 'TTS generation failed',
            completedAt: new Date(),
          });
        }
      })();

      res.json({ 
        success: true, 
        generationId: ttsGeneration.id,
        message: "TTS generation started" 
      });
    } catch (error: any) {
      console.error('TTS generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate TTS" });
    }
  });

  // Get user's TTS generations
  app.get('/api/tts/generations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const generations = await storage.getUserTtsGenerations(userId);
      res.json(generations);
    } catch (error) {
      console.error('Error fetching TTS generations:', error);
      res.status(500).json({ message: "Failed to fetch TTS generations" });
    }
  });

  // ========== SPEECH-TO-TEXT ROUTES ==========

  // Transcribe audio (STT) - SYNCHRONOUS processing
  app.post('/api/stt/transcribe', isAuthenticated, async (req: any, res) => {
    let hostedAudioUrl: string[] | undefined;
    let sttGeneration: any = undefined; // Hoist to outer scope for error handling
    
    try {
      const userId = req.user.claims.sub;

      // Validate request
      const validationResult = generateSTTRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { audioFile, model, language, parameters } = validationResult.data;
      const cost = MODEL_COSTS[model] || 25;

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Convert base64 audio to hosted URL
        console.log('Converting audio file to hosted URL...');
        hostedAudioUrl = await saveBase64AudioFiles([audioFile]);
        const audioUrl = hostedAudioUrl[0];
        console.log(`✓ Audio hosted at: ${audioUrl}`);

        // Create STT generation record
        sttGeneration = await storage.createSttGeneration({
          userId,
          audioUrl,
          model,
          language: language || null,
          parameters: parameters || null,
          transcription: null,
          status: 'processing',
          errorMessage: null,
          creditsCost: cost,
        });

        // Transcribe audio SYNCHRONOUSLY (wait for result before responding)
        const { result } = await transcribeAudio({
          audioUrl,
          model,
          language,
          parameters,
        });

        // Extract transcription from result
        const transcription = result?.data?.transcription || result?.transcription || result?.text;
        if (!transcription) {
          throw new Error('Transcription failed - no text returned');
        }

        // Update with completed transcription
        await storage.updateSttGeneration(sttGeneration.id, {
          status: 'completed',
          transcription: typeof transcription === 'string' ? transcription : JSON.stringify(transcription),
          completedAt: new Date(),
        });

        // Return success with transcription immediately and EXIT
        return res.json({ 
          success: true, 
          generationId: sttGeneration.id,
          transcription,
          message: "Transcription completed" 
        });
      } catch (error: any) {
        console.error('STT transcription/processing error:', error);
        
        // Refund credits atomically on failure
        try {
          await storage.addCreditsAtomic(userId, cost);
        } catch (refundError) {
          console.error('Credit refund failed:', refundError);
          // Continue even if refund fails - error will be logged
        }
        
        // Mark as failed in database if generation record exists
        if (sttGeneration) {
          try {
            await storage.updateSttGeneration(sttGeneration.id, {
              status: 'failed',
              errorMessage: error.message || 'Transcription failed',
              completedAt: new Date(),
            });
          } catch (dbError) {
            console.error('Failed to update STT generation status:', dbError);
            // Continue - error will be logged
          }
        }
        
        // Send error response and return (don't rethrow)
        if (!res.headersSent) {
          return res.status(500).json({ message: error.message || "Failed to transcribe audio" });
        }
        return; // Exit if headers already sent
      }
    } catch (error: any) {
      console.error('STT transcription error:', error);
      // Only send response if not already sent
      if (!res.headersSent) {
        return res.status(500).json({ message: error.message || "Failed to transcribe audio" });
      }
      return; // Exit if headers already sent
    }
  });

  // Get user's STT transcriptions
  app.get('/api/stt/transcriptions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transcriptions = await storage.getUserSttGenerations(userId);
      res.json(transcriptions);
    } catch (error) {
      console.error('Error fetching STT transcriptions:', error);
      res.status(500).json({ message: "Failed to fetch transcriptions" });
    }
  });

  // ========== AI TALKING AVATAR ROUTES ==========

  // Generate talking avatar
  app.post('/api/avatar/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const validationResult = generateAvatarRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: validationResult.error.errors });
      }

      const { sourceImage, script, voiceId, provider, parameters } = validationResult.data;
      const cost = MODEL_COSTS[provider] || 350;

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Host image
        const [imageUrl] = await saveBase64Images([sourceImage]);

        const avatarGeneration = await storage.createAvatarGeneration({
          userId,
          sourceImageUrl: imageUrl,
          script,
          voiceId: voiceId || null,
          provider,
          parameters: parameters || null,
          status: 'pending',
          resultUrl: null,
          errorMessage: null,
          creditsCost: cost,
        });

        // Background processing
        (async () => {
          try {
            const callbackUrl = getCallbackUrl(avatarGeneration.id);
            const { result } = await generateKlingAvatar({
              sourceImageUrl: imageUrl,
              script,
              voiceId,
              provider,
              parameters: { ...parameters, callBackUrl: callbackUrl },
            });

            const taskId = result?.data?.taskId || result?.taskId;
            const directUrl = result?.url || result?.videoUrl || result?.data?.url;

            if (directUrl) {
              await storage.updateAvatarGeneration(avatarGeneration.id, {
                status: 'completed',
                resultUrl: directUrl,
                completedAt: new Date(),
              });
            } else if (taskId) {
              await storage.updateAvatarGeneration(avatarGeneration.id, {
                status: 'processing',
                resultUrl: taskId,
              });
            } else {
              throw new Error('No taskId or URL returned');
            }
          } catch (error: any) {
            await storage.addCreditsAtomic(userId, cost);
            await storage.updateAvatarGeneration(avatarGeneration.id, {
              status: 'failed',
              errorMessage: error.message,
            });
          }
        })();

        res.json({ generationId: avatarGeneration.id, message: "Avatar generation started" });
      } catch (error: any) {
        await storage.addCreditsAtomic(userId, cost);
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to generate avatar" });
    }
  });

  // Get user's avatar generations
  app.get('/api/avatar/generations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const avatars = await storage.getUserAvatarGenerations(userId);
      res.json(avatars);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch avatar generations" });
    }
  });

  // ========== AUDIO CONVERSION ROUTES ==========

  // Convert audio
  app.post('/api/audio/convert', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const validationResult = convertAudioRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: validationResult.error.errors });
      }

      const { sourceAudio, sourceFormat, operation, parameters } = validationResult.data;
      const costs = { 'wav-conversion': 15, 'vocal-removal': 25, 'stem-separation': 30 };
      const cost = costs[operation] || 20;

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        const audioUrl = await saveBase64Audio(sourceAudio);

        const conversion = await storage.createAudioConversion({
          userId,
          sourceUrl: audioUrl,
          sourceFormat,
          targetFormat: parameters?.targetFormat || 'mp3',
          compressionLevel: parameters?.compressionLevel || null,
          status: 'pending',
          resultUrl: null,
          errorMessage: null,
          creditsCost: cost,
        });

        (async () => {
          try {
            const callbackUrl = getCallbackUrl(conversion.id);
            const { result } = await convertAudio({
              sourceUrl: audioUrl,
              operation,
              parameters: { ...parameters, callBackUrl: callbackUrl },
            });

            const taskId = result?.data?.taskId || result?.taskId;
            const directUrl = result?.url || result?.audioUrl || result?.data?.url;

            if (directUrl) {
              await storage.updateAudioConversion(conversion.id, {
                status: 'completed',
                resultUrl: directUrl,
                completedAt: new Date(),
              });
            } else if (taskId) {
              await storage.updateAudioConversion(conversion.id, {
                status: 'processing',
                resultUrl: taskId,
              });
            } else {
              throw new Error('No taskId or URL returned');
            }
          } catch (error: any) {
            await storage.addCreditsAtomic(userId, cost);
            await storage.updateAudioConversion(conversion.id, {
              status: 'failed',
              errorMessage: error.message,
            });
          }
        })();

        res.json({ conversionId: conversion.id, message: "Audio conversion started" });
      } catch (error: any) {
        await storage.addCreditsAtomic(userId, cost);
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to convert audio" });
    }
  });

  // Get user's audio conversions
  app.get('/api/audio/conversions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversions = await storage.getUserAudioConversions(userId);
      res.json(conversions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversions" });
    }
  });

  // ========== ADMIN ROUTES ==========

  // Admin: Get all users
  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Update user credits
  app.patch('/api/admin/users/:userId/credits', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { userId } = req.params;
      const { credits } = req.body;

      const user = await storage.updateUserCredits(userId, credits);
      res.json(user);
    } catch (error) {
      console.error('Error updating credits:', error);
      res.status(500).json({ message: "Failed to update credits" });
    }
  });

  // Admin: Delete user
  app.delete('/api/admin/users/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const admin = await storage.getUser(adminId);
      
      if (!admin?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { userId } = req.params;
      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin: Get all API keys
  app.get('/api/admin/api-keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const keys = await storage.getAllApiKeys();
      res.json(keys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  // Admin: Add API key
  app.post('/api/admin/api-keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { keyName } = req.body;
      const key = await storage.addApiKey({ keyName, isActive: true });
      res.json(key);
    } catch (error) {
      console.error('Error adding API key:', error);
      res.status(500).json({ message: "Failed to add API key" });
    }
  });

  // Admin: Toggle API key status
  app.patch('/api/admin/api-keys/:keyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { keyId } = req.params;
      const { isActive } = req.body;

      const key = await storage.toggleApiKey(keyId, isActive);
      res.json(key);
    } catch (error) {
      console.error('Error toggling API key:', error);
      res.status(500).json({ message: "Failed to update API key" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
