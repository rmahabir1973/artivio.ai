import {
  users,
  apiKeys,
  publicApiKeys,
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
  collections,
  tags,
  generationTags,
  videoProjects,
  brandKits,
  projectCollaborators,
  storyProjects,
  storyProjectSegments,
  type User,
  type UpsertUser,
  type Referral,
  type InsertReferral,
  type ApiKey,
  type InsertApiKey,
  type PublicApiKey,
  type InsertPublicApiKey,
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
  type Collection,
  type InsertCollection,
  type UpdateCollection,
  type Tag,
  type InsertTag,
  type UpdateTag,
  type VideoProject,
  type InsertVideoProject,
  type BrandKit,
  type InsertBrandKit,
  type ProjectCollaborator,
  type InsertProjectCollaborator,
  type StoryProject,
  type InsertStoryProject,
  type UpdateStoryProject,
  type StoryProjectSegment,
  type InsertStoryProjectSegment,
  type UpdateStoryProjectSegment,
  blogPosts,
  type BlogPost,
  type InsertBlogPost,
  type UpdateBlogPost,
  savedStockImages,
  type SavedStockImage,
  type InsertSavedStockImage,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql, inArray, ilike, or, asc, isNotNull } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserCredits(userId: string, credits: number): Promise<User | undefined>;
  deductCreditsAtomic(userId: string, cost: number): Promise<User | null>;
  addCreditsAtomic(userId: string, amount: number): Promise<User | undefined>;
  deleteUser(userId: string): Promise<void>;
  updateUser(userId: string, updates: Partial<User>): Promise<User | undefined>;

  // API Key operations (round-robin system)
  getAllApiKeys(): Promise<ApiKey[]>;
  getActiveApiKeys(): Promise<ApiKey[]>;
  getNextApiKey(): Promise<ApiKey | undefined>;
  updateApiKeyUsage(keyId: string): Promise<void>;
  addApiKey(key: InsertApiKey): Promise<ApiKey>;
  toggleApiKey(keyId: string, isActive: boolean): Promise<ApiKey | undefined>;
  deleteApiKey(keyId: string): Promise<void>;

  // Public API Key operations (for Tasklet/external integrations)
  getPublicApiKeyByHash(keyHash: string): Promise<PublicApiKey | undefined>;
  getUserPublicApiKeys(userId: string): Promise<PublicApiKey[]>;
  createPublicApiKey(key: InsertPublicApiKey): Promise<PublicApiKey>;
  updatePublicApiKeyUsage(keyId: string): Promise<void>;
  revokePublicApiKey(keyId: string): Promise<void>;
  deletePublicApiKey(keyId: string): Promise<void>;

  // Pricing operations
  getAllPricing(): Promise<Pricing[]>;
  getPricingByModel(model: string): Promise<Pricing | undefined>;
  getPricingById(id: string): Promise<Pricing | undefined>;
  createPricing(pricing: InsertPricing): Promise<Pricing>;
  updatePricing(id: string, updates: UpdatePricing): Promise<Pricing | undefined>;
  deletePricing(id: string): Promise<boolean>;

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
  getUserGenerationsPage(userId: string, limit: number, cursor?: { createdAt: Date; id: string }, typeFilter?: string, completedOnly?: boolean): Promise<{ items: Generation[]; nextCursor: { createdAt: Date; id: string } | null }>;
  getGenerationsByCollection(collectionId: string): Promise<Generation[]>;
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
  deleteLyricsGeneration(id: string): Promise<boolean>;

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
  resetPlans(): Promise<{ plans: SubscriptionPlan[]; plansCreated: number; plansDeleted: number }>;

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

  // Collections operations
  getCollections(userId: string): Promise<Collection[]>;
  getCollection(id: string): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(id: string, updates: UpdateCollection): Promise<Collection | undefined>;
  deleteCollection(id: string): Promise<void>;

  // Tags operations
  getTags(userId: string): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, updates: UpdateTag): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<void>;

  // Generation-Tag operations
  getGenerationTags(generationId: string): Promise<Tag[]>;
  addGenerationTag(generationId: string, tagId: string): Promise<void>;
  removeGenerationTag(generationId: string, tagId: string): Promise<void>;

  // Bulk operations
  bulkMoveToCollection(generationIds: string[], collectionId: string | null): Promise<void>;
  bulkToggleFavorite(generationIds: string[], isFavorite: boolean): Promise<void>;
  bulkArchive(generationIds: string[], archive: boolean): Promise<void>;
  bulkDelete(generationIds: string[]): Promise<void>;
  bulkAddTag(generationIds: string[], tagId: string): Promise<void>;
  bulkRemoveTag(generationIds: string[], tagId: string): Promise<void>;

  // Video Project operations
  createVideoProject(project: InsertVideoProject): Promise<VideoProject>;
  getVideoProject(id: string): Promise<VideoProject | undefined>;
  getUserOwnedProjects(userId: string): Promise<VideoProject[]>;
  getUserAccessibleProjects(userId: string): Promise<VideoProject[]>;
  updateVideoProject(id: string, data: Partial<InsertVideoProject>): Promise<VideoProject | undefined>;
  deleteVideoProject(id: string): Promise<boolean>;
  getTemplateProjects(): Promise<VideoProject[]>;
  cloneVideoProject(projectId: string, newOwnerId: string, newTitle: string): Promise<VideoProject>;

  // Brand Kit operations
  getBrandKit(userId: string): Promise<BrandKit>;
  upsertBrandKit(userId: string, data: Partial<InsertBrandKit>): Promise<BrandKit>;

  // Project Collaborator operations
  addProjectCollaborator(data: InsertProjectCollaborator): Promise<ProjectCollaborator>;
  getProjectCollaborators(projectId: string): Promise<ProjectCollaborator[]>;
  updateCollaboratorRole(projectId: string, userId: string, role: string): Promise<ProjectCollaborator | undefined>;
  removeProjectCollaborator(projectId: string, userId: string): Promise<boolean>;
  checkProjectAccess(projectId: string, userId: string): Promise<{ hasAccess: boolean; role: string | null }>;

  // Story Studio Project operations
  createStoryProject(project: InsertStoryProject): Promise<StoryProject>;
  getStoryProject(id: string): Promise<StoryProject | undefined>;
  getUserStoryProjects(userId: string): Promise<StoryProject[]>;
  updateStoryProject(id: string, updates: UpdateStoryProject): Promise<StoryProject | undefined>;
  deleteStoryProject(id: string): Promise<boolean>;

  // Story Project Segment operations
  createStorySegment(segment: InsertStoryProjectSegment): Promise<StoryProjectSegment>;
  getProjectSegments(projectId: string): Promise<StoryProjectSegment[]>;
  getStorySegment(id: string): Promise<StoryProjectSegment | undefined>;
  updateStorySegment(id: string, updates: UpdateStoryProjectSegment): Promise<StoryProjectSegment | undefined>;
  deleteStorySegment(id: string): Promise<boolean>;
  reorderProjectSegments(projectId: string, segmentIds: string[]): Promise<void>;
  createBulkSegments(segments: InsertStoryProjectSegment[]): Promise<StoryProjectSegment[]>;

  // Blog Post operations (public content)
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  getBlogPostById(id: string): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getPublishedBlogPosts(options: { 
    page?: number; 
    limit?: number; 
    category?: string; 
    sortBy?: 'latest' | 'oldest' | 'popular';
  }): Promise<{ posts: BlogPost[]; total: number; totalPages: number }>;
  getAllBlogPosts(): Promise<BlogPost[]>;
  updateBlogPost(id: string, updates: UpdateBlogPost): Promise<BlogPost | undefined>;
  deleteBlogPost(id: string): Promise<boolean>;
  incrementBlogPostViews(id: string): Promise<void>;
  searchBlogPosts(query: string): Promise<BlogPost[]>;
  getBlogTags(): Promise<{ tag: string; count: number }[]>;
  getRelatedBlogPosts(category: string, excludeId: string, limit?: number): Promise<BlogPost[]>;

  // Stock Photos operations
  saveStockImage(image: InsertSavedStockImage): Promise<SavedStockImage>;
  getSavedStockImages(userId: string, limit?: number, offset?: number): Promise<SavedStockImage[]>;
  countSavedStockImages(userId: string): Promise<number>;
  deleteSavedStockImage(id: string, userId: string): Promise<boolean>;
  checkSavedStockImages(userId: string, images: Array<{ source: string; externalId: string }>): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
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

  async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
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

  // Public API Key operations (for Tasklet/external integrations)
  async getPublicApiKeyByHash(keyHash: string): Promise<PublicApiKey | undefined> {
    const [key] = await db
      .select()
      .from(publicApiKeys)
      .where(and(eq(publicApiKeys.keyHash, keyHash), eq(publicApiKeys.isActive, true)));
    return key;
  }

  async getUserPublicApiKeys(userId: string): Promise<PublicApiKey[]> {
    return await db
      .select()
      .from(publicApiKeys)
      .where(eq(publicApiKeys.userId, userId))
      .orderBy(desc(publicApiKeys.createdAt));
  }

  async createPublicApiKey(key: InsertPublicApiKey): Promise<PublicApiKey> {
    const [apiKey] = await db.insert(publicApiKeys).values(key).returning();
    return apiKey;
  }

  async updatePublicApiKeyUsage(keyId: string): Promise<void> {
    await db
      .update(publicApiKeys)
      .set({
        usageCount: sql`${publicApiKeys.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(publicApiKeys.id, keyId));
  }

  async revokePublicApiKey(keyId: string): Promise<void> {
    await db
      .update(publicApiKeys)
      .set({ isActive: false })
      .where(eq(publicApiKeys.id, keyId));
  }

  async deletePublicApiKey(keyId: string): Promise<void> {
    await db.delete(publicApiKeys).where(eq(publicApiKeys.id, keyId));
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

  async deletePricing(id: string): Promise<boolean> {
    const result = await db
      .delete(pricing)
      .where(eq(pricing.id, id))
      .returning();
    return result.length > 0;
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
          boostEnabled: economics.boostEnabled ?? false,
          boostCredits: economics.boostCredits ?? 300,
          boostPriceUsd: economics.boostPriceUsd ?? 1500,
          boostStripeProductId: economics.boostStripeProductId ?? null,
          boostStripePriceId: economics.boostStripePriceId ?? null,
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
    // Build update object with only provided fields
    const updateObj: any = {};
    
    // Map all potential fields
    const fieldMap: Record<string, keyof typeof updates> = {
      'isShowcase': 'isShowcase',
      'status': 'status',
      'resultUrl': 'resultUrl',
      'resultUrls': 'resultUrls',
      'statusDetail': 'statusDetail',
      'errorMessage': 'errorMessage',
      'completedAt': 'completedAt',
      'processingStage': 'processingStage',
      'thumbnailUrl': 'thumbnailUrl',
      'externalTaskId': 'externalTaskId',
      'parameters': 'parameters',
      'seed': 'seed',
      'isFavorite': 'isFavorite',
      'isArchived': 'isArchived',
      'collectionId': 'collectionId',
    };
    
    for (const [key, updateKey] of Object.entries(fieldMap)) {
      if (updateKey in updates) {
        updateObj[key] = updates[updateKey as keyof typeof updates];
      }
    }
    
    // If no fields to update, return the existing generation
    if (Object.keys(updateObj).length === 0) {
      return await this.getGeneration(id);
    }

    const results = await db
      .update(generations)
      .set(updateObj)
      .where(eq(generations.id, id))
      .returning();
    
    return results?.[0];
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
    cursor?: { createdAt: Date; id: string },
    typeFilter?: string, // Optional type filter: 'video', 'image', 'music', 'audio'
    completedOnly?: boolean // When true, only return completed generations with resultUrl
  ): Promise<{ items: Generation[]; nextCursor: { createdAt: Date; id: string } | null }> {
    // Build conditions array for the where clause
    const conditions: any[] = [eq(generations.userId, userId)];
    
    // When completedOnly is true, only return completed generations with a result URL
    if (completedOnly) {
      conditions.push(eq(generations.status, 'completed'));
      conditions.push(isNotNull(generations.resultUrl));
    }
    
    // Add cursor condition for pagination
    if (cursor) {
      conditions.push(
        sql`(${generations.createdAt}, ${generations.id}) < (${cursor.createdAt}, ${cursor.id})`
      );
    }
    
    // Add type filter condition if provided
    if (typeFilter && typeFilter !== 'all') {
      conditions.push(eq(generations.type, typeFilter));
    }
    
    // Build query with cursor-based pagination and optional type filter
    const query = db
      .select()
      .from(generations)
      .where(and(...conditions))
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

  async getGenerationsByCollection(collectionId: string): Promise<Generation[]> {
    return await db
      .select()
      .from(generations)
      .where(eq(generations.collectionId, collectionId))
      .orderBy(desc(generations.createdAt));
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

  async deleteLyricsGeneration(id: string): Promise<boolean> {
    const result = await db
      .delete(lyricsGenerations)
      .where(eq(lyricsGenerations.id, id))
      .returning();
    return result.length > 0;
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

  async resetPlans(): Promise<{ plans: SubscriptionPlan[]; plansCreated: number; plansDeleted: number; usersMigrated: number }> {
    const { defaultPlans } = await import('./seedPlans');
    
    return await db.transaction(async (tx) => {
      // Step 1: Get free plan ID (will be created first, so we can reference it)
      // First, check if any subscriptions exist
      const activeSubscriptions = await tx
        .select()
        .from(userSubscriptions);
      
      const usersMigrated = activeSubscriptions.length;

      if (usersMigrated > 0) {
        console.log(`👥 Found ${usersMigrated} active subscription(s) - will migrate to free plan`);
        
        // Delete all subscriptions (users will get free trial on next login via auth flow)
        await tx.delete(userSubscriptions);
        console.log(`✅ Migrated ${usersMigrated} user(s) to free trial`);
      }

      // Step 2: Count existing plans
      const existingPlans = await tx.select().from(subscriptionPlans);
      const plansDeleted = existingPlans.length;

      console.log(`🗑️  Deleting ${plansDeleted} existing plan(s)...`);

      // Step 3: Hard delete ALL existing plans (safe since subscriptions removed)
      await tx.delete(subscriptionPlans);

      console.log(`✅ Deleted ${plansDeleted} plan(s)`);

      // Step 4: Insert new canonical plans with Stripe IDs pre-populated
      console.log(`📝 Creating ${defaultPlans.length} canonical plan(s)...`);
      
      const insertedPlans: SubscriptionPlan[] = [];
      
      for (const planData of defaultPlans) {
        const [plan] = await tx
          .insert(subscriptionPlans)
          .values(planData)
          .returning();
        
        insertedPlans.push(plan);
        console.log(`   ✓ Created: ${plan.displayName} ${plan.stripePriceId ? `(${plan.stripePriceId})` : ''}`);
      }

      console.log(`✅ Created ${insertedPlans.length} plan(s)`);

      return {
        plans: insertedPlans,
        plansCreated: insertedPlans.length,
        plansDeleted,
        usersMigrated,
      };
    });
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

  // Collections operations
  async getCollections(userId: string): Promise<Collection[]> {
    return await db
      .select()
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(collections.sortOrder, collections.name);
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, id));
    return collection;
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const [created] = await db
      .insert(collections)
      .values(collection)
      .returning();
    return created;
  }

  async updateCollection(id: string, updates: UpdateCollection): Promise<Collection | undefined> {
    const [updated] = await db
      .update(collections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(collections.id, id))
      .returning();
    return updated;
  }

  async deleteCollection(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(generations)
        .set({ collectionId: null })
        .where(eq(generations.collectionId, id));
      await tx.delete(collections).where(eq(collections.id, id));
    });
  }

  // Tags operations
  async getTags(userId: string): Promise<Tag[]> {
    return await db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(tags.name);
  }

  async getTag(id: string): Promise<Tag | undefined> {
    const [tag] = await db
      .select()
      .from(tags)
      .where(eq(tags.id, id));
    return tag;
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [created] = await db
      .insert(tags)
      .values(tag)
      .returning();
    return created;
  }

  async updateTag(id: string, updates: UpdateTag): Promise<Tag | undefined> {
    const [updated] = await db
      .update(tags)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tags.id, id))
      .returning();
    return updated;
  }

  async deleteTag(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(generationTags).where(eq(generationTags.tagId, id));
      await tx.delete(tags).where(eq(tags.id, id));
    });
  }

  // Generation-Tag operations
  async getGenerationTags(generationId: string): Promise<Tag[]> {
    const result = await db
      .select({ tag: tags })
      .from(generationTags)
      .innerJoin(tags, eq(generationTags.tagId, tags.id))
      .where(eq(generationTags.generationId, generationId));
    return result.map(r => r.tag);
  }

  async addGenerationTag(generationId: string, tagId: string): Promise<void> {
    await db
      .insert(generationTags)
      .values({ generationId, tagId })
      .onConflictDoNothing();
  }

  async removeGenerationTag(generationId: string, tagId: string): Promise<void> {
    await db
      .delete(generationTags)
      .where(and(
        eq(generationTags.generationId, generationId),
        eq(generationTags.tagId, tagId)
      ));
  }

  // Bulk operations
  async bulkMoveToCollection(generationIds: string[], collectionId: string | null): Promise<void> {
    if (generationIds.length === 0) return;
    await db
      .update(generations)
      .set({ collectionId })
      .where(inArray(generations.id, generationIds));
  }

  async bulkToggleFavorite(generationIds: string[], isFavorite: boolean): Promise<void> {
    if (generationIds.length === 0) return;
    await db
      .update(generations)
      .set({ isFavorite })
      .where(inArray(generations.id, generationIds));
  }

  async bulkArchive(generationIds: string[], archive: boolean): Promise<void> {
    if (generationIds.length === 0) return;
    await db
      .update(generations)
      .set({ isArchived: archive })
      .where(inArray(generations.id, generationIds));
  }

  async bulkDelete(generationIds: string[]): Promise<void> {
    if (generationIds.length === 0) return;
    await db.transaction(async (tx) => {
      await tx.delete(generationTags).where(inArray(generationTags.generationId, generationIds));
      await tx.delete(generations).where(inArray(generations.id, generationIds));
    });
  }

  async bulkAddTag(generationIds: string[], tagId: string): Promise<void> {
    if (generationIds.length === 0) return;
    const values = generationIds.map(generationId => ({ generationId, tagId }));
    await db
      .insert(generationTags)
      .values(values)
      .onConflictDoNothing();
  }

  async bulkRemoveTag(generationIds: string[], tagId: string): Promise<void> {
    if (generationIds.length === 0) return;
    await db
      .delete(generationTags)
      .where(and(
        inArray(generationTags.generationId, generationIds),
        eq(generationTags.tagId, tagId)
      ));
  }

  // Video Project operations
  async createVideoProject(project: InsertVideoProject): Promise<VideoProject> {
    const [created] = await db
      .insert(videoProjects)
      .values(project)
      .returning();
    return created;
  }

  async getVideoProject(id: string): Promise<VideoProject | undefined> {
    const [project] = await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.id, id));
    return project;
  }

  async getUserOwnedProjects(userId: string): Promise<VideoProject[]> {
    return await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.ownerUserId, userId))
      .orderBy(desc(videoProjects.updatedAt));
  }

  async getUserAccessibleProjects(userId: string): Promise<VideoProject[]> {
    const ownedProjects = await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.ownerUserId, userId));

    const collaboratorProjects = await db
      .select({ project: videoProjects })
      .from(projectCollaborators)
      .innerJoin(videoProjects, eq(projectCollaborators.projectId, videoProjects.id))
      .where(eq(projectCollaborators.userId, userId));

    const collabProjectList = collaboratorProjects.map(r => r.project);
    
    const allProjects = [...ownedProjects, ...collabProjectList];
    const uniqueProjects = allProjects.reduce((acc, project) => {
      if (!acc.find(p => p.id === project.id)) {
        acc.push(project);
      }
      return acc;
    }, [] as VideoProject[]);

    return uniqueProjects.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async updateVideoProject(id: string, data: Partial<InsertVideoProject>): Promise<VideoProject | undefined> {
    const [updated] = await db
      .update(videoProjects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(videoProjects.id, id))
      .returning();
    return updated;
  }

  async deleteVideoProject(id: string): Promise<boolean> {
    const result = await db
      .delete(videoProjects)
      .where(eq(videoProjects.id, id))
      .returning();
    return result.length > 0;
  }

  async getTemplateProjects(): Promise<VideoProject[]> {
    return await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.isTemplate, true))
      .orderBy(desc(videoProjects.createdAt));
  }

  async cloneVideoProject(projectId: string, newOwnerId: string, newTitle: string): Promise<VideoProject> {
    const original = await this.getVideoProject(projectId);
    if (!original) {
      throw new Error('Project not found');
    }

    const [cloned] = await db
      .insert(videoProjects)
      .values({
        ownerUserId: newOwnerId,
        title: newTitle,
        description: original.description,
        timelineData: original.timelineData,
        settings: original.settings,
        isTemplate: false,
        thumbnailUrl: original.thumbnailUrl,
        clonedFromProjectId: projectId,
        durationSeconds: original.durationSeconds,
        status: 'draft',
      })
      .returning();
    return cloned;
  }

  // Brand Kit operations
  async getBrandKit(userId: string): Promise<BrandKit> {
    const [existing] = await db
      .select()
      .from(brandKits)
      .where(eq(brandKits.userId, userId));

    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(brandKits)
      .values({
        userId,
        name: 'Default',
        palettes: null,
        fonts: null,
        logos: null,
      })
      .returning();
    return created;
  }

  async upsertBrandKit(userId: string, data: Partial<InsertBrandKit>): Promise<BrandKit> {
    const [existing] = await db
      .select()
      .from(brandKits)
      .where(eq(brandKits.userId, userId));

    if (existing) {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.palettes !== undefined) updateData.palettes = data.palettes;
      if (data.fonts !== undefined) updateData.fonts = data.fonts;
      if (data.logos !== undefined) updateData.logos = data.logos;
      
      const [updated] = await db
        .update(brandKits)
        .set(updateData)
        .where(eq(brandKits.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(brandKits)
        .values({
          userId,
          name: data.name ?? 'Default',
          palettes: data.palettes as typeof brandKits.$inferInsert['palettes'] ?? null,
          fonts: data.fonts as typeof brandKits.$inferInsert['fonts'] ?? null,
          logos: data.logos as typeof brandKits.$inferInsert['logos'] ?? null,
        })
        .returning();
      return created;
    }
  }

  // Project Collaborator operations
  async addProjectCollaborator(data: InsertProjectCollaborator): Promise<ProjectCollaborator> {
    const [created] = await db
      .insert(projectCollaborators)
      .values(data)
      .returning();
    return created;
  }

  async getProjectCollaborators(projectId: string): Promise<ProjectCollaborator[]> {
    return await db
      .select()
      .from(projectCollaborators)
      .where(eq(projectCollaborators.projectId, projectId))
      .orderBy(projectCollaborators.createdAt);
  }

  async updateCollaboratorRole(projectId: string, userId: string, role: string): Promise<ProjectCollaborator | undefined> {
    const [updated] = await db
      .update(projectCollaborators)
      .set({ role })
      .where(and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.userId, userId)
      ))
      .returning();
    return updated;
  }

  async removeProjectCollaborator(projectId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(projectCollaborators)
      .where(and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  async checkProjectAccess(projectId: string, userId: string): Promise<{ hasAccess: boolean; role: string | null }> {
    const [project] = await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.id, projectId));

    if (!project) {
      return { hasAccess: false, role: null };
    }

    if (project.ownerUserId === userId) {
      return { hasAccess: true, role: 'owner' };
    }

    const [collaborator] = await db
      .select()
      .from(projectCollaborators)
      .where(and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.userId, userId)
      ));

    if (collaborator) {
      return { hasAccess: true, role: collaborator.role };
    }

    return { hasAccess: false, role: null };
  }

  // Story Studio Project operations
  async createStoryProject(project: InsertStoryProject): Promise<StoryProject> {
    const [created] = await db
      .insert(storyProjects)
      .values(project)
      .returning();
    return created;
  }

  async getStoryProject(id: string): Promise<StoryProject | undefined> {
    const [project] = await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.id, id));
    return project;
  }

  async getUserStoryProjects(userId: string): Promise<StoryProject[]> {
    return await db
      .select()
      .from(storyProjects)
      .where(eq(storyProjects.userId, userId))
      .orderBy(desc(storyProjects.updatedAt));
  }

  async updateStoryProject(id: string, updates: UpdateStoryProject): Promise<StoryProject | undefined> {
    const [updated] = await db
      .update(storyProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(storyProjects.id, id))
      .returning();
    return updated;
  }

  async deleteStoryProject(id: string): Promise<boolean> {
    const result = await db
      .delete(storyProjects)
      .where(eq(storyProjects.id, id))
      .returning();
    return result.length > 0;
  }

  // Story Project Segment operations
  async createStorySegment(segment: InsertStoryProjectSegment): Promise<StoryProjectSegment> {
    const [created] = await db
      .insert(storyProjectSegments)
      .values(segment)
      .returning();
    return created;
  }

  async getProjectSegments(projectId: string): Promise<StoryProjectSegment[]> {
    return await db
      .select()
      .from(storyProjectSegments)
      .where(eq(storyProjectSegments.projectId, projectId))
      .orderBy(storyProjectSegments.orderIndex);
  }

  async getStorySegment(id: string): Promise<StoryProjectSegment | undefined> {
    const [segment] = await db
      .select()
      .from(storyProjectSegments)
      .where(eq(storyProjectSegments.id, id));
    return segment;
  }

  async updateStorySegment(id: string, updates: UpdateStoryProjectSegment): Promise<StoryProjectSegment | undefined> {
    const [updated] = await db
      .update(storyProjectSegments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(storyProjectSegments.id, id))
      .returning();
    return updated;
  }

  async deleteStorySegment(id: string): Promise<boolean> {
    const result = await db
      .delete(storyProjectSegments)
      .where(eq(storyProjectSegments.id, id))
      .returning();
    return result.length > 0;
  }

  async reorderProjectSegments(projectId: string, segmentIds: string[]): Promise<void> {
    await Promise.all(
      segmentIds.map((segmentId, index) =>
        db
          .update(storyProjectSegments)
          .set({ orderIndex: index, updatedAt: new Date() })
          .where(and(
            eq(storyProjectSegments.id, segmentId),
            eq(storyProjectSegments.projectId, projectId)
          ))
      )
    );
  }

  async createBulkSegments(segments: InsertStoryProjectSegment[]): Promise<StoryProjectSegment[]> {
    if (segments.length === 0) return [];
    const created = await db
      .insert(storyProjectSegments)
      .values(segments)
      .returning();
    return created;
  }

  // Blog Post operations
  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [created] = await db
      .insert(blogPosts)
      .values(post)
      .returning();
    return created;
  }

  async getBlogPostById(id: string): Promise<BlogPost | undefined> {
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, id));
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug));
    return post;
  }

  async getPublishedBlogPosts(options: { 
    page?: number; 
    limit?: number; 
    category?: string;
    sortBy?: 'latest' | 'oldest' | 'popular';
  }): Promise<{ posts: BlogPost[]; total: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(blogPosts.status, 'published')];
    if (options.category) {
      conditions.push(eq(blogPosts.category, options.category));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blogPosts)
      .where(and(...conditions));
    const total = countResult[0]?.count || 0;

    // Determine sort order
    let orderBy;
    switch (options.sortBy) {
      case 'oldest':
        orderBy = asc(blogPosts.publishedDate);
        break;
      case 'popular':
        orderBy = desc(blogPosts.viewCount);
        break;
      case 'latest':
      default:
        orderBy = desc(blogPosts.publishedDate);
    }

    // Get posts with pagination
    const posts = await db
      .select()
      .from(blogPosts)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      posts,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    return await db
      .select()
      .from(blogPosts)
      .orderBy(desc(blogPosts.createdAt));
  }

  async updateBlogPost(id: string, updates: UpdateBlogPost): Promise<BlogPost | undefined> {
    const [updated] = await db
      .update(blogPosts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return updated;
  }

  async deleteBlogPost(id: string): Promise<boolean> {
    const result = await db
      .delete(blogPosts)
      .where(eq(blogPosts.id, id))
      .returning();
    return result.length > 0;
  }

  async incrementBlogPostViews(id: string): Promise<void> {
    await db
      .update(blogPosts)
      .set({ viewCount: sql`${blogPosts.viewCount} + 1` })
      .where(eq(blogPosts.id, id));
  }

  async searchBlogPosts(query: string): Promise<BlogPost[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select()
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.status, 'published'),
          or(
            ilike(blogPosts.title, searchPattern),
            ilike(blogPosts.content, searchPattern),
            ilike(blogPosts.excerpt, searchPattern)
          )
        )
      )
      .orderBy(desc(blogPosts.publishedDate))
      .limit(20);
  }

  async getBlogTags(): Promise<{ tag: string; count: number }[]> {
    // Get all published posts with tags
    const posts = await db
      .select({ tags: blogPosts.tags })
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'));

    // Count tags
    const tagCounts = new Map<string, number>();
    for (const post of posts) {
      const tags = post.tags as string[] | null;
      if (tags && Array.isArray(tags)) {
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
    }

    // Convert to array and sort by count
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getRelatedBlogPosts(category: string, excludeId: string, limit: number = 3): Promise<BlogPost[]> {
    return await db
      .select()
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.status, 'published'),
          eq(blogPosts.category, category),
          sql`${blogPosts.id} != ${excludeId}`
        )
      )
      .orderBy(desc(blogPosts.publishedDate))
      .limit(limit);
  }

  // Stock Photos operations
  async saveStockImage(image: InsertSavedStockImage): Promise<SavedStockImage> {
    const [saved] = await db
      .insert(savedStockImages)
      .values(image)
      .returning();
    return saved;
  }

  async getSavedStockImages(userId: string, limit: number = 50, offset: number = 0): Promise<SavedStockImage[]> {
    return await db
      .select()
      .from(savedStockImages)
      .where(eq(savedStockImages.userId, userId))
      .orderBy(desc(savedStockImages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countSavedStockImages(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(savedStockImages)
      .where(eq(savedStockImages.userId, userId));
    return result[0]?.count || 0;
  }

  async deleteSavedStockImage(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(savedStockImages)
      .where(
        and(
          eq(savedStockImages.id, id),
          eq(savedStockImages.userId, userId)
        )
      )
      .returning();
    return result.length > 0;
  }

  async checkSavedStockImages(userId: string, images: Array<{ source: string; externalId: string }>): Promise<string[]> {
    if (images.length === 0) return [];
    
    // Get all saved images for this user in a single batched query
    const allSaved = await db
      .select({ 
        source: savedStockImages.source, 
        externalId: savedStockImages.externalId 
      })
      .from(savedStockImages)
      .where(eq(savedStockImages.userId, userId));
    
    // Create a Set for O(1) lookups
    const savedSet = new Set(allSaved.map(s => `${s.source}-${s.externalId}`));
    
    // Filter the input images to find which ones are saved
    return images
      .filter(img => savedSet.has(`${img.source}-${img.externalId}`))
      .map(img => `${img.source}-${img.externalId}`);
  }
}

export const storage = new DatabaseStorage();
