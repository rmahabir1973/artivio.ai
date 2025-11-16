import { describe, it, expect, beforeEach } from '@jest/globals';
import { DbStorage } from '../storage';
import { db } from '../db';
import { users, referrals } from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Referral Concurrency Tests', () => {
  let storage: DbStorage;
  let referrerId: string;
  let referralCode: string;

  beforeEach(async () => {
    storage = new DbStorage();
    
    // Create a referrer user
    const referrer = await storage.upsertUser({
      email: `referrer-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'Referrer',
    });
    referrerId = referrer.id;
    
    // Generate referral code
    referralCode = await storage.getUserReferralCode(referrerId);
    
    // Create a pending referral
    await storage.createReferralClick(referralCode, 'referee@example.com');
  });

  it('should handle concurrent conversion attempts atomically', async () => {
    // Create multiple referee users
    const referee1 = await storage.upsertUser({
      email: `referee1-${Date.now()}@example.com`,
      firstName: 'Referee',
      lastName: 'One',
    });
    const referee2 = await storage.upsertUser({
      email: `referee2-${Date.now()}@example.com`,
      firstName: 'Referee',
      lastName: 'Two',
    });

    // Get initial credits
    const initialReferrer = await storage.getUser(referrerId);
    const initialCredits = initialReferrer?.credits || 0;

    // Attempt concurrent conversions with the same referral code
    const conversions = await Promise.allSettled([
      storage.convertReferral(referralCode, referee1.id),
      storage.convertReferral(referralCode, referee2.id),
      storage.convertReferral(referralCode, referee1.id), // Duplicate attempt
    ]);

    // Count successful conversions
    const successfulConversions = conversions.filter(
      result => result.status === 'fulfilled' && 
      (result.value.referrerCredits > 0 || result.value.refereeCredits > 0)
    );

    // Only ONE conversion should succeed
    expect(successfulConversions.length).toBe(1);

    // Verify credits were awarded exactly once
    const finalReferrer = await storage.getUser(referrerId);
    expect(finalReferrer?.credits).toBe(initialCredits + 1000);

    // Check referee received bonus credits
    const referee1Final = await storage.getUser(referee1.id);
    const referee2Final = await storage.getUser(referee2.id);
    
    const totalRefereeBonusCredits = 
      (referee1Final?.credits || 0) + (referee2Final?.credits || 0);
    
    // Only one referee should have received 500 bonus credits
    expect(totalRefereeBonusCredits).toBe(500);
  });

  it('should prevent double-crediting from retry attempts', async () => {
    const referee = await storage.upsertUser({
      email: `referee-retry-${Date.now()}@example.com`,
      firstName: 'Retry',
      lastName: 'Test',
    });

    const initialReferrer = await storage.getUser(referrerId);
    const initialCredits = initialReferrer?.credits || 0;

    // First conversion should succeed
    const result1 = await storage.convertReferral(referralCode, referee.id);
    expect(result1.referrerCredits).toBe(1000);
    expect(result1.refereeCredits).toBe(500);

    // Verify credits awarded
    const afterFirst = await storage.getUser(referrerId);
    expect(afterFirst?.credits).toBe(initialCredits + 1000);

    // Retry attempts should return zero credits
    const result2 = await storage.convertReferral(referralCode, referee.id);
    expect(result2.referrerCredits).toBe(0);
    expect(result2.refereeCredits).toBe(0);

    const result3 = await storage.convertReferral(referralCode, referee.id);
    expect(result3.referrerCredits).toBe(0);
    expect(result3.refereeCredits).toBe(0);

    // Credits should remain unchanged after retries
    const finalReferrer = await storage.getUser(referrerId);
    expect(finalReferrer?.credits).toBe(initialCredits + 1000);
  });

  it('should handle rapid sequential conversions with different referral codes', async () => {
    // Create multiple referrers
    const referrer2 = await storage.upsertUser({
      email: `referrer2-${Date.now()}@example.com`,
      firstName: 'Referrer',
      lastName: 'Two',
    });
    const code2 = await storage.getUserReferralCode(referrer2.id);
    await storage.createReferralClick(code2, 'test@example.com');

    const referrer3 = await storage.upsertUser({
      email: `referrer3-${Date.now()}@example.com`,
      firstName: 'Referrer',
      lastName: 'Three',
    });
    const code3 = await storage.getUserReferralCode(referrer3.id);
    await storage.createReferralClick(code3, 'test2@example.com');

    // Create referees
    const referee1 = await storage.upsertUser({
      email: `rapid-referee1-${Date.now()}@example.com`,
      firstName: 'Rapid',
      lastName: 'One',
    });
    const referee2 = await storage.upsertUser({
      email: `rapid-referee2-${Date.now()}@example.com`,
      firstName: 'Rapid',
      lastName: 'Two',
    });
    const referee3 = await storage.upsertUser({
      email: `rapid-referee3-${Date.now()}@example.com`,
      firstName: 'Rapid',
      lastName: 'Three',
    });

    // Perform rapid sequential conversions
    const results = await Promise.all([
      storage.convertReferral(referralCode, referee1.id),
      storage.convertReferral(code2, referee2.id),
      storage.convertReferral(code3, referee3.id),
    ]);

    // All three conversions should succeed
    results.forEach(result => {
      expect(result.referrerCredits).toBe(1000);
      expect(result.refereeCredits).toBe(500);
    });

    // Verify each referrer got exactly 1000 credits
    const finalReferrer1 = await storage.getUser(referrerId);
    const finalReferrer2 = await storage.getUser(referrer2.id);
    const finalReferrer3 = await storage.getUser(referrer3.id);

    expect(finalReferrer1?.credits).toBeGreaterThanOrEqual(1000);
    expect(finalReferrer2?.credits).toBeGreaterThanOrEqual(1000);
    expect(finalReferrer3?.credits).toBeGreaterThanOrEqual(1000);
  });

  it('should verify referral status transitions are atomic', async () => {
    const referee = await storage.upsertUser({
      email: `status-test-${Date.now()}@example.com`,
      firstName: 'Status',
      lastName: 'Test',
    });

    // Check initial pending referral exists
    const pendingReferrals = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referralCode, referralCode));
    
    expect(pendingReferrals.length).toBe(1);
    expect(pendingReferrals[0].status).toBe('pending');

    // Convert referral
    await storage.convertReferral(referralCode, referee.id);

    // Check referral status changed to credited
    const creditedReferrals = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referralCode, referralCode));
    
    expect(creditedReferrals.length).toBe(1);
    expect(creditedReferrals[0].status).toBe('credited');
    expect(creditedReferrals[0].refereeId).toBe(referee.id);
    expect(creditedReferrals[0].referrerCreditsEarned).toBe(1000);
    expect(creditedReferrals[0].refereeCreditsGiven).toBe(500);
    expect(creditedReferrals[0].convertedAt).not.toBeNull();
    expect(creditedReferrals[0].creditedAt).not.toBeNull();
  });

  it('should handle missing referral code gracefully', async () => {
    const referee = await storage.upsertUser({
      email: `invalid-${Date.now()}@example.com`,
      firstName: 'Invalid',
      lastName: 'Test',
    });

    // Attempt conversion with non-existent code
    const result = await storage.convertReferral('INVALID_CODE_123', referee.id);

    expect(result.referrerCredits).toBe(0);
    expect(result.refereeCredits).toBe(0);
  });
});
