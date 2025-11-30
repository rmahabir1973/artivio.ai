import axios from 'axios';
import FormData from 'form-data';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

interface VoiceCloneResult {
  voice_id: string;
  name: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

interface GetVoicesResponse {
  voices: ElevenLabsVoice[];
}

function getApiKey(): string {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }
  return ELEVENLABS_API_KEY;
}

export async function cloneVoice(params: {
  name: string;
  description?: string;
  audioBuffers: Array<{ buffer: Buffer; filename: string; mimeType: string }>;
}): Promise<VoiceCloneResult> {
  const apiKey = getApiKey();
  
  const formData = new FormData();
  formData.append('name', params.name);
  
  if (params.description) {
    formData.append('description', params.description);
  }
  
  for (const audio of params.audioBuffers) {
    formData.append('files', audio.buffer, {
      filename: audio.filename,
      contentType: audio.mimeType,
    });
  }
  
  console.log(`[ElevenLabs] Cloning voice "${params.name}" with ${params.audioBuffers.length} audio files...`);
  
  try {
    const response = await axios.post<VoiceCloneResult>(
      `${ELEVENLABS_API_URL}/voices/add`,
      formData,
      {
        headers: {
          'xi-api-key': apiKey,
          ...formData.getHeaders(),
        },
        timeout: 120000,
      }
    );
    
    console.log(`[ElevenLabs] Voice cloned successfully: ${response.data.voice_id}`);
    return response.data;
  } catch (error: any) {
    console.error('[ElevenLabs] Voice cloning failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    
    const errorMessage = error.response?.data?.detail?.message 
      || error.response?.data?.detail 
      || error.response?.data?.error
      || error.message 
      || 'Voice cloning failed';
    
    throw new Error(errorMessage);
  }
}

export async function deleteVoice(voiceId: string): Promise<boolean> {
  const apiKey = getApiKey();
  
  console.log(`[ElevenLabs] Deleting voice ${voiceId}...`);
  
  try {
    await axios.delete(
      `${ELEVENLABS_API_URL}/voices/${voiceId}`,
      {
        headers: {
          'xi-api-key': apiKey,
        },
        timeout: 30000,
      }
    );
    
    console.log(`[ElevenLabs] Voice ${voiceId} deleted successfully`);
    return true;
  } catch (error: any) {
    console.error('[ElevenLabs] Voice deletion failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    
    if (error.response?.status === 404) {
      console.log(`[ElevenLabs] Voice ${voiceId} not found - may already be deleted`);
      return true;
    }
    
    throw new Error(error.response?.data?.detail || error.message || 'Voice deletion failed');
  }
}

export async function getVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = getApiKey();
  
  console.log('[ElevenLabs] Fetching voices...');
  
  try {
    const response = await axios.get<GetVoicesResponse>(
      `${ELEVENLABS_API_URL}/voices`,
      {
        headers: {
          'xi-api-key': apiKey,
        },
        timeout: 30000,
      }
    );
    
    console.log(`[ElevenLabs] Found ${response.data.voices.length} voices`);
    return response.data.voices;
  } catch (error: any) {
    console.error('[ElevenLabs] Failed to fetch voices:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    
    throw new Error(error.response?.data?.detail || error.message || 'Failed to fetch voices');
  }
}

export async function getVoice(voiceId: string): Promise<ElevenLabsVoice | null> {
  const apiKey = getApiKey();
  
  try {
    const response = await axios.get<ElevenLabsVoice>(
      `${ELEVENLABS_API_URL}/voices/${voiceId}`,
      {
        headers: {
          'xi-api-key': apiKey,
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

export async function downloadAudioFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  console.log(`[ElevenLabs] Downloading audio from: ${url.substring(0, 100)}...`);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: 50 * 1024 * 1024,
    });
    
    const mimeType = response.headers['content-type'] || 'audio/mpeg';
    const buffer = Buffer.from(response.data);
    
    console.log(`[ElevenLabs] Downloaded ${buffer.length} bytes, type: ${mimeType}`);
    return { buffer, mimeType };
  } catch (error: any) {
    console.error('[ElevenLabs] Failed to download audio:', error.message);
    throw new Error(`Failed to download audio file: ${error.message}`);
  }
}

export function base64ToBuffer(base64DataUrl: string): { buffer: Buffer; mimeType: string; filename: string } {
  const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 data URL format');
  }
  
  const fullMimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  const baseMimeType = fullMimeType.split(';')[0];
  const subtype = baseMimeType.split('/')[1] || 'mp3';
  const ext = subtype === 'mpeg' ? 'mp3' : subtype === 'webm' ? 'webm' : subtype === 'wav' ? 'wav' : subtype === 'ogg' ? 'ogg' : subtype === 'mp4' ? 'mp4' : 'mp3';
  const filename = `audio_${Date.now()}.${ext}`;
  
  return { buffer, mimeType: baseMimeType, filename };
}

export async function processAudioFilesForCloning(audioFiles: string[]): Promise<Array<{ buffer: Buffer; filename: string; mimeType: string }>> {
  // Validate at least one audio file is provided
  if (!audioFiles || audioFiles.length === 0) {
    throw new Error('At least one audio file is required for voice cloning');
  }
  
  const results: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];
  
  for (let i = 0; i < audioFiles.length; i++) {
    const audioFile = audioFiles[i];
    
    // Only accept base64 data URLs - reject external URLs for security (SSRF prevention)
    if (audioFile.startsWith('data:')) {
      const { buffer, mimeType, filename } = base64ToBuffer(audioFile);
      results.push({ buffer, mimeType, filename });
    } else {
      // Reject external URLs for security reasons
      throw new Error(`Invalid audio file format at index ${i}. Only base64 data URLs are accepted.`);
    }
  }
  
  if (results.length === 0) {
    throw new Error('No valid audio files could be processed');
  }
  
  return results;
}

export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}
