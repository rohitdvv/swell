import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { repo } from "@/lib/db";
import type { Subscription, User } from "@/lib/types";

/**
 * Identity comes from Clerk. On first sight of a signed-in user we mirror
 * them into our own `users` table (keyed by email) so campaigns and
 * subscriptions keep working exactly as before.
 */
/** currentUser() throws when Clerk keys are absent — keyless deploys are guests. */
async function safeCurrentUser() {
  try {
    return await currentUser();
  } catch {
    return null;
  }
}

export async function getAccountEmail(): Promise<string | null> {
  const user = await safeCurrentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  return email ? email.toLowerCase() : null;
}

export type Account = {
  email: string | null;
  user: User | null;
  subscription: Subscription | null;
};

export async function getAccount(): Promise<Account> {
  const clerkUser = await safeCurrentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!clerkUser || !email) return { email: null, user: null, subscription: null };

  let user = await repo.getUser(email);
  if (!user) {
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
      clerkUser.username ||
      email.split("@")[0];
    // Password is managed by Clerk; store a placeholder so the column stays NOT NULL.
    await repo.createUser({ email, name, restaurant_name: null, password_hash: "clerk" });
    user = await repo.getUser(email);
  }

  return { email, user, subscription: await repo.getSubscription(email) };
}
