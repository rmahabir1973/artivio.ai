import crypto from 'crypto';
import { db } from "../db";
import { generations, socialPosts, users, pricing } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { generateImage, generateVideo } from "../kieai";
import { storage } from "../storage";

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://artivio.ai';

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'production' || process.env.REPL_SLUG) {
    return PRODUCTION_URL;
  }
  const replitDev = process.env.REPLIT_DEV_DOMAIN;
  if (replitDev) {
    return `https://${replitDev}`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

function generateCallbackUrl(generationId: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/callback/kie/${generationId}`;
}

interface MediaJob {
  socialPostId: string;
  userId: string;
  mediaType: 'image' | 'video';
  prompt: string;
  model: string;
  creditsCost: number;
  aspectRatio?: string;
}

export async function getModelCostFromPricing(model: string): Promise<number> {
  const [priceRow] = await db
    .select()
    .from(pricing)
    .where(eq(pricing.model, model))
    .limit(1);
  
  if (priceRow) {
    return priceRow.creditCost;
  }
  
  console.warn(`[Social Gen] No pricing found for model ${model}, using default cost 10`);
  return 10;
}

export async function calculateTotalCost(jobs: MediaJob[]): Promise<number> {
  let total = 0;
  for (const job of jobs) {
    total += job.creditsCost;
  }
  return total;
}

export async function checkUserCredits(userId: string, requiredCredits: number): Promise<{ hasEnough: boolean; currentCredits: number }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { hasEnough: false, currentCredits: 0 };
  }
  return {
    hasEnough: user.credits >= requiredCredits,
    currentCredits: user.credits,
  };
}

export async function deductCreditsAtomic(userId: string, amount: number): Promise<boolean> {
  try {
    const user = await storage.getUser(userId);
    if (!user || user.credits < amount) {
      return false;
    }
    await storage.updateUserCredits(userId, user.credits - amount);
    console.log(`[Social Gen] Deducted ${amount} credits from user ${userId}`);
    return true;
  } catch (error) {
    console.error(`[Social Gen] Failed to deduct credits:`, error);
    return false;
  }
}

export async function refundCredits(userId: string, amount: number): Promise<void> {
  try {
    await storage.addCreditsAtomic(userId, amount);
    console.log(`[Social Gen] Refunded ${amount} credits to user ${userId}`);
  } catch (error) {
    console.error(`[Social Gen] Failed to refund credits:`, error);
  }
}

export async function createMediaGenerationJob(job: MediaJob): Promise<string | null> {
  try {
    const generationId = crypto.randomUUID();
    const callbackUrl = generateCallbackUrl(generationId);
    
    const [generation] = await db
      .insert(generations)
      .values({
        id: generationId,
        userId: job.userId,
        type: job.mediaType,
        generationType: 'text-to-' + job.mediaType,
        model: job.model,
        prompt: job.prompt,
        status: 'pending',
        creditsCost: job.creditsCost,
        socialPostId: job.socialPostId,
        creditsHeld: job.creditsCost,
        attempts: 0,
        source: 'social_auto',
        parameters: {
          aspectRatio: job.aspectRatio || '16:9',
          callBackUrl: callbackUrl,
        },
      })
      .returning();
    
    console.log(`[Social Gen] Created generation job ${generationId} for social post ${job.socialPostId}`);
    return generationId;
  } catch (error) {
    console.error(`[Social Gen] Failed to create generation job:`, error);
    return null;
  }
}

export async function dispatchGenerationJob(generationId: string): Promise<boolean> {
  try {
    const [generation] = await db
      .select()
      .from(generations)
      .where(eq(generations.id, generationId))
      .limit(1);
    
    if (!generation) {
      console.error(`[Social Gen] Generation ${generationId} not found`);
      return false;
    }
    
    if (generation.status !== 'pending') {
      console.warn(`[Social Gen] Generation ${generationId} is not pending (status: ${generation.status})`);
      return false;
    }
    
    await db
      .update(generations)
      .set({ 
        status: 'processing',
        attempts: (generation.attempts || 0) + 1,
      })
      .where(eq(generations.id, generationId));
    
    const params = generation.parameters as any || {};
    const callbackUrl = params.callBackUrl || generateCallbackUrl(generationId);
    
    if (generation.type === 'image') {
      console.log(`[Social Gen] Dispatching image generation ${generationId} with model ${generation.model}`);
      
      await generateImage({
        model: generation.model,
        prompt: generation.prompt,
        parameters: {
          aspectRatio: params.aspectRatio || '16:9',
          callBackUrl: callbackUrl,
        },
      });
      
      console.log(`[Social Gen] Image generation ${generationId} dispatched successfully`);
    } else if (generation.type === 'video') {
      console.log(`[Social Gen] Dispatching video generation ${generationId} with model ${generation.model}`);
      
      await generateVideo({
        model: generation.model,
        prompt: generation.prompt,
        parameters: {
          aspectRatio: params.aspectRatio || '16:9',
          callBackUrl: callbackUrl,
          duration: params.duration || 5,
        },
      });
      
      console.log(`[Social Gen] Video generation ${generationId} dispatched successfully`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`[Social Gen] Failed to dispatch generation ${generationId}:`, error);
    
    await db
      .update(generations)
      .set({ 
        status: 'failed',
        errorMessage: error.message || 'Failed to dispatch generation',
      })
      .where(eq(generations.id, generationId));
    
    const [generation] = await db
      .select()
      .from(generations)
      .where(eq(generations.id, generationId))
      .limit(1);
    
    if (generation?.creditsHeld && generation.userId) {
      await refundCredits(generation.userId, generation.creditsHeld);
    }
    
    if (generation?.socialPostId) {
      await updateSocialPostMediaStatus(generation.socialPostId, 'failed', error.message);
    }
    
    return false;
  }
}

export async function updateSocialPostMediaStatus(
  socialPostId: string, 
  status: 'generating' | 'completed' | 'failed' | 'partial',
  errorMessage?: string
): Promise<void> {
  try {
    const updateData: any = {
      mediaGenerationStatus: status,
      updatedAt: new Date(),
    };
    
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }
    
    await db
      .update(socialPosts)
      .set(updateData)
      .where(eq(socialPosts.id, socialPostId));
    
    console.log(`[Social Gen] Updated social post ${socialPostId} media status to ${status}`);
  } catch (error) {
    console.error(`[Social Gen] Failed to update social post media status:`, error);
  }
}

export async function handleGenerationComplete(
  generationId: string, 
  resultUrl: string,
  resultUrls?: string[]
): Promise<void> {
  try {
    const [generation] = await db
      .select()
      .from(generations)
      .where(eq(generations.id, generationId))
      .limit(1);
    
    if (!generation?.socialPostId) {
      return;
    }
    
    console.log(`[Social Gen] Generation ${generationId} completed for social post ${generation.socialPostId}`);
    
    const [post] = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.id, generation.socialPostId))
      .limit(1);
    
    if (!post) {
      console.warn(`[Social Gen] Social post ${generation.socialPostId} not found`);
      return;
    }
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (generation.type === 'image') {
      updateData.mediaUrl = resultUrl;
      updateData.mediaType = 'image/jpeg';
      
      if (resultUrls && resultUrls.length > 1) {
        const mediaItems = resultUrls.map((url, index) => ({
          type: 'image' as const,
          url,
          thumbnailUrl: url,
        }));
        updateData.mediaItems = mediaItems;
      }
    } else if (generation.type === 'video') {
      updateData.mediaUrl = resultUrl;
      updateData.mediaType = 'video/mp4';
    }
    
    const allGenerationsForPost = await db
      .select()
      .from(generations)
      .where(eq(generations.socialPostId, generation.socialPostId));
    
    const pendingCount = allGenerationsForPost.filter(g => 
      g.id !== generationId && (g.status === 'pending' || g.status === 'processing')
    ).length;
    
    const failedCount = allGenerationsForPost.filter(g => 
      g.status === 'failed'
    ).length;
    
    if (pendingCount === 0) {
      if (failedCount > 0) {
        updateData.mediaGenerationStatus = 'partial';
      } else {
        updateData.mediaGenerationStatus = 'completed';
      }
    } else {
      updateData.mediaGenerationStatus = 'generating';
    }
    
    await db
      .update(socialPosts)
      .set(updateData)
      .where(eq(socialPosts.id, generation.socialPostId));
    
    console.log(`[Social Gen] Updated social post ${generation.socialPostId} with media URL and status ${updateData.mediaGenerationStatus}`);
  } catch (error) {
    console.error(`[Social Gen] Failed to handle generation complete:`, error);
  }
}

export async function handleGenerationFailed(generationId: string, errorMessage: string): Promise<void> {
  try {
    const [generation] = await db
      .select()
      .from(generations)
      .where(eq(generations.id, generationId))
      .limit(1);
    
    if (!generation?.socialPostId) {
      return;
    }
    
    console.log(`[Social Gen] Generation ${generationId} failed for social post ${generation.socialPostId}: ${errorMessage}`);
    
    if (generation.creditsHeld && generation.userId) {
      await refundCredits(generation.userId, generation.creditsHeld);
    }
    
    const allGenerationsForPost = await db
      .select()
      .from(generations)
      .where(eq(generations.socialPostId, generation.socialPostId));
    
    const pendingCount = allGenerationsForPost.filter(g => 
      g.id !== generationId && (g.status === 'pending' || g.status === 'processing')
    ).length;
    
    const completedCount = allGenerationsForPost.filter(g => 
      g.status === 'completed'
    ).length;
    
    let newStatus: string;
    if (pendingCount === 0) {
      if (completedCount > 0) {
        newStatus = 'partial';
      } else {
        newStatus = 'failed';
      }
    } else {
      newStatus = 'generating';
    }
    
    await db
      .update(socialPosts)
      .set({
        mediaGenerationStatus: newStatus,
        errorMessage: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(socialPosts.id, generation.socialPostId));
    
    console.log(`[Social Gen] Updated social post ${generation.socialPostId} status to ${newStatus}`);
  } catch (error) {
    console.error(`[Social Gen] Failed to handle generation failed:`, error);
  }
}

export async function enqueueMediaGenerations(
  socialPostId: string,
  userId: string,
  automationLevel: 'semi_auto' | 'full_auto',
  imagePrompt: string | null,
  videoPrompt: string | null,
  preferredImageModel: string = 'flux-kontext',
  preferredVideoModel: string = 'wan-2.5',
  aspectRatio: string = '16:9'
): Promise<{ success: boolean; error?: string; totalCredits?: number; jobCount?: number }> {
  try {
    const jobs: MediaJob[] = [];
    
    if (imagePrompt && (automationLevel === 'semi_auto' || automationLevel === 'full_auto')) {
      const imageCost = await getModelCostFromPricing(preferredImageModel);
      jobs.push({
        socialPostId,
        userId,
        mediaType: 'image',
        prompt: imagePrompt,
        model: preferredImageModel,
        creditsCost: imageCost,
        aspectRatio,
      });
    }
    
    if (videoPrompt && automationLevel === 'full_auto') {
      const videoCost = await getModelCostFromPricing(preferredVideoModel);
      jobs.push({
        socialPostId,
        userId,
        mediaType: 'video',
        prompt: videoPrompt,
        model: preferredVideoModel,
        creditsCost: videoCost,
        aspectRatio,
      });
    }
    
    if (jobs.length === 0) {
      console.log(`[Social Gen] No jobs to enqueue for post ${socialPostId}`);
      return { success: true, totalCredits: 0, jobCount: 0 };
    }
    
    const totalCredits = await calculateTotalCost(jobs);
    
    const creditCheck = await checkUserCredits(userId, totalCredits);
    if (!creditCheck.hasEnough) {
      console.warn(`[Social Gen] User ${userId} has insufficient credits (${creditCheck.currentCredits} < ${totalCredits})`);
      
      await updateSocialPostMediaStatus(socialPostId, 'failed', `Insufficient credits. Required: ${totalCredits}, Available: ${creditCheck.currentCredits}`);
      
      return { 
        success: false, 
        error: `Insufficient credits. Required: ${totalCredits}, Available: ${creditCheck.currentCredits}` 
      };
    }
    
    const deducted = await deductCreditsAtomic(userId, totalCredits);
    if (!deducted) {
      console.error(`[Social Gen] Failed to deduct credits for user ${userId}`);
      await updateSocialPostMediaStatus(socialPostId, 'failed', 'Failed to reserve credits');
      return { success: false, error: 'Failed to reserve credits' };
    }
    
    await updateSocialPostMediaStatus(socialPostId, 'generating');
    
    // Track successful job creations and their credit costs
    const generationIds: string[] = [];
    let creditsUsed = 0;
    
    for (const job of jobs) {
      try {
        const genId = await createMediaGenerationJob(job);
        if (genId) {
          generationIds.push(genId);
          creditsUsed += job.creditsCost;
        } else {
          console.warn(`[Social Gen] Failed to create job for ${job.mediaType}, will refund credits`);
        }
      } catch (jobError) {
        console.error(`[Social Gen] Error creating job for ${job.mediaType}:`, jobError);
      }
    }
    
    // If no jobs were created, refund all credits
    if (generationIds.length === 0) {
      await refundCredits(userId, totalCredits);
      await updateSocialPostMediaStatus(socialPostId, 'failed', 'Failed to create generation jobs');
      return { success: false, error: 'Failed to create generation jobs' };
    }
    
    // If some jobs failed, refund the unused credits
    const unusedCredits = totalCredits - creditsUsed;
    if (unusedCredits > 0) {
      await refundCredits(userId, unusedCredits);
      console.log(`[Social Gen] Refunded ${unusedCredits} unused credits to user ${userId}`);
    }
    
    // Dispatch jobs asynchronously
    for (const genId of generationIds) {
      dispatchGenerationJob(genId).catch(err => {
        console.error(`[Social Gen] Error dispatching job ${genId}:`, err);
      });
    }
    
    console.log(`[Social Gen] Enqueued ${generationIds.length} generation jobs for post ${socialPostId}, credits used: ${creditsUsed}`);
    
    return { success: true, totalCredits: creditsUsed, jobCount: generationIds.length };
  } catch (error: any) {
    console.error(`[Social Gen] Error enqueueing media generations:`, error);
    await updateSocialPostMediaStatus(socialPostId, 'failed', error.message);
    return { success: false, error: error.message };
  }
}
