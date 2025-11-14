import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  credits: integer("credits").notNull().default(1000),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// API Keys table for round-robin rotation
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyName: varchar("key_name").notNull().unique(), // e.g., "KIE_API_KEY_1"
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

// Generations table for tracking all AI generations
export const generations = pgTable("generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type").notNull(), // 'video', 'image', 'music'
  generationType: varchar("generation_type"), // 'text-to-video', 'image-to-video', null for image/music
  model: varchar("model").notNull(), // e.g., 'veo-3.1', 'flux-kontext', 'suno-v4'
  prompt: text("prompt").notNull(),
  referenceImages: text("reference_images").array(), // Image URLs for image-to-video (up to 3 for Veo)
  parameters: jsonb("parameters"), // Store generation parameters
  status: varchar("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  resultUrl: text("result_url"), // URL to generated content
  errorMessage: text("error_message"),
  creditsCost: integer("credits_cost").notNull(),
  apiKeyUsed: varchar("api_key_used"), // Which API key was used
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertGenerationSchema = createInsertSchema(generations).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generations.$inferSelect;

// Request validation schemas for generation endpoints
export const generateVideoRequestSchema = z.object({
  model: z.enum([
    'veo-3',
    'veo-3.1',
    'veo-3.1-fast',
    'runway-gen3-alpha-turbo',
    'runway-aleph',
  ]),
  prompt: z.string().min(1).max(2000),
  generationType: z.enum(['text-to-video', 'image-to-video']).optional(),
  referenceImages: z.array(z.string().url()).max(3).optional(), // Up to 3 images for Veo
  veoSubtype: z.enum(['TEXT_2_VIDEO', 'REFERENCE_2_VIDEO', 'FIRST_AND_LAST_FRAMES_2_VIDEO']).optional(), // Explicit Veo generation subtype
  parameters: z.object({
    duration: z.number().optional(), // Duration in seconds (5, 10 for Runway)
    quality: z.enum(['720p', '1080p']).optional(), // For Runway
    aspectRatio: z.enum(['16:9', '9:16', '4:3', '1:1', '3:4', 'Auto']).optional(),
  }).optional(),
});

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

export const generateImageRequestSchema = z.object({
  model: z.enum(['4o-image', 'flux-kontext', 'nano-banana']),
  prompt: z.string().min(1).max(2000),
  mode: z.enum(['text-to-image', 'image-editing']).default('text-to-image'),
  referenceImages: z.array(base64ImageSchema).max(10).optional(), // Max 10 images, each validated
  parameters: z.object({
    aspectRatio: z.string().optional(),
    style: z.string().optional(),
    outputFormat: z.enum(['PNG', 'JPEG', 'WEBP']).optional(),
    quality: z.enum(['standard', 'hd']).optional(),
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
  model: z.enum(['suno-v3.5', 'suno-v4', 'suno-v4.5']),
  prompt: z.string().min(1).max(2000),
  parameters: z.object({
    lyrics: z.string().optional(),
    duration: z.number().optional(),
    genre: z.string().optional(),
  }).optional(),
});

export type GenerateVideoRequest = z.infer<typeof generateVideoRequestSchema>;
export type GenerateImageRequest = z.infer<typeof generateImageRequestSchema>;
export type GenerateMusicRequest = z.infer<typeof generateMusicRequestSchema>;

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

// Subscription Plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // 'Free Trial', 'Starter', 'Pro', etc.
  displayName: varchar("display_name").notNull(), // For UI
  description: text("description"),
  price: integer("price").notNull(), // Price in cents (e.g., 1999 for $19.99)
  billingPeriod: varchar("billing_period").notNull().default('monthly'), // 'monthly', 'annual', 'trial'
  trialDays: integer("trial_days").default(0), // Days for trial period
  features: jsonb("features"), // List of features/limits
  creditsPerMonth: integer("credits_per_month").notNull(), // Monthly credit allocation
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeCustomerId: varchar("stripe_customer_id"),
  status: varchar("status").notNull().default('active'), // 'active', 'cancelled', 'expired', 'trial'
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
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

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;

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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  generations: many(generations),
  conversations: many(conversations),
  voiceClones: many(voiceClones),
  ttsGenerations: many(ttsGenerations),
  sttGenerations: many(sttGenerations),
  avatarGenerations: many(avatarGenerations),
  audioConversions: many(audioConversions),
  subscriptions: many(userSubscriptions),
}));

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, {
    fields: [generations.userId],
    references: [users.id],
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
