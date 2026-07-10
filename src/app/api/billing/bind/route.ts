import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { repo } from "@/lib/db";
import { getAccountEmail } from "@/lib/billing/account";
import type { PlanId, Interval } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by /account right after Stripe redirects back. The webhook is the
 * source of truth, but it may not have landed yet (and in local dev there is
 * no webhook at all), so we confirm the session directly with Stripe.
 *
 * Guards: the caller must be signed in, the session must actually be paid,
 * and the session must belong to *this* account.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const { session_id } = await request.json().catch(() => ({}));
  if (!stripe || !session_id) return NextResponse.json({ ok: false });

  const signedInEmail = await getAccountEmail();
  if (!signedInEmail) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // The checkout must have completed and been paid for.
    if (session.status !== "complete" || session.payment_status === "unpaid") {
      return NextResponse.json({ ok: false, error: "Checkout not completed." }, { status: 400 });
    }

    // And it must be this user's session — never trust the id alone.
    const sessionEmail = (
      session.client_reference_id ||
      session.metadata?.email ||
      session.customer_details?.email ||
      session.customer_email ||
      ""
    ).toLowerCase();
    if (sessionEmail !== signedInEmail) {
      return NextResponse.json({ ok: false, error: "Session does not match account." }, { status: 403 });
    }

    await repo.upsertSubscription({
      email: signedInEmail,
      plan: (session.metadata?.plan as PlanId) || "pro",
      interval: (session.metadata?.interval as Interval) || "monthly",
      status: "active",
      mode: "live",
      current_period_end: null,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      stripe_subscription_id:
        typeof session.subscription === "string" ? session.subscription : null,
    });
    return NextResponse.json({ ok: true, email: signedInEmail });
  } catch (err) {
    console.error("bind error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
