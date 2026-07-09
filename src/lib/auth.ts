import "server-only";
import crypto from "node:crypto";
import { repo } from "./db";
import { setAccountCookie } from "./billing/account";
import type { User } from "./types";

// scrypt password hashing — node stdlib, no dependencies.
// Stored as  scrypt$<salt-hex>$<hash-hex>

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const key = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  const expected = Buffer.from(hashHex, "hex");
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: string; code: "exists" | "invalid" | "credentials" };

export async function signUp(input: {
  email: string;
  name: string;
  restaurant_name?: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!/.+@.+\..+/.test(email)) return { ok: false, error: "Enter a valid email.", code: "invalid" };
  if (name.length < 2) return { ok: false, error: "Enter your name.", code: "invalid" };
  if (input.password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters.", code: "invalid" };
  if (await repo.getUser(email))
    return { ok: false, error: "An account with this email already exists — sign in instead.", code: "exists" };

  const password_hash = await hashPassword(input.password);
  await repo.createUser({
    email,
    name,
    restaurant_name: input.restaurant_name?.trim() || null,
    password_hash,
  });
  await setAccountCookie(email);
  const user = await repo.getUser(email);
  return { ok: true, user: user! };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const found = await repo.getUserWithHash(email);
  if (!found || !(await verifyPassword(input.password, found.password_hash))) {
    return { ok: false, error: "Wrong email or password.", code: "credentials" };
  }
  await setAccountCookie(email);
  return { ok: true, user: found.user };
}
