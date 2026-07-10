"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Card, Badge, Segmented } from "@/components/ui";
import { toast } from "@/components/toaster";
import { AuthNav } from "@/components/auth-nav";
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
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-texture opacity-50" />
        <div
          className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #f75410, transparent 70%)" }}
        />
      </div>

      <header className="sticky top-0 z-30 border-b border-border/70 glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo />
          <nav className="ml-auto flex items-center gap-3">
            <Link href="/account" className="hidden text-sm text-fg-muted hover:text-fg sm:block">
              Account
            </Link>
            <ThemeToggle />
            <AuthNav />
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-5xl sm:text-6xl text-balance">
            Priced like a line cook, <span className="text-ember-gradient">not a consultant.</span>
          </h1>
          <p className="mt-4 text-lg text-fg-muted text-pretty">
            One brain that reads your sales, your neighborhood and the weather — and ships a
            month of on-brand campaigns. Cancel anytime.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Segmented
              value={interval}
              onChange={setInterval}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
              ]}
            />
            <Badge tone="mint">2 months free</Badge>
          </div>
        </div>

        <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
          {PLAN_ORDER.map((id, i) => {
            const plan = PLANS[id];
            const price = monthlyEquivalent(plan, interval);
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card
                  className={`relative flex h-full flex-col p-6 ${
                    plan.popular ? "ring-2 ring-ember-500/40 shadow-lift" : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-ember-gradient px-3 py-1 text-xs font-semibold text-white shadow-ember">
                        <Sparkles className="size-3" /> Most popular
                      </span>
                    </div>
                  )}
                  <div className="text-lg font-semibold">{plan.name}</div>
                  <div className="mt-1 text-sm text-fg-subtle">{plan.tagline}</div>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="font-display text-5xl leading-none">${price}</span>
                    <span className="mb-1 text-sm text-fg-subtle">/mo</span>
                  </div>
                  <div className="mt-1 h-4 text-xs text-fg-subtle">
                    {interval === "annual" ? `billed $${plan.annual}/yr` : "billed monthly"}
                  </div>

                  <Button
                    onClick={() => subscribe(id)}
                    loading={busy === id}
                    variant={plan.popular ? "primary" : "secondary"}
                    size="lg"
                    className="mt-5 w-full"
                  >
                    Start {plan.name}
                  </Button>

                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((f) => {
                      const isHeader = f.endsWith("plus:");
                      return (
                        <li
                          key={f}
                          className={`flex items-start gap-2.5 text-sm ${
                            isHeader ? "pt-1 font-medium text-fg" : "text-fg-muted"
                          }`}
                        >
                          {!isHeader && (
                            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-mint-500/15 text-mint-600">
                              <Check className="size-2.5" />
                            </span>
                          )}
                          <span className={isHeader ? "" : ""}>{f}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-fg-subtle">
          <ShieldCheck className="size-3.5" />
          Secure checkout by Stripe. Test mode ready — no real charges without a live key.
        </div>
      </section>

    </div>
  );
}
