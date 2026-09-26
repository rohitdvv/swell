"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { osClass, OS } from "@/components/os-theme";
import { OsNav } from "@/components/os-nav";
import { toast } from "@/components/toaster";
import {
  PLANS,
  PLAN_ORDER,
  monthlyEquivalent,
  type Interval,
  type PlanId,
} from "@/lib/billing/plans";

export default function PricingPage() {
  const [interval, setInterval] = React.useState<Interval>("monthly");
  const [busy, setBusy] = React.useState<PlanId | null>(null);

  async function subscribe(plan: PlanId) {
    setBusy(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json();
      if (data.needAuth) {
        toast("Create an account first — it takes 20 seconds.", "info");
        window.location.assign("/sign-up");
        return;
      }
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      toast(data.error || "Could not start checkout.", "error");
    } catch {
      toast("Could not start checkout.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={osClass("min-h-screen")} style={{ background: OS.bg }}>
      <OsNav links={[{ href: "/demo", label: "Sample campaign" }, { href: "/#how", label: "How it works" }]} />

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(80% 60% at 50% -10%, rgba(232,163,61,0.10) 0%, transparent 55%)" }}
        />
        <div className="relative mx-auto max-w-[1100px] px-5 pb-24 pt-16 sm:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.amber }}>
              PRICING
            </div>
            <h1 className="mt-4 font-display text-[clamp(40px,6vw,60px)] font-normal leading-[1.04] tracking-[-0.025em] text-balance">
              Priced like a line cook, <em className="italic" style={{ color: OS.amber }}>not a consultant.</em>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.6] text-pretty" style={{ color: OS.muted }}>
              One brain that reads your sales, your neighborhood and the weather — and ships a month
              of on-brand campaigns. Cancel anytime.
            </p>

            <div className="mt-8 inline-flex items-center gap-3">
              <div
                className="inline-flex rounded border p-1"
                style={{ borderColor: OS.line2, background: OS.panel }}
              >
                {(["monthly", "annual"] as Interval[]).map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setInterval(iv)}
                    className="rounded px-4 py-1.5 text-[13px] font-medium capitalize transition"
                    style={
                      interval === iv
                        ? { background: OS.amber, color: OS.bg }
                        : { color: OS.muted }
                    }
                  >
                    {iv}
                  </button>
                ))}
              </div>
              <span
                className="rounded-[3px] px-2.5 py-1 font-mono text-[10px] tracking-[0.1em]"
                style={{ background: "rgba(127,209,174,0.12)", color: OS.mint }}
              >
                2 MONTHS FREE
              </span>
            </div>
          </div>

          <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const price = monthlyEquivalent(plan, interval);
              return (
                <div
                  key={id}
                  className="relative flex h-full flex-col rounded-lg border p-6"
                  style={{
                    borderColor: plan.popular ? OS.amber : OS.line2,
                    background: OS.panel,
                    boxShadow: plan.popular ? "0 24px 60px -30px rgba(232,163,61,0.4)" : "none",
                  }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.1em]"
                        style={{ background: OS.amber, color: OS.bg }}
                      >
                        <Sparkles className="size-3" /> MOST POPULAR
                      </span>
                    </div>
                  )}
                  <div className="text-lg font-semibold" style={{ color: OS.fg }}>
                    {plan.name}
                  </div>
                  <div className="mt-1 text-[13px]" style={{ color: OS.subtle }}>
                    {plan.tagline}
                  </div>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="font-display text-5xl leading-none tabular-nums">${price}</span>
                    <span className="mb-1 text-sm" style={{ color: OS.subtle }}>
                      /mo
                    </span>
                  </div>
                  <div className="mt-1 h-4 font-mono text-[10px] tracking-[0.08em]" style={{ color: OS.subtle }}>
                    {interval === "annual" ? `BILLED $${plan.annual}/YR` : "BILLED MONTHLY"}
                  </div>

                  <button
                    onClick={() => subscribe(id)}
                    disabled={busy === id}
                    className="mt-5 flex h-11 w-full items-center justify-center rounded text-[14px] font-semibold transition hover:brightness-110 disabled:opacity-60"
                    style={
                      plan.popular
                        ? { background: OS.amber, color: OS.bg }
                        : { border: `1px solid ${OS.line2}`, color: OS.fg, background: "transparent" }
                    }
                  >
                    {busy === id ? "Starting…" : `Start ${plan.name}`}
                  </button>

                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((f) => {
                      const isHeader = f.endsWith("plus:");
                      return (
                        <li
                          key={f}
                          className="flex items-start gap-2.5 text-[13.5px]"
                          style={{ color: isHeader ? OS.fg : OS.muted, fontWeight: isHeader ? 600 : 400, paddingTop: isHeader ? 4 : 0 }}
                        >
                          {!isHeader && (
                            <span
                              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full"
                              style={{ background: "rgba(127,209,174,0.15)", color: OS.mint }}
                            >
                              <Check className="size-2.5" />
                            </span>
                          )}
                          <span>{f}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div
            className="mt-5 flex flex-col items-start gap-3 rounded-lg border px-6 py-5 sm:flex-row sm:items-center"
            style={{ borderColor: OS.line2, background: OS.panel }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[17px] font-semibold">Free</span>
                <span className="font-display text-2xl">$0</span>
              </div>
              <p className="mt-1 text-sm" style={{ color: OS.muted }}>
                1 restaurant · 1 campaign a month, regenerate it as often as you like · live weather +
                events brain · 30 branded posters · shareable URL. No card.
              </p>
            </div>
            <Link
              href="/console"
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded border px-5 text-[14px] font-semibold transition hover:border-current"
              style={{ borderColor: "rgba(28,25,23,0.25)", color: OS.fg }}
            >
              Start free <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.08em]" style={{ color: OS.subtle }}>
            <ShieldCheck className="size-3.5" />
            SECURE CHECKOUT BY STRIPE · TEST MODE — NO REAL CHARGES WITHOUT A LIVE KEY
          </div>
        </div>
      </section>
    </div>
  );
}
