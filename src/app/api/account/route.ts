import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAccountEmail } from "@/lib/billing/account";
import { getStripe } from "@/lib/billing/stripe";
import { repo } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delete the signed-in account — from the website or the iOS app (App Store
 * guideline 5.1.1(v): accounts created in an app must be deletable in it).
 * Requires { confirm: "DELETE" }. Order: stop billing → erase our data →
 * delete the login. If the last step fails the data is already gone and the
 * user can simply retry.
 */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  const email = await getAccountEmail();
  if (!userId || !email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const limited = await rateLimit(`delete:${email}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });
  }

  // 1 — stop any recurring Stripe billing.
  const sub = await repo.getSubscription(email);
  const stripe = getStripe();
  if (stripe && sub?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } catch (err) {
      console.error("account deletion: stripe cancel failed", err);
      return NextResponse.json({ error: "Couldn't cancel your subscription — please try again." }, { status: 502 });
    }
  }

  // 2 — erase our data (one transaction).
  const { campaigns } = await repo.deleteAccountData(email);

  // 3 — delete the login itself.
  try {
    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch (err) {
    console.error("account deletion: clerk delete failed", err);
    return NextResponse.json(
      { error: "Your data was deleted, but we couldn't remove your login. Please try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, deletedCampaigns: campaigns });
}
