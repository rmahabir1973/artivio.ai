import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (supports custom email/password and Google OAuth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"), // Hashed password for email/password auth (null for OAuth users)
  authProvider: varchar("auth_provider").notNull().default('local'), // 'local', 'google'
  googleId: varchar("google_id").unique(), // Google OAuth ID
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  credits: integer("credits").notNull().default(0),
  stripeCustomerId: varchar("stripe_customer_id").unique(),
  isAdmin: boolean("is_admin").notNull().default(false),
  referralCode: varchar("referral_code").unique(), // Unique code for sharing with friends
  referredBy: varchar("referred_by"), // ID of user who referred them
  tokenVersion: integer("token_version").notNull().default(0), // For forced logout / token invalidation
  emailVerified: boolean("email_verified").notNull().default(false), // For email verification
  emailVerificationToken: varchar("email_verification_token"), // Token for email verification
  emailVerificationExpires: timestamp("email_verification_expires"), // Token expiration time
  hasSeenWelcome: boolean("has_seen_welcome").notNull().default(false), // Track if user has seen welcome onboarding
  hasSocialPoster: boolean("has_social_poster").notNull().default(false), // Social Media Poster add-on ($25/month)
  socialPosterSubscriptionId: varchar("social_poster_subscription_id"), // Stripe subscription ID for add-on
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Refresh tokens table for JWT authentication
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenId: varchar("token_id").notNull().unique(), // Unique identifier for this refresh token
  tokenHash: text("token_hash").notNull(), // Hashed refresh token value
  tokenVersion: integer("token_version").notNull(), // Must match user's tokenVersion to be valid
  deviceInfo: text("device_info"), // User agent or device identifier
  expiresAt: timestamp("expires_at").notNull(), // 30 days from creation
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("user_id_idx").on(table.userId),
  index("token_id_idx").on(table.tokenId),
  index("expires_at_idx").on(table.expiresAt),
]);

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;

// Referrals table for tracking referral program
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // User who shared the referral
  referralCode: varchar("referral_code").notNull(), // The code that was shared
  refereeId: varchar("referee_id").references(() => users.id, { onDelete: 'set null' }), // User who signed up (null until conversion)
  refereeEmail: varchar("referee_email"), // Email of person who clicked (before signup)
  status: varchar("status").notNull().default('pending'), // 'pending', 'converted', 'credited'
  referrerCreditsEarned: integer("referrer_credits_earned").notNull().default(0), // Credits given to referrer
  refereeCreditsGiven: integer("referee_credits_given").notNull().default(0), // Bonus credits given to referee
  convertedAt: timestamp("converted_at"), // When referee signed up
  creditedAt: timestamp("credited_at"), // When credits were awarded
  createdAt: timestamp("created_at").defaultNow().notNull(), // When referral link was first clicked
}, (table) => [
  index("referrer_idx").on(table.referrerId),
  index("referee_idx").on(table.refereeId),
  index("referral_code_idx").on(table.referralCode),
  index("status_idx").on(table.status),
  // Prevent duplicate referral entries for same email per referrer
  uniqueIndex("referrer_referee_email_idx").on(table.referrerId, table.refereeEmail).where(sql`${table.refereeEmail} IS NOT NULL`),
]);

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  convertedAt: true,
  creditedAt: true,
});

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

// API Keys table for round-robin rotation
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyName: varchar("key_name").notNull().unique(), // User-friendly name or auto-generated
  keyValue: text("key_value").notNull(), // The actual API key value
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// Public API Keys table for Tasklet/external integrations
export const publicApiKeys = pgTable("public_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  keyPrefix: varchar("key_prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  lastFourChars: varchar("last_four_chars").notNull(),
  permissions: text("permissions").array().notNull().default(sql`ARRAY['video', 'image', 'audio']::text[]`),
  rateLimit: integer("rate_limit").notNull().default(100),
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("public_api_key_user_idx").on(table.userId),
  index("public_api_key_hash_idx").on(table.keyHash),
]);

export const insertPublicApiKeySchema = createInsertSchema(publicApiKeys).omit({
  id: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
});

export type InsertPublicApiKey = z.infer<typeof insertPublicApiKeySchema>;
export type PublicApiKey = typeof publicApiKeys.$inferSelect;

// Pricing table for configurable feature costs
export const pricing = pgTable("pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feature: varchar("feature").notNull(), // 'video', 'image', 'music', 'chat', 'voice-cloning', 'stt', 'tts', 'avatar', 'audio-converter'
  model: varchar("model").notNull(), // 'veo-3.1', 'flux-kontext', 'suno-v4', 'gpt-4o'
  creditCost: integer("credit_cost").notNull(),
  kieCreditCost: numeric("kie_credit_cost", { precision: 10, scale: 2 }), // What Kie.ai charges (supports decimals like 22.5)
  category: varchar("category").notNull(), // 'generation', 'chat', 'voice', 'audio'
  description: text("description"), // Optional human-readable description
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("feature_model_idx").on(table.feature, table.model),
]);

export const insertPricingSchema = createInsertSchema(pricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePricingSchema = z.object({
  feature: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  creditCost: z.number().int().min(0).optional(),
  kieCreditCost: z.number().int().min(0).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
});

export type InsertPricing = z.infer<typeof insertPricingSchema>;
export type UpdatePricing = z.infer<typeof updatePricingSchema>;
export type Pricing = typeof pricing.$inferSelect;

// Pricing entry for frontend consumption (matches backend Pricing type)
export type PricingEntry = Pricing;

// Plan Economics table for pricing calculator settings (singleton table)
export const planEconomics = pgTable("plan_economics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kiePurchaseAmount: integer("kie_purchase_amount").notNull().default(50), // Amount paid to Kie.ai (e.g., $50)
  kieCreditAmount: integer("kie_credit_amount").notNull().default(10000), // Credits received from Kie.ai (e.g., 10,000)
  userCreditAmount: integer("user_credit_amount").notNull().default(15000), // Credits sold to users (e.g., 15,000)
  profitMargin: integer("profit_margin").notNull().default(50), // Desired profit margin percentage (e.g., 50%)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const insertPlanEconomicsSchema = createInsertSchema(planEconomics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePlanEconomicsSchema = z.object({
  kiePurchaseAmount: z.number().int().min(1).optional(),
  kieCreditAmount: z.number().int().min(1).optional(),
  userCreditAmount: z.number().int().min(1).optional(),
  profitMargin: z.number().int().min(0).max(100).optional(),
});

export type InsertPlanEconomics = z.infer<typeof insertPlanEconomicsSchema>;
export type UpdatePlanEconomics = z.infer<typeof updatePlanEconomicsSchema>;
export type PlanEconomics = typeof planEconomics.$inferSelect;

// Generations table for tracking all AI generations
export const generations = pgTable("generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type").notNull(), // 'video', 'image', 'music', 'upscaling'
  generationType: varchar("generation_type"), // 'text-to-video', 'image-to-video', null for image/music
  processingStage: varchar("processing_stage").notNull().default('generation'), // 'generation', 'upscale'
  parentGenerationId: varchar("parent_generation_id"), // Links upscaled content to original generation
  model: varchar("model").notNull(), // e.g., 'veo-3.1', 'flux-kontext', 'suno-v4', 'topaz-image', 'topaz-video'
  prompt: text("prompt").notNull(),
  referenceImages: text("reference_images").array(), // Image URLs for image-to-video (up to 3 for Veo)
  parameters: jsonb("parameters"), // Store generation parameters
  status: varchar("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  resultUrl: text("result_url"), // URL to generated content (primary/first result)
  resultUrls: text("result_urls").array(), // Array of URLs for multi-image outputs (Midjourney, Seedream, etc.)
  thumbnailUrl: text("thumbnail_url"), // URL to video thumbnail (auto-generated for videos)
  externalTaskId: varchar("external_task_id"), // Provider's task/job ID for tracking
  statusDetail: text("status_detail"), // Detailed status message from provider
  errorMessage: text("error_message"),
  creditsCost: integer("credits_cost").notNull(),
  apiKeyUsed: varchar("api_key_used"), // Which API key was used
  seed: integer("seed"), // Random seed for reproducibility (supported by Veo 3.1, Wan 2.5, Seedance)
  collectionId: varchar("collection_id").references(() => collections.id, { onDelete: 'set null' }),
  isFavorite: boolean("is_favorite").notNull().default(false),
  archivedAt: timestamp("archived_at"), // null means not archived
  isShowcase: boolean("is_showcase").notNull().default(false), // User opt-in to display in public showcase
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("generations_user_created_idx").on(table.userId, table.createdAt),
  index("generations_collection_idx").on(table.collectionId),
]);

export const insertGenerationSchema = createInsertSchema(generations).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generations.$inferSelect;

// Collections table (folders for organizing generations)
export const collections = pgTable("collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  parentId: varchar("parent_id"), // Self-referencing for hierarchy - null means root level
  color: varchar("color", { length: 7 }), // Hex color for folder icon (e.g., "#FF5733")
  icon: varchar("icon", { length: 50 }), // Lucide icon name (e.g., "folder", "star", "heart")
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("collections_user_idx").on(table.userId),
  index("collections_parent_idx").on(table.parentId),
]);

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
  color: z.string().max(7).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
});

export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type UpdateCollection = z.infer<typeof updateCollectionSchema>;
export type Collection = typeof collections.$inferSelect;

// Tags table (labels for categorization)
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#6366F1"), // Hex color
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("tags_user_idx").on(table.userId),
  uniqueIndex("tags_user_name_idx").on(table.userId, table.name),
]);

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(7).optional(),
});

export type InsertTag = z.infer<typeof insertTagSchema>;
export type UpdateTag = z.infer<typeof updateTagSchema>;
export type Tag = typeof tags.$inferSelect;

// Generation-Tags join table
export const generationTags = pgTable("generation_tags", {
  generationId: varchar("generation_id").notNull().references(() => generations.id, { onDelete: 'cascade' }),
  tagId: varchar("tag_id").notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.generationId, table.tagId] }),
]);

export const insertGenerationTagSchema = createInsertSchema(generationTags);

export type InsertGenerationTag = z.infer<typeof insertGenerationTagSchema>;
export type GenerationTag = typeof generationTags.$inferSelect;

// Saved Seeds table for user's seed library (for reproducible AI generations)
export const savedSeeds = pgTable("saved_seeds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(), // User-defined name (e.g., "cyberpunk_theme", "character_v1")
  seed: integer("seed").notNull(), // The actual seed value
  description: text("description"), // Optional description
  previewImageUrl: text("preview_image_url"), // Optional thumbnail from a generation using this seed
  generationId: varchar("generation_id"), // Optional link to the generation this seed came from
  usageCount: integer("usage_count").notNull().default(0), // Track how many times this seed has been used
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("saved_seeds_user_idx").on(table.userId),
  index("saved_seeds_user_created_idx").on(table.userId, table.createdAt),
]);

export const insertSavedSeedSchema = createInsertSchema(savedSeeds).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSavedSeedSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  previewImageUrl: z.string().optional(),
});

export type InsertSavedSeed = z.infer<typeof insertSavedSeedSchema>;
export type UpdateSavedSeed = z.infer<typeof updateSavedSeedSchema>;
export type SavedSeed = typeof savedSeeds.$inferSelect;

// Image Analysis table for AI-powered image understanding
export const imageAnalyses = pgTable("image_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  idempotencyKey: varchar("idempotency_key").notNull(), // Prevents double-charging on retries
  imageUrl: text("image_url").notNull(), // Hosted image URL
  analysisPrompt: text("analysis_prompt"), // Optional user-provided prompt/question
  analysisResult: jsonb("analysis_result"), // Structured AI analysis (supports rich formatting)
  model: varchar("model").notNull().default('gpt-4o'), // AI model used
  provider: varchar("provider").notNull().default('openai'), // AI provider
  status: varchar("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text("error_message"),
  creditsCost: integer("credits_cost").notNull(),
  apiKeyUsed: varchar("api_key_used"), // Which API key was used
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("image_analyses_user_created_idx").on(table.userId, table.createdAt),
  uniqueIndex("image_analyses_idempotency_idx").on(table.userId, table.idempotencyKey),
]);

export const insertImageAnalysisSchema = createInsertSchema(imageAnalyses).omit({
  id: true,
  status: true,
  apiKeyUsed: true,
  createdAt: true,
  completedAt: true,
});

export type InsertImageAnalysis = z.infer<typeof insertImageAnalysisSchema>;
export type ImageAnalysis = typeof imageAnalyses.$inferSelect;

// Video Combinations table for combining multiple videos into one
export const videoCombinations = pgTable("video_combinations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceVideoIds: text("source_video_ids").array().notNull(), // Ordered array of generation IDs
  outputPath: text("output_path"), // Local path or future cloud URL
  thumbnailUrl: text("thumbnail_url"), // Auto-generated thumbnail for preview
  status: varchar("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text("error_message"),
  creditsCost: integer("credits_cost").notNull(),
  durationSeconds: integer("duration_seconds"), // Total duration of combined video
  taskId: varchar("task_id"), // Background job queue task identifier
  // Enhancement settings
  enhancements: jsonb("enhancements").default(sql`'{}'::jsonb`).notNull(), // Structured enhancement configuration
  hasTransitions: boolean("has_transitions").default(false).notNull(), // Quick pricing lookup
  hasBackgroundMusic: boolean("has_background_music").default(false).notNull(),
  hasTextOverlays: boolean("has_text_overlays").default(false).notNull(),
  hasSpeedAdjustment: boolean("has_speed_adjustment").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("video_combinations_user_created_idx").on(table.userId, table.createdAt),
  uniqueIndex("video_combinations_task_idx").on(table.taskId),
]);

export const insertVideoCombinationSchema = createInsertSchema(videoCombinations).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertVideoCombination = z.infer<typeof insertVideoCombinationSchema>;
export type VideoCombination = typeof videoCombinations.$inferSelect;

// Video Combination Events table for debugging and audit trail
export const videoCombinationEvents = pgTable("video_combination_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  combinationId: varchar("combination_id").notNull().references(() => videoCombinations.id, { onDelete: 'cascade' }),
  eventType: varchar("event_type").notNull(), // 'status_change', 'ffmpeg_start', 'ffmpeg_complete', 'error'
  message: text("message"), // Event description or FFmpeg logs
  metadata: jsonb("metadata"), // Additional event data
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("video_combination_events_combination_idx").on(table.combinationId, table.createdAt),
]);

export const insertVideoCombinationEventSchema = createInsertSchema(videoCombinationEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertVideoCombinationEvent = z.infer<typeof insertVideoCombinationEventSchema>;
export type VideoCombinationEvent = typeof videoCombinationEvents.$inferSelect;

// Image Analysis Request Schema
export const analyzeImageRequestSchema = z.object({
  image: z.string(), // Base64 data URI
  prompt: z.string().max(500).optional(), // Optional custom question/prompt
  model: z.enum(['gpt-4o']).default('gpt-4o'),
  idempotencyKey: z.string().uuid(), // Client-generated UUID to prevent double-charging
});

export type AnalyzeImageRequest = z.infer<typeof analyzeImageRequestSchema>;

// Prompt Refinement schemas
export const promptRefineRequestSchema = z.object({
  prompt: z.string().min(1).max(5000),
  context: z.enum(['video', 'image', 'audio', 'general']),
});

export type PromptRefineRequest = z.infer<typeof promptRefineRequestSchema>;

export const promptRefineResponseSchema = z.object({
  original: z.string(),
  refined: z.string(),
  suggestions: z.array(z.string()).optional(),
});

export type PromptRefineResponse = z.infer<typeof promptRefineResponseSchema>;

// AI Assistant Chat schemas
export const assistantChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
});

export type AssistantChatRequest = z.infer<typeof assistantChatRequestSchema>;

export const assistantChatResponseSchema = z.object({
  message: z.string(),
});

export type AssistantChatResponse = z.infer<typeof assistantChatResponseSchema>;

// Loops.so Test Contact Request Schema
export const loopsTestContactRequestSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

export type LoopsTestContactRequest = z.infer<typeof loopsTestContactRequestSchema>;

// Video Enhancement Schemas
export const transitionsEnhancementSchema = z.object({
  mode: z.enum(['none', 'crossfade']).default('none'),
  durationSeconds: z.number().min(0.5).max(3.0).optional(), // Only for crossfade
}).default({ mode: 'none' });

export const backgroundMusicEnhancementSchema = z.object({
  audioUrl: z.string().url(),
  volume: z.number().min(0.0).max(1.0).default(0.3),
  fadeInSeconds: z.number().min(0).max(10).optional(),
  fadeOutSeconds: z.number().min(0).max(10).optional(),
  trimStartSeconds: z.number().min(0).optional(),
  trimEndSeconds: z.number().min(0).optional(),
}).optional();

export const textOverlaySchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(7)),
  text: z.string().min(1).max(200),
  position: z.enum(['top', 'center', 'bottom', 'custom']).default('center'),
  customPosition: z.object({
    xPercent: z.number().min(0).max(100),
    yPercent: z.number().min(0).max(100),
  }).optional(),
  timing: z.enum(['intro', 'outro', 'all']).default('all'),
  displaySeconds: z.number().min(1).max(30).optional(), // For intro/outro
  fontSize: z.number().min(8).max(120).default(48),
  colorHex: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).default('#FFFFFF'),
  fontFamily: z.string().optional(),
});

export const textOverlaysEnhancementSchema = z.array(textOverlaySchema).max(5).default([]);

export const speedEnhancementSchema = z.object({
  mode: z.enum(['none', 'global', 'perClip']).default('none'),
  globalFactor: z.number().min(0.25).max(4.0).optional(), // For global mode
  perClip: z.array(z.object({
    clipIndex: z.number().int().min(0),
    factor: z.number().min(0.25).max(4.0),
  })).optional(), // For perClip mode
}).default({ mode: 'none' });

export const videoEnhancementsSchema = z.object({
  transitions: transitionsEnhancementSchema,
  backgroundMusic: backgroundMusicEnhancementSchema,
  textOverlays: textOverlaysEnhancementSchema,
  speed: speedEnhancementSchema,
}).partial().default({});

export type VideoEnhancements = z.infer<typeof videoEnhancementsSchema>;
export type TransitionsEnhancement = z.infer<typeof transitionsEnhancementSchema>;
export type BackgroundMusicEnhancement = z.infer<typeof backgroundMusicEnhancementSchema>;
export type TextOverlay = z.infer<typeof textOverlaySchema>;
export type SpeedEnhancement = z.infer<typeof speedEnhancementSchema>;

// Video Combination Request Schema
export const combineVideosRequestSchema = z.object({
  videoIds: z.array(z.string().uuid()).min(2, "Must select at least 2 videos").max(20, "Cannot combine more than 20 videos"),
  enhancements: videoEnhancementsSchema.optional(),
});

export type CombineVideosRequest = z.infer<typeof combineVideosRequestSchema>;

// Custom validator for base64 image data URIs
const base64ImageSchema = z.string().refine(
  (val) => {
    // Must be a valid data URI format
    if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(val)) {
      return false;
    }
    
    // Extract base64 content
    let base64Content = val.split(',')[1];
    if (!base64Content) return false;
    
    // Normalize: remove all whitespace (per RFC 2397, whitespace is allowed but ignored)
    base64Content = base64Content.replace(/\s+/g, '');
    
    // Reject if normalized encoded payload exceeds 13.5MB (prevents DoS before decode)
    const maxEncodedSize = 13.5 * 1024 * 1024;
    if (base64Content.length > maxEncodedSize) {
      return false;
    }
    
    // Calculate decoded size accurately (base64 to binary is ~0.75x minus padding)
    // Count padding characters (= at end)
    let paddingCount = 0;
    if (base64Content.endsWith('==')) paddingCount = 2;
    else if (base64Content.endsWith('=')) paddingCount = 1;
    
    const decodedSize = (base64Content.length * 3) / 4 - paddingCount;
    const maxSize = 10 * 1024 * 1024; // 10MB max
    
    return decodedSize <= maxSize;
  },
  {
    message: "Each image must be a valid data:image/... URI with decoded size ≤ 10MB"
  }
);

// Flexible image schema that accepts both base64 data URIs and HTTP/HTTPS URLs
const imageInputSchema = z.union([
  base64ImageSchema,
  z.string().url().refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    { message: "Image URLs must use HTTP or HTTPS protocol" }
  )
]);

// Request validation schemas for generation endpoints
export const generateVideoRequestSchema = z.object({
  model: z.enum([
    'veo-3',
    'veo-3.1',
    'veo-3.1-fast',
    'veo-3.1-first-and-last-frames',
    'veo-3.1-fast-first-and-last-frames',
    'veo-3.1-fast-reference-2-video',
    'runway-gen3-alpha-turbo',
    'seedance-1-pro',
    'seedance-1-lite',
    'wan-2.5',
    'kling-2.5-turbo',
    'grok-imagine',
    'sora-2',
    'sora-2-image-to-video',
    'sora-2-pro-storyboard',
  ]),
  prompt: z.string().min(1).max(2000),
  generationType: z.enum(['text-to-video', 'image-to-video', 'first-and-last-frames-to-video', 'reference-2-video']).optional(),
  referenceImages: z.array(imageInputSchema).max(3).optional(), // Up to 3 images (base64 or HTTPS URL)
  veoSubtype: z.enum(['TEXT_2_VIDEO', 'REFERENCE_2_VIDEO', 'FIRST_AND_LAST_FRAMES_2_VIDEO']).optional(), // Explicit Veo generation subtype
  parameters: z.object({
    duration: z.number().optional(), // Duration in seconds (5, 10 for Runway)
    quality: z.enum(['720p', '1080p']).optional(), // For Runway
    aspectRatio: z.enum(['16:9', '9:16', '4:3', '1:1', '3:4', 'Auto']).optional(),
    shots: z.array(z.object({
      Scene: z.string().min(1).max(2000),
      duration: z.number().int().min(1).max(25),
    })).min(2).max(3).optional(), // Sora storyboard shots (2-3 scenes)
    nFrames: z.string().optional(), // Sora duration ('10', '15', '25')
    removeWatermark: z.boolean().optional(), // Sora watermark removal
    mode: z.enum(['fun', 'normal', 'spicy']).optional(), // Grok Imagine mode
    seed: z.number().optional(), // Random seed for reproducible generation
    seeds: z.union([z.number(), z.array(z.number())]).optional(), // Veo format: seeds array or single number
  }).optional(),
});

// Sora 2 Pro Text-to-Video Request
export const sora2ProTextRequestSchema = z.object({
  model: z.enum(['sora-2-pro-text-720p', 'sora-2-pro-text-1080p']),
  prompt: z.string().min(1).max(2000),
  parameters: z.object({
    aspectRatio: z.enum(['portrait', 'landscape']).default('landscape'),
    nFrames: z.enum(['10', '15']).default('10'),
    removeWatermark: z.boolean().default(true),
  }).optional(),
});

// Sora 2 Pro Image-to-Video Request
export const sora2ProImageRequestSchema = z.object({
  model: z.enum(['sora-2-pro-image-720p', 'sora-2-pro-image-1080p']),
  prompt: z.string().min(1).max(2000),
  referenceImages: z.array(imageInputSchema).min(1).max(1), // Exactly 1 image
  parameters: z.object({
    aspectRatio: z.enum(['portrait', 'landscape']).default('landscape'),
    nFrames: z.enum(['10', '15']).default('10'),
    removeWatermark: z.boolean().default(true),
  }).optional(),
});

// Sora 2 Pro Storyboard Request
export const sora2ProStoryboardRequestSchema = z.object({
  shots: z.array(z.object({
    prompt: z.string().min(1).max(2000),
    duration: z.number().min(1).max(25),
  })).min(1).max(10), // Up to 10 scenes
  referenceImages: z.array(imageInputSchema).max(1).optional(), // Optional reference image
  parameters: z.object({
    nFrames: z.enum(['10', '15', '25']).default('15'),
    aspectRatio: z.enum(['portrait', 'landscape']).default('landscape'),
  }).optional(),
});

export const generateImageRequestSchema = z.object({
  model: z.enum(['4o-image', 'flux-kontext', 'nano-banana', 'seedream-4', 'midjourney-v7']),
  prompt: z.string().min(1).max(2000),
  mode: z.enum(['text-to-image', 'image-editing']).default('text-to-image'),
  referenceImages: z.array(imageInputSchema).max(10).optional(), // Max 10 images (base64 or HTTPS URL)
  parameters: z.object({
    // General parameters
    aspectRatio: z.string().optional(),
    style: z.string().optional(),
    outputFormat: z.enum(['PNG', 'JPEG', 'WEBP', 'png', 'jpg']).optional(), // Support both uppercase (legacy) and lowercase (Nano Banana)
    quality: z.enum(['standard', 'hd']).optional(),
    seed: z.number().optional(), // Random seed for reproducible generation
    // Nano Banana-specific parameters
    resolution: z.enum(['1K', '2K', '4K']).optional(), // For nano-banana: 1K, 2K, 4K
    // Seedream-specific parameters
    imageSize: z.string().optional(), // square, square_hd, portrait_4_3, etc.
    imageResolution: z.string().optional(), // 1K, 2K, 4K
    maxImages: z.number().min(1).max(6).optional(), // 1-6 images per generation
    // Midjourney-specific parameters
    version: z.string().optional(), // MJ version
    speed: z.enum(['relaxed', 'fast', 'turbo']).optional(),
    stylization: z.number().min(0).max(1000).optional(), // 0-1000
  }).optional(),
}).refine(
  (data) => {
    // Enforce: if mode is text-to-image, referenceImages must be empty or undefined
    if (data.mode === 'text-to-image' && data.referenceImages && data.referenceImages.length > 0) {
      return false;
    }
    // Enforce: if mode is image-editing, referenceImages must have at least one image
    if (data.mode === 'image-editing' && (!data.referenceImages || data.referenceImages.length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: "text-to-image mode cannot include referenceImages; image-editing mode requires at least one referenceImage"
  }
);

export const generateMusicRequestSchema = z.object({
  model: z.enum(['suno-v3.5', 'suno-v4', 'suno-v4.5', 'suno-v4.5-plus', 'suno-v5']),
  prompt: z.string().min(1).max(5000),
  parameters: z.object({
    lyrics: z.string().optional(),
    duration: z.number().optional(),
    genre: z.string().optional(),
    customMode: z.boolean().optional(),
    instrumental: z.boolean().optional(),
    style: z.string().optional(),
    title: z.string().optional(),
    negativeTags: z.string().optional(),
    vocalGender: z.enum(['m', 'f']).optional(),
    styleWeight: z.number().min(0).max(1).optional(),
    weirdnessConstraint: z.number().min(0).max(1).optional(),
    audioWeight: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Extend Music Request
export const extendMusicRequestSchema = z.object({
  audioId: z.string(),
  model: z.enum(['suno-v3.5', 'suno-v4', 'suno-v4.5', 'suno-v4.5-plus', 'suno-v5']),
  defaultParamFlag: z.boolean(),
  continueAt: z.number().optional(),
  prompt: z.string().max(5000).optional(),
  style: z.string().max(1000).optional(),
  title: z.string().max(100).optional(),
  parameters: z.object({
    instrumental: z.boolean().optional(),
    negativeTags: z.string().optional(),
    vocalGender: z.enum(['m', 'f']).optional(),
    styleWeight: z.number().min(0).max(1).optional(),
    weirdnessConstraint: z.number().min(0).max(1).optional(),
    audioWeight: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Upload & Cover Request
export const uploadCoverRequestSchema = z.object({
  uploadUrl: z.string().url(),
  model: z.enum(['suno-v3.5', 'suno-v4', 'suno-v4.5', 'suno-v4.5-plus', 'suno-v5']),
  customMode: z.boolean(),
  instrumental: z.boolean(),
  prompt: z.string().max(5000).optional(),
  style: z.string().max(1000).optional(),
  title: z.string().max(100).optional(),
  parameters: z.object({
    negativeTags: z.string().optional(),
    vocalGender: z.enum(['m', 'f']).optional(),
    styleWeight: z.number().min(0).max(1).optional(),
    weirdnessConstraint: z.number().min(0).max(1).optional(),
    audioWeight: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Topaz AI Image Upscaling Request
export const upscaleImageRequestSchema = z.object({
  sourceUrl: z.string().url().describe("URL of the image to upscale"),
  upscaleFactor: z.enum(['2', '4', '8']).describe("Upscale factor: 2x, 4x, or 8x"),
  parentGenerationId: z.string().optional().describe("Link to original generation if upscaling from history"),
});

// Topaz AI Video Upscaling Request
export const upscaleVideoRequestSchema = z.object({
  sourceUrl: z.string().url().describe("URL of the video to upscale"),
  upscaleFactor: z.enum(['2', '4']).describe("Upscale factor: 2x or 4x"),
  parentGenerationId: z.string().optional().describe("Link to original generation if upscaling from history"),
});

// Upload & Extend Request
export const uploadExtendRequestSchema = z.object({
  uploadUrl: z.string().url(),
  model: z.enum(['suno-v3.5', 'suno-v4', 'suno-v4.5', 'suno-v4.5-plus', 'suno-v5']),
  defaultParamFlag: z.boolean(),
  instrumental: z.boolean(),
  continueAt: z.number(),
  prompt: z.string().max(5000).optional(),
  style: z.string().max(1000).optional(),
  title: z.string().max(100).optional(),
  parameters: z.object({
    negativeTags: z.string().optional(),
    vocalGender: z.enum(['m', 'f']).optional(),
    styleWeight: z.number().min(0).max(1).optional(),
    weirdnessConstraint: z.number().min(0).max(1).optional(),
    audioWeight: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Add Instrumental Request
export const addInstrumentalRequestSchema = z.object({
  uploadUrl: z.string().url(),
  model: z.enum(['suno-v4.5-plus', 'suno-v5']).default('suno-v4.5-plus'),
  title: z.string(),
  tags: z.string(),
  negativeTags: z.string(),
  parameters: z.object({
    vocalGender: z.enum(['m', 'f']).optional(),
    styleWeight: z.number().min(0).max(1).optional(),
    weirdnessConstraint: z.number().min(0).max(1).optional(),
    audioWeight: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Add Vocals Request
export const addVocalsRequestSchema = z.object({
  uploadUrl: z.string().url(),
  model: z.enum(['suno-v4.5-plus', 'suno-v5']).default('suno-v4.5-plus'),
  prompt: z.string(),
  title: z.string(),
  style: z.string(),
  negativeTags: z.string(),
  parameters: z.object({
    vocalGender: z.enum(['m', 'f']).optional(),
    styleWeight: z.number().min(0).max(1).optional(),
    weirdnessConstraint: z.number().min(0).max(1).optional(),
    audioWeight: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Separate Vocals Request
export const separateVocalsRequestSchema = z.object({
  taskId: z.string(),
  audioId: z.string(),
  type: z.enum(['separate_vocal', 'split_stem']).default('separate_vocal'),
});

// Convert to WAV Request
export const convertToWavRequestSchema = z.object({
  taskId: z.string(),
  audioId: z.string(),
});

// Get Timestamped Lyrics Request
export const getTimestampedLyricsRequestSchema = z.object({
  taskId: z.string(),
  audioId: z.string(),
});

// Create Music Video Request
export const createMusicVideoRequestSchema = z.object({
  taskId: z.string(),
  audioId: z.string(),
  author: z.string().max(50).optional(),
  domainName: z.string().max(50).optional(),
});

// Generate Lyrics Request
export const generateLyricsRequestSchema = z.object({
  prompt: z.string().min(1).max(200),
});

// Generate Sound Effects Request - ElevenLabs Sound Effect V2
export const generateSoundEffectsRequestSchema = z.object({
  model: z.enum(['elevenlabs/sound-effect-v2']).default('elevenlabs/sound-effect-v2'),
  text: z.string().min(1).max(5000),
  loop: z.boolean().optional().default(false),
  duration_seconds: z.number().min(0.5).max(22).optional(),
  prompt_influence: z.number().min(0).max(1).optional().default(0.3),
  output_format: z.enum([
    'mp3_22050_32',
    'mp3_44100_32',
    'mp3_44100_64',
    'mp3_44100_96',
    'mp3_44100_128',
    'mp3_44100_192',
    'pcm_8000',
    'pcm_16000',
    'pcm_22050',
    'pcm_24000',
    'pcm_44100',
    'pcm_48000',
    'ulaw_8000',
    'alaw_8000',
    'opus_48000_32',
    'opus_48000_64',
    'opus_48000_96',
    'opus_48000_128',
    'opus_48000_192',
  ]).optional().default('mp3_44100_128'),
});

export type GenerateVideoRequest = z.infer<typeof generateVideoRequestSchema>;
export type GenerateImageRequest = z.infer<typeof generateImageRequestSchema>;
export type GenerateMusicRequest = z.infer<typeof generateMusicRequestSchema>;
export type ExtendMusicRequest = z.infer<typeof extendMusicRequestSchema>;
export type UploadCoverRequest = z.infer<typeof uploadCoverRequestSchema>;
export type UploadExtendRequest = z.infer<typeof uploadExtendRequestSchema>;
export type AddInstrumentalRequest = z.infer<typeof addInstrumentalRequestSchema>;
export type AddVocalsRequest = z.infer<typeof addVocalsRequestSchema>;
export type SeparateVocalsRequest = z.infer<typeof separateVocalsRequestSchema>;
export type ConvertToWavRequest = z.infer<typeof convertToWavRequestSchema>;
export type GetTimestampedLyricsRequest = z.infer<typeof getTimestampedLyricsRequestSchema>;
export type CreateMusicVideoRequest = z.infer<typeof createMusicVideoRequestSchema>;
export type GenerateLyricsRequest = z.infer<typeof generateLyricsRequestSchema>;
export type GenerateSoundEffectsRequest = z.infer<typeof generateSoundEffectsRequestSchema>;

// Conversations table for AI chat
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title").notNull().default('New Chat'),
  provider: varchar("provider").notNull(), // 'deepseek' or 'openai'
  model: varchar("model").notNull(), // e.g., 'deepseek-chat', 'gpt-4o', 'gpt-4o-mini'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Messages table for chat history
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  creditsCost: integer("credits_cost").notNull().default(0), // Cost for this message
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Chat request schemas
export const sendMessageRequestSchema = z.object({
  conversationId: z.string().optional(), // Optional for new conversations
  message: z.string().min(1).max(4000),
  provider: z.enum(['deepseek', 'openai']),
  model: z.string(), // Will validate per provider
});

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

// Voice Clones table for storing cloned voices from ElevenLabs
export const voiceClones = pgTable("voice_clones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(), // User-friendly name for the voice
  voiceId: varchar("voice_id").notNull(), // ElevenLabs voice ID
  description: text("description"),
  provider: varchar("provider").notNull().default('elevenlabs'), // For future providers
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVoiceCloneSchema = createInsertSchema(voiceClones).omit({
  id: true,
  createdAt: true,
});

export type InsertVoiceClone = z.infer<typeof insertVoiceCloneSchema>;
export type VoiceClone = typeof voiceClones.$inferSelect;

// Text-to-Speech generations table
export const ttsGenerations = pgTable("tts_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text("text").notNull(),
  voiceId: varchar("voice_id").notNull(), // Can be pre-made or cloned voice
  voiceName: varchar("voice_name"), // Display name
  model: varchar("model").notNull(), // e.g., 'eleven_multilingual_v2'
  parameters: jsonb("parameters"), // stability, similarity_boost, style, speed
  status: varchar("status").notNull().default('pending'),
  resultUrl: text("result_url"),
  errorMessage: text("error_message"),
  creditsCost: integer("credits_cost").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertTtsGenerationSchema = createInsertSchema(ttsGenerations).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertTtsGeneration = z.infer<typeof insertTtsGenerationSchema>;
export type TtsGeneration = typeof ttsGenerations.$inferSelect;

// Speech-to-Text generations table
export const sttGenerations = pgTable("stt_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  audioUrl: text("audio_url").notNull(), // Uploaded audio file
  model: varchar("model").notNull().default('whisper-1'), // OpenAI Whisper
  language: varchar("language"), // Optional language hint
  transcription: text("transcription"),
  status: varchar("status").notNull().default('pending'),
  errorMessage: text("error_message"),
  creditsCost: integer("credits_cost").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertSttGenerationSchema = createInsertSchema(sttGenerations).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertSttGeneration = z.infer<typeof insertSttGenerationSchema>;
export type SttGeneration = typeof sttGenerations.$inferSelect;

// Lyrics Generations table for Suno AI-generated lyrics
export const lyricsGenerations = pgTable("lyrics_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  prompt: text("prompt").notNull(), // Theme/description for lyrics
  lyricsText: text("lyrics_text"), // Generated lyrics content
  lyricsTitle: varchar("lyrics_title"), // Title of the lyrics
  externalTaskId: varchar("external_task_id"), // Kie.ai task ID
  status: varchar("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text("error_message"),
  creditsCost: integer("credits_cost").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertLyricsGenerationSchema = createInsertSchema(lyricsGenerations).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertLyricsGeneration = z.infer<typeof insertLyricsGenerationSchema>;
export type LyricsGeneration = typeof lyricsGenerations.$inferSelect;

// AI Talking Avatar generations table
export const avatarGenerations = pgTable("avatar_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceImageUrl: text("source_image_url").notNull(), // Avatar image
  script: text("script").notNull(), // What the avatar says
  voiceId: varchar("voice_id"), // Optional: use cloned voice
  provider: varchar("provider").notNull().default('d-id'), // 'd-id', 'heygen', etc.
  parameters: jsonb("parameters"), // Provider-specific settings
  status: varchar("status").notNull().default('pending'),
  resultUrl: text("result_url"),
  errorMessage: text("error_message"),
  creditsCost: integer("credits_cost").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertAvatarGenerationSchema = createInsertSchema(avatarGenerations).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertAvatarGeneration = z.infer<typeof insertAvatarGenerationSchema>;
export type AvatarGeneration = typeof avatarGenerations.$inferSelect;

// Audio Conversions table
export const audioConversions = pgTable("audio_conversions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceUrl: text("source_url").notNull(), // Original audio file
  sourceFormat: varchar("source_format").notNull(), // e.g., 'm4a'
  targetFormat: varchar("target_format").notNull(), // e.g., 'mp3', 'wav'
  compressionLevel: varchar("compression_level"), // 'low', 'medium', 'high'
  status: varchar("status").notNull().default('pending'),
  resultUrl: text("result_url"),
  errorMessage: text("error_message"),
  creditsCost: integer("credits_cost").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertAudioConversionSchema = createInsertSchema(audioConversions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertAudioConversion = z.infer<typeof insertAudioConversionSchema>;
export type AudioConversion = typeof audioConversions.$inferSelect;

// Saved Stock Images table for user's stock photo library
export const savedStockImages = pgTable("saved_stock_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: varchar("source").notNull(), // 'pixabay' or 'pexels'
  externalId: varchar("external_id").notNull(), // ID from the source API
  previewUrl: text("preview_url").notNull(), // Small preview image URL
  webformatUrl: text("webformat_url").notNull(), // Medium resolution URL
  largeUrl: text("large_url").notNull(), // Full resolution URL
  originalUrl: text("original_url"), // Original/highest resolution URL
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  tags: text("tags"), // Comma-separated tags
  photographer: varchar("photographer"), // Attribution
  photographerUrl: text("photographer_url"), // Link to photographer profile
  pageUrl: text("page_url"), // Link to original page
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("saved_stock_images_user_idx").on(table.userId),
  index("saved_stock_images_source_idx").on(table.source),
  uniqueIndex("saved_stock_images_user_external_idx").on(table.userId, table.source, table.externalId),
]);

export const insertSavedStockImageSchema = createInsertSchema(savedStockImages).omit({
  id: true,
  createdAt: true,
});

export type InsertSavedStockImage = z.infer<typeof insertSavedStockImageSchema>;
export type SavedStockImage = typeof savedStockImages.$inferSelect;

// Stock image search request validation
export const stockImageSearchSchema = z.object({
  query: z.string().min(1).max(100),
  source: z.enum(['pixabay', 'pexels', 'all']).default('all'),
  page: z.number().int().positive().default(1),
  perPage: z.number().int().min(3).max(80).default(20),
  orientation: z.enum(['all', 'horizontal', 'vertical']).default('all'),
  category: z.string().optional(),
  color: z.string().optional(),
});

export type StockImageSearchRequest = z.infer<typeof stockImageSearchSchema>;

// Subscription Plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // 'Free Trial', 'Starter', 'Pro', etc.
  displayName: varchar("display_name").notNull(), // For UI
  description: text("description"),
  stripeProductId: varchar("stripe_product_id"), // Stripe Product ID (e.g., prod_xxx)
  stripePriceId: varchar("stripe_price_id").unique(), // Stripe Price ID (e.g., price_xxx)
  price: integer("price").notNull(), // Price in cents (e.g., 1999 for $19.99) - kept for backward compatibility
  monthlyPrice: integer("monthly_price"), // Monthly billing price in cents (e.g., 1999 for $19.99)
  annualPrice: integer("annual_price"), // Annual billing price in cents (e.g., 19990 for $199.90 = $16.66/month)
  billingPeriod: varchar("billing_period").notNull().default('monthly'), // 'monthly', 'annual', 'trial'
  trialDays: integer("trial_days").default(0), // Days for trial period
  features: jsonb("features"), // List of features/limits
  creditsPerMonth: integer("credits_per_month").notNull(), // Monthly credit allocation
  creditRolloverLimit: integer("credit_rollover_limit").default(0), // Max credits that can rollover
  savingsPercentage: integer("savings_percentage"), // Savings % when paying annually (e.g., 40 for 40% off)
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0), // For display ordering
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// User Subscriptions table
export const userSubscriptions = pgTable("user_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  stripeSubscriptionId: varchar("stripe_subscription_id").unique(),
  stripeCustomerId: varchar("stripe_customer_id"),
  status: varchar("status").notNull().default('active'), // 'active', 'cancelled', 'expired', 'trial', 'past_due', 'unpaid'
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: timestamp("canceled_at"),
  creditsGrantedThisPeriod: integer("credits_granted_this_period").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;

// Stripe Events table (for webhook idempotency)
export const stripeEvents = pgTable("stripe_events", {
  eventId: varchar("event_id").primaryKey(), // Stripe event ID (e.g., evt_xxxxx)
  eventType: varchar("event_type").notNull(), // e.g., 'checkout.session.completed', 'invoice.paid'
  objectId: varchar("object_id"), // Invoice ID, Subscription ID, etc for debugging
  processed: boolean("processed").notNull().default(true), // True if successfully processed, false if partial failure
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  metadata: jsonb("metadata"), // Trimmed event metadata for debugging
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStripeEventSchema = createInsertSchema(stripeEvents).omit({
  createdAt: true,
});

export type InsertStripeEvent = z.infer<typeof insertStripeEventSchema>;
export type StripeEvent = typeof stripeEvents.$inferSelect;

// Announcements table
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  message: text("message").notNull(),
  type: varchar("type").notNull().default('info'), // 'info', 'warning', 'success', 'promo'
  targetPlans: text("target_plans").array(), // Plan names to show to, null = all
  isActive: boolean("is_active").notNull().default(true),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Strict validation schema for announcement creation/update
// Note: XSS protection relies on React's automatic escaping when rendering {announcement.message}
// We trim whitespace but preserve the original message for admin display
export const createAnnouncementSchema = z.object({
  message: z.string()
    .min(1, "Message is required")
    .max(500, "Message must be less than 500 characters")
    .trim(),
  type: z.enum(['info', 'warning', 'success', 'promo']).default('info'),
  targetPlans: z.array(z.enum(['free', 'starter', 'pro'])).optional().nullable(),
  isActive: z.boolean().default(true),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  createdBy: z.string().optional(),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementRequest = z.infer<typeof updateAnnouncementSchema>;

// Feature Pricing table (configurable costs for each feature)
export const featurePricing = pgTable("feature_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  featureKey: varchar("feature_key").notNull().unique(), // e.g., 'video-veo-3.1', 'chat-gpt-4o'
  featureName: varchar("feature_name").notNull(), // Display name
  featureCategory: varchar("feature_category").notNull(), // 'video', 'image', 'music', 'chat', 'tts', 'stt', 'avatar', 'conversion'
  creditsCost: integer("credits_cost").notNull(), // Current cost in credits
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFeaturePricingSchema = createInsertSchema(featurePricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFeaturePricing = z.infer<typeof insertFeaturePricingSchema>;
export type FeaturePricing = typeof featurePricing.$inferSelect;

// Credit Transactions table (audit trail for all credit movements)
export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer("amount").notNull(), // Positive for credits added, negative for deductions
  balanceAfter: integer("balance_after").notNull(), // User's credit balance after this transaction
  type: varchar("type").notNull(), // 'subscription_grant', 'subscription_renewal', 'admin_adjustment', 'usage_deduction', 'refund', 'rollover'
  description: text("description"), // Human-readable description
  relatedEntityType: varchar("related_entity_type"), // 'subscription', 'generation', 'admin_action'
  relatedEntityId: varchar("related_entity_id"), // ID of related subscription/generation/etc
  performedBy: varchar("performed_by").references(() => users.id), // Admin user ID if manual adjustment
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;

// Request validation schemas for new API endpoints

// Voice Cloning Request
export const cloneVoiceRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  audioFiles: z.array(z.string()).min(1).max(3), // Base64 data URIs (1-3 files max, 10MB each, validated server-side)
});

export type CloneVoiceRequest = z.infer<typeof cloneVoiceRequestSchema>;

// Text-to-Speech Request
export const generateTTSRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1), // Pre-made voice name or cloned voice ID
  voiceName: z.string().optional(), // Display name
  model: z.enum(['eleven_multilingual_v2', 'eleven_turbo_v2.5']).default('eleven_multilingual_v2'),
  parameters: z.object({
    stability: z.number().min(0).max(1).optional(),
    similarityBoost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    speed: z.number().min(0.7).max(1.2).optional(),
    languageCode: z.string().optional(), // ISO 639-1
  }).optional(),
});

export type GenerateTTSRequest = z.infer<typeof generateTTSRequestSchema>;

// Speech-to-Text Request
export const generateSTTRequestSchema = z.object({
  audioFile: z.string(), // Base64 data URI (validated and hosted server-side)
  model: z.enum(['scribe-v1']).default('scribe-v1'),
  language: z.string().optional(), // ISO 639-1 code
  parameters: z.object({
    diarization: z.boolean().optional(), // Speaker identification
    timestamps: z.boolean().optional(),
  }).optional(),
});

export type GenerateSTTRequest = z.infer<typeof generateSTTRequestSchema>;

// AI Talking Avatar Request
export const generateAvatarRequestSchema = z.object({
  sourceImage: z.string(), // Base64 data URI (uploaded image, hosted server-side)
  audioUrl: z.string(), // Base64 audio data URI - will be converted to hosted URL
  provider: z.enum(['kling-ai', 'infinite-talk']).default('kling-ai'),
  parameters: z.object({
    quality: z.enum(['480p', '720p']).optional(),
    emotion: z.string().optional(), // e.g., 'professional', 'enthusiastic'
    seed: z.number().min(10000).max(1000000).optional(), // For InfiniteTalk reproducibility
  }).optional(),
});

export type GenerateAvatarRequest = z.infer<typeof generateAvatarRequestSchema>;

// Audio Conversion Request
export const convertAudioRequestSchema = z.object({
  sourceAudio: z.string(), // Base64 data URI
  sourceFormat: z.string(), // e.g., 'mp3', 'wav'
  operation: z.enum(['wav-conversion', 'vocal-removal', 'stem-separation']),
  parameters: z.object({
    targetFormat: z.enum(['wav', 'mp3']).optional(),
    separationType: z.enum(['separate_vocal', 'split_stem']).optional(),
    compressionLevel: z.enum(['low', 'medium', 'high']).optional(),
  }).optional(),
});

export type ConvertAudioRequest = z.infer<typeof convertAudioRequestSchema>;

// Contact Form Request
export const contactFormRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(1, 'Message is required').max(2000),
});

export type ContactFormRequest = z.infer<typeof contactFormRequestSchema>;

// Favorite Workflows - User's saved workflows for quick access
export const favoriteWorkflows = pgTable("favorite_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  workflowId: integer("workflow_id").notNull(), // References workflow ID from workflows.tsx
  workflowTitle: varchar("workflow_title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_workflow_idx").on(table.userId, table.workflowId),
]);

export const insertFavoriteWorkflowSchema = createInsertSchema(favoriteWorkflows).omit({
  id: true,
  createdAt: true,
});

export type InsertFavoriteWorkflow = z.infer<typeof insertFavoriteWorkflowSchema>;
export type FavoriteWorkflow = typeof favoriteWorkflows.$inferSelect;

// Generation Templates - Pre-configured prompts and settings for quick generation
export const generationTemplates = pgTable("generation_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }), // null for global templates
  featureType: varchar("feature_type").notNull(), // 'video', 'image', 'music', etc.
  name: varchar("name").notNull(),
  description: text("description"),
  prompt: text("prompt").notNull(),
  model: varchar("model"), // Preferred model for this template
  parameters: jsonb("parameters"), // Template-specific settings
  isPublic: boolean("is_public").notNull().default(false), // Global templates vs user templates
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const insertGenerationTemplateSchema = createInsertSchema(generationTemplates).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGenerationTemplate = z.infer<typeof insertGenerationTemplateSchema>;
export type GenerationTemplate = typeof generationTemplates.$inferSelect;

// User Onboarding Progress - Track completion of onboarding steps
export const userOnboarding = pgTable("user_onboarding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  exploredWorkflows: boolean("explored_workflows").notNull().default(false),
  triedTemplate: boolean("tried_template").notNull().default(false),
  completedFirstGeneration: boolean("completed_first_generation").notNull().default(false),
  dismissed: boolean("dismissed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const insertUserOnboardingSchema = createInsertSchema(userOnboarding).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserOnboardingSchema = z.object({
  exploredWorkflows: z.boolean().optional(),
  triedTemplate: z.boolean().optional(),
  completedFirstGeneration: z.boolean().optional(),
  dismissed: z.boolean().optional(),
});

export type InsertUserOnboarding = z.infer<typeof insertUserOnboardingSchema>;
export type UpdateUserOnboarding = z.infer<typeof updateUserOnboardingSchema>;
export type UserOnboarding = typeof userOnboarding.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  generations: many(generations),
  conversations: many(conversations),
  voiceClones: many(voiceClones),
  ttsGenerations: many(ttsGenerations),
  sttGenerations: many(sttGenerations),
  lyricsGenerations: many(lyricsGenerations),
  avatarGenerations: many(avatarGenerations),
  audioConversions: many(audioConversions),
  subscriptions: many(userSubscriptions),
  favoriteWorkflows: many(favoriteWorkflows),
  generationTemplates: many(generationTemplates),
  videoProjects: many(videoProjects),
  brandKit: one(brandKits, {
    fields: [users.id],
    references: [brandKits.userId],
  }),
  projectCollaborations: many(projectCollaborators),
  onboarding: one(userOnboarding, {
    fields: [users.id],
    references: [userOnboarding.userId],
  }),
}));

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, {
    fields: [generations.userId],
    references: [users.id],
  }),
}));

export const favoriteWorkflowsRelations = relations(favoriteWorkflows, ({ one }) => ({
  user: one(users, {
    fields: [favoriteWorkflows.userId],
    references: [users.id],
  }),
}));

export const generationTemplatesRelations = relations(generationTemplates, ({ one }) => ({
  user: one(users, {
    fields: [generationTemplates.userId],
    references: [users.id],
  }),
}));

// Home Page Content Management
export const homePageContent = pgTable("home_page_content", {
  id: varchar("id").primaryKey().default('homepage'), // Single row configuration
  heroTitle: text("hero_title").notNull().default('Create any video you can imagine'),
  heroSubtitle: text("hero_subtitle").notNull().default('Generate stunning videos, images, and music with powerful AI models'),
  heroVideoUrl: text("hero_video_url"), // Vimeo embed URL
  heroImageUrl: text("hero_image_url"), // Fallback image
  
  // Video showcases section
  showcaseVideos: jsonb("showcase_videos").$type<{
    url: string;
    title?: string;
    description?: string;
  }[]>().default([]),
  
  // Feature section video placeholders
  featureVideoUrl: text("feature_video_url"), // "Create videos that captivate" section Vimeo URL
  featureImageUrl: text("feature_image_url"), // "Images that inspire" section Vimeo URL
  featureMusicUrl: text("feature_music_url"), // "Music that moves" section Vimeo URL
  
  // Pricing page video
  pricingVideoUrl: text("pricing_video_url"), // Pricing page popup video URL
  
  // Demo video for landing page modal
  demoVideoUrl: text("demo_video_url"), // 2-min demo video Vimeo embed URL
  
  // Product sections
  creatorsTitle: text("creators_title").default('Creators'),
  creatorsDescription: text("creators_description"),
  creatorsImageUrl: text("creators_image_url"),
  
  businessTitle: text("business_title").default('Businesses'),
  businessDescription: text("business_description"),
  businessImageUrl: text("business_image_url"),
  
  // FAQ section
  faqs: jsonb("faqs").$type<{
    question: string;
    answer: string;
  }[]>().default([]),
  
  // Preview videos for generation pages (PeerTube embed URLs)
  previewVideoVideo: text("preview_video_video"), // AI Video generation page
  previewVideoImage: text("preview_video_image"), // AI Image generation page
  previewVideoTransition: text("preview_video_transition"), // Video Transition page
  previewVideoSora: text("preview_video_sora"), // Sora 2 Pro page
  previewVideoGrok: text("preview_video_grok"), // Grok Imagine page
  previewVideoSoundEffects: text("preview_video_sound_effects"), // Sound Effects page
  previewVideoMusic: text("preview_video_music"), // AI Music page
  previewVideoVoiceClone: text("preview_video_voice_clone"), // Voice Cloning page
  previewVideoLipSync: text("preview_video_lip_sync"), // Lip Sync page
  previewVideoTts: text("preview_video_tts"), // Text-to-Speech page
  previewVideoStt: text("preview_video_stt"), // Speech-to-Text page
  previewVideoUpscaler: text("preview_video_upscaler"), // Image Upscaler page
  previewVideoVideoUpscaler: text("preview_video_video_upscaler"), // Video Upscaler page
  previewVideoBgRemover: text("preview_video_bg_remover"), // Background Remover page
  previewVideoTalkingAvatar: text("preview_video_talking_avatar"), // Talking Avatar page
  
  // Brand Builder preview videos
  previewVideoBrandProductAd: text("preview_video_brand_product_ad"), // Brand Builder: Product Ad
  previewVideoBrandInfluencerAd: text("preview_video_brand_influencer_ad"), // Brand Builder: Influencer Ad
  previewVideoBrandLogoAnimation: text("preview_video_brand_logo_animation"), // Brand Builder: Logo Animation
  previewVideoBrandUnboxing: text("preview_video_brand_unboxing"), // Brand Builder: Unboxing
  previewVideoBrandFlashSale: text("preview_video_brand_flash_sale"), // Brand Builder: Flash Sale
  previewVideoBrandBrandStory: text("preview_video_brand_brand_story"), // Brand Builder: Brand Story
  previewVideoBrandTestimonial: text("preview_video_brand_testimonial"), // Brand Builder: Testimonial
  previewVideoBrandSocialPromo: text("preview_video_brand_social_promo"), // Brand Builder: Social Promo
  previewVideoBrandBeforeAfter: text("preview_video_brand_before_after"), // Brand Builder: Before & After
  previewVideoBrandShowcase: text("preview_video_brand_showcase"), // Brand Builder: Showcase
  
  // Welcome onboarding for new users
  welcomeVideoUrl: text("welcome_video_url"), // Avatar/intro video URL for new user welcome
  welcomeSlides: jsonb("welcome_slides").$type<{
    id: string;
    title: string;
    description: string;
    icon?: string; // Lucide icon name
    highlight?: string; // Key benefit to emphasize
  }[]>().default([]),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const insertHomePageContentSchema = createInsertSchema(homePageContent).omit({
  updatedAt: true,
});

export type InsertHomePageContent = z.infer<typeof insertHomePageContentSchema>;
export type HomePageContent = typeof homePageContent.$inferSelect;

// Video Projects table for Video Editor (Twick-based)
export const videoProjects = pgTable("video_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  timelineData: jsonb("timeline_data").notNull(), // Stores Twick timeline JSON
  settings: jsonb("settings").default(sql`'{}'::jsonb`).notNull(), // Export settings, canvas size, etc.
  isTemplate: boolean("is_template").notNull().default(false),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("video_projects_owner_idx").on(table.ownerUserId),
]);

export const insertVideoProjectSchema = createInsertSchema(videoProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVideoProject = z.infer<typeof insertVideoProjectSchema>;
export type VideoProject = typeof videoProjects.$inferSelect;

// Brand Kits table for user branding assets
export const brandKits = pgTable("brand_kits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  name: varchar("name", { length: 100 }).notNull().default('Default'),
  palettes: jsonb("palettes").$type<{ id: string; name: string; colors: string[] }[]>(), // Array of color palettes
  fonts: jsonb("fonts").$type<{ id: string; name: string; family: string; weights?: number[] }[]>(), // Array of fonts
  logos: jsonb("logos").$type<{ id: string; name: string; url: string; kind?: 'logo' | 'watermark' }[]>(), // Array of logos
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const insertBrandKitSchema = createInsertSchema(brandKits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrandKit = z.infer<typeof insertBrandKitSchema>;
export type BrandKit = typeof brandKits.$inferSelect;

// Project Collaborators table for sharing video projects
export const projectCollaborators = pgTable("project_collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => videoProjects.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar("role").notNull(), // 'viewer', 'editor', 'owner'
  invitedBy: varchar("invited_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("project_collaborators_project_user_idx").on(table.projectId, table.userId),
  index("project_collaborators_project_idx").on(table.projectId),
  index("project_collaborators_user_idx").on(table.userId),
]);

export const insertProjectCollaboratorSchema = createInsertSchema(projectCollaborators).omit({
  id: true,
  createdAt: true,
});

export type InsertProjectCollaborator = z.infer<typeof insertProjectCollaboratorSchema>;
export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;

// Story Studio Projects table
export const storyProjects = pgTable("story_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 200 }).notNull(),
  mode: varchar("mode").notNull().default('instant'), // 'instant' or 'advanced'
  status: varchar("status").notNull().default('draft'), // 'draft', 'generating', 'completed', 'failed'
  settings: jsonb("settings"), // Store generation settings (voice, speed, temperature, etc.)
  totalDurationMs: integer("total_duration_ms"), // Total audio duration in milliseconds
  combinedAudioUrl: text("combined_audio_url"), // Final combined audio for advanced stories
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("story_projects_user_idx").on(table.userId),
  index("story_projects_status_idx").on(table.status),
]);

export const insertStoryProjectSchema = createInsertSchema(storyProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStoryProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  mode: z.enum(['instant', 'advanced']).optional(),
  status: z.enum(['draft', 'generating', 'completed', 'failed']).optional(),
  settings: z.any().optional(),
  totalDurationMs: z.number().int().optional(),
  combinedAudioUrl: z.string().optional(),
});

export type InsertStoryProject = z.infer<typeof insertStoryProjectSchema>;
export type UpdateStoryProject = z.infer<typeof updateStoryProjectSchema>;
export type StoryProject = typeof storyProjects.$inferSelect;

// Story Project Segments table (for multi-character advanced stories)
export const storyProjectSegments = pgTable("story_project_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => storyProjects.id, { onDelete: 'cascade' }),
  orderIndex: integer("order_index").notNull(), // Position in the story
  speakerLabel: varchar("speaker_label", { length: 100 }), // Character name (e.g., "Narrator", "Alice", "Bob")
  voiceId: varchar("voice_id"), // Fish.Audio voice ID
  voiceName: varchar("voice_name", { length: 200 }), // Display name of the voice
  text: text("text").notNull(), // The text content for this segment
  emotionTags: text("emotion_tags").array(), // Array of emotion tags used (e.g., ["happy", "excited"])
  durationMs: integer("duration_ms"), // Audio duration in milliseconds
  audioUrl: text("audio_url"), // Generated audio URL for this segment
  status: varchar("status").notNull().default('pending'), // 'pending', 'generating', 'completed', 'failed'
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // Additional settings per segment
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("story_segments_project_idx").on(table.projectId),
  index("story_segments_order_idx").on(table.projectId, table.orderIndex),
]);

export const insertStoryProjectSegmentSchema = createInsertSchema(storyProjectSegments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStoryProjectSegmentSchema = z.object({
  orderIndex: z.number().int().optional(),
  speakerLabel: z.string().max(100).optional(),
  voiceId: z.string().optional(),
  voiceName: z.string().max(200).optional(),
  text: z.string().optional(),
  emotionTags: z.array(z.string()).optional(),
  durationMs: z.number().int().optional(),
  audioUrl: z.string().optional(),
  status: z.enum(['pending', 'generating', 'completed', 'failed']).optional(),
  errorMessage: z.string().optional(),
  metadata: z.any().optional(),
});

export type InsertStoryProjectSegment = z.infer<typeof insertStoryProjectSegmentSchema>;
export type UpdateStoryProjectSegment = z.infer<typeof updateStoryProjectSegmentSchema>;
export type StoryProjectSegment = typeof storyProjectSegments.$inferSelect;

// Blog Posts table for public blog content
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 300 }).notNull().unique(),
  content: text("content").notNull(),
  excerpt: varchar("excerpt", { length: 300 }), // Short preview for listings
  author: varchar("author", { length: 100 }).notNull().default('Artivio Team'),
  tags: jsonb("tags").$type<string[]>().default([]), // Array of tag strings
  category: varchar("category", { length: 50 }).notNull().default('Announcement'), // Tutorial, Case Study, Feature, Announcement
  featuredImageUrl: text("featured_image_url"),
  metaDescription: varchar("meta_description", { length: 200 }), // For SEO
  publishedDate: timestamp("published_date"),
  updatedDate: timestamp("updated_date"),
  status: varchar("status", { length: 20 }).notNull().default('draft'), // 'draft', 'published'
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("blog_posts_slug_idx").on(table.slug),
  index("blog_posts_status_idx").on(table.status),
  index("blog_posts_category_idx").on(table.category),
  index("blog_posts_published_date_idx").on(table.publishedDate),
]);

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBlogPostSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(300).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().max(300).optional().nullable(),
  author: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  category: z.enum(['Tutorial', 'Case Study', 'Feature', 'Announcement']).optional(),
  featuredImageUrl: z.string().optional().nullable(),
  metaDescription: z.string().max(200).optional().nullable(),
  publishedDate: z.date().optional().nullable(),
  updatedDate: z.date().optional().nullable(),
  status: z.enum(['draft', 'published']).optional(),
});

export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type UpdateBlogPost = z.infer<typeof updateBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

// =====================================================
// SOCIAL MEDIA HUB - GetLate.dev Integration
// =====================================================

// Social profiles - links Artivio users to GetLate.dev profiles
export const socialProfiles = pgTable("social_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  getLateProfileId: varchar("getlate_profile_id"), // Profile ID in GetLate.dev system
  uploadPostUsername: varchar("upload_post_username"), // Legacy: Username in Upload-Post system (deprecated)
  isActive: boolean("is_active").notNull().default(true),
  connectedAccountsCount: integer("connected_accounts_count").notNull().default(0),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("social_profiles_user_idx").on(table.userId),
  index("social_profiles_getlate_idx").on(table.getLateProfileId),
]);

export const insertSocialProfileSchema = createInsertSchema(socialProfiles).omit({
  id: true,
  connectedAccountsCount: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSocialProfile = z.infer<typeof insertSocialProfileSchema>;
export type SocialProfile = typeof socialProfiles.$inferSelect;

// Social accounts - individual connected social media accounts
export const socialAccounts = pgTable("social_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialProfileId: varchar("social_profile_id").notNull().references(() => socialProfiles.id, { onDelete: 'cascade' }),
  platform: varchar("platform").notNull(), // 'instagram', 'tiktok', 'linkedin', 'youtube', 'facebook', 'twitter', 'threads', 'pinterest', 'bluesky'
  platformUsername: varchar("platform_username"),
  platformDisplayName: varchar("platform_display_name"),
  platformImageUrl: text("platform_image_url"),
  isConnected: boolean("is_connected").notNull().default(true),
  dailyCap: integer("daily_cap").notNull(), // Platform-specific daily posting limit
  postsToday: integer("posts_today").notNull().default(0), // Counter resets daily
  lastPostAt: timestamp("last_post_at"),
  metadata: jsonb("metadata"), // Platform-specific data (page IDs, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("social_accounts_profile_idx").on(table.socialProfileId),
  index("social_accounts_platform_idx").on(table.platform),
  uniqueIndex("social_accounts_profile_platform_idx").on(table.socialProfileId, table.platform),
]);

export const insertSocialAccountSchema = createInsertSchema(socialAccounts).omit({
  id: true,
  postsToday: true,
  lastPostAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSocialAccount = z.infer<typeof insertSocialAccountSchema>;
export type SocialAccount = typeof socialAccounts.$inferSelect;

// Social goals - AI strategy goals for content planning
export const socialGoals = pgTable("social_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialProfileId: varchar("social_profile_id").notNull().references(() => socialProfiles.id, { onDelete: 'cascade' }),
  primaryGoal: varchar("primary_goal").notNull(), // 'drive_traffic', 'brand_awareness', 'generate_leads', 'grow_followers'
  postingFrequency: varchar("posting_frequency").notNull().default('daily'), // 'daily', '3-5_per_week', 'ai_optimized'
  brandTopics: text("brand_topics").array().notNull().default(sql`ARRAY[]::text[]`), // Keywords/topics for content
  targetAudience: text("target_audience"),
  brandVoice: varchar("brand_voice").default('professional'), // 'professional', 'casual', 'playful', 'authoritative'
  preferredPlatforms: text("preferred_platforms").array().notNull().default(sql`ARRAY[]::text[]`),
  websiteUrl: text("website_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("social_goals_profile_idx").on(table.socialProfileId),
]);

export const insertSocialGoalSchema = createInsertSchema(socialGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSocialGoalSchema = z.object({
  primaryGoal: z.enum(['drive_traffic', 'brand_awareness', 'generate_leads', 'grow_followers']).optional(),
  postingFrequency: z.enum(['daily', '3-5_per_week', 'ai_optimized']).optional(),
  brandTopics: z.array(z.string()).optional(),
  targetAudience: z.string().optional().nullable(),
  brandVoice: z.enum(['professional', 'casual', 'playful', 'authoritative']).optional(),
  preferredPlatforms: z.array(z.string()).optional(),
  websiteUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type InsertSocialGoal = z.infer<typeof insertSocialGoalSchema>;
export type UpdateSocialGoal = z.infer<typeof updateSocialGoalSchema>;
export type SocialGoal = typeof socialGoals.$inferSelect;

// Media item type for carousel/multi-media posts
export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  s3Key?: string;
  mimeType?: string;
  duration?: number; // For videos, in seconds
  width?: number;
  height?: number;
}

// Platform-specific data structure based on GetLate.dev API
export interface PlatformSpecificData {
  // Instagram
  collaborators?: string[];           // Up to 3 usernames for collaboration
  contentType?: 'feed' | 'story' | 'reel';
  
  // YouTube
  title?: string;                     // Video title
  privacyStatus?: 'public' | 'private' | 'unlisted';
  thumbnail?: string;                 // Custom thumbnail URL
  
  // TikTok
  tiktokSettings?: {
    privacy_level?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
    draft?: boolean;                  // Send to Creator Inbox
  };
  
  // Pinterest
  boardId?: string;                   // Target board ID
  link?: string;                      // Pin destination URL
  
  // Reddit
  subreddit?: string;                 // Target subreddit
  url?: string;                       // For link posts
  
  // Thread-based platforms (X, Threads, Bluesky)
  threadItems?: Array<{
    content: string;
    mediaUrl?: string;
  }>;
  
  // Universal first comment (Instagram, YouTube, Facebook, LinkedIn)
  firstComment?: string;
}

// Social posts - scheduled and published posts
export const socialPosts = pgTable("social_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialProfileId: varchar("social_profile_id").notNull().references(() => socialProfiles.id, { onDelete: 'cascade' }),
  getLatePostId: varchar("getlate_post_id"), // Post ID from GetLate.dev for scheduled posts
  uploadPostJobId: varchar("upload_post_job_id"), // Legacy: Job ID from Upload-Post (deprecated)
  postType: varchar("post_type").notNull(), // 'video', 'photo', 'text'
  contentType: varchar("content_type").notNull().default('post'), // 'post', 'reel', 'story', 'carousel', 'video', 'short', 'thread', 'pin', 'link', 'text'
  platforms: text("platforms").array().notNull(), // Target platforms
  title: text("title").notNull(),
  description: text("description"),
  platformTitles: jsonb("platform_titles").$type<Record<string, string>>(), // Platform-specific titles
  mediaUrl: text("media_url"), // URL to video/image in S3 (primary/single media)
  mediaType: varchar("media_type"), // 'video/mp4', 'image/jpeg', etc.
  mediaItems: jsonb("media_items").$type<MediaItem[]>(), // Multiple media items for carousels
  thumbnailUrl: text("thumbnail_url"),
  hashtags: text("hashtags").array().default(sql`ARRAY[]::text[]`),
  firstComment: text("first_comment"),
  platformSpecificData: jsonb("platform_specific_data").$type<Record<string, PlatformSpecificData>>(), // Per-platform specific options
  scheduledAt: timestamp("scheduled_at"), // When post should go live
  publishedAt: timestamp("published_at"), // When post actually went live
  status: varchar("status").notNull().default('draft'), // 'draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'
  aiGenerated: boolean("ai_generated").notNull().default(false), // Was this created by AI strategist
  aiPromptUsed: text("ai_prompt_used"), // The AI prompt that generated this post
  generationId: varchar("generation_id"), // Link to Artivio generation if applicable
  errorMessage: text("error_message"),
  platformResults: jsonb("platform_results").$type<Record<string, { success: boolean; postId?: string; url?: string; error?: string }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("social_posts_profile_idx").on(table.socialProfileId),
  index("social_posts_status_idx").on(table.status),
  index("social_posts_scheduled_idx").on(table.scheduledAt),
  index("social_posts_getlate_id_idx").on(table.getLatePostId),
  index("social_posts_content_type_idx").on(table.contentType),
]);

export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
  publishedAt: true,
  errorMessage: true,
  platformResults: true,
  createdAt: true,
  updatedAt: true,
});

// Zod schema for MediaItem
export const mediaItemSchema = z.object({
  type: z.enum(['image', 'video']),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
  s3Key: z.string().optional(),
  mimeType: z.string().optional(),
  duration: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

// Zod schema for PlatformSpecificData
export const platformSpecificDataSchema = z.object({
  collaborators: z.array(z.string()).optional(),
  contentType: z.enum(['feed', 'story', 'reel']).optional(),
  title: z.string().optional(),
  privacyStatus: z.enum(['public', 'private', 'unlisted']).optional(),
  thumbnail: z.string().optional(),
  tiktokSettings: z.object({
    privacy_level: z.enum(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY']).optional(),
    draft: z.boolean().optional(),
  }).optional(),
  boardId: z.string().optional(),
  link: z.string().optional(),
  subreddit: z.string().optional(),
  url: z.string().optional(),
  threadItems: z.array(z.object({
    content: z.string(),
    mediaUrl: z.string().optional(),
  })).optional(),
  firstComment: z.string().optional(),
});

export const updateSocialPostSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  contentType: z.enum(['post', 'reel', 'story', 'carousel', 'video', 'short', 'thread', 'pin', 'link', 'text']).optional(),
  platformTitles: z.record(z.string()).optional(),
  mediaItems: z.array(mediaItemSchema).optional().nullable(),
  hashtags: z.array(z.string()).optional(),
  firstComment: z.string().optional().nullable(),
  platformSpecificData: z.record(platformSpecificDataSchema).optional().nullable(),
  scheduledAt: z.date().optional(),
  status: z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled']).optional(),
});

export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type UpdateSocialPost = z.infer<typeof updateSocialPostSchema>;
export type SocialPost = typeof socialPosts.$inferSelect;

// Social analytics - stored performance data
export const socialAnalytics = pgTable("social_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialProfileId: varchar("social_profile_id").notNull().references(() => socialProfiles.id, { onDelete: 'cascade' }),
  platform: varchar("platform").notNull(),
  date: timestamp("date").notNull(),
  followers: integer("followers"),
  followersChange: integer("followers_change"),
  impressions: integer("impressions"),
  reach: integer("reach"),
  engagement: integer("engagement"),
  profileViews: integer("profile_views"),
  postsPublished: integer("posts_published").notNull().default(0),
  rawData: jsonb("raw_data"), // Full analytics response from GetLate.dev
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("social_analytics_profile_idx").on(table.socialProfileId),
  index("social_analytics_platform_idx").on(table.platform),
  index("social_analytics_date_idx").on(table.date),
  uniqueIndex("social_analytics_profile_platform_date_idx").on(table.socialProfileId, table.platform, table.date),
]);

export const insertSocialAnalyticsSchema = createInsertSchema(socialAnalytics).omit({
  id: true,
  createdAt: true,
});

export type InsertSocialAnalytics = z.infer<typeof insertSocialAnalyticsSchema>;
export type SocialAnalytics = typeof socialAnalytics.$inferSelect;

// ================================
// Social Brand Kit Tables (for Social Media Poster)
// ================================

// Social Brand Kits - Main brand configuration and identity for social media
export const socialBrandKits = pgTable("social_brand_kits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialProfileId: varchar("social_profile_id").notNull().references(() => socialProfiles.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull().default('My Brand'),
  
  // Business Overview & Positioning
  businessOverview: jsonb("business_overview").$type<{
    coreIdentity?: string;
    primaryPositioning?: string;
    secondaryPositioning?: string;
    tertiaryPositioning?: string;
    competitiveAdvantages?: string[];
  }>(),
  
  // Competitors
  competitors: jsonb("competitors").$type<{
    local?: string[];
    national?: string[];
  }>(),
  
  // Customer Demographics & Psychographics
  customerDemographics: jsonb("customer_demographics").$type<{
    primarySegments?: string[];
    ageRange?: string;
    location?: string;
    interests?: string[];
    painPoints?: string[];
    goals?: string[];
  }>(),
  
  // Visual Identity
  visualIdentityDescription: text("visual_identity_description"),
  logos: jsonb("logos").$type<{
    original?: string;
    dark?: string;
    light?: string;
  }>(),
  colors: jsonb("colors").$type<string[]>(), // Array of hex colors
  fonts: jsonb("fonts").$type<string[]>(), // Array of font names
  
  // Brand Voice
  brandVoice: jsonb("brand_voice").$type<{
    purpose?: string;
    audience?: string;
    tone?: string[];
    emotions?: string[];
    character?: string[];
    syntax?: string[];
    language?: string[];
  }>(),
  
  // Content Preferences
  contentPreferences: jsonb("content_preferences").$type<{
    featuredMediaTypes?: ('text' | 'image' | 'video')[];
    mediaKitPriority?: 'only_brand_kit' | 'brand_kit_first' | 'only_stock';
    reuseAfterWeeks?: number | null; // null = never reuse
    contentLanguage?: string;
    topicsToAvoid?: string[];
    alwaysIncludeMusic?: boolean;
    alwaysIncludeImages?: boolean;
    // AI Generation Settings
    aiSettings?: {
      preferredVideoModel?: 'veo_3_1_fast' | 'veo_3_1' | 'runway_gen3' | 'kling_2_5' | 'seedance_pro' | 'seedance_lite' | 'wan_2_5' | 'sora_2_pro';
      preferredImageModel?: 'seedream_4' | 'flux_kontext' | '4o_image' | 'nano_banana';
      preferredMusicModel?: 'suno_v4' | 'suno_v4_5' | 'suno_v5';
      dailyCreditBudget?: number; // Max credits per day for AI agent (0 = unlimited)
      automationLevel?: 'manual' | 'ai_suggests' | 'semi_auto' | 'full_auto';
      autoGenerationPercent?: number; // 0-100% of content that can be auto-generated
    };
  }>(),
  
  // LinkedIn Posting Persona - determines voice/perspective for LinkedIn content
  // 'founder' = First-person ownership ("I built...", "My company...")
  // 'power_user' = Personal experience focus ("I've been using...", "This tool helped me...")
  // 'affiliate' = Promotional style ("Check out...", referral-friendly)
  // 'professional' = Third-person discovery ("Came across this...", keeps distance)
  linkedinPersona: varchar("linkedin_persona").default('power_user'),
  
  // Scan Status
  scanStatus: varchar("scan_status").default('pending'), // 'pending', 'scanning', 'completed', 'failed'
  lastScanAt: timestamp("last_scan_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("social_brand_kits_profile_idx").on(table.socialProfileId),
]);

export const insertSocialBrandKitSchema = createInsertSchema(socialBrandKits).omit({
  id: true,
  scanStatus: true,
  lastScanAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSocialBrandKit = z.infer<typeof insertSocialBrandKitSchema>;
export type SocialBrandKit = typeof socialBrandKits.$inferSelect;

// Social Brand Materials - Website URLs and other source materials
export const socialBrandMaterials = pgTable("social_brand_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandKitId: varchar("brand_kit_id").notNull().references(() => socialBrandKits.id, { onDelete: 'cascade' }),
  type: varchar("type").notNull().default('website'), // 'website', 'document', 'file'
  name: varchar("name").notNull(),
  url: text("url").notNull(),
  fileType: varchar("file_type"), // 'website', 'pdf', 'doc', etc.
  lastUpdated: timestamp("last_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("social_brand_materials_kit_idx").on(table.brandKitId),
]);

export const insertSocialBrandMaterialSchema = createInsertSchema(socialBrandMaterials).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export type InsertSocialBrandMaterial = z.infer<typeof insertSocialBrandMaterialSchema>;
export type SocialBrandMaterial = typeof socialBrandMaterials.$inferSelect;

// Social Brand Assets - Images and videos for the brand kit
export const socialBrandAssets = pgTable("social_brand_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandKitId: varchar("brand_kit_id").notNull().references(() => socialBrandKits.id, { onDelete: 'cascade' }),
  type: varchar("type").notNull(), // 'image', 'video'
  filename: varchar("filename").notNull(),
  url: text("url").notNull(), // S3 URL or external URL
  thumbnailUrl: text("thumbnail_url"),
  mimeType: varchar("mime_type"),
  fileSize: integer("file_size"),
  folder: varchar("folder"), // Domain-based folder for organization (e.g., 'scan-example.com')
  sourceUrl: text("source_url"), // Original URL where asset was found
  isSuggested: boolean("is_suggested").default(false), // True for scan-discovered assets pending approval
  approvedAt: timestamp("approved_at"), // When user approved a suggested asset
  usageStatus: varchar("usage_status").default('unused'), // 'used', 'unused'
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("social_brand_assets_kit_idx").on(table.brandKitId),
  index("social_brand_assets_type_idx").on(table.type),
  index("social_brand_assets_folder_idx").on(table.folder),
]);

export const insertSocialBrandAssetSchema = createInsertSchema(socialBrandAssets).omit({
  id: true,
  usageStatus: true,
  lastUsedAt: true,
  approvedAt: true,
  createdAt: true,
});

export type InsertSocialBrandAsset = z.infer<typeof insertSocialBrandAssetSchema>;
export type SocialBrandAsset = typeof socialBrandAssets.$inferSelect;

// Social Brand Scan Jobs - Track website scanning jobs
export const socialBrandScanJobs = pgTable("social_brand_scan_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandKitId: varchar("brand_kit_id").notNull().references(() => socialBrandKits.id, { onDelete: 'cascade' }),
  targetUrl: text("target_url").notNull(),
  status: varchar("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  scanResult: jsonb("scan_result").$type<{
    progress?: number;
    status?: string;
    message?: string;
    colors?: string[];
    fonts?: string[];
    logos?: string[];
    domain?: string;
    usedHeadless?: boolean;
    images?: { url: string; type: string; alt?: string }[];
    textContent?: {
      title?: string;
      description?: string;
      tagline?: string;
      aboutContent?: string;
      socialLinks?: { platform: string; url: string }[];
      products?: string[];
      services?: string[];
    };
    error?: string;
  }>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("social_brand_scan_jobs_kit_idx").on(table.brandKitId),
  index("social_brand_scan_jobs_status_idx").on(table.status),
]);

export const insertSocialBrandScanJobSchema = createInsertSchema(socialBrandScanJobs).omit({
  id: true,
  status: true,
  scanResult: true,
  startedAt: true,
  completedAt: true,
  error: true,
  createdAt: true,
});

export type InsertSocialBrandScanJob = z.infer<typeof insertSocialBrandScanJobSchema>;
export type SocialBrandScanJob = typeof socialBrandScanJobs.$inferSelect;

// AI Content Plans - Generated social media content plans
export const aiContentPlans = pgTable("ai_content_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandKitId: varchar("brand_kit_id").notNull().references(() => socialBrandKits.id, { onDelete: 'cascade' }),
  scope: varchar("scope").notNull(), // 'week', 'month'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: varchar("status").notNull().default('draft'), // 'draft', 'approved', 'executing', 'completed', 'cancelled'
  plan: jsonb("plan").$type<{
    posts: {
      date: string;
      time: string;
      platforms: string[];
      contentType: string;
      caption: string;
      mediaPrompt?: string;
      hashtags?: string[];
      status: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'posted';
    }[];
    strategy?: string;
    contentPillars?: string[];
  }>(),
  executionProgress: jsonb("execution_progress").$type<{
    totalPosts: number;
    postsScheduled: number;
    postsPosted: number;
    postsFailed: number;
    lastUpdated: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("ai_content_plans_kit_idx").on(table.brandKitId),
  index("ai_content_plans_status_idx").on(table.status),
]);

export const insertAiContentPlanSchema = createInsertSchema(aiContentPlans).omit({
  id: true,
  status: true,
  executionProgress: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiContentPlan = z.infer<typeof insertAiContentPlanSchema>;
export type AiContentPlan = typeof aiContentPlans.$inferSelect;

// Social Media Hub Relations
export const socialProfilesRelations = relations(socialProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [socialProfiles.userId],
    references: [users.id],
  }),
  accounts: many(socialAccounts),
  goals: many(socialGoals),
  posts: many(socialPosts),
  analytics: many(socialAnalytics),
  socialBrandKit: one(socialBrandKits),
}));

// Social Brand Kit Relations
export const socialBrandKitsRelations = relations(socialBrandKits, ({ one, many }) => ({
  socialProfile: one(socialProfiles, {
    fields: [socialBrandKits.socialProfileId],
    references: [socialProfiles.id],
  }),
  materials: many(socialBrandMaterials),
  assets: many(socialBrandAssets),
  scanJobs: many(socialBrandScanJobs),
  contentPlans: many(aiContentPlans),
}));

export const socialBrandMaterialsRelations = relations(socialBrandMaterials, ({ one }) => ({
  brandKit: one(socialBrandKits, {
    fields: [socialBrandMaterials.brandKitId],
    references: [socialBrandKits.id],
  }),
}));

export const socialBrandAssetsRelations = relations(socialBrandAssets, ({ one }) => ({
  brandKit: one(socialBrandKits, {
    fields: [socialBrandAssets.brandKitId],
    references: [socialBrandKits.id],
  }),
}));

export const socialBrandScanJobsRelations = relations(socialBrandScanJobs, ({ one }) => ({
  brandKit: one(socialBrandKits, {
    fields: [socialBrandScanJobs.brandKitId],
    references: [socialBrandKits.id],
  }),
}));

export const aiContentPlansRelations = relations(aiContentPlans, ({ one }) => ({
  brandKit: one(socialBrandKits, {
    fields: [aiContentPlans.brandKitId],
    references: [socialBrandKits.id],
  }),
}));

export const socialAccountsRelations = relations(socialAccounts, ({ one }) => ({
  profile: one(socialProfiles, {
    fields: [socialAccounts.socialProfileId],
    references: [socialProfiles.id],
  }),
}));

export const socialGoalsRelations = relations(socialGoals, ({ one }) => ({
  profile: one(socialProfiles, {
    fields: [socialGoals.socialProfileId],
    references: [socialProfiles.id],
  }),
}));

export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
  profile: one(socialProfiles, {
    fields: [socialPosts.socialProfileId],
    references: [socialProfiles.id],
  }),
}));

export const socialAnalyticsRelations = relations(socialAnalytics, ({ one }) => ({
  profile: one(socialProfiles, {
    fields: [socialAnalytics.socialProfileId],
    references: [socialProfiles.id],
  }),
}));

// Story Projects Relations
export const storyProjectsRelations = relations(storyProjects, ({ one, many }) => ({
  user: one(users, {
    fields: [storyProjects.userId],
    references: [users.id],
  }),
  segments: many(storyProjectSegments),
}));

export const storyProjectSegmentsRelations = relations(storyProjectSegments, ({ one }) => ({
  project: one(storyProjects, {
    fields: [storyProjectSegments.projectId],
    references: [storyProjects.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const voiceClonesRelations = relations(voiceClones, ({ one }) => ({
  user: one(users, {
    fields: [voiceClones.userId],
    references: [users.id],
  }),
}));

export const ttsGenerationsRelations = relations(ttsGenerations, ({ one }) => ({
  user: one(users, {
    fields: [ttsGenerations.userId],
    references: [users.id],
  }),
}));

export const sttGenerationsRelations = relations(sttGenerations, ({ one }) => ({
  user: one(users, {
    fields: [sttGenerations.userId],
    references: [users.id],
  }),
}));

export const lyricsGenerationsRelations = relations(lyricsGenerations, ({ one }) => ({
  user: one(users, {
    fields: [lyricsGenerations.userId],
    references: [users.id],
  }),
}));

export const avatarGenerationsRelations = relations(avatarGenerations, ({ one }) => ({
  user: one(users, {
    fields: [avatarGenerations.userId],
    references: [users.id],
  }),
}));

export const audioConversionsRelations = relations(audioConversions, ({ one }) => ({
  user: one(users, {
    fields: [audioConversions.userId],
    references: [users.id],
  }),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(userSubscriptions),
}));

// Video Editor Relations
export const videoProjectsRelations = relations(videoProjects, ({ one, many }) => ({
  owner: one(users, {
    fields: [videoProjects.ownerUserId],
    references: [users.id],
  }),
  collaborators: many(projectCollaborators),
}));

export const brandKitsRelations = relations(brandKits, ({ one }) => ({
  user: one(users, {
    fields: [brandKits.userId],
    references: [users.id],
  }),
}));

export const projectCollaboratorsRelations = relations(projectCollaborators, ({ one }) => ({
  project: one(videoProjects, {
    fields: [projectCollaborators.projectId],
    references: [videoProjects.id],
  }),
  user: one(users, {
    fields: [projectCollaborators.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [projectCollaborators.invitedBy],
    references: [users.id],
  }),
}));
