CREATE TABLE "family_accounts" (
	"id" serial PRIMARY KEY,
	"identity_user_id" text NOT NULL UNIQUE,
	"email" text NOT NULL UNIQUE,
	"player_name" text NOT NULL,
	"player_team" text NOT NULL,
	"parent_name" text NOT NULL,
	"pin_salt" text NOT NULL,
	"pin_hash" text NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
