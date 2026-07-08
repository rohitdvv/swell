import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { getAccount } from "@/lib/billing/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const { subscription } = await getAccount();
  if (!stripe || !subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Billing portal is available on live Stripe subscriptions." },
      { status: 400 }
    );
  }
  const origin = new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${origin}/account`,
  });
  return NextResponse.json({ url: session.url });
}
