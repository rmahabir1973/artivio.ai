import axios from "axios";
import { storage } from "./storage";

const KIE_API_BASE = "https://api.kie.ai";

// Helper function to generate a random seed for reproducible AI generation
// Seeds are positive integers that models use to initialize their random number generators
function generateRandomSeed(): number {
  // Generate a random integer between 10000 and 99999 (Kie.ai Veo requirement)
  // Veo models require seeds in range 10000-99999 per API documentation
  const raw = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
  return Math.max(10000, Math.min(99999, raw));
}

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
  // Priority order: Official API docs format -> nested response structures -> direct data fields -> top-level fields
  // Include streamAudioUrl, metadata.audio, and all documented variations
  const audioUrl = response?.data?.data?.[0]?.audio_url ||      // Official Suno API callback format (snake_case)
                  response?.data?.data?.[0]?.stream_audio_url || // Official Suno API callback format (snake_case)
                  response?.data?.data?.[0]?.audioUrl ||         // Possible camelCase variant
                  response?.data?.data?.[0]?.streamAudioUrl ||   // Possible camelCase variant
                  response?.data?.response?.sunoData?.[0]?.audioUrl ||
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
    
    // Check if Kie.ai returned an error in the response body (they use 200 OK with error codes)
    if (response.data?.code && response.data.code !== 200) {
      const errorMsg = response.data.msg || response.data.message || 'Unknown error from AI service';
      console.error(`❌ Kie.ai returned error code ${response.data.code}:`, errorMsg);
      
      // Throw an error so it gets caught and handled properly
      const error: any = new Error(errorMsg);
      error.kieaiDetails = {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        endpoint,
      };
      throw error;
    }
    
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
    // Veo 3, 3.1, 3.1 Fast - uses /api/v1/veo/generate (legacy endpoint)
    
    // Validate aspect ratio for Veo models (only 16:9 and 9:16 supported)
    const aspectRatio = parameters.aspectRatio || '16:9';
    if (!['16:9', '9:16'].includes(aspectRatio)) {
      throw new Error(`Veo models only support 16:9 and 9:16 aspect ratios. Received: ${aspectRatio}`);
    }
    
    // Map frontend model name to Kie.ai model name
    let modelName = 'veo3';
    if (params.model === 'veo-3.1') {
      modelName = 'veo3';
    } else if (params.model === 'veo-3.1-fast') {
      modelName = 'veo3_fast';
    } else if (params.model === 'veo-3') {
      modelName = 'veo3';
    }
    
    // Validate Referenced Image support (both veo3 and veo3_fast support image-to-video)
    if (referenceImages.length > 0 && modelName !== 'veo3_fast' && modelName !== 'veo3') {
      throw new Error(`Referenced Images are only supported by Veo 3.1 Quality and Veo 3.1 Fast. Please use one of these models for image-to-video generation.`);
    }
    
    // DEBUG: Log incoming parameters for seed tracing
    console.log(`🔍 [KIEAI SEED DEBUG] Received parameters:`, JSON.stringify({
      seed: parameters.seed,
      seeds: parameters.seeds,
      hasSeed: 'seed' in parameters,
      hasSeeds: 'seeds' in parameters
    }));
    
    // Auto-generate seed if not provided (Veo requires range 10000-99999)
    // Normalize from either 'seed' (singular) or 'seeds' (array from frontend)
    let seed = parameters.seed ?? 
      (Array.isArray(parameters.seeds) ? parameters.seeds[0] : parameters.seeds) ?? 
      generateRandomSeed();
    
    console.log(`🔍 [KIEAI SEED DEBUG] Normalized seed: ${seed} (type: ${typeof seed})`);
    
    // CRITICAL: Veo API requires seeds in range 10000-99999
    // Clamp any out-of-range seeds to valid range
    if (seed < 10000 || seed > 99999) {
      console.warn(`⚠️ Veo seed ${seed} out of range, regenerating...`);
      seed = generateRandomSeed();
    }
    
    console.log(`🌱 Veo seed format: sending seeds=${seed} to Kie.ai API`);
    
    // Build request payload for /api/v1/veo/generate
    const payload: any = {
      model: modelName,
      prompt: params.prompt,
      aspectRatio: aspectRatio,
      seeds: seed,  // Kie.ai uses "seeds" (plural) parameter
      callBackUrl: parameters.callBackUrl,
    };
    
    // Add image URLs if present (for image-to-video on veo3_fast only)
    if (referenceImages.length > 0) {
      payload.imageUrls = referenceImages;
      payload.generationType = 'REFERENCE_2_VIDEO';
    }
    
    // Add optional watermark parameter
    if (parameters.watermark !== undefined) {
      payload.waterMark = parameters.watermark;
    }
    
    return await callKieApi('/api/v1/veo/generate', payload);
  } 
  else if (params.model === 'runway-gen3-alpha-turbo') {
    // Runway Gen-3 - uses /api/v1/runway/generate
    const duration = parameters.duration || 5;
    // ALWAYS use 720p (HD quality) - ignore any incoming quality parameter
    const quality = '720p';
    const aspectRatio = parameters.aspectRatio || '16:9';
    
    // Validate aspect ratio for Runway Gen-3 (supports 16:9, 4:3, 1:1, 3:4, 9:16)
    if (!['16:9', '4:3', '1:1', '3:4', '9:16'].includes(aspectRatio)) {
      throw new Error(`Runway Gen-3 supports 16:9, 4:3, 1:1, 3:4, and 9:16 aspect ratios. Received: ${aspectRatio}`);
    }
    
    // For Runway Gen-3: single image only (first image from array)
    const imageUrl = referenceImages.length > 0 ? referenceImages[0] : undefined;
    
    return await callKieApi('/api/v1/runway/generate', {
      prompt: params.prompt,
      imageUrl,
      duration,
      quality,
      // Only send aspectRatio for text-to-video (exclude when imageUrl is present)
      ...(imageUrl ? {} : { aspectRatio }),
      waterMark: parameters.watermark || '', // Runway uses waterMark (capital M)
      callBackUrl: parameters.callBackUrl,
    });
  }
  else if (params.model.startsWith('seedance-')) {
    // Seedance 1.0 Pro/Lite - uses /api/v1/jobs/createTask (Bytedance API)
    const resolution = parameters.resolution || '720p';
    const duration = parameters.duration ? String(parameters.duration) : '10';
    const cameraFixed = parameters.cameraFixed !== undefined ? parameters.cameraFixed : false;
    // Auto-generate seed if not provided (instead of using -1)
    const seed = parameters.seed !== undefined ? parameters.seed : generateRandomSeed();
    
    // Check if this is image-to-video mode (aspect ratio determined by input image)
    const isImageToVideo = referenceImages.length > 0;
    
    // For image-to-video: aspect ratio is omitted (determined by input image)
    // For text-to-video: validate and use provided aspectRatio (default to 16:9)
    let aspectRatio: string | undefined = undefined;
    
    if (isImageToVideo) {
      // Image-to-video mode: do NOT set or validate aspect ratio
      // The aspect ratio is determined by the input image itself
      console.log('Seedance image-to-video mode: aspect ratio will be determined by input image');
    } else {
      // Text-to-video mode: validate and use aspect ratio
      const validatedAspectRatio = parameters.aspectRatio || '16:9';
      
      // Seedance Pro supports 21:9, 16:9, 4:3, 1:1, 3:4, 9:16
      // Seedance Lite supports 16:9, 4:3, 1:1, 3:4, 9:16, 9:21
      const isPro = params.model === 'seedance-1-pro';
      const supportedRatios = isPro 
        ? ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']
        : ['16:9', '4:3', '1:1', '3:4', '9:16', '9:21'];
      
      if (!supportedRatios.includes(validatedAspectRatio)) {
        const modelName = isPro ? 'Seedance Pro' : 'Seedance Lite';
        throw new Error(`${modelName} supports ${supportedRatios.join(', ')} aspect ratios. Received: ${validatedAspectRatio}`);
      }
      
      aspectRatio = validatedAspectRatio;
    }
    
    // Validate duration (5 or 10 seconds only)
    if (!['5', '10'].includes(duration)) {
      throw new Error(`Seedance models support 5 or 10 second durations. Received: ${duration}`);
    }
    
    // Map to Bytedance model names
    let bytedanceModel = 'bytedance/v1-lite-text-to-video';
    if (params.model === 'seedance-1-pro') {
      bytedanceModel = 'bytedance/v1-pro-text-to-video';
    }
    
    // Build input object - start with common fields
    const inputPayload: any = {
      prompt: params.prompt,
      resolution,
      duration,
      camera_fixed: cameraFixed,
      seed,
      enable_safety_checker: true,
    };
    
    // Explicitly add aspect_ratio ONLY for text-to-video mode
    if (!isImageToVideo && aspectRatio) {
      inputPayload.aspect_ratio = aspectRatio;
    }
    
    // For image-to-video: add image_url to input (Bytedance supports single image)
    if (isImageToVideo) {
      inputPayload.image_url = referenceImages[0];
    }
    
    return await callKieApi('/api/v1/jobs/createTask', {
      model: bytedanceModel,
      callBackUrl: parameters.callBackUrl,
      input: inputPayload,
    });
  }
  else if (params.model.startsWith('wan-')) {
    // Wan 2.5 T2V/I2V - uses /api/v1/jobs/createTask (Bytedance Playground API)
    const resolution = parameters.resolution || '720p';
    const duration = parameters.duration ? String(parameters.duration) : '5';
    
    // Validate duration (5 or 10 seconds only)
    if (!['5', '10'].includes(duration)) {
      throw new Error(`Wan models support 5 or 10 second durations. Received: ${duration}`);
    }
    
    // Validate resolution (720p or 1080p only)
    if (!['720p', '1080p'].includes(resolution)) {
      throw new Error(`Wan models support 720p or 1080p resolutions. Received: ${resolution}`);
    }
    
    // Determine T2V or I2V based on reference images
    const isImageToVideo = referenceImages.length > 0;
    const wanModel = isImageToVideo ? 'wan/2-5-image-to-video' : 'wan/2-5-text-to-video';
    
    // Auto-generate seed if not provided
    const seed = parameters.seed !== undefined ? parameters.seed : generateRandomSeed();
    
    // Build input object
    const inputPayload: any = {
      prompt: params.prompt,
      duration,
      resolution,
      seed,
    };
    
    // Add optional negative_prompt if provided
    if (parameters.negativePrompt) {
      inputPayload.negative_prompt = parameters.negativePrompt;
    }
    
    // Add enable_prompt_expansion (defaults to true if not specified)
    inputPayload.enable_prompt_expansion = parameters.enablePromptExpansion !== undefined 
      ? parameters.enablePromptExpansion 
      : true;
    
    // For image-to-video: add image_url to input (Wan requires single image)
    if (isImageToVideo) {
      if (referenceImages.length === 0) {
        throw new Error('Wan image-to-video requires exactly 1 reference image');
      }
      inputPayload.image_url = referenceImages[0];
    }
    
    return await callKieApi('/api/v1/jobs/createTask', {
      model: wanModel,
      callBackUrl: parameters.callBackUrl,
      input: inputPayload,
    });
  }
  else if (params.model.startsWith('kling-')) {
    // Kling 2.5 Turbo - uses /api/v1/jobs/createTask (Bytedance Playground API)
    const isImageToVideo = generationType === 'image-to-video';
    const aspectRatio = parameters.aspectRatio || '16:9';
    const duration = parameters.duration ? String(parameters.duration) : '5';
    
    // Validate aspect ratio for Kling models (16:9, 9:16, 1:1 supported)
    if (!['16:9', '9:16', '1:1'].includes(aspectRatio)) {
      throw new Error(`Kling models support 16:9, 9:16, and 1:1 aspect ratios. Received: ${aspectRatio}`);
    }
    
    // Validate duration (5 or 10 seconds only)
    if (!['5', '10'].includes(duration)) {
      throw new Error(`Kling models support 5 or 10 second durations. Received: ${duration}`);
    }
    
    // Kling 2.5 Turbo: different models for text-to-video vs image-to-video
    const klingModel = isImageToVideo 
      ? 'kling/v2-5-turbo-image-to-video-pro'
      : 'kling/v2-5-turbo-text-to-video-pro';
    
    // Build input object
    const inputPayload: any = {
      prompt: params.prompt,
      duration,
    };
    
    // Add aspect_ratio for text-to-video only (for I2V, aspect ratio is determined by input image)
    if (!isImageToVideo) {
      inputPayload.aspect_ratio = aspectRatio;
    }
    
    // Add optional negative_prompt if provided
    if (parameters.negativePrompt) {
      inputPayload.negative_prompt = parameters.negativePrompt;
    }
    
    // Add cfg_scale (defaults to 0.5 if not specified)
    inputPayload.cfg_scale = parameters.cfgScale !== undefined ? parameters.cfgScale : 0.5;
    
    // For image-to-video: add image_url to input
    if (isImageToVideo) {
      if (referenceImages.length === 0) {
        throw new Error('Kling image-to-video requires exactly 1 reference image');
      }
      inputPayload.image_url = referenceImages[0];
    }
    
    return await callKieApi('/api/v1/jobs/createTask', {
      model: klingModel,
      callBackUrl: parameters.callBackUrl,
      input: inputPayload,
    });
  }
  else if (params.model.startsWith('grok-')) {
    // Grok Imagine - Image-to-Video only (uses /api/v1/jobs/createTask)
    const mode = parameters.mode || 'normal'; // fun, normal, or spicy
    
    // Grok requires an image input (image-to-video only, not text-to-video)
    if (referenceImages.length === 0) {
      throw new Error('Grok image-to-video requires exactly 1 reference image');
    }
    
    // Build input object
    const inputPayload: any = {
      image_urls: [referenceImages[0]], // Grok uses array with single image
      prompt: params.prompt,
      mode,
    };
    
    // Optional: If user provides a Grok task_id and index to use previously generated image
    if (parameters.grokTaskId) {
      delete inputPayload.image_urls; // Don't use external image
      inputPayload.task_id = parameters.grokTaskId;
      inputPayload.index = parameters.grokImageIndex !== undefined ? parameters.grokImageIndex : 0;
    }
    
    return await callKieApi('/api/v1/jobs/createTask', {
      model: 'grok-imagine/image-to-video',
      callBackUrl: parameters.callBackUrl,
      input: inputPayload,
    });
  }
  else if (params.model.startsWith('sora-2')) {
    // Sora 2 - uses /api/v1/jobs/createTask (Bytedance Playground API)
    // Convert aspect ratio from frontend format ("16:9"/"9:16") to API format ("landscape"/"portrait")
    let aspectRatio = parameters.aspectRatio || 'landscape';
    if (aspectRatio === '16:9') {
      aspectRatio = 'landscape';
    } else if (aspectRatio === '9:16') {
      aspectRatio = 'portrait';
    } else if (aspectRatio !== 'landscape' && aspectRatio !== 'portrait') {
      // If invalid value, default to landscape and log warning
      console.warn(`[SORA-2] Invalid aspect ratio "${aspectRatio}", defaulting to "landscape"`);
      aspectRatio = 'landscape';
    }
    
    const nFrames = parameters.nFrames || '10'; // 10s, 15s, or 25s (for storyboard)
    const removeWatermark = parameters.removeWatermark !== undefined ? parameters.removeWatermark : true;
    
    // Quality/size parameter for Sora 2 (standard or high)
    const size = parameters.soraQuality === 'high' ? 'high' : 'standard';
    
    // Determine model variant
    let soraModel = 'sora-2-text-to-video';
    if (params.model === 'sora-2-pro-storyboard') {
      soraModel = 'sora-2-pro-storyboard';
    } else if (params.model === 'sora-2-image-to-video' || (params.model === 'sora-2' && referenceImages.length > 0)) {
      soraModel = 'sora-2-image-to-video';
    }
    
    // Build input object
    const inputPayload: any = {
      prompt: params.prompt,
      aspect_ratio: aspectRatio,
      n_frames: nFrames,
      remove_watermark: removeWatermark,
      size: size, // Add quality/size parameter (standard or high)
    };
    
    // Sora 2 Pro Storyboard: Multi-scene support
    if (soraModel === 'sora-2-pro-storyboard' && parameters.shots) {
      // Validate shots array
      if (!Array.isArray(parameters.shots) || parameters.shots.length < 2 || parameters.shots.length > 3) {
        throw new Error('Storyboard requires 2-3 scenes');
      }

      // Validate each shot has Scene and duration
      parameters.shots.forEach((shot: any, index: number) => {
        if (!shot.Scene || typeof shot.Scene !== 'string' || !shot.Scene.trim()) {
          throw new Error(`Scene ${index + 1} must have a prompt`);
        }
        if (typeof shot.duration !== 'number' || !Number.isInteger(shot.duration) || shot.duration < 1) {
          throw new Error(`Scene ${index + 1} duration must be a positive integer`);
        }
      });

      // Validate total duration matches n_frames
      const totalSceneDuration = parameters.shots.reduce((sum: number, shot: any) => sum + shot.duration, 0);
      const targetDuration = parseInt(nFrames);
      if (totalSceneDuration !== targetDuration) {
        throw new Error(`Scene durations (${totalSceneDuration}s) must sum to total duration (${targetDuration}s)`);
      }

      inputPayload.shots = parameters.shots; // Array of {Scene: string, duration: number}
      delete inputPayload.prompt; // Storyboard uses shots instead of prompt
    }
    
    // Image-to-Video: Add image URLs
    if ((soraModel === 'sora-2-image-to-video' || soraModel === 'sora-2-pro-storyboard') && referenceImages.length > 0) {
      inputPayload.image_urls = referenceImages;
    }
    
    return await callKieApi('/api/v1/jobs/createTask', {
      model: soraModel,
      callBackUrl: parameters.callBackUrl,
      input: inputPayload,
    });
  }
  
  // Reject unknown models instead of falling back
  throw new Error(`Unsupported video model: ${params.model}. Supported models: veo-3.1, veo-3.1-fast, runway-gen3-alpha-turbo, seedance-1-pro, seedance-1-lite, wan-2.5, kling-2.5-turbo, grok-imagine, sora-2, sora-2-image-to-video, sora-2-pro-storyboard`);
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
    // Seedream 4.0 - uses /api/v1/jobs/createTask (Bytedance Playground API)
    const imageResolution = parameters.imageResolution || '1K';
    const imageSize = parameters.imageSize || 'square_hd';
    const maxImages = parameters.maxImages || 1;
    // Auto-generate seed if not provided
    const seed = parameters.seed !== undefined ? parameters.seed : generateRandomSeed();
    
    // Build input object
    const inputPayload: any = {
      prompt: params.prompt,
      image_size: imageSize,
      image_resolution: imageResolution,
      max_images: maxImages,
      seed,
    };
    
    // Add reference images for editing (up to 10 images) - if supported
    if (mode === 'image-editing' && referenceImages.length > 0) {
      inputPayload.image_input = referenceImages.slice(0, 10);
    }
    
    return await callKieApi('/api/v1/jobs/createTask', {
      model: 'bytedance/seedream-v4-text-to-image',
      callBackUrl: parameters.callBackUrl,
      input: inputPayload,
    });
  }
  else if (params.model === 'midjourney-v7') {
    // Midjourney v7 - uses dedicated /api/v1/mj/generate endpoint (per official API docs)
    const aspectRatio = parameters.aspectRatio || '1:1';
    const version = parameters.version || '7';
    const speed = parameters.speed || 'relaxed'; // relaxed, fast, or turbo
    const stylization = parameters.stylization !== undefined ? parameters.stylization : 100; // 0-1000
    const weirdness = parameters.weirdness !== undefined ? parameters.weirdness : 0; // 0-3000
    const variety = parameters.variety !== undefined ? parameters.variety : 0; // 0-100, increment by 5
    const waterMark = parameters.watermark || '';
    const enableTranslation = parameters.enableTranslation !== undefined ? parameters.enableTranslation : false;
    
    // Determine taskType based on mode
    let taskType = 'mj_txt2img'; // Default: text-to-image
    if (mode === 'image-editing' && referenceImages.length > 0) {
      taskType = 'mj_img2img'; // Image-to-image
    }
    
    // Build Midjourney-specific payload (direct fields, NOT input object)
    const payload: any = {
      taskType,
      prompt: params.prompt,
      speed,
      aspectRatio,
      version,
      variety,
      stylization,
      weirdness,
      waterMark,
      enableTranslation,
      callBackUrl: parameters.callBackUrl,
    };
    
    // Add reference images for image-to-image mode (use fileUrls array)
    if (referenceImages.length > 0) {
      payload.fileUrls = referenceImages;
    }
    
    return await callKieApi('/api/v1/mj/generate', payload);
  }
  else if (params.model === 'nano-banana') {
    // Nano Banana - uses /api/v1/jobs/createTask (Bytedance Playground API)
    const aspectRatio = parameters.aspectRatio || '1:1';
    const resolution = parameters.resolution || '1K';
    const outputFormat = parameters.outputFormat || 'png';
    
    // Build input object
    const inputPayload: any = {
      prompt: params.prompt,
      aspect_ratio: aspectRatio,
      resolution: resolution,
      output_format: outputFormat,
    };
    
    // Add reference images for editing mode
    if (mode === 'image-editing' && referenceImages.length > 0) {
      inputPayload.image_input = referenceImages;
    }
    
    return await callKieApi('/api/v1/jobs/createTask', {
      model: 'nano-banana-pro',
      callBackUrl: parameters.callBackUrl,
      input: inputPayload,
    });
  }
  else if (params.model === '4o-image') {
    // 4o Image - uses dedicated /api/v1/gpt4o-image/generate endpoint (per official API docs)
    const size = parameters.aspectRatio || '1:1'; // size uses aspect ratio format (1:1, 3:2, 2:3)
    const nVariants = parameters.nVariants || 1; // 1, 2, or 4
    const isEnhance = parameters.isEnhance !== undefined ? parameters.isEnhance : false;
    const enableFallback = parameters.enableFallback !== undefined ? parameters.enableFallback : false;
    
    // Build 4o-Image-specific payload (direct fields, NOT input object)
    // Note: 4o-image API does not support outputFormat or quality parameters
    const payload: any = {
      prompt: params.prompt,
      size,
      nVariants,
      isEnhance,
      enableFallback,
      callBackUrl: parameters.callBackUrl,
    };
    
    // Add reference images for image-editing mode (use filesUrl array)
    if (referenceImages.length > 0) {
      payload.filesUrl = referenceImages;
    }
    
    // Add mask URL if provided (for precise editing)
    if (parameters.maskUrl) {
      payload.maskUrl = parameters.maskUrl;
    }
    
    return await callKieApi('/api/v1/gpt4o-image/generate', payload);
  }
  else if (params.model === 'flux-kontext') {
    // Flux Kontext - uses dedicated /api/v1/flux/kontext/generate endpoint (per official API docs)
    const aspectRatio = parameters.aspectRatio || '16:9'; // Default 16:9
    
    // Map fluxModel ("pro" or "max") to full Kie API model name
    const fluxModelParam = parameters.model || 'pro'; // "pro" or "max" from frontend
    const model = fluxModelParam === 'max' ? 'flux-kontext-max' : 'flux-kontext-pro';
    
    // Ensure lowercase format for output format (API expects lowercase: "png" or "jpeg")
    const outputFormatParam = parameters.outputFormat || 'jpeg'; // Could be PNG, JPEG, png, jpeg
    const outputFormat = outputFormatParam.toLowerCase(); // Normalize to lowercase
    
    const enableTranslation = parameters.enableTranslation !== undefined ? parameters.enableTranslation : true;
    const promptUpsampling = parameters.promptUpsampling !== undefined ? parameters.promptUpsampling : false;
    const safetyTolerance = parameters.safetyTolerance !== undefined ? parameters.safetyTolerance : 2; // 0-6 for generation, 0-2 for editing
    
    // Build Flux Kontext-specific payload (direct fields, NOT input object)
    const payload: any = {
      prompt: params.prompt,
      aspectRatio,
      outputFormat,
      promptUpsampling,
      model,
      enableTranslation,
      safetyTolerance,
      callBackUrl: parameters.callBackUrl,
    };
    
    // Add input image for image editing mode (use inputImage, NOT filesUrl or image_input)
    if (referenceImages.length > 0) {
      payload.inputImage = referenceImages[0]; // Flux Kontext only supports single image
    }
    
    // Add optional watermark
    if (parameters.watermark) {
      payload.watermark = parameters.watermark;
    }
    
    // Add optional uploadCn region selection
    if (parameters.uploadCn !== undefined) {
      payload.uploadCn = parameters.uploadCn;
    }
    
    return await callKieApi('/api/v1/flux/kontext/generate', payload);
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

// Generate Sound Effects - ElevenLabs Sound Effect V2
// Uses /api/v1/jobs/createTask with nested input object (Bytedance/Playground format)
export async function generateSoundEffects(params: {
  text: string;
  loop?: boolean;
  duration_seconds?: number;
  prompt_influence?: number;
  output_format?: string;
  callBackUrl?: string;
}): Promise<{ result: any; keyName: string }> {
  return await callKieApi('/api/v1/jobs/createTask', {
    model: 'elevenlabs/sound-effect-v2',
    callBackUrl: params.callBackUrl,
    input: {
      text: params.text,
      loop: params.loop,
      duration_seconds: params.duration_seconds,
      prompt_influence: params.prompt_influence,
      output_format: params.output_format,
    },
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

// ElevenLabs pre-made voice IDs (name -> UUID mapping)
const ELEVENLABS_VOICE_IDS: Record<string, string> = {
  'Rachel': '21m00Tcm4TlvDq8ikWAM',
  'Aria': 'jBpfuIE2acCO8z3wKNLl',
  'Clyde': '2EiwWnXFnvU5JabPgLCL',
  'Dave': 'CZu28rHgowwuK7YYn3hy',
  'Drew': '29vD33N1CtxCmqQRPOHJ',
  'Fin': 'D38z5RcWu1voky8WS1d4',
  'Freya': 'EXAVITQu4vr4xnSDxMaL',
  'Gigi': 'jsCqWAovK2LkvIQuEKAH',
  'Glinda': 'z9f4UES4z5qFZrXQ5QIW',
  'Harry': 'SOYHLrjzK2X1ezoYZXXB',
};

// ElevenLabs Text-to-Speech - Generate speech from text
// Uses /api/v1/jobs/createTask with nested input object (similar to Sound Effects)
export async function generateTTS(params: {
  text: string;
  voiceId: string; // Voice ID (UUID) or pre-made voice name (Rachel, Aria, etc.)
  voiceName?: string; // Display name
  model?: string; // TTS model
  parameters?: {
    stability?: number; // 0-1, default 0.5
    similarityBoost?: number; // 0-1, default 0.75
    style?: number; // 0-1, style exaggeration
    speed?: number; // 0.7-1.2, default 1
    languageCode?: string; // ISO 639-1 code
  };
  callBackUrl?: string;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  
  // Convert voice name to UUID if it's a pre-made voice
  let voiceUUID = params.voiceId;
  if (params.voiceId in ELEVENLABS_VOICE_IDS) {
    voiceUUID = ELEVENLABS_VOICE_IDS[params.voiceId];
    console.log(`📞 Mapping voice name "${params.voiceId}" to UUID: ${voiceUUID}`);
  }
  
  const input: any = {
    text: params.text,
    voice_id: voiceUUID,
  };
  
  // Add optional parameters
  if (parameters.stability !== undefined) input.stability = parameters.stability;
  if (parameters.similarityBoost !== undefined) input.similarity_boost = parameters.similarityBoost;
  if (parameters.style !== undefined) input.style = parameters.style;
  if (parameters.speed !== undefined) input.speed = parameters.speed;
  if (parameters.languageCode) input.language_code = parameters.languageCode;
  
  return await callKieApi('/api/v1/jobs/createTask', {
    model: 'elevenlabs/text-to-speech-multilingual-v2',
    callBackUrl: params.callBackUrl,
    input,
  });
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

// InfiniteTalk Lip Sync - Generate lip-sync video from image + audio
export async function generateLipSync(params: {
  imageUrl: string;
  audioUrl: string;
  prompt?: string; // Optional prompt for guidance
  resolution?: '480p' | '720p';
  seed?: number;
  callBackUrl?: string;
}): Promise<{ result: any; keyName: string }> {
  const resolution = params.resolution || '720p';
  
  const input: any = {
    image_url: params.imageUrl,
    audio_url: params.audioUrl,
    resolution,
  };
  
  if (params.prompt) input.prompt = params.prompt;
  if (params.seed !== undefined) input.seed = params.seed;
  
  return await callKieApi('/api/v1/jobs/createTask', {
    model: 'infinitalk/from-audio',
    callBackUrl: params.callBackUrl,
    input,
  });
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
// Uses Bytedance/Playground format: /api/v1/jobs/createTask with nested input object
export async function upscaleImage(params: {
  sourceImageUrl: string;
  upscaleFactor: 2 | 4 | 8;
  callBackUrl?: string;
}): Promise<{ result: any; keyName: string }> {
  return await callKieApi('/api/v1/jobs/createTask', {
    model: 'topaz/image-upscale',
    callBackUrl: params.callBackUrl,
    input: {
      image_url: params.sourceImageUrl,
      upscale_factor: params.upscaleFactor.toString(),
    },
  });
}

// Topaz AI Video Upscaling - High-fidelity video enhancement
// Uses Bytedance/Playground format: /api/v1/jobs/createTask with nested input object
export async function upscaleVideo(params: {
  sourceVideoUrl: string;
  upscaleFactor: 2 | 4;
  callBackUrl?: string;
}): Promise<{ result: any; keyName: string }> {
  return await callKieApi('/api/v1/jobs/createTask', {
    model: 'topaz/video-upscale',
    callBackUrl: params.callBackUrl,
    input: {
      video_url: params.sourceVideoUrl,
      upscale_factor: params.upscaleFactor.toString(),
    },
  });
}
