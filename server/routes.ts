import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import { storage } from "./storage";
import { registerAuthRoutes } from "./authRoutes";
import { requireJWT, requireAdmin } from "./jwtMiddleware";
import { 
  generateVideo, 
  generateImage, 
  generateMusic,
  extendMusic,
  generateLyrics,
  generateSoundEffects,
  uploadCover,
  uploadExtend,
  cloneVoice,
  generateTTS,
  transcribeAudio,
  generateKlingAvatar,
  convertAudio,
  upscaleImage,
  upscaleVideo,
  initializeApiKeys 
} from "./kieai";
import { analyzeImageWithVision } from "./openaiVision";
import { processImageInputs, saveBase64Images } from "./imageHosting";
import { saveBase64Audio, saveBase64AudioFiles } from "./audioHosting";
import { chatService } from "./chatService";
import { combineVideos, generateThumbnail } from "./videoProcessor";
import { LoopsService } from "./loops";
import { logger } from "./logger";
import { 
  createCheckoutSession, 
  createCustomerPortalSession,
  verifyWebhookSignature,
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from "./stripe";
import { 
  generateVideoRequestSchema, 
  generateImageRequestSchema, 
  generateMusicRequestSchema,
  extendMusicRequestSchema,
  generateLyricsRequestSchema,
  generateSoundEffectsRequestSchema,
  uploadCoverRequestSchema,
  uploadExtendRequestSchema,
  sendMessageRequestSchema,
  cloneVoiceRequestSchema,
  generateTTSRequestSchema,
  generateSTTRequestSchema,
  generateAvatarRequestSchema,
  analyzeImageRequestSchema,
  convertAudioRequestSchema,
  combineVideosRequestSchema,
  upscaleImageRequestSchema,
  upscaleVideoRequestSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  loopsTestContactRequestSchema,
  contactFormRequestSchema,
  type InsertSubscriptionPlan
} from "@shared/schema";
import { getBaseUrl } from "./urlUtils";
import { ServerClient } from "postmark";

// Safe JSON stringifier to prevent circular reference errors
function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  }, 2);
}

// Helper to get pricing from database by model name
async function getModelCost(model: string): Promise<number> {
  const pricing = await storage.getPricingByModel(model);
  
  if (pricing) {
    return pricing.creditCost;
  }
  
  // Default fallback costs if not found in database
  const defaultCosts: Record<string, number> = {
    'veo-3': 450,
    'veo-3.1': 500,
    'veo-3.1-fast': 300,
    'runway-gen3-alpha-turbo': 350,
    'runway-aleph': 400,
    '4o-image': 100,
    'flux-kontext': 150,
    'nano-banana': 50,
    'suno-v3.5': 200,
    'suno-v4': 250,
    'suno-v4.5': 300,
    'eleven_multilingual_v2': 20,
    'eleven_turbo_v2.5': 15,
    'scribe-v1': 25,
    'kling-ai': 350,
    'infinite-talk': 300,
    'wav-conversion': 15,
    'vocal-removal': 25,
    'stem-separation': 30,
    'gpt-4o': 20, // Image analysis with GPT-4o Vision
  };
  
  return defaultCosts[model] || 100;
}

// Helper to get upscale cost based on type and factor
async function getUpscaleCost(type: 'image' | 'video', factor: string): Promise<number> {
  const modelName = `topaz-${type}-${factor}x`;
  return await getModelCost(modelName);
}

// Helper to get callback URL using centralized base URL logic
function getCallbackUrl(generationId: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/callback/kie/${generationId}`;
}

// Helper to generate a random seed for reproducible AI generation
function generateRandomSeed(): number {
  return Math.floor(Math.random() * 2147483647) + 1;
}

// Helper to check if a model supports seed parameters
function modelSupportsSeed(model: string): boolean {
  return model.startsWith('veo-') || 
         model.startsWith('seedance-') || 
         model.startsWith('wan-') ||
         model === 'seedream-4';
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
    
    // Process reference images (convert base64 data URIs to hosted URLs, pass through existing URLs)
    let hostedImageUrls: string[] | undefined;
    if (referenceImages && referenceImages.length > 0) {
      console.log(`Processing ${referenceImages.length} reference images (data URIs and/or URLs)...`);
      hostedImageUrls = await processImageInputs(referenceImages);
      console.log(`✓ Images processed successfully:`, hostedImageUrls);
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
        await storage.finalizeGeneration(generationId, 'success', {
          resultUrl,
          apiKeyUsed: keyName,
        });
        return;
      }
      throw new Error('API response missing taskId or video URL');
    }
    
    // Store taskId in externalTaskId field for webhook matching
    await storage.updateGeneration(generationId, {
      status: 'processing',
      apiKeyUsed: keyName,
      externalTaskId: taskId,
      statusDetail: 'queued',
    });
    
    console.log(`📋 Video generation task queued: ${taskId} (waiting for callback)`);
  } catch (error: any) {
    console.error('Background video generation failed:', safeStringify(error));
    
    // Capture full error details from Kie.ai for debugging
    const errorDetails: any = {
      errorMessage: error.message,
    };
    
    // If this is an enhanced error from Kie.ai, include all diagnostic details
    if (error.kieaiDetails) {
      errorDetails.statusDetail = safeStringify({
        httpStatus: error.kieaiDetails.status,
        statusText: error.kieaiDetails.statusText,
        endpoint: error.kieaiDetails.endpoint,
        providerError: error.kieaiDetails.data,
      });
      
      console.error('🔍 Kie.ai Error Details:', errorDetails.statusDetail);
    }
    
    await storage.finalizeGeneration(generationId, 'failure', errorDetails);
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
    
    // Process reference images (convert base64 data URIs to hosted URLs, pass through existing URLs)
    if (mode === 'image-editing' && referenceImages && referenceImages.length > 0) {
      console.log(`Processing ${referenceImages.length} reference images for editing (data URIs and/or URLs)...`);
      hostedImageUrls = await processImageInputs(referenceImages);
      console.log(`✓ Images processed successfully:`, hostedImageUrls);
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
      await storage.finalizeGeneration(generationId, 'success', {
        resultUrl: directUrl,
        apiKeyUsed: keyName,
      });
      return;
    }
    
    if (taskId) {
      await storage.updateGeneration(generationId, {
        status: 'processing',
        apiKeyUsed: keyName,
        externalTaskId: taskId,
        statusDetail: 'queued',
      });
      console.log(`📋 Image generation task queued: ${taskId} (waiting for callback)`);
      return;
    }
    
    throw new Error('API response missing taskId or image URL');
  } catch (error: any) {
    console.error('Background image generation failed:', safeStringify(error));
    
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
    
    // Capture full error details from Kie.ai for debugging
    const errorDetails: any = {
      errorMessage: error.message || 'Unknown error during image generation',
    };
    
    // If this is an enhanced error from Kie.ai, include all diagnostic details
    if (error.kieaiDetails) {
      errorDetails.statusDetail = safeStringify({
        httpStatus: error.kieaiDetails.status,
        statusText: error.kieaiDetails.statusText,
        endpoint: error.kieaiDetails.endpoint,
        providerError: error.kieaiDetails.data,
      });
      
      console.error('🔍 Kie.ai Error Details:', errorDetails.statusDetail);
    }
    
    await storage.finalizeGeneration(generationId, 'failure', errorDetails);
  }
}

async function generateTTSInBackground(
  generationId: string,
  text: string,
  voiceId: string,
  voiceName?: string,
  model?: string,
  parameters?: any
) {
  try {
    await storage.updateGeneration(generationId, { status: 'processing' });
    
    const callbackUrl = getCallbackUrl(generationId);
    console.log(`📞 Sending callback URL to Kie.ai for TTS ${generationId}: ${callbackUrl}`);
    
    const { result, keyName } = await generateTTS({
      text,
      voiceId,
      voiceName,
      model,
      parameters,
      callBackUrl: callbackUrl
    });
    
    // ElevenLabs TTS uses same format as Sound Effects: result.data.taskId
    const taskId = result?.data?.taskId;
    if (!taskId) {
      // If we got direct URL (older API format), use it
      const resultUrl = result?.url || result?.audioUrl || result?.data?.url || 
                       (result?.data?.data && Array.isArray(result.data.data) && result.data.data[0]?.audioUrl) ||
                       result?.data?.data?.audioUrl;
      if (resultUrl) {
        await storage.finalizeGeneration(generationId, 'success', {
          resultUrl,
          apiKeyUsed: keyName,
          statusDetail: 'completed',
        });
        console.log(`✓ TTS generation completed immediately: ${resultUrl}`);
        return;
      }
      throw new Error('API response missing taskId or audio URL');
    }
    
    // Store taskId in externalTaskId field for webhook matching
    await storage.updateGeneration(generationId, {
      status: 'processing',
      apiKeyUsed: keyName,
      externalTaskId: taskId,
      statusDetail: 'queued',
    });
    
    console.log(`📋 TTS generation task queued: ${taskId} (waiting for callback)`);
  } catch (error: any) {
    console.error(`❌ TTS generation failed for ${generationId}:`, error);
    
    // Get generation to retrieve creditsCost for refund
    const generation = await storage.getGeneration(generationId);
    if (generation && generation.creditsCost) {
      // Refund credits atomically
      const userId = generation.userId;
      const currentUser = await storage.getUser(userId);
      if (currentUser) {
        await storage.updateUserCredits(userId, currentUser.credits + generation.creditsCost);
        console.log(`💰 Refunded ${generation.creditsCost} credits to user ${userId} for failed TTS generation`);
      }
    }
    
    await storage.finalizeGeneration(generationId, 'failure', {
      statusDetail: 'api_error',
      errorMessage: error.message || 'TTS generation failed'
    });
  }
}

async function generateSoundEffectsInBackground(
  generationId: string, 
  text: string, 
  loop?: boolean, 
  duration_seconds?: number, 
  prompt_influence?: number, 
  output_format?: string,
  model?: string
) {
  try {
    await storage.updateGeneration(generationId, { status: 'processing' });
    
    const callbackUrl = getCallbackUrl(generationId);
    console.log(`📞 Sending callback URL to Kie.ai for sound effects ${generationId}: ${callbackUrl}`);
    
    const { result, keyName } = await generateSoundEffects({ 
      text, 
      loop,
      duration_seconds,
      prompt_influence,
      output_format,
      callBackUrl: callbackUrl
    });
    
    // ElevenLabs Sound Effect V2 uses Bytedance/Playground format: result.data.taskId
    const taskId = result?.data?.taskId;
    if (!taskId) {
      // If we got direct URL (older API format), use it
      const resultUrl = result?.url || result?.audioUrl || result?.data?.url;
      if (resultUrl) {
        await storage.finalizeGeneration(generationId, 'success', {
          resultUrl,
          apiKeyUsed: keyName,
          statusDetail: 'completed',
        });
        console.log(`✓ Sound effects generation completed immediately: ${resultUrl}`);
        return;
      }
      throw new Error('API response missing taskId or audio URL');
    }
    
    // Store taskId in externalTaskId field for webhook matching
    await storage.updateGeneration(generationId, {
      status: 'processing',
      apiKeyUsed: keyName,
      externalTaskId: taskId,
      statusDetail: 'queued',
    });
    
    console.log(`📋 Sound effects generation task queued: ${taskId} (waiting for callback)`);
  } catch (error: any) {
    console.error('Background sound effects generation failed:', error);
    await storage.finalizeGeneration(generationId, 'failure', { 
      errorMessage: error.message || 'Unknown error during sound effects generation' 
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
    
    // Use centralized parser to handle all Suno response formats
    const { taskId, audioUrl, status: providerStatus, errorMessage } = await import('./kieai').then(m => m.parseSunoResponse(result));
    
    // If there's an explicit error, fail immediately
    if (errorMessage) {
      await storage.finalizeGeneration(generationId, 'failure', {
        errorMessage: errorMessage,
      });
      console.log(`❌ Suno API returned error: ${errorMessage}`);
      return;
    }
    
    // If we got a direct audio URL, mark as completed immediately
    if (audioUrl) {
      await storage.finalizeGeneration(generationId, 'success', {
        resultUrl: audioUrl,
        apiKeyUsed: keyName,
        statusDetail: providerStatus || 'completed',
      });
      console.log(`✓ Music generation completed immediately with URL: ${audioUrl}`);
      return;
    }
    
    // If we have a task ID, stay in processing state and wait for callback
    if (taskId) {
      await storage.updateGeneration(generationId, {
        status: 'processing',
        apiKeyUsed: keyName,
        externalTaskId: taskId,
        statusDetail: providerStatus || 'queued',
      });
      console.log(`📋 Music generation task queued: ${taskId} (status: ${providerStatus || 'unknown'}, waiting for callback)`);
      return;
    }
    
    // No error, no URL, no taskId - stay in processing and hope callback arrives
    console.warn(`⚠️ Suno API response has no taskId or URL for ${generationId}, staying in processing state`);
    console.warn(`Response data:`, JSON.stringify(result, null, 2));
    await storage.updateGeneration(generationId, {
      status: 'processing',
      apiKeyUsed: keyName,
      statusDetail: 'awaiting_callback',
    });
  } catch (error: any) {
    console.error('Background music generation failed:', safeStringify(error));
    
    // Capture full error details from Kie.ai for debugging
    const errorDetails: any = {
      errorMessage: error.message || 'Unknown error during music generation',
    };
    
    // If this is an enhanced error from Kie.ai, include all diagnostic details
    if (error.kieaiDetails) {
      errorDetails.statusDetail = safeStringify({
        httpStatus: error.kieaiDetails.status,
        statusText: error.kieaiDetails.statusText,
        endpoint: error.kieaiDetails.endpoint,
        providerError: error.kieaiDetails.data,
      });
      
      console.error('🔍 Kie.ai Error Details:', errorDetails.statusDetail);
    }
    
    await storage.finalizeGeneration(generationId, 'failure', errorDetails);
  }
}

// Extend Music Background Processing
async function extendMusicInBackground(generationId: string, audioUrl: string, model: string | undefined, continueAt: number | undefined, continueClipId: string | undefined, parameters: any) {
  try {
    await storage.updateGeneration(generationId, { status: 'processing' });
    
    const callbackUrl = getCallbackUrl(generationId);
    console.log(`📞 Sending callback URL to Kie.ai for extend music ${generationId}: ${callbackUrl}`);
    
    const { result, keyName } = await extendMusic({ 
      audioUrl, 
      continueAt,
      continueClipId,
      model,
      parameters: { ...parameters, callBackUrl: callbackUrl } 
    });
    
    const { taskId, audioUrl: resultAudioUrl, status: providerStatus, errorMessage } = await import('./kieai').then(m => m.parseSunoResponse(result));
    
    if (errorMessage) {
      await storage.finalizeGeneration(generationId, 'failure', {
        errorMessage: errorMessage,
      });
      console.log(`❌ Extend music API returned error: ${errorMessage}`);
      return;
    }
    
    if (resultAudioUrl) {
      await storage.finalizeGeneration(generationId, 'success', {
        resultUrl: resultAudioUrl,
        apiKeyUsed: keyName,
        statusDetail: providerStatus || 'completed',
      });
      console.log(`✓ Extend music completed immediately with URL: ${resultAudioUrl}`);
      return;
    }
    
    if (taskId) {
      await storage.updateGeneration(generationId, {
        status: 'processing',
        apiKeyUsed: keyName,
        externalTaskId: taskId,
        statusDetail: providerStatus || 'queued',
      });
      console.log(`📋 Extend music task queued: ${taskId} (status: ${providerStatus || 'unknown'}, waiting for callback)`);
      return;
    }
    
    console.warn(`⚠️ Extend music API response has no taskId or URL for ${generationId}`);
    await storage.updateGeneration(generationId, {
      status: 'processing',
      apiKeyUsed: keyName,
      statusDetail: 'awaiting_callback',
    });
  } catch (error: any) {
    console.error('Background extend music failed:', safeStringify(error));
    
    // Capture full error details from Kie.ai for debugging
    const errorDetails: any = {
      errorMessage: error.message || 'Unknown error during extend music',
    };
    
    // If this is an enhanced error from Kie.ai, include all diagnostic details
    if (error.kieaiDetails) {
      errorDetails.statusDetail = safeStringify({
        httpStatus: error.kieaiDetails.status,
        statusText: error.kieaiDetails.statusText,
        endpoint: error.kieaiDetails.endpoint,
        providerError: error.kieaiDetails.data,
      });
      
      console.error('🔍 Kie.ai Error Details:', errorDetails.statusDetail);
    }
    
    await storage.finalizeGeneration(generationId, 'failure', errorDetails);
  }
}

// Generate Lyrics Background Processing (uses lyricsGenerations table)
async function generateLyricsInBackground(lyricsId: string, prompt: string, parameters: any) {
  try {
    await storage.updateLyricsGeneration(lyricsId, { status: 'processing' });
    
    const callbackUrl = `${getBaseUrl()}/api/callback/lyrics/${lyricsId}`;
    console.log(`📞 Sending callback URL to Kie.ai for lyrics ${lyricsId}: ${callbackUrl}`);
    
    const { result, keyName } = await generateLyrics({ 
      prompt, 
      parameters: { ...parameters, callBackUrl: callbackUrl } 
    });
    
    console.log(`📋 Lyrics generation response:`, safeStringify(result));
    
    if (result.code === 200 && result.data) {
      const { taskId, lyrics, title, status: providerStatus, error } = result.data;
      
      if (error) {
        await storage.updateLyricsGeneration(lyricsId, {
          status: 'failed',
          errorMessage: error,
        });
        console.log(`❌ Lyrics API returned error: ${error}`);
        return;
      }
      
      if (lyrics) {
        await storage.updateLyricsGeneration(lyricsId, {
          status: 'completed',
          lyricsText: lyrics,
          lyricsTitle: title,
          completedAt: new Date(),
        });
        console.log(`✓ Lyrics generation completed immediately`);
        return;
      }
      
      if (taskId) {
        await storage.updateLyricsGeneration(lyricsId, {
          status: 'processing',
          externalTaskId: taskId,
        });
        console.log(`📋 Lyrics task queued: ${taskId} (waiting for callback)`);
        return;
      }
    }
    
    console.warn(`⚠️ Lyrics API response has no taskId or lyrics for ${lyricsId}`);
    await storage.updateLyricsGeneration(lyricsId, {
      status: 'processing',
    });
  } catch (error: any) {
    console.error('Background lyrics generation failed:', error);
    await storage.updateLyricsGeneration(lyricsId, {
      status: 'failed',
      errorMessage: error.message || 'Unknown error during lyrics generation',
    });
  }
}

// Upload & Cover Background Processing
async function uploadCoverInBackground(generationId: string, prompt: string, audioUrl: string, model: string | undefined, parameters: any) {
  try {
    await storage.updateGeneration(generationId, { status: 'processing' });
    
    const callbackUrl = getCallbackUrl(generationId);
    console.log(`📞 Sending callback URL to Kie.ai for upload cover ${generationId}: ${callbackUrl}`);
    
    const { result, keyName } = await uploadCover({ 
      prompt,
      audioUrl, 
      model,
      parameters: { ...parameters, callBackUrl: callbackUrl } 
    });
    
    const { taskId, audioUrl: resultAudioUrl, status: providerStatus, errorMessage } = await import('./kieai').then(m => m.parseSunoResponse(result));
    
    if (errorMessage) {
      await storage.finalizeGeneration(generationId, 'failure', {
        errorMessage: errorMessage,
      });
      console.log(`❌ Upload cover API returned error: ${errorMessage}`);
      return;
    }
    
    if (resultAudioUrl) {
      await storage.finalizeGeneration(generationId, 'success', {
        resultUrl: resultAudioUrl,
        apiKeyUsed: keyName,
        statusDetail: providerStatus || 'completed',
      });
      console.log(`✓ Upload cover completed immediately with URL: ${resultAudioUrl}`);
      return;
    }
    
    if (taskId) {
      await storage.updateGeneration(generationId, {
        status: 'processing',
        apiKeyUsed: keyName,
        externalTaskId: taskId,
        statusDetail: providerStatus || 'queued',
      });
      console.log(`📋 Upload cover task queued: ${taskId} (status: ${providerStatus || 'unknown'}, waiting for callback)`);
      return;
    }
    
    console.warn(`⚠️ Upload cover API response has no taskId or URL for ${generationId}`);
    await storage.updateGeneration(generationId, {
      status: 'processing',
      apiKeyUsed: keyName,
      statusDetail: 'awaiting_callback',
    });
  } catch (error: any) {
    console.error('Background upload cover failed:', safeStringify(error));
    
    // Capture full error details from Kie.ai for debugging
    const errorDetails: any = {
      errorMessage: error.message || 'Unknown error during upload cover',
    };
    
    // If this is an enhanced error from Kie.ai, include all diagnostic details
    if (error.kieaiDetails) {
      errorDetails.statusDetail = safeStringify({
        httpStatus: error.kieaiDetails.status,
        statusText: error.kieaiDetails.statusText,
        endpoint: error.kieaiDetails.endpoint,
        providerError: error.kieaiDetails.data,
      });
      
      console.error('🔍 Kie.ai Error Details:', errorDetails.statusDetail);
    }
    
    await storage.finalizeGeneration(generationId, 'failure', errorDetails);
  }
}

// Upload & Extend Background Processing
async function uploadExtendInBackground(generationId: string, prompt: string, audioUrl: string, model: string | undefined, parameters: any) {
  try {
    await storage.updateGeneration(generationId, { status: 'processing' });
    
    const callbackUrl = getCallbackUrl(generationId);
    console.log(`📞 Sending callback URL to Kie.ai for upload extend ${generationId}: ${callbackUrl}`);
    
    const { result, keyName } = await uploadExtend({ 
      prompt,
      audioUrl, 
      model,
      parameters: { ...parameters, callBackUrl: callbackUrl } 
    });
    
    const { taskId, audioUrl: resultAudioUrl, status: providerStatus, errorMessage } = await import('./kieai').then(m => m.parseSunoResponse(result));
    
    if (errorMessage) {
      await storage.finalizeGeneration(generationId, 'failure', {
        errorMessage: errorMessage,
      });
      console.log(`❌ Upload extend API returned error: ${errorMessage}`);
      return;
    }
    
    if (resultAudioUrl) {
      await storage.finalizeGeneration(generationId, 'success', {
        resultUrl: resultAudioUrl,
        apiKeyUsed: keyName,
        statusDetail: providerStatus || 'completed',
      });
      console.log(`✓ Upload extend completed immediately with URL: ${resultAudioUrl}`);
      return;
    }
    
    if (taskId) {
      await storage.updateGeneration(generationId, {
        status: 'processing',
        apiKeyUsed: keyName,
        externalTaskId: taskId,
        statusDetail: providerStatus || 'queued',
      });
      console.log(`📋 Upload extend task queued: ${taskId} (status: ${providerStatus || 'unknown'}, waiting for callback)`);
      return;
    }
    
    console.warn(`⚠️ Upload extend API response has no taskId or URL for ${generationId}`);
    await storage.updateGeneration(generationId, {
      status: 'processing',
      apiKeyUsed: keyName,
      statusDetail: 'awaiting_callback',
    });
  } catch (error: any) {
    console.error('Background upload extend failed:', safeStringify(error));
    
    // Capture full error details from Kie.ai for debugging
    const errorDetails: any = {
      errorMessage: error.message || 'Unknown error during upload extend',
    };
    
    // If this is an enhanced error from Kie.ai, include all diagnostic details
    if (error.kieaiDetails) {
      errorDetails.statusDetail = safeStringify({
        httpStatus: error.kieaiDetails.status,
        statusText: error.kieaiDetails.statusText,
        endpoint: error.kieaiDetails.endpoint,
        providerError: error.kieaiDetails.data,
      });
      
      console.error('🔍 Kie.ai Error Details:', errorDetails.statusDetail);
    }
    
    await storage.finalizeGeneration(generationId, 'failure', errorDetails);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add lightweight health check endpoint - responds immediately for deployment health checks
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Initialize auth - fail-fast if this doesn't work
  // Auth is critical; without it, all protected routes will fail
  try {
    registerAuthRoutes(app); // Register custom auth routes (register, login, Google OAuth, logout)
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

  // Hardcoded admin emails for access control
  const ADMIN_EMAILS = ['ryan.mahabir@outlook.com', 'admin@artivio.ai', 'joe@joecodeswell.com', 'jordanlambrecht@gmail.com', 'admin@example.com'];
  
  // Helper function to check admin status based on email
  const isUserAdmin = (user: any): boolean => {
    return user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;
  };

  // ========== PUBLIC ENDPOINTS (NO AUTH REQUIRED) ==========
  
  // Store plan selection before authentication
  app.post('/api/public/plan-selection', (req, res) => {
    try {
      const { planName } = req.body;
      
      // Validate plan name
      const validPlans = ['free', 'starter', 'pro'];
      if (!planName || !validPlans.includes(planName)) {
        return res.status(400).json({ 
          message: "Invalid plan name. Must be 'free', 'starter', or 'pro'" 
        });
      }

      // Store plan selection in signed cookie (expires in 1 hour)
      res.cookie('selected_plan', planName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000, // 1 hour
        signed: true,
      });

      console.log(`Plan selection stored: ${planName}`);
      res.json({ success: true, planName });
    } catch (error) {
      console.error('Error storing plan selection:', error);
      res.status(500).json({ message: "Failed to store plan selection" });
    }
  });

  // Store referral code in cookie (public endpoint for referral links)
  app.post('/api/public/referral/set', (req, res) => {
    try {
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ message: "Referral code is required" });
      }

      // Store referral code in signed cookie (expires in 30 days)
      res.cookie('referral_code', referralCode, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        signed: true,
      });

      console.log(`Referral code stored: ${referralCode}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Error storing referral code:', error);
      res.status(500).json({ message: "Failed to store referral code" });
    }
  });

  // Contact form submission (public endpoint)
  app.post('/api/public/contact', async (req, res) => {
    try {
      // Validate request body
      const validatedData = contactFormRequestSchema.parse(req.body);
      const { name, email, subject, message } = validatedData;

      console.log('[CONTACT FORM] Submission received:', { name, email, subject });

      // Check if Postmark is configured
      if (!process.env.POSTMARK_SERVER_TOKEN) {
        console.error('[CONTACT FORM] POSTMARK_SERVER_TOKEN not configured');
        return res.status(500).json({ 
          message: 'Email service is not configured. Please contact support directly at hello@artivio.ai' 
        });
      }

      // Send email via Postmark
      const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN);
      
      await postmarkClient.sendEmail({
        From: 'hello@artivio.ai',
        To: 'hello@artivio.ai',
        Subject: `Contact Form: ${subject}`,
        TextBody: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        ReplyTo: email,
      });

      console.log('[CONTACT FORM] Email sent successfully');
      
      res.json({ 
        success: true, 
        message: 'Thank you for your message! We will be in touch soon.' 
      });

    } catch (error: any) {
      console.error('[CONTACT FORM] Submission error:', error);
      
      // Handle validation errors
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: 'Invalid input',
          errors: error.errors?.map((e: any) => ({ 
            field: e.path.join('.'), 
            message: e.message 
          }))
        });
      }

      // Handle Postmark errors
      if (error.statusCode) {
        return res.status(500).json({ 
          message: 'Failed to send email. Please try again later.' 
        });
      }

      res.status(500).json({ 
        message: 'Failed to submit your message. Please try again later.' 
      });
    }
  });
  
  // ========== AUTH ENDPOINTS ==========
  // Auth routes (register, login, Google OAuth, logout) are now in authRoutes.ts
  // GET /api/auth/user is handled in authRoutes.ts

  // Kie.ai Callback Endpoint (no auth - called by Kie.ai)
  app.post('/api/callback/kie/:generationId', async (req: any, res) => {
    try {
      const { generationId } = req.params;
      const callbackData = req.body;
      
      console.log(`\n🔔 ===== RECEIVED KIE.AI CALLBACK =====`);
      console.log(`Generation ID: ${generationId}`);
      console.log(`Callback Data:`, safeStringify(callbackData));
      console.log(`Request Headers:`, safeStringify(req.headers));
      console.log(`======================================\n`);
      
      // Use centralized parser for consistent result extraction
      const { parseSunoResponse } = await import('./kieai');
      const { audioUrl: sunoAudioUrl, status: sunoStatus, errorMessage: sunoError } = parseSunoResponse(callbackData);
      
      // Extract result URL from callback data
      // Handle Seedance/Bytedance resultJson (JSON string containing resultUrls array)
      let seedanceResultUrl: string | undefined;
      if (callbackData.data?.resultJson) {
        try {
          const resultData = JSON.parse(callbackData.data.resultJson);
          seedanceResultUrl = resultData.resultUrls?.[0];
        } catch (e) {
          console.warn('Failed to parse Seedance resultJson:', e);
        }
      }
      
      // Priority order: Seedance (resultJson), Runway (video_url), Veo (info.resultUrls), Suno, ElevenLabs, others
      const resultUrl = seedanceResultUrl ||              // Seedance/Bytedance JSON string
                       callbackData.data?.video_url ||    // Runway uses snake_case
                       (callbackData.data?.info?.resultUrls && callbackData.data.info.resultUrls[0]) || // Veo nested
                       callbackData.data?.videoUrl ||     // Other models camelCase
                       sunoAudioUrl ||                    // Suno audio
                       (callbackData.data?.data && Array.isArray(callbackData.data.data) && callbackData.data.data[0]?.audioUrl) || // ElevenLabs TTS/Sound Effects array format
                       callbackData.data?.data?.audioUrl || // ElevenLabs TTS/Sound Effects object format
                       (callbackData.data?.data && Array.isArray(callbackData.data.data) && callbackData.data.data[0]?.audio_url) || // ElevenLabs snake_case
                       callbackData.data?.data?.audio_url || // ElevenLabs snake_case object
                       callbackData.data?.output_url ||   // ElevenLabs output format
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
                       callbackData.data?.imageUrl ||
                       callbackData.data?.image_url ||   // Runway image cover
                       callbackData.data?.audioUrl;
      
      // Check for explicit status from Kie.ai
      const kieStatus = (sunoStatus || callbackData.status)?.toLowerCase();
      
      // Check for Suno-specific callback stages (text, first, complete)
      const callbackType = callbackData.data?.callbackType || callbackData.callbackType;
      const isSunoIntermediateStage = callbackType === 'text' || callbackType === 'first';
      
      // Kie.ai models use HTTP status codes in 'code' field (Runway, Veo, Seedance)
      const httpStatusCode = callbackData.code;
      const isKieSuccess = httpStatusCode === 200;
      // Veo error codes: 400, 422, 500, 501
      // Runway error codes: 400, 500
      // Seedance error codes: 501 (uses data.state: 'fail')
      const isSeedanceError = httpStatusCode === 501 || callbackData.data?.state === 'fail';
      const isKieError = httpStatusCode === 400 || httpStatusCode === 422 || httpStatusCode === 500 || httpStatusCode === 501;
      
      // Comprehensive error detection - catch all possible error formats from Kie.ai
      const hasError = isKieError ||  // Runway/Veo use code: 400/422/500/501 for errors
                      sunoError || 
                      callbackData.error || 
                      callbackData.errorMessage || 
                      callbackData.errorCode ||
                      callbackData.error_message ||
                      callbackData.error_code ||
                      callbackData.data?.error || 
                      callbackData.data?.errorMessage ||
                      callbackData.data?.errorCode ||
                      callbackData.data?.error_message ||
                      callbackData.data?.error_code ||
                      callbackData.data?.code;
      
      // Check if this is an HTTP error code (4xx, 5xx) - but NOT success code 200
      const hasErrorCode = callbackData.code || callbackData.errorCode || callbackData.data?.code || callbackData.data?.errorCode;
      const isHttpError = hasErrorCode && !isKieSuccess && (String(hasErrorCode).startsWith('4') || String(hasErrorCode).startsWith('5'));
      
      // Identify intermediate callbacks - update statusDetail but don't finalize yet
      const isProcessing = kieStatus === 'processing' || 
                          kieStatus === 'pending' || 
                          kieStatus === 'queued' ||
                          kieStatus === 'working';
      
      // For intermediate callbacks, update statusDetail and acknowledge
      // Don't exit early - Suno sends these before final success
      // IMPORTANT: Suno sends 'text' (lyrics generated) and 'first' (first track) callbacks before 'complete'
      if ((isProcessing && !hasError && !resultUrl) || isSunoIntermediateStage) {
        // Soft update: persist status detail without finalizing
        const statusDetail = callbackType ? `${kieStatus} (${callbackType})` : kieStatus;
        await storage.updateGeneration(generationId, {
          statusDetail,
        });
        console.log(`⏸️  Intermediate callback for ${generationId} (status: ${kieStatus}, type: ${callbackType || 'N/A'}) - stored statusDetail`);
        return res.json({ success: true, message: 'Intermediate status updated' });
      }
      
      // Determine final status
      // Note: parseSunoResponse normalizes "complete" -> "success"
      let finalStatus: 'completed' | 'failed' | null = null;
      
      // Check for failure conditions (including HTTP error codes)
      if (hasError || isHttpError || kieStatus === 'failed' || kieStatus === 'error') {
        finalStatus = 'failed';
        
        // Log extensive error details for debugging
        console.error(`\n❌ ===== ERROR DETECTED IN CALLBACK =====`);
        console.error(`Generation ID: ${generationId}`);
        console.error(`Status: ${kieStatus}`);
        console.error(`HTTP Status Code: ${httpStatusCode || 'N/A'}`);
        console.error(`Error Code: ${hasErrorCode || 'N/A'}`);
        console.error(`Error Message: ${callbackData.msg || hasError || 'N/A'}`);
        console.error(`Full Callback Payload:`, safeStringify(callbackData));
        console.error(`=========================================\n`);
      } else if (isKieSuccess || kieStatus === 'success' || kieStatus === 'completed' || kieStatus === 'complete') {
        // Runway/Veo success (code: 200) OR generic success status
        finalStatus = 'completed';
      } else if (resultUrl) {
        // Has result URL, treat as success
        finalStatus = 'completed';
      }
      
      // If we couldn't determine status, don't process this callback
      if (finalStatus === null) {
        console.warn(`⚠️  Callback for ${generationId} has unclear status (${kieStatus}), ignoring`);
        console.warn(`Full callback data:`, safeStringify(callbackData));
        return res.json({ success: true, message: 'Unclear callback status' });
      }
      
      if (finalStatus === 'completed') {
        if (resultUrl) {
          await storage.finalizeGeneration(generationId, 'success', {
            resultUrl,
          });
          console.log(`✓ Generation ${generationId} completed successfully with URL: ${resultUrl}`);
          
          // Generate thumbnail for video generations (async, don't block callback)
          const generation = await storage.getGeneration(generationId);
          if (generation && generation.type === 'video' && resultUrl) {
            generateThumbnail({
              videoUrl: resultUrl,
              generationId: generationId,
              timestampSeconds: 2,
            }).then(async (result) => {
              await storage.updateGeneration(generationId, {
                thumbnailUrl: result.thumbnailUrl,
              });
              console.log(`✓ Thumbnail generated for ${generationId}: ${result.thumbnailUrl}`);
            }).catch((error) => {
              console.error(`⚠️  Thumbnail generation failed for ${generationId}:`, error.message);
            });
          }
        } else {
          // Success status but no media URL - mark as failed with debugging info
          console.error(`❌ Generation ${generationId} marked complete but no media URL found in callback`);
          console.error(`Full callback data:`, safeStringify(callbackData));
          
          // Finalize as failed so it doesn't stay stuck in processing
          await storage.finalizeGeneration(generationId, 'failure', {
            errorMessage: 'Generation completed but result URL could not be extracted from callback. Please contact support with generation ID.',
          });
          console.log(`✗ Generation ${generationId} marked as failed due to missing result URL`);
        }
      } else if (finalStatus === 'failed') {
        // Extract comprehensive error message from various possible fields
        // Seedance uses data.failMsg and data.failCode
        // Runway/Veo use "msg" field for error descriptions
        const errorMessage = callbackData.data?.failMsg ||  // Seedance error message
                           callbackData.msg ||              // Runway/Veo error message
                           sunoError ||
                           callbackData.errorMessage || 
                           callbackData.error_message ||
                           callbackData.error ||
                           callbackData.message || 
                           callbackData.data?.errorMessage ||
                           callbackData.data?.error_message ||
                           callbackData.data?.error ||
                           callbackData.data?.message ||
                           (callbackData.data?.failCode ? `Error code: ${callbackData.data.failCode}` : null) ||
                           (hasErrorCode ? `Error code: ${hasErrorCode}` : null) ||
                           'Generation failed - error indicated by provider';
        
        await storage.finalizeGeneration(generationId, 'failure', {
          errorMessage: String(errorMessage),
        });
        console.log(`✗ Generation ${generationId} failed: ${errorMessage}`);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Callback processing error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Lyrics Callback Endpoint (no auth - called by Kie.ai)
  app.post('/api/callback/lyrics/:lyricsId', async (req: any, res) => {
    try {
      const { lyricsId } = req.params;
      const callbackData = req.body;
      
      console.log(`\n🔔 ===== RECEIVED LYRICS CALLBACK =====`);
      console.log(`Lyrics ID: ${lyricsId}`);
      console.log(`Callback Data:`, safeStringify(callbackData));
      console.log(`======================================\n`);
      
      // Extract lyrics data from callback
      const lyrics = callbackData.data?.lyrics || callbackData.lyrics;
      const title = callbackData.data?.title || callbackData.title;
      const kieStatus = callbackData.status?.toLowerCase();
      const hasError = callbackData.error || callbackData.errorMessage || callbackData.data?.error;
      
      // Handle intermediate callbacks
      const isProcessing = kieStatus === 'processing' || kieStatus === 'pending' || kieStatus === 'queued';
      if (isProcessing && !hasError && !lyrics) {
        await storage.updateLyricsGeneration(lyricsId, {
          status: 'processing',
        });
        console.log(`⏸️  Intermediate lyrics callback (status: ${kieStatus})`);
        return res.json({ success: true, message: 'Intermediate status updated' });
      }
      
      // Determine final status
      if (hasError || kieStatus === 'failed' || kieStatus === 'error') {
        const errorMessage = hasError || callbackData.message || 'Lyrics generation failed';
        await storage.finalizeLyricsGeneration(lyricsId, 'failure', {
          errorMessage,
        });
        console.log(`✗ Lyrics ${lyricsId} failed: ${errorMessage}`);
      } else if (lyrics || kieStatus === 'success' || kieStatus === 'completed') {
        await storage.finalizeLyricsGeneration(lyricsId, 'success', {
          lyricsText: lyrics,
          lyricsTitle: title,
        });
        console.log(`✓ Lyrics ${lyricsId} completed successfully`);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Lyrics callback processing error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Video Generation
  app.post('/api/generate/video', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Validate request body
      const validationResult = generateVideoRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { model, prompt, generationType, referenceImages, veoSubtype, parameters } = validationResult.data;
      const cost = await getModelCost(model);

      // Atomically deduct credits
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Pre-generate seed for models that support it
      let finalParameters = parameters || {};
      if (modelSupportsSeed(model)) {
        // For Veo: Use seeds array (plural), for others: use seed (singular)
        if (model.startsWith('veo-')) {
          if (!finalParameters.seeds || !Array.isArray(finalParameters.seeds) || finalParameters.seeds.length === 0) {
            finalParameters.seeds = [generateRandomSeed()];
          }
        } else {
          // Seedance, Wan, and other models use singular 'seed'
          if (finalParameters.seed === undefined) {
            finalParameters.seed = generateRandomSeed();
          }
        }
      }

      // Create generation record with image-to-video support and seed
      const generation = await storage.createGeneration({
        userId,
        type: 'video',
        generationType,
        model,
        prompt,
        referenceImages,
        parameters: finalParameters,
        status: 'pending',
        creditsCost: cost,
        seed: model.startsWith('veo-') 
          ? (finalParameters.seeds?.[0] || null) 
          : (finalParameters.seed || null),
      });

      // Start generation in background (fire and forget) with updated parameters including seed
      generateVideoInBackground(
        generation.id, 
        model, 
        prompt, 
        generationType, 
        referenceImages,
        veoSubtype,
        finalParameters
      );

      res.json({ generationId: generation.id, message: "Video generation started" });
    } catch (error: any) {
      console.error('Video generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate video" });
    }
  });

  // Image Generation
  app.post('/api/generate/image', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
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
      
      const cost = await getModelCost(model);

      // Atomically deduct credits
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Pre-generate seed for models that support it
      let finalParameters = parameters || {};
      if (modelSupportsSeed(model)) {
        if (finalParameters.seed === undefined) {
          finalParameters.seed = generateRandomSeed();
        }
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'image',
        model,
        prompt,
        referenceImages,
        parameters: finalParameters,
        status: 'pending',
        creditsCost: cost,
        seed: finalParameters.seed || null,
      });

      // Only pass referenceImages to background processing if mode is editing, with updated parameters including seed
      generateImageInBackground(
        generation.id, 
        model, 
        prompt, 
        mode,
        mode === 'image-editing' ? referenceImages : undefined,
        finalParameters
      );

      res.json({ generationId: generation.id, message: "Image generation started" });
    } catch (error: any) {
      console.error('Image generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate image" });
    }
  });

  // Topaz AI Image Upscaling
  app.post('/api/upscale/image', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validationResult = upscaleImageRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { sourceUrl, upscaleFactor, parentGenerationId } = validationResult.data;
      const cost = await getUpscaleCost('image', upscaleFactor);

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'upscaling',
        processingStage: 'upscale',
        parentGenerationId,
        model: `topaz-image-${upscaleFactor}x`,
        prompt: `Upscale image ${upscaleFactor}x using Topaz AI`,
        parameters: { sourceUrl, upscaleFactor },
        status: 'pending',
        creditsCost: cost,
      });

      // Start upscaling in background
      (async () => {
        try {
          await storage.updateGeneration(generation.id, { status: 'processing' });
          
          const callbackUrl = getCallbackUrl(generation.id);
          const { result, keyName } = await upscaleImage({
            sourceImageUrl: sourceUrl,
            upscaleFactor: parseInt(upscaleFactor) as 2 | 4 | 8,
            callBackUrl: callbackUrl,
          });

          const taskId = result?.taskId || result?.id || result?.task_id;
          if (taskId) {
            await storage.updateGeneration(generation.id, {
              externalTaskId: taskId,
              apiKeyUsed: keyName,
            });
          }
        } catch (error: any) {
          console.error('Image upscale error:', error);
          await storage.finalizeGeneration(generation.id, 'failure', { 
            status: 'failed', 
            errorMessage: error.message 
          });
        }
      })();

      res.json({ generationId: generation.id, message: "Image upscaling started" });
    } catch (error: any) {
      console.error('Image upscale request error:', error);
      res.status(500).json({ message: error.message || "Failed to start image upscaling" });
    }
  });

  // Topaz AI Video Upscaling
  app.post('/api/upscale/video', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validationResult = upscaleVideoRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { sourceUrl, upscaleFactor, parentGenerationId } = validationResult.data;
      const cost = await getUpscaleCost('video', upscaleFactor);

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'upscaling',
        processingStage: 'upscale',
        parentGenerationId,
        model: `topaz-video-${upscaleFactor}x`,
        prompt: `Upscale video ${upscaleFactor}x using Topaz AI`,
        parameters: { sourceUrl, upscaleFactor },
        status: 'pending',
        creditsCost: cost,
      });

      // Start upscaling in background
      (async () => {
        try {
          await storage.updateGeneration(generation.id, { status: 'processing' });
          
          const callbackUrl = getCallbackUrl(generation.id);
          const { result, keyName } = await upscaleVideo({
            sourceVideoUrl: sourceUrl,
            upscaleFactor: parseInt(upscaleFactor) as 2 | 4,
            callBackUrl: callbackUrl,
          });

          const taskId = result?.taskId || result?.id || result?.task_id;
          if (taskId) {
            await storage.updateGeneration(generation.id, {
              externalTaskId: taskId,
              apiKeyUsed: keyName,
            });
          }
        } catch (error: any) {
          console.error('Video upscale error:', error);
          await storage.finalizeGeneration(generation.id, 'failure', { 
            status: 'failed', 
            errorMessage: error.message 
          });
        }
      })();

      res.json({ generationId: generation.id, message: "Video upscaling started" });
    } catch (error: any) {
      console.error('Video upscale request error:', error);
      res.status(500).json({ message: error.message || "Failed to start video upscaling" });
    }
  });

  // Music Generation
  app.post('/api/generate/music', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Validate request body
      const validationResult = generateMusicRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { model, prompt, parameters } = validationResult.data;
      const cost = await getModelCost(model);

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

  // Extend Music
  app.post('/api/generate/extend-music', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validationResult = extendMusicRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { audioUrl, continueAt, continueClipId, model, parameters } = validationResult.data;
      const cost = model ? await getModelCost(model) : await getModelCost('suno-v3.5');

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'music',
        model: model || 'suno-v3.5',
        prompt: 'Music extension',
        parameters: parameters || {},
        status: 'pending',
        creditsCost: cost,
      });

      extendMusicInBackground(generation.id, audioUrl, model, continueAt, continueClipId, parameters || {});

      res.json({ generationId: generation.id, message: "Music extension started" });
    } catch (error: any) {
      console.error('Extend music error:', error);
      res.status(500).json({ message: error.message || "Failed to extend music" });
    }
  });

  // Generate Sound Effects - ElevenLabs Sound Effect V2
  app.post('/api/generate/sound-effects', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validationResult = generateSoundEffectsRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { model, text, loop, duration_seconds, prompt_influence, output_format } = validationResult.data;
      const cost = await getModelCost(model);

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'sound-effects',
        model,
        prompt: text,
        parameters: { loop, duration_seconds, prompt_influence, output_format },
        status: 'pending',
        creditsCost: cost,
      });

      generateSoundEffectsInBackground(generation.id, text, loop, duration_seconds, prompt_influence, output_format, model);

      res.json({ generationId: generation.id, message: "Sound effects generation started" });
    } catch (error: any) {
      console.error('Sound effects generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate sound effects" });
    }
  });

  // Generate Lyrics
  app.post('/api/generate/lyrics', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validationResult = generateLyricsRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { prompt, parameters } = validationResult.data;
      const cost = 5; // Lyrics generation cost

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      const lyricsGeneration = await storage.createLyricsGeneration({
        userId,
        prompt,
        status: 'pending',
        creditsCost: cost,
      });

      generateLyricsInBackground(lyricsGeneration.id, prompt, parameters || {});

      res.json({ lyricsId: lyricsGeneration.id, message: "Lyrics generation started" });
    } catch (error: any) {
      console.error('Lyrics generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate lyrics" });
    }
  });

  // Upload & Cover
  app.post('/api/generate/upload-cover', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validationResult = uploadCoverRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      let { prompt, audioUrl, model, parameters } = validationResult.data;
      const cost = model ? await getModelCost(model) : await getModelCost('suno-v3.5');

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Convert base64 audio to hosted URL if needed
      if (audioUrl.startsWith('data:audio/')) {
        console.log('Converting base64 audio to hosted URL for cover...');
        audioUrl = await saveBase64Audio(audioUrl);
        console.log(`✓ Audio hosted at: ${audioUrl}`);
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'music',
        model: model || 'suno-v3.5',
        prompt,
        parameters: parameters || {},
        status: 'pending',
        creditsCost: cost,
      });

      uploadCoverInBackground(generation.id, prompt, audioUrl, model, parameters || {});

      res.json({ generationId: generation.id, message: "Upload & cover started" });
    } catch (error: any) {
      console.error('Upload cover error:', error);
      res.status(500).json({ message: error.message || "Failed to upload & cover" });
    }
  });

  // Upload & Extend
  app.post('/api/generate/upload-extend', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validationResult = uploadExtendRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      let { prompt, audioUrl, model, parameters } = validationResult.data;
      const cost = model ? await getModelCost(model) : await getModelCost('suno-v3.5');

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Convert base64 audio to hosted URL if needed
      if (audioUrl.startsWith('data:audio/')) {
        console.log('Converting base64 audio to hosted URL for extend...');
        audioUrl = await saveBase64Audio(audioUrl);
        console.log(`✓ Audio hosted at: ${audioUrl}`);
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'music',
        model: model || 'suno-v3.5',
        prompt,
        parameters: parameters || {},
        status: 'pending',
        creditsCost: cost,
      });

      uploadExtendInBackground(generation.id, prompt, audioUrl, model, parameters || {});

      res.json({ generationId: generation.id, message: "Upload & extend started" });
    } catch (error: any) {
      console.error('Upload extend error:', error);
      res.status(500).json({ message: error.message || "Failed to upload & extend" });
    }
  });

  // Get user generations (supports both array and paginated formats)
  app.get('/api/generations', requireJWT, async (req: any, res) => {
    try {
      const isPaginated = req.query.cursor !== undefined;
      console.log('[/api/generations] Request received', {
        userId: req.user?.id,
        hasUser: !!req.user,
        isPaginated,
        cursor: req.query.cursor
      });
      
      // Guard: Check if user exists (session might be cleared after middleware)
      if (!req.user || !req.user) {
        console.log('[/api/generations] No user in request - session likely cleared');
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      console.log(`[/api/generations] Querying database for userId: ${userId}`);
      
      // OPTIMIZATION: Limit to 15 per page, max 30 to prevent abuse, min 1 to prevent negative values
      const limitParam = Number.parseInt(req.query.limit as string);
      const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 15, 1), 30);
      
      // Check if cursor-based pagination is requested
      if (isPaginated) {
        // Parse cursor if provided
        let cursor: { createdAt: Date; id: string } | undefined;
        if (req.query.cursor && req.query.cursor !== '') {
          try {
            const decoded = JSON.parse(Buffer.from(req.query.cursor as string, 'base64').toString());
            cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
          } catch (err) {
            console.error('Invalid cursor:', err);
            return res.status(400).json({ message: "Invalid cursor" });
          }
        }
        
        const startTime = Date.now();
        const { items, nextCursor } = await storage.getUserGenerationsPage(userId, limit, cursor);
        const queryTime = Date.now() - startTime;
        
        console.log(`[/api/generations] Paginated query completed in ${queryTime}ms, found ${items.length} generations, hasMore: ${!!nextCursor}`);
        
        // Apply timeout check
        applyTimeoutCheck(items);
        
        // Encode nextCursor as base64 for frontend
        const encodedCursor = nextCursor 
          ? Buffer.from(JSON.stringify({ createdAt: nextCursor.createdAt.toISOString(), id: nextCursor.id })).toString('base64')
          : null;
        
        return res.json({ items, nextCursor: encodedCursor });
      } else {
        // Legacy array format for backward compatibility
        const startTime = Date.now();
        const generations = await storage.getRecentGenerations(userId, limit);
        const queryTime = Date.now() - startTime;
        
        console.log(`[/api/generations] Array query completed in ${queryTime}ms, found ${generations.length} generations`);
        
        // Apply timeout check
        applyTimeoutCheck(generations);
        
        return res.json(generations);
      }
    } catch (error) {
      console.error('[/api/generations] ERROR:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
      });
      res.status(500).json({ message: "Failed to fetch generations" });
    }
    
    // Helper function to check for timeouts
    function applyTimeoutCheck(items: any[]) {
      const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
      const now = Date.now();
      
      for (const gen of items) {
        if ((gen.status === 'pending' || gen.status === 'processing') && gen.createdAt) {
          const createdTime = new Date(gen.createdAt).getTime();
          const elapsedMs = now - createdTime;
          
          if (elapsedMs > TIMEOUT_MS) {
            console.warn(`⏱️  Generation ${gen.id} appears timed out - will be handled by background cleanup`);
            // Just update in-memory for this response - don't write to DB during request
            gen.status = 'failed';
            gen.errorMessage = `Generation timed out after ${Math.round(elapsedMs / 60000)} minutes. Please try again.`;
            
            // Queue background cleanup (non-blocking)
            setImmediate(async () => {
              try {
                await storage.finalizeGeneration(gen.id, 'failure', {
                  errorMessage: `Generation timed out after ${Math.round(elapsedMs / 60000)} minutes.`,
                });
              } catch (err) {
                console.error('Background timeout cleanup failed:', err);
              }
            });
          }
        }
      }
    }
  });

  // Get single generation by ID
  app.get('/api/generations/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const generation = await storage.getGeneration(id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }

      // Verify the generation belongs to the user
      if (generation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(generation);
    } catch (error) {
      console.error('Error fetching generation:', error);
      res.status(500).json({ message: "Failed to fetch generation" });
    }
  });

  // Download generation file (proxy to avoid CORS issues)
  app.get('/api/generations/:id/download', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify the generation belongs to the user
      const generations = await storage.getUserGenerations(userId);
      const generation = generations.find(g => g.id === id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found or does not belong to you" });
      }

      if (!generation.resultUrl) {
        return res.status(400).json({ message: "Generation does not have a result URL" });
      }

      // Fetch the file from the external URL
      const fileResponse = await axios({
        method: 'GET',
        url: generation.resultUrl,
        responseType: 'stream',
      });

      // Determine file extension and content type based on generation type
      const extensionMap: Record<string, { ext: string; contentType: string }> = {
        video: { ext: 'mp4', contentType: 'video/mp4' },
        image: { ext: 'png', contentType: 'image/png' },
        music: { ext: 'mp3', contentType: 'audio/mpeg' },
        'sound-effects': { ext: 'mp3', contentType: 'audio/mpeg' },
      };

      const fileInfo = extensionMap[generation.type] || { ext: 'bin', contentType: 'application/octet-stream' };
      const filename = `artivio-${generation.type}-${generation.id}.${fileInfo.ext}`;

      // Set response headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', fileInfo.contentType);

      // Stream the file to the client
      fileResponse.data.pipe(res);
    } catch (error: any) {
      console.error('Download proxy error:', error);
      res.status(500).json({ message: error.message || "Failed to download file" });
    }
  });

  // Get recent generations
  app.get('/api/generations/recent', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const generations = await storage.getRecentGenerations(userId, 6);
      res.json(generations);
    } catch (error) {
      console.error('Error fetching recent generations:', error);
      res.status(500).json({ message: "Failed to fetch recent generations" });
    }
  });

  // Cancel/Delete a generation
  app.delete('/api/generations/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // First, verify the generation belongs to the user
      const generations = await storage.getUserGenerations(userId);
      const generation = generations.find(g => g.id === id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found or does not belong to you" });
      }

      // Atomically cancel and refund if still processing
      const result = await storage.cancelGeneration(id);
      
      if (!result) {
        return res.status(500).json({ message: "Failed to cancel generation" });
      }

      // Return success with refund information
      res.json({ 
        success: true, 
        message: result.refunded 
          ? `Generation cancelled and ${result.amount} credits refunded`
          : "Generation cancelled (already completed or no refund needed)",
        refunded: result.refunded,
        amount: result.amount
      });
    } catch (error) {
      console.error('Error cancelling generation:', error);
      res.status(500).json({ message: "Failed to cancel generation" });
    }
  });

  // Get user stats
  app.get('/api/stats', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get user analytics
  app.get('/api/analytics', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const analytics = await storage.getUserAnalytics(userId, days);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ========== SAVED SEEDS ROUTES ==========

  // Get user's saved seeds
  app.get('/api/saved-seeds', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const seeds = await storage.getUserSavedSeeds(userId);
      res.json(seeds);
    } catch (error) {
      console.error('Error fetching saved seeds:', error);
      res.status(500).json({ message: "Failed to fetch saved seeds" });
    }
  });

  // Create a new saved seed
  app.post('/api/saved-seeds', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { insertSavedSeedSchema } = await import("@shared/schema");
      
      const validatedData = insertSavedSeedSchema.parse({
        ...req.body,
        userId,
      });

      const seed = await storage.createSavedSeed(validatedData);
      res.json(seed);
    } catch (error: any) {
      console.error('Error creating saved seed:', error);
      res.status(400).json({ message: error.message || "Failed to create saved seed" });
    }
  });

  // Update a saved seed
  app.patch('/api/saved-seeds/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { updateSavedSeedSchema } = await import("@shared/schema");

      // Verify the seed belongs to the user
      const existingSeed = await storage.getSavedSeed(id);
      if (!existingSeed) {
        return res.status(404).json({ message: "Saved seed not found" });
      }
      if (existingSeed.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = updateSavedSeedSchema.parse(req.body);
      const updated = await storage.updateSavedSeed(id, validatedData);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating saved seed:', error);
      res.status(400).json({ message: error.message || "Failed to update saved seed" });
    }
  });

  // Delete a saved seed
  app.delete('/api/saved-seeds/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify the seed belongs to the user
      const existingSeed = await storage.getSavedSeed(id);
      if (!existingSeed) {
        return res.status(404).json({ message: "Saved seed not found" });
      }
      if (existingSeed.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteSavedSeed(id);
      res.json({ success: true, message: "Saved seed deleted" });
    } catch (error) {
      console.error('Error deleting saved seed:', error);
      res.status(500).json({ message: "Failed to delete saved seed" });
    }
  });

  // ========== FAVORITE WORKFLOW ROUTES ==========

  // Get user's favorite workflows
  app.get('/api/favorites', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const favorites = await storage.getUserFavoriteWorkflows(userId);
      res.json(favorites);
    } catch (error) {
      console.error('Error fetching favorite workflows:', error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Add workflow to favorites
  app.post('/api/favorites', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { workflowId, workflowTitle } = req.body;

      if (!workflowId || !workflowTitle) {
        return res.status(400).json({ message: "workflowId and workflowTitle are required" });
      }

      const favorite = await storage.addFavoriteWorkflow(userId, workflowId, workflowTitle);
      res.json(favorite);
    } catch (error) {
      console.error('Error adding favorite workflow:', error);
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  // Remove workflow from favorites
  app.delete('/api/favorites/:workflowId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const workflowId = parseInt(req.params.workflowId);

      if (isNaN(workflowId)) {
        return res.status(400).json({ message: "Invalid workflowId" });
      }

      await storage.removeFavoriteWorkflow(userId, workflowId);
      res.json({ success: true, message: "Favorite removed successfully" });
    } catch (error) {
      console.error('Error removing favorite workflow:', error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  // Check if workflow is favorited
  app.get('/api/favorites/:workflowId/check', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const workflowId = parseInt(req.params.workflowId);

      if (isNaN(workflowId)) {
        return res.status(400).json({ message: "Invalid workflowId" });
      }

      const isFavorite = await storage.isFavoriteWorkflow(userId, workflowId);
      res.json({ isFavorite });
    } catch (error) {
      console.error('Error checking favorite status:', error);
      res.status(500).json({ message: "Failed to check favorite status" });
    }
  });

  // ========== REFERRAL ROUTES ==========

  // Get user's referral code
  app.get('/api/referral/code', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const code = await storage.getUserReferralCode(userId);
      res.json({ code });
    } catch (error) {
      console.error('Error getting referral code:', error);
      res.status(500).json({ message: "Failed to get referral code" });
    }
  });

  // Get user's referral statistics
  app.get('/api/referral/stats', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error getting referral stats:', error);
      res.status(500).json({ message: "Failed to get referral stats" });
    }
  });

  // Get referral leaderboard
  app.get('/api/referral/leaderboard', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const leaderboard = await storage.getReferralLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      console.error('Error getting referral leaderboard:', error);
      res.status(500).json({ message: "Failed to get referral leaderboard" });
    }
  });

  // Track referral click (public endpoint for when someone clicks a referral link)
  app.post('/api/public/referral/track', async (req, res) => {
    try {
      const { referralCode, email } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ message: "Referral code is required" });
      }

      const referral = await storage.createReferralClick(referralCode, email);
      res.json({ success: true, referralId: referral.id });
    } catch (error: any) {
      console.error('Error tracking referral:', error);
      // Return success even if tracking fails to not break user flow
      res.status(200).json({ success: false, message: error.message || "Failed to track referral" });
    }
  });

  // ========== GENERATION TEMPLATE ROUTES ==========

  // Get user templates (optionally filtered by feature type)
  app.get('/api/templates', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const featureType = req.query.featureType as string | undefined;
      const templates = await storage.getUserTemplates(userId, featureType);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Get public templates (optionally filtered by feature type)
  app.get('/api/templates/public', async (req, res) => {
    try {
      const featureType = req.query.featureType as string | undefined;
      const templates = await storage.getPublicTemplates(featureType);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching public templates:', error);
      res.status(500).json({ message: "Failed to fetch public templates" });
    }
  });

  // Get specific template
  app.get('/api/templates/:id', requireJWT, async (req: any, res) => {
    try {
      const { id } = req.params;
      const template = await storage.getTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check if user owns the template or it's public
      const userId = req.user.id;
      if (template.userId !== userId && !template.isPublic) {
        return res.status(403).json({ message: "Unauthorized access to template" });
      }

      res.json(template);
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  // Create new template
  app.post('/api/templates', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, description, prompt, model, parameters, featureType, isPublic } = req.body;

      if (!name || !prompt || !featureType) {
        return res.status(400).json({ message: "Name, prompt, and featureType are required" });
      }

      const template = await storage.createTemplate({
        userId,
        name,
        description,
        prompt,
        model,
        parameters,
        featureType,
        isPublic: isPublic || false,
      });

      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Update template
  app.patch('/api/templates/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify ownership
      const existing = await storage.getTemplate(id);
      if (!existing) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized to update this template" });
      }

      const { name, description, prompt, model, parameters, isPublic } = req.body;
      const updated = await storage.updateTemplate(id, {
        name,
        description,
        prompt,
        model,
        parameters,
        isPublic,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  // Delete template
  app.delete('/api/templates/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify ownership
      const existing = await storage.getTemplate(id);
      if (!existing) {
        return res.status(404).json({ message: "Template not found" });
      }
      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized to delete this template" });
      }

      await storage.deleteTemplate(id);
      res.json({ success: true, message: "Template deleted successfully" });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Increment template usage count
  app.post('/api/templates/:id/use', requireJWT, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.incrementTemplateUsage(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error incrementing template usage:', error);
      res.status(500).json({ message: "Failed to increment template usage" });
    }
  });

  // ========== ONBOARDING ROUTES ==========

  // Get or create onboarding progress
  app.get('/api/onboarding', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const onboarding = await storage.getOrCreateOnboarding(userId);
      res.json(onboarding);
    } catch (error) {
      console.error('Error fetching onboarding:', error);
      res.status(500).json({ message: "Failed to fetch onboarding progress" });
    }
  });

  // Update onboarding progress
  app.patch('/api/onboarding', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Validate request body with zod schema
      const { updateUserOnboardingSchema } = await import('@shared/schema');
      const validationResult = updateUserOnboardingSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }
      
      // Ensure onboarding record exists before updating
      await storage.getOrCreateOnboarding(userId);
      
      const onboarding = await storage.updateOnboarding(userId, validationResult.data);
      
      if (!onboarding) {
        return res.status(404).json({ message: "Failed to update onboarding" });
      }
      
      res.json(onboarding);
    } catch (error) {
      console.error('Error updating onboarding:', error);
      res.status(500).json({ message: "Failed to update onboarding progress" });
    }
  });

  // ========== CHAT ROUTES ==========

  // Get user conversations
  app.get('/api/chat/conversations', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get conversation messages
  app.get('/api/chat/conversations/:conversationId', requireJWT, async (req: any, res) => {
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
  app.post('/api/chat/send', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

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
      const cost = await chatService.getCreditCost(model);

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
  app.delete('/api/chat/conversations/:conversationId', requireJWT, async (req: any, res) => {
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
  app.patch('/api/chat/conversations/:conversationId/title', requireJWT, async (req: any, res) => {
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
  app.post('/api/voice-clone', requireJWT, async (req: any, res) => {
    // Feature gate: ElevenLabs Voice Cloning API not available through Kie.ai
    return res.status(503).json({
      message: "Voice Cloning service is temporarily unavailable. This feature requires ElevenLabs API integration which is not currently supported through our provider. Please check back later or contact support for alternatives.",
      error: "SERVICE_UNAVAILABLE",
      feature: "voice-cloning"
    });
    
    let hostedAudioUrls: string[] | undefined;
    
    try {
      const userId = req.user.id;

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
        console.log(`Calling Kie.ai voice clone API with name: ${name}, files: ${hostedAudioUrls.length}`);
        const { result, keyName } = await cloneVoice({
          name,
          description,
          audioFiles: hostedAudioUrls,
        });
        console.log(`Kie.ai voice clone response:`, safeStringify(result));

        // Extract voice ID from result
        const voiceId = result?.data?.voiceId || result?.voiceId || result?.id;
        if (!voiceId) {
          console.error('Voice cloning failed - no voice ID in result:', result);
          throw new Error('Voice cloning failed - no voice ID returned from ElevenLabs. Please try again.');
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
        // Log full error details for debugging
        console.error('Voice cloning inner error:', {
          message: error.message,
          stack: error.stack,
          response: error.response?.data,
          status: error.response?.status
        });
        
        // Refund credits atomically if voice cloning failed
        const currentUser = await storage.getUser(userId);
        if (currentUser) {
          await storage.updateUserCredits(userId, currentUser.credits + cost);
          console.log(`Refunded ${cost} credits to user ${userId}`);
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Voice cloning outer error:', error);
      const errorMessage = error.message || error.response?.data?.message || error.response?.data?.error || "Voice cloning failed. Please check your audio files and try again.";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Get user's cloned voices
  app.get('/api/voice-clones', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const voices = await storage.getUserVoiceClones(userId);
      res.json(voices);
    } catch (error) {
      console.error('Error fetching voice clones:', error);
      res.status(500).json({ message: "Failed to fetch voice clones" });
    }
  });

  // Toggle voice clone active status
  app.patch('/api/voice-clones/:voiceId/toggle', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
  app.delete('/api/voice-clones/:voiceId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
  app.post('/api/tts/generate', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Validate request
      const validationResult = generateTTSRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { text, voiceId, voiceName, model, parameters } = validationResult.data;
      const cost = await getModelCost(model);

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create generation record (use generations table, not ttsGenerations)
      const generation = await storage.createGeneration({
        userId,
        type: 'text-to-speech',
        model,
        prompt: text,
        parameters: { voiceId, voiceName, ...parameters },
        status: 'pending',
        creditsCost: cost,
      });

      // Generate TTS in background with webhook callbacks
      generateTTSInBackground(generation.id, text, voiceId, voiceName, model, parameters);

      res.json({ 
        success: true, 
        generationId: generation.id,
        message: "TTS generation started" 
      });
    } catch (error: any) {
      console.error('TTS generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate TTS" });
    }
  });

  // Get user's TTS generations
  app.get('/api/tts/generations', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const generations = await storage.getUserTtsGenerations(userId);
      res.json(generations);
    } catch (error) {
      console.error('Error fetching TTS generations:', error);
      res.status(500).json({ message: "Failed to fetch TTS generations" });
    }
  });

  // ========== SPEECH-TO-TEXT ROUTES ==========

  // Transcribe audio (STT) - SYNCHRONOUS processing
  app.post('/api/stt/transcribe', requireJWT, async (req: any, res) => {
    // Feature gate: ElevenLabs Speech-to-Text API not available through Kie.ai
    return res.status(503).json({
      message: "Speech-to-Text service is temporarily unavailable. This feature requires ElevenLabs API integration which is not currently supported through our provider. Please check back later or contact support for alternatives.",
      error: "SERVICE_UNAVAILABLE",
      feature: "speech-to-text"
    });
    
    let hostedAudioUrl: string[] | undefined;
    let sttGeneration: any = undefined; // Hoist to outer scope for error handling
    
    try {
      const userId = req.user.id;

      // Validate request
      const validationResult = generateSTTRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { audioFile, model, language, parameters } = validationResult.data;
      const cost = await getModelCost(model);

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
  app.get('/api/stt/transcriptions', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const transcriptions = await storage.getUserSttGenerations(userId);
      res.json(transcriptions);
    } catch (error) {
      console.error('Error fetching STT transcriptions:', error);
      res.status(500).json({ message: "Failed to fetch transcriptions" });
    }
  });

  // ========== AI TALKING AVATAR ROUTES ==========

  // Generate talking avatar
  app.post('/api/avatar/generate', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const validationResult = generateAvatarRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: validationResult.error.errors });
      }

      const { sourceImage, script, voiceId, provider, parameters } = validationResult.data;
      const cost = await getModelCost(provider);

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
              parameters: parameters || undefined,
              callBackUrl: callbackUrl,
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
  app.get('/api/avatar/generations', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const avatars = await storage.getUserAvatarGenerations(userId);
      res.json(avatars);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch avatar generations" });
    }
  });

  // ========== AUDIO CONVERSION ROUTES ==========

  // Convert audio
  app.post('/api/audio/convert', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const validationResult = convertAudioRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid request", errors: validationResult.error.errors });
      }

      const { sourceAudio, sourceFormat, operation, parameters } = validationResult.data;
      const cost = await getModelCost(operation);

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
              parameters: parameters || undefined,
              callBackUrl: callbackUrl,
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
  app.get('/api/audio/conversions', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversions = await storage.getUserAudioConversions(userId);
      res.json(conversions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversions" });
    }
  });

  // ========== ADMIN ROUTES ==========

  // Admin: Get all users
  app.get('/api/admin/users', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const usersWithSubscriptions = await storage.getUsersWithSubscriptions();
      res.json(usersWithSubscriptions);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Update user credits
  app.patch('/api/admin/users/:userId/credits', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
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
  app.delete('/api/admin/users/:userId', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
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
  app.get('/api/admin/api-keys', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
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
  app.post('/api/admin/api-keys', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { keyName, keyValue } = req.body;
      
      if (!keyValue || keyValue.trim().length === 0) {
        return res.status(400).json({ message: "API key value is required" });
      }
      
      const key = await storage.addApiKey({ keyName, keyValue, isActive: true });
      res.json(key);
    } catch (error) {
      console.error('Error adding API key:', error);
      res.status(500).json({ message: "Failed to add API key" });
    }
  });

  // Admin: Toggle API key status
  app.patch('/api/admin/api-keys/:keyId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
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

  // Admin: Delete API key
  app.delete('/api/admin/api-keys/:keyId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { keyId } = req.params;
      await storage.deleteApiKey(keyId);
      res.json({ message: "API key deleted successfully" });
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // Admin: Get analytics dashboard data
  app.get('/api/admin/analytics', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const [users, generations] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllGenerations(),
      ]);

      const totalUsers = users.length;
      const totalCreditsSpent = generations.reduce((sum, g) => sum + (g.creditsCost || 0), 0);
      const totalGenerations = generations.length;

      const featureStats = generations.reduce((acc: any, g) => {
        const type = g.type || 'unknown';
        if (!acc[type]) acc[type] = { count: 0, credits: 0 };
        acc[type].count += 1;
        acc[type].credits += g.creditsCost || 0;
        return acc;
      }, {});

      const popularFeatures = Object.entries(featureStats)
        .map(([type, stats]: [string, any]) => ({
          feature: type,
          count: stats.count,
          credits: stats.credits,
        }))
        .sort((a, b) => b.count - a.count);

      res.json({
        totalUsers,
        totalCreditsSpent,
        totalGenerations,
        popularFeatures,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Admin Pricing Management Routes
  // Public: Get all pricing configurations (for frontend display)
  app.get('/api/pricing', async (req, res) => {
    try {
      const pricingList = await storage.getAllPricing();
      res.json(pricingList);
    } catch (error: any) {
      console.error('Error fetching pricing:', error);
      res.status(500).json({ message: "Failed to fetch pricing" });
    }
  });

  app.get('/api/admin/pricing', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const pricing = await storage.getAllPricing();
      res.json(pricing);
    } catch (error) {
      console.error('Error fetching pricing:', error);
      res.status(500).json({ message: "Failed to fetch pricing" });
    }
  });

  app.patch('/api/admin/pricing/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { id } = req.params;
      const updates = req.body;

      const { updatePricingSchema } = await import("@shared/schema");
      const validatedUpdates = updatePricingSchema.parse(updates);

      const updated = await storage.updatePricing(id, validatedUpdates);
      if (!updated) {
        return res.status(404).json({ message: 'Pricing entry not found' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating pricing:', error);
      res.status(400).json({ message: 'Failed to update pricing', error: error.message });
    }
  });

  app.post('/api/admin/pricing', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { insertPricingSchema } = await import("@shared/schema");
      const validatedData = insertPricingSchema.parse(req.body);

      const newPricing = await storage.createPricing(validatedData);
      res.status(201).json(newPricing);
    } catch (error: any) {
      console.error('Error creating pricing:', error);
      res.status(400).json({ message: 'Failed to create pricing', error: error.message });
    }
  });

  // ========== PLAN ECONOMICS ROUTES ==========
  
  // Admin: Get plan economics settings
  app.get('/api/admin/plan-economics', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const economics = await storage.getPlanEconomics();
      // If no economics exist yet, return defaults
      if (!economics) {
        return res.json({
          kiePurchaseAmount: 50,
          kieCreditAmount: 10000,
          userCreditAmount: 15000,
          profitMargin: 50,
        });
      }
      
      res.json(economics);
    } catch (error) {
      console.error('Error fetching plan economics:', error);
      res.status(500).json({ message: "Failed to fetch plan economics" });
    }
  });

  // Admin: Update plan economics settings
  app.patch('/api/admin/plan-economics', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { updatePlanEconomicsSchema } = await import("@shared/schema");
      const validatedData = updatePlanEconomicsSchema.parse(req.body);

      const updated = await storage.upsertPlanEconomics(validatedData);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating plan economics:', error);
      res.status(400).json({ message: 'Failed to update plan economics', error: error.message });
    }
  });

  // ========== SUBSCRIPTION PLAN ROUTES ==========

  // Admin: Get all subscription plans
  app.get('/api/admin/plans', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const plans = await storage.getAllPlans();
      res.json(plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  // Admin: Update user subscription (assign plan)
  app.patch('/api/admin/users/:userId/subscription', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { userId } = req.params;
      const { planId } = req.body;

      console.log(`[ADMIN] Updating subscription for user ${userId} to plan ${planId}`);

      // If planId is null, remove subscription
      if (!planId || planId === 'none') {
        await storage.removeUserSubscription(userId);
        console.log(`[ADMIN] ✓ Removed subscription for user ${userId}`);
        return res.json({ message: "Subscription removed successfully" });
      }

      // Use atomic transaction to assign plan and grant credits
      const result = await storage.assignPlanToUser(userId, planId);

      console.log(`[ADMIN] ✓ Assigned plan ${planId} to user ${userId}, granted ${result.creditsGranted} credits`);

      res.json({
        ...result.subscription,
        creditsGranted: result.creditsGranted,
      });
    } catch (error: any) {
      console.error('[ADMIN] Error updating user subscription:', error);
      console.error('[ADMIN] Error details:', {
        userId: req.params.userId,
        planId: req.body.planId,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      res.status(500).json({ 
        message: "Failed to update subscription",
        error: error.message // Include error message for debugging
      });
    }
  });

  // Admin: Create new plan
  app.post('/api/admin/plans', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { name, displayName, description, price, creditsPerMonth, billingPeriod, features, sortOrder } = req.body;

      // Validate required fields
      if (!name || !displayName || price === undefined || creditsPerMonth === undefined) {
        return res.status(400).json({ message: "Missing required fields: name, displayName, price, creditsPerMonth" });
      }

      // Validate price is a number in cents
      if (typeof price !== 'number' || price < 0) {
        return res.status(400).json({ message: "Price must be a positive number (in cents)" });
      }

      // Validate creditsPerMonth
      if (typeof creditsPerMonth !== 'number' || creditsPerMonth < 0) {
        return res.status(400).json({ message: "Credits per month must be a positive number" });
      }

      const created = await storage.createPlan({
        name,
        displayName,
        description: description || null,
        price,
        creditsPerMonth,
        billingPeriod: billingPeriod || 'monthly',
        features: features || null,
        sortOrder: sortOrder ?? 0,
        isActive: true,
      });

      res.json(created);
    } catch (error: any) {
      console.error('Error creating plan:', error);
      if (error.code === '23505') {
        return res.status(400).json({ message: "Plan name already exists" });
      }
      res.status(500).json({ message: "Failed to create plan" });
    }
  });

  // Admin: Update plan (all fields)
  app.patch('/api/admin/plans/:planId', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { planId } = req.params;
      const updates: Partial<InsertSubscriptionPlan> = {};

      // Allow updating any field
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.displayName !== undefined) updates.displayName = req.body.displayName;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.price !== undefined) {
        if (typeof req.body.price !== 'number' || req.body.price < 0) {
          return res.status(400).json({ message: "Price must be a positive number (in cents)" });
        }
        updates.price = req.body.price;
      }
      if (req.body.creditsPerMonth !== undefined) {
        if (typeof req.body.creditsPerMonth !== 'number' || req.body.creditsPerMonth < 0) {
          return res.status(400).json({ message: "Credits per month must be a positive number" });
        }
        updates.creditsPerMonth = req.body.creditsPerMonth;
      }
      if (req.body.billingPeriod !== undefined) updates.billingPeriod = req.body.billingPeriod;
      if (req.body.features !== undefined) updates.features = req.body.features;
      if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;
      if (req.body.stripePriceId !== undefined) updates.stripePriceId = req.body.stripePriceId || null;
      if (req.body.stripeProductId !== undefined) updates.stripeProductId = req.body.stripeProductId || null;

      const updated = await storage.updatePlan(planId, updates);

      if (!updated) {
        return res.status(404).json({ message: "Plan not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating plan:', error);
      if (error.code === '23505') {
        return res.status(400).json({ message: "Plan name already exists" });
      }
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  // Admin: Delete plan
  app.delete('/api/admin/plans/:planId', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { planId } = req.params;

      const result = await storage.deletePlan(planId);

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({ message: "Plan deleted successfully" });
    } catch (error) {
      console.error('Error deleting plan:', error);
      res.status(500).json({ message: "Failed to delete plan" });
    }
  });

  // Admin: Reorder plan (move up or down)
  app.patch('/api/admin/plans/:planId/reorder', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { planId } = req.params;
      const { direction } = req.body; // 'up' or 'down'

      if (!direction || !['up', 'down'].includes(direction)) {
        return res.status(400).json({ message: "Invalid direction. Must be 'up' or 'down'" });
      }

      // Get all plans sorted by sortOrder
      const allPlans = await storage.getAllPlans();
      const currentIndex = allPlans.findIndex(p => p.id === planId);

      if (currentIndex === -1) {
        return res.status(404).json({ message: "Plan not found" });
      }

      // Determine the index to swap with
      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      // Check bounds
      if (swapIndex < 0 || swapIndex >= allPlans.length) {
        return res.status(400).json({ message: `Cannot move ${direction}. Already at the ${direction === 'up' ? 'top' : 'bottom'}` });
      }

      const currentPlan = allPlans[currentIndex];
      const swapPlan = allPlans[swapIndex];

      // Swap sortOrder values
      const tempSortOrder = currentPlan.sortOrder;
      await storage.updatePlan(currentPlan.id, { sortOrder: swapPlan.sortOrder });
      await storage.updatePlan(swapPlan.id, { sortOrder: tempSortOrder });

      // Return updated plans list
      const updatedPlans = await storage.getAllPlans();
      res.json(updatedPlans);
    } catch (error) {
      console.error('Error reordering plan:', error);
      res.status(500).json({ message: "Failed to reorder plan" });
    }
  });

  // Admin: Update plan Stripe IDs
  app.patch('/api/admin/plans/:planId/stripe', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { planId } = req.params;
      const { stripePriceId, stripeProductId } = req.body;

      const updated = await storage.updatePlanStripeIds(
        planId,
        stripePriceId || null,
        stripeProductId || null
      );

      if (!updated) {
        return res.status(404).json({ message: "Plan not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating plan Stripe IDs:', error);
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  // ========== HOME PAGE CONTENT ROUTES ==========

  // Public: Get home page content
  app.get('/api/homepage', async (req, res) => {
    try {
      const content = await storage.getHomePageContent();
      
      if (!content) {
        // Return default content if nothing is configured
        return res.json({
          heroTitle: 'Create any video you can imagine',
          heroSubtitle: 'Generate stunning videos, images, and music with powerful AI models',
          heroVideoUrl: null,
          heroImageUrl: null,
          showcaseVideos: [],
          creatorsTitle: 'Creators',
          creatorsDescription: null,
          creatorsImageUrl: null,
          businessTitle: 'Businesses',
          businessDescription: null,
          businessImageUrl: null,
          faqs: [],
        });
      }
      
      res.json(content);
    } catch (error) {
      console.error('Error fetching home page content:', error);
      res.status(500).json({ message: "Failed to fetch home page content" });
    }
  });

  // Admin: Get home page content
  app.get('/api/admin/homepage', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const content = await storage.getHomePageContent();
      res.json(content);
    } catch (error) {
      console.error('Error fetching home page content:', error);
      res.status(500).json({ message: "Failed to fetch home page content" });
    }
  });

  // Admin: Update home page content
  app.patch('/api/admin/homepage', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.updateHomePageContent(req.body);
      
      if (!updated) {
        return res.status(500).json({ message: "Failed to update home page content" });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating home page content:', error);
      res.status(500).json({ message: "Failed to update home page content" });
    }
  });

  // ========== ANNOUNCEMENT ROUTES ==========

  // Get active announcements for current user
  app.get('/api/announcements/active', async (req: any, res) => {
    try {
      // Get user's plan if authenticated
      let userPlanName: string | undefined = undefined;
      if (req.requireJWT && req.requireJWT()) {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        if (user) {
          const subscription = await storage.getUserSubscription(userId);
          userPlanName = subscription?.plan.name;
        }
      }

      const announcements = await storage.getActiveAnnouncements(userPlanName);
      res.json(announcements);
    } catch (error) {
      console.error('Error fetching active announcements:', error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  // Admin: Get all announcements
  app.get('/api/admin/announcements', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const announcements = await storage.getAllAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  // Admin: Create announcement
  app.post('/api/admin/announcements', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate and sanitize input
      const validatedData = createAnnouncementSchema.parse(req.body);
      const { message, type, targetPlans, startDate, endDate } = validatedData;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ message: "Announcement message is required" });
      }

      const announcement = await storage.createAnnouncement({
        message: message.trim(),
        type: type || 'info',
        targetPlans: targetPlans || null,
        isActive: true,
        startDate: startDate || null,
        endDate: endDate || null,
        createdBy: userId,
      });

      res.json(announcement);
    } catch (error) {
      console.error('Error creating announcement:', error);
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  // Admin: Update announcement
  app.patch('/api/admin/announcements/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { id } = req.params;
      
      // Validate and sanitize input
      const validatedData = updateAnnouncementSchema.parse(req.body);
      const announcement = await storage.updateAnnouncement(id, validatedData);

      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      res.json(announcement);
    } catch (error) {
      console.error('Error updating announcement:', error);
      res.status(500).json({ message: "Failed to update announcement" });
    }
  });

  // Admin: Delete announcement
  app.delete('/api/admin/announcements/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { id } = req.params;
      await storage.deleteAnnouncement(id);
      res.json({ message: "Announcement deleted successfully" });
    } catch (error) {
      console.error('Error deleting announcement:', error);
      res.status(500).json({ message: "Failed to delete announcement" });
    }
  });

  // ========== LOOPS.SO EMAIL INTEGRATION ==========

  // Admin: Get all Loops.so mailing lists
  app.get('/api/admin/loops/lists', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const lists = await LoopsService.getMailingLists();
      res.json({ lists });
    } catch (error) {
      console.error('Error fetching Loops.so mailing lists:', error);
      res.status(500).json({ message: "Failed to fetch mailing lists" });
    }
  });

  // Admin: Test adding a contact to the 7-day funnel
  app.post('/api/admin/loops/test', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate request body with Zod
      const validationResult = loopsTestContactRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { email, firstName, lastName } = validationResult.data;

      const result = await LoopsService.addToSevenDayFunnel(
        email,
        firstName,
        lastName,
        userId
      );

      res.json(result);
    } catch (error) {
      logger.error('LOOPS', 'Failed to test Loops.so integration', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ message: "Failed to test Loops.so integration" });
    }
  });

  // ========== IMAGE ANALYSIS ROUTES ==========

  // Analyze image - SYNCHRONOUS processing
  app.post('/api/image-analysis/analyze', requireJWT, async (req: any, res) => {
    let imageAnalysis: any = undefined;
    let creditsDeducted = false;
    
    try {
      const userId = req.user.id;
      console.log(`[Image Analysis] Request received from user ${userId}`);
      console.log(`[Image Analysis] Request body keys:`, Object.keys(req.body));

      // Validate request
      const validationResult = analyzeImageRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { image, prompt, model, idempotencyKey } = validationResult.data;
      
      // Check for existing analysis with this idempotency key (prevents double-charging on retries)
      const existingAnalysis = await storage.getImageAnalysisByIdempotencyKey(userId, idempotencyKey);
      if (existingAnalysis) {
        console.log(`Idempotent request detected - returning existing analysis ${existingAnalysis.id}`);
        return res.json({
          success: true,
          analysisId: existingAnalysis.id,
          analysis: typeof existingAnalysis.analysisResult === 'object' 
            ? (existingAnalysis.analysisResult as any)?.text 
            : existingAnalysis.analysisResult,
          message: existingAnalysis.status === 'completed' 
            ? "Image analyzed successfully" 
            : "Analysis in progress",
          cached: true,
        });
      }
      
      // Backend validation of base64 image
      if (!image || !image.startsWith('data:image/')) {
        return res.status(400).json({ message: "Invalid image format - must be base64 data URI" });
      }

      // Extract and validate image size (base64 is ~33% larger than binary)
      const base64Data = image.split(',')[1] || image;
      const imageSize = (base64Data.length * 3) / 4; // Approximate binary size
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (imageSize > maxSize) {
        return res.status(400).json({ message: "Image too large - maximum 10MB" });
      }

      // Validate mime type
      const mimeMatch = image.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,/);
      if (!mimeMatch) {
        return res.status(400).json({ message: "Unsupported image format - use JPEG, PNG, GIF, or WebP" });
      }

      const cost = await getModelCost(model || 'gpt-4o');

      // Check credits without deducting yet
      const user = await storage.getUser(userId);
      if (!user || user.credits < cost) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Convert base64 image to hosted URL
        console.log('Converting image to hosted URL for analysis...');
        const hostedImageUrl = await saveBase64Images([image]);
        const imageUrl = hostedImageUrl[0];
        console.log(`✓ Image hosted at: ${imageUrl}`);

        // Deduct credits atomically AFTER validation
        const updatedUser = await storage.deductCreditsAtomic(userId, cost);
        if (!updatedUser) {
          return res.status(400).json({ message: "Insufficient credits" });
        }
        creditsDeducted = true;

        // Create image analysis record with idempotency key
        imageAnalysis = await storage.createImageAnalysis({
          userId,
          idempotencyKey,
          imageUrl,
          analysisPrompt: prompt || null,
          analysisResult: null,
          model: model || 'gpt-4o',
          provider: 'openai', // OpenAI used because Kie.ai doesn't support vision analysis
          errorMessage: null,
          creditsCost: cost,
        });

        // Analyze image SYNCHRONOUSLY using OpenAI Vision API
        const { analysis, model: usedModel } = await analyzeImageWithVision({
          imageUrl,
          prompt,
          model,
        });

        // Update with completed analysis
        await storage.updateImageAnalysis(imageAnalysis.id, {
          status: 'completed',
          analysisResult: { text: analysis },
          apiKeyUsed: 'openai-' + usedModel,
          completedAt: new Date(),
        });

        // Return success with analysis immediately
        return res.json({ 
          success: true, 
          analysisId: imageAnalysis.id,
          analysis,
          message: "Image analyzed successfully" 
        });
      } catch (error: any) {
        console.error('Image analysis processing error:', error);
        
        // Attempt to refund credits if they were deducted
        if (creditsDeducted) {
          try {
            await storage.addCreditsAtomic(userId, cost);
            console.log(`✓ Refunded ${cost} credits to user ${userId}`);
          } catch (refundError: any) {
            console.error('CRITICAL: Failed to refund credits after analysis failure:', refundError);
            // Log for manual intervention but continue with error handling
          }
        }

        // Update analysis record with failure (if record was created)
        if (imageAnalysis) {
          try {
            await storage.updateImageAnalysis(imageAnalysis.id, {
              status: 'failed',
              errorMessage: error.message || 'Image analysis failed',
              completedAt: new Date(),
            });
          } catch (updateError: any) {
            console.error('Failed to update analysis record with failure status:', updateError);
          }
        }

        throw error;
      }
    } catch (error: any) {
      console.error('Image analysis error:', error);
      res.status(500).json({ message: error.message || "Failed to analyze image" });
    }
  });

  // Get user's image analyses
  app.get('/api/image-analysis/results', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const analyses = await storage.getUserImageAnalyses(userId);
      res.json(analyses);
    } catch (error) {
      console.error('Error fetching image analyses:', error);
      res.status(500).json({ message: "Failed to fetch image analyses" });
    }
  });

  // ==================== VIDEO COMBINATION ROUTES ====================

  // Combine multiple videos into one
  app.post('/api/combine-videos', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Validate request
      const validationResult = combineVideosRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request",
          errors: validationResult.error.errors
        });
      }

      const { videoIds, enhancements } = validationResult.data;

      // Fetch source videos from generations table
      const sourceVideos = await Promise.all(
        videoIds.map(id => storage.getUserGenerations(userId).then(gens => gens.find(g => g.id === id)))
      );

      // Validate all videos exist, belong to user, and are completed
      const missingVideos: string[] = [];
      const notCompletedVideos: string[] = [];
      const videoUrls: string[] = [];

      for (let i = 0; i < videoIds.length; i++) {
        const video = sourceVideos[i];
        if (!video) {
          missingVideos.push(videoIds[i]);
        } else if (video.status !== 'completed' || !video.resultUrl) {
          notCompletedVideos.push(videoIds[i]);
        } else if (video.type !== 'video') {
          return res.status(400).json({ message: `Generation ${videoIds[i]} is not a video` });
        } else {
          videoUrls.push(video.resultUrl);
        }
      }

      if (missingVideos.length > 0) {
        return res.status(404).json({
          message: "Some videos not found",
          missingIds: missingVideos
        });
      }

      if (notCompletedVideos.length > 0) {
        return res.status(400).json({
          message: "Some videos are not completed yet",
          notCompletedIds: notCompletedVideos
        });
      }

      // Calculate pricing with enhancements
      let cost = await getModelCost('video-combiner'); // Base cost: 75 credits

      // Calculate enhancement costs
      const hasTransitions = enhancements?.transitions?.mode === 'crossfade';
      const hasBackgroundMusic = !!enhancements?.backgroundMusic;
      const hasTextOverlays = (enhancements?.textOverlays?.length || 0) > 0;
      const hasSpeedAdjustment = enhancements?.speed?.mode !== 'none' && enhancements?.speed?.mode !== undefined;

      // Add surcharges for enhancements (Quick Polish Pack pricing)
      if (hasTransitions) cost += 25; // Crossfade transitions
      if (hasBackgroundMusic) cost += 25; // Background music
      if (hasTextOverlays) cost += 30; // Text overlays
      if (hasSpeedAdjustment) cost += 20; // Speed control

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create combination record with enhancements
      const combination = await storage.createVideoCombination({
        userId,
        sourceVideoIds: videoIds,
        status: 'pending',
        creditsCost: cost,
        enhancements: enhancements || {},
        hasTransitions,
        hasBackgroundMusic,
        hasTextOverlays,
        hasSpeedAdjustment,
      });

      // Log event
      await storage.createVideoCombinationEvent({
        combinationId: combination.id,
        eventType: 'status_change',
        message: 'Combination job created',
      });

      // Start combination in background with enhancements
      combineVideosInBackground(combination.id, videoUrls, enhancements);

      res.json({
        combinationId: combination.id,
        message: "Video combination started"
      });

    } catch (error: any) {
      console.error('Video combination error:', error);
      res.status(500).json({ message: error.message || "Failed to start video combination" });
    }
  });

  // Get user's video combinations
  app.get('/api/video-combinations', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const combinations = await storage.getUserVideoCombinations(userId);
      res.json(combinations);
    } catch (error) {
      console.error('Error fetching video combinations:', error);
      res.status(500).json({ message: "Failed to fetch video combinations" });
    }
  });

  // Stripe Billing Routes

  // Get all subscription plans (public route for billing page)
  app.get('/api/plans', async (req, res) => {
    try {
      const plans = await storage.getAllPlans();
      res.json(plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  // Get current user's subscription
  app.get('/api/subscriptions/current', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.json(null);
      }
      
      res.json(subscription);
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });
  
  // Stripe Webhook Handler - MUST use express.raw() for signature verification
  app.post('/api/webhooks/stripe', 
    express.raw({ type: 'application/json' }),
    async (req: any, res) => {
      try {
        const signature = req.headers['stripe-signature'];
        if (!signature) {
          console.error('[Stripe Webhook] Missing signature');
          return res.status(400).send('Missing signature');
        }

        const event = verifyWebhookSignature(req.body, signature);
        
        console.log(`[Stripe Webhook] Received event: ${event.type}`);

        // Handle the event
        switch (event.type) {
          case 'checkout.session.completed':
            await handleCheckoutCompleted(event.data.object as any, event.id);
            break;
          case 'invoice.paid':
            await handleInvoicePaid(event.data.object as any, event.id);
            break;
          case 'invoice.payment_failed':
            await handleInvoicePaymentFailed(event.data.object as any);
            break;
          case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event.data.object as any);
            break;
          case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object as any);
            break;
          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (error: any) {
        console.error('[Stripe Webhook] Error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
      }
    }
  );

  // Create Checkout Session for subscription purchase
  app.post('/api/billing/checkout', requireJWT, async (req: any, res) => {
    try {
      const { planId } = req.body;
      
      if (!planId) {
        return res.status(400).json({ error: 'planId is required' });
      }

      // Validate that the plan exists and isn't a trial
      const plan = await storage.getPlanById(planId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      
      if (plan.billingPeriod === 'trial') {
        return res.status(400).json({ error: 'Cannot purchase trial plans via Stripe. Please use the free signup flow.' });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const baseUrl = getBaseUrl();

      const session = await createCheckoutSession({
        userId: user.id,
        userEmail: user.email || '',
        planId,
        successUrl: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/billing/canceled`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('[Billing] Checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create Customer Portal Session for managing subscription
  app.post('/api/billing/portal', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || !user.stripeCustomerId) {
        return res.status(400).json({ error: 'No Stripe customer found' });
      }

      const baseUrl = getBaseUrl();

      const session = await createCustomerPortalSession({
        customerId: user.stripeCustomerId,
        returnUrl: `${baseUrl}/billing`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('[Billing] Portal error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background video combination processor
async function combineVideosInBackground(combinationId: string, videoUrls: string[], enhancements?: any) {
  try {
    // Update status to processing
    await storage.updateVideoCombination(combinationId, {
      status: 'processing',
    });

    await storage.createVideoCombinationEvent({
      combinationId,
      eventType: 'status_change',
      message: 'Started processing',
    });

    // Combine videos with progress tracking
    const result = await combineVideos({
      videoUrls,
      enhancements,
      onProgress: async (stage, message) => {
        console.log(`[Combination ${combinationId}] ${stage}: ${message}`);
        await storage.createVideoCombinationEvent({
          combinationId,
          eventType: stage === 'error' ? 'error' : 'ffmpeg_start',
          message,
          metadata: { stage },
        });
      },
    });

    // Update with successful result
    await storage.updateVideoCombination(combinationId, {
      status: 'completed',
      outputPath: result.outputPath,
      durationSeconds: result.durationSeconds,
      completedAt: new Date(),
    });

    await storage.createVideoCombinationEvent({
      combinationId,
      eventType: 'ffmpeg_complete',
      message: 'Video combination completed successfully',
      metadata: {
        outputPath: result.outputPath,
        durationSeconds: result.durationSeconds,
      },
    });

    console.log(`Video combination ${combinationId} completed: ${result.outputPath}`);

  } catch (error: any) {
    console.error(`Video combination ${combinationId} failed:`, error);

    // Update with error
    await storage.updateVideoCombination(combinationId, {
      status: 'failed',
      errorMessage: error.message,
      completedAt: new Date(),
    });

    await storage.createVideoCombinationEvent({
      combinationId,
      eventType: 'error',
      message: `Combination failed: ${error.message}`,
      metadata: { error: error.stack },
    });

    // Refund credits on failure
    try {
      const combination = await storage.getVideoCombinationById(combinationId);
      if (combination) {
        await storage.addCreditsAtomic(combination.userId, combination.creditsCost);
        console.log(`Refunded ${combination.creditsCost} credits for failed combination ${combinationId}`);
      }
    } catch (refundError) {
      console.error(`CRITICAL: Failed to refund credits for combination ${combinationId}:`, refundError);
    }
  }
}
