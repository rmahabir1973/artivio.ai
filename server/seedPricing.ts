import { db } from "./db";
import { pricing } from "@shared/schema";

const INITIAL_PRICING = [
  // Video Models
  { feature: 'video', model: 'veo-3', creditCost: 450, category: 'generation', description: 'Google Veo 3 video generation' },
  { feature: 'video', model: 'veo-3.1', creditCost: 500, category: 'generation', description: 'Google Veo 3.1 video generation' },
  { feature: 'video', model: 'veo-3.1-fast', creditCost: 300, category: 'generation', description: 'Google Veo 3.1 Fast video generation' },
  { feature: 'video', model: 'runway-gen3-alpha-turbo', creditCost: 350, category: 'generation', description: 'Runway Gen3 Alpha Turbo' },
  { feature: 'video', model: 'runway-aleph', creditCost: 400, category: 'generation', description: 'Runway Aleph video generation' },
  { feature: 'video', model: 'sora-2', creditCost: 300, category: 'generation', description: 'Sora 2 Pro text-to-video' },
  { feature: 'video', model: 'sora-2-image-to-video', creditCost: 300, category: 'generation', description: 'Sora 2 Pro image-to-video' },
  { feature: 'video', model: 'sora-2-pro-storyboard', creditCost: 500, category: 'generation', description: 'Sora 2 Pro multi-scene storyboard' },
  { feature: 'video', model: 'seedance-1-pro', creditCost: 500, category: 'generation', description: 'Seedance 1.0 Pro - 1080p cinematic' },
  { feature: 'video', model: 'seedance-1-lite', creditCost: 120, category: 'generation', description: 'Seedance 1.0 Lite - 720p fast' },
  { feature: 'video', model: 'wan-2.5', creditCost: 250, category: 'generation', description: 'Wan 2.5 - Audio sync & lip-sync' },
  { feature: 'video', model: 'kling-2.5-turbo', creditCost: 150, category: 'generation', description: 'Kling 2.5 Turbo - Fast generation' },
  { feature: 'video', model: 'kling-2.1', creditCost: 250, category: 'generation', description: 'Kling 2.1 - Professional quality' },
  
  // Video Enhancements (Video Combiner)
  { feature: 'video-enhancement', model: 'crossfade-transitions', creditCost: 25, category: 'editing', description: 'Crossfade transitions between clips' },
  { feature: 'video-enhancement', model: 'background-music', creditCost: 25, category: 'editing', description: 'Add background music with fade' },
  { feature: 'video-enhancement', model: 'text-overlay', creditCost: 25, category: 'editing', description: 'Text overlay per instance' },
  { feature: 'video-enhancement', model: 'speed-control', creditCost: 25, category: 'editing', description: 'Custom speed control per clip' },
  
  // Image Models
  { feature: 'image', model: '4o-image', creditCost: 100, category: 'generation', description: 'GPT-4o image generation' },
  { feature: 'image', model: 'flux-kontext', creditCost: 150, category: 'generation', description: 'Flux Kontext image generation' },
  { feature: 'image', model: 'nano-banana', creditCost: 50, category: 'generation', description: 'Nano Banana image generation' },
  { feature: 'image', model: 'seedream-4', creditCost: 25, category: 'generation', description: 'Seedream 4.0 - Up to 4K resolution' },
  { feature: 'image', model: 'midjourney-v7', creditCost: 60, category: 'generation', description: 'Midjourney v7 - Latest with style controls' },
  
  // Music Models
  { feature: 'music', model: 'suno-v3.5', creditCost: 200, category: 'generation', description: 'Suno V3.5 music generation' },
  { feature: 'music', model: 'suno-v4', creditCost: 250, category: 'generation', description: 'Suno V4 music generation' },
  { feature: 'music', model: 'suno-v4.5', creditCost: 300, category: 'generation', description: 'Suno V4.5 music generation' },
  
  // Chat Models
  { feature: 'chat', model: 'deepseek-chat', creditCost: 5, category: 'chat', description: 'Deepseek Chat' },
  { feature: 'chat', model: 'deepseek-reasoner', creditCost: 10, category: 'chat', description: 'Deepseek Reasoner' },
  { feature: 'chat', model: 'gpt-4o', creditCost: 20, category: 'chat', description: 'GPT-4o' },
  { feature: 'chat', model: 'gpt-4o-mini', creditCost: 10, category: 'chat', description: 'GPT-4o Mini' },
  { feature: 'chat', model: 'o1', creditCost: 30, category: 'chat', description: 'OpenAI o1' },
  { feature: 'chat', model: 'o1-mini', creditCost: 15, category: 'chat', description: 'OpenAI o1 Mini' },
  
  // TTS Models
  { feature: 'tts', model: 'eleven_multilingual_v2', creditCost: 20, category: 'voice', description: 'ElevenLabs Multilingual V2' },
  { feature: 'tts', model: 'eleven_turbo_v2.5', creditCost: 15, category: 'voice', description: 'ElevenLabs Turbo V2.5' },
  
  // STT Models
  { feature: 'stt', model: 'scribe-v1', creditCost: 25, category: 'voice', description: 'ElevenLabs Scribe V1' },
  
  // Voice Cloning
  { feature: 'voice-cloning', model: 'elevenlabs-clone', creditCost: 100, category: 'voice', description: 'ElevenLabs Voice Cloning' },
  
  // Avatar Models
  { feature: 'avatar', model: 'kling-ai', creditCost: 350, category: 'generation', description: 'Kling AI Talking Avatar' },
  { feature: 'avatar', model: 'infinite-talk', creditCost: 300, category: 'generation', description: 'Infinite Talk Avatar' },
  
  // Audio Converter
  { feature: 'audio-converter', model: 'wav-conversion', creditCost: 15, category: 'audio', description: 'WAV Audio Conversion' },
  { feature: 'audio-converter', model: 'vocal-removal', creditCost: 25, category: 'audio', description: 'Vocal Removal' },
  { feature: 'audio-converter', model: 'stem-separation', creditCost: 30, category: 'audio', description: 'Stem Separation' },
  
  // Topaz AI Upscaling
  { feature: 'upscaling', model: 'topaz-image-2x', creditCost: 10, category: 'enhancement', description: 'Topaz Image Upscale 2x (up to 2K)' },
  { feature: 'upscaling', model: 'topaz-image-4x', creditCost: 20, category: 'enhancement', description: 'Topaz Image Upscale 4x (4K resolution)' },
  { feature: 'upscaling', model: 'topaz-image-8x', creditCost: 40, category: 'enhancement', description: 'Topaz Image Upscale 8x (8K resolution)' },
  { feature: 'upscaling', model: 'topaz-video-2x', creditCost: 80, category: 'enhancement', description: 'Topaz Video Upscale 2x (HD enhancement)' },
  { feature: 'upscaling', model: 'topaz-video-4x', creditCost: 150, category: 'enhancement', description: 'Topaz Video Upscale 4x (4K enhancement)' },
];

async function seedPricing() {
  console.log('🌱 Seeding pricing data...');
  
  try {
    // Check if pricing data already exists
    const existingCount = await db.$count(pricing);
    
    if (existingCount > 0) {
      console.log(`⚠️  Pricing table already has ${existingCount} entries. Skipping seed.`);
      return;
    }
    
    // Insert all pricing data
    await db.insert(pricing).values(INITIAL_PRICING);
    
    console.log(`✅ Successfully seeded ${INITIAL_PRICING.length} pricing entries`);
  } catch (error) {
    console.error('❌ Error seeding pricing:', error);
    throw error;
  }
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPricing()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedPricing };
