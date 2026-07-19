import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { osClass, OS } from "@/components/os-theme";
import { HeroPipeline, MonthExplorer, MoneyMath } from "@/components/landing/os-widgets";

/**
 * Swell OS — landing page.
 * Implements the Claude Design comp `Swell Landing.dc.html`, in the same
 * visual language as the campaign artifact.
 */
export default function Landing() {
  return (
    <div className={osClass("min-h-screen")} style={{ background: OS.bg }}>
      {/* ══ NAV ══ */}
      <header
        className="sticky top-0 z-50 flex h-16 items-center gap-8 border-b px-5 sm:px-10"
        style={{
          borderColor: OS.line,
          background: "rgba(10,12,11,0.82)",
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
          <Link href="#world" className="hidden hover:text-fg lg:block" style={{ color: OS.muted }}>
            Intelligence
          </Link>
          <Link href="#money" className="hidden hover:text-fg lg:block" style={{ color: OS.muted }}>
            The math
          </Link>
          <Link href="#enterprise" className="hidden hover:text-fg lg:block" style={{ color: OS.muted }}>
            Enterprise
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
              Revenue intelligence for restaurant groups
            </div>
            <h1 className="mt-6 font-display text-[clamp(44px,6vw,76px)] font-normal leading-[1.0] tracking-[-0.025em] text-balance">
              The month is <em className="italic" style={{ color: OS.amber }}>already planned</em> when
              you walk in.
            </h1>
            <p className="mt-7 max-w-[520px] text-[17px] leading-[1.6] text-pretty" style={{ color: OS.muted }}>
              Swell reads every register in your portfolio, the weather on each block, and the events
              down each street — then hands every location a finished 30-day campaign. Offers,
              posters, ad kit, projection. Unprompted.
            </p>
            <div className="mt-9 flex flex-wrap gap-3.5">
              <Link
                href="/sign-up"
                className="inline-flex h-[50px] items-center rounded px-6 text-[15px] font-bold transition hover:brightness-110"
                style={{ background: OS.amber, color: OS.bg }}
              >
                Run it on your data
              </Link>
              <Link
                href="/demo"
                className="inline-flex h-[50px] items-center rounded border px-6 text-[15px] transition hover:border-current"
                style={{ borderColor: "rgba(237,232,220,0.2)", color: OS.fg }}
              >
                See a live campaign
              </Link>
            </div>
            <div
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.06em]"
              style={{ color: OS.subtle }}
            >
              <span>~10s TO FIRST PLAN</span>
              <span>30 POSTERS / RUN</span>
              <span>ZERO PROMPTS</span>
            </div>
          </div>

          <HeroPipeline />
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
            style={{ background: "rgba(237,232,220,0.1)", borderColor: "rgba(237,232,220,0.1)" }}
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

      {/* ══ 04 · ENTERPRISE ══ */}
      <section id="enterprise" className="border-t" style={{ borderColor: OS.line }}>
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-10 lg:py-[110px]">
          <div className="max-w-[640px]">
            <div className="font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.amber }}>
              CHAPTER 04 — BUILT FOR THE GROUP
            </div>
            <h2 className="mt-4 font-display text-[clamp(32px,5vw,48px)] font-normal leading-[1.05] tracking-[-0.02em] text-balance">
              One brain. Every location. Zero extra headcount.
            </h2>
          </div>

          <div className="mt-13 grid gap-10 lg:grid-cols-[1.4fr_1fr]" style={{ marginTop: 52 }}>
            <div
              className="self-start overflow-hidden rounded-lg border"
              style={{ borderColor: OS.line2, background: OS.panel }}
            >
              <div
                className="flex items-center border-b px-5 py-3.5 font-mono text-[10.5px] tracking-[0.16em]"
                style={{ borderColor: OS.line, color: OS.subtle }}
              >
                PORTFOLIO — EXAMPLE GROUP
                <span className="ml-auto" style={{ color: OS.mint }}>
                  4 LIVE CAMPAIGNS
                </span>
              </div>
              {LOCATIONS.map((loc) => (
                <div
                  key={loc.name}
                  className="grid grid-cols-[1.2fr_1fr_0.7fr_0.8fr] items-center gap-3 border-b px-5 py-4"
                  style={{ borderColor: "rgba(237,232,220,0.06)" }}
                >
                  <div>
                    <div className="text-[14px] font-semibold" style={{ color: OS.fg }}>
                      {loc.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px]" style={{ color: OS.subtle }}>
                      {loc.city}
                    </div>
                  </div>
                  <div className="font-mono text-[11px]" style={{ color: OS.muted }}>
                    {loc.signal}
                  </div>
                  <div className="font-display text-[19px]" style={{ color: OS.mint }}>
                    {loc.proj}
                  </div>
                  <div className="text-right">
                    <span
                      className="rounded-[3px] px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em]"
                      style={{ background: "rgba(127,209,174,0.12)", color: OS.mint }}
                    >
                      {loc.status}
                    </span>
                  </div>
                </div>
              ))}
              <div className="px-5 py-3 font-mono text-[9.5px] tracking-[0.1em]" style={{ color: OS.subtle }}>
                ILLUSTRATIVE — SAMPLE PORTFOLIO, NOT A REAL CUSTOMER
              </div>
            </div>

            <div
              className="flex flex-col gap-px border"
              style={{ background: "rgba(237,232,220,0.1)", borderColor: "rgba(237,232,220,0.1)" }}
            >
              {TRUST.map((t) => (
                <div key={t.k} className="flex-1 px-5.5 py-4.5" style={{ background: OS.bg, padding: "18px 22px" }}>
                  <div className="font-mono text-[10px] tracking-[0.16em]" style={{ color: OS.amber }}>
                    {t.k}
                  </div>
                  <div className="mt-1.5 text-[13.5px] leading-[1.5]" style={{ color: OS.muted }}>
                    {t.v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ 05 · AGENT INDEX ══ */}
      <section className="border-t" style={{ borderColor: OS.line, background: OS.bgAlt }}>
        <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-10 lg:py-[100px]">
          <div className="flex flex-wrap items-baseline gap-6">
            <div className="font-mono text-[11px] tracking-[0.22em]" style={{ color: OS.amber }}>
              CHAPTER 05
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
            Your first portfolio-wide campaign takes about ten seconds. See it before you pay for it.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3.5">
            <Link
              href="/sign-up"
              className="inline-flex h-[52px] items-center rounded px-7 text-[15px] font-bold transition hover:brightness-110"
              style={{ background: OS.amber, color: OS.bg }}
            >
              Open the console
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-[52px] items-center rounded border px-7 text-[15px] transition"
              style={{ borderColor: "rgba(237,232,220,0.2)", color: OS.fg }}
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
          A BRAIN THAT&apos;S BEEN IN THE KITCHEN
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
  "PROJECTION +$3.2K · CONFIDENCE MODERATE",
  "7/7 VALIDATION CHECKS PASSED",
  "RIDGE REGRESSION · HOLDOUT MAE 8.2%",
  "SEASONAL NORMALS BEYOND DAY 16 — MARKED EST.",
];

const STEPS = [
  {
    n: "01",
    title: "Drop in your sales",
    body: "A Toast or Square export per location. Swell reads every order and z-scores your dayparts to find the hours quietly bleeding money.",
  },
  {
    n: "02",
    title: "Paste site + addresses",
    body: "It lifts each brand's logo, colours and voice, then pulls the live forecast and real events for every block you operate on.",
  },
  {
    n: "03",
    title: "Get 30 days, built",
    body: "An offer for every day at every location — item, window, discount — each with a finished poster, caption, and projection.",
  },
];

const ASSUMPTIONS = [
  { label: "Baseline revenue", tag: "measured", bg: "rgba(62,142,108,0.14)", fg: "#3E8E6C" },
  { label: "Response rate", tag: "assumed", bg: "rgba(180,118,42,0.14)", fg: "#B4762A" },
  { label: "Demand multiplier", tag: "modeled", bg: "rgba(106,90,205,0.12)", fg: "#6A5ACD" },
];

const LOCATIONS = [
  { name: "Osteria Lume", city: "GREENWICH VILLAGE, NYC", signal: "RAIN TUE · GAME SAT", proj: "+$3.2K", status: "LIVE" },
  { name: "Lume Trattoria", city: "WILLIAMSBURG, BK", signal: "HEATWAVE · PATIO PUSH", proj: "+$2.7K", status: "LIVE" },
  { name: "Bar Lume", city: "WEST LOOP, CHI", signal: "WINTRUST GAME ×3", proj: "+$4.1K", status: "LIVE" },
  { name: "Lume Cucina", city: "SOUTH END, BOS", signal: "HOLIDAY MON", proj: "+$1.9K", status: "LIVE" },
];

/**
 * Honest capability copy. The comp's placeholder text claimed SOC 2 Type II,
 * SSO/SAML, a 99.9% SLA and a public API — none of which Swell has today.
 * These describe what the product actually does, so the page can go in front
 * of restaurant groups and investors without misrepresenting it.
 */
const TRUST = [
  {
    k: "MULTI-LOCATION",
    v: "Each venue gets its own brand kit, local forecast and events — one run covers the portfolio.",
  },
  {
    k: "HONEST NUMBERS",
    v: "Every projection ships as a range with a stated confidence, and each input is tagged measured, assumed or modeled.",
  },
  {
    k: "AUDITABLE RUNS",
    v: "Every generation is logged with what it read and projected, so a regenerate can't quietly rewrite last week's plan.",
  },
  {
    k: "YOUR DATA STAYS YOURS",
    v: "POS exports are used to build your campaigns. They are never used to train shared models.",
  },
  {
    k: "GOOGLE SIGN-IN",
    v: "Sign in with Google or email. Team roles, SSO and white-label are on the roadmap, not shipped yet.",
  },
];

const AGENT_INDEX = [
  ["I.", "Brand", "Reads the website — logo, palette, typography, and a voice profile to steer tone."],
  ["II.", "Demand", "Reads marketplace demand: saves, redemptions, neighborhood mix."],
  ["III.", "Location", "Geocodes every venue to coordinates."],
  ["IV.", "Weather", "Live 16-day forecast, then 5-year climate normals — estimates marked, never asserted."],
  ["V.", "Events", "Holidays plus nearby ticketed events that move demand."],
  ["VI.", "Analyst", "Ridge regression on your daily sales, backtested holdout MAE, z-scored dayparts."],
  ["VII.", "Strategy", "Composes 30 offers — item, window, discount — adapted to each day's weather and events."],
  ["VIII.", "Copywriter", "One on-brand caption per day, through the claims and length guardrail."],
  ["IX.", "Creative", "A branded poster for every day — colours, logo, real food imagery."],
  ["X.", "Revenue", "Projects redemptions × lift into an honest range with a stated confidence."],
].map(([n, name, role]) => ({ n, name, role }));
