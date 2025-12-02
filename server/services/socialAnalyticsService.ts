/**
 * Social Analytics Service
 * 
 * Aggregates analytics data from socialPosts table and provides
 * platform-specific breakdowns, posting metrics, and performance insights.
 */

import { db } from '../db';
import { socialPosts, socialProfiles, socialAccounts, socialAnalytics as socialAnalyticsTable } from '@shared/schema';
import { eq, and, gte, lte, count, sql, desc, inArray } from 'drizzle-orm';

export interface PlatformMetrics {
  platform: string;
  postsTotal: number;
  postsPublished: number;
  postsFailed: number;
  postsScheduled: number;
  successRate: number;
  contentTypes: Record<string, number>;
  aiGeneratedCount: number;
  manualCount: number;
  avgPostsPerDay: number;
  lastPostDate: string | null;
}

export interface OverallMetrics {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  failedPosts: number;
  successRate: number;
  aiGeneratedRatio: number;
  platformCount: number;
  avgPostsPerDay: number;
}

export interface TimeRangeStats {
  date: string;
  postsCount: number;
  publishedCount: number;
  failedCount: number;
  platforms: Record<string, number>;
}

export interface AnalyticsResponse {
  overall: OverallMetrics;
  platforms: PlatformMetrics[];
  timeline: TimeRangeStats[];
  topContentTypes: Array<{ type: string; count: number; percentage: number }>;
  bestPostingTimes: Array<{ hour: number; successRate: number; count: number }>;
}

class SocialAnalyticsService {
  
  async getAnalytics(
    socialProfileId: string,
    timeRange: '7days' | '30days' | '90days' = '7days',
    platformFilter?: string
  ): Promise<AnalyticsResponse> {
    const days = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const posts = await db
      .select()
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.socialProfileId, socialProfileId),
          gte(socialPosts.createdAt, startDate)
        )
      )
      .orderBy(desc(socialPosts.createdAt));
    
    const filteredPosts = platformFilter
      ? posts.filter(p => p.platforms?.includes(platformFilter))
      : posts;
    
    const platformMetricsMap = new Map<string, PlatformMetrics>();
    const timelineMap = new Map<string, TimeRangeStats>();
    const contentTypeCount = new Map<string, number>();
    const hourlyStats = new Map<number, { success: number; total: number }>();
    
    let totalPublished = 0;
    let totalFailed = 0;
    let totalScheduled = 0;
    let totalAiGenerated = 0;
    
    for (const post of filteredPosts) {
      const platforms = post.platforms || [];
      const contentType = post.contentType || 'post';
      const isPublished = post.status === 'published';
      const isFailed = post.status === 'failed';
      const isScheduled = post.status === 'scheduled';
      const isAiGenerated = post.aiGenerated;
      
      if (isPublished) totalPublished++;
      if (isFailed) totalFailed++;
      if (isScheduled) totalScheduled++;
      if (isAiGenerated) totalAiGenerated++;
      
      contentTypeCount.set(contentType, (contentTypeCount.get(contentType) || 0) + 1);
      
      const scheduledHour = post.scheduledAt ? new Date(post.scheduledAt).getHours() : null;
      if (scheduledHour !== null && isPublished) {
        const stats = hourlyStats.get(scheduledHour) || { success: 0, total: 0 };
        stats.success++;
        stats.total++;
        hourlyStats.set(scheduledHour, stats);
      } else if (scheduledHour !== null) {
        const stats = hourlyStats.get(scheduledHour) || { success: 0, total: 0 };
        stats.total++;
        hourlyStats.set(scheduledHour, stats);
      }
      
      const dateKey = post.createdAt.toISOString().split('T')[0];
      const timeStats = timelineMap.get(dateKey) || {
        date: dateKey,
        postsCount: 0,
        publishedCount: 0,
        failedCount: 0,
        platforms: {},
      };
      timeStats.postsCount++;
      if (isPublished) timeStats.publishedCount++;
      if (isFailed) timeStats.failedCount++;
      
      for (const platform of platforms) {
        const pKey = platform.toLowerCase();
        
        if (!platformMetricsMap.has(pKey)) {
          platformMetricsMap.set(pKey, {
            platform: pKey,
            postsTotal: 0,
            postsPublished: 0,
            postsFailed: 0,
            postsScheduled: 0,
            successRate: 0,
            contentTypes: {},
            aiGeneratedCount: 0,
            manualCount: 0,
            avgPostsPerDay: 0,
            lastPostDate: null,
          });
        }
        
        const metrics = platformMetricsMap.get(pKey)!;
        metrics.postsTotal++;
        if (isPublished) metrics.postsPublished++;
        if (isFailed) metrics.postsFailed++;
        if (isScheduled) metrics.postsScheduled++;
        if (isAiGenerated) {
          metrics.aiGeneratedCount++;
        } else {
          metrics.manualCount++;
        }
        metrics.contentTypes[contentType] = (metrics.contentTypes[contentType] || 0) + 1;
        
        const postDate = post.createdAt.toISOString().split('T')[0];
        if (!metrics.lastPostDate || postDate > metrics.lastPostDate) {
          metrics.lastPostDate = postDate;
        }
        
        timeStats.platforms[pKey] = (timeStats.platforms[pKey] || 0) + 1;
      }
      
      timelineMap.set(dateKey, timeStats);
    }
    
    for (const metrics of Array.from(platformMetricsMap.values())) {
      const attempted = metrics.postsPublished + metrics.postsFailed;
      metrics.successRate = attempted > 0 ? Math.round((metrics.postsPublished / attempted) * 100) : 0;
      metrics.avgPostsPerDay = Math.round((metrics.postsTotal / days) * 10) / 10;
    }
    
    const totalAttempted = totalPublished + totalFailed;
    const overallSuccessRate = totalAttempted > 0 ? Math.round((totalPublished / totalAttempted) * 100) : 0;
    const aiGeneratedRatio = filteredPosts.length > 0 
      ? Math.round((totalAiGenerated / filteredPosts.length) * 100) 
      : 0;
    
    const overall: OverallMetrics = {
      totalPosts: filteredPosts.length,
      publishedPosts: totalPublished,
      scheduledPosts: totalScheduled,
      failedPosts: totalFailed,
      successRate: overallSuccessRate,
      aiGeneratedRatio,
      platformCount: platformMetricsMap.size,
      avgPostsPerDay: Math.round((filteredPosts.length / days) * 10) / 10,
    };
    
    const platforms = Array.from(platformMetricsMap.values())
      .sort((a, b) => b.postsTotal - a.postsTotal);
    
    const timeline = Array.from(timelineMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));
    
    const totalContentTypes = Array.from(contentTypeCount.entries()).reduce((sum, [, c]) => sum + c, 0);
    const topContentTypes = Array.from(contentTypeCount.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalContentTypes > 0 ? Math.round((count / totalContentTypes) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const bestPostingTimes = Array.from(hourlyStats.entries())
      .map(([hour, stats]) => ({
        hour,
        successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
        count: stats.total,
      }))
      .filter(h => h.count >= 2)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);
    
    return {
      overall,
      platforms,
      timeline,
      topContentTypes,
      bestPostingTimes,
    };
  }
  
  async getPlatformAnalytics(
    socialProfileId: string,
    platform: string,
    timeRange: '7days' | '30days' | '90days' = '7days'
  ): Promise<PlatformMetrics | null> {
    const analytics = await this.getAnalytics(socialProfileId, timeRange, platform);
    return analytics.platforms.find(p => p.platform === platform.toLowerCase()) || null;
  }
  
  async getConnectedPlatforms(socialProfileId: string): Promise<string[]> {
    const accounts = await db
      .select({ platform: socialAccounts.platform })
      .from(socialAccounts)
      .where(eq(socialAccounts.socialProfileId, socialProfileId));
    
    return accounts
      .map(a => a.platform)
      .filter((p): p is string => !!p);
  }
  
  async getRecentActivity(socialProfileId: string, limit: number = 10): Promise<Array<{
    id: string;
    title: string;
    platforms: string[];
    status: string;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    contentType: string;
  }>> {
    const posts = await db
      .select({
        id: socialPosts.id,
        title: socialPosts.title,
        platforms: socialPosts.platforms,
        status: socialPosts.status,
        scheduledAt: socialPosts.scheduledAt,
        publishedAt: socialPosts.publishedAt,
        contentType: socialPosts.contentType,
      })
      .from(socialPosts)
      .where(eq(socialPosts.socialProfileId, socialProfileId))
      .orderBy(desc(socialPosts.createdAt))
      .limit(limit);
    
    return posts;
  }
  
  async recordDailySnapshot(socialProfileId: string, platform: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfDay = today;
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const dailyPosts = await db
      .select()
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.socialProfileId, socialProfileId),
          gte(socialPosts.publishedAt, startOfDay),
          lte(socialPosts.publishedAt, endOfDay)
        )
      );
    
    const platformPosts = dailyPosts.filter(p => p.platforms?.includes(platform));
    const publishedCount = platformPosts.filter(p => p.status === 'published').length;
    
    const existingSnapshot = await db
      .select()
      .from(socialAnalyticsTable)
      .where(
        and(
          eq(socialAnalyticsTable.socialProfileId, socialProfileId),
          eq(socialAnalyticsTable.platform, platform),
          gte(socialAnalyticsTable.date, startOfDay),
          lte(socialAnalyticsTable.date, endOfDay)
        )
      )
      .limit(1);
    
    if (existingSnapshot.length > 0) {
      await db
        .update(socialAnalyticsTable)
        .set({
          postsPublished: publishedCount,
        })
        .where(eq(socialAnalyticsTable.id, existingSnapshot[0].id));
    } else {
      await db.insert(socialAnalyticsTable).values({
        socialProfileId,
        platform,
        date: today,
        postsPublished: publishedCount,
      });
    }
  }
}

export const socialAnalyticsService = new SocialAnalyticsService();
