CREATE TABLE "sms_qr_codes" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"label" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_qr_scans" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL,
	"user_agent" text,
	"referer" text,
	"country" text,
	"city" text,
	"scanned_at" timestamp DEFAULT now()
);
