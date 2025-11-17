CREATE TABLE "announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"type" varchar DEFAULT 'info' NOT NULL,
	"target_plans" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_name" varchar NOT NULL,
	"key_value" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_name_unique" UNIQUE("key_name")
);
--> statement-breakpoint
CREATE TABLE "audio_conversions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source_url" text NOT NULL,
	"source_format" varchar NOT NULL,
	"target_format" varchar NOT NULL,
	"compression_level" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"result_url" text,
	"error_message" text,
	"credits_cost" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "avatar_generations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source_image_url" text NOT NULL,
	"script" text NOT NULL,
	"voice_id" varchar,
	"provider" varchar DEFAULT 'd-id' NOT NULL,
	"parameters" jsonb,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"result_url" text,
	"error_message" text,
	"credits_cost" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar DEFAULT 'New Chat' NOT NULL,
	"provider" varchar NOT NULL,
	"model" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"type" varchar NOT NULL,
	"description" text,
	"related_entity_type" varchar,
	"related_entity_id" varchar,
	"performed_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"workflow_id" integer NOT NULL,
	"workflow_title" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_key" varchar NOT NULL,
	"feature_name" varchar NOT NULL,
	"feature_category" varchar NOT NULL,
	"credits_cost" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feature_pricing_feature_key_unique" UNIQUE("feature_key")
);
--> statement-breakpoint
CREATE TABLE "generation_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"feature_type" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"prompt" text NOT NULL,
	"model" varchar,
	"parameters" jsonb,
	"is_public" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"generation_type" varchar,
	"processing_stage" varchar DEFAULT 'generation' NOT NULL,
	"parent_generation_id" varchar,
	"model" varchar NOT NULL,
	"prompt" text NOT NULL,
	"reference_images" text[],
	"parameters" jsonb,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"result_url" text,
	"external_task_id" varchar,
	"status_detail" text,
	"error_message" text,
	"credits_cost" integer NOT NULL,
	"api_key_used" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "home_page_content" (
	"id" varchar PRIMARY KEY DEFAULT 'homepage' NOT NULL,
	"hero_title" text DEFAULT 'Create any video you can imagine' NOT NULL,
	"hero_subtitle" text DEFAULT 'Generate stunning videos, images, and music with powerful AI models' NOT NULL,
	"hero_video_url" text,
	"hero_image_url" text,
	"showcase_videos" jsonb DEFAULT '[]'::jsonb,
	"feature_video_url" text,
	"feature_image_url" text,
	"feature_music_url" text,
	"creators_title" text DEFAULT 'Creators',
	"creators_description" text,
	"creators_image_url" text,
	"business_title" text DEFAULT 'Businesses',
	"business_description" text,
	"business_image_url" text,
	"faqs" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_analyses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"image_url" text NOT NULL,
	"analysis_prompt" text,
	"analysis_result" jsonb,
	"model" varchar DEFAULT 'gpt-4o' NOT NULL,
	"provider" varchar DEFAULT 'openai' NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"credits_cost" integer NOT NULL,
	"api_key_used" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lyrics_generations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"prompt" text NOT NULL,
	"lyrics_text" text,
	"lyrics_title" varchar,
	"external_task_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"credits_cost" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	"content" text NOT NULL,
	"credits_cost" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature" varchar NOT NULL,
	"model" varchar NOT NULL,
	"credit_cost" integer NOT NULL,
	"category" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" varchar NOT NULL,
	"referral_code" varchar NOT NULL,
	"referee_id" varchar,
	"referee_email" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"referrer_credits_earned" integer DEFAULT 0 NOT NULL,
	"referee_credits_given" integer DEFAULT 0 NOT NULL,
	"converted_at" timestamp,
	"credited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"event_id" varchar PRIMARY KEY NOT NULL,
	"event_type" varchar NOT NULL,
	"object_id" varchar,
	"processed" boolean DEFAULT true NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stt_generations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"audio_url" text NOT NULL,
	"model" varchar DEFAULT 'whisper-1' NOT NULL,
	"language" varchar,
	"transcription" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"credits_cost" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"stripe_product_id" varchar,
	"stripe_price_id" varchar,
	"price" integer NOT NULL,
	"billing_period" varchar DEFAULT 'monthly' NOT NULL,
	"trial_days" integer DEFAULT 0,
	"features" jsonb,
	"credits_per_month" integer NOT NULL,
	"credit_rollover_limit" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_name_unique" UNIQUE("name"),
	CONSTRAINT "subscription_plans_stripe_price_id_unique" UNIQUE("stripe_price_id")
);
--> statement-breakpoint
CREATE TABLE "tts_generations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"text" text NOT NULL,
	"voice_id" varchar NOT NULL,
	"voice_name" varchar,
	"model" varchar NOT NULL,
	"parameters" jsonb,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"result_url" text,
	"error_message" text,
	"credits_cost" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_onboarding" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"explored_workflows" boolean DEFAULT false NOT NULL,
	"tried_template" boolean DEFAULT false NOT NULL,
	"completed_first_generation" boolean DEFAULT false NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_onboarding_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"stripe_subscription_id" varchar,
	"stripe_customer_id" varchar,
	"status" varchar DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"credits_granted_this_period" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"credits" integer DEFAULT 0 NOT NULL,
	"stripe_customer_id" varchar,
	"is_admin" boolean DEFAULT false NOT NULL,
	"referral_code" varchar,
	"referred_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "video_combination_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"combination_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_combinations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source_video_ids" text[] NOT NULL,
	"output_path" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"credits_cost" integer NOT NULL,
	"duration_seconds" integer,
	"task_id" varchar,
	"enhancements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"has_transitions" boolean DEFAULT false NOT NULL,
	"has_background_music" boolean DEFAULT false NOT NULL,
	"has_text_overlays" boolean DEFAULT false NOT NULL,
	"has_speed_adjustment" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "voice_clones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"voice_id" varchar NOT NULL,
	"description" text,
	"provider" varchar DEFAULT 'elevenlabs' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_conversions" ADD CONSTRAINT "audio_conversions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_generations" ADD CONSTRAINT "avatar_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_workflows" ADD CONSTRAINT "favorite_workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_pricing" ADD CONSTRAINT "feature_pricing_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_templates" ADD CONSTRAINT "generation_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_analyses" ADD CONSTRAINT "image_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lyrics_generations" ADD CONSTRAINT "lyrics_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stt_generations" ADD CONSTRAINT "stt_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tts_generations" ADD CONSTRAINT "tts_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_combination_events" ADD CONSTRAINT "video_combination_events_combination_id_video_combinations_id_fk" FOREIGN KEY ("combination_id") REFERENCES "public"."video_combinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_combinations" ADD CONSTRAINT "video_combinations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_clones" ADD CONSTRAINT "voice_clones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_workflow_idx" ON "favorite_workflows" USING btree ("user_id","workflow_id");--> statement-breakpoint
CREATE INDEX "image_analyses_user_created_idx" ON "image_analyses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "image_analyses_idempotency_idx" ON "image_analyses" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_model_idx" ON "pricing" USING btree ("feature","model");--> statement-breakpoint
CREATE INDEX "referrer_idx" ON "referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "referee_idx" ON "referrals" USING btree ("referee_id");--> statement-breakpoint
CREATE INDEX "referral_code_idx" ON "referrals" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "status_idx" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "referrer_referee_email_idx" ON "referrals" USING btree ("referrer_id","referee_email") WHERE "referrals"."referee_email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "video_combination_events_combination_idx" ON "video_combination_events" USING btree ("combination_id","created_at");--> statement-breakpoint
CREATE INDEX "video_combinations_user_created_idx" ON "video_combinations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "video_combinations_task_idx" ON "video_combinations" USING btree ("task_id");