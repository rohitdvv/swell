import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { PLANS, type PlanId, type Interval } from "@/lib/billing/plans";
import { repo } from "@/lib/db";
import { getAccountEmail } from "@/lib/billing/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const plan = body?.plan as PlanId;
  const interval: Interval = body?.interval === "annual" ? "annual" : "monthly";
  // Enterprise flow: the subscription belongs to the signed-in account.
  const email = (await getAccountEmail()) ?? undefined;

  if (!plan || !PLANS[plan]) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json(
      { error: "Sign in to subscribe.", needAuth: true },
      { status: 401 }
    );
  }
  const p = PLANS[plan];
  const origin = new URL(request.url).origin;
  const stripe = getStripe();

  // ---- Pay for proof: no subscription, just a saved card for proven results ----
  if (stripe && p.performance) {
    try {
      // Setup mode needs an existing customer; reuse theirs if we have one.
      const existing = await repo.getSubscription(email);
      const customer =
        existing?.stripe_customer_id ??
        (await stripe.customers.create({ email, metadata: { email } }, { idempotencyKey: `swell-customer-${email}` })).id;
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        currency: "usd",
        customer,
        client_reference_id: email,
        metadata: { plan, interval: "monthly", email },
        success_url: `${origin}/account?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?checkout=cancelled`,
      });
      return NextResponse.json({ url: session.url, mode: "live" });
    } catch (err) {
      console.error("stripe setup checkout error", err);
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }
  }

  // ---- Live Stripe (test mode with a test key works identically) ----
  if (stripe) {
    const amount = interval === "annual" ? p.annual : p.monthly;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amount * 100,
              recurring: { interval: interval === "annual" ? "year" : "month" },
              product_data: { name: `Swell ${p.name}` },
            },
          },
        ],
        customer_email: email,
        // Bind the session to the signed-in account so we can verify on return.
        client_reference_id: email,
        metadata: { plan, interval, email },
        subscription_data: { metadata: { plan, interval, email } },
        success_url: `${origin}/account?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?checkout=cancelled`,
        allow_promotion_codes: true,
      });
      return NextResponse.json({ url: session.url, mode: "live" });
    } catch (err) {
      console.error("stripe checkout error", err);
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }
  }

  // ---- Keyless demo mode: activate immediately so the flow is visible ----
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + (interval === "annual" ? 365 : 30));
  await repo.upsertSubscription({
    email,
    plan,
    interval,
    status: "active",
    mode: "demo",
    current_period_end: periodEnd.toISOString(),
    stripe_customer_id: null,
    stripe_subscription_id: null,
  });
  return NextResponse.json({ url: "/console", mode: "demo" });
}
