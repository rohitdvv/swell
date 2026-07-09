import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { setAccountCookie } from "@/lib/billing/account";
import { repo } from "@/lib/db";
import type { PlanId, Interval } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** After Stripe redirect, bind the checkout session's email to a cookie. */
export async function POST(request: Request) {
  const stripe = getStripe();
  const { session_id } = await request.json().catch(() => ({}));
  if (!stripe || !session_id) return NextResponse.json({ ok: false });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const email = session.customer_details?.email || session.customer_email;
    if (!email) return NextResponse.json({ ok: false });

    // Ensure a subscription row exists even if the webhook hasn't landed yet.
    if (!await repo.getSubscription(email)) {
      await repo.upsertSubscription({
        email,
        plan: (session.metadata?.plan as PlanId) || "pro",
        interval: (session.metadata?.interval as Interval) || "monthly",
        status: "active",
        mode: "live",
        current_period_end: null,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
        stripe_subscription_id:
          typeof session.subscription === "string" ? session.subscription : null,
      });
    }
    await setAccountCookie(email);
    return NextResponse.json({ ok: true, email });
  } catch (err) {
    console.error("bind error", err);
    return NextResponse.json({ ok: false });
  }
}
