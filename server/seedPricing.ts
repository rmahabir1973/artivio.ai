import { db } from "./db";
import { pricing } from "@shared/schema";

const COMPREHENSIVE_PRICING = [
  // ========================================
  // VIDEO GENERATION MODELS
  // ========================================
  { feature: 'video', model: 'veo-3.1', creditCost: 500, category: 'generation', description: 'Google Veo 3.1 - 1080p quality with synchronized audio (8s)' },
  { feature: 'video', model: 'veo-3.1-fast', creditCost: 300, category: 'generation', description: 'Google Veo 3.1 Fast - Faster generation, great quality (8s)' },
  { feature: 'video', model: 'veo-3', creditCost: 450, category: 'generation', description: 'Google Veo 3 - High-quality video generation (8s)' },
  { feature: 'video', model: 'runway-gen3-alpha-turbo', creditCost: 350, category: 'generation', description: 'Runway Gen-3 Alpha Turbo - Fast, high-quality (5s-10s)' },
  { feature: 'video', model: 'runway-aleph', creditCost: 400, category: 'generation', description: 'Runway Aleph - Advanced scene reasoning and camera control (5s-10s)' },
  { feature: 'video', model: 'seedance-1-pro', creditCost: 500, category: 'generation', description: 'Seedance 1.0 Pro - 1080p cinematic quality with camera control (10s)' },
  { feature: 'video', model: 'seedance-1-lite', creditCost: 120, category: 'generation', description: 'Seedance 1.0 Lite - 720p fast generation (10s)' },
  { feature: 'video', model: 'wan-2.5', creditCost: 250, category: 'generation', description: 'Wan 2.5 - Native audio sync & lip-sync support (10s)' },
  { feature: 'video', model: 'kling-2.5-turbo', creditCost: 150, category: 'generation', description: 'Kling 2.5 Turbo - Fast, fluid motion with realistic physics (5s-10s)' },
  { feature: 'video', model: 'kling-2.1', creditCost: 250, category: 'generation', description: 'Kling 2.1 - Professional hyper-realistic video generation (5s-10s)' },
  
  // ========================================
  // SORA VIDEO MODELS (Separate page)
  // ========================================
  { feature: 'video', model: 'sora-2', creditCost: 300, category: 'generation', description: 'Sora 2 Pro - Text-to-video generation' },
  { feature: 'video', model: 'sora-2-image-to-video', creditCost: 300, category: 'generation', description: 'Sora 2 Pro - Image-to-video generation' },
  { feature: 'video', model: 'sora-2-pro-storyboard', creditCost: 500, category: 'generation', description: 'Sora 2 Pro - Multi-scene storyboard generation' },
  { feature: 'video', model: 'grok-imagine', creditCost: 200, category: 'generation', description: 'Grok Imagine - Image-to-video generation' },
  
  // ========================================
  // VIDEO EDITOR/COMBINER
  // ========================================
  { feature: 'video-editor', model: 'combine-videos', creditCost: 50, category: 'editing', description: 'Combine multiple videos (base cost)' },
  { feature: 'video-enhancement', model: 'crossfade-transitions', creditCost: 25, category: 'editing', description: 'Crossfade transitions between clips' },
  { feature: 'video-enhancement', model: 'background-music', creditCost: 25, category: 'editing', description: 'Add background music with fade controls' },
  { feature: 'video-enhancement', model: 'text-overlay', creditCost: 25, category: 'editing', description: 'Text overlay per instance' },
  { feature: 'video-enhancement', model: 'speed-control', creditCost: 25, category: 'editing', description: 'Custom speed control per clip' },
  
  // ========================================
  // IMAGE GENERATION MODELS
  // ========================================
  { feature: 'image', model: '4o-image', creditCost: 100, category: 'generation', description: '4o Image API - High-fidelity visuals with accurate text rendering' },
  { feature: 'image', model: 'flux-kontext', creditCost: 150, category: 'generation', description: 'Flux Kontext - Vivid scenes with strong subject consistency' },
  { feature: 'image', model: 'nano-banana', creditCost: 50, category: 'generation', description: 'Nano Banana - Fast, precise image generation and editing' },
  { feature: 'image', model: 'seedream-4', creditCost: 25, category: 'generation', description: 'Seedream 4.0 - Up to 4K resolution with batch generation' },
  { feature: 'image', model: 'midjourney-v7', creditCost: 60, category: 'generation', description: 'Midjourney v7 - Latest MJ with style controls (4 variants)' },
  
  // ========================================
  // IMAGE ANALYSIS
  // ========================================
  { feature: 'image-analysis', model: 'gpt-4o', creditCost: 20, category: 'analysis', description: 'GPT-4o Vision - Comprehensive image analysis' },
  
  // ========================================
  // MUSIC GENERATION MODELS
  // ========================================
  { feature: 'music', model: 'suno-v3.5', creditCost: 200, category: 'generation', description: 'Suno V3.5 - High-quality music generation' },
  { feature: 'music', model: 'suno-v4', creditCost: 250, category: 'generation', description: 'Suno V4 - Enhanced vocals and richer sound' },
  { feature: 'music', model: 'suno-v4.5', creditCost: 300, category: 'generation', description: 'Suno V4.5 - Best quality, up to 8 minutes long' },
  { feature: 'music', model: 'suno-v4.5-plus', creditCost: 350, category: 'generation', description: 'Suno V4.5 Plus - Premium quality with advanced features' },
  { feature: 'music', model: 'suno-v5', creditCost: 400, category: 'generation', description: 'Suno V5 - Latest model with cutting-edge AI' },
  
  // ========================================
  // SOUND EFFECTS
  // ========================================
  { feature: 'sound-effects', model: 'elevenlabs-sound-effect-v2', creditCost: 30, category: 'voice', description: 'ElevenLabs Sound Effect V2 - 1-22s duration' },
  
  // ========================================
  // TEXT-TO-SPEECH MODELS
  // ========================================
  { feature: 'tts', model: 'eleven_multilingual_v2', creditCost: 20, category: 'voice', description: 'ElevenLabs Multilingual V2 - 20+ voices, multi-language' },
  { feature: 'tts', model: 'eleven_turbo_v2.5', creditCost: 15, category: 'voice', description: 'ElevenLabs Turbo V2.5 - Fast, natural speech' },
  
  // ========================================
  // SPEECH-TO-TEXT MODELS
  // ========================================
  { feature: 'stt', model: 'scribe-v1', creditCost: 25, category: 'voice', description: 'ElevenLabs Scribe V1 - Accurate transcription' },
  
  // ========================================
  // VOICE CLONING
  // ========================================
  { feature: 'voice-cloning', model: 'elevenlabs-clone', creditCost: 100, category: 'voice', description: 'ElevenLabs Voice Cloning - Custom voice creation' },
  
  // ========================================
  // TALKING AVATARS
  // ========================================
  { feature: 'avatar', model: 'kling-ai', creditCost: 350, category: 'generation', description: 'Kling AI - Talking Avatar generation' },
  { feature: 'avatar', model: 'infinite-talk', creditCost: 300, category: 'generation', description: 'Infinite Talk - Avatar generation' },
  
  // ========================================
  // AI CHAT MODELS
  // ========================================
  { feature: 'chat', model: 'deepseek-chat', creditCost: 5, category: 'chat', description: 'Deepseek Chat - Fast, intelligent responses' },
  { feature: 'chat', model: 'deepseek-reasoner', creditCost: 10, category: 'chat', description: 'Deepseek Reasoner - Advanced reasoning capabilities' },
  { feature: 'chat', model: 'gpt-4o', creditCost: 20, category: 'chat', description: 'GPT-4o - OpenAI flagship model' },
  { feature: 'chat', model: 'gpt-4o-mini', creditCost: 10, category: 'chat', description: 'GPT-4o Mini - Fast, cost-effective' },
  { feature: 'chat', model: 'o1', creditCost: 30, category: 'chat', description: 'OpenAI o1 - Advanced reasoning model' },
  { feature: 'chat', model: 'o1-mini', creditCost: 15, category: 'chat', description: 'OpenAI o1 Mini - Efficient reasoning' },
  
  // ========================================
  // AUDIO CONVERTER
  // ========================================
  { feature: 'audio-converter', model: 'wav-conversion', creditCost: 15, category: 'audio', description: 'WAV Audio Conversion' },
  { feature: 'audio-converter', model: 'vocal-removal', creditCost: 25, category: 'audio', description: 'Vocal Removal - Isolate instrumentals' },
  { feature: 'audio-converter', model: 'stem-separation', creditCost: 30, category: 'audio', description: 'Stem Separation - Separate all audio tracks' },
  
  // ========================================
  // TOPAZ AI UPSCALING
  // ========================================
  { feature: 'upscaling', model: 'topaz-image-2x', creditCost: 10, category: 'enhancement', description: 'Topaz Image Upscale 2x (up to 2K resolution)' },
  { feature: 'upscaling', model: 'topaz-image-4x', creditCost: 20, category: 'enhancement', description: 'Topaz Image Upscale 4x (4K resolution)' },
  { feature: 'upscaling', model: 'topaz-image-8x', creditCost: 40, category: 'enhancement', description: 'Topaz Image Upscale 8x (8K resolution)' },
  { feature: 'upscaling', model: 'topaz-video-2x', creditCost: 80, category: 'enhancement', description: 'Topaz Video Upscale 2x (HD enhancement)' },
  { feature: 'upscaling', model: 'topaz-video-4x', creditCost: 150, category: 'enhancement', description: 'Topaz Video Upscale 4x (4K enhancement)' },
  
  // ========================================
  // QR CODE GENERATOR
  // ========================================
  { feature: 'qr-generator', model: 'client-side', creditCost: 0, category: 'utility', description: 'QR Code Generator - No credits required (client-side)' },
];

/**
 * Seed pricing data with UPSERT logic using Drizzle's onConflictDoUpdate
 * This will update existing entries and insert new ones on every deployment
 * Uses the existing unique index on (feature, model) for conflict resolution
 */
async function seedPricing() {
  console.log('🌱 Seeding/updating pricing data...');
  
  try {
    // Use Drizzle's built-in upsert functionality
    // This leverages the existing unique index on (feature, model)
    for (const entry of COMPREHENSIVE_PRICING) {
      await db.insert(pricing)
        .values(entry)
        .onConflictDoUpdate({
          target: [pricing.feature, pricing.model],
          set: {
            creditCost: entry.creditCost,
            category: entry.category,
            description: entry.description,
            updatedAt: new Date(),
          }
        });
    }
    
    console.log(`✅ Pricing seed complete:`);
    console.log(`   📊 ${COMPREHENSIVE_PRICING.length} pricing entries upserted (inserted or updated)`);
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
