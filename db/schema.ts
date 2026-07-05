import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const bookingRequests = pgTable("booking_requests", {
  id: serial().primaryKey(),
  slotId: text("slot_id").notNull(),
  slotType: text("slot_type").notNull(),
  slotDate: text("slot_date").notNull(),
  slotTime: text("slot_time").notNull(),
  slotDuration: text("slot_duration").notNull(),
  slotTeam: text("slot_team").notNull(),
  playerName: text("player_name").notNull(),
  playerTeam: text("player_team").notNull(),
  status: text().notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// A reusable "forever" SMS QR code. The printed QR encodes a fixed URL
// (/q/<slug>); the phone number and message live here so they can be changed
// any time without reprinting the code.
export const smsQrCodes = pgTable("sms_qr_codes", {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  label: text().notNull().default(""),
  phone: text().notNull().default(""),
  message: text().notNull().default(""),
  notifyOnScan: boolean("notify_on_scan").notNull().default(false),
  notificationPhone: text("notification_phone").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// One row per scan of an SMS QR code.
export const smsQrScans = pgTable("sms_qr_scans", {
  id: serial().primaryKey(),
  slug: text().notNull(),
  userAgent: text("user_agent"),
  referer: text(),
  country: text(),
  city: text(),
  scannedAt: timestamp("scanned_at").defaultNow(),
});
