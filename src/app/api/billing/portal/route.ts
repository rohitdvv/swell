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
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // Stripe requires the Customer Portal to be configured once per account.
    if (/portal|configuration/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Enable the Stripe Customer Portal once at dashboard.stripe.com → Settings → Billing → Customer portal, then try again.",
        },
        { status: 400 }
      );
    }
    console.error("portal error", err);
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
