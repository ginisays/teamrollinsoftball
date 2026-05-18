CREATE TABLE "booking_requests" (
	"id" serial PRIMARY KEY,
	"slot_id" text NOT NULL,
	"slot_type" text NOT NULL,
	"slot_date" text NOT NULL,
	"slot_time" text NOT NULL,
	"slot_duration" text NOT NULL,
	"slot_team" text NOT NULL,
	"player_name" text NOT NULL,
	"player_team" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
