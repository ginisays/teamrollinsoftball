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

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function scanLocation(context: Context): string {
  return [context.geo?.city, context.geo?.country?.name].filter(Boolean).join(", ") || "Unknown location";
}

function deviceOf(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  if (/iphone|ipad|ios/i.test(userAgent)) return "iOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/macintosh/i.test(userAgent)) return "Mac";
  if (/windows/i.test(userAgent)) return "Windows";
  return "Other device";
}

async function sendScanNotification(code: typeof smsQrCodes.$inferSelect, req: Request, context: Context) {
  if (!code.notifyOnScan || !code.notificationPhone) return;

  const env = (name: string) =>
    (globalThis as { Netlify?: { env?: { get?: (key: string) => string | undefined } } }).Netlify?.env?.get?.(name) ||
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN");
  const fromNumber = env("TWILIO_FROM_NUMBER");
  if (!accountSid || !authToken || !fromNumber) {
    console.warn("SMS QR scan notification skipped: Twilio environment variables are not configured");
    return;
  }

  const scannedAt = new Date().toLocaleString("en-US", {
    timeZone: context.geo?.timezone || "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const body = [
    `Team Rollin QR scan: ${code.label || code.slug}`,
    `${scannedAt} from ${scanLocation(context)}`,
    `Device: ${deviceOf(req.headers.get("user-agent"))}`,
  ].join("\n");

  const params = new URLSearchParams({
    To: cleanPhone(code.notificationPhone),
    From: cleanPhone(fromNumber),
    Body: body,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Twilio returned ${res.status}`);
  }
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

  try {
    context.waitUntil(sendScanNotification(code, req, context).catch((err) => {
      console.error("Failed to send SMS QR scan notification", err);
    }));
  } catch (err) {
    console.error("Failed to queue SMS QR scan notification", err);
  }

  return Response.redirect(smsUri(code.phone, code.message), 302);
};

export const config: Config = {
  path: "/q/:slug",
};
