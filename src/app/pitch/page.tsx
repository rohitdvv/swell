import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CloudSun,
  Ticket,
  TrendingUp,
  ShieldCheck,
  Zap,
  Store,
  Sparkles,
  LineChart,
  Users,
  Target,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Investor-facing pitch surface — not marketing fluff.
 * Designed to be opened in a meeting: problem → product → moat → traction path → ask.
 */
export default function PitchPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6">
          <Logo />
          <span className="ml-3 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            Investor brief
          </span>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/demo"
              className="text-sm font-medium text-fg-muted transition hover:text-fg"
            >
              Live demo
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ember-gradient px-3 text-sm font-semibold text-white shadow-ember"
            >
              Product <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Hero thesis */}
        <section className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember-500">
            The one-liner
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            Every independent restaurant is bleeding money on slow shifts.{" "}
            <span className="text-ember-gradient italic">None of them have a brain.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-fg-muted text-pretty">
            Toast gives dashboards. Agencies charge $500/month. Swell reads the register and
            looks out the window — then shows up Monday morning with the whole month planned:
            the right item, the right window, the right percent off, a finished poster, and a
            revenue range with honest error bars.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-ember-gradient px-5 text-sm font-semibold text-white shadow-ember"
            >
              <Sparkles className="size-4" /> See a live campaign
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-[var(--surface)] px-5 text-sm font-medium"
            >
              Pricing
            </Link>
          </div>
        </section>

        {/* Problem / status quo */}
        <section className="mb-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Store,
              title: "The customer",
              body: "Owner-operator of 1–3 restaurants. Runs the floor. Will never open an analytics tool. If it takes more than 3 inputs and 10 seconds, they're gone.",
            },
            {
              icon: Target,
              title: "The pain",
              body: "Slow Tuesday afternoons and rainy weeknights silently destroy margin. They know it. They don't have time, budget, or skill to market their way out.",
            },
            {
              icon: Users,
              title: "Status quo",
              body: "Do nothing. Or pay an agency $500+/mo for generic '20% off' posts that ignore weather, events, and their own sales history.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-border bg-[var(--surface)] p-5"
            >
              <c.icon className="size-5 text-ember-500" />
              <h3 className="mt-3 font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-sm text-fg-muted text-pretty">{c.body}</p>
            </div>
          ))}
        </section>

        {/* Product magic */}
        <section className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember-500">
            Product
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Three inputs. A 30-day brain.
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Brain, label: "10 agents", detail: "Brand → weather → events → model → strategy → copy → creative → revenue, streamed live" },
              { icon: LineChart, label: "Real model", detail: "Ridge regression on their daily sales, backtested holdout MAE — e.g. ±$102/day" },
              { icon: CloudSun, label: "Real world", detail: "Live Open-Meteo forecast + local events. Rainy Tuesday ≠ game day at the arena" },
              { icon: Ticket, label: "Finished assets", detail: "30 on-brand posters, captions, ad kit (1:1 / 4:5 / 9:16), calendar + Monday brief" },
            ].map((f) => (
              <div
                key={f.label}
                className="rounded-2xl border border-border bg-[var(--surface)] p-5"
              >
                <f.icon className="size-5 text-ember-500" />
                <div className="mt-3 font-semibold">{f.label}</div>
                <p className="mt-1 text-sm text-fg-muted text-pretty">{f.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Moat */}
        <section className="mb-16 rounded-3xl border border-border bg-[var(--surface)] p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember-500">
            Moat & ethics
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">
            Trust is the product.
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-4 text-mint-500" /> Brutal honesty
              </div>
              <p className="mt-2 text-sm text-fg-muted text-pretty">
                Never invent a number. Revenue is a sensitivity range with confidence. Every
                input tagged measured / assumed / simulated. Marketplace demand labeled
                &ldquo;modeled preview&rdquo; until it&apos;s real. The chatbot says &ldquo;I
                don&apos;t have that&rdquo; rather than hallucinate.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Zap className="size-4 text-ember-500" /> Specificity
              </div>
              <p className="mt-2 text-sm text-fg-muted text-pretty">
                Captions don&apos;t say &ldquo;20% off.&rdquo; They say &ldquo;Game day at
                Wintrust? 25% off the Margherita.&rdquo; That specificity — weather + venue +
                item + window — is what agencies can&apos;t do at $49/mo and dashboards never
                will.
              </p>
            </div>
          </div>
        </section>

        {/* Business model */}
        <section className="mb-16 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember-500">
              Business
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-tight">
              SaaS that pays for itself on one saved Tuesday.
            </h2>
            <ul className="mt-5 space-y-3 text-sm text-fg-muted">
              <li className="flex gap-2">
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-ember-500" />
                <span>
                  <strong className="text-fg">Starter / Pro / Agency</strong> — metered by
                  restaurants + campaigns/month. Stripe live + demo mode for zero-friction sales
                  calls.
                </span>
              </li>
              <li className="flex gap-2">
                <Store className="mt-0.5 size-4 shrink-0 text-ember-500" />
                <span>
                  <strong className="text-fg">Wedge:</strong> single independent restaurant →
                  multi-unit operators → white-label for groups and POS partners.
                </span>
              </li>
              <li className="flex gap-2">
                <Brain className="mt-0.5 size-4 shrink-0 text-ember-500" />
                <span>
                  <strong className="text-fg">Two-sided upside:</strong> operator brain today;
                  consumer marketplace demand later turns the simulated lift into measured
                  demand.
                </span>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-[var(--surface-2)] p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              Stack (free → production)
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <strong>Auth</strong> — Clerk (Google + email)
              </li>
              <li>
                <strong>Billing</strong> — Stripe (test + live)
              </li>
              <li>
                <strong>Data</strong> — PGlite local / Neon free Postgres prod
              </li>
              <li>
                <strong>Weather</strong> — Open-Meteo (no key)
              </li>
              <li>
                <strong>Events</strong> — Nager.Date + Ticketmaster free tier
              </li>
              <li>
                <strong>AI</strong> — xAI Grok / Claude / Groq, or fully offline templates
              </li>
              <li>
                <strong>Deploy</strong> — Vercel free tier
              </li>
            </ul>
            <p className="mt-5 text-xs text-fg-subtle">
              Built to put in front of restaurants tomorrow and open a deck the same afternoon.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-3xl border border-border bg-ink-950 p-8 text-center text-white sm:p-12">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            See the brain work.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-white/70">
            Live demo uses a real 45-day Toast-style export for a NYC trattoria. No signup. No
            invented numbers.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/demo"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-ember-gradient px-6 text-[15px] font-semibold text-white shadow-ember"
            >
              Open live demo <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-[15px] font-medium text-white"
            >
              Start free
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
