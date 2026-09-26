import Link from "next/link";
import { Check, X } from "lucide-react";
import { AuthNav } from "@/components/auth-nav";
import { osClass, OS } from "@/components/os-theme";
import { MonthExplorer, MoneyMath } from "@/components/landing/os-widgets";
import { repo } from "@/lib/db";
import { DEMO_SLUG } from "@/lib/authz";
import type { CampaignDay } from "@/lib/types";

// Posters in the hero come from the live demo campaign; refresh hourly.
export const revalidate = 3600;

async function heroPosters(): Promise<CampaignDay[]> {
  try {
    const demo = await repo.getCampaignBySlug(DEMO_SLUG);
    if (!demo) return [];
    const seen = new Set<string>();
    return demo.days.filter((d) => !seen.has(d.item) && seen.add(d.item)).slice(0, 3);
  } catch {
    return []; // the hero still reads fine without them
  }
}

/**
 * Swell — landing page. Positioned on the one thing a general-purpose AI
 * can't do for a restaurant: read its register, and prove on that same
 * register what a promotion earned.
 */
export default async function Landing() {
  const posters = await heroPosters();
  return (
    <div className={osClass("min-h-screen")} style={{ background: OS.bg }}>
      {/* ══ NAV ══ */}
      <header
        className="sticky top-0 z-50 flex h-16 items-center gap-8 border-b px-5 sm:px-10"
        style={{
          borderColor: OS.line,
          background: "rgba(251,248,243,0.86)",
          backdropFilter: "blur(14px)",
        }}
      >
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="font-display text-2xl font-medium tracking-[-0.02em]">Swell</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: OS.amber }}>
            OS
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-5 text-[13px] sm:gap-7">
          <Link href="#why" className="hidden hover:text-fg lg:block" style={{ color: OS.muted }}>
            Why Swell
          </Link>
          <Link href="#proof" className="hidden hover:text-fg lg:block" style={{ color: OS.muted }}>
            Proof
          </Link>
          <Link href="/demo" className="hidden hover:text-fg sm:block" style={{ color: OS.muted }}>
            Sample campaign
          </Link>
          <Link href="/pricing" className="hidden hover:text-fg sm:block" style={{ color: OS.muted }}>
            Pricing
          </Link>
          <AuthNav />
        </nav>
      </header>

      {/* ══ HERO ══ */}
      <section id="top" className="relative overflow-hidden border-b" style={{ borderColor: OS.line }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 70% at 80% 10%, rgba(232,163,61,0.10) 0%, transparent 55%), radial-gradient(60% 50% at 10% 90%, rgba(228,87,46,0.07) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-5 pb-16 pt-14 sm:px-10 lg:grid-cols-2 lg:pb-[84px] lg:pt-[72px]">
          <div className="os-fade-up">
            <div
              className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: OS.amber }}
            >
              <span className="os-pulse size-1.5 rounded-full" style={{ background: OS.mint }} />
              For independent restaurants
            </div>
            <h1 className="mt-6 font-display text-[clamp(44px,6vw,76px)] font-normal leading-[1.0] tracking-[-0.025em] text-balance">
              Fill your slow hours. <em className="italic" style={{ color: OS.amber }}>Prove it</em> on your
              register.
            </h1>
            <p className="mt-7 max-w-[520px] text-[17px] leading-[1.6] text-pretty" style={{ color: OS.muted }}>
              Swell reads your POS, finds the hours you&apos;re quietly empty, and plans a month of offers
              for them — each with a poster and caption you can post in one tap. Then it reads your
              register again and tells you, in dollars, what the campaign actually earned.
            </p>
            <div className="mt-9 flex flex-wrap gap-3.5">
              <Link
                href="/sign-up"
                className="inline-flex h-[50px] items-center rounded px-6 text-[15px] font-bold transition hover:brightness-110"
                style={{ background: OS.amber, color: "#FFFFFF" }}
              >
                Start free — no card
              </Link>
              <Link
                href="/demo"
                className="inline-flex h-[50px] items-center rounded border px-6 text-[15px] transition hover:border-current"
                style={{ borderColor: "rgba(28,25,23,0.2)", color: OS.fg }}
              >
                See a live campaign
              </Link>
            </div>
            <div
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.06em]"
              style={{ color: OS.subtle }}
            >
              <span>READS YOUR POS</span>
              <span>POSTS IN ONE TAP</span>
              <span>PROVES WHAT IT EARNED</span>
            </div>
          </div>

          <PosterStack days={posters} />
        </div>
      </section>

      {/* ══ TICKER ══ */}
      <div className="overflow-hidden border-b py-3" style={{ borderColor: OS.line, background: OS.bgAlt }}>
        <div
          className="os-ticker flex w-max gap-12 whitespace-nowrap font-mono text-[11px] tracking-[0.1em]"
          style={{ color: OS.subtle }}
        >
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i}>
              <span style={{ color: OS.amber }}>◆</span>&nbsp;&nbsp;{t}
            </span>
          ))}
        </div>
      </div>

      {/* ══ 01 · HOW ══ */}
      <section className="mx-auto max-w-[1280px] px-5 py-20 sm:px-10 lg:pb-[90px] lg:pt-[110px]">
        <div className="grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-14">
          <div>
            <div className="font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.amber }}>
              CHAPTER 01
            </div>
            <h2 className="mt-3.5 font-display text-[40px] font-normal leading-[1.08] tracking-[-0.02em]">
              Three inputs.
              <br />
              Ten seconds.
              <br />A month on your desk.
            </h2>
          </div>
          <div
            className="grid gap-px border sm:grid-cols-3"
            style={{ background: "rgba(28,25,23,0.1)", borderColor: "rgba(28,25,23,0.1)" }}
          >
            {STEPS.map((s) => (
              <div key={s.n} style={{ background: OS.bg, padding: "30px 26px 34px" }}>
                <div
                  className="font-display text-[52px] italic leading-none"
                  style={{ color: "rgba(232,163,61,0.35)" }}
                >
                  {s.n}
                </div>
                <h3 className="mt-4.5 text-[17px] font-semibold" style={{ color: OS.fg, marginTop: 18 }}>
                  {s.title}
                </h3>
                <p className="mt-2.5 text-[13.5px] leading-[1.6] text-pretty" style={{ color: OS.muted }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 02 · READS THE WORLD ══ */}
      <section id="world" className="border-t" style={{ borderColor: OS.line, background: OS.bgAlt }}>
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-10 lg:py-[100px]">
          <MonthExplorer />
        </div>
      </section>

      {/* ══ 03 · THE MONEY MATH (paper) ══ */}
      <section id="money" style={{ background: OS.paper, color: OS.ink }}>
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-10 lg:py-[110px]">
          <div className="grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-14">
            <div>
              <div className="font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.bronze }}>
                CHAPTER 03
              </div>
              <h2
                className="mt-3.5 font-display text-[40px] font-normal leading-[1.08] tracking-[-0.02em]"
                style={{ color: OS.ink }}
              >
                The money math — shown, not promised.
              </h2>
              <p className="mt-4.5 text-[14px] leading-[1.65] text-pretty" style={{ color: OS.inkMuted, marginTop: 18 }}>
                Anyone can print a big number. Swell shows a range with a stated confidence, and lets
                you stress the assumption yourself. Drag it.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                {ASSUMPTIONS.map((a) => (
                  <div
                    key={a.label}
                    className="flex items-center justify-between rounded border px-3 py-2.5"
                    style={{ borderColor: "rgba(25,24,19,0.14)", background: OS.paperCard }}
                  >
                    <span className="text-[12.5px]" style={{ color: OS.ink }}>
                      {a.label}
                    </span>
                    <span
                      className="rounded-[3px] px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.08em]"
                      style={{ background: a.bg, color: a.fg }}
                    >
                      {a.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <MoneyMath />
          </div>
        </div>
      </section>

      {/* ══ WHY NOT JUST ASK A CHATBOT ══ */}
      <section id="why" className="border-t" style={{ borderColor: OS.line }}>
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-10 lg:py-[110px]">
          <div className="max-w-[680px]">
            <div className="font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.amber }}>
              CHAPTER 04 — WHY NOT JUST ASK CHATGPT?
            </div>
            <h2 className="mt-4 font-display text-[clamp(32px,5vw,48px)] font-normal leading-[1.05] tracking-[-0.02em] text-balance">
              A chatbot can write a promotion. It can&apos;t see your register.
            </h2>
            <p className="mt-5 text-[16px] leading-[1.6] text-pretty" style={{ color: OS.muted }}>
              General assistants and Meta&apos;s ad tools are great at words and pictures. They don&apos;t
              know which of your hours are empty, and they can&apos;t tell you whether last month&apos;s
              offer made you a dollar. That&apos;s the whole job.
            </p>
          </div>
          <div className="mt-12 overflow-x-auto rounded-lg border" style={{ borderColor: OS.line2, background: OS.panel }}>
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead>
                <tr className="border-b" style={{ borderColor: OS.line2 }}>
                  <th className="px-5 py-4 font-normal" style={{ color: OS.subtle }} />
                  <th className="px-5 py-4 font-semibold" style={{ color: OS.muted }}>
                    ChatGPT / Meta AI
                  </th>
                  <th className="px-5 py-4 font-semibold" style={{ color: OS.amber }}>
                    Swell
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([what, them, us]) => (
                  <tr key={what} className="border-b last:border-0" style={{ borderColor: OS.line }}>
                    <td className="px-5 py-4 font-medium">{what}</td>
                    <td className="px-5 py-4" style={{ color: OS.muted }}>
                      <span className="inline-flex items-start gap-2">
                        {them.startsWith("✓") ? (
                          <Check className="mt-0.5 size-4 shrink-0" style={{ color: OS.mint }} />
                        ) : (
                          <X className="mt-0.5 size-4 shrink-0" style={{ color: OS.subtle }} />
                        )}
                        {them.replace(/^[✓✗] /, "")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0" style={{ color: OS.mint }} />
                        {us}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══ PROOF ══ */}
      <section id="proof" className="border-t" style={{ borderColor: OS.line, background: OS.bgAlt }}>
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-20 sm:px-10 lg:grid-cols-2 lg:py-[110px]">
          <div>
            <div className="font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.amber }}>
              CHAPTER 05 — PROOF
            </div>
            <h2 className="mt-4 font-display text-[clamp(32px,5vw,48px)] font-normal leading-[1.05] tracking-[-0.02em] text-balance">
              Next month, your register grades the campaign.
            </h2>
            <p className="mt-5 text-[16px] leading-[1.6] text-pretty" style={{ color: OS.muted }}>
              Upload the same export after the campaign runs. Swell compares every campaign day with what
              your sales would have been without it — forecast from your history before it started — and
              checks each promo dish inside its window. You get a verdict and a dollar figure with an
              honest range. Not a vanity metric: your register.
            </p>
            <ul className="mt-7 space-y-3 text-[14.5px]">
              {PROOF_POINTS.map((p) => (
                <li key={p} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0" style={{ color: OS.mint }} />
                  <span style={{ color: OS.fg }}>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <ProofIllustration />
        </div>
      </section>

      {/* ══ 05 · AGENT INDEX ══ */}
      <section className="border-t" style={{ borderColor: OS.line, background: OS.bgAlt }}>
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-10 lg:py-[100px]">
          <div className="flex flex-wrap items-baseline gap-6">
            <div className="font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.amber }}>
              CHAPTER 06
            </div>
            <h2 className="font-display text-[40px] font-normal tracking-[-0.02em]">
              Not one model. A team of ten.
            </h2>
            <span className="ml-auto font-mono text-[11px]" style={{ color: OS.subtle }}>
              EACH OWNS ONE JOB · EVERY RUN AUDITABLE
            </span>
          </div>
          <div className="mt-11 border-t" style={{ borderColor: OS.line2 }}>
            {AGENT_INDEX.map((a) => (
              <div
                key={a.n}
                className="grid grid-cols-[52px_1fr] items-baseline gap-5 border-b px-1 py-4 sm:grid-cols-[80px_220px_1fr]"
                style={{ borderColor: OS.line }}
              >
                <span
                  className="font-display text-[22px] italic"
                  style={{ color: "rgba(232,163,61,0.5)" }}
                >
                  {a.n}
                </span>
                <span className="text-[15px] font-semibold" style={{ color: OS.fg }}>
                  {a.name}
                </span>
                <span className="col-span-2 text-[13px] sm:col-span-1" style={{ color: OS.muted }}>
                  {a.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="relative overflow-hidden border-t" style={{ borderColor: OS.line }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(70% 90% at 50% 110%, rgba(232,163,61,0.14) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[900px] px-5 py-24 text-center sm:px-10 lg:pb-[120px] lg:pt-[130px]">
          <h2 className="font-display text-[clamp(40px,7vw,64px)] font-normal leading-[1.02] tracking-[-0.025em] text-balance">
            Stop guessing what to run on <em className="italic" style={{ color: OS.amber }}>Tuesday.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-[440px] text-[16px] leading-[1.6]" style={{ color: OS.muted }}>
            Your first campaign is free and takes about a minute. Upload an export, get a month of offers
            and posters, and find out what it earned.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3.5">
            <Link
              href="/sign-up"
              className="inline-flex h-[52px] items-center rounded px-7 text-[15px] font-bold transition hover:brightness-110"
              style={{ background: OS.amber, color: "#FFFFFF" }}
            >
              Start free
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-[52px] items-center rounded border px-7 text-[15px] transition"
              style={{ borderColor: "rgba(28,25,23,0.2)", color: OS.fg }}
            >
              View sample campaign
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer
        className="flex flex-wrap items-center gap-6 border-t px-5 py-7 sm:px-10"
        style={{ borderColor: OS.line }}
      >
        <span className="font-display text-[18px]">
          Swell{" "}
          <span className="font-mono text-[9px] tracking-[0.18em]" style={{ color: OS.amber }}>
            OS
          </span>
        </span>
        <span className="font-mono text-[10px] tracking-[0.1em]" style={{ color: OS.subtle }}>
          MARKETING THAT PROVES IT PAID
        </span>
        <nav className="ml-auto flex gap-5 text-[12px]">
          <Link href="/demo" style={{ color: OS.muted }}>
            Sample campaign
          </Link>
          <Link href="/pricing" style={{ color: OS.muted }}>
            Pricing
          </Link>
          <Link href="/pitch" style={{ color: OS.muted }}>
            Pitch
          </Link>
        </nav>
      </footer>
    </div>
  );
}

// ---- content ------------------------------------------------

const TICKER = [
  "RAIN 58° TUE → CACIO E PEPE 30% OFF",
  "GAME DAY WINTRUST → HERO ITEM, FULL MARGIN",
  "30 POSTERS RENDERED IN 9.4S",
  "CAPTIONS GUARDRAILED — 0 OVER-CLAIMS",
  "SLOW-HOUR SALES → MOSTLY PROFIT",
  "7/7 VALIDATION CHECKS PASSED",
  "3 MODELS COMPETE · WINNER BEATS 'SAME AS LAST WEEK'",
  "PROOF: ACTUAL VS EXPECTED, ON YOUR REGISTER",
  "SEASONAL NORMALS BEYOND DAY 16 — MARKED EST.",
];

const STEPS = [
  {
    n: "01",
    title: "Drop in your sales",
    body: "A Toast or Square export. Swell reads every order and finds the hours quietly bleeding money — by day, by daypart, by dish.",
  },
  {
    n: "02",
    title: "Paste your site + address",
    body: "It lifts your logo, colours and voice, then pulls the live forecast and real events on your block.",
  },
  {
    n: "03",
    title: "Post, then prove",
    body: "An offer for every day — dish, window, discount — with a poster and caption to post in one tap. Next month, upload again and see what it earned.",
  },
];

const ASSUMPTIONS = [
  { label: "Baseline revenue", tag: "measured", bg: "rgba(62,142,108,0.14)", fg: "#3E8E6C" },
  { label: "Response rate", tag: "assumed", bg: "rgba(180,118,42,0.14)", fg: "#B4762A" },
  { label: "Demand multiplier", tag: "modeled", bg: "rgba(106,90,205,0.12)", fg: "#6A5ACD" },
];

const COMPARE: Array<[string, string, string]> = [
  ["Knows your slow hours", "✗ Only what you tell it", "Reads every order in your POS export"],
  ["Knows tomorrow's weather and local events", "✗ Not unless you look it up", "Live forecast + holidays + games near you"],
  ["A month of offers, posters and captions", "✓ If you prompt it 30 times", "One upload, about a minute"],
  ["Posts to Instagram and Facebook", "✓ Via ad accounts and setup", "One tap from your phone, no linking"],
  ["Tells you what it earned", "✗ Clicks and likes, not dollars", "Actual vs expected on your register"],
  ["Honest about uncertainty", "✗ Confident either way", "Every number ships with a range"],
];

const PROOF_POINTS = [
  "The expected line comes from a model trained only on sales before the campaign",
  "Promo dishes counted inside their windows against the same weekday before",
  "A verdict you can trust: proven, promising, no lift, or too early",
  "Tested: on data with no real effect, it wrongly says 'proven' about 1 time in 12",
];

/** Posters from the live demo, fanned like a stack of prints on the pass. */
function PosterStack({ days }: { days: CampaignDay[] }) {
  if (days.length === 0) return <div aria-hidden className="hidden lg:block" />;
  const tilt = ["-rotate-6 translate-x-6", "rotate-2 -translate-y-3 z-10", "rotate-[8deg] -translate-x-6"];
  return (
    <div className="relative mx-auto flex h-[440px] w-full max-w-[560px] items-center justify-center sm:h-[500px]">
      {days.map((d, i) => (
        <div
          key={d.id}
          className={`relative -mx-10 w-[44%] shrink-0 overflow-hidden rounded-xl border bg-white shadow-[0_30px_60px_-25px_rgba(28,25,23,0.45)] transition duration-500 hover:z-20 hover:rotate-0 hover:scale-105 ${tilt[i % 3]}`}
          style={{ borderColor: OS.line2 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${d.creative_url}?ar=4x5`} alt={`${d.item} poster`} className="aspect-[4/5] w-full object-cover" />
        </div>
      ))}
      <div
        className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border px-4 py-2 font-mono text-[11px] tracking-[0.06em] shadow-sm"
        style={{ borderColor: OS.line2, background: OS.panel, color: OS.muted }}
      >
        REAL POSTERS FROM THE LIVE DEMO · 30 PER MONTH
      </div>
    </div>
  );
}

/** A labelled illustration of the Proof report — not a real customer's numbers. */
function ProofIllustration() {
  const bars = [62, 58, 71, 66, 80, 92, 74, 60, 69, 77, 73, 88, 95, 70];
  const exp = [60, 57, 62, 61, 70, 84, 66, 59, 61, 66, 64, 78, 85, 62];
  return (
    <div className="rounded-xl border p-6 shadow-[0_30px_70px_-40px_rgba(28,25,23,0.35)]" style={{ borderColor: OS.line2, background: OS.panel }}>
      <div className="text-[13px] font-semibold" style={{ color: OS.mint }}>
        Proven on your register
      </div>
      <div className="mt-1 font-display text-5xl" style={{ color: OS.mint }}>
        +$3.1K
      </div>
      <div className="mt-1 font-mono text-[11px]" style={{ color: OS.muted }}>
        80% RANGE +$1.2K TO +$5.0K · 14 CAMPAIGN DAYS
      </div>
      <div className="mt-6 flex h-32 items-end gap-1.5">
        {bars.map((b, i) => (
          <div key={i} className="relative flex h-full flex-1 items-end">
            <div className="absolute inset-x-0 bottom-0 rounded-t-sm border" style={{ height: `${exp[i]}%`, borderColor: "rgba(28,25,23,0.3)" }} />
            <div className="relative w-full rounded-t-sm" style={{ height: `${b}%`, background: OS.mint, opacity: 0.7 }} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 font-mono text-[10px]" style={{ color: OS.subtle }}>
        <span>■ ACTUAL</span>
        <span>□ EXPECTED WITHOUT THE CAMPAIGN</span>
        <span className="ml-auto">ILLUSTRATION</span>
      </div>
    </div>
  );
}

const AGENT_INDEX = [
  ["I.", "Brand", "Reads the website — logo, palette, typography, and a voice profile to steer tone."],
  ["II.", "Demand", "Reads marketplace demand: saves, redemptions, neighborhood mix."],
  ["III.", "Location", "Geocodes every venue to coordinates."],
  ["IV.", "Weather", "Live 16-day forecast, then 5-year climate normals — estimates marked, never asserted."],
  ["V.", "Events", "Holidays plus nearby ticketed events that move demand."],
  ["VI.", "Analyst", "Three forecasting models compete on your sales; the winner ships with calibrated ranges. Z-scores your dayparts."],
  ["VII.", "Strategy", "Composes 30 offers — item, window, discount — adapted to each day's weather and events."],
  ["VIII.", "Copywriter", "One on-brand caption per day, through the claims and length guardrail."],
  ["IX.", "Creative", "A branded poster for every day — colours, logo, real food imagery."],
  ["X.", "Revenue", "Projects redemptions × lift into an honest range with a stated confidence."],
].map(([n, name, role]) => ({ n, name, role }));
