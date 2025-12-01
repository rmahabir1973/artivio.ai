import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "./db";
import { storage } from "./storage";
import { requireJWT } from "./jwtMiddleware";
import { uploadPostService, PLATFORM_DAILY_CAPS, type SocialPlatform, SOCIAL_POSTER_PRICE_ID } from "./uploadPost";
import {
  socialProfiles,
  socialAccounts,
  socialGoals,
  socialPosts,
  socialAnalytics,
  insertSocialGoalSchema,
  updateSocialGoalSchema,
  insertSocialPostSchema,
  updateSocialPostSchema,
} from "@shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

const ARTIVIO_LOGO_URL = "https://artivio.ai/logo.png";

// Middleware to check if user has Social Media Poster access
async function requireSocialPoster(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        message: 'Authentication required',
        requiresSubscription: true,
        priceId: SOCIAL_POSTER_PRICE_ID,
      });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has Social Poster access
    if (!user.hasSocialPoster) {
      return res.status(403).json({ 
        message: 'Social Media Poster subscription required',
        requiresSubscription: true,
        priceId: SOCIAL_POSTER_PRICE_ID,
        upgradeUrl: '/social/upgrade',
      });
    }

    next();
  } catch (error: any) {
    console.error('[Social] Subscription check failed:', error);
    res.status(500).json({ message: 'Failed to verify subscription' });
  }
}

export function registerSocialMediaRoutes(app: Express) {
  
  // =====================================================
  // SOCIAL POSTER SUBSCRIPTION STATUS
  // =====================================================

  // Check if user has Social Poster access (public endpoint for UI gating)
  app.get('/api/social/subscription-status', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        hasSocialPoster: user.hasSocialPoster || false,
        socialPosterSubscriptionId: user.socialPosterSubscriptionId || null,
        priceId: SOCIAL_POSTER_PRICE_ID,
      });
    } catch (error: any) {
      console.error('[Social] Error checking subscription status:', error);
      res.status(500).json({ message: 'Failed to check subscription status' });
    }
  });

  // =====================================================
  // SOCIAL PROFILE MANAGEMENT
  // =====================================================

  // Get current user's social profile
  app.get('/api/social/profile', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json({ profile: null, hasProfile: false });
      }

      // Get connected accounts
      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.socialProfileId, profile.id));

      // Get goals
      const [goals] = await db
        .select()
        .from(socialGoals)
        .where(eq(socialGoals.socialProfileId, profile.id))
        .limit(1);

      res.json({
        profile,
        accounts,
        goals,
        hasProfile: true,
      });
    } catch (error: any) {
      console.error('[Social] Error fetching profile:', error);
      res.status(500).json({ message: 'Failed to fetch social profile', error: error.message });
    }
  });

  // Create/initialize social profile for user
  app.post('/api/social/profile/init', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email || '';

      // Check if profile already exists
      const [existingProfile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (existingProfile) {
        return res.json({ profile: existingProfile, created: false });
      }

      // Generate unique username for Upload-Post
      const uploadPostUsername = `artivio_${userId.replace(/-/g, '').substring(0, 16)}`;

      // Create profile in Upload-Post
      if (uploadPostService.isConfigured()) {
        try {
          await uploadPostService.createUserProfile(uploadPostUsername);
          console.log(`[Social] Created Upload-Post profile: ${uploadPostUsername}`);
        } catch (error: any) {
          // Profile might already exist, which is fine
          if (!error.message?.includes('already exists') && !error.message?.includes('409')) {
            console.error('[Social] Failed to create Upload-Post profile:', error);
            throw error;
          }
        }
      }

      // Create profile in our database
      const [newProfile] = await db
        .insert(socialProfiles)
        .values({
          userId,
          uploadPostUsername,
          isActive: true,
        })
        .returning();

      res.json({ profile: newProfile, created: true });
    } catch (error: any) {
      console.error('[Social] Error creating profile:', error);
      res.status(500).json({ message: 'Failed to create social profile', error: error.message });
    }
  });

  // Get connect URL for linking social accounts
  app.post('/api/social/connect-url', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { platforms, redirectUrl } = req.body;

      // Get user's social profile
      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found. Please initialize first.' });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      // Generate JWT URL from Upload-Post
      const result = await uploadPostService.generateJwtUrl(profile.uploadPostUsername, {
        redirectUrl: redirectUrl || undefined,
        logoImage: ARTIVIO_LOGO_URL,
        connectTitle: 'Connect Your Social Media',
        connectDescription: 'Connect your social media accounts to start scheduling AI-powered posts with Artivio.',
        platforms: platforms as SocialPlatform[] || undefined,
        showCalendar: false,
      });

      res.json({
        accessUrl: result.access_url,
        duration: result.duration,
      });
    } catch (error: any) {
      console.error('[Social] Error generating connect URL:', error);
      res.status(500).json({ message: 'Failed to generate connect URL', error: error.message });
    }
  });

  // Sync connected accounts from Upload-Post
  app.post('/api/social/sync-accounts', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get user's social profile
      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      // Get profile details from Upload-Post
      const uploadPostProfile = await uploadPostService.getUserProfile(profile.uploadPostUsername);

      if (!uploadPostProfile.success || !uploadPostProfile.profile) {
        return res.status(404).json({ message: 'Upload-Post profile not found' });
      }

      const socialAccountsData = uploadPostProfile.profile.social_accounts || {};
      const syncedAccounts: any[] = [];

      // Process each platform
      for (const [platform, accountData] of Object.entries(socialAccountsData)) {
        const isConnected = accountData && typeof accountData === 'object' && Object.keys(accountData).length > 0;
        
        if (isConnected && typeof accountData === 'object') {
          const details = accountData as any;
          const dailyCap = PLATFORM_DAILY_CAPS[platform as SocialPlatform] || 25;

          // Upsert account
          const [account] = await db
            .insert(socialAccounts)
            .values({
              socialProfileId: profile.id,
              platform,
              platformUsername: details.username || null,
              platformDisplayName: details.display_name || null,
              platformImageUrl: details.social_images || null,
              isConnected: true,
              dailyCap,
              metadata: details,
            })
            .onConflictDoUpdate({
              target: [socialAccounts.socialProfileId, socialAccounts.platform],
              set: {
                platformUsername: details.username || null,
                platformDisplayName: details.display_name || null,
                platformImageUrl: details.social_images || null,
                isConnected: true,
                metadata: details,
                updatedAt: new Date(),
              },
            })
            .returning();

          syncedAccounts.push(account);
        }
      }

      // Update connected accounts count
      await db
        .update(socialProfiles)
        .set({
          connectedAccountsCount: syncedAccounts.length,
          lastSyncAt: new Date(),
        })
        .where(eq(socialProfiles.id, profile.id));

      res.json({
        synced: true,
        accounts: syncedAccounts,
        accountCount: syncedAccounts.length,
      });
    } catch (error: any) {
      console.error('[Social] Error syncing accounts:', error);
      res.status(500).json({ message: 'Failed to sync accounts', error: error.message });
    }
  });

  // Get connected accounts
  app.get('/api/social/accounts', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json([]);
      }

      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.socialProfileId, profile.id),
          eq(socialAccounts.isConnected, true)
        ));

      // Map to frontend expected format
      const mappedAccounts = accounts.map(acc => ({
        id: acc.id,
        platform: acc.platform,
        platformAccountId: acc.platformUsername || '',
        accountUsername: acc.platformUsername || acc.platformDisplayName || '',
        connected: acc.isConnected,
        postsToday: acc.postsToday || 0,
        dailyLimit: acc.dailyCap || 3,
      }));

      res.json(mappedAccounts);
    } catch (error: any) {
      console.error('[Social] Error fetching accounts:', error);
      res.status(500).json({ message: 'Failed to fetch accounts', error: error.message });
    }
  });

  // Connect a social account (generates auth URL)
  app.post('/api/social/accounts/connect', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { platform } = req.body;

      if (!platform) {
        return res.status(400).json({ message: 'Platform is required' });
      }

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found. Please initialize first.' });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      // Generate JWT URL for connecting this specific platform
      const result = await uploadPostService.generateJwtUrl(profile.uploadPostUsername, {
        logoImage: ARTIVIO_LOGO_URL,
        connectTitle: `Connect ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
        connectDescription: `Link your ${platform} account to start posting with Artivio.`,
        platforms: [platform as SocialPlatform],
        showCalendar: false,
      });

      res.json({
        authUrl: result.access_url,
        duration: result.duration,
      });
    } catch (error: any) {
      console.error('[Social] Error generating connect URL:', error);
      res.status(500).json({ message: 'Failed to generate connect URL', error: error.message });
    }
  });

  // Disconnect a social account
  app.delete('/api/social/accounts/:accountId', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { accountId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Verify account belongs to user's profile
      const [account] = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.id, parseInt(accountId)),
          eq(socialAccounts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // Mark as disconnected (we keep the record for history)
      await db
        .update(socialAccounts)
        .set({
          isConnected: false,
          updatedAt: new Date(),
        })
        .where(eq(socialAccounts.id, parseInt(accountId)));

      // Update connected count
      await db
        .update(socialProfiles)
        .set({
          connectedAccountsCount: Math.max(0, profile.connectedAccountsCount - 1),
        })
        .where(eq(socialProfiles.id, profile.id));

      res.json({ disconnected: true });
    } catch (error: any) {
      console.error('[Social] Error disconnecting account:', error);
      res.status(500).json({ message: 'Failed to disconnect account', error: error.message });
    }
  });

  // =====================================================
  // GOALS / AI STRATEGY
  // =====================================================

  // Get or create goals
  app.get('/api/social/goals', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json([]);
      }

      const goals = await db
        .select()
        .from(socialGoals)
        .where(eq(socialGoals.socialProfileId, profile.id))
        .orderBy(desc(socialGoals.createdAt));

      // Map to frontend expected format
      const mappedGoals = goals.map(goal => ({
        id: goal.id,
        goal: goal.primaryGoal,
        platforms: goal.preferredPlatforms || [],
        duration: '1week',
        businessDescription: goal.targetAudience || '',
        targetAudience: goal.targetAudience || '',
        aiGeneratedPlan: null,
        status: goal.isActive ? 'active' : 'paused',
        createdAt: goal.createdAt?.toISOString() || new Date().toISOString(),
      }));

      res.json(mappedGoals);
    } catch (error: any) {
      console.error('[Social] Error fetching goals:', error);
      res.status(500).json({ message: 'Failed to fetch goals', error: error.message });
    }
  });

  // Create or update goals
  app.post('/api/social/goals', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const goalData = {
        socialProfileId: profile.id,
        primaryGoal: req.body.primaryGoal,
        postingFrequency: req.body.postingFrequency || 'daily',
        brandTopics: req.body.brandTopics || [],
        targetAudience: req.body.targetAudience || null,
        brandVoice: req.body.brandVoice || 'professional',
        preferredPlatforms: req.body.preferredPlatforms || [],
        websiteUrl: req.body.websiteUrl || null,
        isActive: true,
      };

      // Check if goals exist
      const [existingGoals] = await db
        .select()
        .from(socialGoals)
        .where(eq(socialGoals.socialProfileId, profile.id))
        .limit(1);

      let goals;
      if (existingGoals) {
        [goals] = await db
          .update(socialGoals)
          .set({
            ...goalData,
            updatedAt: new Date(),
          })
          .where(eq(socialGoals.id, existingGoals.id))
          .returning();
      } else {
        [goals] = await db
          .insert(socialGoals)
          .values(goalData)
          .returning();
      }

      res.json({ goals, created: !existingGoals });
    } catch (error: any) {
      console.error('[Social] Error saving goals:', error);
      res.status(500).json({ message: 'Failed to save goals', error: error.message });
    }
  });

  // =====================================================
  // POSTS / SCHEDULING
  // =====================================================

  // Get all posts (with optional filters)
  app.get('/api/social/posts', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { status, startDate, endDate, limit = 50 } = req.query;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json([]);
      }

      let query = db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.socialProfileId, profile.id))
        .orderBy(desc(socialPosts.scheduledAt))
        .limit(Number(limit));

      const posts = await query;

      // Filter in memory for now (can optimize with proper query builder later)
      let filteredPosts = posts;
      if (status) {
        filteredPosts = filteredPosts.filter(p => p.status === status);
      }
      if (startDate) {
        const start = new Date(startDate as string);
        filteredPosts = filteredPosts.filter(p => p.scheduledAt && p.scheduledAt >= start);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        filteredPosts = filteredPosts.filter(p => p.scheduledAt && p.scheduledAt <= end);
      }

      // Map to frontend expected format
      const mappedPosts = filteredPosts.map(post => ({
        id: post.id,
        platform: (post.platforms as string[])?.[0] || 'unknown',
        caption: post.title || '',
        hashtags: post.hashtags || [],
        mediaType: post.mediaType || 'text',
        mediaUrl: post.mediaUrl || undefined,
        scheduledFor: post.scheduledAt?.toISOString() || new Date().toISOString(),
        status: post.status,
        aiGenerated: post.aiGenerated || false,
      }));

      res.json(mappedPosts);
    } catch (error: any) {
      console.error('[Social] Error fetching posts:', error);
      res.status(500).json({ message: 'Failed to fetch posts', error: error.message });
    }
  });

  // Create a new post
  app.post('/api/social/posts', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const postData = {
        socialProfileId: profile.id,
        postType: req.body.postType || 'text',
        platforms: req.body.platforms || [],
        title: req.body.title,
        description: req.body.description || null,
        platformTitles: req.body.platformTitles || null,
        mediaUrl: req.body.mediaUrl || null,
        mediaType: req.body.mediaType || null,
        thumbnailUrl: req.body.thumbnailUrl || null,
        hashtags: req.body.hashtags || [],
        firstComment: req.body.firstComment || null,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        status: req.body.scheduledAt ? 'scheduled' : 'draft',
        aiGenerated: req.body.aiGenerated || false,
        aiPromptUsed: req.body.aiPromptUsed || null,
        generationId: req.body.generationId || null,
      };

      const [post] = await db
        .insert(socialPosts)
        .values(postData)
        .returning();

      res.json({ post });
    } catch (error: any) {
      console.error('[Social] Error creating post:', error);
      res.status(500).json({ message: 'Failed to create post', error: error.message });
    }
  });

  // Update a post
  app.patch('/api/social/posts/:postId', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Verify post belongs to user
      const [existingPost] = await db
        .select()
        .from(socialPosts)
        .where(and(
          eq(socialPosts.id, postId),
          eq(socialPosts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!existingPost) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.platformTitles !== undefined) updateData.platformTitles = req.body.platformTitles;
      if (req.body.hashtags !== undefined) updateData.hashtags = req.body.hashtags;
      if (req.body.firstComment !== undefined) updateData.firstComment = req.body.firstComment;
      if (req.body.scheduledAt !== undefined) updateData.scheduledAt = new Date(req.body.scheduledAt);
      if (req.body.status !== undefined) updateData.status = req.body.status;

      const [updatedPost] = await db
        .update(socialPosts)
        .set(updateData)
        .where(eq(socialPosts.id, postId))
        .returning();

      res.json({ post: updatedPost });
    } catch (error: any) {
      console.error('[Social] Error updating post:', error);
      res.status(500).json({ message: 'Failed to update post', error: error.message });
    }
  });

  // Delete a post
  app.delete('/api/social/posts/:postId', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Verify post belongs to user
      const [existingPost] = await db
        .select()
        .from(socialPosts)
        .where(and(
          eq(socialPosts.id, postId),
          eq(socialPosts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!existingPost) {
        return res.status(404).json({ message: 'Post not found' });
      }

      // If post is scheduled in Upload-Post, cancel it
      if (existingPost.uploadPostJobId && existingPost.status === 'scheduled') {
        try {
          await uploadPostService.cancelScheduledPost(existingPost.uploadPostJobId);
        } catch (error) {
          console.error('[Social] Failed to cancel Upload-Post job:', error);
        }
      }

      await db
        .delete(socialPosts)
        .where(eq(socialPosts.id, postId));

      res.json({ deleted: true });
    } catch (error: any) {
      console.error('[Social] Error deleting post:', error);
      res.status(500).json({ message: 'Failed to delete post', error: error.message });
    }
  });

  // Schedule a post (sends to Upload-Post)
  app.post('/api/social/posts/:postId/schedule', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      // Get post
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(and(
          eq(socialPosts.id, postId),
          eq(socialPosts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      if (!post.scheduledAt) {
        return res.status(400).json({ message: 'Post must have a scheduled date' });
      }

      // Schedule based on post type
      let uploadResult: any;
      
      if (post.postType === 'video' && post.mediaUrl) {
        uploadResult = await uploadPostService.uploadVideo({
          user: profile.uploadPostUsername,
          platforms: post.platforms as SocialPlatform[],
          videoUrl: post.mediaUrl,
          title: post.title,
          description: post.description || undefined,
          scheduledDate: post.scheduledAt.toISOString(),
          asyncUpload: true,
          firstComment: post.firstComment || undefined,
          platformTitles: post.platformTitles as any,
        });
      } else if (post.postType === 'photo' && post.mediaUrl) {
        uploadResult = await uploadPostService.uploadPhoto({
          user: profile.uploadPostUsername,
          platforms: post.platforms as SocialPlatform[],
          photoUrls: [post.mediaUrl],
          title: post.title,
          description: post.description || undefined,
          scheduledDate: post.scheduledAt.toISOString(),
          asyncUpload: true,
          firstComment: post.firstComment || undefined,
          platformTitles: post.platformTitles as any,
        });
      } else {
        uploadResult = await uploadPostService.uploadText({
          user: profile.uploadPostUsername,
          platforms: post.platforms as SocialPlatform[],
          text: post.title,
          scheduledDate: post.scheduledAt.toISOString(),
          asyncUpload: true,
        });
      }

      // Update post with job ID
      const [updatedPost] = await db
        .update(socialPosts)
        .set({
          uploadPostJobId: uploadResult.job_id || uploadResult.request_id,
          status: 'scheduled',
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, postId))
        .returning();

      res.json({ post: updatedPost, uploadResult });
    } catch (error: any) {
      console.error('[Social] Error scheduling post:', error);
      res.status(500).json({ message: 'Failed to schedule post', error: error.message });
    }
  });

  // Publish a post immediately
  app.post('/api/social/posts/:postId/publish', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      // Get post
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(and(
          eq(socialPosts.id, postId),
          eq(socialPosts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      // Publish immediately (no scheduled date = immediate)
      let uploadResult: any;
      
      if (post.postType === 'video' && post.mediaUrl) {
        uploadResult = await uploadPostService.uploadVideo({
          user: profile.uploadPostUsername,
          platforms: post.platforms as SocialPlatform[],
          videoUrl: post.mediaUrl,
          title: post.title,
          description: post.description || undefined,
          asyncUpload: true,
          firstComment: post.firstComment || undefined,
          platformTitles: post.platformTitles as any,
        });
      } else if (post.postType === 'photo' && post.mediaUrl) {
        uploadResult = await uploadPostService.uploadPhoto({
          user: profile.uploadPostUsername,
          platforms: post.platforms as SocialPlatform[],
          photoUrls: [post.mediaUrl],
          title: post.title,
          description: post.description || undefined,
          asyncUpload: true,
          firstComment: post.firstComment || undefined,
          platformTitles: post.platformTitles as any,
        });
      } else {
        uploadResult = await uploadPostService.uploadText({
          user: profile.uploadPostUsername,
          platforms: post.platforms as SocialPlatform[],
          text: post.title,
          asyncUpload: true,
        });
      }

      // Update post status
      const [updatedPost] = await db
        .update(socialPosts)
        .set({
          uploadPostJobId: uploadResult.job_id || uploadResult.request_id,
          status: 'publishing',
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, postId))
        .returning();

      res.json({ post: updatedPost, uploadResult });
    } catch (error: any) {
      console.error('[Social] Error publishing post:', error);
      res.status(500).json({ message: 'Failed to publish post', error: error.message });
    }
  });

  // =====================================================
  // ANALYTICS
  // =====================================================

  // Get analytics summary
  app.get('/api/social/analytics', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { timeRange = '7days' } = req.query;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json(null);
      }

      // Get connected accounts for platform breakdown
      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.socialProfileId, profile.id),
          eq(socialAccounts.isConnected, true)
        ));

      // Get posts for this period
      const posts = await db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.socialProfileId, profile.id));

      // Calculate overall stats (mock data for now - will be populated from Upload-Post analytics sync)
      const publishedPosts = posts.filter(p => p.status === 'published');
      
      const overall = {
        totalFollowers: 0, // Will come from Upload-Post analytics
        totalImpressions: 0,
        avgEngagement: 0,
        postsPublished: publishedPosts.length,
      };

      // Build platform analytics
      const platforms = accounts.map(acc => {
        const platformPosts = posts.filter(p => p.platforms?.includes(acc.platform));
        const platformPublished = platformPosts.filter(p => p.status === 'published');
        
        return {
          platform: acc.platform,
          followers: 0, // Will come from Upload-Post analytics
          followersChange: 0,
          impressions: 0,
          impressionsChange: 0,
          engagement: 0,
          engagementChange: 0,
          postsThisWeek: platformPublished.length,
          topPost: platformPublished.length > 0 ? {
            caption: platformPublished[0].title || '',
            likes: 0,
            comments: 0,
            shares: 0,
          } : undefined,
        };
      });

      res.json({ overall, platforms });
    } catch (error: any) {
      console.error('[Social] Error fetching analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
    }
  });

  // Sync analytics from Upload-Post
  app.post('/api/social/analytics/sync', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      // Fetch analytics from Upload-Post
      const analyticsResult = await uploadPostService.getAnalytics(profile.uploadPostUsername);

      if (!analyticsResult.success) {
        return res.status(500).json({ message: 'Failed to fetch analytics from Upload-Post' });
      }

      // Store analytics (for now, just return them)
      res.json({
        synced: true,
        analytics: analyticsResult.analytics,
      });
    } catch (error: any) {
      console.error('[Social] Error syncing analytics:', error);
      res.status(500).json({ message: 'Failed to sync analytics', error: error.message });
    }
  });

  // =====================================================
  // PLATFORM INFO
  // =====================================================

  // Get platform daily caps
  app.get('/api/social/platform-caps', requireJWT, requireSocialPoster, async (req: any, res) => {
    res.json({ caps: PLATFORM_DAILY_CAPS });
  });

  // Get Facebook pages for user
  app.get('/api/social/facebook/pages', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      const result = await uploadPostService.getFacebookPages(profile.uploadPostUsername);
      res.json(result);
    } catch (error: any) {
      console.error('[Social] Error fetching Facebook pages:', error);
      res.status(500).json({ message: 'Failed to fetch Facebook pages', error: error.message });
    }
  });

  // Get LinkedIn pages for user
  app.get('/api/social/linkedin/pages', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      const result = await uploadPostService.getLinkedInPages(profile.uploadPostUsername);
      res.json(result);
    } catch (error: any) {
      console.error('[Social] Error fetching LinkedIn pages:', error);
      res.status(500).json({ message: 'Failed to fetch LinkedIn pages', error: error.message });
    }
  });

  // Get Pinterest boards for user
  app.get('/api/social/pinterest/boards', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      const result = await uploadPostService.getPinterestBoards(profile.uploadPostUsername);
      res.json(result);
    } catch (error: any) {
      console.error('[Social] Error fetching Pinterest boards:', error);
      res.status(500).json({ message: 'Failed to fetch Pinterest boards', error: error.message });
    }
  });

  // Get scheduled posts from Upload-Post
  app.get('/api/social/scheduled', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json({ scheduledPosts: [] });
      }

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      const scheduledPosts = await uploadPostService.getScheduledPosts();
      res.json({ scheduledPosts });
    } catch (error: any) {
      console.error('[Social] Error fetching scheduled posts:', error);
      res.status(500).json({ message: 'Failed to fetch scheduled posts', error: error.message });
    }
  });

  // Get upload history from Upload-Post
  app.get('/api/social/history', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { page, limit } = req.query;

      if (!uploadPostService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      const history = await uploadPostService.getUploadHistory({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json(history);
    } catch (error: any) {
      console.error('[Social] Error fetching history:', error);
      res.status(500).json({ message: 'Failed to fetch history', error: error.message });
    }
  });

  // =====================================================
  // AI CONTENT GENERATION
  // =====================================================

  // Generate AI caption and hashtags for a post
  app.post('/api/social/ai/generate-caption', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { platform, contentType, topic, tone, targetAudience, includeEmoji, language } = req.body;

      if (!topic) {
        return res.status(400).json({ message: 'Topic is required for caption generation' });
      }

      // Platform-specific character limits and hashtag recommendations (verified official limits)
      const platformSpecs: Record<string, { charLimit: number; hashtagLimit: number; style: string }> = {
        instagram: { charLimit: 2200, hashtagLimit: 30, style: 'engaging, visual, story-driven' },
        tiktok: { charLimit: 2200, hashtagLimit: 5, style: 'trendy, casual, hook-driven' },
        linkedin: { charLimit: 3000, hashtagLimit: 5, style: 'professional, thought-leadership' },
        youtube: { charLimit: 5000, hashtagLimit: 15, style: 'searchable, detailed, informative' },
        facebook: { charLimit: 63206, hashtagLimit: 5, style: 'conversational, community-focused' },
        x: { charLimit: 280, hashtagLimit: 2, style: 'concise, punchy, trending' },
        threads: { charLimit: 500, hashtagLimit: 5, style: 'conversational, authentic' },
        pinterest: { charLimit: 500, hashtagLimit: 20, style: 'inspirational, searchable, descriptive' },
        bluesky: { charLimit: 300, hashtagLimit: 3, style: 'casual, authentic, community' },
      };

      const specs = platformSpecs[platform.toLowerCase()] || platformSpecs.instagram;

      const systemPrompt = `You are an expert social media content creator. Generate engaging content for ${platform} with these specifications:
- Character limit: ${specs.charLimit} characters (STRICTLY ENFORCE)
- Maximum hashtags: ${specs.hashtagLimit} (without the # symbol in your response)
- Style: ${specs.style}
- Tone: ${tone || 'professional'}
${targetAudience ? `- Target audience: ${targetAudience}` : ''}
${includeEmoji ? '- Include relevant emojis' : '- Minimal or no emojis'}
${language ? `- Language: ${language}` : '- Language: English'}

IMPORTANT: Return ONLY valid JSON without any markdown formatting, code fences, or extra text.
Response format:
{"caption": "caption text", "hashtags": ["tag1", "tag2"], "callToAction": "cta text", "contentTips": ["tip1", "tip2"]}`;

      const userPrompt = `Create a ${contentType || 'text'} post about: ${topic}`;

      const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
      
      if (!DEEPSEEK_API_KEY) {
        return res.status(503).json({ message: 'AI content generation is not configured' });
      }

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        console.error('[Social AI] Deepseek API error');
        return res.status(502).json({ message: 'AI service temporarily unavailable' });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return res.status(502).json({ message: 'AI service returned empty response' });
      }

      // Clean markdown fencing and parse JSON
      let cleanedContent = content.trim();
      // Remove markdown code fences (```json ... ``` or ``` ... ```)
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      
      try {
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Post-process to enforce platform limits
          let caption = String(parsed.caption || '').trim();
          let hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
          
          // Truncate caption to platform limit
          if (caption.length > specs.charLimit) {
            caption = caption.substring(0, specs.charLimit - 3) + '...';
          }
          
          // Limit hashtags and remove # if present
          hashtags = hashtags
            .slice(0, specs.hashtagLimit)
            .map((tag: string) => String(tag).replace(/^#/, '').trim())
            .filter((tag: string) => tag.length > 0);
          
          res.json({
            caption,
            hashtags,
            callToAction: String(parsed.callToAction || '').trim(),
            contentTips: Array.isArray(parsed.contentTips) ? parsed.contentTips : [],
            platform,
            enforced: { charLimit: specs.charLimit, hashtagLimit: specs.hashtagLimit },
          });
        } else {
          // Fallback: return truncated raw content as caption
          let caption = cleanedContent;
          if (caption.length > specs.charLimit) {
            caption = caption.substring(0, specs.charLimit - 3) + '...';
          }
          res.json({
            caption,
            hashtags: [],
            callToAction: '',
            contentTips: [],
            platform,
            enforced: { charLimit: specs.charLimit, hashtagLimit: specs.hashtagLimit },
          });
        }
      } catch (parseError) {
        console.error('[Social AI] JSON parse error');
        // Fallback with truncation
        let caption = cleanedContent;
        if (caption.length > specs.charLimit) {
          caption = caption.substring(0, specs.charLimit - 3) + '...';
        }
        res.json({
          caption,
          hashtags: [],
          callToAction: '',
          contentTips: [],
          platform,
          enforced: { charLimit: specs.charLimit, hashtagLimit: specs.hashtagLimit },
        });
      }
    } catch (error: any) {
      console.error('[Social AI] Caption generation error');
      res.status(500).json({ message: 'Failed to generate caption' });
    }
  });

  // Generate AI content plan based on goals
  app.post('/api/social/ai/generate-plan', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { goal, platforms, duration, businessDescription, targetAudience } = req.body;

      // Validate required fields
      if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
        return res.status(400).json({ message: 'Goal is required' });
      }
      if (!Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ message: 'At least one platform is required' });
      }

      const validPlatforms = ['instagram', 'tiktok', 'linkedin', 'youtube', 'facebook', 'x', 'threads', 'pinterest', 'bluesky'];
      const filteredPlatforms = platforms.filter((p: string) => validPlatforms.includes(p.toLowerCase()));
      if (filteredPlatforms.length === 0) {
        return res.status(400).json({ message: 'No valid platforms provided' });
      }

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found. Please initialize your profile first.' });
      }

      const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
      
      if (!DEEPSEEK_API_KEY) {
        return res.status(503).json({ message: 'AI content generation is not configured' });
      }

      const durationDays = duration === '1week' ? 7 : duration === '2weeks' ? 14 : 30;

      const systemPrompt = `You are an expert social media strategist. Create a detailed content plan for a business.

Business: ${businessDescription || 'Not specified'}
Goal: ${goal.trim()}
Target audience: ${targetAudience || 'General audience'}
Platforms: ${filteredPlatforms.join(', ')}
Duration: ${durationDays} days

Create a posting schedule with specific post ideas. For each day, suggest:
- Optimal posting times
- Content type (image, video, carousel, text)
- Topic/theme
- Brief caption idea
- Relevant hashtags

IMPORTANT: Return ONLY valid JSON without any markdown formatting, code fences, or extra text.
Response format:
{"strategy": "Brief overall strategy explanation", "weeklyThemes": ["Theme 1", "Theme 2"], "posts": [{"day": 1, "platform": "instagram", "time": "09:00", "contentType": "image", "topic": "Topic", "captionIdea": "Caption", "hashtags": ["tag1"]}], "tips": ["Tip 1", "Tip 2"]}`;

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a ${durationDays}-day content plan for the platforms: ${filteredPlatforms.join(', ')}` },
          ],
          temperature: 0.8,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        console.error('[Social AI] Deepseek API error');
        return res.status(502).json({ message: 'AI service temporarily unavailable' });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return res.status(502).json({ message: 'AI service returned empty response' });
      }

      // Clean markdown fencing and parse JSON
      let cleanedContent = content.trim();
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

      try {
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Validate parsed structure
          const plan = {
            strategy: String(parsed.strategy || 'AI-generated content strategy'),
            weeklyThemes: Array.isArray(parsed.weeklyThemes) ? parsed.weeklyThemes : [],
            posts: Array.isArray(parsed.posts) ? parsed.posts : [],
            tips: Array.isArray(parsed.tips) ? parsed.tips : [],
          };
          
          // Save as a goal with the AI-generated plan
          const goalData = {
            socialProfileId: profile.id,
            primaryGoal: goal.trim(),
            postingFrequency: duration === '1week' ? 'daily' : 'weekly',
            brandTopics: plan.weeklyThemes.slice(0, 10), // Limit themes
            targetAudience: targetAudience?.trim() || null,
            preferredPlatforms: filteredPlatforms,
            isActive: true,
          };

          const [newGoal] = await db
            .insert(socialGoals)
            .values(goalData)
            .returning();

          res.json({
            goal: {
              id: newGoal.id,
              goal: newGoal.primaryGoal,
              platforms: newGoal.preferredPlatforms,
              duration,
              status: 'active',
              createdAt: newGoal.createdAt?.toISOString(),
            },
            plan,
          });
        } else {
          return res.status(502).json({ message: 'AI response could not be parsed' });
        }
      } catch (parseError) {
        console.error('[Social AI] Plan JSON parse error');
        return res.status(502).json({ message: 'AI response format error' });
      }
    } catch (error: any) {
      console.error('[Social AI] Plan generation error');
      res.status(500).json({ message: 'Failed to generate plan' });
    }
  });

  console.log('✓ Social Media Hub routes registered');
}
