import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import path from "path";
import fs from "fs/promises";
import * as fsSync from "fs";
import { nanoid } from "nanoid";
import multer from "multer";
import OpenAI from "openai";
import { exec } from "child_process";
import { promisify } from "util";
import { storage } from "./storage";
import { db } from "./db";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { registerAuthRoutes } from "./authRoutes";
import { registerPublicApiRoutes, requireApiKey } from './publicApi';
import { registerSocialMediaRoutes } from "./socialMediaRoutes";
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
  generateTTS,
  transcribeAudio,
  generateKlingAvatar,
  generateLipSync,
  upscaleImage,
  upscaleVideo,
  initializeApiKeys 
} from "./kieai";
import { 
  cloneVoice as elevenLabsCloneVoice, 
  deleteVoice as elevenLabsDeleteVoice,
  processAudioFilesForCloning as elevenLabsProcessAudioFiles,
  isElevenLabsConfigured
} from "./elevenlabs";
import {
  listVoices as fishAudioListVoices,
  getVoice as fishAudioGetVoice,
  generateSpeech as fishAudioGenerateSpeech,
  createVoiceModel as fishAudioCreateVoiceModel,
  deleteVoiceModel as fishAudioDeleteVoiceModel,
  processAudioFilesForCloning as fishAudioProcessAudioFiles,
  transcribeAudio as fishAudioTranscribeAudio,
  base64ToBuffer as fishAudioBase64ToBuffer,
  isFishAudioConfigured
} from "./fishAudio";
import { analyzeImageWithVision } from "./openaiVision";
import { processImageInputs, saveBase64Image, saveBase64Images, saveBase64Video } from "./imageHosting";
import { saveBase64Audio, saveBase64AudioFiles } from "./audioHosting";
import * as s3 from "./services/awsS3";
import { chatService } from "./chatService";
import { combineVideos, generateThumbnail, generateImageThumbnail, reencodeVideoForStreaming } from "./videoProcessor";
import { LoopsService } from "./loops";
import { logger } from "./logger";
import { parseKieaiError, extractErrorMessage } from "./errorParser";
import { 
  createCheckoutSession, 
  createCustomerPortalSession,
  verifyWebhookSignature,
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  createSocialPosterCheckoutSession,
  createSocialPosterEmbeddedCheckout,
  handleSocialPosterCheckout,
  handleSocialPosterSubscriptionDeleted,
  isSocialPosterSubscription,
  createBoostEmbeddedCheckout,
  handleBoostCheckout,
  isBoostProduct,
  stripe,
} from "./stripe";
import { getLateService } from "./getLate";
import { z } from "zod";
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
  combineVideosRequestSchema,
  upscaleImageRequestSchema,
  upscaleVideoRequestSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  loopsTestContactRequestSchema,
  contactFormRequestSchema,
  insertBlogPostSchema,
  updateBlogPostSchema,
  promptRefineRequestSchema,
  assistantChatRequestSchema,
  insertSavedStockImageSchema,
  supportTickets,
  supportMessages,
  users,
  type InsertSubscriptionPlan,
  type BlogPost
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
// All pricing MUST be in the database - hardcoded fallbacks removed
async function getModelCost(model: string): Promise<number> {
  const pricing = await storage.getPricingByModel(model);
  
  if (pricing) {
    return pricing.creditCost;
  }
  
  // CRITICAL: Log when a model is missing from database pricing
  // Admin should add this model to the pricing table immediately
  console.warn(`[PRICING WARNING] Model "${model}" not found in database pricing table. Using safe default of 100 credits. Add this model to Admin Panel → Settings → AI Generation Settings.`);
  
  // Return safe default - admin should configure actual cost in database
  return 100;
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
// Different models have different seed range requirements
function generateRandomSeed(model?: string): number {
  // Veo models require seeds in range 10000-99999 per Kie.ai API documentation
  if (model && model.startsWith('veo-')) {
    return Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
  }
  // Other models can use larger seed ranges
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
    const taskId = result?.data?.taskId || result?.taskId;
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
    // NOTE: result is already response.data from callKieApi
    const taskId = result?.data?.taskId || result?.taskId;
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
      // Refund credits atomically using the safe addCreditsAtomic function
      const userId = generation.userId;
      try {
        await storage.addCreditsAtomic(userId, generation.creditsCost);
        console.log(`💰 Refunded ${generation.creditsCost} credits to user ${userId} for failed TTS generation`);
      } catch (refundError) {
        console.error(`❌ CRITICAL: Failed to refund credits for TTS generation ${generationId}:`, refundError);
        // Continue - will also be refunded by finalizeGeneration as a backup
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
    
    // Get generation to retrieve creditsCost for refund
    const generation = await storage.getGeneration(generationId);
    if (generation && generation.creditsCost) {
      // Refund credits atomically using the safe addCreditsAtomic function
      const userId = generation.userId;
      try {
        await storage.addCreditsAtomic(userId, generation.creditsCost);
        console.log(`💰 Refunded ${generation.creditsCost} credits to user ${userId} for failed sound effects generation`);
      } catch (refundError) {
        console.error(`❌ CRITICAL: Failed to refund credits for sound effects generation ${generationId}:`, refundError);
        // Continue - will also be refunded by finalizeGeneration as a backup
      }
    }
    
    await storage.finalizeGeneration(generationId, 'failure', { 
      statusDetail: 'api_error',
      errorMessage: error.message || 'Sound effects generation failed' 
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

// Track CSP violations for monitoring (in-memory, last 100 violations)
const cspViolations: Array<{ timestamp: Date; violation: any }> = [];
const MAX_CSP_VIOLATIONS = 100;

export async function registerRoutes(app: Express): Promise<Server> {
  // Add lightweight health check endpoint - responds immediately for deployment health checks
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // CSP Violation Report Endpoint - receives reports from Content-Security-Policy-Report-Only
  app.post('/api/csp-report', express.json({ type: ['application/json', 'application/csp-report'] }), (req, res) => {
    try {
      const report = req.body?.['csp-report'] || req.body;
      
      if (report) {
        // Store violation for monitoring
        cspViolations.push({
          timestamp: new Date(),
          violation: {
            documentUri: report['document-uri'],
            blockedUri: report['blocked-uri'],
            violatedDirective: report['violated-directive'],
            effectiveDirective: report['effective-directive'],
            originalPolicy: report['original-policy']?.substring(0, 200), // Truncate for storage
            disposition: report.disposition,
            statusCode: report['status-code'],
          }
        });
        
        // Keep only last 100 violations
        if (cspViolations.length > MAX_CSP_VIOLATIONS) {
          cspViolations.shift();
        }
        
        // Log violation for monitoring (not every request to avoid log spam)
        console.log(`🛡️ CSP Violation Report: ${report['violated-directive']} blocked ${report['blocked-uri'] || 'inline/eval'}`);
      }
      
      // Always respond with 204 No Content (as per CSP spec)
      res.status(204).send();
    } catch (error) {
      console.error('Error processing CSP report:', error);
      res.status(204).send(); // Still respond successfully to avoid browser retries
    }
  });

  // Admin endpoint to view recent CSP violations
  app.get('/api/admin/csp-violations', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Check admin access
      const ADMIN_EMAILS = ['ryan.mahabir@outlook.com', 'admin@artivio.ai', 'joe@joecodeswell.com', 'jordanlambrecht@gmail.com', 'admin@example.com'];
      const isAdmin = user?.isAdmin === true || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
      
      if (!isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json({
        totalViolations: cspViolations.length,
        violations: cspViolations.slice(-50).reverse(), // Return last 50, newest first
        monitoringEnabled: true,
        mode: 'report-only',
      });
    } catch (error) {
      console.error('Error fetching CSP violations:', error);
      res.status(500).json({ message: "Failed to fetch CSP violations" });
    }
  });

  // Admin endpoint to view rate limit violations (monitoring mode)
  app.get('/api/admin/rate-limit-violations', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Check admin access
      const ADMIN_EMAILS = ['ryan.mahabir@outlook.com', 'admin@artivio.ai', 'joe@joecodeswell.com', 'jordanlambrecht@gmail.com', 'admin@example.com'];
      const isAdmin = user?.isAdmin === true || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
      
      if (!isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Import the violations getter
      const { getRateLimitViolations, getRateLimitStats } = await import('./services/rateLimiter');
      
      res.json({
        violations: getRateLimitViolations(),
        stats: getRateLimitStats(),
        mode: 'monitor', // Currently in monitoring mode
      });
    } catch (error) {
      console.error('Error fetching rate limit violations:', error);
      res.status(500).json({ message: "Failed to fetch rate limit violations" });
    }
  });

  // IMG.LY CreativeEditor SDK license endpoint (protected but accessible to authenticated users)
  app.get('/api/imgly/license', requireJWT, async (req, res) => {
    try {
      const licenseKey = process.env.IMGLY_LICENSE_KEY;
      
      if (!licenseKey) {
        console.error('[IMGLY] License key not configured');
        return res.status(503).json({ 
          message: 'Video editor is temporarily unavailable. Please try again later.' 
        });
      }

      res.json({ license: licenseKey });
    } catch (error) {
      console.error('[IMGLY] Error fetching license:', error);
      res.status(500).json({ message: 'Failed to load video editor configuration' });
    }
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

  // Register public API routes for external integrations (Tasklet, etc.)
  try {
    registerPublicApiRoutes(app);
    console.log('✓ Public API routes initialized successfully');
  } catch (error) {
    console.warn('Warning: Failed to initialize public API routes:', error);
  }

  // Register Social Media Hub routes (GetLate.dev integration)
  try {
    registerSocialMediaRoutes(app);
  } catch (error) {
    console.warn('Warning: Failed to initialize social media routes:', error);
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

  // Helper function to check admin status based on database isAdmin field
  // Hardcoded emails are kept as fallback for initial admin access
  const ADMIN_EMAILS = ['ryan.mahabir@outlook.com', 'admin@artivio.ai', 'joe@joecodeswell.com', 'jordanlambrecht@gmail.com', 'admin@example.com'];

  const isUserAdmin = (user: any): boolean => {
    // First check database isAdmin field
    if (user?.isAdmin === true) {
      return true;
    }
    // Fallback to hardcoded emails for initial access
    return user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;
  };

  // ========== PUBLIC ENDPOINTS (NO AUTH REQUIRED) ==========
  
  // Store plan selection before authentication
  app.post('/api/public/plan-selection', (req, res) => {
    try {
      const { planName } = req.body;
      
      // Validate plan name - accept any non-empty string
      // Actual plan validation happens when creating checkout session
      if (!planName || typeof planName !== 'string') {
        return res.status(400).json({ 
          message: "Plan name is required" 
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
      
      console.log('[CONTACT FORM] Attempting to send email via Postmark...');
      console.log('[CONTACT FORM] From: hello@artivio.ai, To: hello@artivio.ai');
      
      const postmarkResponse = await postmarkClient.sendEmail({
        From: 'hello@artivio.ai',
        To: 'hello@artivio.ai',
        Subject: `Contact Form: ${subject}`,
        TextBody: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        ReplyTo: email,
        MessageStream: 'outbound',
      });

      console.log('[CONTACT FORM] Postmark response:', JSON.stringify(postmarkResponse, null, 2));
      console.log('[CONTACT FORM] Email sent successfully - MessageID:', postmarkResponse.MessageID);
      
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
        console.error('[CONTACT FORM] Postmark error details:', {
          statusCode: error.statusCode,
          message: error.message,
          code: error.code,
          errorCode: error.errorCode,
        });
        return res.status(500).json({ 
          message: 'Failed to send email. Please try again later.' 
        });
      }

      res.status(500).json({ 
        message: 'Failed to submit your message. Please try again later.' 
      });
    }
  });
  
  // Newsletter signup (public endpoint) - Loops.so integration
  app.post('/api/public/newsletter-signup', async (req, res) => {
    try {
      const { email, firstName } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      console.log('[NEWSLETTER] Signup request received:', { email, firstName });

      // Check if Loops API key is configured
      if (!process.env.LOOPS_API_KEY) {
        console.error('[NEWSLETTER] LOOPS_API_KEY not configured');
        return res.status(500).json({ error: 'Newsletter service not configured' });
      }

      // Call Loops.so API to add contact to mailing list
      const loopsResponse = await fetch('https://app.loops.so/api/v1/contacts/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`
        },
        body: JSON.stringify({
          email: email,
          firstName: firstName || undefined,
          mailingLists: {
            'cmho6d4k70p4b0i23ae4q7z20': true // Free Trial / Newsletter list
          },
          subscribed: true,
          source: 'website_newsletter'
        })
      });

      const loopsData = await loopsResponse.json();
      
      console.log('[NEWSLETTER] Loops.so response:', {
        status: loopsResponse.status,
        data: loopsData
      });

      if (loopsResponse.ok) {
        console.log('[NEWSLETTER] Successfully subscribed:', email);
        res.status(200).json({ 
          success: true, 
          message: 'Successfully subscribed! Check your email for confirmation.' 
        });
      } else {
        console.error('[NEWSLETTER] Loops.so error:', loopsData);
        res.status(400).json({ 
          error: loopsData.message || 'Failed to subscribe. Please try again.' 
        });
      }
    } catch (error: any) {
      console.error('[NEWSLETTER] Signup error:', error);
      res.status(500).json({ error: 'Server error. Please try again later.' });
    }
  });

  // ========== BLOG API ENDPOINTS (Public + Admin) ==========
  
  // Helper function to generate URL-friendly slug from title
  function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single
      .substring(0, 200);       // Limit length
  }

  // GET /api/blog/posts - Public: Get published posts with pagination
  app.get('/api/blog/posts', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const category = req.query.category as string | undefined;
      const sortBy = (req.query.sort as 'latest' | 'oldest' | 'popular') || 'latest';

      const result = await storage.getPublishedBlogPosts({
        page,
        limit,
        category,
        sortBy,
      });

      res.json({
        posts: result.posts.map(post => ({
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          author: post.author,
          publishedDate: post.publishedDate,
          tags: post.tags,
          featuredImageUrl: post.featuredImageUrl,
          category: post.category,
        })),
        page,
        totalPages: result.totalPages,
        total: result.total,
      });
    } catch (error: any) {
      console.error('[BLOG] Error fetching posts:', error);
      res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
  });

  // GET /api/blog/posts/:slug - Public: Get single post by slug
  app.get('/api/blog/posts/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const post = await storage.getBlogPostBySlug(slug);

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Only show published posts to public (draft posts require admin)
      if (post.status !== 'published') {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Increment view count
      await storage.incrementBlogPostViews(post.id);

      // Get related posts
      const relatedPosts = await storage.getRelatedBlogPosts(post.category, post.id, 3);

      res.json({
        ...post,
        relatedPosts: relatedPosts.map(p => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          featuredImageUrl: p.featuredImageUrl,
          publishedDate: p.publishedDate,
        })),
      });
    } catch (error: any) {
      console.error('[BLOG] Error fetching post:', error);
      res.status(500).json({ error: 'Failed to fetch blog post' });
    }
  });

  // GET /api/blog/tags - Public: Get all tags with counts
  app.get('/api/blog/tags', async (req, res) => {
    try {
      const tags = await storage.getBlogTags();
      res.json(tags);
    } catch (error: any) {
      console.error('[BLOG] Error fetching tags:', error);
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  });

  // GET /api/blog/search - Public: Search posts
  app.get('/api/blog/search', async (req, res) => {
    try {
      const query = req.query.q as string;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
      }

      const posts = await storage.searchBlogPosts(query.trim());
      
      res.json(posts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        publishedDate: post.publishedDate,
      })));
    } catch (error: any) {
      console.error('[BLOG] Error searching posts:', error);
      res.status(500).json({ error: 'Failed to search posts' });
    }
  });

  // ========== BLOG ADMIN ENDPOINTS (Require Authentication) ==========

  // GET /api/admin/blog/posts - Admin: Get all posts (including drafts)
  app.get('/api/admin/blog/posts', requireJWT, async (req: any, res) => {
    try {
      const user = req.user;
      if (!isUserAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const posts = await storage.getAllBlogPosts();
      res.json(posts);
    } catch (error: any) {
      console.error('[BLOG ADMIN] Error fetching posts:', error);
      res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
  });

  // GET /api/admin/blog/posts/:id - Admin: Get post by ID (for editing)
  app.get('/api/admin/blog/posts/:id', requireJWT, async (req: any, res) => {
    try {
      const user = req.user;
      if (!isUserAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { id } = req.params;
      const post = await storage.getBlogPostById(id);

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      res.json(post);
    } catch (error: any) {
      console.error('[BLOG ADMIN] Error fetching post:', error);
      res.status(500).json({ error: 'Failed to fetch blog post' });
    }
  });

  // POST /api/admin/blog/posts - Admin: Create new post
  app.post('/api/admin/blog/posts', requireJWT, async (req: any, res) => {
    try {
      const user = req.user;
      if (!isUserAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { title, content, excerpt, author, tags, category, featuredImageUrl, metaDescription, status } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      // Generate slug from title
      let slug = generateSlug(title);
      
      // Check if slug already exists, append number if so
      const existingPost = await storage.getBlogPostBySlug(slug);
      if (existingPost) {
        slug = `${slug}-${Date.now()}`;
      }

      const postData = {
        title,
        slug,
        content,
        excerpt: excerpt || content.substring(0, 200).replace(/[#*_`]/g, '').trim() + '...',
        author: author || 'Artivio Team',
        tags: tags || [],
        category: category || 'Announcement',
        featuredImageUrl: featuredImageUrl || null,
        metaDescription: metaDescription || null,
        status: status || 'draft',
        publishedDate: status === 'published' ? new Date() : null,
        updatedDate: null,
      };

      const post = await storage.createBlogPost(postData);
      console.log('[BLOG ADMIN] Created post:', post.id, post.title);

      res.status(201).json(post);
    } catch (error: any) {
      console.error('[BLOG ADMIN] Error creating post:', error);
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  });

  // PATCH /api/admin/blog/posts/:id - Admin: Update post
  app.patch('/api/admin/blog/posts/:id', requireJWT, async (req: any, res) => {
    try {
      const user = req.user;
      if (!isUserAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { id } = req.params;
      const existingPost = await storage.getBlogPostById(id);

      if (!existingPost) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const updates: any = { ...req.body };

      // If title changed, regenerate slug
      if (updates.title && updates.title !== existingPost.title) {
        let newSlug = generateSlug(updates.title);
        const slugCheck = await storage.getBlogPostBySlug(newSlug);
        if (slugCheck && slugCheck.id !== id) {
          newSlug = `${newSlug}-${Date.now()}`;
        }
        updates.slug = newSlug;
      }

      // If publishing for the first time, set published date
      if (updates.status === 'published' && existingPost.status !== 'published') {
        updates.publishedDate = new Date();
      }

      // Always set updated date
      updates.updatedDate = new Date();

      const post = await storage.updateBlogPost(id, updates);
      console.log('[BLOG ADMIN] Updated post:', id);

      res.json(post);
    } catch (error: any) {
      console.error('[BLOG ADMIN] Error updating post:', error);
      res.status(500).json({ error: 'Failed to update blog post' });
    }
  });

  // DELETE /api/admin/blog/posts/:id - Admin: Delete post
  app.delete('/api/admin/blog/posts/:id', requireJWT, async (req: any, res) => {
    try {
      const user = req.user;
      if (!isUserAdmin(user)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { id } = req.params;
      const deleted = await storage.deleteBlogPost(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Post not found' });
      }

      console.log('[BLOG ADMIN] Deleted post:', id);
      res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error: any) {
      console.error('[BLOG ADMIN] Error deleting post:', error);
      res.status(500).json({ error: 'Failed to delete blog post' });
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
      
      // Extract result URL(s) from callback data
      // Handle unified API resultJson (JSON string containing resultUrls array)
      // Used by: Nano Banana, Seedance, Midjourney, Seedream, and other /api/v1/jobs/createTask models
      let parsedResultUrls: string[] = [];
      let parsedResultUrl: string | undefined;
      if (callbackData.data?.resultJson) {
        try {
          const resultData = JSON.parse(callbackData.data.resultJson);
          if (resultData.resultUrls && Array.isArray(resultData.resultUrls)) {
            parsedResultUrls = resultData.resultUrls;
            parsedResultUrl = resultData.resultUrls[0];
          }
        } catch (e) {
          console.warn('Failed to parse resultJson:', e);
        }
      }
      
      // Also collect all URLs from other array sources for multi-image models
      // Midjourney: data.resultUrls array, 4o-Image: data.info.result_urls, Veo: data.info.resultUrls
      if (parsedResultUrls.length === 0) {
        if (callbackData.data?.resultUrls && Array.isArray(callbackData.data.resultUrls)) {
          parsedResultUrls = callbackData.data.resultUrls;
        } else if (callbackData.data?.info?.result_urls && Array.isArray(callbackData.data.info.result_urls)) {
          parsedResultUrls = callbackData.data.info.result_urls;
        } else if (callbackData.data?.info?.resultUrls && Array.isArray(callbackData.data.info.resultUrls)) {
          parsedResultUrls = callbackData.data.info.resultUrls;
        } else if (callbackData.data?.images && Array.isArray(callbackData.data.images)) {
          parsedResultUrls = callbackData.data.images;
        } else if (callbackData.data?.results && Array.isArray(callbackData.data.results)) {
          parsedResultUrls = callbackData.data.results;
        } else if (callbackData.resultUrls && Array.isArray(callbackData.resultUrls)) {
          parsedResultUrls = callbackData.resultUrls;
        } else if (callbackData.result_urls && Array.isArray(callbackData.result_urls)) {
          parsedResultUrls = callbackData.result_urls;
        }
      }
      
      // Priority order: Unified API resultJson (Nano Banana, Seedance, Midjourney, Seedream), Runway Aleph, Runway Gen-3, Veo, Bytedance models, Suno, ElevenLabs, others
      const resultUrl = parsedResultUrl ||              // Unified API resultJson (resultUrls array)
                       callbackData.data?.result_video_url || // Runway Aleph video result
                       callbackData.data?.result_image_url || // Runway Aleph image fallback
                       callbackData.data?.video_url ||    // Runway Gen-3 uses snake_case
                       (callbackData.data?.info?.resultUrls && callbackData.data.info.resultUrls[0]) || // Veo nested
                       callbackData.data?.info?.resultImageUrl || // Flux Kontext uses data.info.resultImageUrl
                       (callbackData.data?.info?.result_urls && callbackData.data.info.result_urls[0]) || // 4o-Image uses data.info.result_urls array
                       callbackData.data?.output_url ||   // Bytedance models (Wan, Kling, Grok, Sora) use output_url
                       callbackData.data?.outputUrl ||    // Alternative camelCase for Bytedance models
                       callbackData.data?.videoUrl ||     // Other video models camelCase
                       sunoAudioUrl ||                    // Suno audio
                       (callbackData.data?.videoUrls && Array.isArray(callbackData.data.videoUrls) && callbackData.data.videoUrls[0]) || // Video URL array
                       (callbackData.data?.urls && Array.isArray(callbackData.data.urls) && callbackData.data.urls[0]) || // Generic URLs array
                       callbackData.data?.imageUrl ||     // Image models (Nano Banana) - camelCase
                       callbackData.data?.image_url ||    // Image models - snake_case
                       (callbackData.data?.images && Array.isArray(callbackData.data.images) && callbackData.data.images[0]) || // Array of images
                       (callbackData.data?.results && Array.isArray(callbackData.data.results) && callbackData.data.results[0]) || // Array of results
                       (callbackData.data?.resultUrls && callbackData.data.resultUrls[0]) || // Midjourney uses data.resultUrls array
                       (callbackData.data?.result_urls && callbackData.data.result_urls[0]) ||
                       (callbackData.data?.data && Array.isArray(callbackData.data.data) && callbackData.data.data[0]?.audioUrl) || // ElevenLabs TTS/Sound Effects array format
                       callbackData.data?.data?.audioUrl || // ElevenLabs TTS/Sound Effects object format
                       (callbackData.data?.data && Array.isArray(callbackData.data.data) && callbackData.data.data[0]?.audio_url) || // ElevenLabs snake_case
                       callbackData.data?.data?.audio_url || // ElevenLabs snake_case object
                       callbackData.resultUrls?.[0] ||
                       callbackData.result_urls?.[0] ||
                       callbackData.videoUrl || 
                       callbackData.imageUrl || 
                       callbackData.audioUrl || 
                       callbackData.url || 
                       callbackData.data?.url ||
                       callbackData.data?.audioUrl;
      
      // Load generation to identify model type for logging
      // Try STT generation first, then avatar generation, then fall back to regular generation
      const sttGen = await db.query.sttGenerations.findFirst({
        where: (fields, { eq }) => eq(fields.id, generationId),
      }).catch(() => undefined);
      
      // Handle STT callbacks specially - extract transcription from resultObject
      if (sttGen) {
        console.log(`🎤 Detected STT callback for generation ${generationId}`);
        
        const dataState = callbackData.data?.state?.toLowerCase();
        const isSuccess = callbackData.code === 200 || dataState === 'success';
        const isError = dataState === 'fail' || callbackData.code === 500 || callbackData.code === 501;
        
        if (isSuccess && callbackData.data?.resultJson) {
          try {
            const resultData = JSON.parse(callbackData.data.resultJson);
            const transcriptionData = resultData.resultObject;
            
            if (transcriptionData) {
              // Extract text from words array if available, or use full object
              let transcriptionText = '';
              if (transcriptionData.words && Array.isArray(transcriptionData.words)) {
                transcriptionText = transcriptionData.words
                  .filter((w: any) => w.type === 'word')
                  .map((w: any) => w.text)
                  .join('');
              }
              
              // Store full transcription data as JSON
              const fullTranscription = JSON.stringify(transcriptionData);
              
              await storage.updateSttGeneration(generationId, {
                status: 'completed',
                transcription: transcriptionText || fullTranscription,
                completedAt: new Date(),
              });
              
              console.log(`✓ STT transcription completed for ${generationId}`);
              return res.json({ success: true, message: 'STT callback processed' });
            }
          } catch (e) {
            console.error('Failed to parse STT resultJson:', e);
          }
        }
        
        if (isError) {
          const errorMsg = callbackData.data?.failMsg || callbackData.msg || 'Transcription failed';
          
          // Refund credits
          if (sttGen.userId && sttGen.creditsCost) {
            await storage.addCreditsAtomic(sttGen.userId, sttGen.creditsCost);
          }
          
          await storage.updateSttGeneration(generationId, {
            status: 'failed',
            errorMessage: errorMsg,
            completedAt: new Date(),
          });
          
          console.log(`✗ STT transcription failed for ${generationId}: ${errorMsg}`);
          return res.json({ success: true, message: 'STT error callback processed' });
        }
        
        // Intermediate status update
        return res.json({ success: true, message: 'STT callback acknowledged' });
      }
      
      const avatarGen = await db.query.avatarGenerations.findFirst({
        where: (fields, { eq }) => eq(fields.id, generationId),
      }).catch(() => undefined);
      
      const generation = avatarGen || (await storage.getGeneration(generationId));
      const isAvatarGeneration = !!avatarGen;
      const modelType = (generation && 'model' in generation ? generation.model : undefined) || (isAvatarGeneration ? 'talking-avatar' : 'unknown');
      
      // Log what we extracted (for debugging model-specific issues)
      if (resultUrl) {
        console.log(`✅ [${modelType}] Extracted resultUrl: ${resultUrl}`);
        if (parsedResultUrls.length > 1) {
          console.log(`📷 [${modelType}] Multi-image: ${parsedResultUrls.length} total URLs extracted`);
        }
      } else {
        console.log(`⚠️  [${modelType}] No resultUrl extracted. Checking callback structure for debugging:`);
        console.log(`   - callbackData.data?.result_video_url (Aleph): ${callbackData.data?.result_video_url}`);
        console.log(`   - callbackData.data?.result_image_url (Aleph): ${callbackData.data?.result_image_url}`);
        console.log(`   - callbackData.data?.video_url (Runway Gen-3): ${callbackData.data?.video_url}`);
        console.log(`   - callbackData.data?.output_url (Bytedance): ${callbackData.data?.output_url}`);
        console.log(`   - callbackData.data?.videoUrl: ${callbackData.data?.videoUrl}`);
        console.log(`   - callbackData.data?.resultJson (Seedance): ${callbackData.data?.resultJson ? 'present' : 'absent'}`);
        console.log(`   - callbackData.data?.imageUrl: ${callbackData.data?.imageUrl}`);
        console.log(`   - callbackData.data?.image_url: ${callbackData.data?.image_url}`);
        console.log(`   - callbackData.data?.url: ${callbackData.data?.url}`);
        console.log(`   - Full data structure keys: ${Object.keys(callbackData.data || {}).join(', ')}`);
      }
      
      // Check for explicit status from Kie.ai
      // New unified API (/api/v1/jobs/createTask) uses data.state: 'success' | 'fail'
      // Old APIs use status or code fields
      const dataState = callbackData.data?.state?.toLowerCase();
      const kieStatus = (dataState || sunoStatus || callbackData.status)?.toLowerCase();
      
      // Check for Suno-specific callback stages (text, first, complete)
      const callbackType = callbackData.data?.callbackType || callbackData.callbackType;
      const isSunoIntermediateStage = callbackType === 'text' || callbackType === 'first';
      
      // Kie.ai models use HTTP status codes in 'code' field (Runway, Veo, Seedance)
      const httpStatusCode = callbackData.code;
      const isKieSuccess = httpStatusCode === 200 || dataState === 'success';
      // Veo error codes: 400, 422, 500, 501
      // Runway error codes: 400, 500
      // Seedance/Unified API error: data.state === 'fail'
      const isSeedanceError = httpStatusCode === 501 || dataState === 'fail';
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
          // Extract seed value from callback data (varies by model)
          let seedValue: number | undefined;
          
          // Helper to safely convert to integer
          const toInt = (val: any): number | undefined => {
            if (val === null || val === undefined) return undefined;
            const num = Array.isArray(val) ? val[0] : val;
            const parsed = typeof num === 'string' ? parseInt(num, 10) : Number(num);
            return !isNaN(parsed) && isFinite(parsed) && parsed >= 1 && parsed <= 2147483647 ? Math.floor(parsed) : undefined;
          };
          
          // Try to extract seed from various possible locations (check all paths, prioritize most specific)
          // Veo models: data.info.result.seeds (array), data.info.result.seed (singular), data.info.seeds
          if (callbackData.data?.info?.result?.seeds) {
            seedValue = toInt(callbackData.data.info.result.seeds);
          } else if (callbackData.data?.info?.result?.seed !== undefined) {
            seedValue = toInt(callbackData.data.info.result.seed);
          } else if (callbackData.data?.info?.seeds) {
            seedValue = toInt(callbackData.data.info.seeds);
          }
          // Seedance/Wan models: data.info.seed, data.seed
          else if (callbackData.data?.info?.seed !== undefined) {
            seedValue = toInt(callbackData.data.info.seed);
          } else if (callbackData.data?.seed !== undefined) {
            seedValue = toInt(callbackData.data.seed);
          }
          // Try resultJson (Seedance uses JSON string) - check both seed and seeds[]
          else if (callbackData.data?.resultJson) {
            try {
              const resultData = JSON.parse(callbackData.data.resultJson);
              if (resultData.seeds && Array.isArray(resultData.seeds)) {
                seedValue = toInt(resultData.seeds);
              } else if (resultData.seed !== undefined) {
                seedValue = toInt(resultData.seed);
              }
            } catch (e) {
              console.warn('Failed to parse seed from resultJson:', e);
            }
          }
          // Generic fallback
          else if (callbackData.seed !== undefined) {
            seedValue = toInt(callbackData.seed);
          }
          
          // Prepare updates object with resultUrl, resultUrls (multi-image), and optional seed
          const updates: any = { resultUrl, status: 'completed', completedAt: new Date() };
          
          // Store all URLs for multi-image models (Midjourney, Seedream, 4o-Image, etc.)
          if (parsedResultUrls.length > 0) {
            updates.resultUrls = parsedResultUrls;
          }
          
          if (seedValue !== undefined && seedValue !== null) {
            updates.seed = seedValue;
            console.log(`📍 Captured seed value for ${generationId}: ${seedValue}`);
          }
          
          // Capture audioId for music generations (needed for WAV/vocal separation later)
          // Suno returns audioId in data.data[0].id in callback
          const audioId = callbackData?.data?.data?.[0]?.id || 
                         callbackData?.data?.audioId ||
                         callbackData?.audioId;
          if (audioId && generation && 'type' in generation && generation.type === 'music') {
            // Merge audioId into existing parameters
            const existingParams = (generation.parameters as any) || {};
            updates.parameters = { ...existingParams, audioId };
            console.log(`🎵 Captured audioId for music ${generationId}: ${audioId}`);
          }
          
          // Update appropriate table based on generation type
          if (isAvatarGeneration) {
            await storage.updateAvatarGeneration(generationId, updates);
            console.log(`✓ Avatar Generation ${generationId} completed successfully with URL: ${resultUrl}`);
          } else {
            await storage.finalizeGeneration(generationId, 'success', updates);
            console.log(`✓ Generation ${generationId} completed successfully with URL: ${resultUrl}`);
            
            // Handle social media auto-generation completion
            const fullGen = await storage.getGeneration(generationId);
            if (fullGen?.socialPostId) {
              const { handleGenerationComplete } = await import('./services/socialMediaGeneration');
              await handleGenerationComplete(generationId, resultUrl, parsedResultUrls.length > 0 ? parsedResultUrls : undefined);
            }
          }
          
          // Generate thumbnails for video and image generations (async, don't block callback)
          const gen = await storage.getGeneration(generationId);
          if (gen && resultUrl) {
            // Generate appropriate thumbnail based on generation type
            (async () => {
              try {
                if (gen.type === 'video') {
                  let thumbnailGenerated = false;
                  
                  // Step 1: Try to re-encode video for optimized streaming
                  try {
                    console.log(`🎬 Starting video optimization for ${generationId}...`);
                    const optimizedUrl = await reencodeVideoForStreaming(resultUrl, generationId);
                    
                    // Update generation with optimized URL
                    await storage.updateGeneration(generationId, { resultUrl: optimizedUrl });
                    console.log(`✓ Video optimized and URL updated for ${generationId}: ${optimizedUrl}`);
                    
                    // Generate thumbnail from optimized video
                    // Check if optimizedUrl is an S3 URL (starts with http) or local path
                    const isS3Url = optimizedUrl.startsWith('http://') || optimizedUrl.startsWith('https://');
                    
                    try {
                      if (isS3Url) {
                        // S3 URL - use videoUrl parameter to download and generate thumbnail
                        const thumbResult = await generateThumbnail({
                          videoUrl: optimizedUrl,
                          generationId: generationId,
                          timestampSeconds: 1,
                        });
                        await storage.updateGeneration(generationId, { thumbnailUrl: thumbResult.thumbnailUrl });
                        console.log(`✓ Thumbnail generated from S3 video for ${generationId}: ${thumbResult.thumbnailUrl}`);
                        thumbnailGenerated = true;
                      } else {
                        // Local path - use videoPath parameter
                        const localVideoPath = path.join(process.cwd(), 'public', optimizedUrl.replace(/^\//,''));
                        const thumbResult = await generateThumbnail({
                          videoPath: localVideoPath,
                          generationId: generationId,
                          timestampSeconds: 1,
                        });
                        await storage.updateGeneration(generationId, { thumbnailUrl: thumbResult.thumbnailUrl });
                        console.log(`✓ Thumbnail generated from local video for ${generationId}: ${thumbResult.thumbnailUrl}`);
                        thumbnailGenerated = true;
                      }
                    } catch (thumbError: any) {
                      console.error(`⚠️  Thumbnail from optimized video failed for ${generationId}:`, thumbError.message);
                    }
                  } catch (encodeError: any) {
                    console.error(`⚠️  Video optimization failed for ${generationId}:`, encodeError.message);
                    // Keep original URL - video still works, just not optimized
                  }
                  
                  // Step 2: Fallback - generate thumbnail from original URL if not done yet
                  if (!thumbnailGenerated) {
                    console.log(`🖼️  Fallback: generating thumbnail from original URL for ${generationId}...`);
                    try {
                      const thumbResult = await generateThumbnail({
                        videoUrl: resultUrl,
                        generationId: generationId,
                        timestampSeconds: 1,
                      });
                      await storage.updateGeneration(generationId, { thumbnailUrl: thumbResult.thumbnailUrl });
                      console.log(`✓ Thumbnail generated from original URL for ${generationId}: ${thumbResult.thumbnailUrl}`);
                    } catch (thumbError: any) {
                      console.error(`⚠️  Thumbnail generation failed for ${generationId}:`, thumbError.message);
                    }
                  }
                } else if (['image', 'upscaling', 'background-remover'].includes(gen.type)) {
                  // Generate thumbnail for image types
                  console.log(`🖼️  Generating image thumbnail for ${generationId}...`);
                  const thumbResult = await generateImageThumbnail(resultUrl, generationId);
                  
                  await storage.updateGeneration(generationId, { thumbnailUrl: thumbResult.thumbnailUrl });
                  console.log(`✓ Image thumbnail generated for ${generationId}: ${thumbResult.thumbnailUrl}`);
                }
              } catch (error: any) {
                console.error(`⚠️  Background processing failed for ${generationId}:`, error.message);
                // Don't break user experience - thumbnails are optional
              }
            })().catch((error) => {
              console.error(`⚠️  Background thumbnail processing error for ${generationId}:`, error);
            });
          }
        } else {
          // Success status but no media URL - mark as failed with debugging info
          console.error(`❌ Generation ${generationId} marked complete but no media URL found in callback`);
          console.error(`Full callback data:`, safeStringify(callbackData));
          
          // Finalize as failed so it doesn't stay stuck in processing
          const errorMsg = 'Generation completed but result URL could not be extracted from callback. Please contact support with generation ID.';
          if (isAvatarGeneration) {
            await storage.updateAvatarGeneration(generationId, {
              status: 'failed',
              errorMessage: errorMsg,
            });
          } else {
            await storage.finalizeGeneration(generationId, 'failure', { errorMessage: errorMsg });
          }
          console.log(`✗ Generation ${generationId} marked as failed due to missing result URL`);
        }
      } else if (finalStatus === 'failed') {
        // Extract comprehensive error message from various possible fields
        // Seedance uses data.failMsg and data.failCode
        // Runway/Veo use "msg" field for error descriptions
        const rawErrorMessage = extractErrorMessage(callbackData) ||
                           sunoError ||
                           (callbackData.data?.failCode ? `Error code: ${callbackData.data.failCode}` : null) ||
                           (hasErrorCode ? `Error code: ${hasErrorCode}` : null) ||
                           'Generation failed - error indicated by provider';
        
        // Parse error to get user-friendly message with recommendations
        const parsedError = parseKieaiError(rawErrorMessage);
        
        // Store detailed error information as JSON in errorMessage
        // Frontend will parse this and display the recommendation
        const errorDetails = {
          _type: 'DETAILED_ERROR', // Marker so frontend knows this is structured data
          message: parsedError.message,
          recommendation: parsedError.recommendation,
          errorType: parsedError.errorType,
          raw: rawErrorMessage
        };
        
        const errorMessageToStore = JSON.stringify(errorDetails);
        
        console.log(`🔍 Parsed Error:`, errorDetails);
        
        if (isAvatarGeneration) {
          // Refund credits for failed avatar generation
          if (avatarGen?.creditsCost && avatarGen.userId) {
            const creditCost = avatarGen.creditsCost;
            const user = await storage.getUser(avatarGen.userId);
            if (user) {
              await storage.updateUserCredits(avatarGen.userId, user.credits + creditCost);
              console.log(`💰 Refunded ${creditCost} credits to user ${avatarGen.userId} for failed avatar generation`);
            }
          }
          await storage.updateAvatarGeneration(generationId, {
            status: 'failed',
            errorMessage: errorMessageToStore,
          });
        } else {
          await storage.finalizeGeneration(generationId, 'failure', {
            errorMessage: errorMessageToStore,
          });
          
          // Handle social media auto-generation failure
          const fullGen = await storage.getGeneration(generationId);
          if (fullGen?.socialPostId) {
            const { handleGenerationFailed } = await import('./services/socialMediaGeneration');
            await handleGenerationFailed(generationId, parsedError.message);
          }
        }
        console.log(`✗ Generation ${generationId} failed: ${parsedError.message}`);
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
      
      // Build composite pricing key for models with duration/resolution-based pricing
      let pricingKey: string = model;
      if (model === 'runway-gen3-alpha-turbo') {
        const duration = parameters?.duration || 5;
        pricingKey = `runway-gen3-alpha-turbo-${duration}s`;
      } else if (model === 'seedance-1-pro') {
        const duration = parameters?.duration || 5;
        const resolution = (parameters as any)?.resolution || '720p';
        pricingKey = `seedance-1-pro-${duration}s-${resolution}`;
      } else if (model === 'seedance-1-lite') {
        const resolution = (parameters as any)?.resolution || '720p';
        pricingKey = `seedance-1-lite-${resolution}`;
      } else if (model === 'wan-2.5') {
        const duration = parameters?.duration || 5;
        const resolution = (parameters as any)?.resolution || '720p';
        pricingKey = `wan-2.5-${duration}s-${resolution}`;
      } else if (model === 'kling-2.5-turbo') {
        const duration = parameters?.duration || 5;
        pricingKey = generationType === 'text-to-video'
          ? 'kling-2.5-turbo-t2v'
          : `kling-2.5-turbo-i2v-${duration}s`;
      } else if (model === 'veo-3.1-first-and-last-frames' || model === 'veo-3.1-fast-first-and-last-frames' || model === 'veo-3.1-fast-reference-2-video') {
        // Veo 3.1 special modes - use the model name directly as pricing key
        pricingKey = model;
      }
      
      const cost = await getModelCost(pricingKey);

      // Atomically deduct credits
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Pre-generate seed for models that support it
      let finalParameters: any = parameters || {};
      
      // DEBUG: Log incoming parameters for seed tracing
      console.log(`🔍 [SEED DEBUG] Incoming parameters for ${model}:`, JSON.stringify({
        seed: finalParameters.seed,
        seeds: finalParameters.seeds,
        hasSeeds: 'seeds' in finalParameters,
        hasSeed: 'seed' in finalParameters
      }));
      
      if (modelSupportsSeed(model)) {
        // Normalize seed from either 'seed' (singular) or 'seeds' (array from Veo frontend)
        // Frontend sends seeds: [value] for Veo, seed: value for others
        const seedsField = finalParameters.seeds;
        const existingSeed = finalParameters.seed ?? 
          (Array.isArray(seedsField) ? seedsField[0] : seedsField);
        
        console.log(`🔍 [SEED DEBUG] Normalized existingSeed: ${existingSeed} (type: ${typeof existingSeed})`);
        
        if (existingSeed === undefined || existingSeed === null) {
          const generatedSeed = generateRandomSeed(model);
          finalParameters.seed = generatedSeed;
          console.log(`🌱 Pre-generated seed for ${model}: ${generatedSeed}`);
        } else {
          // Use the user-provided seed
          finalParameters.seed = existingSeed;
          console.log(`🌱 Using user-provided seed for ${model}: ${existingSeed}`);
        }
        
        console.log(`🔍 [SEED DEBUG] Final seed in parameters: ${finalParameters.seed}`);
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
        seed: finalParameters.seed || null,
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
          finalParameters.seed = generateRandomSeed(model);
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

  // Topaz AI Video Upscaling (from hosted URL)
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
      
      // Download video and determine duration for tiered pricing
      const MAX_VIDEO_DURATION = 20; // seconds
      let videoDuration = 0;
      let durationTier = '10s';
      
      try {
        const response = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const buffer = Buffer.from(response.data);
        
        // Save to temp file for ffprobe analysis
        const tempPath = path.join(process.cwd(), 'temp', `upscale-validation-${nanoid()}.mp4`);
        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, buffer);

        try {
          const execAsync = promisify(exec);
          
          const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempPath}"`;
          const { stdout } = await execAsync(command, { timeout: 10000 });
          const duration = parseFloat(stdout.trim());

          await fs.unlink(tempPath);

          if (isNaN(duration) || duration <= 0) {
            return res.status(400).json({ 
              message: "Invalid video file. Could not determine duration." 
            });
          }

          if (duration > MAX_VIDEO_DURATION) {
            return res.status(400).json({ 
              message: `Video is ${Math.floor(duration)} seconds long. Maximum duration is ${MAX_VIDEO_DURATION} seconds.` 
            });
          }

          videoDuration = duration;
          
          // Determine pricing tier
          if (duration <= 10) {
            durationTier = '10s';
          } else if (duration <= 15) {
            durationTier = '15s';
          } else {
            durationTier = '20s';
          }
        } catch (probeError) {
          try {
            await fs.unlink(tempPath);
          } catch {}
          throw probeError;
        }
      } catch (validationError: any) {
        console.error('Video duration validation error:', validationError);
        return res.status(400).json({ 
          message: validationError.message || "Failed to validate video duration." 
        });
      }

      // Get cost using tiered model name
      const cost = await getModelCost(`topaz-video-${upscaleFactor}x-${durationTier}`);

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      const generation = await storage.createGeneration({
        userId,
        type: 'upscaling',
        processingStage: 'upscale',
        parentGenerationId,
        model: `topaz-video-${upscaleFactor}x-${durationTier}`,
        prompt: `Upscale video ${upscaleFactor}x using Topaz AI (${videoDuration.toFixed(1)}s, ${durationTier} tier)`,
        parameters: { sourceUrl, upscaleFactor, duration: videoDuration, tier: durationTier },
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

  // Topaz AI Upscaling Standalone Page - accepts base64 image data
  app.post('/api/upscale/topaz', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { imageData, upscaleFactor } = req.body;

      if (!imageData || !upscaleFactor) {
        return res.status(400).json({ message: "Image data and upscale factor are required" });
      }

      // Validate upscale factor
      const factor = parseInt(upscaleFactor);
      if (![2, 4, 8].includes(factor)) {
        return res.status(400).json({ message: "Upscale factor must be 2, 4, or 8" });
      }

      // Get cost from database using model name
      const cost = await getUpscaleCost('image', String(factor));

      // Atomically deduct credits
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create generation record
      const generation = await storage.createGeneration({
        userId,
        type: 'upscaling',
        model: `topaz-image-${factor}x`,
        prompt: `Upscale image ${factor}x using Topaz AI`,
        parameters: { upscaleFactor: factor },
        status: 'pending',
        creditsCost: cost,
      });

      // Process in background
      (async () => {
        try {
          await storage.updateGeneration(generation.id, { status: 'processing' });

          // Convert base64 to hosted URL
          let hostedImageUrl: string;
          try {
            console.log('Converting base64 image to hosted URL...');
            const hostedUrls = await saveBase64Images([imageData]);
            hostedImageUrl = hostedUrls[0];
            console.log(`✓ Image hosted at: ${hostedImageUrl}`);
          } catch (imageError: any) {
            console.error('Failed to host image:', imageError);
            throw new Error(`Failed to process image: ${imageError.message}`);
          }

          // Call Topaz upscaler
          const callbackUrl = getCallbackUrl(generation.id);
          const { result, keyName } = await upscaleImage({
            sourceImageUrl: hostedImageUrl,
            upscaleFactor: factor as 2 | 4 | 8,
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
          console.error('Topaz upscale error:', error);
          await storage.finalizeGeneration(generation.id, 'failure', {
            status: 'failed',
            errorMessage: error.message,
          });
        }
      })();

      res.json({ generationId: generation.id, message: "Image upscaling started" });
    } catch (error: any) {
      console.error('Topaz upscale request error:', error);
      res.status(500).json({ message: error.message || "Failed to start upscaling" });
    }
  });

  // Topaz AI Video Upscaling Standalone Page - accepts base64 video data
  app.post('/api/upscale/topaz-video', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { videoData, upscaleFactor } = req.body;

      if (!videoData || !upscaleFactor) {
        return res.status(400).json({ message: "Video data and upscale factor are required" });
      }

      // Validate upscale factor (1, 2, or 4 for Topaz video)
      const factor = parseInt(upscaleFactor);
      if (![1, 2, 4].includes(factor)) {
        return res.status(400).json({ message: "Upscale factor must be 1, 2, or 4" });
      }

      // Validate video duration and determine pricing tier (max 20 seconds)
      const MAX_VIDEO_DURATION = 20; // seconds
      let videoDuration = 0;
      let durationTier = '10s'; // default tier
      
      try {
        const base64Data = videoData.split(',')[1] || videoData;
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Save to temp file for ffprobe analysis
        const tempPath = path.join(process.cwd(), 'temp', `validation-${nanoid()}.mp4`);
        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, buffer);

        try {
          const execAsync = promisify(exec);
          
          const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempPath}"`;
          const { stdout } = await execAsync(command, { timeout: 10000 });
          const duration = parseFloat(stdout.trim());

          // Clean up temp file
          await fs.unlink(tempPath);

          if (isNaN(duration) || duration <= 0) {
            return res.status(400).json({ 
              message: "Invalid video file. Could not determine duration." 
            });
          }

          if (duration > MAX_VIDEO_DURATION) {
            return res.status(400).json({ 
              message: `Video is ${Math.floor(duration)} seconds long. Maximum duration is ${MAX_VIDEO_DURATION} seconds to avoid processing timeouts.` 
            });
          }

          // Store duration and calculate pricing tier
          videoDuration = duration;
          
          // Determine pricing tier based on duration
          // Tier 1: 0-10s = 160 credits
          // Tier 2: 11-15s = 270 credits
          // Tier 3: 16-20s = 380 credits
          if (duration <= 10) {
            durationTier = '10s';
          } else if (duration <= 15) {
            durationTier = '15s';
          } else {
            durationTier = '20s';
          }
        } catch (probeError) {
          // Clean up temp file on error
          try {
            await fs.unlink(tempPath);
          } catch {}
          throw probeError;
        }
      } catch (validationError: any) {
        console.error('Video duration validation error:', validationError);
        return res.status(400).json({ 
          message: validationError.message || "Failed to validate video. Please ensure the file is a valid video." 
        });
      }

      // Get cost from database using tiered model name (180/270/360 credits based on duration)
      const cost = await getModelCost(`topaz-video-${factor}x-${durationTier}`);

      // Atomically deduct credits
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create generation record
      const generation = await storage.createGeneration({
        userId,
        type: 'upscaling',
        model: `topaz-video-${factor}x-${durationTier}`,
        prompt: `Upscale video ${factor}x using Topaz AI (${videoDuration.toFixed(1)}s, ${durationTier} tier)`,
        parameters: { upscaleFactor: factor, duration: videoDuration, tier: durationTier },
        status: 'pending',
        creditsCost: cost,
      });

      // Process in background
      (async () => {
        try {
          await storage.updateGeneration(generation.id, { status: 'processing' });

          // Convert base64 to hosted URL
          let hostedVideoUrl: string;
          try {
            console.log('Converting base64 video to hosted URL...');
            // Save base64 video with proper video handling
            hostedVideoUrl = await saveBase64Video(videoData);
            console.log(`✓ Video hosted at: ${hostedVideoUrl}`);
          } catch (videoError: any) {
            console.error('Failed to host video:', videoError);
            throw new Error(`Failed to process video: ${videoError.message}`);
          }

          // Call Topaz video upscaler
          const callbackUrl = getCallbackUrl(generation.id);
          const { result, keyName } = await upscaleVideo({
            sourceVideoUrl: hostedVideoUrl,
            upscaleFactor: factor as 2 | 4,
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
          console.error('Topaz video upscale error:', error);
          await storage.finalizeGeneration(generation.id, 'failure', {
            status: 'failed',
            errorMessage: error.message,
          });
        }
      })();

      res.json({ generationId: generation.id, message: "Video upscaling started" });
    } catch (error: any) {
      console.error('Topaz video upscale request error:', error);
      res.status(500).json({ message: error.message || "Failed to start video upscaling" });
    }
  });

  // Background Remover - Recraft AI
  app.post('/api/background-remover', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { imageData } = req.body;

      if (!imageData) {
        return res.status(400).json({ message: "Image data is required" });
      }

      // Get cost from database
      const cost = await getModelCost('recraft-remove-background');

      // Atomically deduct credits
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create generation record
      const generation = await storage.createGeneration({
        userId,
        type: 'background-remover',
        model: 'recraft-remove-background',
        prompt: 'Remove background from image',
        parameters: {},
        status: 'pending',
        creditsCost: cost,
      });

      // Process in background
      (async () => {
        try {
          await storage.updateGeneration(generation.id, { status: 'processing' });

          // Convert image (base64 or URL) to hosted URL
          let hostedImageUrl: string;
          try {
            console.log('Processing image input (base64 or URL)...');
            // Use processImageInputs to handle both base64 and URL inputs (from Library quick action)
            const hostedUrls = await processImageInputs([imageData]);
            hostedImageUrl = hostedUrls[0];
            console.log(`✓ Image ready at: ${hostedImageUrl}`);
          } catch (imageError: any) {
            console.error('Failed to process image:', imageError);
            throw new Error(`Failed to process image: ${imageError.message}`);
          }

          // Call Kie.ai recraft/remove-background model directly
          const callbackUrl = getCallbackUrl(generation.id);
          console.log(`📞 Sending callback URL to Kie.ai for background remover ${generation.id}: ${callbackUrl}`);

          // Get a Kie.ai API key
          const apiKey = await storage.getNextApiKey();
          if (!apiKey) {
            throw new Error('No Kie.ai API keys available');
          }

          // Call Kie.ai API for background removal
          const response = await axios.post(
            'https://api.kie.ai/api/v1/jobs/createTask',
            {
              model: 'recraft/remove-background',
              callBackUrl: callbackUrl,
              input: { image: hostedImageUrl }
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey.keyValue}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const taskId = response.data?.data?.taskId;
          if (!taskId) {
            throw new Error('API response missing taskId');
          }

          // Store taskId in externalTaskId field for webhook matching
          await storage.updateGeneration(generation.id, {
            status: 'processing',
            apiKeyUsed: apiKey.keyName,
            externalTaskId: taskId,
            statusDetail: 'queued',
          });

          console.log(`📋 Background removal task queued: ${taskId} (waiting for callback)`);
        } catch (error: any) {
          console.error('Background removal failed:', error);
          await storage.updateGeneration(generation.id, {
            status: 'failed',
            errorMessage: error.message,
          });
          // Refund credits on failure
          await storage.addCreditsAtomic(userId, cost);
        }
      })();

      res.json({ generationId: generation.id, message: "Background removal started" });
    } catch (error: any) {
      console.error('Background remover request error:', error);
      res.status(500).json({ message: error.message || "Failed to start background removal" });
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

      const { audioId, continueAt, model, parameters } = validationResult.data;
      const audioUrl = validationResult.data.audioId;
      const continueClipId = validationResult.data.audioId;
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

      const { prompt } = validationResult.data;
      const parameters = 'parameters' in validationResult.data ? validationResult.data.parameters : undefined;
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

  // Get User's Lyrics Library
  app.get('/api/lyrics', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const lyrics = await storage.getUserLyricsGenerations(userId);
      res.json(lyrics);
    } catch (error: any) {
      console.error('Error fetching lyrics:', error);
      res.status(500).json({ message: error.message || "Failed to fetch lyrics" });
    }
  });

  // Delete Lyrics
  app.delete('/api/lyrics/:lyricsId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { lyricsId } = req.params;
      
      // Get all user's lyrics to verify ownership
      const userLyrics = await storage.getUserLyricsGenerations(userId);
      const lyric = userLyrics.find(l => l.id === lyricsId);
      
      if (!lyric) {
        return res.status(403).json({ message: "Not authorized to delete this lyrics" });
      }
      
      // Delete the lyrics
      const deleted = await storage.deleteLyricsGeneration(lyricsId);
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete lyrics" });
      }
      
      res.json({ message: "Lyrics deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting lyrics:', error);
      res.status(500).json({ message: error.message || "Failed to delete lyrics" });
    }
  });

  // Prompt Refinement using Deepseek AI
  app.post('/api/prompts/refine', requireJWT, async (req: any, res) => {
    try {
      const validationResult = promptRefineRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { prompt, context } = validationResult.data;

      // Context-specific system prompts
      const systemPrompts: Record<string, string> = {
        video: `You are an expert AI video prompt engineer. Your task is to enhance and refine prompts for AI video generation.

Focus on:
- Cinematography: camera angles, movements (dolly, pan, tracking, crane shots)
- Lighting: golden hour, dramatic shadows, neon, studio lighting
- Atmosphere: mood, tone, weather conditions
- Visual quality: 4K, cinematic, film grain, color grading
- Motion: slow motion, time-lapse, dynamic movement
- Composition: framing, depth of field, focal points

Respond ONLY with the refined prompt text. Do not include explanations, markdown formatting, or any other text.`,

        image: `You are an expert AI image prompt engineer. Your task is to enhance and refine prompts for AI image generation.

Focus on:
- Art style: photorealistic, digital art, oil painting, illustration, anime
- Composition: rule of thirds, symmetry, leading lines, framing
- Lighting: natural light, rim lighting, chiaroscuro, volumetric
- Detail: intricate details, textures, materials
- Artist references: "in the style of", artistic movements
- Quality descriptors: masterpiece, highly detailed, 8K, award-winning

Respond ONLY with the refined prompt text. Do not include explanations, markdown formatting, or any other text.`,

        audio: `You are an expert AI audio/music prompt engineer. Your task is to enhance and refine prompts for AI music and audio generation.

Focus on:
- Genre: specific music genre and sub-genres
- Mood: emotional tone, energy level, atmosphere
- Instruments: specific instruments, synths, acoustic/electronic
- Tempo: BPM range, rhythm patterns
- Production: mixing style, reverb, stereo width
- Structure: intro, verses, chorus, bridge, outro

Respond ONLY with the refined prompt text. Do not include explanations, markdown formatting, or any other text.`,

        avatar: `You are an expert AI talking avatar prompt engineer. Your task is to enhance and refine emotion/style descriptions for AI talking avatar generation.

Focus on:
- Expression: specific facial expressions, emotions (happy, serious, confident, friendly)
- Speaking style: professional, casual, enthusiastic, calm, energetic
- Tone: warm, authoritative, conversational, inspiring
- Body language: subtle head movements, eye contact, gestures
- Personality: charismatic, approachable, trustworthy, dynamic

Respond ONLY with the refined emotion/style text. Keep it concise (2-4 descriptive words or a short phrase). Do not include explanations, markdown formatting, or any other text.`,

        general: `You are an expert AI prompt engineer. Your task is to enhance and refine prompts for AI content generation.

Focus on:
- Clarity: make the prompt clear and specific
- Detail: add relevant descriptive details
- Structure: organize the prompt logically
- Quality: include quality-enhancing keywords

Respond ONLY with the refined prompt text. Do not include explanations, markdown formatting, or any other text.`
      };

      const systemPrompt = systemPrompts[context] || systemPrompts.general;

      const refinedPrompt = await chatService.chat(
        'deepseek',
        'deepseek-chat',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please refine this prompt for better AI generation results:\n\n${prompt}` }
        ]
      );

      res.json({
        original: prompt,
        refined: refinedPrompt.trim(),
      });
    } catch (error: any) {
      console.error('Prompt refinement error:', error);
      res.status(500).json({ message: error.message || "Failed to refine prompt" });
    }
  });

  // AI Assistant Chat - provides help about Artivio features and pricing
  app.post('/api/assistant/chat', async (req: any, res) => {
    try {
      const validationResult = assistantChatRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.errors 
        });
      }

      const { message } = validationResult.data;

      // Check if user is authenticated (optional - guests get limited responses)
      const isAuthenticated = !!(req.user && req.user.id);

      // Comprehensive system prompt about Artivio
      const systemPrompt = `You are the Artivio AI Assistant, a helpful and friendly assistant for Artivio - an all-in-one AI content creation platform.

## About Artivio
Artivio is a powerful AI-powered platform that helps creators, marketers, and businesses generate professional content using cutting-edge AI models.

## Features & Tools

### Video Generation
- **Veo 3.1** - Google's latest video model, produces stunning cinematic videos
- **Veo 3.1 Fast** - Faster generation with slightly lower quality
- **Runway Gen-3 Alpha Turbo** - High-quality video generation with great motion
- **Kling 2.0** - Excellent for dynamic scenes and character animation
- **Sora 2 Pro** - OpenAI's video model for creative content
- **Seedance** - Dance and motion-focused video generation
- **Wan 2.5** - Great for artistic and stylized videos

### Image Generation
- **Seedream 4.0** - High-quality realistic image generation
- **4o Image (GPT-4o)** - OpenAI's powerful image model
- **Flux Kontext** - Fast, high-quality images with great prompt adherence
- **Midjourney** - Artistic and creative image generation
- **Recraft V3** - Professional design-focused images

### Audio & Music
- **Suno V3.5, V4, V4.5, V5** - AI music generation with vocals and instrumentals
- **Sound Effects** - Generate custom sound effects
- **Voice Clone** - Clone voices using ElevenLabs or Fish Audio
- **Text-to-Speech (TTS)** - Convert text to natural speech
- **Speech-to-Text (STT)** - Transcribe audio to text

### Advanced Tools
- **Talking Avatars** - Create AI avatars that speak your content
- **Lip Sync** - Sync audio to video with realistic lip movements
- **Background Remover** - Remove backgrounds from images
- **Image Upscaler** - Enhance image resolution with Topaz AI
- **Video Upscaler** - Upscale videos to higher quality
- **QR Generator** - Create stylized QR codes with AI
- **AI Chat** - Chat with DeepSeek, GPT-4o, and other AI models
- **Video Editor** - Combine and edit generated videos

## Pricing Plans

### Starter Plan - $19/month
- 15,000 credits per month
- Access to all generation tools
- Standard support
- Great for individual creators

### Professional Plan - $49/month
- 50,000 credits per month
- Priority processing
- All features included
- Perfect for active creators and small teams

### Business Plan - $99/month
- 150,000 credits per month
- Priority support
- API access
- Ideal for businesses and agencies

## How Credits Work
- Each AI generation costs credits based on the model used
- Video generation typically costs 300-500 credits
- Image generation costs 50-200 credits
- Music generation costs 100-300 credits
- Voice/audio features cost 15-100 credits
- Credits refresh monthly with your subscription

## Guidelines
- Be helpful, concise, and friendly
- If asked about specific pricing or credit costs, provide the general ranges above
- Recommend the appropriate tool based on the user's needs
- If you don't know something specific, suggest checking the pricing page or contacting support
- Keep responses focused and practical
${!isAuthenticated ? '\n- Note: You are chatting with a guest user. Encourage them to create an account to access all features.' : ''}

Respond naturally and helpfully. Keep responses concise but informative.`;

      const response = await chatService.chat(
        'deepseek',
        'deepseek-chat',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      );

      res.json({ message: response.trim() });
    } catch (error: any) {
      console.error('Assistant chat error:', error);
      res.status(500).json({ message: "I'm having trouble responding right now. Please try again in a moment." });
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

      let { prompt, uploadUrl, model, parameters } = validationResult.data;
      let audioUrl = uploadUrl;
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
        prompt: prompt || '',
        parameters: parameters || {},
        status: 'pending',
        creditsCost: cost,
      });

      uploadCoverInBackground(generation.id, prompt || '', audioUrl, model, parameters || {});

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

      let { prompt, uploadUrl, model, parameters } = validationResult.data;
      let audioUrl = uploadUrl;
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
        prompt: prompt || '',
        parameters: parameters || {},
        status: 'pending',
        creditsCost: cost,
      });

      uploadExtendInBackground(generation.id, prompt || '', audioUrl, model, parameters || {});

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
      const STANDARD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes for most generations
      const EXTENDED_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes for lip sync (InfiniTalk) and complex operations
      const now = Date.now();
      
      for (const gen of items) {
        if ((gen.status === 'pending' || gen.status === 'processing') && gen.createdAt) {
          const createdTime = new Date(gen.createdAt).getTime();
          const elapsedMs = now - createdTime;
          
          // Use extended timeout for InfiniTalk lip sync which takes longer
          const isLipSync = gen.modelId?.includes('infinite-talk') || gen.modelId?.includes('infinitalk') || gen.modelId?.includes('lip-sync');
          const timeoutMs = isLipSync ? EXTENDED_TIMEOUT_MS : STANDARD_TIMEOUT_MS;
          
          if (elapsedMs > timeoutMs) {
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

      // Determine file extension and content type based on generation type
      const extensionMap: Record<string, { ext: string; contentType: string }> = {
        video: { ext: 'mp4', contentType: 'video/mp4' },
        image: { ext: 'png', contentType: 'image/png' },
        music: { ext: 'mp3', contentType: 'audio/mpeg' },
        audio: { ext: 'mp3', contentType: 'audio/mpeg' },
        'sound-effects': { ext: 'mp3', contentType: 'audio/mpeg' },
        'text-to-speech': { ext: 'mp3', contentType: 'audio/mpeg' },
        upscaling: { ext: 'png', contentType: 'image/png' },
        'background-remover': { ext: 'png', contentType: 'image/png' },
        'talking-avatar': { ext: 'mp4', contentType: 'video/mp4' },
        'avatar': { ext: 'mp4', contentType: 'video/mp4' },
        'video-editor': { ext: 'mp4', contentType: 'video/mp4' },
      };

      let fileInfo = extensionMap[generation.type];
      
      // For upscaling, check if it's video or image based on the model name
      if (generation.type === 'upscaling' && generation.model) {
        if (generation.model.includes('video')) {
          fileInfo = { ext: 'mp4', contentType: 'video/mp4' };
        } else {
          fileInfo = { ext: 'png', contentType: 'image/png' };
        }
      }
      
      fileInfo = fileInfo || { ext: 'bin', contentType: 'application/octet-stream' };
      const filename = `artivio-${generation.type}-${generation.id}.${fileInfo.ext}`;

      // Set response headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', fileInfo.contentType);

      // Check if this is a local file path (starts with /)
      if (generation.resultUrl.startsWith('/')) {
        // Local file - serve from filesystem
        // Strip leading slash to avoid path.join treating it as absolute
        const relativePath = generation.resultUrl.slice(1);
        const localPath = path.join(process.cwd(), 'public', relativePath);
        
        // Check if file exists
        if (!fsSync.existsSync(localPath)) {
          console.error(`Download proxy: File not found at ${localPath}`);
          return res.status(404).json({ message: "File not found on server. It may have been stored in cloud storage but the URL was lost. Please try regenerating." });
        }
        
        // Stream the local file
        const fileStream = fsSync.createReadStream(localPath);
        fileStream.pipe(res);
      } else {
        // External URL - check if it's an S3 URL that might need refreshing
        let downloadUrl = generation.resultUrl;
        
        if (s3.isS3SignedUrl(downloadUrl)) {
          try {
            // Refresh the signed URL in case it expired
            downloadUrl = await s3.refreshSignedUrl(downloadUrl);
            console.log(`[Download] Refreshed S3 signed URL for generation ${id}`);
          } catch (refreshError) {
            console.error('[Download] Failed to refresh S3 URL:', refreshError);
            // Continue with original URL, might still work
          }
        }
        
        const fileResponse = await axios({
          method: 'GET',
          url: downloadUrl,
          responseType: 'stream',
        });
        
        // Stream the file to the client
        fileResponse.data.pipe(res);
      }
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

  // Toggle showcase status for a generation
  app.post('/api/generations/:id/showcase', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      // Validate request body
      const bodySchema = z.object({
        isShowcase: z.boolean()
      });
      
      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }
      
      const { isShowcase } = validationResult.data;

      // Verify the generation belongs to the user
      const generation = await storage.getGeneration(id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }

      if (generation.userId !== userId) {
        return res.status(403).json({ message: "You can only modify your own generations" });
      }

      // Only completed video generations with resultUrl can be showcased
      if (generation.status !== 'completed') {
        return res.status(400).json({ message: "Only completed generations can be showcased" });
      }
      
      if (generation.type !== 'video') {
        return res.status(400).json({ message: "Only video generations can be showcased" });
      }
      
      if (!generation.resultUrl) {
        return res.status(400).json({ message: "Generation must have a valid result URL" });
      }

      // Update the showcase status
      const updated = await storage.updateGeneration(id, { isShowcase });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update showcase status" });
      }

      res.json({ 
        success: true, 
        isShowcase: updated.isShowcase,
        message: updated.isShowcase ? "Added to showcase" : "Removed from showcase"
      });
    } catch (error) {
      console.error('Error toggling showcase status:', error);
      res.status(500).json({ message: "Failed to update showcase status" });
    }
  });

  // ========== COLLECTIONS ROUTES ==========

  // Get user collections
  app.get('/api/collections', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const collections = await storage.getCollections(userId);
      res.json(collections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  // Get generations in a collection
  app.get('/api/collections/:collectionId/generations', requireJWT, async (req: any, res) => {
    try {
      const { collectionId } = req.params;
      const userId = req.user.id;
      
      // Verify collection belongs to user
      const collection = await storage.getCollection(collectionId);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      if (collection.userId !== userId) {
        return res.status(403).json({ message: "You can only view your own collections" });
      }
      
      const generations = await storage.getGenerationsByCollection(collectionId);
      res.json(generations);
    } catch (error) {
      console.error('Error fetching collection generations:', error);
      res.status(500).json({ message: "Failed to fetch collection generations" });
    }
  });

  // Create collection
  app.post('/api/collections', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const schema = z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
        parentId: z.string().uuid().optional().nullable(),
        sortOrder: z.number().optional()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const collection = await storage.createCollection({
        ...validationResult.data,
        userId
      });
      res.status(201).json(collection);
    } catch (error) {
      console.error('Error creating collection:', error);
      res.status(500).json({ message: "Failed to create collection" });
    }
  });

  // Update collection
  app.put('/api/collections/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const collection = await storage.getCollection(id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      if (collection.userId !== userId) {
        return res.status(403).json({ message: "You can only modify your own collections" });
      }

      const schema = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional().nullable(),
        color: z.string().optional().nullable(),
        icon: z.string().optional().nullable(),
        parentId: z.string().uuid().optional().nullable(),
        sortOrder: z.number().optional()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      // Convert nullable to undefined for storage compatibility
      const updateData = {
        ...validationResult.data,
        color: validationResult.data.color ?? undefined,
        description: validationResult.data.description ?? undefined,
        icon: validationResult.data.icon ?? undefined,
      };

      const updated = await storage.updateCollection(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error('Error updating collection:', error);
      res.status(500).json({ message: "Failed to update collection" });
    }
  });

  // Delete collection
  app.delete('/api/collections/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const collection = await storage.getCollection(id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      if (collection.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own collections" });
      }

      await storage.deleteCollection(id);
      res.json({ success: true, message: "Collection deleted" });
    } catch (error) {
      console.error('Error deleting collection:', error);
      res.status(500).json({ message: "Failed to delete collection" });
    }
  });

  // ========== TAGS ROUTES ==========

  // Get user tags
  app.get('/api/tags', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tags = await storage.getTags(userId);
      res.json(tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  // Create tag
  app.post('/api/tags', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const schema = z.object({
        name: z.string().min(1).max(50),
        color: z.string().optional()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const tag = await storage.createTag({
        ...validationResult.data,
        userId
      });
      res.status(201).json(tag);
    } catch (error) {
      console.error('Error creating tag:', error);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  // Update tag
  app.put('/api/tags/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const tag = await storage.getTag(id);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      if (tag.userId !== userId) {
        return res.status(403).json({ message: "You can only modify your own tags" });
      }

      const schema = z.object({
        name: z.string().min(1).max(50).optional(),
        color: z.string().optional().nullable()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      // Convert nullable to undefined for storage compatibility
      const updateData = {
        ...validationResult.data,
        color: validationResult.data.color ?? undefined,
      };

      const updated = await storage.updateTag(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error('Error updating tag:', error);
      res.status(500).json({ message: "Failed to update tag" });
    }
  });

  // Delete tag
  app.delete('/api/tags/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const tag = await storage.getTag(id);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      if (tag.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own tags" });
      }

      await storage.deleteTag(id);
      res.json({ success: true, message: "Tag deleted" });
    } catch (error) {
      console.error('Error deleting tag:', error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  // ========== GENERATION ORGANIZATION ROUTES ==========

  // Toggle favorite status
  app.post('/api/generations/:id/favorite', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const generation = await storage.getGeneration(id);
      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }
      if (generation.userId !== userId) {
        return res.status(403).json({ message: "You can only modify your own generations" });
      }

      const schema = z.object({
        isFavorite: z.boolean()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const updated = await storage.updateGeneration(id, { isFavorite: validationResult.data.isFavorite });
      res.json({ success: true, isFavorite: updated?.isFavorite });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      res.status(500).json({ message: "Failed to update favorite status" });
    }
  });

  // Archive/unarchive generation
  app.post('/api/generations/:id/archive', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const generation = await storage.getGeneration(id);
      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }
      if (generation.userId !== userId) {
        return res.status(403).json({ message: "You can only modify your own generations" });
      }

      const schema = z.object({
        archive: z.boolean()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const archivedAt = validationResult.data.archive ? new Date() : null;
      const updated = await storage.updateGeneration(id, { archivedAt });
      res.json({ success: true, archivedAt: updated?.archivedAt });
    } catch (error) {
      console.error('Error toggling archive:', error);
      res.status(500).json({ message: "Failed to update archive status" });
    }
  });

  // Move to collection
  app.post('/api/generations/:id/collection', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const generation = await storage.getGeneration(id);
      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }
      if (generation.userId !== userId) {
        return res.status(403).json({ message: "You can only modify your own generations" });
      }

      const schema = z.object({
        collectionId: z.string().uuid().nullable()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      if (validationResult.data.collectionId) {
        const collection = await storage.getCollection(validationResult.data.collectionId);
        if (!collection || collection.userId !== userId) {
          return res.status(403).json({ message: "Collection not found or does not belong to you" });
        }
      }

      const updated = await storage.updateGeneration(id, { collectionId: validationResult.data.collectionId });
      res.json({ success: true, collectionId: updated?.collectionId });
    } catch (error) {
      console.error('Error moving to collection:', error);
      res.status(500).json({ message: "Failed to move generation to collection" });
    }
  });

  // Get generation's tags
  app.get('/api/generations/:id/tags', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const generation = await storage.getGeneration(id);
      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }
      if (generation.userId !== userId) {
        return res.status(403).json({ message: "You can only view tags for your own generations" });
      }

      const tags = await storage.getGenerationTags(id);
      res.json(tags);
    } catch (error) {
      console.error('Error fetching generation tags:', error);
      res.status(500).json({ message: "Failed to fetch generation tags" });
    }
  });

  // Add tag to generation
  app.post('/api/generations/:id/tags', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const generation = await storage.getGeneration(id);
      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }
      if (generation.userId !== userId) {
        return res.status(403).json({ message: "You can only modify your own generations" });
      }

      const schema = z.object({
        tagId: z.string().uuid()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const tag = await storage.getTag(validationResult.data.tagId);
      if (!tag || tag.userId !== userId) {
        return res.status(403).json({ message: "Tag not found or does not belong to you" });
      }

      await storage.addGenerationTag(id, validationResult.data.tagId);
      res.json({ success: true, message: "Tag added to generation" });
    } catch (error) {
      console.error('Error adding tag to generation:', error);
      res.status(500).json({ message: "Failed to add tag to generation" });
    }
  });

  // Remove tag from generation
  app.delete('/api/generations/:id/tags/:tagId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id, tagId } = req.params;
      
      const generation = await storage.getGeneration(id);
      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }
      if (generation.userId !== userId) {
        return res.status(403).json({ message: "You can only modify your own generations" });
      }

      await storage.removeGenerationTag(id, tagId);
      res.json({ success: true, message: "Tag removed from generation" });
    } catch (error) {
      console.error('Error removing tag from generation:', error);
      res.status(500).json({ message: "Failed to remove tag from generation" });
    }
  });

  // ========== BULK OPERATIONS ROUTES ==========

  // Bulk move to collection
  app.post('/api/generations/bulk/move', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const schema = z.object({
        generationIds: z.array(z.string().uuid()).min(1),
        collectionId: z.string().uuid().nullable()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const { generationIds, collectionId } = validationResult.data;

      const userGenerations = await storage.getUserGenerations(userId);
      const userGenIds = new Set(userGenerations.map(g => g.id));
      const invalidIds = generationIds.filter(id => !userGenIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(403).json({ message: "Some generations do not belong to you" });
      }

      if (collectionId) {
        const collection = await storage.getCollection(collectionId);
        if (!collection || collection.userId !== userId) {
          return res.status(403).json({ message: "Collection not found or does not belong to you" });
        }
      }

      await storage.bulkMoveToCollection(generationIds, collectionId);
      res.json({ success: true, message: `${generationIds.length} generations moved` });
    } catch (error) {
      console.error('Error bulk moving generations:', error);
      res.status(500).json({ message: "Failed to move generations" });
    }
  });

  // Bulk toggle favorite
  app.post('/api/generations/bulk/favorite', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const schema = z.object({
        generationIds: z.array(z.string().uuid()).min(1),
        isFavorite: z.boolean()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const { generationIds, isFavorite } = validationResult.data;

      const userGenerations = await storage.getUserGenerations(userId);
      const userGenIds = new Set(userGenerations.map(g => g.id));
      const invalidIds = generationIds.filter(id => !userGenIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(403).json({ message: "Some generations do not belong to you" });
      }

      await storage.bulkToggleFavorite(generationIds, isFavorite);
      res.json({ success: true, message: `${generationIds.length} generations updated` });
    } catch (error) {
      console.error('Error bulk toggling favorite:', error);
      res.status(500).json({ message: "Failed to update generations" });
    }
  });

  // Bulk archive
  app.post('/api/generations/bulk/archive', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const schema = z.object({
        generationIds: z.array(z.string().uuid()).min(1),
        archive: z.boolean()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const { generationIds, archive } = validationResult.data;

      const userGenerations = await storage.getUserGenerations(userId);
      const userGenIds = new Set(userGenerations.map(g => g.id));
      const invalidIds = generationIds.filter(id => !userGenIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(403).json({ message: "Some generations do not belong to you" });
      }

      await storage.bulkArchive(generationIds, archive);
      res.json({ success: true, message: `${generationIds.length} generations ${archive ? 'archived' : 'unarchived'}` });
    } catch (error) {
      console.error('Error bulk archiving generations:', error);
      res.status(500).json({ message: "Failed to archive generations" });
    }
  });

  // Bulk delete
  app.post('/api/generations/bulk/delete', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const schema = z.object({
        generationIds: z.array(z.string().uuid()).min(1)
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const { generationIds } = validationResult.data;

      const userGenerations = await storage.getUserGenerations(userId);
      const userGenIds = new Set(userGenerations.map(g => g.id));
      const invalidIds = generationIds.filter(id => !userGenIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(403).json({ message: "Some generations do not belong to you" });
      }

      await storage.bulkDelete(generationIds);
      res.json({ success: true, message: `${generationIds.length} generations deleted` });
    } catch (error) {
      console.error('Error bulk deleting generations:', error);
      res.status(500).json({ message: "Failed to delete generations" });
    }
  });

  // Bulk add tag
  app.post('/api/generations/bulk/add-tag', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const schema = z.object({
        generationIds: z.array(z.string().uuid()).min(1),
        tagId: z.string().uuid()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const { generationIds, tagId } = validationResult.data;

      const userGenerations = await storage.getUserGenerations(userId);
      const userGenIds = new Set(userGenerations.map(g => g.id));
      const invalidIds = generationIds.filter(id => !userGenIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(403).json({ message: "Some generations do not belong to you" });
      }

      const tag = await storage.getTag(tagId);
      if (!tag || tag.userId !== userId) {
        return res.status(403).json({ message: "Tag not found or does not belong to you" });
      }

      await storage.bulkAddTag(generationIds, tagId);
      res.json({ success: true, message: `Tag added to ${generationIds.length} generations` });
    } catch (error) {
      console.error('Error bulk adding tag:', error);
      res.status(500).json({ message: "Failed to add tag to generations" });
    }
  });

  // Bulk remove tag
  app.post('/api/generations/bulk/remove-tag', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const schema = z.object({
        generationIds: z.array(z.string().uuid()).min(1),
        tagId: z.string().uuid()
      });
      
      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const { generationIds, tagId } = validationResult.data;

      const userGenerations = await storage.getUserGenerations(userId);
      const userGenIds = new Set(userGenerations.map(g => g.id));
      const invalidIds = generationIds.filter(id => !userGenIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(403).json({ message: "Some generations do not belong to you" });
      }

      await storage.bulkRemoveTag(generationIds, tagId);
      res.json({ success: true, message: `Tag removed from ${generationIds.length} generations` });
    } catch (error) {
      console.error('Error bulk removing tag:', error);
      res.status(500).json({ message: "Failed to remove tag from generations" });
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

  // Clone a voice - Uses direct ElevenLabs API
  app.post('/api/voice-clone', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Check if ElevenLabs is configured
      if (!isElevenLabsConfigured()) {
        return res.status(503).json({ 
          message: "Voice cloning is not available. ElevenLabs API key is not configured." 
        });
      }

      // Validate request
      const validationResult = cloneVoiceRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error?.errors || []
        });
      }

      const { name, description, audioFiles } = validationResult.data!;
      const cost = 100; // Voice cloning cost

      // Validate audio files before deducting credits
      if (!audioFiles || audioFiles.length === 0) {
        return res.status(400).json({ message: "At least one audio file is required for voice cloning" });
      }

      // Validate all files are base64 data URLs (prevent SSRF)
      for (const file of audioFiles) {
        if (!file.startsWith('data:audio/') && !file.startsWith('data:video/')) {
          return res.status(400).json({ message: "Only base64 encoded audio files are accepted" });
        }
      }

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Process audio files for ElevenLabs (convert base64 to buffers)
        console.log(`[VoiceClone] Processing ${audioFiles.length} audio files for ElevenLabs...`);
        const audioBuffers = await elevenLabsProcessAudioFiles(audioFiles);
        console.log(`[VoiceClone] ✓ Processed ${audioBuffers.length} audio files`);

        // Call direct ElevenLabs voice cloning API  
        console.log(`[VoiceClone] Calling ElevenLabs API with name: "${name}"`);
        const result = await elevenLabsCloneVoice({
          name,
          description,
          audioBuffers,
        });
        console.log(`[VoiceClone] ✓ Voice cloned successfully: ${result.voice_id}`);

        // Save voice clone to database
        const voiceClone = await storage.createVoiceClone({
          userId,
          name,
          voiceId: result.voice_id,
          description: description || '',
          provider: 'elevenlabs',
          isActive: true,
        });

        res.json({ 
          success: true, 
          voiceClone,
          message: "Voice cloned successfully! You can now use this voice in Text-to-Speech." 
        });
      } catch (error: any) {
        // Log full error details for debugging
        console.error('[VoiceClone] Voice cloning failed:', {
          message: error.message,
          stack: error.stack,
        });
        
        // Refund credits if voice cloning failed
        storage.getUser(userId).then(user => {
          if (user && typeof user.credits === 'number') {
            storage.updateUserCredits(userId, user.credits + cost);
            console.log(`[VoiceClone] Refunded ${cost} credits to user ${userId}`);
          }
        }).catch(err => console.error('[VoiceClone] Failed to refund credits:', err));
        throw error;
      }
    } catch (error: any) {
      console.error('[VoiceClone] Error:', error.message);
      const errorMessage = error.message || "Voice cloning failed. Please check your audio files and try again.";
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

  // Delete voice clone - Also deletes from ElevenLabs
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

      // Try to delete from ElevenLabs as well (best effort)
      if (isElevenLabsConfigured() && existingVoice.provider === 'elevenlabs') {
        try {
          await elevenLabsDeleteVoice(voiceId);
          console.log(`[VoiceClone] Deleted voice ${voiceId} from ElevenLabs`);
        } catch (error: any) {
          // Log but don't fail - still delete from our database
          console.warn(`[VoiceClone] Could not delete voice ${voiceId} from ElevenLabs:`, error.message);
        }
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

  // ========== FISH.AUDIO ROUTES ==========

  // List Fish.Audio voices (public library + user's own)
  app.get('/api/fish-audio/voices', async (req: any, res) => {
    try {
      if (!isFishAudioConfigured()) {
        return res.status(503).json({ 
          message: "Fish.Audio is not available. API key is not configured." 
        });
      }

      const { 
        page_size = '20', 
        page_number = '1', 
        title, 
        tag, 
        self, 
        language,
        sort_by = 'score'
      } = req.query;

      const voices = await fishAudioListVoices({
        pageSize: parseInt(page_size as string),
        pageNumber: parseInt(page_number as string),
        title: title as string | undefined,
        tag: tag as string | undefined,
        self: self === 'true',
        language: language as string | undefined,
        sortBy: sort_by as 'score' | 'task_count' | 'created_at',
      });

      res.json(voices);
    } catch (error: any) {
      console.error('Error fetching Fish.Audio voices:', error);
      res.status(500).json({ message: error.message || "Failed to fetch voices" });
    }
  });

  // Get single Fish.Audio voice details
  app.get('/api/fish-audio/voices/:modelId', async (req, res) => {
    try {
      if (!isFishAudioConfigured()) {
        return res.status(503).json({ 
          message: "Fish.Audio is not available. API key is not configured." 
        });
      }

      const { modelId } = req.params;
      const voice = await fishAudioGetVoice(modelId);

      if (!voice) {
        return res.status(404).json({ message: "Voice not found" });
      }

      res.json(voice);
    } catch (error: any) {
      console.error('Error fetching Fish.Audio voice:', error);
      res.status(500).json({ message: error.message || "Failed to fetch voice" });
    }
  });

  // Fish.Audio TTS generation (synchronous - returns audio directly)
  app.post('/api/fish-audio/tts', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

      if (!isFishAudioConfigured()) {
        return res.status(503).json({ 
          message: "Fish.Audio is not available. API key is not configured." 
        });
      }

      const { 
        text, 
        referenceId, 
        temperature = 0.9, 
        topP = 0.9, 
        speed = 1, 
        volume = 0,
        format = 'mp3'
      } = req.body;

      if (!text || !referenceId) {
        return res.status(400).json({ message: "text and referenceId are required" });
      }

      if (text.length > 30000) {
        return res.status(400).json({ message: "Text exceeds maximum length of 30,000 characters" });
      }

      // Get TTS cost from database
      const cost = await getModelCost('fish-audio-tts');

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Generate speech using Fish.Audio S1 model
        const audioBuffer = await fishAudioGenerateSpeech({
          text,
          referenceId,
          format: format as 'mp3' | 'wav' | 'pcm' | 'opus',
          temperature,
          topP,
          speed,
          volume,
        });

        // Save audio to S3 or local storage for later playback/download
        const filename = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`;
        let audioUrl: string;
        
        if (s3.isS3Enabled()) {
          try {
            console.log(`[FishAudio TTS] Uploading audio to S3...`);
            const contentType = format === 'wav' ? 'audio/wav' : 
                               format === 'opus' ? 'audio/opus' : 'audio/mpeg';
            const result = await s3.uploadBuffer(audioBuffer, {
              prefix: 'uploads/audio',
              contentType,
              filename,
            });
            audioUrl = result.signedUrl;
            console.log(`✓ TTS audio uploaded to S3: ${result.key}`);
          } catch (s3Error) {
            console.error('[FishAudio TTS] S3 upload failed, falling back to local:', s3Error);
            const audioPath = `public/uploads/audio/${filename}`;
            const fsLocal = await import('fs/promises');
            await fsLocal.mkdir('public/uploads/audio', { recursive: true });
            await fsLocal.writeFile(audioPath, audioBuffer);
            audioUrl = `/uploads/audio/${filename}`;
          }
        } else {
          const audioPath = `public/uploads/audio/${filename}`;
          const fsLocal = await import('fs/promises');
          await fsLocal.mkdir('public/uploads/audio', { recursive: true });
          await fsLocal.writeFile(audioPath, audioBuffer);
          audioUrl = `/uploads/audio/${filename}`;
        }

        // Create generation record for history with audio URL
        await storage.createGeneration({
          userId,
          type: 'audio',
          model: 'fish-audio-s1',
          prompt: text.substring(0, 500),
          parameters: { referenceId, temperature, topP, speed, volume, format },
          status: 'completed',
          resultUrl: audioUrl,
          creditsCost: cost,
          generationType: 'text-to-speech',
        });

        // Set appropriate content type and send audio
        const contentType = format === 'wav' ? 'audio/wav' : 
                           format === 'opus' ? 'audio/opus' : 'audio/mpeg';
        
        res.set({
          'Content-Type': contentType,
          'Content-Length': audioBuffer.length.toString(),
          'Content-Disposition': `attachment; filename="tts_${Date.now()}.${format}"`,
        });
        
        res.send(audioBuffer);
      } catch (error: any) {
        // Refund credits on failure
        const currentUser = await storage.getUser(userId);
        if (currentUser && typeof currentUser.credits === 'number') {
          await storage.updateUserCredits(userId, currentUser.credits + cost);
          console.log(`[FishAudio] Refunded ${cost} credits to user ${userId}`);
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Fish.Audio TTS error:', error);
      res.status(500).json({ message: error.message || "Failed to generate speech" });
    }
  });

  // Fish.Audio Voice Cloning (create new voice model)
  app.post('/api/fish-audio/voice-clone', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

      if (!isFishAudioConfigured()) {
        return res.status(503).json({ 
          message: "Fish.Audio is not available. API key is not configured." 
        });
      }

      const { 
        title, 
        description, 
        visibility = 'private', 
        tags = [],
        audioFiles,
        texts = []
      } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ message: "Voice name (title) is required" });
      }

      if (!audioFiles || audioFiles.length === 0) {
        return res.status(400).json({ message: "At least one audio file is required" });
      }

      // Validate all files are base64 data URLs (prevent SSRF)
      for (const file of audioFiles) {
        if (!file.startsWith('data:audio/') && !file.startsWith('data:video/')) {
          return res.status(400).json({ message: "Only base64 encoded audio files are accepted" });
        }
      }

      // Get voice cloning cost from database
      const cost = await getModelCost('fish-audio-voice-clone');

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Process audio files (convert base64 to buffers)
        console.log(`[FishAudio] Processing ${audioFiles.length} audio files for cloning...`);
        const audioBuffers = await fishAudioProcessAudioFiles(audioFiles);
        console.log(`[FishAudio] ✓ Processed ${audioBuffers.length} audio files`);

        // Create voice model using Fish.Audio API
        console.log(`[FishAudio] Creating voice model: "${title}"`);
        const result = await fishAudioCreateVoiceModel({
          title: title.trim(),
          description: description?.trim(),
          visibility: visibility as 'public' | 'unlist' | 'private',
          tags,
          audioBuffers,
          texts,
          trainMode: 'fast',
        });
        console.log(`[FishAudio] ✓ Voice model created: ${result._id}`);

        // Save voice clone to database (for user's reference)
        const voiceClone = await storage.createVoiceClone({
          userId,
          name: title.trim(),
          voiceId: result._id,
          description: description?.trim() || '',
          provider: 'fish-audio',
          isActive: true,
        });

        res.json({ 
          success: true, 
          voiceClone,
          fishAudioModel: result,
          message: "Voice cloned successfully! It's now available in Text-to-Speech." 
        });
      } catch (error: any) {
        // Refund credits on failure
        const currentUser = await storage.getUser(userId);
        if (currentUser && typeof currentUser.credits === 'number') {
          await storage.updateUserCredits(userId, currentUser.credits + cost);
          console.log(`[FishAudio] Refunded ${cost} credits to user ${userId}`);
        }
        throw error;
      }
    } catch (error: any) {
      console.error('[FishAudio] Voice cloning error:', error);
      res.status(500).json({ message: error.message || "Voice cloning failed" });
    }
  });

  // Get user's Fish.Audio voice clones
  app.get('/api/fish-audio/my-voices', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const voices = await storage.getUserVoiceClones(userId);
      // Filter to only show Fish.Audio voices
      const fishAudioVoices = voices.filter(v => v.provider === 'fish-audio');
      res.json(fishAudioVoices);
    } catch (error) {
      console.error('Error fetching user Fish.Audio voices:', error);
      res.status(500).json({ message: "Failed to fetch your voices" });
    }
  });

  // Delete Fish.Audio voice clone
  app.delete('/api/fish-audio/voices/:voiceId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { voiceId } = req.params;

      // Verify ownership in our database
      const existingVoice = await storage.getVoiceClone(voiceId);
      if (!existingVoice) {
        return res.status(404).json({ message: "Voice clone not found" });
      }
      if (existingVoice.userId !== userId) {
        return res.status(403).json({ message: "Forbidden - not your voice clone" });
      }

      // Delete from Fish.Audio (best effort)
      if (isFishAudioConfigured() && existingVoice.provider === 'fish-audio') {
        try {
          await fishAudioDeleteVoiceModel(voiceId);
          console.log(`[FishAudio] Deleted voice model ${voiceId}`);
        } catch (error: any) {
          console.warn(`[FishAudio] Could not delete voice ${voiceId}:`, error.message);
        }
      }

      // Delete from our database
      await storage.deleteVoiceClone(voiceId);
      res.json({ success: true, message: "Voice clone deleted" });
    } catch (error) {
      console.error('Error deleting Fish.Audio voice:', error);
      res.status(500).json({ message: "Failed to delete voice clone" });
    }
  });

  // ========== SPEECH-TO-TEXT ROUTES ==========

  // Transcribe audio (STT) - Uses Fish Audio ASR API (synchronous)
  app.post('/api/stt/transcribe', requireJWT, async (req: any, res) => {
    let sttGeneration: any = undefined;
    
    try {
      const userId = req.user.id;

      if (!isFishAudioConfigured()) {
        return res.status(503).json({ 
          message: "Speech-to-Text is not available. Fish.Audio API key is not configured." 
        });
      }

      // Validate request
      const validationResult = generateSTTRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error?.errors || []
        });
      }

      const { audioFile, language, parameters } = validationResult.data!;
      const cost = await getModelCost('fish-audio-stt');

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Convert base64 audio to buffer for Fish Audio
        console.log('[FishAudio STT] Processing audio file...');
        const { buffer, mimeType, filename } = fishAudioBase64ToBuffer(audioFile);
        console.log(`[FishAudio STT] Audio buffer ready: ${buffer.length} bytes, ${mimeType}`);

        // Create STT generation record
        sttGeneration = await storage.createSttGeneration({
          userId,
          audioUrl: `base64:${filename}`,
          model: 'fish-audio-asr',
          language: language || null,
          transcription: null,
          status: 'processing',
          errorMessage: null,
          creditsCost: cost,
        });

        // Call Fish Audio ASR API directly (synchronous)
        const transcriptionResult = await fishAudioTranscribeAudio({
          audioBuffer: buffer,
          filename,
          mimeType,
          language: language || undefined,
          includeTimestamps: parameters?.timestamps || false,
        });

        // Format transcription with timestamps if available
        let formattedTranscription = transcriptionResult.text;
        if (parameters?.timestamps && transcriptionResult.segments && transcriptionResult.segments.length > 0) {
          formattedTranscription = transcriptionResult.segments.map(seg => 
            `[${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s] ${seg.text}`
          ).join('\n');
        }

        // Update generation with result
        await storage.updateSttGeneration(sttGeneration.id, {
          transcription: formattedTranscription,
          status: 'completed',
          completedAt: new Date(),
        });

        console.log(`[FishAudio STT] Transcription completed: ${formattedTranscription.length} chars`);

        return res.json({ 
          success: true, 
          generationId: sttGeneration.id,
          transcription: formattedTranscription,
          duration: transcriptionResult.duration,
          message: "Transcription completed" 
        });
      } catch (error: any) {
        console.error('[FishAudio STT] Error:', error);
        await storage.addCreditsAtomic(userId, cost);
        
        if (sttGeneration) {
          await storage.updateSttGeneration(sttGeneration.id, {
            status: 'failed',
            errorMessage: error.message || 'Transcription failed',
            completedAt: new Date(),
          });
        }
        
        return res.status(500).json({ message: error.message || "Failed to transcribe audio" });
      }
    } catch (error: any) {
      console.error('[FishAudio STT] Transcription error:', error);
      return res.status(500).json({ message: error.message || "Failed to transcribe audio" });
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

      const { sourceImage, audioUrl: audioInput, provider, parameters } = validationResult.data;
      const cost = await getModelCost(provider);

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Host image
        const [imageUrl] = await saveBase64Images([sourceImage]);
        
        // Convert base64 audio to hosted URL if needed
        let hostedAudioUrl = audioInput;
        if (audioInput.startsWith('data:audio/') || audioInput.startsWith('data:video/')) {
          console.log('Converting base64 audio to hosted URL for avatar...');
          hostedAudioUrl = await saveBase64Audio(audioInput);
          console.log(`✓ Audio hosted at: ${hostedAudioUrl}`);
        }

        // Create as a regular generation with type 'talking-avatar' so it appears in My Library
        const generation = await storage.createGeneration({
          userId,
          type: 'talking-avatar',
          model: provider,
          prompt: 'Talking Avatar Generation', // Store description in prompt field
          parameters: {
            sourceImageUrl: imageUrl,
            audioUrl: hostedAudioUrl,
            quality: parameters?.quality || '720p',
            emotion: parameters?.emotion || undefined,
          },
          status: 'pending',
          creditsCost: cost,
        });

        // Background processing
        (async () => {
          try {
            const callbackUrl = getCallbackUrl(generation.id);
            
            // Use the correct generator based on provider
            let result;
            if (provider === 'infinite-talk') {
              // Use InfiniteTalk lip-sync generator
              const lipSyncResult = await generateLipSync({
                imageUrl: imageUrl,
                audioUrl: hostedAudioUrl,
                prompt: parameters?.emotion,
                resolution: parameters?.quality || '720p',
                seed: parameters?.seed, // Pass seed for reproducibility
                callBackUrl: callbackUrl,
              });
              result = lipSyncResult.result;
            } else {
              // Use Kling AI avatar generator (default)
              const klingResult = await generateKlingAvatar({
                sourceImageUrl: imageUrl,
                script: hostedAudioUrl, // Pass audio URL as script
                provider,
                parameters: parameters || undefined,
                callBackUrl: callbackUrl,
              });
              result = klingResult.result;
            }

            const taskId = result?.data?.taskId || result?.taskId;
            const directUrl = result?.url || result?.videoUrl || result?.data?.url;

            if (directUrl) {
              await storage.updateGeneration(generation.id, {
                status: 'completed',
                resultUrl: directUrl,
                completedAt: new Date(),
              });
            } else if (taskId) {
              await storage.updateGeneration(generation.id, {
                status: 'processing',
                resultUrl: taskId, // Store taskId as resultUrl temporarily
              });
            } else {
              throw new Error('No taskId or URL returned');
            }
          } catch (error: any) {
            await storage.addCreditsAtomic(userId, cost);
            
            let errorMsg = error.message;
            if (error.message?.includes('404') || error.message?.includes('Not Found')) {
              errorMsg = 'Talking Avatar feature is temporarily unavailable on Kie.ai. Please try again later or contact support.';
            }
            
            await storage.updateGeneration(generation.id, {
              status: 'failed',
              errorMessage: errorMsg,
            });
          }
        })();

        res.json({ generationId: generation.id, message: "Avatar generation started" });
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

  // ========== LIP SYNC ROUTES ==========

  // Generate lip-sync video
  app.post('/api/lip-sync/generate', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let { imageUrl, audioUrl, prompt, resolution, seed } = req.body;

      // Validate required fields
      if (!imageUrl || !audioUrl) {
        return res.status(400).json({ message: "Image URL and audio URL are required" });
      }

      const modelName = resolution === '480p' ? 'infinitalk-lip-sync-480p' : 'infinitalk-lip-sync-720p';
      const cost = await getModelCost(modelName);

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Convert base64 image to hosted URL if needed
        if (imageUrl.startsWith('data:image/')) {
          console.log('Converting base64 image to hosted URL for lip sync...');
          imageUrl = await saveBase64Image(imageUrl);
          console.log(`✓ Image hosted at: ${imageUrl}`);
        }

        // Convert base64 audio to hosted URL if needed (includes audio/* and video/webm for recorded audio)
        if (audioUrl.startsWith('data:audio/') || audioUrl.startsWith('data:video/')) {
          console.log('Converting base64 audio to hosted URL for lip sync...');
          audioUrl = await saveBase64Audio(audioUrl);
          console.log(`✓ Audio hosted at: ${audioUrl}`);
        }

        const generation = await storage.createGeneration({
          userId,
          type: 'video',
          model: modelName,
          prompt: prompt || 'Lip sync generation',
          parameters: {
            resolution: resolution || '720p',
            seed: seed || null,
            imageUrl,
            audioUrl,
          },
          generationType: 'lip-sync',
          status: 'pending',
          creditsCost: cost,
        });

        // Background processing
        (async () => {
          try {
            const callbackUrl = getCallbackUrl(generation.id);
            const { result } = await generateLipSync({
              imageUrl,
              audioUrl,
              prompt: prompt || undefined,
              resolution: (resolution || '720p') as '480p' | '720p',
              seed: seed ? parseInt(seed, 10) : undefined,
              callBackUrl: callbackUrl,
            });

            const taskId = result?.data?.taskId || result?.taskId;
            const directUrl = result?.url || result?.videoUrl || result?.data?.url;

            if (directUrl) {
              await storage.finalizeGeneration(generation.id, 'success', {
                resultUrl: directUrl,
              });
            } else if (taskId) {
              await storage.updateGeneration(generation.id, {
                status: 'processing',
                externalTaskId: taskId,
                statusDetail: 'queued',
              });
            } else {
              throw new Error('No taskId or URL returned');
            }
          } catch (error: any) {
            await storage.addCreditsAtomic(userId, cost);
            await storage.finalizeGeneration(generation.id, 'failure', {
              errorMessage: error.message,
            });
          }
        })();

        res.json({ generationId: generation.id, message: "Lip sync generation started" });
      } catch (error: any) {
        await storage.addCreditsAtomic(userId, cost);
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to generate lip sync video" });
    }
  });

  // Get user's lip-sync generations
  app.get('/api/lip-sync/generations', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const generations = await storage.getUserGenerations(userId);
      const lipSyncGenerations = generations.filter((g) => g.generationType === 'lip-sync');
      res.json(lipSyncGenerations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lip-sync generations" });
    }
  });

  // ========== TESTIMONIAL ROUTES ==========
  // Combined TTS + Lip-Sync workflow for testimonial videos

  // Generate testimonial video (text-to-speech + lip-sync)
  app.post('/api/testimonial/generate', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let { imageUrl, text, resolution, voiceId } = req.body;

      // Validate required fields
      if (!imageUrl) {
        return res.status(400).json({ message: "Image URL is required" });
      }
      if (!text || !text.trim()) {
        return res.status(400).json({ message: "Testimonial text is required" });
      }

      // Check Fish Audio is configured
      if (!isFishAudioConfigured()) {
        return res.status(503).json({ 
          message: "Testimonial generation is not available. Fish.Audio API key is not configured." 
        });
      }

      // Default voice for testimonials - use Fish Audio default S1 model voice
      // Or allow custom voice ID for cloned voices
      const testimonialVoiceId = voiceId || '7f92f8afb8ec43bf81429cc1c9199cb1'; // Fish Audio default voice
      
      // Calculate total cost: TTS + Lip-sync
      const lipSyncModelName = resolution === '480p' ? 'infinitalk-lip-sync-480p' : 'infinitalk-lip-sync-720p';
      const lipSyncCost = await getModelCost(lipSyncModelName);
      const ttsCost = await getModelCost('fish-audio-tts');
      const totalCost = lipSyncCost + ttsCost;

      // Deduct credits upfront for both TTS and lip-sync
      const user = await storage.deductCreditsAtomic(userId, totalCost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Create the testimonial generation record
        const generation = await storage.createGeneration({
          userId,
          type: 'video',
          model: lipSyncModelName,
          prompt: text.trim(),
          parameters: {
            resolution: resolution || '720p',
            imageUrl,
            testimonialText: text.trim(),
            voiceId: testimonialVoiceId,
            workflow: 'testimonial',
          },
          generationType: 'testimonial',
          status: 'pending',
          creditsCost: totalCost,
        });

        // Background processing: TTS first (synchronous with Fish Audio), then Lip-Sync
        (async () => {
          try {
            await storage.updateGeneration(generation.id, { 
              status: 'processing',
              statusDetail: 'generating_audio'
            });
            
            console.log(`🎙️ [Testimonial ${generation.id}] Starting Fish Audio TTS generation...`);
            
            // Generate TTS using Fish Audio (synchronous - returns audio buffer directly)
            const audioBuffer = await fishAudioGenerateSpeech({
              text: text.trim(),
              referenceId: testimonialVoiceId,
              format: 'mp3',
              temperature: 0.9,
              topP: 0.9,
              speed: 1,
              volume: 0,
            });
            
            console.log(`✓ [Testimonial ${generation.id}] TTS generated: ${audioBuffer.length} bytes`);
            
            // Save audio buffer to storage to get a URL for lip sync
            const filename = `testimonial-tts-${generation.id}-${Date.now()}.mp3`;
            let audioUrl: string;
            
            if (s3.isS3Enabled()) {
              // Upload to S3
              const result = await s3.uploadBuffer(audioBuffer, {
                prefix: 'uploads/audio',
                contentType: 'audio/mpeg',
                filename,
              });
              audioUrl = result.signedUrl;
              console.log(`✓ [Testimonial ${generation.id}] Audio uploaded to S3: ${audioUrl}`);
            } else {
              // Fall back to local storage (public/uploads is served by express.static)
              const audioDir = path.join(process.cwd(), 'public', 'uploads', 'audio');
              await fs.mkdir(audioDir, { recursive: true });
              const audioPath = path.join(audioDir, filename);
              await fs.writeFile(audioPath, audioBuffer);
              audioUrl = `${getBaseUrl()}/uploads/audio/${filename}`;
              console.log(`✓ [Testimonial ${generation.id}] Audio saved locally: ${audioUrl}`);
            }
            
            // Proceed to lip-sync with the generated audio
            await startLipSyncForTestimonial(generation.id, userId, imageUrl, audioUrl, resolution);
            
          } catch (error: any) {
            console.error(`❌ [Testimonial ${generation.id}] Failed:`, error);
            
            // Refund credits
            await storage.addCreditsAtomic(userId, totalCost);
            console.log(`💰 [Testimonial ${generation.id}] Refunded ${totalCost} credits`);
            
            await storage.finalizeGeneration(generation.id, 'failure', {
              errorMessage: error.message || 'Testimonial generation failed'
            });
          }
        })();

        res.json({ 
          generationId: generation.id, 
          message: "Testimonial video generation started" 
        });
      } catch (error: any) {
        await storage.addCreditsAtomic(userId, totalCost);
        throw error;
      }
    } catch (error: any) {
      console.error('[Testimonial] Error:', error);
      res.status(500).json({ message: error.message || "Failed to generate testimonial video" });
    }
  });

  // Helper function to start lip-sync for testimonial
  async function startLipSyncForTestimonial(
    testimonialId: string,
    userId: string,
    imageUrl: string,
    audioUrl: string,
    resolution: string = '720p'
  ) {
    try {
      await storage.updateGeneration(testimonialId, { 
        statusDetail: 'generating_video'
      });
      
      console.log(`🎥 [Testimonial ${testimonialId}] Starting lip-sync generation...`);
      
      const callbackUrl = getCallbackUrl(testimonialId);
      const { result } = await generateLipSync({
        imageUrl,
        audioUrl,
        resolution: (resolution || '720p') as '480p' | '720p',
        callBackUrl: callbackUrl,
      });

      const taskId = result?.data?.taskId || result?.taskId;
      const directUrl = result?.url || result?.videoUrl || result?.data?.url;

      if (directUrl) {
        console.log(`✓ [Testimonial ${testimonialId}] Lip-sync completed immediately`);
        await storage.finalizeGeneration(testimonialId, 'success', {
          resultUrl: directUrl,
        });
      } else if (taskId) {
        console.log(`📋 [Testimonial ${testimonialId}] Lip-sync queued with taskId: ${taskId}`);
        await storage.updateGeneration(testimonialId, {
          status: 'processing',
          externalTaskId: taskId,
          statusDetail: 'lip_sync_processing',
        });
      } else {
        throw new Error('Lip-sync API did not return taskId or video URL');
      }
    } catch (error: any) {
      console.error(`❌ [Testimonial ${testimonialId}] Lip-sync failed:`, error);
      throw error;
    }
  }

  // Get user's testimonial generations
  app.get('/api/testimonial/generations', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const generations = await storage.getUserGenerations(userId);
      const testimonialGenerations = generations.filter((g) => g.generationType === 'testimonial');
      res.json(testimonialGenerations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch testimonial generations" });
    }
  });

  // Get specific testimonial generation
  app.get('/api/testimonial/generations/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const generation = await storage.getGeneration(id);
      
      if (!generation || generation.userId !== userId) {
        return res.status(404).json({ message: "Generation not found" });
      }
      
      res.json(generation);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch generation" });
    }
  });

  // ========== SUNO AUDIO PROCESSING ROUTES ==========
  // These routes process Suno-generated music (require taskId and audioId from music generation)

  // Process Suno audio (WAV conversion, vocal removal, stem separation)
  app.post('/api/music/process', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { generationId, operation, separationType } = req.body;

      if (!generationId || !operation) {
        return res.status(400).json({ message: "generationId and operation are required" });
      }

      if (!['wav-conversion', 'vocal-removal', 'stem-separation'].includes(operation)) {
        return res.status(400).json({ message: "Invalid operation. Must be wav-conversion, vocal-removal, or stem-separation" });
      }

      // Get the original music generation to extract taskId and audioId
      const originalGen = await storage.getGeneration(generationId);
      if (!originalGen) {
        return res.status(404).json({ message: "Original generation not found" });
      }

      if (originalGen.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to process this generation" });
      }

      if (originalGen.type !== 'music') {
        return res.status(400).json({ message: "Can only process music generations created with Suno" });
      }

      // Extract taskId and audioId from the original generation
      const taskId = originalGen.externalTaskId;
      const audioId = (originalGen.parameters as any)?.audioId;

      if (!taskId || !audioId) {
        return res.status(400).json({ 
          message: "This music track is missing required identifiers for processing. It may have been generated before this feature was available." 
        });
      }

      // Get cost based on operation (uses model names from defaults: wav-conversion, vocal-removal, stem-separation)
      const cost = await getModelCost(operation);

      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Create a new generation record for the processed audio (will show in My Library)
        const processTypeLabel = operation === 'wav-conversion' ? 'WAV Conversion' : 
                                 operation === 'vocal-removal' ? 'Vocal Removal' : 'Stem Separation';
        
        const newGeneration = await storage.createGeneration({
          userId,
          type: 'audio', // New type for processed audio
          generationType: operation,
          model: `suno-${operation}`,
          prompt: `${processTypeLabel} of "${originalGen.prompt?.substring(0, 50) || 'Music'}"`,
          parameters: { 
            sourceGenerationId: generationId,
            sourceTaskId: taskId,
            sourceAudioId: audioId,
            operation,
            separationType: separationType || (operation === 'stem-separation' ? 'split_stem' : 'separate_vocal'),
          },
          status: 'pending',
          creditsCost: cost,
        });

        // Process in background
        (async () => {
          try {
            await storage.updateGeneration(newGeneration.id, { status: 'processing' });

            const callbackUrl = getCallbackUrl(newGeneration.id);
            const { processAudio } = await import('./kieai');
            const { result, keyName } = await processAudio({
              taskId,
              audioId,
              operation: operation as 'wav-conversion' | 'vocal-removal' | 'stem-separation',
              separationType: separationType || (operation === 'stem-separation' ? 'split_stem' : 'separate_vocal'),
              callBackUrl: callbackUrl,
            });

            const responseTaskId = result?.data?.taskId || result?.taskId;

            if (responseTaskId) {
              await storage.updateGeneration(newGeneration.id, {
                status: 'processing',
                apiKeyUsed: keyName,
                externalTaskId: responseTaskId,
                statusDetail: 'queued',
              });
              console.log(`📋 Audio processing task queued: ${responseTaskId}`);
            } else {
              throw new Error('No taskId returned from API');
            }
          } catch (error: any) {
            await storage.addCreditsAtomic(userId, cost);
            await storage.finalizeGeneration(newGeneration.id, 'failure', {
              errorMessage: error.message,
            });
          }
        })();

        res.json({ 
          generationId: newGeneration.id, 
          message: `${processTypeLabel} started. Check My Library for results.` 
        });
      } catch (error: any) {
        await storage.addCreditsAtomic(userId, cost);
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to process audio" });
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

  // Admin: Create new user
  app.post('/api/admin/users', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { email, password, firstName, lastName, credits, isAdmin } = req.body;
      
      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
      
      // Hash the password
      const bcrypt = await import('bcrypt');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create the user
      const newUser = await storage.upsertUser({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        authProvider: 'local',
        firstName: firstName || null,
        lastName: lastName || null,
        credits: credits || 0,
        isAdmin: isAdmin || false,
      });
      
      console.log(`[ADMIN] User created by admin ${admin?.email}: ${newUser.email} (isAdmin: ${newUser.isAdmin})`);
      
      res.status(201).json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        credits: newUser.credits,
        isAdmin: newUser.isAdmin,
        createdAt: newUser.createdAt,
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: "Failed to create user", error: error.message });
    }
  });

  // Admin: Toggle user admin status
  app.patch('/api/admin/users/:userId/admin', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { userId } = req.params;
      const { isAdmin: newAdminStatus } = req.body;
      
      if (typeof newAdminStatus !== 'boolean') {
        return res.status(400).json({ message: "isAdmin must be a boolean" });
      }
      
      // Prevent admin from removing their own admin status
      if (userId === adminId && !newAdminStatus) {
        return res.status(400).json({ message: "You cannot remove your own admin status" });
      }
      
      // Get the target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update admin status using db directly
      const { db } = await import('./db');
      const { users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [updatedUser] = await db
        .update(users)
        .set({ isAdmin: newAdminStatus, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      
      console.log(`[ADMIN] User admin status changed by ${admin?.email}: ${targetUser.email} -> isAdmin: ${newAdminStatus}`);
      
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
        message: newAdminStatus ? "User is now an admin" : "User admin status removed"
      });
    } catch (error: any) {
      console.error('Error updating admin status:', error);
      res.status(500).json({ message: "Failed to update admin status", error: error.message });
    }
  });

  // Admin: Provision Social Media Poster for a user (manual testing)
  app.post('/api/admin/users/:userId/social-poster', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user already has Social Poster
      if (targetUser.hasSocialPoster) {
        return res.status(400).json({ message: "User already has Social Media Poster access" });
      }

      // Check if GetLate is configured
      if (!getLateService.isConfigured()) {
        return res.status(503).json({ message: "Social media integration is not configured" });
      }

      // Provision GetLate profile
      const userName = targetUser.firstName ? `${targetUser.firstName} ${targetUser.lastName || ''}`.trim() : undefined;
      const getLateProfile = await getLateService.ensureUserProfile(userId, userName);
      console.log(`[GetLate] Created profile: ${getLateProfile.name} for user: ${targetUser.email}`);

      // Create social profile in database
      const { db } = await import('./db');
      const { users, socialProfiles } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      await db.transaction(async (tx) => {
        // Check if profile already exists
        const [existingProfile] = await tx
          .select()
          .from(socialProfiles)
          .where(eq(socialProfiles.userId, userId));

        if (!existingProfile) {
          await tx.insert(socialProfiles).values({
            userId,
            getLateProfileId: getLateProfile._id,
            isActive: true,
          });
        } else {
          // Update existing profile with GetLate ID
          await tx
            .update(socialProfiles)
            .set({ 
              getLateProfileId: getLateProfile._id,
              isActive: true 
            })
            .where(eq(socialProfiles.userId, userId));
        }

        // Update user with Social Poster flag (no subscription ID for manual assignments)
        await tx
          .update(users)
          .set({
            hasSocialPoster: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      });

      console.log(`[ADMIN] Social Media Poster provisioned for ${targetUser.email} by ${admin?.email}`);

      res.json({ 
        success: true,
        message: "Social Media Poster access granted",
        getLateProfileId: getLateProfile._id
      });
    } catch (error: any) {
      console.error('Error provisioning Social Poster:', error);
      res.status(500).json({ message: "Failed to provision Social Media Poster", error: error.message });
    }
  });

  // Admin: Revoke Social Media Poster access
  app.delete('/api/admin/users/:userId/social-poster', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { db } = await import('./db');
      const { users, socialProfiles } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      // Cancel Stripe subscription if exists
      if (targetUser.socialPosterSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(targetUser.socialPosterSubscriptionId);
          console.log(`[ADMIN] Cancelled Social Poster subscription ${targetUser.socialPosterSubscriptionId}`);
        } catch (stripeError: any) {
          console.warn(`[ADMIN] Could not cancel subscription: ${stripeError.message}`);
        }
      }

      // Revoke access
      await db
        .update(users)
        .set({
          hasSocialPoster: false,
          socialPosterSubscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Deactivate social profile
      await db
        .update(socialProfiles)
        .set({ isActive: false })
        .where(eq(socialProfiles.userId, userId));

      console.log(`[ADMIN] Social Media Poster revoked for ${targetUser.email} by ${admin?.email}`);

      res.json({ 
        success: true,
        message: "Social Media Poster access revoked"
      });
    } catch (error: any) {
      console.error('Error revoking Social Poster:', error);
      res.status(500).json({ message: "Failed to revoke Social Media Poster", error: error.message });
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

  // Admin: Get Google Analytics site traffic data (shared handler)
  async function handleSiteAnalytics(req: any, res: any, days: number) {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { isGoogleAnalyticsConfigured, getSiteAnalyticsSummary } = await import('./services/googleAnalytics');
      
      console.log('[Site Analytics] Checking configuration...');
      if (!isGoogleAnalyticsConfigured()) {
        console.log('[Site Analytics] Not configured, returning false');
        return res.json({ 
          configured: false,
          message: "Google Analytics not configured. Please set GA_DATA_CLIENT_EMAIL, GA_DATA_PRIVATE_KEY, and GA_PROPERTY_ID."
        });
      }

      console.log('[Site Analytics] Fetching data for', days, 'days');
      const summary = await getSiteAnalyticsSummary(days);
      
      res.json({
        configured: true,
        ...summary,
      });
    } catch (error: any) {
      console.error('[Site Analytics] Error:', error.message);
      res.status(500).json({ 
        message: "Failed to fetch site analytics",
        error: error.message 
      });
    }
  }

  // Route with path parameter (frontend uses queryKey.join("/"))
  app.get('/api/admin/site-analytics/:days', requireJWT, async (req: any, res) => {
    const days = parseInt(req.params.days) || 30;
    return handleSiteAnalytics(req, res, days);
  });

  // Route with query parameter (legacy support)
  app.get('/api/admin/site-analytics', requireJWT, async (req: any, res) => {
    const days = parseInt(req.query.days as string) || 30;
    return handleSiteAnalytics(req, res, days);
  });

  // Admin: Get error monitor stats
  app.get('/api/admin/errors/stats', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { getErrorStats } = await import('./services/errorMonitor');
      const stats = getErrorStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching error stats:', error);
      res.status(500).json({ message: "Failed to fetch error stats" });
    }
  });

  // Admin: Get recent errors
  app.get('/api/admin/errors', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { getRecentErrors } = await import('./services/errorMonitor');
      const severity = req.query.severity as string | undefined;
      const category = req.query.category as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const errors = getRecentErrors({ 
        severity: severity as any, 
        category: category as any,
        limit,
        includeResolved: req.query.includeResolved === 'true'
      });
      res.json(errors);
    } catch (error) {
      console.error('Error fetching errors:', error);
      res.status(500).json({ message: "Failed to fetch errors" });
    }
  });

  // Admin: Resolve an error
  app.patch('/api/admin/errors/:errorId/resolve', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { resolveError } = await import('./services/errorMonitor');
      const { errorId } = req.params;
      const resolved = resolveError(errorId);
      
      if (resolved) {
        res.json({ success: true, message: 'Error marked as resolved' });
      } else {
        res.status(404).json({ success: false, message: 'Error not found' });
      }
    } catch (error) {
      console.error('Error resolving error:', error);
      res.status(500).json({ message: "Failed to resolve error" });
    }
  });

  // Admin: Get rate limit stats
  app.get('/api/admin/rate-limits', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { getRateLimitStats } = await import('./services/rateLimiter');
      const stats = getRateLimitStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching rate limit stats:', error);
      res.status(500).json({ message: "Failed to fetch rate limit stats" });
    }
  });

  // Admin: Get all generations for showcase management
  app.get('/api/admin/generations', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const generations = await storage.getAllGenerations();
      
      // Filter to only video generations, sort by newest first
      const videoGenerations = generations
        .filter((g: any) => g.type === 'video' && g.status === 'completed' && g.resultUrl)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(videoGenerations);
    } catch (error) {
      console.error('Error fetching generations for admin:', error);
      res.status(500).json({ message: "Failed to fetch generations" });
    }
  });

  // Admin: Toggle showcase status for any generation
  app.patch('/api/admin/generations/:id/showcase', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { id } = req.params;
      
      // Validate request body
      const bodySchema = z.object({
        isShowcase: z.boolean()
      });
      
      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }
      
      const { isShowcase } = validationResult.data;

      // Verify the generation exists
      const generation = await storage.getGeneration(id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }

      // Only completed video generations with resultUrl can be showcased
      if (generation.status !== 'completed') {
        return res.status(400).json({ message: "Only completed generations can be showcased" });
      }
      
      if (generation.type !== 'video') {
        return res.status(400).json({ message: "Only video generations can be showcased" });
      }
      
      if (!generation.resultUrl) {
        return res.status(400).json({ message: "Generation must have a valid result URL" });
      }

      // Update the showcase status
      const updated = await storage.updateGeneration(id, { isShowcase });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update showcase status" });
      }

      res.json({ 
        success: true, 
        isShowcase: updated.isShowcase,
        message: updated.isShowcase ? "Added to showcase" : "Removed from showcase"
      });
    } catch (error) {
      console.error('Error toggling showcase status (admin):', error);
      res.status(500).json({ message: "Failed to update showcase status" });
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

  app.delete('/api/admin/pricing/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { id } = req.params;
      const deleted = await storage.deletePricing(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Pricing entry not found' });
      }

      res.json({ success: true, message: 'Pricing entry deleted' });
    } catch (error: any) {
      console.error('Error deleting pricing:', error);
      res.status(400).json({ message: 'Failed to delete pricing', error: error.message });
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

  // ========== CREDIT BOOST SETTINGS ROUTES ==========
  
  // Admin: Get boost settings (subset of plan economics)
  app.get('/api/admin/boost-settings', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const economics = await storage.getPlanEconomics();
      // Return boost-specific settings with defaults
      if (!economics) {
        return res.json({
          boostEnabled: false,
          boostCredits: 300,
          boostPriceUsd: 1500,
          boostStripeProductId: null,
          boostStripePriceId: null,
        });
      }
      
      res.json({
        boostEnabled: economics.boostEnabled ?? false,
        boostCredits: economics.boostCredits ?? 300,
        boostPriceUsd: economics.boostPriceUsd ?? 1500,
        boostStripeProductId: economics.boostStripeProductId ?? null,
        boostStripePriceId: economics.boostStripePriceId ?? null,
      });
    } catch (error) {
      console.error('Error fetching boost settings:', error);
      res.status(500).json({ message: "Failed to fetch boost settings" });
    }
  });

  // Admin: Update boost settings (updates plan economics singleton)
  app.patch('/api/admin/boost-settings', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate boost-specific fields
      const boostSettingsSchema = z.object({
        boostEnabled: z.boolean().optional(),
        boostCredits: z.number().int().min(1).optional(),
        boostPriceUsd: z.number().int().min(100).optional(), // Min $1.00 (100 cents)
        boostStripeProductId: z.string().optional().nullable(),
        boostStripePriceId: z.string().optional().nullable(),
      });
      
      const validatedData = boostSettingsSchema.parse(req.body);
      
      // Convert null to undefined for storage compatibility
      const storageData = {
        ...validatedData,
        boostStripeProductId: validatedData.boostStripeProductId ?? undefined,
        boostStripePriceId: validatedData.boostStripePriceId ?? undefined,
      };

      const updated = await storage.upsertPlanEconomics(storageData);
      
      res.json({
        boostEnabled: updated.boostEnabled ?? false,
        boostCredits: updated.boostCredits ?? 300,
        boostPriceUsd: updated.boostPriceUsd ?? 1500,
        boostStripeProductId: updated.boostStripeProductId ?? null,
        boostStripePriceId: updated.boostStripePriceId ?? null,
      });
    } catch (error: any) {
      console.error('Error updating boost settings:', error);
      res.status(400).json({ message: 'Failed to update boost settings', error: error.message });
    }
  });

  // Admin: Get Social Poster settings
  app.get('/api/admin/social-poster-settings', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const economics = await storage.getPlanEconomics();
      // Return Social Poster-specific settings with defaults
      if (!economics) {
        return res.json({
          socialPosterEnabled: true,
          socialPosterHasAnnualPlan: false,
          socialPosterMonthlyPriceUsd: 4000, // $40/month
          socialPosterAnnualPriceUsd: 24000, // $240/year ($20/month)
          socialPosterMonthlyStripeProductId: null,
          socialPosterMonthlyStripePriceId: null,
          socialPosterAnnualStripeProductId: null,
          socialPosterAnnualStripePriceId: null,
        });
      }
      
      res.json({
        socialPosterEnabled: economics.socialPosterEnabled ?? true,
        socialPosterHasAnnualPlan: economics.socialPosterHasAnnualPlan ?? false,
        socialPosterMonthlyPriceUsd: economics.socialPosterMonthlyPriceUsd ?? 4000,
        socialPosterAnnualPriceUsd: economics.socialPosterAnnualPriceUsd ?? 24000,
        socialPosterMonthlyStripeProductId: economics.socialPosterMonthlyStripeProductId ?? null,
        socialPosterMonthlyStripePriceId: economics.socialPosterMonthlyStripePriceId ?? null,
        socialPosterAnnualStripeProductId: economics.socialPosterAnnualStripeProductId ?? null,
        socialPosterAnnualStripePriceId: economics.socialPosterAnnualStripePriceId ?? null,
      });
    } catch (error) {
      console.error('Error fetching Social Poster settings:', error);
      res.status(500).json({ message: "Failed to fetch Social Poster settings" });
    }
  });

  // Admin: Update Social Poster settings (updates plan economics singleton)
  app.patch('/api/admin/social-poster-settings', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate Social Poster-specific fields
      const socialPosterSettingsSchema = z.object({
        socialPosterEnabled: z.boolean().optional(),
        socialPosterHasAnnualPlan: z.boolean().optional(),
        socialPosterMonthlyPriceUsd: z.number().int().min(100).optional(), // Min $1.00 (100 cents)
        socialPosterAnnualPriceUsd: z.number().int().min(100).optional(), // Min $1.00 (100 cents)
        socialPosterMonthlyStripeProductId: z.string().optional().nullable(),
        socialPosterMonthlyStripePriceId: z.string().optional().nullable(),
        socialPosterAnnualStripeProductId: z.string().optional().nullable(),
        socialPosterAnnualStripePriceId: z.string().optional().nullable(),
      });
      
      const validatedData = socialPosterSettingsSchema.parse(req.body);
      
      // Convert null to undefined for storage compatibility
      const storageData = {
        ...validatedData,
        socialPosterMonthlyStripeProductId: validatedData.socialPosterMonthlyStripeProductId ?? undefined,
        socialPosterMonthlyStripePriceId: validatedData.socialPosterMonthlyStripePriceId ?? undefined,
        socialPosterAnnualStripeProductId: validatedData.socialPosterAnnualStripeProductId ?? undefined,
        socialPosterAnnualStripePriceId: validatedData.socialPosterAnnualStripePriceId ?? undefined,
      };

      const updated = await storage.upsertPlanEconomics(storageData);
      
      res.json({
        socialPosterEnabled: updated.socialPosterEnabled ?? true,
        socialPosterHasAnnualPlan: updated.socialPosterHasAnnualPlan ?? false,
        socialPosterMonthlyPriceUsd: updated.socialPosterMonthlyPriceUsd ?? 4000,
        socialPosterAnnualPriceUsd: updated.socialPosterAnnualPriceUsd ?? 24000,
        socialPosterMonthlyStripeProductId: updated.socialPosterMonthlyStripeProductId ?? null,
        socialPosterMonthlyStripePriceId: updated.socialPosterMonthlyStripePriceId ?? null,
        socialPosterAnnualStripeProductId: updated.socialPosterAnnualStripeProductId ?? null,
        socialPosterAnnualStripePriceId: updated.socialPosterAnnualStripePriceId ?? null,
      });
    } catch (error: any) {
      console.error('Error updating Social Poster settings:', error);
      res.status(400).json({ message: 'Failed to update Social Poster settings', error: error.message });
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

  // Admin: Reset and recreate all plans (purge duplicates, seed canonical plans)
  app.post('/api/admin/plans/reset', requireJWT, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const admin = await storage.getUser(adminId);
      
      if (!isUserAdmin(admin)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      console.log('🔄 [Admin] Starting plan reset...');

      // Execute the reset in a transaction
      const result = await storage.resetPlans();

      console.log(`✅ [Admin] Plan reset complete:`);
      console.log(`   - ${result.usersMigrated} user(s) migrated to free trial`);
      console.log(`   - ${result.plansDeleted} old plan(s) removed`);
      console.log(`   - ${result.plansCreated} new plan(s) created`);

      res.json({
        success: true,
        message: `Successfully reset plans: ${result.plansCreated} created, ${result.plansDeleted} removed, ${result.usersMigrated} users migrated to free trial`,
        stats: {
          plansCreated: result.plansCreated,
          plansDeleted: result.plansDeleted,
          usersMigrated: result.usersMigrated,
        },
        plans: result.plans
      });
    } catch (error: any) {
      console.error('❌ [Admin] Error resetting plans:', error);
      res.status(500).json({ message: error.message || "Failed to reset plans" });
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

  // ========== WELCOME ONBOARDING ROUTES ==========

  // Public: Get welcome onboarding content (video URL and slides)
  app.get('/api/welcome', async (req, res) => {
    try {
      const content = await storage.getHomePageContent();
      
      res.json({
        welcomeVideoUrl: content?.welcomeVideoUrl || null,
        welcomeSlides: content?.welcomeSlides || [],
      });
    } catch (error) {
      console.error('Error fetching welcome content:', error);
      res.status(500).json({ message: "Failed to fetch welcome content" });
    }
  });

  // Mark user as having seen the welcome onboarding
  app.post('/api/user/seen-welcome', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Update user's hasSeenWelcome flag
      await storage.updateUser(userId, { hasSeenWelcome: true });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating seen welcome status:', error);
      res.status(500).json({ message: "Failed to update welcome status" });
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
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
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
      
      // Convert string dates to Date objects if present
      const updateData: any = { ...validatedData };
      if (updateData.startDate && typeof updateData.startDate === 'string') {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate && typeof updateData.endDate === 'string') {
        updateData.endDate = new Date(updateData.endDate);
      }
      
      const announcement = await storage.updateAnnouncement(id, updateData);

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

      // Start combination in background with enhancements (with proper error handling)
      combineVideosInBackground(combination.id, videoUrls, enhancements).catch(error => {
        console.error(`Background video combination failed for ${combination.id}:`, error);
      });

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

  // ===== Video Editor Routes (Twick + AWS Lambda) =====
  
  // Store for tracking export jobs (in-memory for now, could be moved to DB)
  const videoExportJobs: Map<string, {
    status: 'processing' | 'completed' | 'failed';
    downloadUrl?: string;
    error?: string;
    createdAt: Date;
  }> = new Map();
  
  // Export video via AWS Lambda
  app.post('/api/video-editor/export', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { project, videoSettings } = req.body;
      
      if (!project || !project.clips || !Array.isArray(project.clips) || project.clips.length < 1) {
        return res.status(400).json({ message: "Project with at least one clip is required" });
      }
      
      const lambdaApiUrl = process.env.AWS_LAMBDA_API_URL;
      const s3Bucket = process.env.AWS_S3_BUCKET;
      
      if (!lambdaApiUrl || !s3Bucket) {
        console.error('AWS configuration missing:', { lambdaApiUrl: !!lambdaApiUrl, s3Bucket: !!s3Bucket });
        return res.status(500).json({ message: "Video export service not configured" });
      }
      
      // Generate unique job ID
      const jobId = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`[Video Editor] Starting export job ${jobId} for user ${userId} with ${project.clips.length} clips`);
      
      // Store job in tracking map
      videoExportJobs.set(jobId, {
        status: 'processing',
        createdAt: new Date(),
      });
      
      // Build standardized Lambda payload
      // Normalize clips to ensure they have sourceUrl (handle both url and sourceUrl from frontend)
      const normalizedClips = project.clips.map((clip: any, index: number) => {
        const sourceUrl = clip.sourceUrl || clip.url;
        if (!sourceUrl) {
          throw new Error(`Clip ${index + 1} is missing a video URL`);
        }
        return {
          id: clip.id || `clip-${index}`,
          sourceUrl,
          order: clip.order ?? index,
          startTime: clip.startTime,
          endTime: clip.endTime,
          transitionAfter: clip.transitionAfter,
        };
      });
      
      // Sort clips by order to ensure correct concatenation sequence
      normalizedClips.sort((a: any, b: any) => a.order - b.order);
      
      const lambdaPayload = {
        jobId,
        userId,
        outputBucket: s3Bucket,
        videoSettings: {
          format: videoSettings?.format || 'mp4',
          quality: videoSettings?.quality || 'high',
          frameRate: videoSettings?.frameRate,
          resolution: videoSettings?.resolution,
        },
        project: {
          clips: normalizedClips,
          audioTracks: project.audioTracks,
          watermark: project.watermark,
        },
        // Include callback URL for async completion notification
        callbackUrl: `${getBaseUrl()}/api/video-editor/callback/${jobId}`,
      };
      
      // Send to AWS Lambda
      // Lambda Function URLs don't need path suffixes - just call the root URL directly
      const fullLambdaUrl = lambdaApiUrl.replace(/\/+$/, '');
      
      const lambdaHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add API key if configured for API Gateway authentication
      const awsApiKey = process.env.AWS_API_KEY;
      if (awsApiKey) {
        lambdaHeaders['x-api-key'] = awsApiKey;
      }
      
      console.log(`[Video Editor] Calling Lambda at: ${fullLambdaUrl}`);
      console.log(`[Video Editor] Payload:`, JSON.stringify(lambdaPayload, null, 2));
      
      const lambdaResponse = await fetch(fullLambdaUrl, {
        method: 'POST',
        headers: lambdaHeaders,
        body: JSON.stringify(lambdaPayload),
      });
      
      if (!lambdaResponse.ok) {
        const errorText = await lambdaResponse.text();
        console.error(`[Video Editor] Lambda error for job ${jobId} (status ${lambdaResponse.status}):`, errorText);
        videoExportJobs.set(jobId, {
          status: 'failed',
          error: `Export service error: ${lambdaResponse.status}`,
          createdAt: new Date(),
        });
        
        // Provide more specific error messages
        let userMessage = "Failed to start video export";
        if (lambdaResponse.status === 403) {
          userMessage = "Export service authentication failed. Please contact support.";
        } else if (lambdaResponse.status === 404) {
          userMessage = "Export service not found. Please contact support.";
        } else if (lambdaResponse.status >= 500) {
          userMessage = "Export service is temporarily unavailable. Please try again later.";
        }
        
        return res.status(500).json({ message: userMessage });
      }
      
      const lambdaResult = await lambdaResponse.json();
      console.log(`[Video Editor] Lambda response for job ${jobId}:`, lambdaResult);
      
      // If Lambda returns immediate result (synchronous processing)
      if (lambdaResult.downloadUrl) {
        videoExportJobs.set(jobId, {
          status: 'completed',
          downloadUrl: lambdaResult.downloadUrl,
          createdAt: new Date(),
        });
        
        // Create generation record
        const generation = await storage.createGeneration({
          userId,
          type: 'video-editor',
          status: 'completed',
          resultUrl: lambdaResult.downloadUrl,
          model: 'Video Editor',
          prompt: 'Video Editor Export',
          parameters: videoSettings || {},
          creditsCost: 0, // Free for now, can add pricing later
          processingStage: 'completed',
        });
        
        // Generate thumbnail for the exported video (non-blocking)
        if (generation?.id) {
          generateThumbnail({
            videoUrl: lambdaResult.downloadUrl,
            generationId: generation.id,
            timestampSeconds: 2,
          }).then(async (thumbResult) => {
            await storage.updateGeneration(generation.id, { thumbnailUrl: thumbResult.thumbnailUrl });
            console.log(`✓ Thumbnail generated for video editor export ${generation.id}`);
          }).catch((error) => {
            console.error(`⚠️  Thumbnail generation failed for video editor export:`, error.message);
          });
        }
        
        return res.json({
          status: 'completed',
          jobId,
          downloadUrl: lambdaResult.downloadUrl,
        });
      }
      
      // Otherwise, return processing status for polling
      res.json({
        status: 'processing',
        jobId,
        message: 'Video export started',
      });
      
    } catch (error: any) {
      console.error('[Video Editor] Export error:', error);
      res.status(500).json({ message: error.message || "Failed to export video" });
    }
  });
  
  // Check export status
  app.get('/api/video-editor/export/:jobId', requireJWT, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const job = videoExportJobs.get(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Export job not found" });
      }
      
      res.json({
        status: job.status,
        downloadUrl: job.downloadUrl,
        error: job.error,
      });
      
    } catch (error: any) {
      console.error('[Video Editor] Status check error:', error);
      res.status(500).json({ message: error.message || "Failed to check export status" });
    }
  });
  
  // Lambda callback for async export completion
  // Security: Validate callback with shared secret from AWS Lambda
  app.post('/api/video-editor/callback/:jobId', async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const { status, downloadUrl, error, signature } = req.body;
      
      // Verify callback authenticity using shared secret
      const callbackSecret = process.env.AWS_LAMBDA_CALLBACK_SECRET;
      if (callbackSecret) {
        const crypto = await import('crypto');
        const expectedSignature = crypto.createHmac('sha256', callbackSecret)
          .update(jobId + status + (downloadUrl || ''))
          .digest('hex');
        
        if (signature !== expectedSignature) {
          console.warn(`[Video Editor] Invalid callback signature for job ${jobId}`);
          return res.status(401).json({ message: "Invalid signature" });
        }
      } else {
        // Log warning but allow in development
        console.warn('[Video Editor] AWS_LAMBDA_CALLBACK_SECRET not set - callback verification disabled');
      }
      
      console.log(`[Video Editor] Callback received for job ${jobId}:`, { status, downloadUrl, error });
      
      if (!videoExportJobs.has(jobId)) {
        console.warn(`[Video Editor] Unknown job ${jobId} in callback`);
        return res.status(404).json({ message: "Job not found" });
      }
      
      videoExportJobs.set(jobId, {
        status: status === 'completed' ? 'completed' : 'failed',
        downloadUrl,
        error,
        createdAt: videoExportJobs.get(jobId)!.createdAt,
      });
      
      res.json({ received: true });
      
    } catch (error: any) {
      console.error('[Video Editor] Callback error:', error);
      res.status(500).json({ message: error.message || "Callback processing failed" });
    }
  });

  // Stripe Billing Routes

  // Get all subscription plans (public route for billing page)
  app.get('/api/plans', async (req, res) => {
    try {
      const plans = await storage.getAllPlans();
      console.log('[API] /api/plans - Retrieved plans:', plans.length, 'plans');
      if (plans.length > 0) {
        console.log('[API] /api/plans - First plan:', JSON.stringify(plans[0], null, 2));
      }
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
  
  // NOTE: Stripe Webhook Handler is now in server/index.ts (BEFORE body parsing middleware)
  // This ensures the raw body is available for signature verification

  // Get user's subscription info (for checking if they have a paid plan)
  app.get('/api/billing/subscription-info', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.json({
          hasSubscription: false,
          isPaidPlan: false,
          planName: null,
          billingPeriod: null,
        });
      }

      const isPaidPlan = subscription.plan.billingPeriod !== 'trial';
      
      res.json({
        hasSubscription: true,
        isPaidPlan,
        planName: subscription.plan.name,
        billingPeriod: subscription.plan.billingPeriod,
      });
    } catch (error: any) {
      console.error('[Billing] Error fetching subscription info:', error);
      res.status(500).json({ error: 'Failed to fetch subscription info' });
    }
  });

  // Start Free Trial for authenticated users
  app.post('/api/billing/start-free-trial', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user already has an active subscription
      const existingSub = await storage.getUserSubscription(userId);
      if (existingSub) {
        return res.status(400).json({ 
          error: 'You already have an active subscription',
          subscription: existingSub
        });
      }

      // Find the free trial plan
      const plans = await storage.getAllPlans();
      const freePlan = plans.find(p => p.billingPeriod === 'trial' || p.name === 'free');
      
      if (!freePlan) {
        console.error('[Billing] Free trial plan not found in database');
        return res.status(500).json({ error: 'Free trial plan not available' });
      }

      // Assign the free trial plan to the user
      const result = await storage.assignPlanToUser(userId, freePlan.id);

      console.log(`[Billing] ✓ Free trial started for user ${userId}, granted ${result.creditsGranted} credits`);

      // Add user to Loops 7-day funnel if email exists
      if (user.email) {
        try {
          await LoopsService.addToSevenDayFunnel(
            user.email,
            user.firstName || undefined,
            user.lastName || undefined,
            user.id
          );
          console.log(`[Billing] ✓ Added user ${userId} to 7-day email funnel`);
        } catch (loopsError) {
          console.error('[Billing] Failed to add user to Loops funnel:', loopsError);
          // Don't fail the request for Loops errors
        }
      }

      res.json({
        success: true,
        message: 'Free trial started successfully',
        creditsGranted: result.creditsGranted,
        subscription: result.subscription
      });
    } catch (error: any) {
      console.error('[Billing] Start free trial error:', error);
      res.status(500).json({ error: error.message || 'Failed to start free trial' });
    }
  });

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

  // Add Social Media Poster subscription (for existing subscribers)
  app.post('/api/stripe/add-social-poster', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user already has Social Poster
      if (user.hasSocialPoster) {
        return res.status(400).json({ error: 'You already have Social Media Poster access' });
      }

      // Check if user has an active paid subscription (not free trial)
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        return res.status(403).json({ 
          error: 'Paid subscription required',
          code: 'NO_SUBSCRIPTION',
          message: 'Social Media Poster requires an active paid subscription. Please upgrade to a paid plan first.'
        });
      }
      
      if (subscription.plan.billingPeriod === 'trial') {
        return res.status(403).json({ 
          error: 'Paid subscription required',
          code: 'FREE_TRIAL',
          message: 'Social Media Poster is not available during the free trial. Please upgrade to a paid plan to access this feature.'
        });
      }

      // Get billing period from request body (defaults to monthly)
      const billingPeriod = req.body?.billingPeriod === 'annual' ? 'annual' : 'monthly';
      const baseUrl = getBaseUrl();

      const session = await createSocialPosterCheckoutSession({
        userId: user.id,
        userEmail: user.email || '',
        successUrl: `${baseUrl}/social/connect?success=true`,
        cancelUrl: `${baseUrl}/social/upgrade?canceled=true`,
        billingPeriod,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('[Billing] Social Poster checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Embedded checkout for Social Media Poster (in-app purchase)
  app.post('/api/stripe/social-poster-embedded-checkout', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user already has Social Poster
      if (user.hasSocialPoster) {
        return res.status(400).json({ error: 'You already have Social Media Poster access' });
      }

      // Check if user has an active paid subscription (not free trial)
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        return res.status(403).json({ 
          error: 'Paid subscription required',
          code: 'NO_SUBSCRIPTION',
          message: 'Social Media Poster requires an active paid subscription. Please upgrade to a paid plan first.'
        });
      }
      
      if (subscription.plan.billingPeriod === 'trial') {
        return res.status(403).json({ 
          error: 'Paid subscription required',
          code: 'FREE_TRIAL',
          message: 'Social Media Poster is not available during the free trial. Please upgrade to a paid plan to access this feature.'
        });
      }

      // Get billing period from request body (defaults to monthly)
      const billingPeriod = req.body?.billingPeriod === 'annual' ? 'annual' : 'monthly';
      const baseUrl = getBaseUrl();

      const { clientSecret, sessionId } = await createSocialPosterEmbeddedCheckout({
        userId: user.id,
        userEmail: user.email || '',
        returnUrl: `${baseUrl}/social/connect?success=true&session_id={CHECKOUT_SESSION_ID}`,
        billingPeriod,
      });

      res.json({ clientSecret, sessionId });
    } catch (error: any) {
      console.error('[Billing] Social Poster embedded checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Embedded checkout for Credit Boost (one-time purchase)
  app.post('/api/stripe/boost-embedded-checkout', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const baseUrl = getBaseUrl();

      const { clientSecret, sessionId } = await createBoostEmbeddedCheckout({
        userId: user.id,
        userEmail: user.email || '',
        returnUrl: `${baseUrl}/dashboard?boost=success&session_id={CHECKOUT_SESSION_ID}`,
      });

      res.json({ clientSecret, sessionId });
    } catch (error: any) {
      console.error('[Billing] Credit Boost embedded checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get boost settings (public, for displaying in UI)
  app.get('/api/boost-settings', requireJWT, async (req: any, res) => {
    try {
      const economics = await storage.getPlanEconomics();
      
      if (!economics?.boostEnabled) {
        return res.json({ enabled: false });
      }

      res.json({
        enabled: true,
        credits: economics.boostCredits || 300,
        priceUsd: economics.boostPriceUsd || 1500,
      });
    } catch (error: any) {
      console.error('[Boost] Error fetching boost settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Social Poster settings (public, for displaying pricing in UI)
  app.get('/api/social-poster-settings', requireJWT, async (req: any, res) => {
    try {
      const economics = await storage.getPlanEconomics();
      
      if (!economics?.socialPosterEnabled) {
        return res.json({ enabled: false });
      }

      res.json({
        enabled: true,
        monthlyPriceUsd: economics.socialPosterMonthlyPriceUsd || 4000,
        annualPriceUsd: economics.socialPosterAnnualPriceUsd || 24000,
        // Note: Stripe IDs are not exposed to client for security
        hasMonthlyPlan: !!economics.socialPosterMonthlyStripePriceId,
        // Use the database flag for annual plan availability (admin-controlled)
        hasAnnualPlan: (economics.socialPosterHasAnnualPlan ?? false) && !!economics.socialPosterAnnualStripePriceId,
      });
    } catch (error: any) {
      console.error('[Social Poster] Error fetching settings:', error);
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

  // ===========================================
  // Video Editor API Routes
  // ===========================================

  // Get all projects the user has access to (owned + collaborator)
  app.get('/api/editor/projects', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const projects = await storage.getUserAccessibleProjects(userId);
      
      const projectsWithMeta = await Promise.all(
        projects.map(async (project) => {
          const collaborators = await storage.getProjectCollaborators(project.id);
          const isOwner = project.ownerUserId === userId;
          let role: 'owner' | 'editor' | 'viewer' = 'owner';
          
          if (!isOwner) {
            const userCollab = collaborators.find(c => c.userId === userId);
            role = (userCollab?.role as 'editor' | 'viewer') || 'viewer';
          }
          
          return {
            ...project,
            role,
            collaboratorCount: collaborators.length,
          };
        })
      );
      
      res.json(projectsWithMeta);
    } catch (error: any) {
      console.error('[Editor] Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Create a new video project
  app.post('/api/editor/projects', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const bodySchema = z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        timelineData: z.any(),
        settings: z.any().optional(),
        isTemplate: z.boolean().optional(),
        thumbnailUrl: z.string().optional(),
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: validationResult.error.errors 
        });
      }

      const { title, description, timelineData, settings, isTemplate, thumbnailUrl } = validationResult.data;

      const project = await storage.createVideoProject({
        ownerUserId: userId,
        title,
        description: description || null,
        timelineData: timelineData || {},
        settings: settings || {},
        isTemplate: isTemplate || false,
        thumbnailUrl: thumbnailUrl || null,
      });

      res.status(201).json(project);
    } catch (error: any) {
      console.error('[Editor] Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  // Get a single project (check access)
  app.get('/api/editor/projects/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const project = await storage.getVideoProject(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const access = await storage.checkProjectAccess(id, userId);
      if (!access.hasAccess) {
        return res.status(403).json({ error: 'Forbidden - no access to this project' });
      }

      res.json({ ...project, userRole: access.role });
    } catch (error: any) {
      console.error('[Editor] Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  });

  // Update a project (check edit access - owner or editor)
  app.patch('/api/editor/projects/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const project = await storage.getVideoProject(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const access = await storage.checkProjectAccess(id, userId);
      if (!access.hasAccess) {
        return res.status(403).json({ error: 'Forbidden - no access to this project' });
      }

      if (access.role !== 'owner' && access.role !== 'editor') {
        return res.status(403).json({ error: 'Forbidden - viewers cannot edit projects' });
      }

      const bodySchema = z.object({
        title: z.string().min(1).max(255).optional(),
        description: z.string().nullable().optional(),
        timelineData: z.any().optional(),
        settings: z.any().optional(),
        isTemplate: z.boolean().optional(),
        thumbnailUrl: z.string().nullable().optional(),
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: validationResult.error.errors 
        });
      }

      const updated = await storage.updateVideoProject(id, validationResult.data);
      if (!updated) {
        return res.status(500).json({ error: 'Failed to update project' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[Editor] Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  // Delete a project (owner only)
  app.delete('/api/editor/projects/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const project = await storage.getVideoProject(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.ownerUserId !== userId) {
        return res.status(403).json({ error: 'Forbidden - only the owner can delete this project' });
      }

      const deleted = await storage.deleteVideoProject(id);
      if (!deleted) {
        return res.status(500).json({ error: 'Failed to delete project' });
      }

      res.json({ success: true, message: 'Project deleted successfully' });
    } catch (error: any) {
      console.error('[Editor] Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  // Get all template projects
  app.get('/api/editor/templates', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const templates = await storage.getTemplateProjects();
      res.json(templates);
    } catch (error: any) {
      console.error('[Editor] Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // ===========================================
  // User Search Routes (for collaborator lookup)
  // ===========================================

  // Search for a user by email (for adding collaborators)
  app.get('/api/users/search', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email query parameter is required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return safe user info (no sensitive data)
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      });
    } catch (error: any) {
      console.error('[Users] Error searching for user:', error);
      res.status(500).json({ error: 'Failed to search for user' });
    }
  });

  // ===========================================
  // Project Collaborators Routes
  // ===========================================

  // Get project collaborators (with user info)
  app.get('/api/editor/projects/:id/collaborators', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const project = await storage.getVideoProject(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const access = await storage.checkProjectAccess(id, userId);
      if (!access.hasAccess) {
        return res.status(403).json({ error: 'Forbidden - no access to this project' });
      }

      const collaborators = await storage.getProjectCollaborators(id);
      
      // Enrich collaborators with user info
      const enrichedCollaborators = await Promise.all(
        collaborators.map(async (collab) => {
          const user = await storage.getUser(collab.userId);
          return {
            ...collab,
            user: user ? {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImageUrl: user.profileImageUrl,
            } : null,
          };
        })
      );
      
      res.json(enrichedCollaborators);
    } catch (error: any) {
      console.error('[Editor] Error fetching collaborators:', error);
      res.status(500).json({ error: 'Failed to fetch collaborators' });
    }
  });

  // Add a collaborator (owner only)
  app.post('/api/editor/projects/:id/collaborators', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const project = await storage.getVideoProject(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.ownerUserId !== userId) {
        return res.status(403).json({ error: 'Forbidden - only the owner can add collaborators' });
      }

      const bodySchema = z.object({
        userId: z.string().min(1),
        role: z.enum(['viewer', 'editor']),
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: validationResult.error.errors 
        });
      }

      const { userId: collaboratorUserId, role } = validationResult.data;

      if (collaboratorUserId === userId) {
        return res.status(400).json({ error: 'Cannot add yourself as a collaborator' });
      }

      const collaboratorUser = await storage.getUser(collaboratorUserId);
      if (!collaboratorUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const existingCollaborators = await storage.getProjectCollaborators(id);
      if (existingCollaborators.some(c => c.userId === collaboratorUserId)) {
        return res.status(400).json({ error: 'User is already a collaborator' });
      }

      const collaborator = await storage.addProjectCollaborator({
        projectId: id,
        userId: collaboratorUserId,
        role,
        invitedBy: userId,
      });

      res.status(201).json(collaborator);
    } catch (error: any) {
      console.error('[Editor] Error adding collaborator:', error);
      res.status(500).json({ error: 'Failed to add collaborator' });
    }
  });

  // Update collaborator role (owner only)
  app.patch('/api/editor/projects/:id/collaborators/:collaboratorUserId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id, collaboratorUserId } = req.params;

      const project = await storage.getVideoProject(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.ownerUserId !== userId) {
        return res.status(403).json({ error: 'Forbidden - only the owner can update collaborator roles' });
      }

      const bodySchema = z.object({
        role: z.enum(['viewer', 'editor']),
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: validationResult.error.errors 
        });
      }

      const { role } = validationResult.data;

      const updated = await storage.updateCollaboratorRole(id, collaboratorUserId, role);
      if (!updated) {
        return res.status(404).json({ error: 'Collaborator not found' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('[Editor] Error updating collaborator role:', error);
      res.status(500).json({ error: 'Failed to update collaborator role' });
    }
  });

  // Remove a collaborator (owner only)
  app.delete('/api/editor/projects/:id/collaborators/:collaboratorUserId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id, collaboratorUserId } = req.params;

      const project = await storage.getVideoProject(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (project.ownerUserId !== userId) {
        return res.status(403).json({ error: 'Forbidden - only the owner can remove collaborators' });
      }

      const removed = await storage.removeProjectCollaborator(id, collaboratorUserId);
      if (!removed) {
        return res.status(404).json({ error: 'Collaborator not found' });
      }

      res.json({ success: true, message: 'Collaborator removed successfully' });
    } catch (error: any) {
      console.error('[Editor] Error removing collaborator:', error);
      res.status(500).json({ error: 'Failed to remove collaborator' });
    }
  });

  // ===========================================
  // Brand Kit Routes
  // ===========================================

  // Get user's brand kit
  app.get('/api/editor/brand-kit', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const brandKit = await storage.getBrandKit(userId);
      res.json(brandKit);
    } catch (error: any) {
      console.error('[Editor] Error fetching brand kit:', error);
      res.status(500).json({ error: 'Failed to fetch brand kit' });
    }
  });

  // Update/create user's brand kit
  app.put('/api/editor/brand-kit', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const bodySchema = z.object({
        name: z.string().min(1).max(100).optional(),
        palettes: z.array(z.object({
          id: z.string(),
          name: z.string(),
          colors: z.array(z.string()),
        })).nullable().optional(),
        fonts: z.array(z.object({
          id: z.string(),
          name: z.string(),
          family: z.string(),
          weights: z.array(z.number()).optional(),
        })).nullable().optional(),
        logos: z.array(z.object({
          id: z.string(),
          name: z.string(),
          url: z.string(),
          kind: z.enum(['logo', 'watermark']).optional(),
        })).nullable().optional(),
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: validationResult.error.errors 
        });
      }

      const brandKit = await storage.upsertBrandKit(userId, validationResult.data);
      res.json(brandKit);
    } catch (error: any) {
      console.error('[Editor] Error updating brand kit:', error);
      res.status(500).json({ error: 'Failed to update brand kit' });
    }
  });

  // ===========================================
  // Auto Captions / Transcription Routes
  // ===========================================

  const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/x-m4a', 'video/mp4', 'video/webm'];
      if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Please upload an audio or video file.'));
      }
    },
  });

  app.post('/api/editor/transcribe', audioUpload.single('audio'), async (req: any, res) => {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }

      const openai = new OpenAI({ apiKey: openaiApiKey });
      const language = req.body?.language || 'en';

      let transcription: any;

      if (req.file) {
        const buffer = req.file.buffer;
        const filename = req.file.originalname || 'audio.mp3';
        const file = new File([buffer], filename, { type: req.file.mimetype });

        transcription = await openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language,
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
        });
      } else if (req.body?.audioUrl) {
        const audioUrl = req.body.audioUrl;
        
        const response = await axios.get(audioUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          maxContentLength: 25 * 1024 * 1024,
        });

        const contentType = response.headers['content-type'] || 'audio/mpeg';
        const urlPath = new URL(audioUrl).pathname;
        const ext = path.extname(urlPath) || '.mp3';
        const filename = `audio${ext}`;
        
        const buffer = Buffer.from(response.data);
        const file = new File([buffer], filename, { type: contentType });

        transcription = await openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language,
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
        });
      } else {
        return res.status(400).json({ error: 'No audio file or URL provided' });
      }

      const segments = (transcription.segments || []).map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));

      res.json({ 
        segments,
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
      });
    } catch (error: any) {
      console.error('[Transcription] Error:', error);
      
      if (error.status === 400) {
        return res.status(400).json({ error: 'Invalid audio format or file too short' });
      }
      if (error.status === 413) {
        return res.status(413).json({ error: 'Audio file too large. Maximum size is 25MB.' });
      }
      if (axios.isAxiosError(error)) {
        return res.status(400).json({ error: 'Failed to download audio from URL' });
      }
      
      res.status(500).json({ error: error.message || 'Failed to transcribe audio' });
    }
  });

  // ===========================================
  // Temporary Image Upload for Transitions
  // ===========================================
  
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Please upload an image file (JPEG, PNG, WebP, or GIF).'));
      }
    },
  });

  app.post('/api/upload-temp-image', requireJWT, imageUpload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      
      // Convert buffer to base64 data URI
      const base64Content = buffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64Content}`;
      
      // Use existing saveBase64Image function to save and get URL
      const url = await saveBase64Image(dataUri);
      
      res.json({ url });
    } catch (error: any) {
      console.error('[Upload Temp Image] Error:', error);
      
      // Handle multer errors specifically
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Image file too large. Maximum size is 10MB.' });
      }
      if (error.message?.includes('Invalid file type')) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: error.message || 'Failed to upload image' });
    }
  });

  // Get showcase videos for the models page
  app.get('/api/showcase-videos', async (req: any, res) => {
    try {
      const allGenerations = await storage.getAllGenerations();
      
      // Filter to only completed videos that are marked as showcase, sort by newest first, take top 6
      const showcaseVideos = allGenerations
        .filter((gen: any) => gen.type === 'video' && gen.status === 'completed' && gen.resultUrl && gen.isShowcase === true)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6);
      
      res.json(showcaseVideos);
    } catch (error: any) {
      console.error('Showcase videos error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== STORY STUDIO ROUTES ==========

  // Get user's story projects
  app.get('/api/story-projects', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const projects = await storage.getUserStoryProjects(userId);
      res.json(projects);
    } catch (error: any) {
      console.error('Error fetching story projects:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch story projects' });
    }
  });

  // Get single story project with segments
  app.get('/api/story-projects/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const project = await storage.getStoryProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const segments = await storage.getProjectSegments(id);
      res.json({ ...project, segments });
    } catch (error: any) {
      console.error('Error fetching story project:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch story project' });
    }
  });

  // Create new story project
  app.post('/api/story-projects', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { title, mode, settings } = req.body;
      
      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }
      
      const project = await storage.createStoryProject({
        userId,
        title,
        mode: mode || 'instant',
        settings,
      });
      
      res.json(project);
    } catch (error: any) {
      console.error('Error creating story project:', error);
      res.status(500).json({ message: error.message || 'Failed to create story project' });
    }
  });

  // Update story project
  app.patch('/api/story-projects/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const updates = req.body;
      
      const project = await storage.getStoryProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const updated = await storage.updateStoryProject(id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating story project:', error);
      res.status(500).json({ message: error.message || 'Failed to update story project' });
    }
  });

  // Delete story project
  app.delete('/api/story-projects/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const project = await storage.getStoryProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.deleteStoryProject(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting story project:', error);
      res.status(500).json({ message: error.message || 'Failed to delete story project' });
    }
  });

  // Add segment to story project
  app.post('/api/story-projects/:id/segments', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { speakerLabel, voiceId, voiceName, text, emotionTags, orderIndex, metadata } = req.body;
      
      const project = await storage.getStoryProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      if (!text) {
        return res.status(400).json({ message: 'Text is required' });
      }
      
      // Get current segments to determine order
      const segments = await storage.getProjectSegments(id);
      const newOrderIndex = orderIndex ?? segments.length;
      
      const segment = await storage.createStorySegment({
        projectId: id,
        orderIndex: newOrderIndex,
        speakerLabel,
        voiceId,
        voiceName,
        text,
        emotionTags,
        metadata,
      });
      
      res.json(segment);
    } catch (error: any) {
      console.error('Error adding story segment:', error);
      res.status(500).json({ message: error.message || 'Failed to add segment' });
    }
  });

  // Update segment
  app.patch('/api/story-projects/:projectId/segments/:segmentId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { projectId, segmentId } = req.params;
      const updates = req.body;
      
      const project = await storage.getStoryProject(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const updated = await storage.updateStorySegment(segmentId, updates);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating story segment:', error);
      res.status(500).json({ message: error.message || 'Failed to update segment' });
    }
  });

  // Delete segment
  app.delete('/api/story-projects/:projectId/segments/:segmentId', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { projectId, segmentId } = req.params;
      
      const project = await storage.getStoryProject(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.deleteStorySegment(segmentId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting story segment:', error);
      res.status(500).json({ message: error.message || 'Failed to delete segment' });
    }
  });

  // Reorder segments
  app.post('/api/story-projects/:id/reorder', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { segmentIds } = req.body;
      
      const project = await storage.getStoryProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.reorderProjectSegments(id, segmentIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error reordering segments:', error);
      res.status(500).json({ message: error.message || 'Failed to reorder segments' });
    }
  });

  // Generate audio for Instant Speech mode (single segment)
  app.post('/api/story-studio/generate-instant', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

      if (!isFishAudioConfigured()) {
        return res.status(503).json({ 
          message: "Fish.Audio is not available. API key is not configured." 
        });
      }

      const { 
        text, 
        voiceId, 
        voiceName,
        temperature = 0.9, 
        topP = 0.9, 
        speed = 1, 
        volume = 0,
        format = 'mp3',
        projectId,
        title
      } = req.body;

      if (!text || !voiceId) {
        return res.status(400).json({ message: "text and voiceId are required" });
      }

      if (text.length > 30000) {
        return res.status(400).json({ message: "Text exceeds maximum length of 30,000 characters" });
      }

      // Get Story Studio TTS cost from database (same as fish-audio-tts)
      const cost = await getModelCost('fish-audio-tts');

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, cost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      try {
        // Generate speech using Fish.Audio
        const audioBuffer = await fishAudioGenerateSpeech({
          text,
          referenceId: voiceId,
          temperature,
          topP,
          speed,
          volume,
          format,
        });

        // Save audio to public folder for playback
        const filename = `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`;
        const audioPath = `public/uploads/audio/${filename}`;
        const fs = await import('fs/promises');
        await fs.mkdir('public/uploads/audio', { recursive: true });
        await fs.writeFile(audioPath, audioBuffer);
        const audioUrl = `/uploads/audio/${filename}`;

        // Create or update project if projectId provided
        let project = null;
        if (projectId) {
          project = await storage.getStoryProject(projectId);
          if (project && project.userId === userId) {
            await storage.updateStoryProject(projectId, {
              combinedAudioUrl: audioUrl,
              status: 'completed',
              totalDurationMs: Math.round((audioBuffer.length / 128) * 8), // Rough estimate
            });
          }
        } else if (title) {
          // Create a new project for this instant speech
          project = await storage.createStoryProject({
            userId,
            title: title || `Instant Speech - ${new Date().toLocaleDateString()}`,
            mode: 'instant',
            status: 'completed',
            settings: { voiceId, voiceName, temperature, speed },
            combinedAudioUrl: audioUrl,
          });
        }

        // Create a generation record for history
        await storage.createGeneration({
          userId,
          type: 'story-studio',
          model: 'fish-audio-tts',
          prompt: text.slice(0, 500),
          parameters: { 
            mode: 'instant',
            voiceId, 
            voiceName,
            temperature, 
            speed,
            projectId: project?.id 
          },
          status: 'completed',
          resultUrl: audioUrl,
          creditsCost: cost,
        });

        res.json({
          success: true,
          audioUrl,
          projectId: project?.id,
          creditsCost: cost,
        });
      } catch (genError: any) {
        // Refund credits on generation failure
        await storage.addCreditsAtomic(userId, cost);
        throw genError;
      }
    } catch (error: any) {
      console.error('Story Studio instant generation error:', error);
      res.status(500).json({ message: error.message || "Failed to generate audio" });
    }
  });

  // Generate audio for Advanced Story mode (multi-segment)
  app.post('/api/story-studio/generate-advanced', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;

      if (!isFishAudioConfigured()) {
        return res.status(503).json({ 
          message: "Fish.Audio is not available. API key is not configured." 
        });
      }

      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }

      const project = await storage.getStoryProject(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (project.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const segments = await storage.getProjectSegments(projectId);
      if (segments.length === 0) {
        return res.status(400).json({ message: "No segments in project" });
      }

      // Calculate total cost based on segments
      const baseCost = await getModelCost('fish-audio-tts');
      const totalCost = baseCost * segments.length;

      // Deduct credits atomically
      const user = await storage.deductCreditsAtomic(userId, totalCost);
      if (!user) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Update project status to generating
      await storage.updateStoryProject(projectId, { status: 'generating' });

      // Start background generation
      generateAdvancedStoryInBackground(projectId, segments, userId, totalCost);

      res.json({
        success: true,
        message: 'Story generation started',
        projectId,
        segmentCount: segments.length,
        totalCost,
      });
    } catch (error: any) {
      console.error('Story Studio advanced generation error:', error);
      res.status(500).json({ message: error.message || "Failed to start generation" });
    }
  });

  // ==========================================
  // STOCK PHOTOS API (Pixabay + Pexels)
  // ==========================================
  
  // In-memory cache for stock photo search results (24-hour TTL)
  const stockPhotoCache = new Map<string, { data: any; timestamp: number }>();
  const STOCK_PHOTO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  // Cleanup expired cache entries periodically
  setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];
    stockPhotoCache.forEach((value, key) => {
      if (now - value.timestamp > STOCK_PHOTO_CACHE_TTL) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => stockPhotoCache.delete(key));
  }, 60 * 60 * 1000); // Cleanup every hour
  
  // Search stock photos from Pixabay and/or Pexels
  app.get('/api/stock-photos/search', requireJWT, async (req: any, res) => {
    try {
      const query = req.query.q as string || '';
      const source = (req.query.source as string) || 'all';
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(Math.max(parseInt(req.query.per_page as string) || 20, 3), 80);
      const orientation = (req.query.orientation as string) || 'all';
      const category = req.query.category as string;
      const color = req.query.color as string;

      if (!query) {
        return res.status(400).json({ message: 'Search query is required' });
      }
      
      // Check API key availability upfront
      const pixabayKey = process.env.PIXABAY_API_KEY;
      const pexelsKey = process.env.PEXELS_API_KEY;
      
      const pixabayRequested = source === 'all' || source === 'pixabay';
      const pexelsRequested = source === 'all' || source === 'pexels';
      
      // Return 503 if any specifically requested provider lacks an API key
      if (source === 'pixabay' && !pixabayKey) {
        return res.status(503).json({ message: 'Pixabay service temporarily unavailable: API key not configured' });
      }
      if (source === 'pexels' && !pexelsKey) {
        return res.status(503).json({ message: 'Pexels service temporarily unavailable: API key not configured' });
      }
      // For 'all' source, require at least one provider to be available
      if (source === 'all' && !pixabayKey && !pexelsKey) {
        return res.status(503).json({ message: 'Stock photo service temporarily unavailable: No API keys configured' });
      }
      
      // Generate cache key
      const cacheKey = `${query.toLowerCase()}-${source}-${page}-${perPage}-${orientation}-${category || ''}-${color || ''}`;
      
      // Check cache first
      const cached = stockPhotoCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < STOCK_PHOTO_CACHE_TTL) {
        return res.json(cached.data);
      }

      const results: any = { pixabay: null, pexels: null };
      const promises: Promise<void>[] = [];

      // Pixabay search
      if (pixabayRequested && pixabayKey) {
        const pixabayPromise = (async () => {
          try {
            const params = new URLSearchParams({
              key: pixabayKey,
              q: query,
              page: page.toString(),
              per_page: perPage.toString(),
              safesearch: 'true',
            });
            if (orientation !== 'all') params.set('orientation', orientation);
            if (category) params.set('category', category);
            if (color) params.set('colors', color);

            const response = await axios.get(`https://pixabay.com/api/?${params.toString()}`, {
              timeout: 10000,
            });

            results.pixabay = {
              total: response.data.totalHits,
              images: response.data.hits.map((hit: any) => ({
                id: hit.id.toString(),
                source: 'pixabay',
                previewUrl: hit.previewURL,
                webformatUrl: hit.webformatURL,
                largeUrl: hit.largeImageURL,
                originalUrl: hit.imageURL || hit.largeImageURL,
                width: hit.imageWidth,
                height: hit.imageHeight,
                tags: hit.tags,
                photographer: hit.user,
                photographerUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`,
                pageUrl: hit.pageURL,
                downloads: hit.downloads,
                likes: hit.likes,
              })),
            };
          } catch (error: any) {
            console.error('Pixabay API error:', error.message);
            results.pixabay = { error: error.message, total: 0, images: [] };
          }
        })();
        promises.push(pixabayPromise);
      }

      // Pexels search
      if (pexelsRequested && pexelsKey) {
        const pexelsPromise = (async () => {
          try {
            const params = new URLSearchParams({
              query,
              page: page.toString(),
              per_page: perPage.toString(),
            });
            if (orientation !== 'all') params.set('orientation', orientation);
            if (color) params.set('color', color);

            const response = await axios.get(`https://api.pexels.com/v1/search?${params.toString()}`, {
              headers: { Authorization: pexelsKey },
              timeout: 10000,
            });

            results.pexels = {
              total: response.data.total_results,
              images: response.data.photos.map((photo: any) => ({
                id: photo.id.toString(),
                source: 'pexels',
                previewUrl: photo.src.tiny,
                webformatUrl: photo.src.medium,
                largeUrl: photo.src.large,
                originalUrl: photo.src.original,
                width: photo.width,
                height: photo.height,
                tags: photo.alt || '',
                photographer: photo.photographer,
                photographerUrl: photo.photographer_url,
                pageUrl: photo.url,
                avgColor: photo.avg_color,
              })),
            };
          } catch (error: any) {
            console.error('Pexels API error:', error.message);
            results.pexels = { error: error.message, total: 0, images: [] };
          }
        })();
        promises.push(pexelsPromise);
      }

      await Promise.all(promises);

      // Combine results
      const allImages = [
        ...(results.pixabay?.images || []),
        ...(results.pexels?.images || []),
      ];

      const responseData = {
        query,
        page,
        perPage,
        totalPixabay: results.pixabay?.total || 0,
        totalPexels: results.pexels?.total || 0,
        images: allImages,
        sources: {
          pixabay: pixabayRequested && pixabayKey ? { available: true, error: results.pixabay?.error } : { available: false, error: !pixabayKey ? 'API key not configured' : undefined },
          pexels: pexelsRequested && pexelsKey ? { available: true, error: results.pexels?.error } : { available: false, error: !pexelsKey ? 'API key not configured' : undefined },
        },
      };
      
      // Cache the response
      stockPhotoCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

      res.json(responseData);
    } catch (error: any) {
      console.error('Stock photos search error:', error);
      res.status(500).json({ message: error.message || 'Failed to search stock photos' });
    }
  });

  // Get user's saved stock images
  app.get('/api/stock-photos/saved', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`[Stock Photos] Getting saved images for user: ${userId}`);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const offset = (page - 1) * limit;

      const saved = await storage.getSavedStockImages(userId, limit, offset);
      const total = await storage.countSavedStockImages(userId);
      console.log(`[Stock Photos] Found ${saved.length} saved images, total: ${total}`);

      // Transform saved images to match StockImage interface expected by frontend
      // Maps externalId to id so frontend displays correctly
      const transformedImages = saved.map(img => ({
        id: img.externalId, // Use externalId as the display ID
        dbId: img.id, // Keep database ID for delete operations
        source: img.source as 'pixabay' | 'pexels',
        previewUrl: img.previewUrl,
        webformatUrl: img.webformatUrl,
        largeUrl: img.largeUrl,
        originalUrl: img.originalUrl,
        width: img.width,
        height: img.height,
        tags: img.tags || '',
        photographer: img.photographer || '',
        photographerUrl: img.photographerUrl || '',
        pageUrl: img.pageUrl || '',
        createdAt: img.createdAt,
      }));

      res.json({
        images: transformedImages,
        total,
        page,
        limit,
        hasMore: offset + saved.length < total,
      });
    } catch (error: any) {
      console.error('Get saved stock images error:', error);
      res.status(500).json({ message: error.message || 'Failed to get saved stock images' });
    }
  });

  // Save a stock image to user's library (downloads and uploads to S3)
  app.post('/api/stock-photos/save', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`[Stock Photos] Save request received for user: ${userId}`);
      console.log(`[Stock Photos] Request body:`, JSON.stringify(req.body, null, 2));
      
      const { source, externalId, largeUrl, webformatUrl, previewUrl, width, height, tags, photographer, photographerUrl, pageUrl, originalUrl } = req.body;
      
      // Download the image from the source and upload to our storage
      const imageUrlToSave = largeUrl || webformatUrl;
      if (!imageUrlToSave) {
        console.log('[Stock Photos] No image URL provided');
        return res.status(400).json({ message: 'No image URL provided' });
      }

      console.log(`[Stock Photos] Downloading image from ${source}: ${externalId}`);
      
      // Fetch the image from the external URL
      const imageResponse = await fetch(imageUrlToSave, {
        headers: {
          'User-Agent': 'Artivio-AI/1.0',
        },
      });
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status}`);
      }
      
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Determine content type from response or URL
      const contentType = imageResponse.headers.get('content-type') || 
        (imageUrlToSave.includes('.png') ? 'image/png' : 
         imageUrlToSave.includes('.webp') ? 'image/webp' : 'image/jpeg');
      
      // Convert to base64 for our upload service
      const base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
      
      // Upload to S3/local storage using existing service
      const { saveImage } = await import('./services/uploadService');
      const uploadResult = await saveImage(base64Data);
      
      console.log(`[Stock Photos] Uploaded to ${uploadResult.storageType}: ${uploadResult.url}`);
      
      // Also upload preview if different
      let savedPreviewUrl = uploadResult.url; // Default to same as large
      if (previewUrl && previewUrl !== imageUrlToSave) {
        try {
          const previewResponse = await fetch(previewUrl, {
            headers: { 'User-Agent': 'Artivio-AI/1.0' },
          });
          if (previewResponse.ok) {
            const previewBuffer = Buffer.from(await previewResponse.arrayBuffer());
            const previewContentType = previewResponse.headers.get('content-type') || 'image/jpeg';
            const previewBase64 = `data:${previewContentType};base64,${previewBuffer.toString('base64')}`;
            const previewResult = await saveImage(previewBase64);
            savedPreviewUrl = previewResult.url;
          }
        } catch (e) {
          console.log('[Stock Photos] Preview download failed, using main image URL');
        }
      }
      
      // Validate and save to database with our hosted URLs
      const validationResult = insertSavedStockImageSchema.safeParse({
        userId,
        source,
        externalId,
        previewUrl: savedPreviewUrl,
        webformatUrl: uploadResult.url,
        largeUrl: uploadResult.url,
        originalUrl: uploadResult.url,
        width,
        height,
        tags,
        photographer,
        photographerUrl,
        pageUrl,
      });
      
      if (!validationResult.success) {
        console.log('[Stock Photos] Validation failed:', validationResult.error.errors);
        return res.status(400).json({ 
          message: 'Invalid request data', 
          errors: validationResult.error.errors 
        });
      }

      console.log('[Stock Photos] Saving to database for user:', userId);
      const saved = await storage.saveStockImage(validationResult.data);
      console.log('[Stock Photos] Successfully saved to database:', saved.id);

      res.json({ success: true, image: saved });
    } catch (error: any) {
      // Handle duplicate
      if (error.message?.includes('duplicate') || error.code === '23505') {
        return res.status(409).json({ message: 'Image already saved to library' });
      }
      console.error('Save stock image error:', error);
      res.status(500).json({ message: error.message || 'Failed to save stock image' });
    }
  });

  // Remove a stock image from user's library
  app.delete('/api/stock-photos/saved/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const deleted = await storage.deleteSavedStockImage(id, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Image not found or access denied' });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete saved stock image error:', error);
      res.status(500).json({ message: error.message || 'Failed to remove stock image' });
    }
  });

  // Check if stock images are saved (bulk check)
  app.post('/api/stock-photos/check-saved', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { images } = req.body; // Array of { source, externalId }

      if (!Array.isArray(images)) {
        return res.status(400).json({ message: 'images array is required' });
      }

      const savedIds = await storage.checkSavedStockImages(userId, images);
      res.json({ savedIds });
    } catch (error: any) {
      console.error('Check saved stock images error:', error);
      res.status(500).json({ message: error.message || 'Failed to check saved images' });
    }
  });

  // ========== AI SUPPORT SYSTEM ROUTES ==========

  const { aiSupportAgent } = await import('./services/aiSupportAgent');

  // Postmark Inbound Webhook - receives emails from support@artivio.ai
  app.post('/api/support/inbound-email', express.json(), async (req, res) => {
    try {
      console.log('[SUPPORT WEBHOOK] Received inbound email webhook');
      
      // Validate this is from Postmark (basic check)
      const payload = req.body;
      if (!payload.From || !payload.MessageID) {
        console.error('[SUPPORT WEBHOOK] Invalid payload - missing required fields');
        return res.status(400).json({ message: 'Invalid payload' });
      }
      
      console.log('[SUPPORT WEBHOOK] Processing email from:', payload.From);
      console.log('[SUPPORT WEBHOOK] Subject:', payload.Subject);
      
      const result = await aiSupportAgent.processInboundEmail(payload);
      
      console.log('[SUPPORT WEBHOOK] Processed:', result);
      
      // Always return 200 to Postmark to acknowledge receipt
      res.status(200).json({ 
        success: true, 
        ticketId: result.ticketId,
        action: result.action 
      });
    } catch (error: any) {
      console.error('[SUPPORT WEBHOOK] Error processing inbound email:', error);
      // Still return 200 to prevent Postmark from retrying
      res.status(200).json({ success: false, error: error.message });
    }
  });

  // User: Submit a support ticket from the app
  app.post('/api/support/tickets', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || !user.email) {
        return res.status(400).json({ message: 'User email not found' });
      }
      
      const { subject, message } = req.body;
      
      if (!subject || !message) {
        return res.status(400).json({ message: 'Subject and message are required' });
      }
      
      const result = await aiSupportAgent.createTicketFromApp(
        userId,
        user.email,
        user.firstName || undefined,
        subject,
        message
      );
      
      res.json({
        success: true,
        ticketId: result.ticketId,
        action: result.action,
        message: result.action === 'auto_replied' 
          ? 'Your request has been received and we\'ve sent you a response via email.' 
          : result.action === 'escalated'
          ? 'Your request has been received and escalated to our support team. We\'ll get back to you soon.'
          : 'Your request has been received. We\'ll get back to you soon.'
      });
    } catch (error: any) {
      console.error('[SUPPORT] Error creating ticket:', error);
      res.status(500).json({ message: error.message || 'Failed to create support ticket' });
    }
  });

  // User: Get their support tickets
  app.get('/api/support/tickets', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const tickets = await db.select()
        .from(supportTickets)
        .where(eq(supportTickets.userId, userId))
        .orderBy(desc(supportTickets.createdAt));
      
      res.json(tickets);
    } catch (error: any) {
      console.error('[SUPPORT] Error fetching tickets:', error);
      res.status(500).json({ message: 'Failed to fetch support tickets' });
    }
  });

  // User: Get a specific ticket with messages
  app.get('/api/support/tickets/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const [ticket] = await db.select()
        .from(supportTickets)
        .where(and(
          eq(supportTickets.id, id),
          eq(supportTickets.userId, userId)
        ));
      
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      
      const messages = await db.select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, id))
        .orderBy(supportMessages.createdAt);
      
      res.json({ ticket, messages });
    } catch (error: any) {
      console.error('[SUPPORT] Error fetching ticket:', error);
      res.status(500).json({ message: 'Failed to fetch support ticket' });
    }
  });

  // User: Reply to their own ticket
  app.post('/api/support/tickets/:id/reply', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: 'Message is required' });
      }
      
      const [ticket] = await db.select()
        .from(supportTickets)
        .where(and(
          eq(supportTickets.id, id),
          eq(supportTickets.userId, userId)
        ));
      
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      
      const user = await storage.getUser(userId);
      
      // Add the user's reply
      await db.insert(supportMessages).values({
        ticketId: id,
        senderType: 'user',
        senderName: user?.firstName || undefined,
        senderEmail: user?.email || undefined,
        bodyText: message,
      });
      
      // Update ticket status and last message time
      await db.update(supportTickets)
        .set({
          status: 'open',
          lastMessageAt: new Date(),
        })
        .where(eq(supportTickets.id, id));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[SUPPORT] Error replying to ticket:', error);
      res.status(500).json({ message: 'Failed to send reply' });
    }
  });

  // Admin: Get all support tickets
  app.get('/api/admin/support/tickets', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { status, priority, category, limit = 50, offset = 0 } = req.query;
      
      let query = db.select({
        ticket: supportTickets,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
        .from(supportTickets)
        .leftJoin(users, eq(supportTickets.userId, users.id))
        .orderBy(desc(supportTickets.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));
      
      const tickets = await query;
      
      // Get total count
      const countResult = await db.select({ count: count() })
        .from(supportTickets);
      
      res.json({
        tickets: tickets.map(t => ({ ...t.ticket, user: t.user })),
        total: countResult[0]?.count || 0,
      });
    } catch (error: any) {
      console.error('[SUPPORT ADMIN] Error fetching tickets:', error);
      res.status(500).json({ message: 'Failed to fetch support tickets' });
    }
  });

  // Admin: Get a specific ticket with all details
  app.get('/api/admin/support/tickets/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { id } = req.params;
      
      const [ticketResult] = await db.select({
        ticket: supportTickets,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          credits: users.credits,
          createdAt: users.createdAt,
        }
      })
        .from(supportTickets)
        .leftJoin(users, eq(supportTickets.userId, users.id))
        .where(eq(supportTickets.id, id));
      
      if (!ticketResult) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      
      const messages = await db.select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, id))
        .orderBy(supportMessages.createdAt);
      
      res.json({ 
        ticket: { ...ticketResult.ticket, user: ticketResult.user },
        messages 
      });
    } catch (error: any) {
      console.error('[SUPPORT ADMIN] Error fetching ticket:', error);
      res.status(500).json({ message: 'Failed to fetch support ticket' });
    }
  });

  // Admin: Update ticket status/priority
  app.patch('/api/admin/support/tickets/:id', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { id } = req.params;
      const { status, priority, category } = req.body;
      
      const updates: any = {};
      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (category) updates.category = category;
      if (status === 'resolved') updates.resolvedAt = new Date();
      
      await db.update(supportTickets)
        .set(updates)
        .where(eq(supportTickets.id, id));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[SUPPORT ADMIN] Error updating ticket:', error);
      res.status(500).json({ message: 'Failed to update ticket' });
    }
  });

  // Admin: Reply to a ticket
  app.post('/api/admin/support/tickets/:id/reply', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { id } = req.params;
      const { message, sendEmail = true } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: 'Message is required' });
      }
      
      const [ticket] = await db.select()
        .from(supportTickets)
        .where(eq(supportTickets.id, id));
      
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      
      // Add the admin's reply
      const [newMessage] = await db.insert(supportMessages).values({
        ticketId: id,
        senderType: 'admin',
        senderName: user?.firstName || 'Support Team',
        senderEmail: 'support@artivio.ai',
        bodyText: message,
      }).returning();
      
      // Send email to user if requested
      if (sendEmail && process.env.POSTMARK_SERVER_TOKEN) {
        const { ServerClient } = await import('postmark');
        const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN);
        
        const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1a1a24; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; color: #ffffff;">Artivio AI Support</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              ${ticket.name ? `<p style="color: #ffffff; font-size: 16px; margin: 0 0 16px 0;">Hi ${ticket.name},</p>` : ''}
              <p style="color: #d1d5db; font-size: 14px; margin: 0 0 16px 0;">We've responded to your support request:</p>
              <p style="color: #71717a; font-size: 13px; margin: 0 0 8px 0;"><strong>Subject:</strong> ${ticket.subject}</p>
              <div style="background-color: #0a0a0f; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="color: #ffffff; font-size: 14px; margin: 0; white-space: pre-wrap;">${message}</p>
              </div>
              <p style="color: #d1d5db; font-size: 14px; margin: 16px 0 0 0;">
                Reply to this email if you have any follow-up questions.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #0a0a0f; text-align: center;">
              <p style="color: #71717a; font-size: 12px; margin: 0;">
                Ticket ID: ${id}<br>
                <a href="https://artivio.ai" style="color: #9333ea;">artivio.ai</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        try {
          const result = await postmarkClient.sendEmail({
            From: 'support@artivio.ai',
            To: ticket.email,
            Subject: `Re: ${ticket.subject}`,
            HtmlBody: htmlBody,
            TextBody: `${ticket.name ? `Hi ${ticket.name},\n\n` : ''}We've responded to your support request:\n\nSubject: ${ticket.subject}\n\n${message}\n\nReply to this email if you have any follow-up questions.\n\nTicket ID: ${id}\nartivio.ai`,
            ReplyTo: 'support@artivio.ai',
            MessageStream: 'outbound',
            Headers: [{ Name: 'X-Ticket-ID', Value: id }]
          });
          
          // Update message delivery status
          await db.update(supportMessages)
            .set({ 
              deliveryStatus: 'sent',
              deliveredAt: new Date(),
              postmarkMessageId: result.MessageID
            })
            .where(eq(supportMessages.id, newMessage.id));
            
        } catch (emailError) {
          console.error('[SUPPORT ADMIN] Failed to send email:', emailError);
        }
      }
      
      // Update ticket
      await db.update(supportTickets)
        .set({
          status: 'pending',
          lastMessageAt: new Date(),
        })
        .where(eq(supportTickets.id, id));
      
      res.json({ success: true, messageId: newMessage.id });
    } catch (error: any) {
      console.error('[SUPPORT ADMIN] Error replying to ticket:', error);
      res.status(500).json({ message: 'Failed to send reply' });
    }
  });

  // Admin: Manually escalate a ticket
  app.post('/api/admin/support/tickets/:id/escalate', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const { id } = req.params;
      const { reason } = req.body;
      
      const [ticket] = await db.select()
        .from(supportTickets)
        .where(eq(supportTickets.id, id));
      
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      
      // Get full message history
      const messages = await db.select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, id))
        .orderBy(supportMessages.createdAt);
      
      const fullMessage = messages.map(m => `[${m.senderType}] ${m.bodyText}`).join('\n\n---\n\n');
      
      const success = await aiSupportAgent.escalateTicket(
        id,
        reason || 'Manually escalated by admin',
        ticket.email,
        ticket.name || undefined,
        ticket.subject,
        fullMessage,
        ticket.userContext as any || {}
      );
      
      res.json({ success });
    } catch (error: any) {
      console.error('[SUPPORT ADMIN] Error escalating ticket:', error);
      res.status(500).json({ message: 'Failed to escalate ticket' });
    }
  });

  // Admin: Get support stats
  app.get('/api/admin/support/stats', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!isUserAdmin(user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const [openCount] = await db.select({ count: count() })
        .from(supportTickets)
        .where(eq(supportTickets.status, 'open'));
      
      const [pendingCount] = await db.select({ count: count() })
        .from(supportTickets)
        .where(eq(supportTickets.status, 'pending'));
      
      const [escalatedCount] = await db.select({ count: count() })
        .from(supportTickets)
        .where(eq(supportTickets.status, 'escalated'));
      
      const [resolvedCount] = await db.select({ count: count() })
        .from(supportTickets)
        .where(eq(supportTickets.status, 'resolved'));
      
      const [totalCount] = await db.select({ count: count() })
        .from(supportTickets);
      
      // Get today's tickets
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [todayCount] = await db.select({ count: count() })
        .from(supportTickets)
        .where(sql`${supportTickets.createdAt} >= ${today}`);
      
      res.json({
        open: openCount?.count || 0,
        pending: pendingCount?.count || 0,
        escalated: escalatedCount?.count || 0,
        resolved: resolvedCount?.count || 0,
        total: totalCount?.count || 0,
        today: todayCount?.count || 0,
      });
    } catch (error: any) {
      console.error('[SUPPORT ADMIN] Error fetching stats:', error);
      res.status(500).json({ message: 'Failed to fetch support stats' });
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

    // Generate thumbnail for the combined video (non-blocking)
    generateThumbnail({
      videoPath: result.outputPath,
      generationId: combinationId,
      timestampSeconds: 2,
    }).then(async (thumbResult) => {
      await storage.updateVideoCombination(combinationId, { thumbnailUrl: thumbResult.thumbnailUrl });
      console.log(`✓ Thumbnail generated for combination ${combinationId}: ${thumbResult.thumbnailUrl}`);
    }).catch((error) => {
      console.error(`⚠️  Thumbnail generation failed for combination ${combinationId}:`, error.message);
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

    // Also create a generation record so it shows up in history
    const combination = await storage.getVideoCombinationById(combinationId);
    if (combination) {
      const generation = await storage.createGeneration({
        userId: combination.userId,
        type: 'video-editor',
        status: 'completed',
        resultUrl: result.outputPath,
        thumbnailUrl: combination.thumbnailUrl || undefined, // Use thumbnail from combination if available
        model: 'Video Editor',
        prompt: 'Video Editor Export',
        parameters: {
          sourceVideoIds: combination.sourceVideoIds,
          enhancements: combination.enhancements,
        },
        creditsCost: combination.creditsCost,
        processingStage: 'completed',
      });
      
      // Generate thumbnail if not already set (non-blocking)
      if (generation?.id && !combination.thumbnailUrl) {
        generateThumbnail({
          videoPath: result.outputPath,
          generationId: generation.id,
          timestampSeconds: 2,
        }).then(async (thumbResult) => {
          await storage.updateGeneration(generation.id, { thumbnailUrl: thumbResult.thumbnailUrl });
          console.log(`✓ Thumbnail generated for video combination ${generation.id}`);
        }).catch((error) => {
          console.error(`⚠️  Thumbnail generation failed for video combination:`, error.message);
        });
      }
    }

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

// Background advanced story generation processor
async function generateAdvancedStoryInBackground(
  projectId: string, 
  segments: any[], 
  userId: string, 
  totalCost: number
) {
  const fs = await import('fs/promises');
  const { generateSpeech: fishAudioGenSpeech } = await import('./fishAudio');

  try {
    console.log(`[Story Studio] Starting advanced story generation for project ${projectId} with ${segments.length} segments`);

    const audioUrls: string[] = [];
    let failedSegments: string[] = [];

    // Generate audio for each segment
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      try {
        // Update segment status
        await storage.updateStorySegment(segment.id, { status: 'generating' });
        
        console.log(`[Story Studio] Generating segment ${i + 1}/${segments.length}: "${segment.text.slice(0, 50)}..."`);

        // Generate speech for this segment
        const audioBuffer = await fishAudioGenSpeech({
          text: segment.text,
          referenceId: segment.voiceId || 'default',
          format: 'mp3',
        });

        // Save audio file
        const filename = `story-segment-${segment.id}-${Date.now()}.mp3`;
        const audioPath = `public/uploads/audio/${filename}`;
        await fs.mkdir('public/uploads/audio', { recursive: true });
        await fs.writeFile(audioPath, audioBuffer);
        const audioUrl = `/uploads/audio/${filename}`;

        // Update segment with audio URL
        await storage.updateStorySegment(segment.id, {
          status: 'completed',
          audioUrl,
          durationMs: Math.round((audioBuffer.length / 128) * 8),
        });

        audioUrls.push(audioUrl);
        console.log(`[Story Studio] Segment ${i + 1} completed: ${audioUrl}`);

      } catch (segError: any) {
        console.error(`[Story Studio] Segment ${i + 1} failed:`, segError.message);
        await storage.updateStorySegment(segment.id, { 
          status: 'failed',
          errorMessage: segError.message
        });
        failedSegments.push(segment.id);
      }
    }

    // Calculate total duration
    const allSegments = await storage.getProjectSegments(projectId);
    const totalDurationMs = allSegments.reduce((sum, seg) => sum + (seg.durationMs || 0), 0);

    // Update project status
    if (failedSegments.length === segments.length) {
      // All segments failed
      await storage.updateStoryProject(projectId, {
        status: 'failed',
      });
      
      // Refund credits
      await storage.addCreditsAtomic(userId, totalCost);
      console.log(`[Story Studio] All segments failed for project ${projectId}, refunded ${totalCost} credits`);
    } else if (failedSegments.length > 0) {
      // Some segments failed - partial success
      await storage.updateStoryProject(projectId, {
        status: 'completed',
        totalDurationMs,
      });
      
      // Partial refund for failed segments
      const refundAmount = Math.round((totalCost / segments.length) * failedSegments.length);
      if (refundAmount > 0) {
        await storage.addCreditsAtomic(userId, refundAmount);
        console.log(`[Story Studio] Partial refund of ${refundAmount} credits for ${failedSegments.length} failed segments`);
      }
    } else {
      // All segments succeeded
      await storage.updateStoryProject(projectId, {
        status: 'completed',
        totalDurationMs,
      });
    }

    // Create a generation record
    await storage.createGeneration({
      userId,
      type: 'story-studio',
      model: 'fish-audio-tts',
      prompt: `Advanced Story: ${segments.length} segments`,
      parameters: { 
        mode: 'advanced',
        projectId,
        segmentCount: segments.length,
        failedCount: failedSegments.length,
      },
      status: failedSegments.length === segments.length ? 'failed' : 'completed',
      creditsCost: totalCost - (Math.round((totalCost / segments.length) * failedSegments.length) || 0),
    });

    console.log(`[Story Studio] Project ${projectId} generation completed. ${segments.length - failedSegments.length}/${segments.length} segments successful`);

  } catch (error: any) {
    console.error(`[Story Studio] Project ${projectId} generation failed:`, error);

    // Update project status
    await storage.updateStoryProject(projectId, {
      status: 'failed',
    });

    // Refund all credits on total failure
    await storage.addCreditsAtomic(userId, totalCost);
    console.log(`[Story Studio] Refunded ${totalCost} credits for failed project ${projectId}`);
  }
}
