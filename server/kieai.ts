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

// Video Generation
export async function generateVideo(params: {
  model: string;
  prompt: string;
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  
  // Map frontend model names to Kie.ai API model names
  let kieModel = 'veo3';
  if (params.model.includes('fast')) {
    kieModel = 'veo3_fast';
  } else if (params.model.includes('runway')) {
    kieModel = 'runway';
  }
  
  return await callKieApi('/api/v1/veo/generate', {
    prompt: params.prompt,
    model: kieModel,
    aspectRatio: parameters.aspectRatio || '16:9',
    seeds: parameters.seeds,
    watermark: parameters.watermark,
  });
}

// Image Generation
export async function generateImage(params: {
  model: string;
  prompt: string;
  parameters: any;
}): Promise<{ result: any; keyName: string }> {
  const parameters = params.parameters || {};
  
  return await callKieApi('/api/v1/gpt4o-image/generate', {
    prompt: params.prompt,
    size: parameters.size || '1:1',
    nVariants: parameters.nVariants || 1,
    isEnhance: parameters.isEnhance || false,
  });
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
