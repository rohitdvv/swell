import Link from "next/link";
import {
  ArrowRight,
  FileSpreadsheet,
  Globe,
  Store,
  Sparkles,
  CalendarDays,
  TrendingUp,
  Zap,
  Check,
  Ticket,
} from "lucide-react";
import { Logo, Flame } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthNav } from "@/components/auth-nav";

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-texture opacity-60" />
        <div
          className="absolute -top-40 right-0 h-[520px] w-[520px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #f75410, transparent 70%)" }}
        />
        <div
          className="absolute top-40 -left-40 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #ff3b6b, transparent 70%)" }}
        />
      </div>

      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-border/70 glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo />
          <nav className="ml-auto flex items-center gap-2 sm:gap-4">
            <a href="#how" className="hidden text-sm text-fg-muted hover:text-fg sm:block">
              How it works
            </a>
            <a href="#moat" className="hidden text-sm text-fg-muted hover:text-fg sm:block">
              The moat
            </a>
            <Link href="/pricing" className="hidden text-sm text-fg-muted hover:text-fg sm:block">
              Pricing
            </Link>
            <ThemeToggle />
            <AuthNav />
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-fg-muted shadow-soft">
              <span className="flex size-1.5 rounded-full bg-mint-500 animate-pulse" />
              For the first 10 NYC design partners
            </div>
            <h1 className="animate-fade-up delay-1 mt-5 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl md:text-7xl text-balance">
              A brain that&apos;s <span className="italic text-ember-gradient">been in the kitchen.</span>
            </h1>
            <p className="animate-fade-up delay-2 mt-5 max-w-xl text-lg text-fg-muted text-pretty">
              Restaurants don&apos;t need more tools. Upload 30–90 days of sales, paste your
              website, and Swell generates a <strong className="text-fg">30-day campaign</strong> of
              recurring, on-brand discounts — as a shareable URL. You one-tap approve.
            </p>
            <div className="animate-fade-up delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-ember-gradient px-6 text-[15px] font-medium text-white shadow-ember transition hover:brightness-105"
              >
                <Sparkles className="size-4" /> Get started free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-border-strong bg-surface px-6 text-[15px] font-medium text-fg shadow-soft transition hover:bg-surface-2"
              >
                See pricing <ArrowRight className="size-4" />
              </Link>
            </div>
            <p className="animate-fade-up delay-4 mt-4 text-xs text-fg-subtle">
              Sign up → pick a plan → your first campaign in minutes. Sample data included.
            </p>
          </div>

          {/* hero visual */}
          <div className="animate-scale-in delay-2 relative mx-auto w-full max-w-sm">
            <HeroCreative />
            <div className="absolute -bottom-5 -left-5 flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-lift animate-fade-up delay-4">
              <div className="flex size-9 items-center justify-center rounded-xl bg-mint-500/15">
                <TrendingUp className="size-4 text-mint-600" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-none">+$4,180</div>
                <div className="text-[11px] text-fg-subtle">projected incremental / mo</div>
              </div>
            </div>
            <div className="absolute -right-4 top-8 flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-lift animate-fade-up delay-5">
              <Ticket className="size-4 text-ember-500" />
              <div className="text-xs font-medium">243 redemptions</div>
            </div>
          </div>
        </div>
      </section>

      {/* competitive frame */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-fg-subtle">
          Everyone else is reactive
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <CompareCard
            name="Toast IQ Grow"
            desc="Reactive. The operator has to ask the AI what to do."
            tone="dim"
          />
          <CompareCard
            name="Owner.com"
            desc="Sells SEO + website templates at $500/mo. Not a strategy."
            tone="dim"
          />
          <CompareCard
            name="Swell"
            desc="Proactive. We generate the campaign; you one-tap approve. And we read both sides of the marketplace."
            tone="bright"
          />
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-y border-border bg-surface-2/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl sm:text-5xl">Three inputs. One campaign.</h2>
            <p className="mt-3 text-fg-muted">
              The generator does the analytical work a $5k/mo consultant would — in about ten seconds.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <InputCard
              icon={<FileSpreadsheet className="size-5" />}
              step="Input A"
              title="Sales history"
              body="Toast or Square export. We parse net sales by daypart, day-of-week, top items, voids & payment mix — then z-score your slowest windows."
            />
            <InputCard
              icon={<Globe className="size-5" />}
              step="Input B"
              title="Brand kit"
              body="Paste your website. We pull your logo, colors, typography and a voice vector — so every deal looks and sounds like you."
            />
            <InputCard
              icon={<Store className="size-5" />}
              step="Input C"
              title="Marketplace signal"
              body="Consumer demand — neighborhood mix, saves and redemptions within one mile. Live once the Swell consumer app is active in your market; a clearly-labeled modeled preview until then."
            />
          </div>

          {/* output arrow */}
          <div className="mt-8 flex flex-col items-center">
            <div className="h-8 w-px bg-border-strong" />
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-card">
              <div className="flex size-10 items-center justify-center rounded-xl bg-ember-gradient text-white shadow-ember">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <div className="font-semibold">A 30-day plan, persisted &amp; shareable</div>
                <div className="text-sm text-fg-subtle">
                  date · daypart · item · % off · projected redemptions &amp; revenue · copy · auto-branded creative
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* the moat */}
      <section id="moat" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-ember-200 bg-ember-50 px-3 py-1 text-xs font-medium text-ember-700 dark:border-ember-800/50 dark:bg-ember-950/40 dark:text-ember-300">
              <Flame className="size-3.5" /> The two-sided read
            </div>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl text-balance">
              We read the kitchen <span className="text-ember-gradient">and</span> the street.
            </h2>
            <p className="mt-4 text-fg-muted text-pretty">
              Sales history tells us what&apos;s slow. The live consumer marketplace tells us what the
              neighborhood already craves. The brain blends both — 70% sales history, 30% live demand.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "High organic demand → lower % off on a broad item, to drive trial.",
                "Low organic demand → deeper % off on a hero item, to manufacture urgency.",
                "Projected redemptions = historical orders × marketplace lift.",
                "Every caption passes a brand-voice + prohibited-claims guardrail.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-mint-500/15 text-mint-600">
                    <Check className="size-3" />
                  </span>
                  <span className="text-fg-muted">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MoatStat value="70/30" label="Sales history / live demand blend" />
            <MoatStat value="5" label="Dayparts z-scored per venue" />
            <MoatStat value="30" label="On-brand deals, auto-composed" />
            <MoatStat value="1-tap" label="From plan to live campaign" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-ember-radial px-6 py-16 text-center shadow-lift">
          <div className="absolute inset-0 grid-texture opacity-20" />
          <div className="relative">
            <h2 className="font-display text-4xl text-white sm:text-5xl text-balance">
              Walk in with the campaign already built.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80 text-pretty">
              Their CSV in, their 30-day branded campaign out — as a URL you can text to any operator.
            </p>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-ember-700 shadow-lift transition hover:bg-white/90"
            >
              <Zap className="size-4" /> Generate a campaign now
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <Logo href="/" size="sm" />
          <p className="text-xs text-fg-subtle">
            The software is the delivery mechanism. The brain is high-touch by design.
          </p>
        </div>
      </footer>
    </div>
  );
}

function HeroCreative() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border shadow-lift">
      <div className="relative aspect-[4/5] bg-ember-radial p-7 text-white">
        <div className="absolute inset-0 grid-texture opacity-20" />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
              O
            </div>
            <div className="text-sm font-semibold">Osteria Lume</div>
            <div className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
              flash deal
            </div>
          </div>
          <div className="mt-auto">
            <div className="font-display text-7xl leading-none">
              25<span className="align-top text-4xl">%</span>
            </div>
            <div className="-mt-1 text-2xl font-bold tracking-wide">OFF</div>
            <div className="mt-3 text-xl font-semibold">Cacio e Pepe</div>
            <div className="text-sm text-white/70">Tuesday · 2:00–5:00 PM</div>
            <div className="mt-4 border-t border-white/20 pt-3 text-sm text-white/90">
              “Beat the afternoon lull — Cacio e Pepe, 25% off.”
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareCard({
  name,
  desc,
  tone,
}: {
  name: string;
  desc: string;
  tone: "dim" | "bright";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        tone === "bright"
          ? "border-ember-300 bg-surface shadow-card ring-1 ring-ember-500/20 dark:border-ember-800/60"
          : "border-border bg-surface-2/50"
      }`}
    >
      <div className="flex items-center gap-2">
        {tone === "bright" && <Flame className="size-4" />}
        <span className={`font-semibold ${tone === "bright" ? "" : "text-fg-muted"}`}>{name}</span>
      </div>
      <p className={`mt-2 text-sm ${tone === "bright" ? "text-fg-muted" : "text-fg-subtle"}`}>
        {desc}
      </p>
    </div>
  );
}

function InputCard({
  icon,
  step,
  title,
  body,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft transition hover:shadow-card">
      <div className="flex size-11 items-center justify-center rounded-xl bg-ember-50 text-ember-600 dark:bg-ember-950/40 dark:text-ember-300">
        {icon}
      </div>
      <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{step}</div>
      <h3 className="mt-1 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-fg-muted text-pretty">{body}</p>
    </div>
  );
}

function MoatStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="font-display text-3xl text-ember-gradient">{value}</div>
      <div className="mt-1 text-sm text-fg-muted">{label}</div>
    </div>
  );
}
