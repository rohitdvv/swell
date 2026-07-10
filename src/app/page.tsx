import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  FileSpreadsheet,
  CloudSun,
  CalendarDays,
  ImageIcon,
  BarChart3,
  Megaphone,
  Play,
  Check,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthNav } from "@/components/auth-nav";

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* one soft glow, top-centre. No competing background noise. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px]">
        <div
          className="absolute left-1/2 top-[-180px] h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: "radial-gradient(circle, #f75410, transparent 70%)" }}
        />
      </div>

      {/* ---------------- nav ---------------- */}
      <header className="sticky top-0 z-30 border-b border-border/60 glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo />
          <nav className="ml-auto flex items-center gap-3 sm:gap-5">
            <Link href="/demo" className="hidden text-sm text-fg-muted hover:text-fg sm:block">
              Live demo
            </Link>
            <Link href="/pricing" className="hidden text-sm text-fg-muted hover:text-fg sm:block">
              Pricing
            </Link>
            <ThemeToggle />
            <AuthNav />
          </nav>
        </div>
      </header>

      {/* ---------------- hero ---------------- */}
      <section className="mx-auto max-w-4xl px-4 pt-20 pb-14 text-center sm:px-6 sm:pt-28">
        <Link
          href="/demo"
          className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted shadow-soft transition hover:border-border-strong hover:text-fg"
        >
          <span className="flex size-1.5 rounded-full bg-mint-500" />
          See a real campaign, no signup
          <ArrowRight className="size-3" />
        </Link>

        <h1 className="animate-fade-up delay-1 mt-6 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl text-balance">
          Your slow hours,{" "}
          <span className="italic text-ember-gradient">filled.</span>
        </h1>

        <p className="animate-fade-up delay-2 mx-auto mt-6 max-w-xl text-lg text-fg-muted text-pretty">
          Upload your sales export. Swell finds the hours you&apos;re losing money, checks
          tomorrow&apos;s weather on your block, and writes a 30-day plan of offers — with a
          finished poster for every single day.
        </p>

        <div className="animate-fade-up delay-3 mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-ember-gradient px-6 text-[15px] font-medium text-white shadow-ember transition hover:brightness-105"
          >
            Get started free <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-border-strong bg-surface px-6 text-[15px] font-medium text-fg shadow-soft transition hover:bg-surface-2"
          >
            <Play className="size-4" /> Watch the live demo
          </Link>
        </div>

        <p className="animate-fade-up delay-4 mt-4 text-xs text-fg-subtle">
          Works with Toast &amp; Square exports · First campaign in about ten seconds
        </p>
      </section>

      {/* ---------------- product shot ---------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="animate-scale-in delay-2 relative">
          <div className="overflow-hidden rounded-2xl border border-border shadow-lift">
            <Image
              src="/preview/dashboard.png"
              alt="A Swell campaign: calendar of daily offers with live weather, projected revenue and agent activity"
              width={2880}
              height={2480}
              priority
              className="w-full"
            />
          </div>
          {/* one poster, peeking */}
          <div className="absolute -bottom-6 -right-3 hidden w-40 overflow-hidden rounded-xl border border-border shadow-lift md:block lg:-right-8 lg:w-52">
            <Image
              src="/preview/poster.png"
              alt="An auto-branded poster generated for one day of the campaign"
              width={1080}
              height={1350}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section id="how" className="border-y border-border bg-surface-2/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-4xl sm:text-5xl">Three inputs. Ten seconds.</h2>
            <p className="mt-3 text-fg-muted text-pretty">
              No dashboards to learn. No strategy to write. You give it three things and it hands
              you a month.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            <Step
              n="1"
              icon={<FileSpreadsheet className="size-5" />}
              title="Your sales export"
              body="Drop in a Toast or Square CSV. Swell reads every order and z-scores your dayparts to find exactly which hours are underperforming."
            />
            <Step
              n="2"
              icon={<CloudSun className="size-5" />}
              title="Your address"
              body="It pulls the live 16-day forecast for your block. Rain on Tuesday means a comfort dish at a deeper discount. Sun on Saturday means patio fare at full margin."
            />
            <Step
              n="3"
              icon={<ImageIcon className="size-5" />}
              title="Your website"
              body="It lifts your logo, colours and tone of voice, so all 30 posters look like you made them — not like a template."
            />
          </div>
        </div>
      </section>

      {/* ---------------- what you get ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-4xl sm:text-5xl">What lands on your desk</h2>
          <p className="mt-3 text-fg-muted">Everything below is generated, not requested.</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <Deliverable
            icon={<CalendarDays className="size-5" />}
            title="A 30-day calendar"
            body="One offer per day — item, time window and discount — each tuned to that day's weather, your slowest hours and your best margins."
          />
          <Deliverable
            icon={<BarChart3 className="size-5" />}
            title="The numbers, up front"
            body="Last 30 days versus what's projected next, day-of-week revenue, daypart mix. You see the lift before you commit to anything."
          />
          <Deliverable
            icon={<ImageIcon className="size-5" />}
            title="30 finished posters"
            body="A branded poster for every single day, in your colours, over real food photography. Download them or post them straight out."
          />
          <Deliverable
            icon={<Megaphone className="size-5" />}
            title="An ad kit"
            body="Every poster re-cut for Meta, Instagram, Google and TikTok, with headlines already trimmed to each platform's character limits."
          />
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/demo"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-border-strong bg-surface px-6 text-[15px] font-medium text-fg shadow-soft transition hover:bg-surface-2"
          >
            <Play className="size-4" /> See all of it in the live demo
          </Link>
        </div>
      </section>

      {/* ---------------- why it's different ---------------- */}
      <section id="moat" className="border-t border-border bg-surface-2/40 py-20">
        <div className="mx-auto grid max-w-5xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl text-balance">
              Most tools wait to be asked.
            </h2>
            <p className="mt-4 text-fg-muted text-pretty">
              Toast&apos;s AI answers questions you already knew to ask. Agencies charge $500 a month
              for a website. Swell just shows up on Monday with the month already planned — because
              it read your register and looked out the window.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Rainy Tuesday lunch → comfort dish, deeper discount",
                "Sunny Saturday → lighter plate, margin protected",
                "Concert down the street → hero item, no discount needed",
                "Every caption checked for over-claiming before it ships",
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

          <div className="overflow-hidden rounded-2xl border border-border shadow-card">
            <Image
              src="/preview/posters.png"
              alt="A gallery of thirty auto-branded posters, one for each day of the campaign"
              width={2880}
              height={2480}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* ---------------- close ---------------- */}
      <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-ember-radial px-6 py-16 text-center shadow-lift">
          <div className="relative">
            <h2 className="font-display text-4xl text-white sm:text-5xl text-balance">
              Stop guessing what to run on Tuesday.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-white/80 text-pretty">
              Your first campaign takes about ten seconds. See it before you pay for it.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-ember-700 shadow-lift transition hover:bg-white/90"
              >
                Get started free <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 px-6 text-[15px] font-medium text-white transition hover:bg-white/10"
              >
                <Play className="size-4" /> Live demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <Logo href="/" size="sm" />
          <div className="flex items-center gap-5 text-xs text-fg-subtle">
            <Link href="/demo" className="hover:text-fg">
              Live demo
            </Link>
            <Link href="/pricing" className="hover:text-fg">
              Pricing
            </Link>
            <Link href="/sign-in" className="hover:text-fg">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
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
    <div className="relative">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-ember-50 text-ember-600 dark:bg-ember-950/40 dark:text-ember-300">
          {icon}
        </div>
        <span className="font-display text-4xl text-border-strong">{n}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-fg-muted text-pretty">{body}</p>
    </div>
  );
}

function Deliverable({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft transition hover:shadow-card">
      <div className="flex size-10 items-center justify-center rounded-xl bg-ember-50 text-ember-600 dark:bg-ember-950/40 dark:text-ember-300">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-fg-muted text-pretty">{body}</p>
    </div>
  );
}
