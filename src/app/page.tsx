import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Play,
  FileSpreadsheet,
  Globe,
  CloudSun,
  ImageIcon,
  Megaphone,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  CloudRain,
  Ticket,
  TrendingUp,
  Palette,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthNav } from "@/components/auth-nav";
import { Reveal, TiltStack } from "@/components/landing/motion";

export default function Landing() {
  return (
    <div className="relative">
      {/* ============================================================
          HERO — dark, cinematic, 3D product stack
          ============================================================ */}
      <section className="surface-night night-wash grain relative overflow-hidden">
        {/* drifting warm glows */}
        <div className="pointer-events-none absolute inset-0 -z-0">
          <div className="aurora left-[8%] top-[-6%] h-72 w-72" style={{ background: "#f75410" }} />
          <div
            className="aurora right-[6%] top-[8%] h-64 w-64"
            style={{ background: "#ff3b6b", animationDelay: "-6s" }}
          />
          <div
            className="aurora bottom-[-10%] left-[40%] h-72 w-72"
            style={{ background: "#ff7a38", animationDelay: "-11s" }}
          />
        </div>

        {/* top bar (integrated, not sticky) */}
        <header className="relative z-20 mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo />
          <nav className="ml-auto flex items-center gap-3 sm:gap-5">
            <Link href="/demo" className="hidden text-sm text-white/70 hover:text-white sm:block">
              Live demo
            </Link>
            <Link href="/pricing" className="hidden text-sm text-white/70 hover:text-white sm:block">
              Pricing
            </Link>
            <ThemeToggle />
            <AuthNav />
          </nav>
        </header>

        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-14 pb-8 text-center sm:px-6 sm:pt-20">
          <Link
            href="/demo"
            className="animate-fade-up border-gradient inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur transition hover:bg-white/10"
          >
            <span className="flex size-1.5 rounded-full bg-mint-400" />
            See a real campaign — generated minutes ago, no signup
            <ArrowRight className="size-3" />
          </Link>

          <h1 className="animate-fade-up delay-1 mt-7 font-display text-6xl leading-[0.98] tracking-tight text-white sm:text-7xl md:text-8xl text-balance">
            Your slow hours,{" "}
            <span className="text-ember-gradient text-glow italic">filled.</span>
          </h1>

          <p className="animate-fade-up delay-2 mx-auto mt-6 max-w-2xl text-lg text-white/70 text-pretty">
            Upload your sales export. Swell finds the hours you&apos;re losing money, reads the
            weather and the events on your block, and hands back a 30-day plan of offers — with a
            finished, on-brand poster for every single day.
          </p>

          <div className="animate-fade-up delay-3 mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-ember-gradient px-6 text-[15px] font-semibold text-white shadow-ember transition hover:brightness-110"
            >
              Get started free <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-[15px] font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              <Play className="size-4" /> Watch the live demo
            </Link>
          </div>

          {/* honest metric chips */}
          <div className="animate-fade-up delay-4 mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/55">
            <span className="flex items-center gap-1.5">
              <Zap className="size-3.5 text-ember-400" /> First plan in ~10 seconds
            </span>
            <span className="flex items-center gap-1.5">
              <ImageIcon className="size-3.5 text-ember-400" /> 30 branded posters
            </span>
            <span className="flex items-center gap-1.5">
              <CloudSun className="size-3.5 text-ember-400" /> Live weather &amp; local events
            </span>
          </div>
        </div>

        {/* 3D product stack */}
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
          <TiltStack />
        </div>

        {/* fade into the light body */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" />
      </section>

      {/* ============================================================
          STAT STRIP
          ============================================================ */}
      <section className="border-b border-border bg-bg">
        <div className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:px-6 md:grid-cols-4">
          <Stat kpi="30 days" label="planned end to end, every offer chosen for you" />
          <Stat kpi="10 agents" label="one brain: brand, weather, events, revenue" />
          <Stat kpi="$ range" label="a projection with a confidence band, not a fake number" />
          <Stat kpi="0 design" label="posters, ad kit and captions, all auto-branded" />
        </div>
      </section>

      {/* ============================================================
          01 — HOW THE BRAIN WORKS
          ============================================================ */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionKicker>How it works</SectionKicker>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl text-balance">
            Three inputs. Ten seconds. A month on your desk.
          </h2>
          <p className="mt-4 text-fg-muted text-pretty">
            No dashboards to learn, no strategy to write. You give it three things and it hands back
            a plan you can run tomorrow.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <Reveal delay={0}>
            <Step
              n="01"
              icon={<FileSpreadsheet className="size-5" />}
              title="Drop in your sales"
              body="A Toast or Square CSV. Swell reads every order and z-scores your dayparts to find exactly which hours are quietly bleeding money."
            />
          </Reveal>
          <Reveal delay={90}>
            <Step
              n="02"
              icon={<Globe className="size-5" />}
              title="Paste your site + address"
              body="It lifts your logo, colours and tone of voice, then pulls the live forecast and real events for your block — so the plan fits your street, not a generic template."
            />
          </Reveal>
          <Reveal delay={180}>
            <Step
              n="03"
              icon={<Sparkles className="size-5" />}
              title="Get 30 days, built"
              body="An offer for every day — item, time window and discount — each with a finished poster, a caption, and a revenue projection you can see before you commit."
            />
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          02 — READS THE WORLD OUTSIDE YOUR DOOR (weather + events)
          ============================================================ */}
      <section className="border-y border-border bg-surface-2/40 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <SectionKicker>Real-time intelligence</SectionKicker>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl text-balance">
              It reads the world outside your door.
            </h2>
            <p className="mt-4 text-fg-muted text-pretty">
              Most tools wait for you to ask a question. Swell already looked out the window. A rainy
              Tuesday becomes a comfort dish at a deeper discount. A game down the street becomes your
              hero item at full margin — because the crowd is already coming.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                ["Rainy lunch → comfort dish, deeper discount", <CloudRain key="r" className="size-4" />],
                ["Concert or game nearby → hero item, no discount needed", <Ticket key="t" className="size-4" />],
                ["Sunny Saturday → lighter plate, margin protected", <CloudSun key="s" className="size-4" />],
                ["Every caption checked for over-claiming before it ships", <ShieldCheck key="c" className="size-4" />],
              ].map(([t, icon]) => (
                <li key={t as string} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-ember-50 text-ember-600 dark:bg-ember-950/50 dark:text-ember-300">
                    {icon}
                  </span>
                  <span className="text-fg-muted">{t}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <div className="grid gap-3">
              <DayHook day="Tue" weather="🌧️ 58° Rain" hook="Rainy Tuesday? Cacio e Pepe, 30% off." tone="rain" />
              <DayHook day="Sat" weather="🎫 Game day · Wintrust" hook="Game day nearby — Margherita, 5–9pm." tone="event" featured />
              <DayHook day="Sun" weather="☀️ 82° Clear" hook="82° and sunny — Aperol Spritz, patio hour." tone="sun" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          03 — POSTERS
          ============================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <div className="scene">
              <div
                className="tilt overflow-hidden rounded-2xl border border-border shadow-lift"
                style={{ transform: "rotateY(4deg)" }}
              >
                <Image
                  src="/preview/posters.png"
                  alt="A gallery of thirty auto-branded posters, one for each day of the campaign"
                  width={2880}
                  height={2480}
                  className="w-full"
                />
              </div>
            </div>
          </Reveal>
          <Reveal delay={120} className="order-1 lg:order-2">
            <SectionKicker>
              <Palette className="size-3.5" /> Auto-branded creative
            </SectionKicker>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl text-balance">
              Thirty posters. All unmistakably you.
            </h2>
            <p className="mt-4 text-fg-muted text-pretty">
              A finished poster for every day, in your colours, over real food photography — not a
              template with your logo bolted on. Download them, or send them straight out.
            </p>
            <div className="mt-7 flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-soft">
              <Megaphone className="size-5 shrink-0 text-ember-600" />
              <p className="text-sm text-fg-muted">
                Every poster is re-cut for Meta, Instagram, Google and TikTok, with headlines already
                trimmed to each platform&apos;s character limit.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          04 — THE MONEY MATH (dark proof band)
          ============================================================ */}
      <section className="surface-night grain relative overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="aurora right-[15%] top-[10%] h-64 w-64" style={{ background: "#10b981", opacity: 0.25 }} />
          <div className="aurora left-[10%] bottom-0 h-64 w-64" style={{ background: "#f75410", opacity: 0.3 }} />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <SectionKicker dark>
              <TrendingUp className="size-3.5" /> The numbers, up front
            </SectionKicker>
            <h2 className="mt-3 font-display text-4xl text-white sm:text-5xl text-balance">
              The money math — shown, not promised.
            </h2>
            <p className="mt-4 text-white/65 text-pretty">
              Anyone can print a big number. Swell shows you a <em>range</em> with a confidence label,
              and tells you exactly which inputs are measured, which are assumed, and which are still
              modeled. You see how sure it is before you spend a cent.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
              <ProofCard value="+$3,246" label="expected incremental over 30 days" accent />
              <ProofCard value="$1.5K–$5.9K" label="honest low → high range, not a point guess" />
              <ProofCard value="7 / 7" label="validation checks passed on the plan" />
            </div>
            <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-xs">
              {[
                ["Baseline revenue", "measured", "bg-mint-500/15 text-mint-300"],
                ["Response rate", "assumed", "bg-amber-500/15 text-amber-300"],
                ["Demand multiplier", "modeled", "bg-violet-500/15 text-violet-300"],
              ].map(([label, tag, cls]) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70"
                >
                  {label}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
                    {tag}
                  </span>
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
          05 — THE AGENT TEAM
          ============================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionKicker>Under the hood</SectionKicker>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl text-balance">
            Not one model. A team of ten agents.
          </h2>
          <p className="mt-4 text-fg-muted text-pretty">
            Each does one job and hands off to the next — the way a real marketing team would, if it
            could run your whole month in ten seconds.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Brand", "logo, colours, tone"],
            ["Weather", "live forecast + normals"],
            ["Events", "concerts, games, holidays"],
            ["Demand", "your slowest hours"],
            ["Location", "geocodes your block"],
            ["Analyst", "z-scores your dayparts"],
            ["Strategy", "30 offers, item + discount"],
            ["Copywriter", "captions, over-claim guardrail"],
            ["Creative", "a poster for every day"],
            ["Revenue", "projection + confidence"],
          ].map(([name, role], i) => (
            <Reveal key={name} delay={(i % 5) * 60}>
              <div className="group h-full rounded-xl border border-border bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card">
                <div className="num-badge text-sm font-semibold">{String(i + 1).padStart(2, "0")}</div>
                <div className="mt-1.5 font-semibold">{name}</div>
                <div className="text-xs text-fg-subtle">{role}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============================================================
          06 — WHAT SWELL IS / ISN'T
          ============================================================ */}
      <section className="border-y border-border bg-surface-2/40 py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl sm:text-5xl text-balance">
              Most tools wait to be asked.
            </h2>
            <p className="mt-4 text-fg-muted text-pretty">
              Swell shows up on Monday with the month already planned — because it read your register
              and looked out the window.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <Reveal>
              <IsIsnt
                kind="is"
                title="What Swell is"
                items={[
                  "A brain that plans your whole month, unprompted",
                  "Live weather + real local events, driving each day",
                  "A revenue range with a stated confidence level",
                  "Captions checked for over-claiming before they ship",
                  "A poster + ad kit, branded to you, for all 30 days",
                ]}
              />
            </Reveal>
            <Reveal delay={100}>
              <IsIsnt
                kind="isnt"
                title="What it isn't"
                items={[
                  "A chatbot you have to prompt and re-prompt",
                  "A template generator with your logo pasted on",
                  "A dashboard you have to learn and maintain",
                  "A tool that invents a confident number it can't back",
                  "Another login that emails you charts you never read",
                ]}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================================================
          07 — FAQ
          ============================================================ */}
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <Reveal className="text-center">
          <SectionKicker>Questions</SectionKicker>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl">Before you sign up</h2>
        </Reveal>
        <div className="mt-12 divide-y divide-border">
          <Faq q="What do I need to start?">
            A Toast or Square sales export (30–90 days), your website URL, and your address. That&apos;s it.
          </Faq>
          <Faq q="How long does it take?">
            The first 30-day plan generates in about ten seconds. Posters render in the background so
            the gallery is ready by the time you scroll to it.
          </Faq>
          <Faq q="What if my menu isn't on my website?">
            It still works — the plan is driven by your sales history first. You can add or rename
            items after, and every offer recomputes instantly.
          </Faq>
          <Faq q="Are the revenue numbers real?">
            They&apos;re an honest modeled range, not a promise. Swell shows the low-to-high band, a
            confidence label, and tags every assumption as measured, assumed, or modeled — so you know
            exactly how much to trust it.
          </Faq>
          <Faq q="Does it post the ads for me?">
            It hands you a publish-ready ad kit sized for every platform. Live auto-posting needs your
            own Meta / Google ad accounts, and Swell stops before spending any money for you.
          </Faq>
          <Faq q="What does it cost?">
            <>
              There&apos;s a live demo you can see with no signup. Plans are on the{" "}
              <Link href="/pricing" className="font-medium text-ember-600 hover:text-ember-700">
                pricing page
              </Link>
              .
            </>
          </Faq>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA
          ============================================================ */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="grain relative overflow-hidden rounded-3xl bg-ember-radial px-6 py-20 text-center shadow-lift">
            <div className="relative z-10">
              <h2 className="font-display text-4xl text-white sm:text-6xl text-balance">
                Stop guessing what to run on Tuesday.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-white/85 text-pretty">
                Your first campaign takes about ten seconds. See it before you pay for it.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link
                  href="/sign-up"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-[15px] font-semibold text-ember-700 shadow-lift transition hover:bg-white/90"
                >
                  Get started free <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 px-7 text-[15px] font-medium text-white transition hover:bg-white/10"
                >
                  <Play className="size-4" /> Live demo
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <Logo href="/" size="sm" />
          <div className="flex items-center gap-5 text-xs text-fg-subtle">
            <Link href="/demo" className="hover:text-fg">Live demo</Link>
            <Link href="/pricing" className="hover:text-fg">Pricing</Link>
            <Link href="/sign-in" className="hover:text-fg">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function SectionKicker({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        dark
          ? "border-white/15 bg-white/5 text-white/70"
          : "border-border bg-surface text-fg-muted shadow-soft"
      }`}
    >
      {children}
    </span>
  );
}

function Stat({ kpi, label }: { kpi: string; label: string }) {
  return (
    <div className="px-4 py-6 text-center">
      <div className="font-display text-3xl text-ember-gradient">{kpi}</div>
      <div className="mx-auto mt-1 max-w-[16rem] text-xs text-fg-subtle text-pretty">{label}</div>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-card">
      <div className="pointer-events-none absolute -right-6 -top-8 font-display text-8xl text-border/60 transition group-hover:text-ember-100 dark:group-hover:text-ember-950/60">
        {n}
      </div>
      <div className="relative flex size-11 items-center justify-center rounded-xl bg-ember-gradient text-white shadow-ember">
        {icon}
      </div>
      <h3 className="relative mt-5 text-lg font-semibold">{title}</h3>
      <p className="relative mt-2 text-sm text-fg-muted text-pretty">{body}</p>
    </div>
  );
}

function DayHook({
  day,
  weather,
  hook,
  tone,
  featured = false,
}: {
  day: string;
  weather: string;
  hook: string;
  tone: "rain" | "event" | "sun";
  featured?: boolean;
}) {
  const ring = tone === "event" ? "border-ember-300 dark:border-ember-800" : "border-border";
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border bg-surface p-4 shadow-soft ${ring} ${
        featured ? "ring-2 ring-ember-500/30" : ""
      }`}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-center">
        <span className="text-xs font-bold text-fg">{day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-fg-subtle">{weather}</div>
        <div className="mt-0.5 truncate text-sm font-medium text-fg">{hook}</div>
      </div>
      {featured && (
        <span className="shrink-0 rounded-full bg-ember-gradient px-2 py-0.5 text-[10px] font-semibold text-white">
          hero item
        </span>
      )}
    </div>
  );
}

function ProofCard({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 text-center ${
        accent
          ? "border-transparent bg-ember-gradient text-white shadow-ember"
          : "border-white/10 bg-white/5 text-white"
      }`}
    >
      <div className="font-display text-3xl">{value}</div>
      <div className={`mt-1 text-xs text-pretty ${accent ? "text-white/85" : "text-white/55"}`}>{label}</div>
    </div>
  );
}

function IsIsnt({ kind, title, items }: { kind: "is" | "isnt"; title: string; items: string[] }) {
  const on = kind === "is";
  return (
    <div className={`h-full rounded-2xl border p-6 ${on ? "border-mint-500/30 bg-mint-500/5" : "border-border bg-surface"}`}>
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                on ? "bg-mint-500/20 text-mint-600" : "bg-fg-subtle/10 text-fg-subtle"
              }`}
            >
              {on ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className={on ? "text-fg" : "text-fg-muted"}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
        <span className="font-medium text-fg">{q}</span>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-fg-subtle transition group-open:rotate-45">
          <span className="text-lg leading-none">+</span>
        </span>
      </summary>
      <p className="mt-3 max-w-2xl text-sm text-fg-muted text-pretty">{children}</p>
    </details>
  );
}
