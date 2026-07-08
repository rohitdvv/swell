import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { repo } from "@/lib/db";
import type { Subscription } from "@/lib/types";

const COOKIE = "swell_acct";

function secret(): string {
  return process.env.SWELL_SESSION_SECRET || "swell-dev-session-secret";
}

function sign(email: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(email).digest("base64url");
  return `${Buffer.from(email).toString("base64url")}.${sig}`;
}

function verify(token: string): string | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const email = Buffer.from(b64, "base64url").toString("utf-8");
  const expected = crypto.createHmac("sha256", secret()).update(email).digest("base64url");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? email : null;
}

export async function getAccountEmail(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verify(token) : null;
}

export async function setAccountCookie(email: string): Promise<void> {
  (await cookies()).set(COOKIE, sign(email.toLowerCase()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearAccountCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export type Account = {
  email: string | null;
  subscription: Subscription | null;
};

export async function getAccount(): Promise<Account> {
  const email = await getAccountEmail();
  if (!email) return { email: null, subscription: null };
  return { email, subscription: repo.getSubscription(email) };
}
