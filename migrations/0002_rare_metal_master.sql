CREATE TABLE "blog_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"excerpt" varchar(300),
	"author" varchar(100) DEFAULT 'Artivio Team' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"category" varchar(50) DEFAULT 'Announcement' NOT NULL,
	"featured_image_url" text,
	"meta_description" varchar(200),
	"published_date" timestamp,
	"updated_date" timestamp,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "brand_kits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(100) DEFAULT 'Default' NOT NULL,
	"palettes" jsonb,
	"fonts" jsonb,
	"logos" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brand_kits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"parent_id" varchar,
	"color" varchar(7),
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_tags" (
	"generation_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL,
	CONSTRAINT "generation_tags_generation_id_tag_id_pk" PRIMARY KEY("generation_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "project_collaborators" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	"invited_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"key_prefix" varchar NOT NULL,
	"key_hash" text NOT NULL,
	"last_four_chars" varchar NOT NULL,
	"permissions" text[] DEFAULT ARRAY['video', 'image', 'audio']::text[] NOT NULL,
	"rate_limit" integer DEFAULT 100 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_seeds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"seed" integer NOT NULL,
	"description" text,
	"preview_image_url" text,
	"generation_id" varchar,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_stock_images" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source" varchar NOT NULL,
	"external_id" varchar NOT NULL,
	"preview_url" text NOT NULL,
	"webformat_url" text NOT NULL,
	"large_url" text NOT NULL,
	"original_url" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"tags" text,
	"photographer" varchar,
	"photographer_url" text,
	"page_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_profile_id" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"platform_username" varchar,
	"platform_display_name" varchar,
	"platform_image_url" text,
	"is_connected" boolean DEFAULT true NOT NULL,
	"daily_cap" integer NOT NULL,
	"posts_today" integer DEFAULT 0 NOT NULL,
	"last_post_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_profile_id" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"followers" integer,
	"followers_change" integer,
	"impressions" integer,
	"reach" integer,
	"engagement" integer,
	"profile_views" integer,
	"posts_published" integer DEFAULT 0 NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_profile_id" varchar NOT NULL,
	"primary_goal" varchar NOT NULL,
	"posting_frequency" varchar DEFAULT 'daily' NOT NULL,
	"brand_topics" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"target_audience" text,
	"brand_voice" varchar DEFAULT 'professional',
	"preferred_platforms" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"website_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_profile_id" varchar NOT NULL,
	"getlate_post_id" varchar,
	"upload_post_job_id" varchar,
	"post_type" varchar NOT NULL,
	"content_type" varchar DEFAULT 'post' NOT NULL,
	"platforms" text[] NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"platform_titles" jsonb,
	"media_url" text,
	"media_type" varchar,
	"media_items" jsonb,
	"thumbnail_url" text,
	"hashtags" text[] DEFAULT ARRAY[]::text[],
	"first_comment" text,
	"platform_specific_data" jsonb,
	"scheduled_at" timestamp,
	"published_at" timestamp,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"ai_prompt_used" text,
	"generation_id" varchar,
	"error_message" text,
	"platform_results" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"getlate_profile_id" varchar,
	"upload_post_username" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_accounts_count" integer DEFAULT 0 NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_project_segments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"order_index" integer NOT NULL,
	"speaker_label" varchar(100),
	"voice_id" varchar,
	"voice_name" varchar(200),
	"text" text NOT NULL,
	"emotion_tags" text[],
	"duration_ms" integer,
	"audio_url" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"mode" varchar DEFAULT 'instant' NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"settings" jsonb,
	"total_duration_ms" integer,
	"combined_audio_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(7) DEFAULT '#6366F1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"timeline_data" jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"thumbnail_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pricing" ALTER COLUMN "kie_credit_cost" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "result_urls" text[];--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "seed" integer;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "collection_id" varchar;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "is_showcase" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "pricing_video_url" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "demo_video_url" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_video" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_image" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_transition" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_sora" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_grok" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_sound_effects" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_music" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_voice_clone" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_lip_sync" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_tts" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_stt" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_upscaler" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_video_upscaler" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_bg_remover" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_talking_avatar" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_product_ad" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_influencer_ad" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_logo_animation" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_unboxing" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_flash_sale" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_brand_story" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_testimonial" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_social_promo" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_before_after" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "preview_video_brand_showcase" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "welcome_video_url" text;--> statement-breakpoint
ALTER TABLE "home_page_content" ADD COLUMN "welcome_slides" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "monthly_price" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "annual_price" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "savings_percentage" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_token" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_expires" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_seen_welcome" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_social_poster" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "social_poster_subscription_id" varchar;--> statement-breakpoint
ALTER TABLE "video_combinations" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_tags" ADD CONSTRAINT "generation_tags_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_tags" ADD CONSTRAINT "generation_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_project_id_video_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."video_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_collaborators" ADD CONSTRAINT "project_collaborators_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_api_keys" ADD CONSTRAINT "public_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_seeds" ADD CONSTRAINT "saved_seeds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_stock_images" ADD CONSTRAINT "saved_stock_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_social_profile_id_social_profiles_id_fk" FOREIGN KEY ("social_profile_id") REFERENCES "public"."social_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_analytics" ADD CONSTRAINT "social_analytics_social_profile_id_social_profiles_id_fk" FOREIGN KEY ("social_profile_id") REFERENCES "public"."social_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_goals" ADD CONSTRAINT "social_goals_social_profile_id_social_profiles_id_fk" FOREIGN KEY ("social_profile_id") REFERENCES "public"."social_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_social_profile_id_social_profiles_id_fk" FOREIGN KEY ("social_profile_id") REFERENCES "public"."social_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_project_segments" ADD CONSTRAINT "story_project_segments_project_id_story_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."story_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_projects" ADD CONSTRAINT "story_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_projects" ADD CONSTRAINT "video_projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_status_idx" ON "blog_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_posts_category_idx" ON "blog_posts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "blog_posts_published_date_idx" ON "blog_posts" USING btree ("published_date");--> statement-breakpoint
CREATE INDEX "collections_user_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collections_parent_idx" ON "collections" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_collaborators_project_user_idx" ON "project_collaborators" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_collaborators_project_idx" ON "project_collaborators" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_collaborators_user_idx" ON "project_collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "public_api_key_user_idx" ON "public_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "public_api_key_hash_idx" ON "public_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "saved_seeds_user_idx" ON "saved_seeds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_seeds_user_created_idx" ON "saved_seeds" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_stock_images_user_idx" ON "saved_stock_images" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_stock_images_source_idx" ON "saved_stock_images" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_stock_images_user_external_idx" ON "saved_stock_images" USING btree ("user_id","source","external_id");--> statement-breakpoint
CREATE INDEX "social_accounts_profile_idx" ON "social_accounts" USING btree ("social_profile_id");--> statement-breakpoint
CREATE INDEX "social_accounts_platform_idx" ON "social_accounts" USING btree ("platform");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_profile_platform_idx" ON "social_accounts" USING btree ("social_profile_id","platform");--> statement-breakpoint
CREATE INDEX "social_analytics_profile_idx" ON "social_analytics" USING btree ("social_profile_id");--> statement-breakpoint
CREATE INDEX "social_analytics_platform_idx" ON "social_analytics" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "social_analytics_date_idx" ON "social_analytics" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "social_analytics_profile_platform_date_idx" ON "social_analytics" USING btree ("social_profile_id","platform","date");--> statement-breakpoint
CREATE INDEX "social_goals_profile_idx" ON "social_goals" USING btree ("social_profile_id");--> statement-breakpoint
CREATE INDEX "social_posts_profile_idx" ON "social_posts" USING btree ("social_profile_id");--> statement-breakpoint
CREATE INDEX "social_posts_status_idx" ON "social_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "social_posts_scheduled_idx" ON "social_posts" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "social_posts_getlate_id_idx" ON "social_posts" USING btree ("getlate_post_id");--> statement-breakpoint
CREATE INDEX "social_posts_content_type_idx" ON "social_posts" USING btree ("content_type");--> statement-breakpoint
CREATE UNIQUE INDEX "social_profiles_user_idx" ON "social_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "social_profiles_getlate_idx" ON "social_profiles" USING btree ("getlate_profile_id");--> statement-breakpoint
CREATE INDEX "story_segments_project_idx" ON "story_project_segments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "story_segments_order_idx" ON "story_project_segments" USING btree ("project_id","order_index");--> statement-breakpoint
CREATE INDEX "story_projects_user_idx" ON "story_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "story_projects_status_idx" ON "story_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tags_user_idx" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_idx" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "video_projects_owner_idx" ON "video_projects" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generations_collection_idx" ON "generations" USING btree ("collection_id");