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
   * Get overall referral program metrics
   */
  static async getMetrics(sinceDate?: Date): Promise<ReferralMetrics> {
    const whereClause = sinceDate 
      ? gte(referrals.createdAt, sinceDate)
      : undefined;

    const allReferrals = await db
      .select()
      .from(referrals)
      .where(whereClause);

    const pending = allReferrals.filter(r => r.status === 'pending');
    const converted = allReferrals.filter(r => r.status === 'credited');

    // Calculate average time to conversion
    const conversionTimes = converted
      .filter(r => r.convertedAt && r.createdAt)
      .map(r => {
        const created = new Date(r.createdAt).getTime();
        const convertedTime = new Date(r.convertedAt!).getTime();
        return (convertedTime - created) / (1000 * 60 * 60); // hours
      });

    const averageTimeToConversion = conversionTimes.length > 0
      ? conversionTimes.reduce((sum, time) => sum + time, 0) / conversionTimes.length
      : 0;

    // Calculate total credits
    const totalReferrerCredits = converted.reduce((sum, r) => sum + r.referrerCreditsEarned, 0);
    const totalRefereeCredits = converted.reduce((sum, r) => sum + r.refereeCreditsGiven, 0);

    return {
      totalReferrals: allReferrals.length,
      pendingReferrals: pending.length,
      convertedReferrals: converted.length,
      conversionRate: allReferrals.length > 0 
        ? (converted.length / allReferrals.length) * 100 
        : 0,
      totalCreditsAwarded: totalReferrerCredits + totalRefereeCredits,
      totalReferrerCredits,
      totalRefereeCredits,
      averageTimeToConversion,
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
   * Log monitoring summary to console
   */
  static async logSummary(): Promise<void> {
    console.log('\n=== REFERRAL PROGRAM MONITORING SUMMARY ===');
    
    // Last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const metrics24h = await this.getMetrics(last24h);
    
    console.log('\n📊 Last 24 Hours:');
    console.log(`  Total Referrals: ${metrics24h.totalReferrals}`);
    console.log(`  Conversions: ${metrics24h.convertedReferrals}`);
    console.log(`  Conversion Rate: ${metrics24h.conversionRate.toFixed(2)}%`);
    console.log(`  Credits Awarded: ${metrics24h.totalCreditsAwarded}`);
    console.log(`  Avg Time to Convert: ${metrics24h.averageTimeToConversion.toFixed(2)} hours`);
    
    // All time
    const metricsAll = await this.getMetrics();
    console.log('\n📈 All Time:');
    console.log(`  Total Referrals: ${metricsAll.totalReferrals}`);
    console.log(`  Conversions: ${metricsAll.convertedReferrals}`);
    console.log(`  Conversion Rate: ${metricsAll.conversionRate.toFixed(2)}%`);
    console.log(`  Total Credits Awarded: ${metricsAll.totalCreditsAwarded}`);
    
    // Top referrers
    const topReferrers = await this.getTopReferrers(5);
    console.log('\n🏆 Top 5 Referrers:');
    topReferrers.forEach((r, index) => {
      console.log(`  ${index + 1}. ${r.userName}: ${r.totalReferrals} referrals, ${r.totalCreditsEarned} credits earned (${r.conversionRate.toFixed(1)}% conversion)`);
    });
    
    console.log('\n===========================================\n');
  }

  /**
   * Check for anomalies in the referral system
   */
  static async detectAnomalies(): Promise<string[]> {
    const warnings: string[] = [];
    const metrics = await this.getMetrics();

    // Low conversion rate
    if (metrics.convertedReferrals > 10 && metrics.conversionRate < 20) {
      warnings.push(`⚠️  Low conversion rate: ${metrics.conversionRate.toFixed(2)}% (Expected: >20%)`);
    }

    // High pending count
    if (metrics.pendingReferrals > metrics.convertedReferrals * 2) {
      warnings.push(`⚠️  High pending referral count: ${metrics.pendingReferrals} pending vs ${metrics.convertedReferrals} converted`);
    }

    // Check for stuck pending referrals (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stuckReferrals = await db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.status, 'pending'),
          sql`${referrals.createdAt} < ${sevenDaysAgo}`
        )
      );

    if (stuckReferrals.length > 0) {
      warnings.push(`⚠️  ${stuckReferrals.length} pending referrals older than 7 days (may be abandoned)`);
    }

    if (warnings.length > 0) {
      console.log('\n🚨 REFERRAL SYSTEM ANOMALIES DETECTED:');
      warnings.forEach(w => console.log(w));
      console.log('');
    } else {
      console.log('✅ No referral system anomalies detected');
    }

    return warnings;
  }

  /**
   * Start periodic monitoring (call this in production)
   */
  static startPeriodicMonitoring(intervalMinutes: number = 60): NodeJS.Timeout {
    console.log(`🔍 Starting referral monitoring (every ${intervalMinutes} minutes)`);
    
    // Run immediately
    this.logSummary();
    this.detectAnomalies();
    
    // Then run periodically
    return setInterval(async () => {
      await this.logSummary();
      await this.detectAnomalies();
    }, intervalMinutes * 60 * 1000);
  }
}

/**
 * Parse referral logs to extract metrics
 * Use this to analyze log files for race condition detection
 */
export function parseReferralLogs(logContent: string): {
  totalConversions: number;
  raceConditionsDetected: number;
  averageConversionTime: number;
  duplicateAttempts: number;
} {
  const lines = logContent.split('\n');
  
  let totalConversions = 0;
  let raceConditionsDetected = 0;
  let duplicateAttempts = 0;
  const conversionTimes: number[] = [];

  lines.forEach(line => {
    // Count successful conversions
    if (line.includes('[REFERRAL]') && line.includes('Conversion completed successfully')) {
      totalConversions++;
      
      // Extract performance timing
      const timeMatch = line.match(/Total=(\d+)ms/);
      if (timeMatch) {
        conversionTimes.push(parseInt(timeMatch[1]));
      }
    }

    // Count race condition detections
    if (line.includes('[REFERRAL]') && line.includes('Race condition detected')) {
      raceConditionsDetected++;
    }

    // Count duplicate click attempts
    if (line.includes('[REFERRAL]') && line.includes('Duplicate click detected')) {
      duplicateAttempts++;
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
