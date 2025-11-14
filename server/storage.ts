import {
  users,
  apiKeys,
  generations,
  type User,
  type UpsertUser,
  type ApiKey,
  type InsertApiKey,
  type Generation,
  type InsertGeneration,
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
  deleteUser(userId: string): Promise<void>;

  // API Key operations (round-robin system)
  getAllApiKeys(): Promise<ApiKey[]>;
  getActiveApiKeys(): Promise<ApiKey[]>;
  getNextApiKey(): Promise<ApiKey | undefined>;
  updateApiKeyUsage(keyId: string): Promise<void>;
  addApiKey(key: InsertApiKey): Promise<ApiKey>;
  toggleApiKey(keyId: string, isActive: boolean): Promise<ApiKey | undefined>;

  // Generation operations
  createGeneration(generation: InsertGeneration): Promise<Generation>;
  updateGeneration(id: string, updates: Partial<Generation>): Promise<Generation | undefined>;
  getUserGenerations(userId: string): Promise<Generation[]>;
  getRecentGenerations(userId: string, limit?: number): Promise<Generation[]>;
  getUserStats(userId: string): Promise<{
    totalGenerations: number;
    todayGenerations: number;
    successRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Try to insert, and on conflict with either id or email, update the existing record
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
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

  // Generation operations
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
}

export const storage = new DatabaseStorage();
