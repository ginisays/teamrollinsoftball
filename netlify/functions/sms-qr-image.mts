import type { Config } from "@netlify/functions";
import QRCode from "qrcode";

const DEFAULT_SLUG = "team-rollin-text";

// The printable QR image. Deliberately free of any database import so the code
// always renders — it only ever encodes the fixed launch URL (/text/<slug>),
// which is what makes the printed code reusable while its SMS details change.
export default async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || DEFAULT_SLUG;
  const scanUrl = `${url.origin}/text/${slug}`;

  const svg = await QRCode.toString(scanUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
};

export const config: Config = {
  path: "/api/sms-qr/image",
};
