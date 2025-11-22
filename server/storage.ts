import {
  users,
  apiKeys,
  pricing,
  planEconomics,
  generations,
  savedSeeds,
  conversations,
  messages,
  voiceClones,
  ttsGenerations,
  sttGenerations,
  avatarGenerations,
  audioConversions,
  imageAnalyses,
  lyricsGenerations,
  videoCombinations,
  videoCombinationEvents,
  subscriptionPlans,
  userSubscriptions,
  stripeEvents,
  homePageContent,
  announcements,
  favoriteWorkflows,
  generationTemplates,
  referrals,
  type User,
  type UpsertUser,
  type Referral,
  type InsertReferral,
  type ApiKey,
  type InsertApiKey,
  type Pricing,
  type InsertPricing,
  type UpdatePricing,
  type PlanEconomics,
  type InsertPlanEconomics,
  type UpdatePlanEconomics,
  type Generation,
  type InsertGeneration,
  type SavedSeed,
  type InsertSavedSeed,
  type UpdateSavedSeed,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type VoiceClone,
  type InsertVoiceClone,
  type TtsGeneration,
  type InsertTtsGeneration,
  type SttGeneration,
  type InsertSttGeneration,
  type AvatarGeneration,
  type InsertAvatarGeneration,
  type AudioConversion,
  type InsertAudioConversion,
  type ImageAnalysis,
  type InsertImageAnalysis,
  type LyricsGeneration,
  type InsertLyricsGeneration,
  type VideoCombination,
  type InsertVideoCombination,
  type VideoCombinationEvent,
  type InsertVideoCombinationEvent,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type UserSubscription,
  type InsertUserSubscription,
  type StripeEvent,
  type InsertStripeEvent,
  type HomePageContent,
  type Announcement,
  type InsertAnnouncement,
  type FavoriteWorkflow,
  type InsertFavoriteWorkflow,
  type GenerationTemplate,
  type InsertGenerationTemplate,
  userOnboarding,
  type InsertUserOnboarding,
  type UpdateUserOnboarding,
  type UserOnboarding,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserCredits(userId: string, credits: number): Promise<User | undefined>;
  deductCreditsAtomic(userId: string, cost: number): Promise<User | null>;
  addCreditsAtomic(userId: string, amount: number): Promise<User | undefined>;
  deleteUser(userId: string): Promise<void>;

  // API Key operations (round-robin system)
  getAllApiKeys(): Promise<ApiKey[]>;
  getActiveApiKeys(): Promise<ApiKey[]>;
  getNextApiKey(): Promise<ApiKey | undefined>;
  updateApiKeyUsage(keyId: string): Promise<void>;
  addApiKey(key: InsertApiKey): Promise<ApiKey>;
  toggleApiKey(keyId: string, isActive: boolean): Promise<ApiKey | undefined>;
  deleteApiKey(keyId: string): Promise<void>;

  // Pricing operations
  getAllPricing(): Promise<Pricing[]>;
  getPricingByModel(model: string): Promise<Pricing | undefined>;
  getPricingById(id: string): Promise<Pricing | undefined>;
  createPricing(pricing: InsertPricing): Promise<Pricing>;
  updatePricing(id: string, updates: UpdatePricing): Promise<Pricing | undefined>;

  // Plan Economics operations (singleton)
  getPlanEconomics(): Promise<PlanEconomics | undefined>;
  upsertPlanEconomics(economics: UpdatePlanEconomics): Promise<PlanEconomics>;

  // Generation operations
  getAllGenerations(): Promise<Generation[]>;
  getGeneration(id: string): Promise<Generation | undefined>;
  createGeneration(generation: InsertGeneration): Promise<Generation>;
  updateGeneration(id: string, updates: Partial<Generation>): Promise<Generation | undefined>;
  finalizeGeneration(
    generationId: string, 
    outcome: 'success' | 'failure',
    updates: Partial<Generation>
  ): Promise<Generation | undefined>;
  cancelGeneration(generationId: string): Promise<{ refunded: boolean; amount: number } | undefined>;
  getUserGenerations(userId: string): Promise<Generation[]>;
  getRecentGenerations(userId: string, limit?: number): Promise<Generation[]>;
  getUserGenerationsPage(userId: string, limit: number, cursor?: { createdAt: Date; id: string }): Promise<{ items: Generation[]; nextCursor: { createdAt: Date; id: string } | null }>;
  deleteGeneration(id: string): Promise<void>;
  getUserStats(userId: string): Promise<{
    totalGenerations: number;
    todayGenerations: number;
    successRate: number;
  }>;
  getUserAnalytics(userId: string, days?: number): Promise<{
    totalCreditsSpent: number;
    totalGenerations: number;
    successRate: number;
    byFeatureType: Array<{ type: string; count: number; credits: number }>;
    byModel: Array<{ model: string; count: number; credits: number }>;
    dailyTrends: Array<{ date: string; credits: number; count: number }>;
  }>;

  // Saved Seeds operations (seed library)
  getUserSavedSeeds(userId: string): Promise<SavedSeed[]>;
  getSavedSeed(id: string): Promise<SavedSeed | undefined>;
  createSavedSeed(seed: InsertSavedSeed): Promise<SavedSeed>;
  updateSavedSeed(id: string, updates: UpdateSavedSeed): Promise<SavedSeed | undefined>;
  incrementSeedUsage(id: string): Promise<SavedSeed | undefined>;
  deleteSavedSeed(id: string): Promise<void>;

  // Chat operations
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getUserConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  updateConversationTitle(id: string, title: string): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<void>;
  
  createMessage(message: InsertMessage): Promise<Message>;
  getConversationMessages(conversationId: string): Promise<Message[]>;

  // Voice Clone operations
  createVoiceClone(voiceClone: InsertVoiceClone): Promise<VoiceClone>;
  getUserVoiceClones(userId: string): Promise<VoiceClone[]>;
  getVoiceClone(id: string): Promise<VoiceClone | undefined>;
  toggleVoiceClone(id: string, isActive: boolean): Promise<VoiceClone | undefined>;
  deleteVoiceClone(id: string): Promise<void>;

  // TTS Generation operations
  createTtsGeneration(generation: InsertTtsGeneration): Promise<TtsGeneration>;
  updateTtsGeneration(id: string, updates: Partial<TtsGeneration>): Promise<TtsGeneration | undefined>;
  getUserTtsGenerations(userId: string): Promise<TtsGeneration[]>;

  // STT Generation operations
  createSttGeneration(generation: InsertSttGeneration): Promise<SttGeneration>;
  updateSttGeneration(id: string, updates: Partial<SttGeneration>): Promise<SttGeneration | undefined>;
  getUserSttGenerations(userId: string): Promise<SttGeneration[]>;

  // Avatar Generation operations
  createAvatarGeneration(generation: InsertAvatarGeneration): Promise<AvatarGeneration>;
  updateAvatarGeneration(id: string, updates: Partial<AvatarGeneration>): Promise<AvatarGeneration | undefined>;
  getUserAvatarGenerations(userId: string): Promise<AvatarGeneration[]>;

  // Audio Conversion operations
  createAudioConversion(conversion: InsertAudioConversion): Promise<AudioConversion>;
  updateAudioConversion(id: string, updates: Partial<AudioConversion>): Promise<AudioConversion | undefined>;
  getUserAudioConversions(userId: string): Promise<AudioConversion[]>;

  // Image Analysis operations
  createImageAnalysis(analysis: InsertImageAnalysis): Promise<ImageAnalysis>;
  updateImageAnalysis(id: string, updates: Partial<ImageAnalysis>): Promise<ImageAnalysis | undefined>;
  getUserImageAnalyses(userId: string): Promise<ImageAnalysis[]>;
  getImageAnalysisByIdempotencyKey(userId: string, idempotencyKey: string): Promise<ImageAnalysis | undefined>;

  // Lyrics Generation operations
  createLyricsGeneration(generation: InsertLyricsGeneration): Promise<LyricsGeneration>;
  updateLyricsGeneration(id: string, updates: Partial<LyricsGeneration>): Promise<LyricsGeneration | undefined>;
  finalizeLyricsGeneration(
    lyricsId: string,
    outcome: 'success' | 'failure',
    updates: Partial<LyricsGeneration>
  ): Promise<LyricsGeneration | undefined>;
  getUserLyricsGenerations(userId: string): Promise<LyricsGeneration[]>;

  // Video Combination operations
  createVideoCombination(combination: InsertVideoCombination): Promise<VideoCombination>;
  updateVideoCombination(id: string, updates: Partial<VideoCombination>): Promise<VideoCombination | undefined>;
  getUserVideoCombinations(userId: string): Promise<VideoCombination[]>;
  getVideoCombinationById(id: string): Promise<VideoCombination | undefined>;
  createVideoCombinationEvent(event: InsertVideoCombinationEvent): Promise<VideoCombinationEvent>;
  getVideoCombinationEvents(combinationId: string): Promise<VideoCombinationEvent[]>;

  // Subscription Plan operations
  getAllPlans(): Promise<SubscriptionPlan[]>;
  getPlanById(id: string): Promise<SubscriptionPlan | undefined>;
  createPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updatePlan(planId: string, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  updatePlanStripeIds(planId: string, stripePriceId: string | null, stripeProductId: string | null): Promise<SubscriptionPlan | undefined>;
  deletePlan(planId: string): Promise<{ success: boolean; error?: string }>;
  checkPlanInUse(planId: string): Promise<boolean>;

  // Home Page Content operations
  getHomePageContent(): Promise<HomePageContent | undefined>;
  updateHomePageContent(updates: Partial<HomePageContent>): Promise<HomePageContent | undefined>;

  getUserSubscription(userId: string): Promise<(UserSubscription & { plan: SubscriptionPlan }) | undefined>;
  getUsersWithSubscriptions(): Promise<Array<User & { subscription: (UserSubscription & { plan: SubscriptionPlan }) | null }>>;
  upsertUserSubscription(data: InsertUserSubscription): Promise<UserSubscription>;
  removeUserSubscription(userId: string): Promise<void>;
  assignPlanToUser(userId: string, planId: string): Promise<{ subscription: UserSubscription; creditsGranted: number }>;
  
  // Stripe Event operations (for webhook idempotency)
  getStripeEventById(eventId: string): Promise<StripeEvent | undefined>;
  createStripeEvent(event: InsertStripeEvent): Promise<void>;

  // Announcement operations
  getAllAnnouncements(): Promise<Announcement[]>;
  getActiveAnnouncements(userPlanName?: string): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: string, updates: Partial<InsertAnnouncement>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: string): Promise<void>;

  // Favorite Workflow operations
  addFavoriteWorkflow(userId: string, workflowId: number, workflowTitle: string): Promise<FavoriteWorkflow>;
  removeFavoriteWorkflow(userId: string, workflowId: number): Promise<void>;
  getUserFavoriteWorkflows(userId: string): Promise<FavoriteWorkflow[]>;
  isFavoriteWorkflow(userId: string, workflowId: number): Promise<boolean>;

  // Generation Template operations
  createTemplate(template: InsertGenerationTemplate): Promise<GenerationTemplate>;
  getTemplate(id: string): Promise<GenerationTemplate | undefined>;
  getUserTemplates(userId: string, featureType?: string): Promise<GenerationTemplate[]>;
  getPublicTemplates(featureType?: string): Promise<GenerationTemplate[]>;
  updateTemplate(id: string, updates: Partial<InsertGenerationTemplate>): Promise<GenerationTemplate | undefined>;
  deleteTemplate(id: string): Promise<void>;
  incrementTemplateUsage(id: string): Promise<void>;

  // Onboarding operations
  getOrCreateOnboarding(userId: string): Promise<UserOnboarding>;
  updateOnboarding(userId: string, updates: UpdateUserOnboarding): Promise<UserOnboarding | undefined>;

  // Referral operations
  getUserReferralCode(userId: string): Promise<string>;
  createReferralClick(referralCode: string, refereeEmail?: string): Promise<Referral>;
  convertReferral(referralCode: string, refereeId: string): Promise<{ referrerCredits: number; refereeCredits: number }>;
  getUserReferralStats(userId: string): Promise<{
    totalReferrals: number;
    convertedReferrals: number;
    pendingReferrals: number;
    totalCreditsEarned: number;
    referrals: Referral[];
  }>;
  getReferralLeaderboard(limit?: number): Promise<Array<{
    userId: string;
    userName: string;
    profileImageUrl: string | null;
    totalReferrals: number;
    totalCreditsEarned: number;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Use Drizzle's onConflictDoUpdate for proper upsert semantics
    // On conflict (email already exists), update profile fields but preserve id
    const [upsertedUser] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return upsertedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserCredits(userId: string, credits: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ credits, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Atomically deduct credits - returns updated user or null if insufficient credits
  async deductCreditsAtomic(userId: string, cost: number): Promise<User | null> {
    const [user] = await db
      .update(users)
      .set({ 
        credits: sql`credits - ${cost}`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(users.id, userId),
        sql`credits >= ${cost}`
      ))
      .returning();
    return user || null;
  }

  // Atomically add credits (e.g., for refunds) - always succeeds
  async addCreditsAtomic(userId: string, amount: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        credits: sql`credits + ${amount}`,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  // API Key operations
  async getAllApiKeys(): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).orderBy(apiKeys.keyName);
  }

  async getActiveApiKeys(): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.isActive, true))
      .orderBy(apiKeys.usageCount);
  }

  async getNextApiKey(): Promise<ApiKey | undefined> {
    // Round-robin: get the least used active key
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.isActive, true))
      .orderBy(apiKeys.usageCount, apiKeys.lastUsedAt)
      .limit(1);
    return key;
  }

  async updateApiKeyUsage(keyId: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({
        usageCount: sql`${apiKeys.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId));
  }

  async addApiKey(key: InsertApiKey): Promise<ApiKey> {
    const [apiKey] = await db
      .insert(apiKeys)
      .values(key)
      .returning();
    return apiKey;
  }

  async deleteApiKey(keyId: string): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
  }

  async toggleApiKey(keyId: string, isActive: boolean): Promise<ApiKey | undefined> {
    const [key] = await db
      .update(apiKeys)
      .set({ isActive })
      .where(eq(apiKeys.id, keyId))
      .returning();
    return key;
  }

  // Pricing operations
  async getAllPricing(): Promise<Pricing[]> {
    return await db.select().from(pricing).orderBy(pricing.category, pricing.feature);
  }

  async getPricingByModel(model: string): Promise<Pricing | undefined> {
    const normalizedModel = model.toLowerCase().trim();
    const [price] = await db
      .select()
      .from(pricing)
      .where(eq(pricing.model, normalizedModel));
    return price;
  }

  async getPricingById(id: string): Promise<Pricing | undefined> {
    const [price] = await db
      .select()
      .from(pricing)
      .where(eq(pricing.id, id));
    return price;
  }

  async createPricing(pricingData: InsertPricing): Promise<Pricing> {
    const normalizedData = {
      ...pricingData,
      feature: pricingData.feature.toLowerCase().trim(),
      model: pricingData.model.toLowerCase().trim(),
    };
    
    const [price] = await db
      .insert(pricing)
      .values(normalizedData)
      .returning();
    return price;
  }

  async updatePricing(id: string, updates: UpdatePricing): Promise<Pricing | undefined> {
    const [price] = await db
      .update(pricing)
      .set(updates)
      .where(eq(pricing.id, id))
      .returning();
    return price;
  }

  // Plan Economics operations (singleton)
  async getPlanEconomics(): Promise<PlanEconomics | undefined> {
    const [economics] = await db.select().from(planEconomics).limit(1);
    return economics;
  }

  async upsertPlanEconomics(economics: UpdatePlanEconomics): Promise<PlanEconomics> {
    // Check if row exists (singleton)
    const existing = await this.getPlanEconomics();
    
    if (existing) {
      // Update existing row
      const [updated] = await db
        .update(planEconomics)
        .set({
          ...economics,
          updatedAt: new Date(),
        })
        .where(eq(planEconomics.id, existing.id))
        .returning();
      return updated;
    } else {
      // Insert new row with defaults
      const [created] = await db
        .insert(planEconomics)
        .values({
          kiePurchaseAmount: economics.kiePurchaseAmount ?? 50,
          kieCreditAmount: economics.kieCreditAmount ?? 10000,
          userCreditAmount: economics.userCreditAmount ?? 15000,
          profitMargin: economics.profitMargin ?? 50,
        })
        .returning();
      return created;
    }
  }

  // Generation operations
  async getAllGenerations(): Promise<Generation[]> {
    return await db.select().from(generations).orderBy(desc(generations.createdAt));
  }

  async createGeneration(generation: InsertGeneration): Promise<Generation> {
    const [gen] = await db
      .insert(generations)
      .values(generation)
      .returning();
    return gen;
  }

  async updateGeneration(id: string, updates: Partial<Generation>): Promise<Generation | undefined> {
    // Explicitly handle field mapping for Drizzle ORM
    const updateObj: any = {};
    if ('isShowcase' in updates) {
      updateObj.isShowcase = updates.isShowcase;
    }
    if ('status' in updates) {
      updateObj.status = updates.status;
    }
    if ('resultUrl' in updates) {
      updateObj.resultUrl = updates.resultUrl;
    }
    if ('statusDetail' in updates) {
      updateObj.statusDetail = updates.statusDetail;
    }
    if ('errorMessage' in updates) {
      updateObj.errorMessage = updates.errorMessage;
    }
    if ('completedAt' in updates) {
      updateObj.completedAt = updates.completedAt;
    }
    if ('processingStage' in updates) {
      updateObj.processingStage = updates.processingStage;
    }
    if ('thumbnailUrl' in updates) {
      updateObj.thumbnailUrl = updates.thumbnailUrl;
    }
    if ('externalTaskId' in updates) {
      updateObj.externalTaskId = updates.externalTaskId;
    }
    if ('parameters' in updates) {
      updateObj.parameters = updates.parameters;
    }

    const [generation] = await db
      .update(generations)
      .set(updateObj)
      .where(eq(generations.id, id))
      .returning();
    return generation;
  }

  /**
   * Atomically finalize a generation (success or failure) with automatic credit refunds on failure.
   * This function is idempotent - safe to call multiple times (e.g., from webhook retries).
   * Uses UPDATE with WHERE guard to prevent overwriting user cancellations.
   */
  async finalizeGeneration(
    generationId: string,
    outcome: 'success' | 'failure',
    updates: Partial<Generation>
  ): Promise<Generation | undefined> {
    return await db.transaction(async (tx) => {
      // Atomically update ONLY if still in pending/processing state
      // This prevents overwriting user cancellations and ensures idempotency
      const [updated] = await tx
        .update(generations)
        .set({
          ...updates,
          status: outcome === 'success' ? 'completed' : 'failed',
          completedAt: new Date(),
        })
        .where(
          and(
            eq(generations.id, generationId),
            sql`${generations.status} IN ('pending', 'processing')`
          )
        )
        .returning();

      // If no rows were updated, generation was already finalized or cancelled
      if (!updated) {
        // Fetch current state for logging
        const [existing] = await tx
          .select()
          .from(generations)
          .where(eq(generations.id, generationId))
          .limit(1);
        
        if (existing) {
          console.log(`[finalizeGeneration] Generation ${generationId} already finalized with status: ${existing.status}`);
          return existing;
        }
        
        throw new Error(`Generation ${generationId} not found`);
      }

      // Only refund credits for failures
      if (outcome === 'failure' && updated.creditsCost > 0) {
        await tx
          .update(users)
          .set({ 
            credits: sql`${users.credits} + ${updated.creditsCost}` 
          })
          .where(eq(users.id, updated.userId));

        console.log(`✓ [CREDIT REFUND] Refunded ${updated.creditsCost} credits to user ${updated.userId} for failed generation ${generationId}`);
      }

      console.log(`✓ [finalizeGeneration] Generation ${generationId} finalized as ${outcome}`);
      
      // Track onboarding step 3 completion for successful generations
      if (outcome === 'success') {
        try {
          const onboarding = await this.getOrCreateOnboarding(updated.userId);
          
          // Only mark complete if not already complete to prevent redundant updates
          if (!onboarding.completedFirstGeneration) {
            await this.updateOnboarding(updated.userId, {
              completedFirstGeneration: true,
            });
            console.log(`✓ [Onboarding] Marked step 3 complete for user ${updated.userId}`);
          }
        } catch (onboardingError) {
          // Log but don't fail the finalization if onboarding update fails
          console.error('[Onboarding] Failed to update progress:', onboardingError);
        }
      }
      
      return updated;
    });
  }

  /**
   * Atomically cancel a generation and refund credits if still in pending/processing state.
   * This function is idempotent - safe to call multiple times.
   * Uses UPDATE with WHERE guard to ensure only non-terminal generations are modified.
   */
  async cancelGeneration(generationId: string): Promise<{ refunded: boolean; amount: number } | undefined> {
    return await db.transaction(async (tx) => {
      // Atomically update ONLY if still in pending/processing state
      // This prevents race conditions with webhook callbacks
      const [updated] = await tx
        .update(generations)
        .set({
          status: 'failed',
          errorMessage: 'Cancelled by user',
          completedAt: new Date(),
        })
        .where(
          and(
            eq(generations.id, generationId),
            sql`${generations.status} IN ('pending', 'processing')`
          )
        )
        .returning();

      // If no rows were updated, generation was already in terminal state
      if (!updated) {
        console.log(`[cancelGeneration] Generation ${generationId} already finalized - no refund`);
        return { refunded: false, amount: 0 };
      }

      // Only refund if the generation had a cost (using data from the RETURNING clause)
      if (updated.creditsCost > 0) {
        // Refund credits atomically
        await tx
          .update(users)
          .set({ 
            credits: sql`${users.credits} + ${updated.creditsCost}` 
          })
          .where(eq(users.id, updated.userId));

        console.log(`✓ [CANCEL REFUND] Refunded ${updated.creditsCost} credits to user ${updated.userId} for cancelled generation ${generationId}`);
        
        return { 
          refunded: true, 
          amount: updated.creditsCost 
        };
      }

      console.log(`✓ [cancelGeneration] Generation ${generationId} marked as cancelled (no credits to refund)`);
      return { refunded: false, amount: 0 };
    });
  }

  async getGeneration(id: string): Promise<Generation | undefined> {
    const results = await db
      .select()
      .from(generations)
      .where(eq(generations.id, id))
      .limit(1);
    return results[0];
  }

  async getUserGenerations(userId: string): Promise<Generation[]> {
    return await db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId))
      .orderBy(desc(generations.createdAt));
  }

  async getRecentGenerations(userId: string, limit: number = 6): Promise<Generation[]> {
    return await db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId))
      .orderBy(desc(generations.createdAt))
      .limit(limit);
  }

  async getUserGenerationsPage(
    userId: string, 
    limit: number, 
    cursor?: { createdAt: Date; id: string }
  ): Promise<{ items: Generation[]; nextCursor: { createdAt: Date; id: string } | null }> {
    // Build query with cursor-based pagination
    const query = db
      .select()
      .from(generations)
      .where(
        cursor
          ? and(
              eq(generations.userId, userId),
              sql`(${generations.createdAt}, ${generations.id}) < (${cursor.createdAt}, ${cursor.id})`
            )
          : eq(generations.userId, userId)
      )
      .orderBy(desc(generations.createdAt), desc(generations.id))
      .limit(limit + 1); // Fetch one extra to determine if there's a next page

    const results = await query;
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    
    const nextCursor = hasMore && items.length > 0
      ? { createdAt: items[items.length - 1].createdAt, id: items[items.length - 1].id }
      : null;

    return { items, nextCursor };
  }

  async deleteGeneration(id: string): Promise<void> {
    await db.delete(generations).where(eq(generations.id, id));
  }

  async getUserStats(userId: string): Promise<{
    totalGenerations: number;
    todayGenerations: number;
    successRate: number;
  }> {
    const allGens = await db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayGens = allGens.filter(
      g => new Date(g.createdAt) >= today
    );

    const completed = allGens.filter(g => g.status === 'completed').length;
    const successRate = allGens.length > 0 
      ? (completed / allGens.length) * 100 
      : 0;

    return {
      totalGenerations: allGens.length,
      todayGenerations: todayGens.length,
      successRate,
    };
  }

  async getUserAnalytics(userId: string, days: number = 30): Promise<{
    totalCreditsSpent: number;
    totalGenerations: number;
    successRate: number;
    byFeatureType: Array<{ type: string; count: number; credits: number }>;
    byModel: Array<{ model: string; count: number; credits: number }>;
    dailyTrends: Array<{ date: string; credits: number; count: number }>;
  }> {
    // Get all generations for the user within the date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const allGens = await db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId));

    const recentGens = allGens.filter(
      g => new Date(g.createdAt) >= cutoffDate
    );

    // Calculate total credits spent
    const totalCreditsSpent = recentGens.reduce((sum, g) => sum + (g.creditsCost || 0), 0);

    // Calculate success rate
    const completed = recentGens.filter(g => g.status === 'completed').length;
    const successRate = recentGens.length > 0 
      ? (completed / recentGens.length) * 100 
      : 0;

    // Group by feature type
    const byFeatureTypeMap = recentGens.reduce((acc: any, g) => {
      const type = g.type || 'unknown';
      if (!acc[type]) acc[type] = { type, count: 0, credits: 0 };
      acc[type].count += 1;
      acc[type].credits += g.creditsCost || 0;
      return acc;
    }, {});
    const byFeatureType = Object.values(byFeatureTypeMap).sort((a: any, b: any) => b.credits - a.credits);

    // Group by model
    const byModelMap = recentGens.reduce((acc: any, g) => {
      const model = g.model || 'unknown';
      if (!acc[model]) acc[model] = { model, count: 0, credits: 0 };
      acc[model].count += 1;
      acc[model].credits += g.creditsCost || 0;
      return acc;
    }, {});
    const byModel = Object.values(byModelMap).sort((a: any, b: any) => b.credits - a.credits);

    // Calculate daily trends
    const dailyMap = new Map<string, { credits: number; count: number }>();
    
    // Initialize all days in range with zero
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, { credits: 0, count: 0 });
    }

    // Populate with actual data
    recentGens.forEach(g => {
      const dateStr = new Date(g.createdAt).toISOString().split('T')[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.credits += g.creditsCost || 0;
        existing.count += 1;
      }
    });

    // Convert to array and sort by date (oldest first for charts)
    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalCreditsSpent,
      totalGenerations: recentGens.length,
      successRate,
      byFeatureType: byFeatureType as any,
      byModel: byModel as any,
      dailyTrends,
    };
  }

  // Saved Seeds operations (seed library)
  async getUserSavedSeeds(userId: string): Promise<SavedSeed[]> {
    return await db
      .select()
      .from(savedSeeds)
      .where(eq(savedSeeds.userId, userId))
      .orderBy(desc(savedSeeds.createdAt));
  }

  async getSavedSeed(id: string): Promise<SavedSeed | undefined> {
    const [seed] = await db
      .select()
      .from(savedSeeds)
      .where(eq(savedSeeds.id, id));
    return seed;
  }

  async createSavedSeed(seed: InsertSavedSeed): Promise<SavedSeed> {
    const [savedSeed] = await db
      .insert(savedSeeds)
      .values(seed)
      .returning();
    return savedSeed;
  }

  async updateSavedSeed(id: string, updates: UpdateSavedSeed): Promise<SavedSeed | undefined> {
    const [seed] = await db
      .update(savedSeeds)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedSeeds.id, id))
      .returning();
    return seed;
  }

  async incrementSeedUsage(id: string): Promise<SavedSeed | undefined> {
    const [seed] = await db
      .update(savedSeeds)
      .set({ 
        usageCount: sql`${savedSeeds.usageCount} + 1`,
        updatedAt: new Date() 
      })
      .where(eq(savedSeeds.id, id))
      .returning();
    return seed;
  }

  async deleteSavedSeed(id: string): Promise<void> {
    await db.delete(savedSeeds).where(eq(savedSeeds.id, id));
  }

  // Chat operations
  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [conv] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return conv;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conv;
  }

  async updateConversationTitle(id: string, title: string): Promise<Conversation | undefined> {
    const [conv] = await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return conv;
  }

  async deleteConversation(id: string): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [msg] = await db
      .insert(messages)
      .values(message)
      .returning();
    
    // Update conversation's updatedAt timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, message.conversationId));
    
    return msg;
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  // Voice Clone operations
  async createVoiceClone(voiceClone: InsertVoiceClone): Promise<VoiceClone> {
    const [clone] = await db
      .insert(voiceClones)
      .values(voiceClone)
      .returning();
    return clone;
  }

  async getUserVoiceClones(userId: string): Promise<VoiceClone[]> {
    return await db
      .select()
      .from(voiceClones)
      .where(eq(voiceClones.userId, userId))
      .orderBy(desc(voiceClones.createdAt));
  }

  async getVoiceClone(id: string): Promise<VoiceClone | undefined> {
    const [clone] = await db
      .select()
      .from(voiceClones)
      .where(eq(voiceClones.id, id));
    return clone;
  }

  async toggleVoiceClone(id: string, isActive: boolean): Promise<VoiceClone | undefined> {
    const [clone] = await db
      .update(voiceClones)
      .set({ isActive })
      .where(eq(voiceClones.id, id))
      .returning();
    return clone;
  }

  async deleteVoiceClone(id: string): Promise<void> {
    await db.delete(voiceClones).where(eq(voiceClones.id, id));
  }

  // TTS Generation operations
  async createTtsGeneration(generation: InsertTtsGeneration): Promise<TtsGeneration> {
    const [gen] = await db
      .insert(ttsGenerations)
      .values(generation)
      .returning();
    return gen;
  }

  async updateTtsGeneration(id: string, updates: Partial<TtsGeneration>): Promise<TtsGeneration | undefined> {
    const [generation] = await db
      .update(ttsGenerations)
      .set(updates)
      .where(eq(ttsGenerations.id, id))
      .returning();
    return generation;
  }

  async getUserTtsGenerations(userId: string): Promise<TtsGeneration[]> {
    return await db
      .select()
      .from(ttsGenerations)
      .where(eq(ttsGenerations.userId, userId))
      .orderBy(desc(ttsGenerations.createdAt));
  }

  // STT Generation operations
  async createSttGeneration(generation: InsertSttGeneration): Promise<SttGeneration> {
    const [gen] = await db
      .insert(sttGenerations)
      .values(generation)
      .returning();
    return gen;
  }

  async updateSttGeneration(id: string, updates: Partial<SttGeneration>): Promise<SttGeneration | undefined> {
    const [generation] = await db
      .update(sttGenerations)
      .set(updates)
      .where(eq(sttGenerations.id, id))
      .returning();
    return generation;
  }

  async getUserSttGenerations(userId: string): Promise<SttGeneration[]> {
    return await db
      .select()
      .from(sttGenerations)
      .where(eq(sttGenerations.userId, userId))
      .orderBy(desc(sttGenerations.createdAt));
  }

  // Avatar Generation operations
  async createAvatarGeneration(generation: InsertAvatarGeneration): Promise<AvatarGeneration> {
    const [gen] = await db
      .insert(avatarGenerations)
      .values(generation)
      .returning();
    return gen;
  }

  async updateAvatarGeneration(id: string, updates: Partial<AvatarGeneration>): Promise<AvatarGeneration | undefined> {
    const [generation] = await db
      .update(avatarGenerations)
      .set(updates)
      .where(eq(avatarGenerations.id, id))
      .returning();
    return generation;
  }

  async getUserAvatarGenerations(userId: string): Promise<AvatarGeneration[]> {
    return await db
      .select()
      .from(avatarGenerations)
      .where(eq(avatarGenerations.userId, userId))
      .orderBy(desc(avatarGenerations.createdAt));
  }

  // Audio Conversion operations
  async createAudioConversion(conversion: InsertAudioConversion): Promise<AudioConversion> {
    const [conv] = await db
      .insert(audioConversions)
      .values(conversion)
      .returning();
    return conv;
  }

  async updateAudioConversion(id: string, updates: Partial<AudioConversion>): Promise<AudioConversion | undefined> {
    const [conversion] = await db
      .update(audioConversions)
      .set(updates)
      .where(eq(audioConversions.id, id))
      .returning();
    return conversion;
  }

  async getUserAudioConversions(userId: string): Promise<AudioConversion[]> {
    return await db
      .select()
      .from(audioConversions)
      .where(eq(audioConversions.userId, userId))
      .orderBy(desc(audioConversions.createdAt));
  }

  // Image Analysis operations
  async createImageAnalysis(analysis: InsertImageAnalysis): Promise<ImageAnalysis> {
    const [result] = await db
      .insert(imageAnalyses)
      .values(analysis)
      .returning();
    return result;
  }

  async updateImageAnalysis(id: string, updates: Partial<ImageAnalysis>): Promise<ImageAnalysis | undefined> {
    const [analysis] = await db
      .update(imageAnalyses)
      .set(updates)
      .where(eq(imageAnalyses.id, id))
      .returning();
    return analysis;
  }

  async getUserImageAnalyses(userId: string): Promise<ImageAnalysis[]> {
    return await db
      .select()
      .from(imageAnalyses)
      .where(eq(imageAnalyses.userId, userId))
      .orderBy(desc(imageAnalyses.createdAt));
  }

  async getImageAnalysisByIdempotencyKey(userId: string, idempotencyKey: string): Promise<ImageAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(imageAnalyses)
      .where(and(
        eq(imageAnalyses.userId, userId),
        eq(imageAnalyses.idempotencyKey, idempotencyKey)
      ));
    return analysis;
  }

  // Lyrics Generation operations
  async createLyricsGeneration(generation: InsertLyricsGeneration): Promise<LyricsGeneration> {
    const [result] = await db
      .insert(lyricsGenerations)
      .values(generation)
      .returning();
    return result;
  }

  async updateLyricsGeneration(id: string, updates: Partial<LyricsGeneration>): Promise<LyricsGeneration | undefined> {
    const [lyrics] = await db
      .update(lyricsGenerations)
      .set(updates)
      .where(eq(lyricsGenerations.id, id))
      .returning();
    return lyrics;
  }

  async finalizeLyricsGeneration(
    lyricsId: string,
    outcome: 'success' | 'failure',
    updates: Partial<LyricsGeneration>
  ): Promise<LyricsGeneration | undefined> {
    return await db.transaction(async (tx) => {
      const [lyrics] = await tx
        .select()
        .from(lyricsGenerations)
        .where(eq(lyricsGenerations.id, lyricsId))
        .for('update')
        .limit(1);

      if (!lyrics) {
        throw new Error(`Lyrics generation ${lyricsId} not found`);
      }

      if (lyrics.status === 'completed' || lyrics.status === 'failed') {
        console.log(`[finalizeLyricsGeneration] Lyrics ${lyricsId} already finalized with status: ${lyrics.status}`);
        return lyrics;
      }

      if (outcome === 'failure' && lyrics.creditsCost > 0) {
        await tx
          .update(users)
          .set({ 
            credits: sql`${users.credits} + ${lyrics.creditsCost}` 
          })
          .where(eq(users.id, lyrics.userId));

        console.log(`✓ [CREDIT REFUND] Refunded ${lyrics.creditsCost} credits to user ${lyrics.userId} for failed lyrics ${lyricsId}`);
      }

      const [updated] = await tx
        .update(lyricsGenerations)
        .set({
          ...updates,
          status: outcome === 'success' ? 'completed' : 'failed',
          completedAt: outcome === 'success' ? (updates.completedAt || new Date()) : null,
        })
        .where(eq(lyricsGenerations.id, lyricsId))
        .returning();

      return updated;
    });
  }

  async getUserLyricsGenerations(userId: string): Promise<LyricsGeneration[]> {
    return await db
      .select()
      .from(lyricsGenerations)
      .where(eq(lyricsGenerations.userId, userId))
      .orderBy(desc(lyricsGenerations.createdAt));
  }

  // Video Combination operations
  async createVideoCombination(combination: InsertVideoCombination): Promise<VideoCombination> {
    const [result] = await db
      .insert(videoCombinations)
      .values(combination)
      .returning();
    return result;
  }

  async updateVideoCombination(id: string, updates: Partial<VideoCombination>): Promise<VideoCombination | undefined> {
    const [combination] = await db
      .update(videoCombinations)
      .set(updates)
      .where(eq(videoCombinations.id, id))
      .returning();
    return combination;
  }

  async getUserVideoCombinations(userId: string): Promise<VideoCombination[]> {
    return await db
      .select()
      .from(videoCombinations)
      .where(eq(videoCombinations.userId, userId))
      .orderBy(desc(videoCombinations.createdAt));
  }

  async getVideoCombinationById(id: string): Promise<VideoCombination | undefined> {
    const [combination] = await db
      .select()
      .from(videoCombinations)
      .where(eq(videoCombinations.id, id));
    return combination;
  }

  async createVideoCombinationEvent(event: InsertVideoCombinationEvent): Promise<VideoCombinationEvent> {
    const [result] = await db
      .insert(videoCombinationEvents)
      .values(event)
      .returning();
    return result;
  }

  async getVideoCombinationEvents(combinationId: string): Promise<VideoCombinationEvent[]> {
    return await db
      .select()
      .from(videoCombinationEvents)
      .where(eq(videoCombinationEvents.combinationId, combinationId))
      .orderBy(desc(videoCombinationEvents.createdAt));
  }

  // Subscription Plan operations
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);
  }

  async getPlanById(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async createPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await db
      .insert(subscriptionPlans)
      .values(plan)
      .returning();
    return created;
  }

  async updatePlan(planId: string, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db
      .update(subscriptionPlans)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPlans.id, planId))
      .returning();
    return updated;
  }

  async updatePlanStripeIds(planId: string, stripePriceId: string | null, stripeProductId: string | null): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db
      .update(subscriptionPlans)
      .set({
        stripePriceId: stripePriceId || null,
        stripeProductId: stripeProductId || null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPlans.id, planId))
      .returning();
    return updated;
  }

  async checkPlanInUse(planId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.planId, planId))
      .limit(1);
    return result.length > 0;
  }

  // Home Page Content operations
  async getHomePageContent(): Promise<HomePageContent | undefined> {
    const [content] = await db
      .select()
      .from(homePageContent)
      .where(eq(homePageContent.id, 'homepage'));
    return content;
  }

  async updateHomePageContent(updates: Partial<HomePageContent>): Promise<HomePageContent | undefined> {
    // First, try to get existing content
    const existing = await this.getHomePageContent();
    
    if (existing) {
      // Update existing content
      const [updated] = await db
        .update(homePageContent)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(homePageContent.id, 'homepage'))
        .returning();
      return updated;
    } else {
      // Insert new content with defaults
      const [inserted] = await db
        .insert(homePageContent)
        .values({
          id: 'homepage',
          ...updates,
        } as any)
        .returning();
      return inserted;
    }
  }

  async deletePlan(planId: string): Promise<{ success: boolean; error?: string }> {
    // Check if plan is in use
    const inUse = await this.checkPlanInUse(planId);
    if (inUse) {
      return {
        success: false,
        error: 'Cannot delete plan with active subscriptions'
      };
    }

    // Soft delete by setting isActive to false
    await db
      .update(subscriptionPlans)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPlans.id, planId));

    return { success: true };
  }

  async getUserSubscription(userId: string): Promise<(UserSubscription & { plan: SubscriptionPlan }) | undefined> {
    const result = await db
      .select()
      .from(userSubscriptions)
      .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(eq(userSubscriptions.userId, userId));
    
    if (!result || result.length === 0 || !result[0].user_subscriptions || !result[0].subscription_plans) {
      return undefined;
    }

    return {
      ...result[0].user_subscriptions,
      plan: result[0].subscription_plans,
    };
  }

  async getUsersWithSubscriptions(): Promise<Array<User & { subscription: (UserSubscription & { plan: SubscriptionPlan }) | null }>> {
    const result = await db
      .select()
      .from(users)
      .leftJoin(userSubscriptions, eq(users.id, userSubscriptions.userId))
      .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .orderBy(desc(users.createdAt));

    return result.map(row => ({
      ...row.users,
      subscription: row.user_subscriptions && row.subscription_plans 
        ? {
            ...row.user_subscriptions,
            plan: row.subscription_plans,
          }
        : null,
    }));
  }

  async upsertUserSubscription(data: InsertUserSubscription): Promise<UserSubscription> {
    // Check if user already has a subscription
    const existing = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, data.userId));

    if (existing && existing.length > 0) {
      // Update existing subscription
      const [updated] = await db
        .update(userSubscriptions)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.userId, data.userId))
        .returning();
      return updated;
    } else {
      // Create new subscription
      const [created] = await db
        .insert(userSubscriptions)
        .values(data)
        .returning();
      return created;
    }
  }

  async removeUserSubscription(userId: string): Promise<void> {
    await db
      .delete(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId));
  }

  async assignPlanToUser(userId: string, planId: string): Promise<{ subscription: UserSubscription; creditsGranted: number }> {
    return await db.transaction(async (tx) => {
      // All queries must use tx handle for transaction isolation
      
      // Get plan details using tx
      const [plan] = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId));
      
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Get current user using tx
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        throw new Error('User not found');
      }

      // Get existing subscription using tx
      const [existingSub] = await tx
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId));

      // Calculate credit adjustment
      const previouslyGranted = existingSub?.creditsGrantedThisPeriod || 0;
      const creditAdjustment = plan.creditsPerMonth - previouslyGranted;

      // Calculate period based on plan type
      const now = new Date();
      const periodEnd = new Date(now);
      
      // For trial plans, use trial days; otherwise use 30 days
      if (plan.billingPeriod === 'trial' && plan.trialDays) {
        periodEnd.setDate(periodEnd.getDate() + plan.trialDays);
      } else {
        periodEnd.setDate(periodEnd.getDate() + 30);
      }

      // Update or create subscription
      let subscription: UserSubscription;
      if (existingSub) {
        const [updated] = await tx
          .update(userSubscriptions)
          .set({
            planId,
            stripeSubscriptionId: null,
            stripeCustomerId: null,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            creditsGrantedThisPeriod: plan.creditsPerMonth,
            updatedAt: new Date(),
          })
          .where(eq(userSubscriptions.userId, userId))
          .returning();
        subscription = updated;
      } else {
        const [created] = await tx
          .insert(userSubscriptions)
          .values({
            userId,
            planId,
            stripeSubscriptionId: null,
            stripeCustomerId: null,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            creditsGrantedThisPeriod: plan.creditsPerMonth,
          })
          .returning();
        subscription = created;
      }

      // Update user credits atomically with proper parameterization
      if (creditAdjustment !== 0) {
        // Fetch current credits within transaction
        const currentCredits = user.credits || 0;
        const newCredits = Math.max(0, currentCredits + creditAdjustment);
        
        await tx
          .update(users)
          .set({ credits: newCredits })
          .where(eq(users.id, userId));
      }

      return { subscription, creditsGranted: creditAdjustment };
    });
  }

  // Stripe Event operations (for webhook idempotency)
  async getStripeEventById(eventId: string): Promise<StripeEvent | undefined> {
    const [event] = await db.select().from(stripeEvents).where(eq(stripeEvents.eventId, eventId));
    return event;
  }

  async createStripeEvent(event: InsertStripeEvent): Promise<void> {
    try {
      await db.insert(stripeEvents).values(event);
    } catch (error: any) {
      // Ignore unique constraint violations (duplicate events are expected during retries)
      if (!error.message?.includes('unique constraint') && !error.code?.includes('23505')) {
        throw error;
      }
      console.log(`[Storage] Stripe event ${event.eventId} already exists (expected for idempotency)`);
    }
  }

  // Announcement operations
  async getAllAnnouncements(): Promise<Announcement[]> {
    return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async getActiveAnnouncements(userPlanName?: string): Promise<Announcement[]> {
    const now = new Date();
    
    // Build conditions
    const conditions = [
      eq(announcements.isActive, true),
    ];

    // Add date range filter (announcement is active if it's between startDate and endDate, or no dates set)
    const result = await db
      .select()
      .from(announcements)
      .where(and(...conditions))
      .orderBy(desc(announcements.createdAt));

    // Filter by date range and target plans in application code
    return result.filter(announcement => {
      // Check if announcement is within date range
      if (announcement.startDate && new Date(announcement.startDate) > now) {
        return false;
      }
      if (announcement.endDate && new Date(announcement.endDate) < now) {
        return false;
      }

      // Check if announcement targets this user's plan
      if (announcement.targetPlans && announcement.targetPlans.length > 0) {
        if (!userPlanName) return false; // No plan specified, but announcement has plan targeting
        return announcement.targetPlans.includes(userPlanName);
      }

      // No plan targeting, show to all users
      return true;
    });
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const [created] = await db.insert(announcements).values(announcement).returning();
    return created;
  }

  async updateAnnouncement(id: string, updates: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const [updated] = await db
      .update(announcements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();
    return updated;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  // Favorite Workflow operations
  async addFavoriteWorkflow(userId: string, workflowId: number, workflowTitle: string): Promise<FavoriteWorkflow> {
    const [favorite] = await db
      .insert(favoriteWorkflows)
      .values({ userId, workflowId, workflowTitle })
      .onConflictDoNothing()
      .returning();
    
    // If conflict occurred (favorite already exists), fetch and return it
    if (!favorite) {
      const [existing] = await db
        .select()
        .from(favoriteWorkflows)
        .where(and(
          eq(favoriteWorkflows.userId, userId),
          eq(favoriteWorkflows.workflowId, workflowId)
        ))
        .limit(1);
      return existing;
    }
    
    return favorite;
  }

  async removeFavoriteWorkflow(userId: string, workflowId: number): Promise<void> {
    await db
      .delete(favoriteWorkflows)
      .where(and(
        eq(favoriteWorkflows.userId, userId),
        eq(favoriteWorkflows.workflowId, workflowId)
      ));
  }

  async getUserFavoriteWorkflows(userId: string): Promise<FavoriteWorkflow[]> {
    return await db
      .select()
      .from(favoriteWorkflows)
      .where(eq(favoriteWorkflows.userId, userId))
      .orderBy(desc(favoriteWorkflows.createdAt));
  }

  async isFavoriteWorkflow(userId: string, workflowId: number): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(favoriteWorkflows)
      .where(and(
        eq(favoriteWorkflows.userId, userId),
        eq(favoriteWorkflows.workflowId, workflowId)
      ))
      .limit(1);
    return !!favorite;
  }

  // Generation Template operations
  async createTemplate(template: InsertGenerationTemplate): Promise<GenerationTemplate> {
    const [newTemplate] = await db
      .insert(generationTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async getTemplate(id: string): Promise<GenerationTemplate | undefined> {
    const [template] = await db
      .select()
      .from(generationTemplates)
      .where(eq(generationTemplates.id, id))
      .limit(1);
    return template;
  }

  async getUserTemplates(userId: string, featureType?: string): Promise<GenerationTemplate[]> {
    const conditions = [eq(generationTemplates.userId, userId)];
    if (featureType) {
      conditions.push(eq(generationTemplates.featureType, featureType));
    }
    return db
      .select()
      .from(generationTemplates)
      .where(and(...conditions))
      .orderBy(desc(generationTemplates.createdAt));
  }

  async getPublicTemplates(featureType?: string): Promise<GenerationTemplate[]> {
    const conditions = [eq(generationTemplates.isPublic, true)];
    if (featureType) {
      conditions.push(eq(generationTemplates.featureType, featureType));
    }
    return db
      .select()
      .from(generationTemplates)
      .where(and(...conditions))
      .orderBy(desc(generationTemplates.usageCount));
  }

  async updateTemplate(id: string, updates: Partial<InsertGenerationTemplate>): Promise<GenerationTemplate | undefined> {
    const [updated] = await db
      .update(generationTemplates)
      .set(updates)
      .where(eq(generationTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db
      .delete(generationTemplates)
      .where(eq(generationTemplates.id, id));
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await db
      .update(generationTemplates)
      .set({ usageCount: sql`${generationTemplates.usageCount} + 1` })
      .where(eq(generationTemplates.id, id));
  }

  // Onboarding operations
  async getOrCreateOnboarding(userId: string): Promise<UserOnboarding> {
    // Try to get existing onboarding record
    const [existing] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId));

    if (existing) {
      return existing;
    }

    // Create new onboarding record with all steps incomplete
    const [created] = await db
      .insert(userOnboarding)
      .values({ userId })
      .returning();
    
    return created;
  }

  async updateOnboarding(userId: string, updates: UpdateUserOnboarding): Promise<UserOnboarding | undefined> {
    const [updated] = await db
      .update(userOnboarding)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, userId))
      .returning();
    
    return updated;
  }

  // Referral operations
  async getUserReferralCode(userId: string): Promise<string> {
    const startTime = Date.now();
    
    // Check if user already has a referral code
    const [user] = await db
      .select({ referralCode: users.referralCode })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.referralCode) {
      const { referralLogger } = await import('./logger');
      referralLogger.codeRetrieved(Date.now() - startTime);
      return user.referralCode;
    }

    // Generate a unique referral code (8 character alphanumeric)
    const generateCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();
    let code = generateCode();
    let attempts = 0;

    // Ensure uniqueness
    while (attempts < 10) {
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.referralCode, code))
        .limit(1);

      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    // Update user with the new code
    await db
      .update(users)
      .set({ referralCode: code })
      .where(eq(users.id, userId));

    const { referralLogger } = await import('./logger');
    referralLogger.codeGenerated(code.length, Date.now() - startTime);
    return code;
  }

  async createReferralClick(referralCode: string, refereeEmail?: string): Promise<Referral> {
    const startTime = Date.now();
    
    // Find the referrer by code
    const [referrer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, referralCode))
      .limit(1);

    if (!referrer) {
      const { referralLogger } = await import('./logger');
      referralLogger.error('createReferralClick', new Error('Invalid referral code'), { referralCodeLength: referralCode.length });
      throw new Error('Invalid referral code');
    }

    try {
      // Create referral record
      const [referral] = await db
        .insert(referrals)
        .values({
          referrerId: referrer.id,
          referralCode,
          refereeEmail,
          status: 'pending',
        })
        .returning();

      const { referralLogger } = await import('./logger');
      referralLogger.clickTracked(referral.id, !!refereeEmail, Date.now() - startTime);
      return referral;
    } catch (error: any) {
      // Handle duplicate entries gracefully (unique constraint violation)
      if (error?.code === '23505') {
        const { referralLogger } = await import('./logger');
        referralLogger.clickDuplicate(referralCode.length);
        // Return existing referral instead of throwing
        const [existing] = await db
          .select()
          .from(referrals)
          .where(
            and(
              eq(referrals.referralCode, referralCode),
              eq(referrals.refereeEmail, refereeEmail || '')
            )
          )
          .limit(1);
        return existing;
      }
      throw error;
    }
  }

  async convertReferral(referralCode: string, refereeId: string): Promise<{ referrerCredits: number; refereeCredits: number }> {
    const REFERRER_BONUS = 1000; // Credits for the referrer
    const REFEREE_BONUS = 500;   // Credits for the referee
    const startTime = Date.now();
    const transactionId = Math.random().toString(36).substring(2, 9);
    
    const result = await db.transaction(async (tx) => {
      // Find and lock the most recent pending referral for this code
      // FOR UPDATE ensures only one transaction can convert this referral
      const [referral] = await tx
        .select()
        .from(referrals)
        .where(
          and(
            eq(referrals.referralCode, referralCode),
            eq(referrals.status, 'pending')
          )
        )
        .orderBy(desc(referrals.createdAt))
        .limit(1)
        .for('update');

      if (!referral) {
        return { referrerCredits: 0, refereeCredits: 0, referralId: null };
      }

      // Update the referral record with status guard to ensure idempotency
      // If another transaction already converted this, the WHERE clause will match 0 rows
      const updatedReferrals = await tx
        .update(referrals)
        .set({
          refereeId,
          status: 'credited',
          referrerCreditsEarned: REFERRER_BONUS,
          refereeCreditsGiven: REFEREE_BONUS,
          convertedAt: new Date(),
          creditedAt: new Date(),
        })
        .where(
          and(
            eq(referrals.id, referral.id),
            eq(referrals.status, 'pending') // Double-check status hasn't changed
          )
        )
        .returning();

      // If update affected no rows, another transaction already credited this referral
      if (!updatedReferrals || updatedReferrals.length === 0) {
        return { referrerCredits: 0, refereeCredits: 0, referralId: referral.id };
      }

      // Grant credits to referrer
      await tx
        .update(users)
        .set({ credits: sql`${users.credits} + ${REFERRER_BONUS}` })
        .where(eq(users.id, referral.referrerId));

      // Grant credits to referee
      await tx
        .update(users)
        .set({ 
          credits: sql`${users.credits} + ${REFEREE_BONUS}`,
          referredBy: referral.referrerId,
        })
        .where(eq(users.id, refereeId));

      return { 
        referrerCredits: REFERRER_BONUS, 
        refereeCredits: REFEREE_BONUS,
        referralId: referral.id,
      };
    });

    // Log after transaction completes to avoid extending lock time
    const { referralLogger } = await import('./logger');
    const duration = Date.now() - startTime;
    
    if (result.referrerCredits === 0 && result.refereeCredits === 0) {
      if (result.referralId) {
        referralLogger.conversionRaceDetected(result.referralId, transactionId, duration);
      } else {
        referralLogger.conversionNotFound(referralCode.length, transactionId, duration);
      }
    } else if (result.referralId) {
      referralLogger.conversionSuccess(
        result.referralId,
        transactionId,
        result.referrerCredits,
        result.refereeCredits,
        duration
      );
    }

    return { 
      referrerCredits: result.referrerCredits, 
      refereeCredits: result.refereeCredits 
    };
  }

  async getUserReferralStats(userId: string): Promise<{
    totalReferrals: number;
    convertedReferrals: number;
    pendingReferrals: number;
    totalCreditsEarned: number;
    referrals: Referral[];
  }> {
    const userReferrals = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, userId))
      .orderBy(desc(referrals.createdAt));

    const convertedReferrals = userReferrals.filter(r => r.status === 'credited');
    const pendingReferrals = userReferrals.filter(r => r.status === 'pending');
    const totalCreditsEarned = convertedReferrals.reduce((sum, r) => sum + r.referrerCreditsEarned, 0);

    return {
      totalReferrals: userReferrals.length,
      convertedReferrals: convertedReferrals.length,
      pendingReferrals: pendingReferrals.length,
      totalCreditsEarned,
      referrals: userReferrals,
    };
  }

  async getReferralLeaderboard(limit = 10): Promise<Array<{
    userId: string;
    userName: string;
    profileImageUrl: string | null;
    totalReferrals: number;
    totalCreditsEarned: number;
  }>> {
    // Get aggregated referral stats per user
    const leaderboard = await db
      .select({
        userId: referrals.referrerId,
        totalReferrals: sql<number>`count(*)::int`,
        totalCreditsEarned: sql<number>`COALESCE(sum(${referrals.referrerCreditsEarned}), 0)::int`,
      })
      .from(referrals)
      .where(eq(referrals.status, 'credited'))
      .groupBy(referrals.referrerId)
      .orderBy(sql`sum(${referrals.referrerCreditsEarned}) DESC`)
      .limit(limit);

    // Join with user data
    const result = await Promise.all(
      leaderboard.map(async (entry) => {
        const [user] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(eq(users.id, entry.userId))
          .limit(1);

        return {
          userId: entry.userId,
          userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous',
          profileImageUrl: user?.profileImageUrl || null,
          totalReferrals: entry.totalReferrals,
          totalCreditsEarned: entry.totalCreditsEarned,
        };
      })
    );

    return result;
  }
}

export const storage = new DatabaseStorage();
