import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
