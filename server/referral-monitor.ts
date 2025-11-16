/**
 * Referral Program Monitoring & Analytics
 * 
 * This module provides production monitoring utilities for the referral system,
 * tracking key metrics, performance, and detecting anomalies.
 */

import { db } from './db';
import { referrals, users } from '../shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export interface ReferralMetrics {
  // Conversion metrics
  totalReferrals: number;
  pendingReferrals: number;
  convertedReferrals: number;
  conversionRate: number;
  
  // Credit metrics
  totalCreditsAwarded: number;
  totalReferrerCredits: number;
  totalRefereeCredits: number;
  
  // Performance metrics
  averageTimeToConversion: number; // in hours
  
  // Health indicators
  duplicateClickAttempts: number;
  failedConversions: number;
  raceConditionDetections: number;
}

export interface TopReferrer {
  userId: string;
  userName: string;
  totalReferrals: number;
  totalCreditsEarned: number;
  conversionRate: number;
}

export class ReferralMonitor {
  /**
   * Get overall referral program metrics using aggregate SQL
   */
  static async getMetrics(sinceDate?: Date): Promise<ReferralMetrics> {
    const whereClause = sinceDate 
      ? gte(referrals.createdAt, sinceDate)
      : sql`true`;

    // Use aggregate SQL to avoid loading all rows
    const [metrics] = await db
      .select({
        totalReferrals: sql<number>`count(*)::int`,
        pendingReferrals: sql<number>`count(CASE WHEN ${referrals.status} = 'pending' THEN 1 END)::int`,
        convertedReferrals: sql<number>`count(CASE WHEN ${referrals.status} = 'credited' THEN 1 END)::int`,
        totalReferrerCredits: sql<number>`COALESCE(sum(${referrals.referrerCreditsEarned}), 0)::int`,
        totalRefereeCredits: sql<number>`COALESCE(sum(${referrals.refereeCreditsGiven}), 0)::int`,
        averageTimeToConversion: sql<number>`
          COALESCE(
            AVG(
              EXTRACT(EPOCH FROM (${referrals.convertedAt} - ${referrals.createdAt})) / 3600
            ) FILTER (WHERE ${referrals.convertedAt} IS NOT NULL),
            0
          )::float
        `,
      })
      .from(referrals)
      .where(whereClause);

    const conversionRate = metrics.totalReferrals > 0
      ? (metrics.convertedReferrals / metrics.totalReferrals) * 100
      : 0;

    return {
      totalReferrals: metrics.totalReferrals,
      pendingReferrals: metrics.pendingReferrals,
      convertedReferrals: metrics.convertedReferrals,
      conversionRate,
      totalCreditsAwarded: metrics.totalReferrerCredits + metrics.totalRefereeCredits,
      totalReferrerCredits: metrics.totalReferrerCredits,
      totalRefereeCredits: metrics.totalRefereeCredits,
      averageTimeToConversion: metrics.averageTimeToConversion,
      duplicateClickAttempts: 0, // Would need separate tracking
      failedConversions: 0, // Would need error logging
      raceConditionDetections: 0, // Tracked via logs
    };
  }

  /**
   * Get top performing referrers
   */
  static async getTopReferrers(limit: number = 10): Promise<TopReferrer[]> {
    const results = await db
      .select({
        userId: referrals.referrerId,
        totalReferrals: sql<number>`count(*)::int`,
        totalConverted: sql<number>`count(CASE WHEN ${referrals.status} = 'credited' THEN 1 END)::int`,
        totalCreditsEarned: sql<number>`COALESCE(sum(${referrals.referrerCreditsEarned}), 0)::int`,
      })
      .from(referrals)
      .groupBy(referrals.referrerId)
      .orderBy(sql`sum(${referrals.referrerCreditsEarned}) DESC`)
      .limit(limit);

    // Enrich with user data
    const enriched = await Promise.all(
      results.map(async (r) => {
        const [user] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(eq(users.id, r.userId))
          .limit(1);

        const userName = user 
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous'
          : 'Anonymous';

        return {
          userId: r.userId,
          userName,
          totalReferrals: r.totalReferrals,
          totalCreditsEarned: r.totalCreditsEarned,
          conversionRate: r.totalReferrals > 0 
            ? (r.totalConverted / r.totalReferrals) * 100 
            : 0,
        };
      })
    );

    return enriched;
  }

  /**
   * Log monitoring summary using structured logger
   */
  static async logSummary(): Promise<void> {
    const { logger } = await import('./logger');
    
    // Last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const metrics24h = await this.getMetrics(last24h);
    
    logger.info('MONITOR', 'Referral metrics (last 24h)', {
      totalReferrals: metrics24h.totalReferrals,
      conversions: metrics24h.convertedReferrals,
      conversionRate: metrics24h.conversionRate.toFixed(2) + '%',
      creditsAwarded: metrics24h.totalCreditsAwarded,
      avgTimeToConvert: metrics24h.averageTimeToConversion.toFixed(2) + ' hours',
    });
    
    // All time
    const metricsAll = await this.getMetrics();
    logger.info('MONITOR', 'Referral metrics (all time)', {
      totalReferrals: metricsAll.totalReferrals,
      conversions: metricsAll.convertedReferrals,
      conversionRate: metricsAll.conversionRate.toFixed(2) + '%',
      totalCreditsAwarded: metricsAll.totalCreditsAwarded,
    });
    
    // Top referrers
    const topReferrers = await this.getTopReferrers(5);
    if (topReferrers.length > 0) {
      logger.info('MONITOR', 'Top referrers', {
        topUsers: topReferrers.map((r, index) => ({
          rank: index + 1,
          userName: r.userName,
          referrals: r.totalReferrals,
          creditsEarned: r.totalCreditsEarned,
          conversionRate: r.conversionRate.toFixed(1) + '%',
        })),
      });
    }
  }

  /**
   * Check for anomalies in the referral system
   */
  static async detectAnomalies(): Promise<string[]> {
    const { logger } = await import('./logger');
    const warnings: string[] = [];
    const metrics = await this.getMetrics();

    // Low conversion rate
    if (metrics.convertedReferrals > 10 && metrics.conversionRate < 20) {
      warnings.push(`Low conversion rate: ${metrics.conversionRate.toFixed(2)}% (Expected: >20%)`);
    }

    // High pending count
    if (metrics.pendingReferrals > metrics.convertedReferrals * 2) {
      warnings.push(`High pending referral count: ${metrics.pendingReferrals} pending vs ${metrics.convertedReferrals} converted`);
    }

    // Check for stuck pending referrals (older than 7 days) - use aggregate count
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referrals)
      .where(
        and(
          eq(referrals.status, 'pending'),
          sql`${referrals.createdAt} < ${sevenDaysAgo}`
        )
      );

    const stuckCount = result?.count || 0;
    if (stuckCount > 0) {
      warnings.push(`${stuckCount} pending referrals older than 7 days (may be abandoned)`);
    }

    if (warnings.length > 0) {
      logger.warn('MONITOR', 'Referral system anomalies detected', { warnings });
    } else {
      logger.info('MONITOR', 'No referral system anomalies detected', {});
    }

    return warnings;
  }

  /**
   * Start periodic monitoring (call this in production)
   */
  static async startPeriodicMonitoring(intervalMinutes: number = 60): Promise<NodeJS.Timeout> {
    const { logger } = await import('./logger');
    logger.info('MONITOR', 'Starting periodic referral monitoring', { 
      intervalMinutes 
    });
    
    // Run immediately
    await this.logSummary();
    await this.detectAnomalies();
    
    // Then run periodically
    return setInterval(async () => {
      await this.logSummary();
      await this.detectAnomalies();
    }, intervalMinutes * 60 * 1000);
  }
}

/**
 * Parse structured JSON logs to extract referral metrics
 * Use this to analyze log files for race condition detection
 */
export function parseReferralLogs(logContent: string): {
  totalConversions: number;
  raceConditionsDetected: number;
  averageConversionTime: number;
  duplicateAttempts: number;
} {
  const lines = logContent.split('\n').filter(l => l.trim());
  
  let totalConversions = 0;
  let raceConditionsDetected = 0;
  let duplicateAttempts = 0;
  const conversionTimes: number[] = [];

  lines.forEach(line => {
    try {
      // Try to parse as JSON (production format)
      const entry = JSON.parse(line);
      
      // Validate that this is a referral log entry
      if (
        entry &&
        typeof entry === 'object' &&
        entry.category === 'REFERRAL' &&
        entry.message &&
        entry.level &&
        ['debug', 'info', 'warn', 'error'].includes(entry.level)
      ) {
        // Count successful conversions (info level only)
        if (entry.message === 'Conversion succeeded' && entry.level === 'info') {
          totalConversions++;
          if (entry.metadata?.duration) {
            conversionTimes.push(entry.metadata.duration);
          }
        }

        // Count race condition detections (warn level only)
        if (entry.message === 'Race condition detected - conversion blocked' && entry.level === 'warn') {
          raceConditionsDetected++;
        }

        // Count duplicate click attempts (warn level only)
        if (entry.message === 'Duplicate click attempt' && entry.level === 'warn') {
          duplicateAttempts++;
        }
      }
    } catch (e) {
      // If not JSON, try parsing development format (only if it explicitly has [REFERRAL] tag)
      const refMatch = line.match(/\[REFERRAL\]/);
      if (refMatch) {
        if (line.includes('Conversion succeeded')) {
          totalConversions++;
        }
        if (line.includes('Race condition detected')) {
          raceConditionsDetected++;
        }
        if (line.includes('Duplicate click attempt')) {
          duplicateAttempts++;
        }
      }
    }
  });

  const averageConversionTime = conversionTimes.length > 0
    ? conversionTimes.reduce((sum, time) => sum + time, 0) / conversionTimes.length
    : 0;

  return {
    totalConversions,
    raceConditionsDetected,
    averageConversionTime,
    duplicateAttempts,
  };
}
