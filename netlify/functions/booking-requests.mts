import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { bookingRequests } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";

export default async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "GET") {
    const status = url.searchParams.get("status");
    let rows;
    if (status) {
      rows = await db
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.status, status))
        .orderBy(desc(bookingRequests.createdAt));
    } else {
      rows = await db
        .select()
        .from(bookingRequests)
        .orderBy(desc(bookingRequests.createdAt));
    }
    return Response.json(rows);
  }

  if (req.method === "POST") {
    const body = await req.json();

    if (action === "submit") {
      const existing = await db
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.slotId, body.slotId));
      const alreadyPending = existing.find(
        (r: any) =>
          r.status === "pending" &&
          r.playerName === body.playerName &&
          r.playerTeam === body.playerTeam
      );
      if (alreadyPending) {
        return Response.json(
          { error: "You already have a pending request for this slot" },
          { status: 400 }
        );
      }
      const alreadyApproved = existing.find(
        (r: any) => r.status === "approved"
      );
      if (alreadyApproved) {
        return Response.json(
          { error: "This slot has already been booked" },
          { status: 400 }
        );
      }

      const [row] = await db
        .insert(bookingRequests)
        .values({
          slotId: body.slotId,
          slotType: body.slotType,
          slotDate: body.slotDate,
          slotTime: body.slotTime,
          slotDuration: String(body.slotDuration),
          slotTeam: body.slotTeam,
          playerName: body.playerName,
          playerTeam: body.playerTeam,
          status: "pending",
        })
        .returning();
      return Response.json(row, { status: 201 });
    }

    if (action === "approve") {
      const [row] = await db
        .update(bookingRequests)
        .set({
          status: "approved",
          reviewedBy: body.reviewedBy || "Executive Director",
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.id, body.id))
        .returning();
      if (!row) {
        return Response.json({ error: "Request not found" }, { status: 404 });
      }
      return Response.json(row);
    }

    if (action === "deny") {
      const [row] = await db
        .update(bookingRequests)
        .set({
          status: "denied",
          reviewedBy: body.reviewedBy || "Executive Director",
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.id, body.id))
        .returning();
      if (!row) {
        return Response.json({ error: "Request not found" }, { status: 404 });
      }
      return Response.json(row);
    }

    if (action === "cancel") {
      const [row] = await db
        .update(bookingRequests)
        .set({
          status: "cancelled",
          reviewedBy: body.reviewedBy || null,
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.id, body.id))
        .returning();
      if (!row) {
        return Response.json({ error: "Request not found" }, { status: 404 });
      }
      return Response.json(row);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/booking-requests",
};
