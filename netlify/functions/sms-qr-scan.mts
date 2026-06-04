import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { smsQrCodes, smsQrScans } from "../../db/schema.js";
import { eq } from "drizzle-orm";

// Build a cross-platform `sms:` URI. The leading "?&" is the widely used trick
// that gets a pre-filled body to populate on both iOS and Android.
function smsUri(phone: string, message: string): string {
  const cleanedPhone = phone.replace(/[^\d+]/g, "");
  if (!message) return `sms:${cleanedPhone}`;
  return `sms:${cleanedPhone}?&body=${encodeURIComponent(message)}`;
}

export default async (req: Request, context: Context) => {
  const slug = context.params?.slug;

  if (!slug) {
    return new Response("Not found", { status: 404 });
  }

  const [code] = await db
    .select()
    .from(smsQrCodes)
    .where(eq(smsQrCodes.slug, slug));

  // The QR is printed once and points here forever. If the code has not been
  // set up (or has no number yet), send the visitor to the dashboard instead
  // of failing, so a freshly printed code is never a dead end.
  if (!code || !code.phone) {
    return Response.redirect(new URL("/sms-qr.html", req.url).toString(), 302);
  }

  // Logging must never block the redirect — a scan that can't be recorded should
  // still open the messaging app.
  try {
    await db.insert(smsQrScans).values({
      slug,
      userAgent: req.headers.get("user-agent"),
      referer: req.headers.get("referer"),
      country: context.geo?.country?.name ?? null,
      city: context.geo?.city ?? null,
    });
  } catch (err) {
    console.error("Failed to log SMS QR scan", err);
  }

  return Response.redirect(smsUri(code.phone, code.message), 302);
};

export const config: Config = {
  path: "/q/:slug",
};
