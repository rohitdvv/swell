"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Mail, User as UserIcon, Store, Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Card, Field, Input, Segmented } from "@/components/ui";
import { toast } from "@/components/toaster";

type Mode = "signup" | "signin";

export default function AuthPage() {
  const [mode, setMode] = React.useState<Mode>("signup");
  const [name, setName] = React.useState("");
  const [restaurant, setRestaurant] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function nextUrl(): string {
    const params = new URLSearchParams(window.location.search);
    return params.get("next") || "/pricing";
  }

  // Already signed in? Skip ahead.
  React.useEffect(() => {
    fetch("/api/billing/me")
      .then((r) => r.json())
      .then((me) => {
        if (me?.user) window.location.replace(me.subscription ? "/console" : nextUrl());
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const url = mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const body =
        mode === "signup"
          ? { name, restaurant_name: restaurant, email, password }
          : { email, password };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "exists") setMode("signin");
        setError(data.error || "Something went wrong.");
        return;
      }
      toast(mode === "signup" ? `Welcome, ${data.user.name}!` : "Signed in.", "success");
      // Sign-up goes to plan selection; sign-in goes where they were headed.
      const me = await fetch("/api/billing/me").then((r) => r.json());
      window.location.assign(
        mode === "signup" ? "/pricing" : me?.subscription ? nextUrl().replace("/pricing", "/console") : "/pricing"
      );
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-texture opacity-50" />
        <div
          className="absolute -top-32 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #f75410, transparent 70%)" }}
        />
      </div>

      <header className="border-b border-border/70 glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo />
          <div className="ml-auto flex items-center gap-3">
            <Link href="/pricing" className="text-sm text-fg-muted hover:text-fg">
              Pricing
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="p-8">
            <div className="mb-6 text-center">
              <h1 className="font-display text-3xl">
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-1 text-sm text-fg-muted">
                {mode === "signup"
                  ? "Sign up, pick a plan, and generate your first campaign in minutes."
                  : "Sign in to your Swell account."}
              </p>
            </div>

            <div className="mb-6 flex justify-center">
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "signup", label: "Sign up" },
                  { value: "signin", label: "Sign in" },
                ]}
              />
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <Field label="Your name">
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                      <Input
                        className="pl-9"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Aiden Rivera"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </Field>
                  <Field label="Restaurant (optional)">
                    <div className="relative">
                      <Store className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                      <Input
                        className="pl-9"
                        value={restaurant}
                        onChange={(e) => setRestaurant(e.target.value)}
                        placeholder="Osteria Lume"
                      />
                    </div>
                  </Field>
                </>
              )}
              <Field label="Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                  <Input
                    className="pl-9"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@restaurant.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </Field>
              <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                  <Input
                    className="pl-9"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={mode === "signup" ? 8 : undefined}
                    required
                  />
                </div>
              </Field>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" size="lg" className="w-full" loading={busy}>
                {mode === "signup" ? "Create account" : "Sign in"} <ArrowRight className="size-4" />
              </Button>
            </form>

            {mode === "signup" && (
              <ul className="mt-6 space-y-1.5 border-t border-border pt-4">
                {["30-day campaign from your real sales", "Live weather + local-event targeting", "A branded poster for every day"].map(
                  (t) => (
                    <li key={t} className="flex items-center gap-2 text-xs text-fg-muted">
                      <Check className="size-3.5 text-mint-600" /> {t}
                    </li>
                  )
                )}
              </ul>
            )}
          </Card>
          <p className="mt-4 text-center text-xs text-fg-subtle">
            Next step after sign-up: choose a plan → open the Console.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
