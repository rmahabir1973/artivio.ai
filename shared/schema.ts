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
    'veo-3.1',
    'veo-3.1-fast',
    'veo-3',
    'runway-gen3-alpha-turbo',
    'runway-gen4',
    'runway-gen4-turbo',
    'runway-aleph',
    'sora-2',
    'sora-2-pro',
    'hailuo-2.3',
    'kling-2.5-turbo',
    'wan-2.5'
  ]),
  prompt: z.string().min(1).max(2000),
  generationType: z.enum(['text-to-video', 'image-to-video']).optional(),
  referenceImages: z.array(z.string().url()).max(3).optional(), // Up to 3 images for Veo
  parameters: z.object({
    duration: z.number().optional(), // Duration in seconds (5, 10, 15, etc.)
    quality: z.enum(['720p', '1080p']).optional(), // For Runway
    aspectRatio: z.enum(['16:9', '9:16', '4:3', '1:1', '3:4', 'Auto']).optional(),
  }).optional(),
});

export const generateImageRequestSchema = z.object({
  model: z.enum(['4o-image', 'flux-kontext', 'nano-banana']),
  prompt: z.string().min(1).max(2000),
  parameters: z.object({
    aspectRatio: z.string().optional(),
    style: z.string().optional(),
  }).optional(),
});

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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  generations: many(generations),
}));

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, {
    fields: [generations.userId],
    references: [users.id],
  }),
}));
