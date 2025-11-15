import {
  users,
  apiKeys,
  pricing,
  generations,
  conversations,
  messages,
  voiceClones,
  ttsGenerations,
  sttGenerations,
  avatarGenerations,
  audioConversions,
  imageAnalyses,
  videoCombinations,
  videoCombinationEvents,
  subscriptionPlans,
  userSubscriptions,
  stripeEvents,
  homePageContent,
  type User,
  type UpsertUser,
  type ApiKey,
  type InsertApiKey,
  type Pricing,
  type InsertPricing,
  type UpdatePricing,
  type Generation,
  type InsertGeneration,
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

  // Generation operations
  getAllGenerations(): Promise<Generation[]>;
  createGeneration(generation: InsertGeneration): Promise<Generation>;
  updateGeneration(id: string, updates: Partial<Generation>): Promise<Generation | undefined>;
  finalizeGeneration(
    generationId: string, 
    outcome: 'success' | 'failure',
    updates: Partial<Generation>
  ): Promise<Generation | undefined>;
  getUserGenerations(userId: string): Promise<Generation[]>;
  getRecentGenerations(userId: string, limit?: number): Promise<Generation[]>;
  getUserStats(userId: string): Promise<{
    totalGenerations: number;
    todayGenerations: number;
    successRate: number;
  }>;

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
    const [generation] = await db
      .update(generations)
      .set(updates)
      .where(eq(generations.id, id))
      .returning();
    return generation;
  }

  /**
   * Atomically finalize a generation (success or failure) with automatic credit refunds on failure.
   * This function is idempotent - safe to call multiple times (e.g., from webhook retries).
   */
  async finalizeGeneration(
    generationId: string,
    outcome: 'success' | 'failure',
    updates: Partial<Generation>
  ): Promise<Generation | undefined> {
    return await db.transaction(async (tx) => {
      // Lock the generation row to prevent concurrent updates
      const [generation] = await tx
        .select()
        .from(generations)
        .where(eq(generations.id, generationId))
        .for('update')
        .limit(1);

      if (!generation) {
        throw new Error(`Generation ${generationId} not found`);
      }

      // If already in terminal state, return existing record (idempotent)
      if (generation.status === 'completed' || generation.status === 'failed') {
        console.log(`[finalizeGeneration] Generation ${generationId} already finalized with status: ${generation.status}`);
        return generation;
      }

      // If failure, refund credits atomically
      if (outcome === 'failure' && generation.creditsCost > 0) {
        await tx
          .update(users)
          .set({ 
            credits: sql`${users.credits} + ${generation.creditsCost}` 
          })
          .where(eq(users.id, generation.userId));

        console.log(`✓ [CREDIT REFUND] Refunded ${generation.creditsCost} credits to user ${generation.userId} for failed generation ${generationId}`);
      }

      // Update generation status
      const [updated] = await tx
        .update(generations)
        .set({
          ...updates,
          status: outcome === 'success' ? 'completed' : 'failed',
          completedAt: new Date(),
        })
        .where(eq(generations.id, generationId))
        .returning();

      if (!updated) {
        throw new Error(`Failed to update generation ${generationId}`);
      }

      console.log(`✓ [finalizeGeneration] Generation ${generationId} finalized as ${outcome}`);
      return updated;
    });
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
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
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
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
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
}

export const storage = new DatabaseStorage();
