import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, adoptSetupPaymentMethod } from "@/lib/billing/stripe";
import { repo } from "@/lib/db";
import type { PlanId, Interval } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ received: true, skipped: "stripe not configured" });
  }

  const sig = request.headers.get("stripe-signature");
  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig || "", secret);
  } catch (err) {
    console.error("webhook signature error", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const email = s.customer_details?.email || s.customer_email;
        const plan = (s.metadata?.plan as PlanId) || "pro";
        const interval = (s.metadata?.interval as Interval) || "monthly";
        if (email) {
          await adoptSetupPaymentMethod(stripe, s);
          await repo.upsertSubscription({
            email,
            plan,
            interval,
            status: "active",
            mode: "live",
            current_period_end: null,
            stripe_customer_id: typeof s.customer === "string" ? s.customer : null,
            stripe_subscription_id: typeof s.subscription === "string" ? s.subscription : null,
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const existing = await repo.getSubscriptionByStripeId(sub.id);
        if (existing) {
          await repo.upsertSubscription({
            ...existing,
            status: sub.status === "active" || sub.status === "trialing" ? "active" : "canceled",
            current_period_end: sub.items?.data?.[0]?.current_period_end
              ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
              : existing.current_period_end,
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error("webhook handler error", err);
  }

  return NextResponse.json({ received: true });
}
