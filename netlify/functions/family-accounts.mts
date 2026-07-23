import type { Config, Context } from "@netlify/functions";
import { admin, AuthError, login, verifyRequestOrigin } from "@netlify/identity";
import { and, eq, sql } from "drizzle-orm";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "../../db/index.js";
import { familyAccounts } from "../../db/schema.js";

const TEAMS = new Set(["10U", "12U", "14U", "16U"]);
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xpqorjjj";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const clean = (value: unknown, maxLength: number) =>
  String(value ?? "").trim().slice(0, maxLength);

const normalizeEmail = (value: unknown) => clean(value, 254).toLowerCase();

const pinDigest = (pin: string, salt: string) =>
  createHash("sha256").update(`${salt}:${pin}`).digest("hex");

const pinsMatch = (pin: string, salt: string, expectedHash: string) => {
  const actual = Buffer.from(pinDigest(pin, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const publicProfile = (account: typeof familyAccounts.$inferSelect) => ({
  id: `family-${account.id}`,
  name: account.playerName,
  team: account.playerTeam,
  parentName: account.parentName,
  parentEmail: account.email,
  status: account.status,
  pin: "Account issued",
  source: "netlify",
  createdAt: account.createdAt,
});

const directoryProfile = (account: typeof familyAccounts.$inferSelect) => ({
  id: `family-${account.id}`,
  name: account.playerName,
  team: account.playerTeam,
  parentName: "Family account",
  parentEmail: "Managed in Netlify Identity",
  status: account.status,
  pin: "Account issued",
  source: "netlify",
  createdAt: account.createdAt,
});

async function notifyOwner(
  account: { playerName: string; playerTeam: string; parentName: string; email: string },
  siteUrl: string,
) {
  const message = [
    "A family account was automatically approved and received a website PIN.",
    "",
    `Player: ${account.playerName}`,
    `Team: ${account.playerTeam}`,
    `Parent: ${account.parentName}`,
    `Email: ${account.email}`,
    "",
    "Please confirm that this family should have access.",
    "If they are not authorized, delete the user in the Netlify Identity dashboard. The website access record is removed automatically when the Identity user is deleted.",
    "",
    `Website: ${siteUrl}`,
  ].join("\n");

  await fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      subject: `Team Rollin: Review new family account — ${account.playerName}`,
      message,
      _replyto: account.email,
    }),
  });
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "GET") {
    const rows = await db
      .select()
      .from(familyAccounts)
      .where(eq(familyAccounts.status, "approved"));
    return json(rows.map(directoryProfile));
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    verifyRequestOrigin(req);
  } catch {
    return json({ error: "Request origin was not accepted" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  if (action === "register") {
    const playerName = clean(body.playerName, 100);
    const playerTeam = clean(body.playerTeam, 10);
    const parentName = clean(body.parentName, 100);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");

    if (!playerName || !parentName || !email || !TEAMS.has(playerTeam)) {
      return json({ error: "Complete all account fields" }, 400);
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return json({ error: "Enter a valid email address" }, 400);
    }
    if (password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400);
    }

    const existing = await db
      .select({ id: familyAccounts.id })
      .from(familyAccounts)
      .where(eq(familyAccounts.email, email));
    if (existing.length) {
      return json({ error: "An account already exists for this email" }, 409);
    }

    let identityUserId = "";
    try {
      const user = await admin.createUser({
        email,
        password,
        data: {
          app_metadata: { roles: ["family"] },
          user_metadata: {
            full_name: parentName,
            player_name: playerName,
            player_team: playerTeam,
          },
        },
      });
      identityUserId = user.id;

      const pin = randomInt(100000, 1000000).toString();
      const pinSalt = randomBytes(16).toString("hex");
      const [account] = await db
        .insert(familyAccounts)
        .values({
          identityUserId,
          email,
          playerName,
          playerTeam,
          parentName,
          pinSalt,
          pinHash: pinDigest(pin, pinSalt),
          status: "approved",
        })
        .returning();

      context.waitUntil(
        notifyOwner(
          { playerName, playerTeam, parentName, email },
          context.site.url,
        ).catch((error) => console.error("Family account notification failed", error)),
      );

      return json({ account: publicProfile(account), pin }, 201);
    } catch (error) {
      if (identityUserId) {
        await admin.deleteUser(identityUserId).catch(() => undefined);
      }
      if (error instanceof AuthError) {
        const status = error.status === 422 ? 400 : error.status === 409 ? 409 : 400;
        return json({ error: error.message || "Account could not be created" }, status);
      }
      console.error("Family account registration failed", error);
      return json({ error: "Account could not be created" }, 500);
    }
  }

  if (action === "login") {
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    if (!email || !password) return json({ error: "Enter your email and password" }, 400);

    try {
      const user = await login(email, password);
      const [account] = await db
        .select()
        .from(familyAccounts)
        .where(
          and(
            eq(familyAccounts.identityUserId, user.id),
            eq(familyAccounts.status, "approved"),
          ),
        );
      if (!account) return json({ error: "This account does not have website access" }, 403);
      return json({ account: publicProfile(account) });
    } catch (error) {
      if (error instanceof AuthError) {
        return json({ error: "Email or password was not recognized" }, 401);
      }
      console.error("Family account login failed", error);
      return json({ error: "Sign in is temporarily unavailable" }, 500);
    }
  }

  if (action === "verify-pin") {
    const playerName = clean(body.playerName, 100);
    const playerTeam = clean(body.playerTeam, 10);
    const pin = clean(body.pin, 6);
    if (!playerName || !TEAMS.has(playerTeam) || !/^\d{6}$/.test(pin)) {
      return json({ error: "Enter the player name, team, and six-digit PIN" }, 400);
    }

    const [account] = await db
      .select()
      .from(familyAccounts)
      .where(
        and(
          sql`lower(${familyAccounts.playerName}) = lower(${playerName})`,
          eq(familyAccounts.playerTeam, playerTeam),
          eq(familyAccounts.status, "approved"),
        ),
      );
    if (!account || !pinsMatch(pin, account.pinSalt, account.pinHash)) {
      return json({ error: "Name, team, or PIN was not recognized" }, 401);
    }
    return json({ account: publicProfile(account) });
  }

  return json({ error: "Unknown action" }, 400);
};

export const config: Config = {
  path: "/api/family-accounts",
  rateLimit: {
    aggregateBy: ["domain", "ip"],
    windowSize: 60,
    windowLimit: 30,
  },
};
