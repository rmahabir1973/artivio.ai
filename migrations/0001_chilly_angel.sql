CREATE TABLE "plan_economics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kie_purchase_amount" integer DEFAULT 50 NOT NULL,
	"kie_credit_amount" integer DEFAULT 10000 NOT NULL,
	"user_credit_amount" integer DEFAULT 15000 NOT NULL,
	"profit_margin" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token_id" varchar NOT NULL,
	"token_hash" text NOT NULL,
	"token_version" integer NOT NULL,
	"device_info" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_id_unique" UNIQUE("token_id")
);
--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "pricing" ADD COLUMN "kie_credit_cost" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" varchar DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "token_id_idx" ON "refresh_tokens" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "generations_user_created_idx" ON "generations" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");