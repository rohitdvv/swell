import "server-only";
import Stripe from "stripe";

let cached: Stripe | null | undefined;

/** Returns a Stripe client when STRIPE_SECRET_KEY is set, else null (demo mode). */
export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = key ? new Stripe(key) : null;
  return cached;
}

/**
 * A pay-for-proof checkout (setup mode) saves a card but doesn't make it the
 * customer's default — invoices would then fail to charge automatically.
 * Adopt the card from the completed setup session as the invoice default.
 */
export async function adoptSetupPaymentMethod(stripe: Stripe, session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "setup" || typeof session.customer !== "string") return;
  const si = typeof session.setup_intent === "string"
    ? await stripe.setupIntents.retrieve(session.setup_intent)
    : session.setup_intent;
  const pm = typeof si?.payment_method === "string" ? si.payment_method : si?.payment_method?.id;
  if (!pm) return;
  await stripe.customers.update(session.customer, { invoice_settings: { default_payment_method: pm } });
}
