import axios from 'axios';
import FormData from 'form-data';

const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY;
const FISH_AUDIO_API_URL = 'https://api.fish.audio';

interface FishAudioVoice {
  _id: string;
  type: 'svc' | 'tts';
  title: string;
  description: string;
  cover_image: string;
  state: 'created' | 'training' | 'trained' | 'failed';
  tags: string[];
  created_at: string;
  updated_at: string;
  visibility: 'public' | 'unlist' | 'private';
  like_count: number;
  mark_count: number;
  shared_count: number;
  task_count: number;
  languages?: string[];
  samples?: Array<{
    audio: string;
    text?: string;
  }>;
  author?: {
    _id: string;
    nickname: string;
    avatar: string;
  };
}

interface ListVoicesResponse {
  total: number;
  items: FishAudioVoice[];
}

interface CreateModelResponse {
  _id: string;
  title: string;
  description: string;
  visibility: string;
  type: string;
  state: string;
  created_at: string;
}

function getApiKey(): string {
  if (!FISH_AUDIO_API_KEY) {
    throw new Error('FISH_AUDIO_API_KEY environment variable is not set');
  }
  return FISH_AUDIO_API_KEY;
}

export function isFishAudioConfigured(): boolean {
  return !!process.env.FISH_AUDIO_API_KEY;
}

export async function listVoices(params: {
  pageSize?: number;
  pageNumber?: number;
  title?: string;
  tag?: string;
  self?: boolean;
  language?: string;
  sortBy?: 'score' | 'task_count' | 'created_at';
}): Promise<ListVoicesResponse> {
  const apiKey = getApiKey();
  
  const queryParams = new URLSearchParams();
  if (params.pageSize) queryParams.set('page_size', params.pageSize.toString());
  if (params.pageNumber) queryParams.set('page_number', params.pageNumber.toString());
  if (params.title) queryParams.set('title', params.title);
  if (params.tag) queryParams.set('tag', params.tag);
  if (params.self !== undefined) queryParams.set('self', params.self.toString());
  if (params.language) queryParams.set('language', params.language);
  if (params.sortBy) queryParams.set('sort_by', params.sortBy);
  
  console.log(`[FishAudio] Listing voices with params:`, params);
  
  try {
    const response = await axios.get<ListVoicesResponse>(
      `${FISH_AUDIO_API_URL}/model?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );
    
    console.log(`[FishAudio] Found ${response.data.total} voices`);
    return response.data;
  } catch (error: any) {
    console.error('[FishAudio] Failed to list voices:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw new Error(error.response?.data?.detail || error.message || 'Failed to list voices');
  }
}

export async function getVoice(modelId: string): Promise<FishAudioVoice | null> {
  const apiKey = getApiKey();
  
  try {
    const response = await axios.get<FishAudioVoice>(
      `${FISH_AUDIO_API_URL}/model/${modelId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );
    
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function generateSpeech(params: {
  text: string;
  referenceId: string;
  format?: 'mp3' | 'wav' | 'pcm' | 'opus';
  temperature?: number;
  topP?: number;
  speed?: number;
  volume?: number;
  chunkLength?: number;
  normalize?: boolean;
  sampleRate?: number;
  mp3Bitrate?: 64 | 128 | 192;
  latency?: 'normal' | 'balanced';
}): Promise<Buffer> {
  const apiKey = getApiKey();
  
  console.log(`[FishAudio] Generating speech for text (${params.text.length} chars) with voice ${params.referenceId}`);
  
  const requestBody: any = {
    text: params.text,
    reference_id: params.referenceId,
    format: params.format || 'mp3',
    temperature: params.temperature ?? 0.9,
    top_p: params.topP ?? 0.9,
    chunk_length: params.chunkLength ?? 200,
    normalize: params.normalize ?? true,
    latency: params.latency || 'normal',
  };
  
  if (params.speed !== undefined || params.volume !== undefined) {
    requestBody.prosody = {
      speed: params.speed ?? 1,
      volume: params.volume ?? 0,
    };
  }
  
  if (params.sampleRate) {
    requestBody.sample_rate = params.sampleRate;
  }
  
  if (params.mp3Bitrate) {
    requestBody.mp3_bitrate = params.mp3Bitrate;
  }
  
  try {
    const response = await axios.post(
      `${FISH_AUDIO_API_URL}/v1/tts`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'model': 's1',
        },
        responseType: 'arraybuffer',
        timeout: 120000,
      }
    );
    
    console.log(`[FishAudio] Speech generated successfully, ${response.data.byteLength} bytes`);
    return Buffer.from(response.data);
  } catch (error: any) {
    console.error('[FishAudio] TTS generation failed:', {
      status: error.response?.status,
      data: error.response?.data ? Buffer.from(error.response.data).toString() : null,
      message: error.message,
    });
    
    let errorMessage = 'TTS generation failed';
    if (error.response?.data) {
      try {
        const errorData = JSON.parse(Buffer.from(error.response.data).toString());
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = Buffer.from(error.response.data).toString() || errorMessage;
      }
    }
    
    throw new Error(errorMessage);
  }
}

export async function createVoiceModel(params: {
  title: string;
  description?: string;
  visibility?: 'public' | 'unlist' | 'private';
  tags?: string[];
  audioBuffers: Array<{ buffer: Buffer; filename: string; mimeType: string }>;
  texts?: string[];
  trainMode?: 'fast';
}): Promise<CreateModelResponse> {
  const apiKey = getApiKey();
  
  const formData = new FormData();
  formData.append('visibility', params.visibility || 'private');
  formData.append('type', 'tts');
  formData.append('title', params.title);
  
  if (params.description) {
    formData.append('description', params.description);
  }
  
  if (params.tags && params.tags.length > 0) {
    for (const tag of params.tags) {
      formData.append('tags', tag);
    }
  }
  
  if (params.trainMode) {
    formData.append('train_mode', params.trainMode);
  }
  
  for (let i = 0; i < params.audioBuffers.length; i++) {
    const audio = params.audioBuffers[i];
    formData.append('voices', audio.buffer, {
      filename: audio.filename,
      contentType: audio.mimeType,
    });
    
    if (params.texts && params.texts[i]) {
      formData.append('texts', params.texts[i]);
    }
  }
  
  console.log(`[FishAudio] Creating voice model "${params.title}" with ${params.audioBuffers.length} audio files...`);
  
  try {
    const response = await axios.post<CreateModelResponse>(
      `${FISH_AUDIO_API_URL}/model`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
        timeout: 300000,
      }
    );
    
    console.log(`[FishAudio] Voice model created successfully: ${response.data._id}`);
    return response.data;
  } catch (error: any) {
    console.error('[FishAudio] Voice model creation failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    
    const errorMessage = error.response?.data?.detail 
      || error.response?.data?.message 
      || error.message 
      || 'Voice model creation failed';
    
    throw new Error(errorMessage);
  }
}

export async function deleteVoiceModel(modelId: string): Promise<boolean> {
  const apiKey = getApiKey();
  
  console.log(`[FishAudio] Deleting voice model ${modelId}...`);
  
  try {
    await axios.delete(
      `${FISH_AUDIO_API_URL}/model/${modelId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );
    
    console.log(`[FishAudio] Voice model ${modelId} deleted successfully`);
    return true;
  } catch (error: any) {
    console.error('[FishAudio] Voice model deletion failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    
    if (error.response?.status === 404) {
      console.log(`[FishAudio] Voice model ${modelId} not found - may already be deleted`);
      return true;
    }
    
    throw new Error(error.response?.data?.detail || error.message || 'Voice model deletion failed');
  }
}

export function base64ToBuffer(base64DataUrl: string): { buffer: Buffer; mimeType: string; filename: string } {
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 data URL format');
  }
  
  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  const ext = mimeType.split('/')[1]?.replace('mpeg', 'mp3').replace('webm', 'webm').replace('wav', 'wav') || 'mp3';
  const filename = `audio_${Date.now()}.${ext}`;
  
  return { buffer, mimeType, filename };
}

export async function processAudioFilesForCloning(audioFiles: string[]): Promise<Array<{ buffer: Buffer; filename: string; mimeType: string }>> {
  if (!audioFiles || audioFiles.length === 0) {
    throw new Error('At least one audio file is required for voice cloning');
  }
  
  const results: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];
  
  for (let i = 0; i < audioFiles.length; i++) {
    const audioFile = audioFiles[i];
    
    if (audioFile.startsWith('data:')) {
      const { buffer, mimeType, filename } = base64ToBuffer(audioFile);
      results.push({ buffer, mimeType, filename });
    } else {
      throw new Error(`Invalid audio file format at index ${i}. Only base64 data URLs are accepted.`);
    }
  }
  
  if (results.length === 0) {
    throw new Error('No valid audio files could be processed');
  }
  
  return results;
}

export type { FishAudioVoice, ListVoicesResponse, CreateModelResponse };
