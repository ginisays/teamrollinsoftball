ALTER TABLE "sms_qr_codes"
ADD COLUMN "notify_on_scan" boolean DEFAULT false NOT NULL,
ADD COLUMN "notification_phone" text DEFAULT '' NOT NULL;
