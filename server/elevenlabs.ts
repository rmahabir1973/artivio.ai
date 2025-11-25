import axios from 'axios';
import FormData from 'form-data';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

function getElevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY is not configured. Please add your ElevenLabs API key to enable voice cloning.');
  }
  return key;
}

export interface CloneVoiceParams {
  name: string;
  description?: string;
  audioFiles: string[]; // URLs to audio samples
}

export interface CloneVoiceResult {
  voiceId: string;
  name: string;
}

export async function cloneVoiceElevenLabs(params: CloneVoiceParams): Promise<CloneVoiceResult> {
  const apiKey = getElevenLabsApiKey();
  
  console.log(`📞 ElevenLabs Voice Clone: Creating voice "${params.name}" with ${params.audioFiles.length} audio samples`);
  
  const form = new FormData();
  form.append('name', params.name);
  if (params.description) {
    form.append('description', params.description);
  }
  
  // Download audio files and append to form
  for (let i = 0; i < params.audioFiles.length; i++) {
    const audioUrl = params.audioFiles[i];
    console.log(`📥 Downloading audio sample ${i + 1}: ${audioUrl}`);
    
    try {
      const response = await axios.get(audioUrl, { 
        responseType: 'arraybuffer',
        timeout: 60000 
      });
      
      // Detect content type
      const contentType = response.headers['content-type'] || 'audio/mpeg';
      const extension = contentType.includes('webm') ? 'webm' : 
                       contentType.includes('wav') ? 'wav' : 
                       contentType.includes('ogg') ? 'ogg' : 'mp3';
      
      form.append('files', Buffer.from(response.data), {
        filename: `sample_${i + 1}.${extension}`,
        contentType: contentType,
      });
    } catch (error: any) {
      console.error(`❌ Failed to download audio sample ${i + 1}:`, error.message);
      throw new Error(`Failed to download audio sample from ${audioUrl}: ${error.message}`);
    }
  }
  
  try {
    const response = await axios.post(
      `${ELEVENLABS_API_BASE}/voices/add`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'xi-api-key': apiKey,
        },
        timeout: 120000, // 2 minutes for upload + processing
      }
    );
    
    console.log(`✅ ElevenLabs Voice Clone successful:`, response.data);
    
    return {
      voiceId: response.data.voice_id,
      name: params.name,
    };
  } catch (error: any) {
    console.error(`❌ ElevenLabs Voice Clone Error:`, error.response?.data || error.message);
    
    const errorMessage = error.response?.data?.detail?.message || 
                        error.response?.data?.message || 
                        error.message || 
                        'Voice cloning failed';
    
    throw new Error(`Voice cloning failed: ${errorMessage}`);
  }
}

export async function deleteVoiceElevenLabs(voiceId: string): Promise<void> {
  const apiKey = getElevenLabsApiKey();
  
  try {
    await axios.delete(
      `${ELEVENLABS_API_BASE}/voices/${voiceId}`,
      {
        headers: {
          'xi-api-key': apiKey,
        },
        timeout: 30000,
      }
    );
    
    console.log(`✅ ElevenLabs Voice deleted: ${voiceId}`);
  } catch (error: any) {
    console.error(`❌ ElevenLabs Delete Voice Error:`, error.response?.data || error.message);
    throw new Error(`Failed to delete voice: ${error.message}`);
  }
}

export async function listVoicesElevenLabs(): Promise<any[]> {
  const apiKey = getElevenLabsApiKey();
  
  try {
    const response = await axios.get(
      `${ELEVENLABS_API_BASE}/voices`,
      {
        headers: {
          'xi-api-key': apiKey,
        },
        timeout: 30000,
      }
    );
    
    return response.data.voices || [];
  } catch (error: any) {
    console.error(`❌ ElevenLabs List Voices Error:`, error.response?.data || error.message);
    throw new Error(`Failed to list voices: ${error.message}`);
  }
}
