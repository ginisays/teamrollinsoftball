import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { smsQrCodes, smsQrScans } from "../../db/schema.js";
import { eq } from "drizzle-orm";

const DEFAULT_SLUG = "team-rollin-text";
const LEGACY_SLUG = "sms";

function smsUri(phone: string, message: string): string {
  const cleanedPhone = phone.replace(/[^\d+]/g, "");
  if (!message) return `sms:${cleanedPhone}`;
  return `sms:${cleanedPhone}?&body=${encodeURIComponent(message)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] as string);
}

function launchPage(label: string, uri: string): Response {
  const safeLabel = escapeHtml(label || "Team Rollin");
  const safeUri = escapeHtml(uri);
  const scriptUri = JSON.stringify(uri).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Text ${safeLabel}</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: #0f1218; color: #f7f3eb; }
    main { width: min(100%, 420px); text-align: center; padding: 34px 28px; border: 1px solid #303744; border-radius: 22px; background: #191e27; box-shadow: 0 24px 70px rgba(0,0,0,.35); }
    .mark { width: 58px; height: 58px; margin: 0 auto 18px; display: grid; place-items: center; border-radius: 18px; background: #4a7fff; font-size: 30px; font-weight: 800; }
    h1 { margin: 0 0 8px; font-size: 30px; }
    p { margin: 0 0 24px; color: #aeb7c6; line-height: 1.5; }
    a { display: block; padding: 15px 18px; border-radius: 12px; background: #4a7fff; color: white; font-size: 18px; font-weight: 750; text-decoration: none; }
    small { display: block; margin-top: 16px; color: #7f8999; }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">T</div>
    <h1>Text ${safeLabel}</h1>
    <p>Opening your messaging app with a ready-to-send message.</p>
    <a href="${safeUri}">Open text message</a>
    <small>If nothing opens automatically, tap the button.</small>
  </main>
  <script>window.setTimeout(function () { window.location.href = ${scriptUri}; }, 150);</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}

function unavailablePage(): Response {
  return new Response(
    "This text code is not configured yet. Please contact Team Rollin directly.",
    {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}

export default async (req: Request, context: Context) => {
  const slug = context.params?.slug;

  if (!slug) {
    return new Response("Not found", { status: 404 });
  }

  let [code] = await db
    .select()
    .from(smsQrCodes)
    .where(eq(smsQrCodes.slug, slug));

  if (!code && slug === DEFAULT_SLUG) {
    [code] = await db
      .select()
      .from(smsQrCodes)
      .where(eq(smsQrCodes.slug, LEGACY_SLUG));
  }

  if (!code || !code.phone) {
    return unavailablePage();
  }

  // Logging must never block the launch page — a scan that can't be recorded
  // should still open the messaging app.
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

  return launchPage(code.label, smsUri(code.phone, code.message));
};

export const config: Config = {
  path: ["/text/:slug", "/q/:slug"],
};
