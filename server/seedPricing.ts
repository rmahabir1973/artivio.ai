import { db } from "./db";
import { pricing } from "@shared/schema";

const COMPREHENSIVE_PRICING = [
  // ========================================
  // VIDEO GENERATION MODELS
  // ========================================
  // Kie.ai confirmed costs (as of Nov 2025): Veo 3.1 Quality=250, Veo 3.1 Fast=60
  { feature: 'video', model: 'veo-3.1', creditCost: 500, kieCreditCost: 250, category: 'generation', description: 'Google Veo 3.1 Quality - HD quality with synchronized audio (8s)' },
  { feature: 'video', model: 'veo-3.1-fast', creditCost: 300, kieCreditCost: 60, category: 'generation', description: 'Google Veo 3.1 Fast - Faster generation, great quality (8s)' },
  
  // Runway Gen-3 - Duration-based pricing (5s, 10s)
  { feature: 'video', model: 'runway-gen3-alpha-turbo-5s', creditCost: 60, kieCreditCost: 12, category: 'generation', description: 'Runway Gen-3 - HD quality video generation (5s)' },
  { feature: 'video', model: 'runway-gen3-alpha-turbo-10s', creditCost: 150, kieCreditCost: 30, category: 'generation', description: 'Runway Gen-3 - HD quality video generation (10s)' },
  
  // Seedance Pro - Duration and resolution-based pricing (5s, 10s × 480p, 720p, 1080p)
  { feature: 'video', model: 'seedance-1-pro-5s-480p', creditCost: 70, kieCreditCost: 14, category: 'generation', description: 'Seedance 1.0 Pro - 480p cinematic quality (5s)' },
  { feature: 'video', model: 'seedance-1-pro-5s-720p', creditCost: 150, kieCreditCost: 30, category: 'generation', description: 'Seedance 1.0 Pro - 720p cinematic quality (5s)' },
  { feature: 'video', model: 'seedance-1-pro-5s-1080p', creditCost: 350, kieCreditCost: 70, category: 'generation', description: 'Seedance 1.0 Pro - 1080p cinematic quality (5s)' },
  { feature: 'video', model: 'seedance-1-pro-10s-480p', creditCost: 140, kieCreditCost: 28, category: 'generation', description: 'Seedance 1.0 Pro - 480p cinematic quality (10s)' },
  { feature: 'video', model: 'seedance-1-pro-10s-720p', creditCost: 300, kieCreditCost: 60, category: 'generation', description: 'Seedance 1.0 Pro - 720p cinematic quality (10s)' },
  { feature: 'video', model: 'seedance-1-pro-10s-1080p', creditCost: 700, kieCreditCost: 140, category: 'generation', description: 'Seedance 1.0 Pro - 1080p cinematic quality (10s)' },
  
  // Seedance Lite - Resolution-based pricing (10s only)
  { feature: 'video', model: 'seedance-1-lite-480p', creditCost: 100, kieCreditCost: 20, category: 'generation', description: 'Seedance 1.0 Lite - 480p fast generation (10s)' },
  { feature: 'video', model: 'seedance-1-lite-720p', creditCost: 225, kieCreditCost: 45, category: 'generation', description: 'Seedance 1.0 Lite - 720p balanced quality (10s)' },
  { feature: 'video', model: 'seedance-1-lite-1080p', creditCost: 500, kieCreditCost: 100, category: 'generation', description: 'Seedance 1.0 Lite - 1080p high quality (10s)' },
  
  // Wan 2.5 - Duration and resolution-based pricing (5s, 10s × 720p, 1080p)
  { feature: 'video', model: 'wan-2.5-5s-720p', creditCost: 300, kieCreditCost: 60, category: 'generation', description: 'Wan 2.5 - 720p audio sync & lip-sync (5s)' },
  { feature: 'video', model: 'wan-2.5-5s-1080p', creditCost: 500, kieCreditCost: 100, category: 'generation', description: 'Wan 2.5 - 1080p audio sync & lip-sync (5s)' },
  { feature: 'video', model: 'wan-2.5-10s-720p', creditCost: 500, kieCreditCost: 100, category: 'generation', description: 'Wan 2.5 - 720p audio sync & lip-sync (10s)' },
  { feature: 'video', model: 'wan-2.5-10s-1080p', creditCost: 1000, kieCreditCost: 200, category: 'generation', description: 'Wan 2.5 - 1080p audio sync & lip-sync (10s)' },
  // Kling 2.5 Turbo - Generation type and duration-based pricing
  { feature: 'video', model: 'kling-2.5-turbo-t2v', creditCost: 210, kieCreditCost: 42, category: 'generation', description: 'Kling 2.5 Turbo - Text to Video (no duration variation)' },
  { feature: 'video', model: 'kling-2.5-turbo-i2v-5s', creditCost: 210, kieCreditCost: 42, category: 'generation', description: 'Kling 2.5 Turbo - Image to Video 5s' },
  { feature: 'video', model: 'kling-2.5-turbo-i2v-10s', creditCost: 420, kieCreditCost: 84, category: 'generation', description: 'Kling 2.5 Turbo - Image to Video 10s' },
  
  // ========================================
  // SORA VIDEO MODELS (Separate page)
  // ========================================
  // Sora 2 Pro Text-to-Video - Quality and duration-based pricing
  { feature: 'video', model: 'sora-2-10s-standard', creditCost: 150, kieCreditCost: 150, category: 'generation', description: 'Sora 2 Pro Text-to-Video - 10s Standard Quality' },
  { feature: 'video', model: 'sora-2-10s-high', creditCost: 330, kieCreditCost: 330, category: 'generation', description: 'Sora 2 Pro Text-to-Video - 10s High Quality' },
  { feature: 'video', model: 'sora-2-15s-standard', creditCost: 270, kieCreditCost: 270, category: 'generation', description: 'Sora 2 Pro Text-to-Video - 15s Standard Quality' },
  { feature: 'video', model: 'sora-2-15s-high', creditCost: 630, kieCreditCost: 630, category: 'generation', description: 'Sora 2 Pro Text-to-Video - 15s High Quality' },
  
  // Sora 2 Pro Image-to-Video - Quality and duration-based pricing
  { feature: 'video', model: 'sora-2-image-to-video-10s-standard', creditCost: 150, kieCreditCost: 150, category: 'generation', description: 'Sora 2 Pro Image-to-Video - 10s Standard Quality' },
  { feature: 'video', model: 'sora-2-image-to-video-10s-high', creditCost: 330, kieCreditCost: 330, category: 'generation', description: 'Sora 2 Pro Image-to-Video - 10s High Quality' },
  { feature: 'video', model: 'sora-2-image-to-video-15s-standard', creditCost: 270, kieCreditCost: 270, category: 'generation', description: 'Sora 2 Pro Image-to-Video - 15s Standard Quality' },
  { feature: 'video', model: 'sora-2-image-to-video-15s-high', creditCost: 630, kieCreditCost: 630, category: 'generation', description: 'Sora 2 Pro Image-to-Video - 15s High Quality' },
  
  // Sora 2 Pro Storyboard - Duration-based pricing (no quality variation)
  { feature: 'video', model: 'sora-2-pro-storyboard-10s', creditCost: 150, kieCreditCost: 150, category: 'generation', description: 'Sora 2 Pro Storyboard - 10s' },
  { feature: 'video', model: 'sora-2-pro-storyboard-15s', creditCost: 270, kieCreditCost: 270, category: 'generation', description: 'Sora 2 Pro Storyboard - 15s' },
  { feature: 'video', model: 'sora-2-pro-storyboard-25s', creditCost: 270, kieCreditCost: 270, category: 'generation', description: 'Sora 2 Pro Storyboard - 25s' },
  
  { feature: 'video', model: 'grok-imagine', creditCost: 200, kieCreditCost: null, category: 'generation', description: 'Grok Imagine - Image-to-video generation' },
  
  // ========================================
  // VIDEO EDITOR/COMBINER
  // ========================================
  // Server-side FFmpeg processing (no Kie.ai cost)
  { feature: 'video-editor', model: 'combine-videos', creditCost: 50, kieCreditCost: null, category: 'editing', description: 'Combine multiple videos (base cost)' },
  { feature: 'video-enhancement', model: 'crossfade-transitions', creditCost: 25, kieCreditCost: null, category: 'editing', description: 'Crossfade transitions between clips' },
  { feature: 'video-enhancement', model: 'background-music', creditCost: 25, kieCreditCost: null, category: 'editing', description: 'Add background music with fade controls' },
  { feature: 'video-enhancement', model: 'text-overlay', creditCost: 25, kieCreditCost: null, category: 'editing', description: 'Text overlay per instance' },
  { feature: 'video-enhancement', model: 'speed-control', creditCost: 25, kieCreditCost: null, category: 'editing', description: 'Custom speed control per clip' },
  
  // ========================================
  // IMAGE GENERATION MODELS
  // ========================================
  // Kie.ai confirmed costs: Nano Banana=4, Seedream 4.0=4 (rounded from 3.5), Midjourney=8 for 4 variants
  // 4o Image API - Output quantity-based pricing (1, 2, or 4 images)
  { feature: 'image', model: '4o-image-1', creditCost: 6, kieCreditCost: null, category: 'generation', description: '4o Image API - 1 image output' },
  { feature: 'image', model: '4o-image-2', creditCost: 7, kieCreditCost: null, category: 'generation', description: '4o Image API - 2 images output' },
  { feature: 'image', model: '4o-image-4', creditCost: 8, kieCreditCost: null, category: 'generation', description: '4o Image API - 4 images output' },
  { feature: 'image', model: 'flux-kontext-pro', creditCost: 5, kieCreditCost: 1, category: 'generation', description: 'Flux Kontext Pro - Standard model for balanced performance' },
  { feature: 'image', model: 'flux-kontext-max', creditCost: 10, kieCreditCost: 2, category: 'generation', description: 'Flux Kontext Max - Enhanced model for advanced capabilities' },
  { feature: 'image', model: 'nano-banana', creditCost: 50, kieCreditCost: 4, category: 'generation', description: 'Nano Banana - Fast, precise image generation and editing' },
  { feature: 'image', model: 'seedream-4', creditCost: 25, kieCreditCost: 4, category: 'generation', description: 'Seedream 4.0 - Up to 4K resolution with batch generation' },
  { feature: 'image', model: 'midjourney-v7', creditCost: 60, kieCreditCost: 8, category: 'generation', description: 'Midjourney v7 - Latest MJ with style controls (4 variants)' },
  
  // ========================================
  // IMAGE ANALYSIS
  // ========================================
  // OpenAI direct API (not through Kie.ai, so no kieCreditCost)
  { feature: 'image-analysis', model: 'gpt-4o', creditCost: 20, kieCreditCost: null, category: 'analysis', description: 'GPT-4o Vision - Comprehensive image analysis' },
  
  // ========================================
  // MUSIC GENERATION MODELS
  // ========================================
  // Kie.ai costs unknown - needs manual verification via Kie.ai playground or support
  { feature: 'music', model: 'suno-v3.5', creditCost: 200, kieCreditCost: null, category: 'generation', description: 'Suno V3.5 - High-quality music generation' },
  { feature: 'music', model: 'suno-v4', creditCost: 250, kieCreditCost: null, category: 'generation', description: 'Suno V4 - Enhanced vocals and richer sound' },
  { feature: 'music', model: 'suno-v4.5', creditCost: 300, kieCreditCost: null, category: 'generation', description: 'Suno V4.5 - Best quality, up to 8 minutes long' },
  { feature: 'music', model: 'suno-v4.5-plus', creditCost: 350, kieCreditCost: null, category: 'generation', description: 'Suno V4.5 Plus - Premium quality with advanced features' },
  { feature: 'music', model: 'suno-v5', creditCost: 400, kieCreditCost: null, category: 'generation', description: 'Suno V5 - Latest model with cutting-edge AI' },
  
  // ========================================
  // SOUND EFFECTS
  // ========================================
  // Kie.ai costs unknown - needs manual verification
  { feature: 'sound-effects', model: 'elevenlabs-sound-effect-v2', creditCost: 30, kieCreditCost: null, category: 'voice', description: 'ElevenLabs Sound Effect V2 - 1-22s duration' },
  
  // ========================================
  // TEXT-TO-SPEECH MODELS
  // ========================================
  // Kie.ai costs unknown - needs manual verification
  { feature: 'tts', model: 'eleven_multilingual_v2', creditCost: 20, kieCreditCost: null, category: 'voice', description: 'ElevenLabs Multilingual V2 - 20+ voices, multi-language' },
  { feature: 'tts', model: 'eleven_turbo_v2.5', creditCost: 15, kieCreditCost: null, category: 'voice', description: 'ElevenLabs Turbo V2.5 - Fast, natural speech' },
  
  // ========================================
  // SPEECH-TO-TEXT MODELS
  // ========================================
  // Kie.ai costs unknown - needs manual verification
  { feature: 'stt', model: 'scribe-v1', creditCost: 25, kieCreditCost: null, category: 'voice', description: 'ElevenLabs Scribe V1 - Accurate transcription' },
  
  // ========================================
  // VOICE CLONING
  // ========================================
  // Kie.ai costs unknown - needs manual verification
  { feature: 'voice-cloning', model: 'elevenlabs-clone', creditCost: 100, kieCreditCost: null, category: 'voice', description: 'ElevenLabs Voice Cloning - Custom voice creation' },
  
  // ========================================
  // TALKING AVATARS
  // ========================================
  // Kie.ai costs unknown - needs manual verification
  { feature: 'avatar', model: 'kling-ai', creditCost: 350, kieCreditCost: null, category: 'generation', description: 'Kling AI - Talking Avatar generation' },
  { feature: 'avatar', model: 'infinite-talk', creditCost: 300, kieCreditCost: null, category: 'generation', description: 'Infinite Talk - Avatar generation' },
  
  // ========================================
  // AI CHAT MODELS
  // ========================================
  // Direct API integrations (Deepseek, OpenAI) - not through Kie.ai, so no kieCreditCost
  { feature: 'chat', model: 'deepseek-chat', creditCost: 5, kieCreditCost: null, category: 'chat', description: 'Deepseek Chat - Fast, intelligent responses' },
  { feature: 'chat', model: 'deepseek-reasoner', creditCost: 10, kieCreditCost: null, category: 'chat', description: 'Deepseek Reasoner - Advanced reasoning capabilities' },
  { feature: 'chat', model: 'gpt-4o', creditCost: 20, kieCreditCost: null, category: 'chat', description: 'GPT-4o - OpenAI flagship model' },
  { feature: 'chat', model: 'gpt-4o-mini', creditCost: 10, kieCreditCost: null, category: 'chat', description: 'GPT-4o Mini - Fast, cost-effective' },
  { feature: 'chat', model: 'o1', creditCost: 30, kieCreditCost: null, category: 'chat', description: 'OpenAI o1 - Advanced reasoning model' },
  { feature: 'chat', model: 'o1-mini', creditCost: 15, kieCreditCost: null, category: 'chat', description: 'OpenAI o1 Mini - Efficient reasoning' },
  
  // ========================================
  // AUDIO CONVERTER
  // ========================================
  // Server-side FFmpeg processing (no Kie.ai cost)
  { feature: 'audio-converter', model: 'wav-conversion', creditCost: 15, kieCreditCost: null, category: 'audio', description: 'WAV Audio Conversion' },
  { feature: 'audio-converter', model: 'vocal-removal', creditCost: 25, kieCreditCost: null, category: 'audio', description: 'Vocal Removal - Isolate instrumentals' },
  { feature: 'audio-converter', model: 'stem-separation', creditCost: 30, kieCreditCost: null, category: 'audio', description: 'Stem Separation - Separate all audio tracks' },
  
  // ========================================
  // TOPAZ AI UPSCALING
  // ========================================
  // Image upscaling - individual factors
  { feature: 'upscaling', model: 'topaz-image-2x', creditCost: 10, kieCreditCost: null, category: 'enhancement', description: 'Topaz Image Upscale 2x (up to 2K resolution)' },
  { feature: 'upscaling', model: 'topaz-image-4x', creditCost: 20, kieCreditCost: null, category: 'enhancement', description: 'Topaz Image Upscale 4x (4K resolution)' },
  { feature: 'upscaling', model: 'topaz-image-8x', creditCost: 40, kieCreditCost: null, category: 'enhancement', description: 'Topaz Image Upscale 8x (8K resolution)' },
  // Video upscaling - flat 72 credits for all factors (1X, 2X, 4X) per Kie.ai
  { feature: 'upscaling', model: 'topaz-video-1x', creditCost: 72, kieCreditCost: 72, category: 'enhancement', description: 'Topaz Video Upscale 1x (no upscaling, format conversion)' },
  { feature: 'upscaling', model: 'topaz-video-2x', creditCost: 72, kieCreditCost: 72, category: 'enhancement', description: 'Topaz Video Upscale 2x (HD enhancement)' },
  { feature: 'upscaling', model: 'topaz-video-4x', creditCost: 72, kieCreditCost: 72, category: 'enhancement', description: 'Topaz Video Upscale 4x (4K enhancement)' },
  
  // ========================================
  // QR CODE GENERATOR
  // ========================================
  // Client-side generation (no server cost, no Kie.ai cost)
  { feature: 'qr-generator', model: 'client-side', creditCost: 0, kieCreditCost: null, category: 'utility', description: 'QR Code Generator - No credits required (client-side)' },
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
        .values({
          ...entry,
          // Convert kieCreditCost to string for numeric column (or keep null)
          kieCreditCost: entry.kieCreditCost !== null ? String(entry.kieCreditCost) : null,
        })
        .onConflictDoUpdate({
          target: [pricing.feature, pricing.model],
          set: {
            creditCost: entry.creditCost,
            kieCreditCost: entry.kieCreditCost !== null ? String(entry.kieCreditCost) : null,
            category: entry.category,
            description: entry.description,
            updatedAt: new Date(),
          }
        });
    }
    
    console.log(`✅ Pricing seed complete:`);
    console.log(`   📊 ${COMPREHENSIVE_PRICING.length} pricing entries upserted (inserted or updated)`);
    const withKieCosts = COMPREHENSIVE_PRICING.filter(p => p.kieCreditCost !== null).length;
    console.log(`   ✓ ${withKieCosts} entries have Kie.ai credit costs verified`);
    console.log(`   ⚠ ${COMPREHENSIVE_PRICING.length - withKieCosts} entries need manual Kie cost verification`);
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
