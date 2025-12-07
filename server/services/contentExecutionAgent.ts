import { db } from '../db';
import { aiContentPlans, socialProfiles, socialAccounts, socialBrandKits, socialPosts } from '@shared/schema';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { getLateService, type SocialPlatform, type CreatePostOptions } from '../getLate';

interface ExecutionResult {
  postId: string;
  postIndex: number;
  success: boolean;
  error?: string;
  getLatePostId?: string;
}

interface AgentStatus {
  isRunning: boolean;
  isExecuting: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  postsAttemptedThisRun: number;
  postsSucceededThisRun: number;
  postsFailedThisRun: number;
  postsSucceededTotal: number;
  postsFailedTotal: number;
  errors: string[];
}

const EXECUTION_INTERVAL_MS = 5 * 60 * 1000;
const PLATFORM_MAP: Record<string, SocialPlatform> = {
  instagram: 'instagram',
  facebook: 'facebook',
  linkedin: 'linkedin',
  youtube: 'youtube',
  tiktok: 'tiktok',
  twitter: 'twitter',
  x: 'twitter',
  threads: 'threads',
  pinterest: 'pinterest',
  bluesky: 'bluesky',
  reddit: 'reddit',
};

class ContentExecutionAgent {
  private intervalId: NodeJS.Timeout | null = null;
  private isExecuting = false;
  private lastRunAt: Date | null = null;
  private postsAttemptedThisRun = 0;
  private postsSucceededThisRun = 0;
  private postsFailedThisRun = 0;
  private postsSucceededTotal = 0;
  private postsFailedTotal = 0;
  private errors: string[] = [];

  getStatus(): AgentStatus {
    return {
      isRunning: this.intervalId !== null,
      isExecuting: this.isExecuting,
      lastRunAt: this.lastRunAt,
      nextRunAt: this.intervalId ? new Date(Date.now() + EXECUTION_INTERVAL_MS) : null,
      postsAttemptedThisRun: this.postsAttemptedThisRun,
      postsSucceededThisRun: this.postsSucceededThisRun,
      postsFailedThisRun: this.postsFailedThisRun,
      postsSucceededTotal: this.postsSucceededTotal,
      postsFailedTotal: this.postsFailedTotal,
      errors: this.errors.slice(-10),
    };
  }

  start(): void {
    if (this.intervalId) {
      console.log('[ContentExecutionAgent] Already running');
      return;
    }

    console.log('[ContentExecutionAgent] Starting agent...');
    this.intervalId = setInterval(() => this.execute(), EXECUTION_INTERVAL_MS);
    
    setTimeout(() => this.execute(), 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[ContentExecutionAgent] Agent stopped');
    }
  }

  async executeNow(): Promise<ExecutionResult[]> {
    return this.execute();
  }

  private async execute(): Promise<ExecutionResult[]> {
    if (this.isExecuting) {
      console.log('[ContentExecutionAgent] Already executing, skipping...');
      return [];
    }

    this.isExecuting = true;
    this.lastRunAt = new Date();
    this.postsAttemptedThisRun = 0;
    this.postsSucceededThisRun = 0;
    this.postsFailedThisRun = 0;
    const results: ExecutionResult[] = [];

    try {
      console.log('[ContentExecutionAgent] Starting execution cycle...');

      const activePlans = await db.query.aiContentPlans.findMany({
        where: inArray(aiContentPlans.status, ['approved', 'executing']),
      });

      console.log(`[ContentExecutionAgent] Found ${activePlans.length} active plans`);

      for (const plan of activePlans) {
        const planResults = await this.processPlan(plan);
        results.push(...planResults);
      }

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      this.postsAttemptedThisRun = results.length;
      this.postsSucceededThisRun = successCount;
      this.postsFailedThisRun = failedCount;
      this.postsSucceededTotal += successCount;
      this.postsFailedTotal += failedCount;
      console.log(`[ContentExecutionAgent] Execution complete. Attempted ${results.length} posts: ${successCount} succeeded, ${failedCount} failed.`);

    } catch (error: any) {
      console.error('[ContentExecutionAgent] Execution error:', error);
      this.errors.push(`${new Date().toISOString()}: ${error.message}`);
    } finally {
      this.isExecuting = false;
    }

    return results;
  }

  private async processPlan(plan: typeof aiContentPlans.$inferSelect): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const posts = (plan.plan as any)?.posts || [];
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    const brandKit = await db.query.socialBrandKits.findFirst({
      where: eq(socialBrandKits.id, plan.brandKitId),
    });

    if (!brandKit) {
      console.error(`[ContentExecutionAgent] Brand kit not found for plan ${plan.id}`);
      return results;
    }

    const profile = await db.query.socialProfiles.findFirst({
      where: eq(socialProfiles.id, brandKit.socialProfileId),
    });

    if (!profile) {
      console.error(`[ContentExecutionAgent] Social profile not found for brand kit ${brandKit.id}`);
      return results;
    }

    const accounts = await db.query.socialAccounts.findMany({
      where: eq(socialAccounts.socialProfileId, profile.id),
    });

    const accountsByPlatform = new Map<string, typeof accounts[0]>();
    for (const account of accounts) {
      const metadata = account.metadata as { getLateAccountId?: string } | null;
      if (account.platform && metadata?.getLateAccountId) {
        accountsByPlatform.set(account.platform.toLowerCase(), account);
      }
    }

    let postsUpdated = false;
    const updatedPosts = [...posts];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      
      if (post.status !== 'approved') {
        continue;
      }

      const postDate = post.date;
      const postTime = post.time || '09:00';

      if (postDate > currentDate) {
        continue;
      }
      if (postDate === currentDate && postTime > currentTime) {
        continue;
      }

      console.log(`[ContentExecutionAgent] Processing post ${i} scheduled for ${postDate} ${postTime}`);

      updatedPosts[i] = { ...post, status: 'scheduled' };
      postsUpdated = true;
      
      await db
        .update(aiContentPlans)
        .set({
          plan: { ...(plan.plan as any), posts: updatedPosts },
        })
        .where(eq(aiContentPlans.id, plan.id));

      let result: ExecutionResult | null = null;
      const maxRetries = 2;
      
      for (let retry = 0; retry <= maxRetries; retry++) {
        result = await this.publishPost(post, i, accountsByPlatform, profile.getLateProfileId, {
          promoTextEnabled: profile.promoTextEnabled,
          promoText: profile.promoText,
        });
        
        if (result.success) {
          break;
        }
        
        if (retry < maxRetries) {
          console.log(`[ContentExecutionAgent] Retry ${retry + 1}/${maxRetries} for post ${i}`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
        }
      }

      results.push(result!);

      if (result!.success) {
        const { failureCount, lastFailureReason, lastFailureAt, ...cleanPost } = post;
        updatedPosts[i] = { 
          ...cleanPost, 
          status: 'posted',
          postedAt: new Date().toISOString(),
          getLatePostId: result!.getLatePostId,
        };
      } else {
        const currentFailureCount = (post.failureCount || 0) + 1;
        const maxRetries = 3;
        
        if (currentFailureCount >= maxRetries) {
          updatedPosts[i] = { 
            ...post, 
            status: 'rejected',
            failureCount: currentFailureCount,
            lastFailureReason: result!.error,
            lastFailureAt: new Date().toISOString(),
          };
          this.errors.push(`${new Date().toISOString()}: Post ${i} permanently failed after ${maxRetries} attempts: ${result!.error}`);
        } else {
          updatedPosts[i] = { 
            ...post, 
            status: 'approved',
            failureCount: currentFailureCount,
            lastFailureReason: result!.error,
            lastFailureAt: new Date().toISOString(),
          };
          console.log(`[ContentExecutionAgent] Post ${i} failed (attempt ${currentFailureCount}/${maxRetries}), will retry next cycle`);
        }
      }
    }

    if (postsUpdated) {
      const executionProgress = plan.executionProgress as any || {};
      const postedCount = updatedPosts.filter(p => p.status === 'posted').length;
      const failedCount = updatedPosts.filter(p => p.status === 'rejected').length;
      const scheduledCount = updatedPosts.filter(p => p.status === 'scheduled').length;

      const allProcessed = updatedPosts.every(p => 
        p.status === 'posted' || p.status === 'rejected' || p.status === 'pending'
      );
      const approvedRemaining = updatedPosts.some(p => p.status === 'approved');

      await db
        .update(aiContentPlans)
        .set({
          plan: { ...(plan.plan as any), posts: updatedPosts },
          status: allProcessed && !approvedRemaining ? 'completed' : 'executing',
          executionProgress: {
            ...executionProgress,
            totalPosts: updatedPosts.length,
            postsScheduled: scheduledCount,
            postsPosted: postedCount,
            postsFailed: failedCount,
            lastUpdated: new Date().toISOString(),
          },
        })
        .where(eq(aiContentPlans.id, plan.id));
    }

    return results;
  }

  private async publishPost(
    post: any,
    index: number,
    accountsByPlatform: Map<string, any>,
    getLateProfileId: string | null,
    promoSettings?: { promoTextEnabled: boolean; promoText: string | null }
  ): Promise<ExecutionResult> {
    const postId = post.id || `post_${index}`;

    try {
      if (!getLateService.isConfigured()) {
        throw new Error('GetLate.dev API not configured');
      }

      const platforms: CreatePostOptions['platforms'] = [];

      for (const platformName of post.platforms || []) {
        const normalizedPlatform = platformName.toLowerCase();
        const account = accountsByPlatform.get(normalizedPlatform);
        
        if (!account) {
          console.warn(`[ContentExecutionAgent] No connected account for platform: ${platformName}`);
          continue;
        }

        const metadata = account.metadata as { getLateAccountId?: string } | null;
        if (!metadata?.getLateAccountId) {
          console.warn(`[ContentExecutionAgent] No GetLate account ID for platform: ${platformName}`);
          continue;
        }

        const getLatePlatform = PLATFORM_MAP[normalizedPlatform];
        if (!getLatePlatform) {
          console.warn(`[ContentExecutionAgent] Unknown platform: ${platformName}`);
          continue;
        }

        platforms.push({
          platform: getLatePlatform,
          accountId: metadata.getLateAccountId,
        });
      }

      if (platforms.length === 0) {
        throw new Error('No connected accounts for any of the target platforms');
      }

      let content = post.caption || '';
      if (post.hashtags && post.hashtags.length > 0) {
        content += '\n\n' + post.hashtags.map((h: string) => 
          h.startsWith('#') ? h : `#${h}`
        ).join(' ');
      }
      
      // Append promotional text if enabled
      if (promoSettings?.promoTextEnabled && promoSettings.promoText) {
        content += '\n\n' + promoSettings.promoText;
      }

      const createOptions: CreatePostOptions = {
        content,
        publishNow: true,
        platforms,
      };

      if (getLateProfileId) {
        createOptions.queuedFromProfile = getLateProfileId;
      }

      // Include media if available (from aiContentPlan post or linked socialPost)
      let mediaUrl = post.mediaUrl;
      let mediaType = post.mediaType || 'image';
      
      // If no direct mediaUrl but has socialPostId, look up from socialPosts table
      if (!mediaUrl && post.socialPostId) {
        try {
          const [linkedPost] = await db
            .select({ mediaUrl: socialPosts.mediaUrl, mediaType: socialPosts.mediaType })
            .from(socialPosts)
            .where(eq(socialPosts.id, post.socialPostId))
            .limit(1);
          
          if (linkedPost?.mediaUrl) {
            mediaUrl = linkedPost.mediaUrl;
            mediaType = linkedPost.mediaType || 'image';
            console.log(`[ContentExecutionAgent] Retrieved media from linked socialPost ${post.socialPostId}: ${mediaUrl}`);
          }
        } catch (err) {
          console.warn(`[ContentExecutionAgent] Failed to look up linked socialPost ${post.socialPostId}:`, err);
        }
      }
      
      if (mediaUrl) {
        createOptions.mediaItems = [{
          type: mediaType.includes('video') ? 'video' : 'image',
          url: mediaUrl,
        }];
        console.log(`[ContentExecutionAgent] Including media: ${mediaUrl}`);
      } else {
        console.log(`[ContentExecutionAgent] No media URL for post (socialPostId: ${post.socialPostId || 'none'})`);
      }

      console.log(`[ContentExecutionAgent] Publishing to ${platforms.length} platform(s)`);
      const getLatePost = await getLateService.createPost(createOptions);

      console.log(`[ContentExecutionAgent] Successfully published post ${postId} as GetLate post ${getLatePost._id}`);

      return {
        postId,
        postIndex: index,
        success: true,
        getLatePostId: getLatePost._id,
      };

    } catch (error: any) {
      console.error(`[ContentExecutionAgent] Failed to publish post ${postId}:`, error);
      return {
        postId,
        postIndex: index,
        success: false,
        error: error.message,
      };
    }
  }
}

export const contentExecutionAgent = new ContentExecutionAgent();

export async function startContentExecutionAgent(): Promise<void> {
  if (getLateService.isConfigured()) {
    contentExecutionAgent.start();
    console.log('[ContentExecutionAgent] Agent started successfully');
  } else {
    console.warn('[ContentExecutionAgent] GetLate.dev API not configured, agent not started');
  }
}

export async function stopContentExecutionAgent(): Promise<void> {
  contentExecutionAgent.stop();
}

export function getAgentStatus(): AgentStatus {
  return contentExecutionAgent.getStatus();
}

export async function triggerManualExecution(): Promise<ExecutionResult[]> {
  return contentExecutionAgent.executeNow();
}
