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
