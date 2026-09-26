"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CreditCard, LogOut, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { Button, Card, Badge, Spinner } from "@/components/ui";
import { toast } from "@/components/toaster";
import { osClass, OS } from "@/components/os-theme";
import type { Subscription } from "@/lib/types";

type Me = {
  email: string | null;
  subscription: Subscription | null;
  plan: { name: string; monthly: number; annual: number; limits: { campaignsPerMonth: number } } | null;
  usage: { campaigns: number; limit: number };
  stripeConfigured: boolean;
};

export default function AccountPage() {
  const [me, setMe] = React.useState<Me | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [managing, setManaging] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/billing/me");
    setMe(await res.json());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const sid = params.get("session_id");
      if (sid) {
        await fetch("/api/billing/bind", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: sid }),
        });
        window.history.replaceState({}, "", "/account");
        toast("Subscription active — welcome to Swell.", "success");
      } else if (params.get("demo")) {
        window.history.replaceState({}, "", "/account");
        toast("Demo subscription active.", "success");
      }
      await load();
    })();
  }, [load]);

  async function manage() {
    setManaging(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.assign(data.url);
      else toast(data.error || "Unavailable.", "info");
    } finally {
      setManaging(false);
    }
  }

  async function logout() {
    await fetch("/api/billing/logout", { method: "POST" });
    load();
  }

  return (
    <div className={osClass("min-h-screen")} style={{ background: OS.bg }}>
      <header
        className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 sm:px-6"
        style={{ borderColor: OS.line, background: "rgba(251,248,243,0.86)", backdropFilter: "blur(14px)" }}
      >
        <Link href="/" className="flex items-baseline gap-2" title="Home">
          <span className="font-display text-xl">Swell</span>
          <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: OS.amber }}>OS</span>
        </Link>
        <span className="os-label hidden md:block">ACCOUNT</span>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <Link href="/" style={{ color: OS.muted }}>Home</Link>
          <Link href="/console" style={{ color: OS.muted }}>Console</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="mb-6 font-display text-4xl">Billing &amp; plan</h1>

        {loading ? (
          <div className="flex items-center gap-2 text-fg-muted">
            <Spinner /> Loading…
          </div>
        ) : me?.subscription && me.plan ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border bg-surface-2/50 px-5 py-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-ember-gradient text-white shadow-ember">
                  <Zap className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">Swell {me.plan.name}</span>
                    <Badge tone="mint">
                      <CheckCircle2 className="size-3" /> {me.subscription.status}
                    </Badge>
                    {me.subscription.mode === "demo" && <Badge tone="ember">demo</Badge>}
                  </div>
                  <div className="text-sm text-fg-subtle">{me.email}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-2xl font-semibold">
                    ${me.subscription.interval === "annual" ? me.plan.annual : me.plan.monthly}
                  </div>
                  <div className="text-xs text-fg-subtle">/{me.subscription.interval === "annual" ? "yr" : "mo"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="px-5 py-4">
                  <div className="text-xs text-fg-subtle">Campaigns this month</div>
                  <div className="mt-0.5 text-xl font-semibold tabular-nums">
                    {me.usage.campaigns}
                    <span className="text-sm font-normal text-fg-subtle">
                      {" "}
                      / {me.usage.limit === -1 ? "∞" : me.usage.limit}
                    </span>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="text-xs text-fg-subtle">Renews</div>
                  <div className="mt-0.5 text-xl font-semibold">
                    {me.subscription.current_period_end
                      ? new Date(me.subscription.current_period_end).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={manage} loading={managing}>
                <CreditCard className="size-4" /> Manage billing
              </Button>
              <Link href="/pricing">
                <Button variant="outline">Change plan</Button>
              </Link>
              <Button variant="ghost" onClick={logout} className="ml-auto">
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>

            {!me.stripeConfigured && (
              <p className="text-xs text-fg-subtle">
                Running in demo mode. Add <code className="rounded bg-surface-2 px-1">STRIPE_SECRET_KEY</code>{" "}
                (a Stripe <em>test</em> key works) to enable real checkout &amp; the billing portal.
              </p>
            )}
          </motion.div>
        ) : (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-surface-2">
              <CreditCard className="size-5 text-fg-subtle" />
            </div>
            <div className="text-lg font-semibold">You&apos;re on Swell Free</div>
            <p className="mx-auto mt-1 max-w-sm text-sm text-fg-muted">
              {me ? `${me.usage.campaigns} of ${me.usage.limit} campaign this month. ` : ""}
              Regenerate it as often as you like. Upgrade for more restaurants, more campaigns, the Ad
              Kit and auto-publishing.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/console">
                <Button size="lg">
                  Build a campaign <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg">
                  See plans
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
