import axios from "axios";
import { storage } from "./storage";

const KIE_API_BASE = "https://api.kie.ai";

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

// Centralized Suno response parser to handle ALL API response formats
// Covers v3, v4, v4.5, callbacks, and all documented Suno payload variations
export function parseSunoResponse(response: any): {
  taskId: string | null;
  audioUrl: string | null;
  status: string | null;
  errorMessage: string | null;
} {
  // Parse task ID from various formats
  // Covers: data.task.taskId, data.tasks[0].taskId, data.taskId, data.task_id, taskId, task_id
  const taskId = response?.data?.task?.taskId ||
                response?.data?.tasks?.[0]?.taskId ||
                response?.data?.taskId ||
                response?.data?.task_id || // v3 format
                response?.data?.jobId ||
                response?.response?.tasks?.[0]?.taskId || // Direct response.response
                response?.response?.taskId ||
                response?.tasks?.[0]?.taskId || // Direct response.tasks
                response?.taskId ||
                response?.task_id ||
                null;
  
  // Parse audio URL from ALL known Suno payload formats
  // Priority order: nested response structures -> direct data fields -> top-level fields
  // Include streamAudioUrl, metadata.audio, and all documented variations
  const audioUrl = response?.data?.response?.sunoData?.[0]?.audioUrl ||
                  response?.data?.response?.sunoData?.[0]?.streamAudioUrl ||
                  response?.data?.response?.tracks?.[0]?.audioUrl ||
                  response?.data?.response?.tracks?.[0]?.streamAudioUrl ||
                  response?.data?.response?.tracks?.[0]?.metadata?.audioUrl ||
                  response?.data?.response?.audio?.[0]?.url ||
                  response?.data?.response?.audio?.[0]?.audioUrl ||
                  response?.response?.sunoData?.[0]?.audioUrl || // Direct response.response
                  response?.response?.sunoData?.[0]?.streamAudioUrl ||
                  response?.response?.tracks?.[0]?.audioUrl ||
                  response?.response?.tracks?.[0]?.streamAudioUrl ||
                  response?.response?.tracks?.[0]?.metadata?.audioUrl ||
                  response?.response?.audio?.[0]?.url ||
                  response?.response?.audio?.[0]?.audioUrl ||
                  response?.data?.streamAudioUrl ||
                  response?.data?.audio_url ||
                  response?.data?.audioUrl ||
                  response?.data?.url ||
                  response?.tasks?.[0]?.audioUrl || // Direct response.tasks
                  response?.tasks?.[0]?.streamAudioUrl ||
                  response?.tasks?.[0]?.metadata?.audioUrl ||
                  response?.tasks?.[0]?.url ||
                  response?.streamAudioUrl ||
                  response?.audioUrl ||
                  response?.audio_url ||
                  response?.url ||
                  null;
  
  // Parse status from all nested structures
  // Normalize success aliases: success, SUCCESS, complete, COMPLETE -> 'success'
  // Keep processing states: pending, queued, processing, working as-is
  const rawStatus = response?.data?.task?.status ||
                   response?.data?.tasks?.[0]?.status ||
                   response?.data?.response?.status ||  // Also check data.response.status
                   response?.data?.status ||
                   response?.response?.tasks?.[0]?.status || // Direct response.response
                   response?.response?.status ||
                   response?.tasks?.[0]?.status || // Direct response.tasks
                   response?.status ||
                   null;
  
  // Normalize status values while preserving transitional states
  let status = rawStatus;
  if (rawStatus) {
    const lower = rawStatus.toLowerCase();
    if (lower === 'complete' || lower === 'success') {
      status = 'success';
    } else if (lower === 'error' || lower === 'failed') {
      status = 'failed';
    } else if (lower === 'pending' || lower === 'queued' || lower === 'processing' || lower === 'working') {
      status = lower; // Keep as-is for intermediate states
    }
  }
  
  // Parse error messages and error codes from all possible locations
  const errorMessage = response?.error ||
                      response?.errorMessage ||
                      response?.data?.error ||
                      response?.data?.errorMessage ||
                      response?.data?.task?.error ||
                      response?.data?.task?.errorMessage ||
                      response?.data?.tasks?.[0]?.error ||
                      response?.data?.tasks?.[0]?.errorMessage ||
                      response?.data?.response?.error ||
                      response?.data?.response?.errorMessage ||
                      response?.response?.error ||
                      response?.response?.errorMessage ||
                      response?.tasks?.[0]?.error ||
                      response?.tasks?.[0]?.errorMessage ||
                      response?.message ||
                      null;
  
  return { taskId, audioUrl, status, errorMessage };
}

// Get available API keys from environment
function getAvailableApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const keyName = `KIE_API_KEY_${i}`;
    const keyValue = process.env[keyName];
    if (keyValue) {
      keys.push(keyName);
    }
  }
  return keys;
}

// Initialize API keys in database on first run
export async function initializeApiKeys() {
  const existingKeys = await storage.getAllApiKeys();
  const availableKeys = getAvailableApiKeys();

  // Add any new keys from environment that aren't in the database yet
  for (const keyName of availableKeys) {
    const exists = existingKeys.some(k => k.keyName === keyName);
    if (!exists) {
      const keyValue = process.env[keyName];
      if (keyValue) {
        await storage.addApiKey({
          keyName,
          keyValue,
          isActive: true,
        });
        console.log(`Added API key: ${keyName}`);
      }
    }
  }
}

// Get the next API key using round-robin rotation
async function getApiKey(): Promise<{ keyValue: string; keyName: string }> {
  const key = await storage.getNextApiKey();
  if (!key) {
    throw new Error("No active API keys available. Please configure at least one API key in the admin panel.");
  }

  // Update usage count
  await storage.updateApiKeyUsage(key.id);

  // Get the actual key value from database
  const keyValue = key.keyValue;
  if (!keyValue) {
    throw new Error(`API key ${key.keyName} has no value configured.`);
  }

  return { keyValue, keyName: key.keyName };
}

// Generic API call to Kie.ai
async function callKieApi(endpoint: string, data: any): Promise<{ result: any; keyName: string }> {
  const { keyValue, keyName } = await getApiKey();
  
  console.log(`🔵 Kie.ai API Request to ${endpoint}:`, safeStringify({
    ...data,
    callBackUrl: data.callBackUrl || 'NOT PROVIDED'
  }));
  
  try {
    const response = await axios.post(
      `${KIE_API_BASE}${endpoint}`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyValue}`,
        },
        timeout: 120000, // 2 minutes timeout
      }
    );
    
        console.log(`✅ Kie.ai API Response from ${endpoint}:`, safeStringify(response.data));
    
    return { result: response.data, keyName };
  } catch (error: any) {
    console.error(`❌ Kie.ai API Error for ${endpoint}:`, error.response?.data || error.message);
        console.error("Full error details:", safeStringify({
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    }));
    
    // Extract error message with better fallbacks
    let errorMessage = 'Failed to communicate with AI service';
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      // Check status codes FIRST before trying to extract messages
      // This ensures we provide helpful messages even if API returns unhelpful ones
      if (status === 404) {
        errorMessage = `AI service endpoint not found (${endpoint}). This feature may not be available yet.`;
      } else if (status === 401 || status === 403) {
        errorMessage = 'AI service authentication failed. Please check API key configuration.';
      } else if (status === 429) {
        errorMessage = 'AI service rate limit exceeded. Please try again later.';
      } else if (status >= 500) {
        errorMessage = 'AI service is temporarily unavailable. Please try again later.';
      } else if (data?.message && data.message !== 'No message available') {
        // Use provider message if it's actually helpful
        errorMessage = data.message;
      } else if (data?.error) {
        errorMessage = data.error;
      } else if (data?.detail) {
        errorMessage = data.detail;
      } else if (typeof data === 'string') {
        errorMessage = data;
      } else {
        errorMessage = error.response.statusText || `AI service error (${status})`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Create enhanced error with full details for debugging
    const enhancedError: any = new Error(errorMessage);
    enhancedError.kieaiDetails = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      endpoint,
    };
    
    throw enhancedError;
  }
}

// Video Generation - Supports all AI models and image-to-video
export async function generateVideo(params: {
  model: string;
  prompt: string;
  generationType?: string;
  referenceImages?: string[];
  veoSubtype?: string; // Explicit Veo subtype control
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  const generationType = params.generationType || 'text-to-video';
  const referenceImages = params.referenceImages || [];
  
  // Route to appropriate API based on model
  if (params.model.startsWith('veo-')) {
    // Veo 3, 3.1, 3.1 Fast - uses /api/v1/veo/generate
    
    // Validate aspect ratio for Veo models (only 16:9 and 9:16 supported)
    const aspectRatio = parameters.aspectRatio || '16:9';
    if (!['16:9', '9:16'].includes(aspectRatio)) {
      throw new Error(`Veo models only support 16:9 and 9:16 aspect ratios. Received: ${aspectRatio}`);
    }
    
    let kieModel = 'veo3';
    if (params.model === 'veo-3.1') {
      kieModel = 'veo3';
    } else if (params.model === 'veo-3.1-fast') {
      kieModel = 'veo3_fast';
    } else if (params.model === 'veo-3') {
      kieModel = 'veo3';
    }
    
    // Determine Veo generation type: honor explicit veoSubtype, otherwise use smart defaults
    let veoGenerationType = 'TEXT_2_VIDEO';
    if (params.veoSubtype) {
      // Use explicitly specified subtype (frontend control)
      veoGenerationType = params.veoSubtype;
      
      // Validate image count for selected subtype
      if (veoGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO' && referenceImages.length !== 2) {
        throw new Error('FIRST_AND_LAST_FRAMES_2_VIDEO requires exactly 2 reference images');
      }
      if (veoGenerationType === 'REFERENCE_2_VIDEO') {
        if (referenceImages.length === 0) {
          throw new Error('REFERENCE_2_VIDEO requires at least 1 reference image');
        }
        if (referenceImages.length > 3) {
          throw new Error('REFERENCE_2_VIDEO supports up to 3 reference images');
        }
      }
    } else if (generationType === 'image-to-video' && referenceImages.length > 0) {
      // Smart defaults based on image count and model constraints:
      // IMPORTANT: REFERENCE_2_VIDEO only works with veo3_fast + 16:9 (per Kie.ai docs)
      // For veo3 (standard Veo 3.1), use FIRST_AND_LAST_FRAMES_2_VIDEO
      
      const aspectRatio = parameters.aspectRatio || '16:9';
      const isVeo3Fast = kieModel === 'veo3_fast';
      
      if (referenceImages.length === 1) {
        // Single image: use FIRST_AND_LAST_FRAMES_2_VIDEO for veo3, or REFERENCE_2_VIDEO for veo3_fast with 16:9
        if (isVeo3Fast && aspectRatio === '16:9') {
          veoGenerationType = 'REFERENCE_2_VIDEO';
        } else {
          veoGenerationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO';
        }
      } else if (referenceImages.length === 2) {
        // Two images: always use FIRST_AND_LAST_FRAMES_2_VIDEO (first and last frames)
        veoGenerationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO';
      } else if (referenceImages.length === 3) {
        // Three images: REFERENCE_2_VIDEO only works with veo3_fast + 16:9
        if (isVeo3Fast && aspectRatio === '16:9') {
          veoGenerationType = 'REFERENCE_2_VIDEO';
        } else {
          throw new Error('Multi-reference (3 images) only supported with Veo 3.1 Fast model and 16:9 aspect ratio');
        }
      } else {
        throw new Error(`Invalid image count: ${referenceImages.length}. Supported: 1-3 images`);
      }
    }
    
    return await callKieApi('/api/v1/veo/generate', {
      prompt: params.prompt,
      model: kieModel,
      generationType: veoGenerationType,
      imageUrls: referenceImages.length > 0 ? referenceImages : undefined,
      aspectRatio: parameters.aspectRatio || '16:9',
      seeds: parameters.seeds,
      watermark: parameters.watermark,
      callBackUrl: parameters.callBackUrl,
      enableTranslation: true, // Enable automatic prompt translation for better results
    });
  } 
  else if (params.model.startsWith('runway-')) {
    // Runway Gen-3, Aleph - uses /api/v1/runway/generate
    const duration = parameters.duration || 5;
    const quality = parameters.quality || '720p';
    const aspectRatio = parameters.aspectRatio || '16:9';
    
    // Map frontend model names to Kie.ai Runway model identifiers
    let runwayModel = 'GEN3_ALPHA_TURBO';
    if (params.model === 'runway-aleph') {
      runwayModel = 'ALEPH';
    } else if (params.model === 'runway-gen3-alpha-turbo') {
      runwayModel = 'GEN3_ALPHA_TURBO';
    }
    
    // For Runway: single image only (first image from array)
    const imageUrl = referenceImages.length > 0 ? referenceImages[0] : undefined;
    
    return await callKieApi('/api/v1/runway/generate', {
      prompt: params.prompt,
      model: runwayModel, // Include model identifier for Kie.ai routing
      imageUrl,
      duration,
      quality,
      aspectRatio, // Keep aspectRatio for both text and image-to-video
      waterMark: parameters.watermark || '', // Runway uses waterMark (capital M)
      callBackUrl: parameters.callBackUrl,
    });
  }
  else if (params.model.startsWith('seedance-')) {
    // Seedance 1.0 Pro/Lite - uses /api/v1/seedance/generate
    const resolution = parameters.resolution || '720p';
    const duration = parameters.duration || 5;
    const cameraFixed = parameters.cameraFixed !== undefined ? parameters.cameraFixed : false;
    const seed = parameters.seed || -1;
    
    // Determine model variant
    let seedanceModel = 'seedance-1-lite';
    if (params.model === 'seedance-1-pro') {
      seedanceModel = 'seedance-1-pro';
    }
    
    // For image-to-video, include image_url
    const imageUrl = referenceImages.length > 0 ? referenceImages[0] : undefined;
    const endImageUrl = parameters.endImageUrl; // Optional end frame
    
    return await callKieApi('/api/v1/seedance/generate', {
      prompt: params.prompt,
      model: seedanceModel,
      image_url: imageUrl,
      end_image_url: endImageUrl,
      resolution,
      duration,
      camera_fixed: cameraFixed,
      seed,
      callBackUrl: parameters.callBackUrl,
    });
  }
  else if (params.model.startsWith('wan-')) {
    // Wan 2.5 T2V/I2V - uses /api/v1/wan/generate
    const resolution = parameters.resolution || '720p';
    const duration = parameters.duration || 5;
    const aspectRatio = parameters.aspectRatio || '16:9';
    
    // Determine T2V or I2V based on reference images
    const isImageToVideo = referenceImages.length > 0;
    const wanModel = isImageToVideo ? 'wan2.5-i2v-preview' : 'wan2.5-t2v-preview';
    
    const payload: any = {
      model: wanModel,
      prompt: params.prompt,
      negative_prompt: parameters.negativePrompt,
      resolution,
      aspect_ratio: aspectRatio,
      duration,
      seed: parameters.seed,
      callBackUrl: parameters.callBackUrl,
    };
    
    // Add image URL for I2V
    if (isImageToVideo) {
      payload.image_url = referenceImages[0];
    }
    
    // Add audio controls
    if (parameters.audioUrl) {
      payload.audio_url = parameters.audioUrl;
    } else if (parameters.enableAudio) {
      payload.enable_audio = true;
    }
    
    return await callKieApi('/api/v1/wan/generate', payload);
  }
  else if (params.model.startsWith('kling-')) {
    // Kling 2.5 Turbo / 2.1 - uses /api/v1/kling/generate
    const aspectRatio = parameters.aspectRatio || '16:9';
    const duration = parameters.duration || 5;
    const mode = parameters.mode || 'standard';
    
    // Determine model variant
    let klingModel = 'kling-2.5-turbo';
    if (params.model === 'kling-2.1') {
      klingModel = 'kling-2.1';
    }
    
    const payload: any = {
      model: klingModel,
      prompt: params.prompt,
      aspectRatio,
      duration,
      mode,
      negative_prompt: parameters.negativePrompt,
      callBackUrl: parameters.callBackUrl,
    };
    
    // Add image URL for I2V
    if (referenceImages.length > 0) {
      payload.image_url = referenceImages[0];
    }
    
    return await callKieApi('/api/v1/kling/generate', payload);
  }
  
  // Reject unknown models instead of falling back
  throw new Error(`Unsupported video model: ${params.model}. Supported models: veo-3.1, veo-3.1-fast, veo-3, runway-gen3-alpha-turbo, runway-aleph, seedance-1-pro, seedance-1-lite, wan-2.5, kling-2.5-turbo, kling-2.1`);
}

// Image Generation
export async function generateImage(params: {
  model: string;
  prompt: string;
  mode?: string;
  referenceImages?: string[];
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  const mode = params.mode || 'text-to-image';
  const referenceImages = params.referenceImages || [];
  
  // Route to appropriate API based on model
  if (params.model === 'seedream-4') {
    // Seedream 4.0 - up to 4K resolution, batch generation
    const imageResolution = parameters.imageResolution || '2K';
    const imageSize = parameters.imageSize || 'square';
    const maxImages = parameters.maxImages || 1;
    const seed = parameters.seed;
    const watermark = parameters.watermark !== undefined ? parameters.watermark : false;
    
    const payload: any = {
      model: 'bytedance-seedream-4-0-250828',
      prompt: params.prompt,
      image_resolution: imageResolution,
      image_size: imageSize,
      max_images: maxImages,
      seed,
      watermark,
      response_format: 'url',
      callBackUrl: parameters.callBackUrl,
    };
    
    // Add reference images for editing (up to 10 images)
    if (mode === 'image-editing' && referenceImages.length > 0) {
      payload.image_input = referenceImages.slice(0, 10);
    }
    
    // Custom resolution
    if (imageResolution === 'custom' && parameters.width && parameters.height) {
      payload.width = parameters.width;
      payload.height = parameters.height;
    }
    
    return await callKieApi('/api/v1/seedream/generate', payload);
  }
  else if (params.model === 'midjourney-v7') {
    // Midjourney v7 - generates 4 variants with style controls
    const taskType = mode === 'image-editing' ? 'mj_img2img' : 'mj_txt2img';
    const version = parameters.version || '7';
    const speed = parameters.speed || 'Fast';
    const aspectRatio = parameters.aspectRatio || '1:1';
    const stylization = parameters.stylization !== undefined ? parameters.stylization : 100;
    const weirdness = parameters.weirdness !== undefined ? parameters.weirdness : 0;
    const waterMark = parameters.watermark || '';
    
    const payload: any = {
      taskType,
      prompt: params.prompt,
      version,
      speed,
      aspectRatio,
      stylization,
      weirdness,
      waterMark,
      callBackUrl: parameters.callBackUrl,
    };
    
    // Add reference image for img2img
    if (taskType === 'mj_img2img' && referenceImages.length > 0) {
      payload.fileUrl = referenceImages[0];
    }
    
    return await callKieApi('/api/v1/mj/generate', payload);
  }
  else if (params.model === '4o-image' || params.model === 'flux-kontext' || params.model === 'nano-banana') {
    // Existing models: 4o Image, Flux Kontext, Nano Banana
    const payload: any = {
      prompt: params.prompt,
      size: parameters.aspectRatio || '1:1',
      nVariants: parameters.nVariants || 1,
      isEnhance: parameters.isEnhance || false,
      callBackUrl: parameters.callBackUrl,
    };
    
    // Add reference images for editing mode
    if (mode === 'image-editing' && referenceImages.length > 0) {
      payload.filesUrl = referenceImages;
    }
    
    // Add output format and quality if specified
    if (parameters.outputFormat) {
      payload.outputFormat = parameters.outputFormat;
    }
    if (parameters.quality) {
      payload.quality = parameters.quality;
    }
    
    return await callKieApi('/api/v1/gpt4o-image/generate', payload);
  }
  
  throw new Error(`Unsupported image model: ${params.model}. Supported models: 4o-image, flux-kontext, nano-banana, seedream-4, midjourney-v7`);
}

// Helper: Map frontend model names to Kie.ai API model names
function mapSunoModel(model: string): string {
  if (model.includes('v5')) return 'V5';
  if (model.includes('v4.5') || model.includes('v4-5')) {
    return model.includes('plus') ? 'V4_5PLUS' : 'V4_5';
  }
  if (model.includes('v4')) return 'V4';
  return 'V3_5';
}

// Music Generation
export async function generateMusic(params: {
  model: string;
  prompt: string;
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  const kieModel = mapSunoModel(params.model);
  
  return await callKieApi('/api/v1/generate', {
    prompt: params.prompt,
    model: kieModel,
    customMode: parameters.customMode || false,
    instrumental: parameters.instrumental || false,
    style: parameters.style,
    title: parameters.title,
    negativeTags: parameters.negativeTags,
    callBackUrl: parameters.callBackUrl || 'https://placeholder-callback.invalid', // Required by API
  });
}

// Extend Music - Continue an existing song
export async function extendMusic(params: {
  audioUrl: string;
  continueAt?: number;
  continueClipId?: string;
  model?: string;
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  const kieModel = params.model ? mapSunoModel(params.model) : 'V3_5';
  
  return await callKieApi('/api/v1/generate/extend', {
    audioUrl: params.audioUrl,
    continueAt: params.continueAt,
    continueClipId: params.continueClipId,
    model: kieModel,
    callBackUrl: parameters.callBackUrl || 'https://placeholder-callback.invalid',
  });
}

// Generate Lyrics - AI-generated lyrics based on theme/description
export async function generateLyrics(params: {
  prompt: string;
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  
  return await callKieApi('/api/v1/lyrics', {
    prompt: params.prompt,
    callBackUrl: parameters.callBackUrl || 'https://placeholder-callback.invalid',
  });
}

// Upload & Cover - Generate music cover from uploaded audio
export async function uploadCover(params: {
  prompt: string;
  audioUrl: string;
  model?: string;
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  const kieModel = params.model ? mapSunoModel(params.model) : 'V3_5';
  
  return await callKieApi('/api/v1/generate/upload-cover', {
    prompt: params.prompt,
    audioUrl: params.audioUrl,
    model: kieModel,
    callBackUrl: parameters.callBackUrl || 'https://placeholder-callback.invalid',
  });
}

// Upload & Extend - Extend uploaded audio
export async function uploadExtend(params: {
  prompt: string;
  audioUrl: string;
  model?: string;
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  const kieModel = params.model ? mapSunoModel(params.model) : 'V3_5';
  
  return await callKieApi('/api/v1/generate/upload-extend', {
    prompt: params.prompt,
    audioUrl: params.audioUrl,
    model: kieModel,
    callBackUrl: parameters.callBackUrl || 'https://placeholder-callback.invalid',
  });
}

// Note: Image Analysis (GPT-4o Vision) has been moved to server/openaiVision.ts
// because Kie.ai does not offer image analysis/vision capabilities.

// ElevenLabs Voice Cloning - Create custom voice from audio samples
export async function cloneVoice(params: {
  name: string;
  description?: string;
  audioFiles: string[]; // URLs to audio samples (min 60s total recommended)
}): Promise<{ result: any; keyName: string }> {
  return await callKieApi('/api/v1/elevenlabs/voice-clone', {
    name: params.name,
    description: params.description || '',
    files: params.audioFiles,
  });
}

// ElevenLabs Text-to-Speech - Generate speech from text
export async function generateTTS(params: {
  text: string;
  voiceId: string; // Voice ID or pre-made voice name (Rachel, Aria, etc.)
  voiceName?: string; // Display name
  model?: string; // TTS model
  parameters?: {
    stability?: number; // 0-1, default 0.5
    similarityBoost?: number; // 0-1, default 0.75
    style?: number; // 0-1, style exaggeration
    speed?: number; // 0.7-1.2, default 1
    languageCode?: string; // ISO 639-1 code
  };
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  
  const payload: any = {
    text: params.text,
    voice: params.voiceId, // Map voiceId to voice for Kie.ai API
  };
  
  // Add optional parameters
  if (parameters.stability !== undefined) payload.stability = parameters.stability;
  if (parameters.similarityBoost !== undefined) payload.similarity_boost = parameters.similarityBoost;
  if (parameters.style !== undefined) payload.style = parameters.style;
  if (parameters.speed !== undefined) payload.speed = parameters.speed;
  if (parameters.languageCode) payload.language_code = parameters.languageCode;
  
  return await callKieApi('/api/v1/elevenlabs/tts', payload);
}

// ElevenLabs Speech-to-Text (Scribe v1) - Transcribe audio with diarization
export async function transcribeAudio(params: {
  audioUrl: string;
  model?: string; // STT model
  language?: string; // ISO 639-1 code
  parameters?: {
    diarization?: boolean; // Speaker identification
    timestamps?: boolean;
  };
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  
  const payload: any = {
    audio_url: params.audioUrl,
  };
  
  if (params.language) payload.language_code = params.language;
  if (parameters.diarization !== undefined) payload.diarization = parameters.diarization;
  if (parameters.timestamps !== undefined) payload.timestamps = parameters.timestamps;
  
  return await callKieApi('/api/v1/elevenlabs/stt', payload);
}

// Kling AI Avatar - Generate talking avatar video from image + audio/script
export async function generateKlingAvatar(params: {
  sourceImageUrl: string;
  script: string; // What the avatar says (text or audio URL)
  voiceId?: string; // Optional: use specific voice
  provider?: string; // 'kling-ai' or 'infinite-talk'
  parameters?: {
    quality?: '480p' | '720p';
    emotion?: string; // Optional emotion/style guidance
  };
  callBackUrl?: string;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  
  // Check if script is an audio URL or text
  const isAudioUrl = params.script.startsWith('http://') || params.script.startsWith('https://');
  
  const payload: any = {
    image_url: params.sourceImageUrl,
    resolution: parameters.quality || '720p',
  };
  
  if (isAudioUrl) {
    // Script is an audio URL
    payload.audio_url = params.script;
  } else {
    // Script is text - need to convert to audio first or use text field
    payload.text = params.script;
  }
  
  if (parameters.emotion) payload.description = parameters.emotion;
  if (params.callBackUrl) payload.callBackUrl = params.callBackUrl;
  
  return await callKieApi('/api/v1/kling/avatar/generate', payload);
}

// Audio Conversion - Unified function for WAV conversion, vocal removal, stem separation
export async function convertAudio(params: {
  sourceUrl: string;
  operation: 'wav-conversion' | 'vocal-removal' | 'stem-separation';
  parameters?: {
    targetFormat?: 'wav' | 'mp3';
    separationType?: 'separate_vocal' | 'split_stem';
  };
  callBackUrl?: string;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  
  if (params.operation === 'wav-conversion') {
    return await callKieApi('/api/v1/wav/generate', {
      audio_url: params.sourceUrl,
      callBackUrl: params.callBackUrl,
    });
  } else if (params.operation === 'vocal-removal' || params.operation === 'stem-separation') {
    const type = parameters.separationType || 'separate_vocal';
    return await callKieApi('/api/v1/vocal-removal/generate', {
      audio_url: params.sourceUrl,
      type: type,
      callBackUrl: params.callBackUrl,
    });
  }
  
  throw new Error(`Unsupported audio conversion operation: ${params.operation}`);
}

// Topaz AI Image Upscaling - High-fidelity image enhancement
export async function upscaleImage(params: {
  sourceImageUrl: string;
  upscaleFactor: 2 | 4 | 8;
  callBackUrl?: string;
}): Promise<{ result: any; keyName: string }> {
  return await callKieApi('/api/v1/topaz/image-upscale', {
    image_url: params.sourceImageUrl,
    upscale_factor: params.upscaleFactor.toString(),
    callBackUrl: params.callBackUrl,
  });
}

// Topaz AI Video Upscaling - High-fidelity video enhancement
export async function upscaleVideo(params: {
  sourceVideoUrl: string;
  upscaleFactor: 2 | 4;
  callBackUrl?: string;
}): Promise<{ result: any; keyName: string }> {
  return await callKieApi('/api/v1/topaz/video-upscale', {
    video_url: params.sourceVideoUrl,
    upscale_factor: params.upscaleFactor.toString(),
    callBackUrl: params.callBackUrl,
  });
}
