import { db } from '../db';
import { socialBrandKits, aiContentPlans, socialAccounts, socialProfiles, socialBrandAssets } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { chatService } from '../chatService';
import { getSafeZoneGuidance, PLATFORM_SAFE_ZONES, type SocialPlatform } from '@shared/socialPlatformConfig';

interface ContentPlanPost {
  id: string;
  date: string;
  time: string;
  platforms: string[];
  contentType: string;
  caption: string;
  mediaPrompt?: string;
  hashtags?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'posted';
}

function generatePostId(): string {
  return `post_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

interface GeneratedPlan {
  posts: ContentPlanPost[];
  strategy: string;
  contentPillars: string[];
  error?: string;
}

const CONTENT_PLAN_PROMPT = `You are an expert social media strategist. Create a detailed content plan based on the brand information provided.

For each post, consider:
1. The brand's voice and tone
2. Target audience interests and pain points
3. Optimal posting times for engagement
4. Content variety (text, images, videos, carousels)
5. Platform-specific best practices and SAFE ZONES for visual content

PLATFORM SAFE ZONES - When creating mediaPrompt for visual content, be aware of these requirements:

INSTAGRAM REELS (1080x1920px):
- Text-safe area: 900x1500px (center area only)
- Avoid: Top 110px (Reels headline), Bottom 320px (profile/buttons), Right 120px (like/share buttons)
- Grid crop: Center 1080x1350px shows on profile grid

INSTAGRAM STORIES (1080x1920px):
- Text-safe area: 1080x1420px
- Avoid: Top and bottom 250px

TIKTOK (1080x1920px):
- Text-safe area: 960x1440px (center-weighted)
- Avoid: Top 180px (FYP header), Bottom 300px (caption shelf), Left/Right 60px (buttons)
- Safe zone is center-weighted - keep important text in the middle of the frame

YOUTUBE SHORTS (1080x1920px):
- Text-safe area: 820x1510px
- Avoid: Top 140px, Bottom 270px, Left 70px, Right 190px

YOUTUBE VIDEOS (1920x1080px):
- Text-safe area: 1540x870px
- Avoid: Top 120px (title), Bottom 120px (controls), Left/Right 150px

When writing mediaPrompt for videos/images with text overlays, specify:
- Keep all text and important elements within the safe zone
- Position text toward the center of the frame
- Leave margins clear for platform UI elements

MULTI-PLATFORM POSTS: When creating content for multiple platforms:
- Use the SMALLEST safe zone among all target platforms
- For TikTok + other platforms: Always center-weight your text layout (TikTok UI is heavy on sides and bottom)
- For carousel/multi-image posts: Apply safe zone rules to each individual image/slide
- If combining vertical and horizontal platforms: Create separate media assets optimized for each aspect ratio

Generate a comprehensive content plan with the following structure:

STRATEGY: A 2-3 sentence overview of the content strategy approach

CONTENT PILLARS: 3-5 main themes or topics that will anchor the content

POSTS: A list of posts with:
- date: YYYY-MM-DD format
- time: HH:MM format (24-hour, optimal posting time)
- platforms: array of platforms (instagram, facebook, linkedin, twitter, tiktok, youtube, etc.)
- contentType: type of content (text, image, video, carousel, story, reel, short)
- caption: The actual post caption (engaging, brand-aligned, include CTAs where appropriate)
- mediaPrompt: AI image/video generation prompt if visual content is needed (include safe zone considerations for text overlays)
- hashtags: relevant hashtags (5-15 per post)

Respond ONLY with valid JSON in this exact format:
{
  "strategy": "string",
  "contentPillars": ["string"],
  "posts": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "platforms": ["string"],
      "contentType": "string",
      "caption": "string",
      "mediaPrompt": "string or null",
      "hashtags": ["string"]
    }
  ]
}`;

function getDateRange(scope: 'week' | 'month'): { startDate: Date; endDate: Date } {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  if (scope === 'week') {
    endDate.setDate(endDate.getDate() + 7);
  } else {
    endDate.setDate(endDate.getDate() + 30);
  }
  
  return { startDate, endDate };
}

function formatDateForAI(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function getConnectedPlatforms(brandKitId: string): Promise<string[]> {
  try {
    const brandKit = await db.query.socialBrandKits.findFirst({
      where: eq(socialBrandKits.id, brandKitId),
    });
    
    if (!brandKit) return [];
    
    const profile = await db.query.socialProfiles.findFirst({
      where: eq(socialProfiles.id, brandKit.socialProfileId),
    });
    
    if (!profile) return [];
    
    const accounts = await db.query.socialAccounts.findMany({
      where: eq(socialAccounts.socialProfileId, profile.id),
    });
    
    return accounts.map(acc => acc.platform).filter(Boolean) as string[];
  } catch (error) {
    console.error('[AISocialStrategist] Error getting connected platforms:', error);
    return ['instagram', 'facebook', 'linkedin'];
  }
}

interface BrandAssetInfo {
  id: string;
  filename: string;
  type: string;
  folder?: string | null;
  usageStatus?: string | null;
}

async function getBrandAssets(brandKitId: string): Promise<BrandAssetInfo[]> {
  try {
    const assets = await db.query.socialBrandAssets.findMany({
      where: and(
        eq(socialBrandAssets.brandKitId, brandKitId),
        eq(socialBrandAssets.isSuggested, false)
      ),
    });
    
    return assets.map(asset => ({
      id: asset.id,
      filename: asset.filename,
      type: asset.type,
      folder: asset.folder,
      usageStatus: asset.usageStatus,
    }));
  } catch (error) {
    console.error('[AISocialStrategist] Error getting brand assets:', error);
    return [];
  }
}

export async function generateContentPlan(
  brandKitId: string,
  scope: 'week' | 'month'
): Promise<GeneratedPlan> {
  try {
    const brandKit = await db.query.socialBrandKits.findFirst({
      where: eq(socialBrandKits.id, brandKitId),
    });

    if (!brandKit) {
      throw new Error('Brand kit not found');
    }

    const { startDate, endDate } = getDateRange(scope);
    const connectedPlatforms = await getConnectedPlatforms(brandKitId);
    const brandAssets = await getBrandAssets(brandKitId);
    const postsPerDay = scope === 'week' ? 2 : 1;
    const totalDays = scope === 'week' ? 7 : 30;
    const targetPosts = totalDays * postsPerDay;

    const assetsByType = brandAssets.reduce((acc, asset) => {
      const type = asset.type || 'other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(asset.filename);
      return acc;
    }, {} as Record<string, string[]>);

    const assetsContext = brandAssets.length > 0
      ? `
AVAILABLE BRAND ASSETS:
${Object.entries(assetsByType).map(([type, files]) => 
  `- ${type.charAt(0).toUpperCase() + type.slice(1)}s: ${files.slice(0, 10).join(', ')}${files.length > 10 ? ` and ${files.length - 10} more` : ''}`
).join('\n')}

When creating posts, consider:
- Use existing brand images/logos where appropriate instead of generating new ones
- Reference asset filenames in mediaPrompt when recommending existing assets
- Prioritize unused assets (usageStatus: 'unused') to maximize library utilization
`
      : '';

    const brandContext = `
BRAND INFORMATION:
- Business Name: ${brandKit.name}
- Core Identity: ${(brandKit.businessOverview as any)?.coreIdentity || 'Not specified'}
- Primary Positioning: ${(brandKit.businessOverview as any)?.primaryPositioning || 'Not specified'}
- Competitive Advantages: ${((brandKit.businessOverview as any)?.competitiveAdvantages || []).join(', ') || 'Not specified'}

TARGET AUDIENCE:
- Primary Segments: ${((brandKit.customerDemographics as any)?.primarySegments || []).join(', ') || 'Not specified'}
- Age Range: ${(brandKit.customerDemographics as any)?.ageRange || 'Not specified'}
- Interests: ${((brandKit.customerDemographics as any)?.interests || []).join(', ') || 'Not specified'}
- Pain Points: ${((brandKit.customerDemographics as any)?.painPoints || []).join(', ') || 'Not specified'}
- Goals: ${((brandKit.customerDemographics as any)?.goals || []).join(', ') || 'Not specified'}

BRAND VOICE:
- Purpose: ${(brandKit.brandVoice as any)?.purpose || 'Not specified'}
- Target Audience: ${(brandKit.brandVoice as any)?.audience || 'Not specified'}
- Tone: ${((brandKit.brandVoice as any)?.tone || []).join(', ') || 'Professional, friendly'}
- Emotions to evoke: ${((brandKit.brandVoice as any)?.emotions || []).join(', ') || 'Trust, confidence'}
- Character traits: ${((brandKit.brandVoice as any)?.character || []).join(', ') || 'Expert, helpful'}

CONTENT PREFERENCES:
- Featured Media Types: ${((brandKit.contentPreferences as any)?.featuredMediaTypes || ['text', 'image']).join(', ')}
- Topics to Avoid: ${((brandKit.contentPreferences as any)?.topicsToAvoid || []).join(', ') || 'None specified'}
- Content Language: ${(brandKit.contentPreferences as any)?.contentLanguage || 'English'}

COMPETITORS:
- Local: ${((brandKit.competitors as any)?.local || []).join(', ') || 'Not specified'}
- National: ${((brandKit.competitors as any)?.national || []).join(', ') || 'Not specified'}

PLAN REQUIREMENTS:
- Plan Type: ${scope === 'week' ? '1-Week' : '30-Day'} content plan
- Start Date: ${formatDateForAI(startDate)}
- End Date: ${formatDateForAI(endDate)}
- Target Number of Posts: ${targetPosts}
- Connected Platforms: ${connectedPlatforms.length > 0 ? connectedPlatforms.join(', ') : 'instagram, facebook, linkedin'}
- Posts Per Day: ${postsPerDay}

Create a comprehensive ${scope === 'week' ? 'weekly' : 'monthly'} content plan that:
1. Aligns with the brand voice and values
2. Addresses target audience pain points and interests
3. Maintains consistent posting schedule
4. Includes variety of content types
5. Uses optimal posting times for each platform
6. Creates engaging, shareable content
${assetsContext}`;

    const response = await chatService.chat(
      'deepseek',
      'deepseek-chat',
      [
        { role: 'system', content: CONTENT_PLAN_PROMPT },
        { role: 'user', content: brandContext }
      ]
    );

    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let plan: {
      strategy: string;
      contentPillars: string[];
      posts: Array<{
        date: string;
        time: string;
        platforms: string[];
        contentType: string;
        caption: string;
        mediaPrompt?: string;
        hashtags?: string[];
      }>;
    };

    try {
      plan = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[AISocialStrategist] Failed to parse AI response:', parseError);
      return {
        posts: [],
        strategy: '',
        contentPillars: [],
        error: 'Failed to parse AI response. Please try again.',
      };
    }

    if (!plan.posts || !Array.isArray(plan.posts)) {
      plan.posts = [];
    }
    if (!plan.strategy) plan.strategy = '';
    if (!plan.contentPillars || !Array.isArray(plan.contentPillars)) {
      plan.contentPillars = [];
    }

    const startDateTs = startDate.getTime();
    const endDateTs = endDate.getTime();
    
    const formattedPosts: ContentPlanPost[] = plan.posts.map(post => {
      let postDate = new Date(post.date);
      if (postDate.getTime() < startDateTs) {
        postDate = new Date(startDate);
      } else if (postDate.getTime() > endDateTs) {
        postDate = new Date(endDate);
      }
      
      return {
        ...post,
        id: generatePostId(),
        date: postDate.toISOString().split('T')[0],
        status: 'pending' as const,
      };
    });

    return {
      posts: formattedPosts,
      strategy: plan.strategy,
      contentPillars: plan.contentPillars,
    };
  } catch (error: any) {
    console.error('[AISocialStrategist] Error generating content plan:', error);
    return {
      posts: [],
      strategy: '',
      contentPillars: [],
      error: error.message,
    };
  }
}

export async function createAndSaveContentPlan(
  brandKitId: string,
  scope: 'week' | 'month'
): Promise<{ planId: string; plan: GeneratedPlan }> {
  const { startDate, endDate } = getDateRange(scope);
  
  const [planRecord] = await db
    .insert(aiContentPlans)
    .values({
      brandKitId,
      scope,
      startDate,
      endDate,
      status: 'generating',
      plan: { posts: [], strategy: '', contentPillars: [] },
      executionProgress: {
        totalPosts: 0,
        postsScheduled: 0,
        postsPosted: 0,
        postsFailed: 0,
        lastUpdated: new Date().toISOString(),
      },
    })
    .returning();

  const generatedPlan = await generateContentPlan(brandKitId, scope);

  if (generatedPlan.error) {
    await db
      .update(aiContentPlans)
      .set({
        status: 'failed',
        plan: { 
          posts: [], 
          strategy: '', 
          contentPillars: [],
        },
      })
      .where(eq(aiContentPlans.id, planRecord.id));
    
    return { planId: planRecord.id, plan: generatedPlan };
  }

  await db
    .update(aiContentPlans)
    .set({
      status: 'draft',
      plan: {
        posts: generatedPlan.posts,
        strategy: generatedPlan.strategy,
        contentPillars: generatedPlan.contentPillars,
      },
      executionProgress: {
        totalPosts: generatedPlan.posts.length,
        postsScheduled: 0,
        postsPosted: 0,
        postsFailed: 0,
        lastUpdated: new Date().toISOString(),
      },
    })
    .where(eq(aiContentPlans.id, planRecord.id));

  return { planId: planRecord.id, plan: generatedPlan };
}

export async function getContentPlan(planId: string) {
  return await db.query.aiContentPlans.findFirst({
    where: eq(aiContentPlans.id, planId),
  });
}

export async function getContentPlansForBrandKit(brandKitId: string) {
  return await db.query.aiContentPlans.findMany({
    where: eq(aiContentPlans.brandKitId, brandKitId),
    orderBy: desc(aiContentPlans.createdAt),
  });
}

export async function updatePlanStatus(
  planId: string,
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'cancelled'
) {
  return await db
    .update(aiContentPlans)
    .set({ status })
    .where(eq(aiContentPlans.id, planId))
    .returning();
}

export async function updatePostStatus(
  planId: string,
  postIndex: number,
  status: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'posted'
) {
  const plan = await db.query.aiContentPlans.findFirst({
    where: eq(aiContentPlans.id, planId),
  });

  if (!plan || !plan.plan?.posts) {
    throw new Error('Plan not found');
  }

  const posts = [...plan.plan.posts];
  if (postIndex >= 0 && postIndex < posts.length) {
    posts[postIndex] = { ...posts[postIndex], status };
  }

  return await db
    .update(aiContentPlans)
    .set({
      plan: { ...plan.plan, posts },
    })
    .where(eq(aiContentPlans.id, planId))
    .returning();
}

export async function regeneratePlanPost(
  planId: string,
  postIndex: number
): Promise<ContentPlanPost | null> {
  const plan = await db.query.aiContentPlans.findFirst({
    where: eq(aiContentPlans.id, planId),
  });

  if (!plan || !plan.plan?.posts) {
    throw new Error('Plan not found');
  }

  const existingPost = plan.plan.posts[postIndex];
  if (!existingPost) {
    throw new Error('Post not found');
  }

  const brandKit = await db.query.socialBrandKits.findFirst({
    where: eq(socialBrandKits.id, plan.brandKitId),
  });

  if (!brandKit) {
    throw new Error('Brand kit not found');
  }

  const brandAssets = await getBrandAssets(plan.brandKitId);
  const assetsByType = brandAssets.reduce((acc, asset) => {
    const type = asset.type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(asset.filename);
    return acc;
  }, {} as Record<string, string[]>);

  const assetsContext = brandAssets.length > 0
    ? `\nAVAILABLE BRAND ASSETS:\n${Object.entries(assetsByType).map(([type, files]) => 
      `- ${type.charAt(0).toUpperCase() + type.slice(1)}s: ${files.slice(0, 5).join(', ')}${files.length > 5 ? ` and ${files.length - 5} more` : ''}`
    ).join('\n')}\nConsider using existing brand assets when appropriate.`
    : '';

  const regeneratePrompt = `Regenerate a single social media post with the following context:

BRAND: ${brandKit.name}
BRAND VOICE: ${((brandKit.brandVoice as any)?.tone || []).join(', ')}
DATE: ${existingPost.date}
TIME: ${existingPost.time}
PLATFORMS: ${existingPost.platforms.join(', ')}
CONTENT TYPE: ${existingPost.contentType}
${assetsContext}

Create a fresh, engaging post. Respond with JSON:
{
  "caption": "string",
  "mediaPrompt": "string or null",
  "hashtags": ["string"]
}`;

  try {
    const response = await chatService.chat(
      'deepseek',
      'deepseek-chat',
      [
        { role: 'system', content: 'You are a social media content creator. Generate engaging posts.' },
        { role: 'user', content: regeneratePrompt }
      ]
    );

    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const newContent = JSON.parse(jsonStr);
    const existingId = (existingPost as ContentPlanPost).id;
    
    const updatedPost: ContentPlanPost = {
      ...existingPost,
      id: existingId || generatePostId(),
      caption: newContent.caption,
      mediaPrompt: newContent.mediaPrompt,
      hashtags: newContent.hashtags,
      status: 'pending',
    };

    const posts = [...plan.plan.posts];
    posts[postIndex] = updatedPost;

    await db
      .update(aiContentPlans)
      .set({
        plan: { ...plan.plan, posts },
      })
      .where(eq(aiContentPlans.id, planId));

    return updatedPost;
  } catch (error: any) {
    console.error('[AISocialStrategist] Error regenerating post:', error);
    return null;
  }
}
