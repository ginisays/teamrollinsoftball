import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { smsQrCodes, smsQrScans } from "../../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";

const DEFAULT_SLUG = "sms";
const DEFAULT_MESSAGE = "Hi! I'm reaching out about Team Rollin softball.";

// Fetch the QR code config row, creating a default one the first time it's
// requested so the dashboard always has something to edit.
async function getOrCreateCode(slug: string) {
  const [existing] = await db
    .select()
    .from(smsQrCodes)
    .where(eq(smsQrCodes.slug, slug));
  if (existing) return existing;

  const [created] = await db
    .insert(smsQrCodes)
    .values({
      slug,
      label: "Team Rollin SMS",
      phone: "",
      message: DEFAULT_MESSAGE,
      notifyOnScan: false,
      notificationPhone: "",
    })
    .returning();
  return created;
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || DEFAULT_SLUG;

  // GET /api/sms-qr/scans — the scan log plus a few headline stats.
  if (url.pathname.endsWith("/scans") && req.method === "GET") {
    const rows = await db
      .select()
      .from(smsQrScans)
      .where(eq(smsQrScans.slug, slug))
      .orderBy(desc(smsQrScans.scannedAt))
      .limit(200);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(smsQrScans)
      .where(eq(smsQrScans.slug, slug));

    return Response.json({ total, scans: rows });
  }

  // GET /api/sms-qr/config — current number/message for the dashboard.
  if (url.pathname.endsWith("/config") && req.method === "GET") {
    const code = await getOrCreateCode(slug);
    const scanUrl = `${url.origin}/q/${slug}`;
    return Response.json({ ...code, scanUrl });
  }

  // POST /api/sms-qr/config — update number/message/label. The slug (and the
  // printed QR) never changes here.
  if (url.pathname.endsWith("/config") && req.method === "POST") {
    const body = await req.json();
    await getOrCreateCode(slug);

    const [updated] = await db
      .update(smsQrCodes)
      .set({
        label: typeof body.label === "string" ? body.label : undefined,
        phone: typeof body.phone === "string" ? body.phone.trim() : undefined,
        message: typeof body.message === "string" ? body.message : undefined,
        notifyOnScan: typeof body.notifyOnScan === "boolean" ? body.notifyOnScan : undefined,
        notificationPhone: typeof body.notificationPhone === "string" ? body.notificationPhone.trim() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(smsQrCodes.slug, slug))
      .returning();

    const scanUrl = `${url.origin}/q/${slug}`;
    return Response.json({ ...updated, scanUrl });
  }

  return new Response("Not found", { status: 404 });
};

export const config: Config = {
  path: [
    "/api/sms-qr/config",
    "/api/sms-qr/scans",
  ],
};
