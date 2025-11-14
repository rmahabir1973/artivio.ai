import axios from "axios";
import { storage } from "./storage";

const KIE_API_BASE = "https://api.kie.ai";

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
      await storage.addApiKey({
        keyName,
        isActive: true,
      });
      console.log(`Added API key: ${keyName}`);
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

  // Get the actual key value from environment
  const keyValue = process.env[key.keyName];
  if (!keyValue) {
    throw new Error(`API key ${key.keyName} is configured but not found in environment variables.`);
  }

  return { keyValue, keyName: key.keyName };
}

// Generic API call to Kie.ai
async function callKieApi(endpoint: string, data: any): Promise<{ result: any; keyName: string }> {
  const { keyValue, keyName } = await getApiKey();
  
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
    
    return { result: response.data, keyName };
  } catch (error: any) {
    console.error('Kie.ai API Error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Failed to communicate with AI service'
    );
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
      // Smart defaults based on image count:
      // - 1 image: REFERENCE_2_VIDEO (single reference)
      // - 2 images: FIRST_AND_LAST_FRAMES_2_VIDEO (keyframe animation)
      // - 3 images: REFERENCE_2_VIDEO (multi-reference)
      if (referenceImages.length === 2) {
        veoGenerationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO';
      } else {
        veoGenerationType = 'REFERENCE_2_VIDEO';
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
  
  // Reject unknown models instead of falling back
  throw new Error(`Unsupported video model: ${params.model}. Supported models: veo-3.1, veo-3.1-fast, runway-gen3-alpha-turbo, runway-aleph`);
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
  
  // Build request payload based on mode
  const payload: any = {
    prompt: params.prompt,
    size: parameters.aspectRatio || '1:1',
    nVariants: parameters.nVariants || 1,
    isEnhance: parameters.isEnhance || false,
    callBackUrl: parameters.callBackUrl,
  };
  
  // Add reference images for editing mode
  if (mode === 'image-editing' && referenceImages.length > 0) {
    payload.imageUrls = referenceImages;
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

// Music Generation
export async function generateMusic(params: {
  model: string;
  prompt: string;
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  
  // Map frontend model names to Kie.ai API model names
  let kieModel = 'V3_5';
  if (params.model.includes('v4.5') || params.model.includes('v4-5')) {
    kieModel = 'V4_5';
  } else if (params.model.includes('v4')) {
    kieModel = 'V4';
  } else if (params.model.includes('v3.5') || params.model.includes('v3-5')) {
    kieModel = 'V3_5';
  }
  
  return await callKieApi('/api/v1/generate', {
    prompt: params.prompt,
    model: kieModel,
    customMode: false, // Use simple mode for now
    instrumental: parameters.instrumental || false,
    callBackUrl: parameters.callBackUrl || 'https://placeholder-callback.invalid', // Required by API
  });
}

// Image Analysis - GPT-4o Vision
export async function analyzeImage(params: {
  imageUrl: string;
  prompt?: string;
  model?: string;
}): Promise<{ result: any; keyName: string }> {
  const analysisPrompt = params.prompt || 
    "Analyze this image in detail. Describe what's happening in the picture, including: the main subjects, their actions and interactions, the setting/environment, notable objects or details, colors and composition, mood or atmosphere, and any text visible in the image. Provide a comprehensive analysis.";
  
  return await callKieApi('/api/v1/gpt4o-image/analyze', {
    imageUrl: params.imageUrl,
    prompt: analysisPrompt,
    model: params.model || 'gpt-4o',
  });
}

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
