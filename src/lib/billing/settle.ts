import "server-only";
import { repo, type PerformanceCharge } from "@/lib/db";
import { getStripe } from "./stripe";
import { PLANS } from "./plans";
import { isPaying } from "./quota";
import { performanceFee } from "./performance";
import type { Campaign } from "../types";
import type { ProofReport } from "../proof";

/**
 * After a Proof upload: work out what a pay-for-proof account owes for this
 * campaign. Estimates update freely while the campaign runs; the first final
 * figure is invoiced once and then frozen (the DB refuses to overwrite an
 * invoiced row, and Stripe idempotency keys stop a double charge even if two
 * uploads race). Accounts on other plans are never charged here.
 */
export async function settleProof(
  campaign: Pick<Campaign, "id" | "slug" | "restaurant_name">,
  proof: ProofReport,
  email: string
): Promise<PerformanceCharge | null> {
  const sub = await repo.getSubscription(email);
  const terms = PLANS.performance.performance!;
  if (!sub || !isPaying(sub) || sub.plan !== "performance") return null;

  const existing = await repo.getCharge(campaign.id);
  if (existing && (existing.status === "invoiced" || existing.status === "demo")) return existing;

  const billed = await repo.billedThisMonth(email, campaign.id);
  const fee = performanceFee(proof, terms.rate, terms.monthlyCap, billed);
  const base = {
    campaign_id: campaign.id,
    email,
    slug: campaign.slug,
    restaurant_name: campaign.restaurant_name,
    basis: fee.basis,
    rate: terms.rate,
    amount: fee.amount,
    stripe_invoice_id: null as string | null,
    reason: fee.reason,
  };

  if (!fee.billable) return repo.upsertCharge({ ...base, amount: 0, status: "none" });
  if (!fee.final) return repo.upsertCharge({ ...base, status: "estimate" });

  const stripe = getStripe();
  if (sub.mode === "demo" || !stripe || !sub.stripe_customer_id) {
    return repo.upsertCharge({ ...base, status: "demo" });
  }

  try {
    const description = `Swell pay-for-proof · ${campaign.restaurant_name} · ${fee.reason}`;
    await stripe.invoiceItems.create(
      { customer: sub.stripe_customer_id, amount: fee.amount * 100, currency: "usd", description },
      { idempotencyKey: `swell-proof-item-${campaign.id}` }
    );
    const invoice = await stripe.invoices.create(
      {
        customer: sub.stripe_customer_id,
        collection_method: "charge_automatically",
        auto_advance: true,
        pending_invoice_items_behavior: "include",
        metadata: { campaign_id: campaign.id, slug: campaign.slug, basis: String(fee.basis) },
      },
      { idempotencyKey: `swell-proof-invoice-${campaign.id}` }
    );
    if (invoice.id && invoice.status === "draft") await stripe.invoices.finalizeInvoice(invoice.id);
    return repo.upsertCharge({ ...base, status: "invoiced", stripe_invoice_id: invoice.id ?? null });
  } catch (err) {
    console.error("pay-for-proof invoicing failed", err);
    return repo.upsertCharge({ ...base, status: "failed", reason: `${fee.reason} Invoicing failed — we'll retry on the next upload.` });
  }
}
