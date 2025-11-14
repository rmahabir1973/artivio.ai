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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if user already exists
    const existingUser = await this.getUser(userData.id as string);
    
    if (existingUser) {
      // User exists - only update OAuth profile fields, preserve isAdmin and stripeCustomerId
      const [updatedUser] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id as string))
        .returning();
      
      return updatedUser;
    } else {
      // New user - insert with defaults
      const [newUser] = await db
        .insert(users)
        .values(userData)
        .returning();
      
      return newUser;
    }
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
}

export const storage = new DatabaseStorage();
