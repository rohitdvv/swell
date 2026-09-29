import Link from "next/link";
import type { Metadata } from "next";
import { Check, AlertTriangle, FlaskConical, Receipt } from "lucide-react";
import { osClass, OS } from "@/components/os-theme";
import { OsNav } from "@/components/os-nav";
import { repo } from "@/lib/db";
import { EVIDENCE } from "@/lib/evidence";
import type { ProofReport } from "@/lib/proof";

export const metadata: Metadata = {
  title: "How accurate is Swell?",
  description:
    "Swell's forecasts and Proof reports, measured: live results from real campaigns and the reproducible tests behind every claim.",
};

// Live aggregates refresh every few minutes; nothing here is hand-edited.
export const revalidate = 300;

/** Aggregates are shown only across at least this many campaigns — no single restaurant is identifiable. */
const MIN_FOR_AGGREGATE = 3;

async function liveResults() {
  try {
    const proofs = await repo.listProofs();
    const finished = proofs.filter((p) => p.verdict !== "too-early");
    const count = (v: ProofReport["verdict"]) => finished.filter((p) => p.verdict === v).length;
    return {
      measured: proofs.length,
      finished: finished.length,
      proven: count("proven"),
      promising: count("promising"),
      noLift: count("no-lift"),
      days: finished.reduce((s, p) => s + p.days_covered, 0),
      provenCautious: finished.filter((p) => p.verdict === "proven").reduce((s, p) => s + Math.max(0, p.low80), 0),
    };
  } catch {
    return null;
  }
}

const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`;

export default async function AccuracyPage() {
  const live = await liveResults();
  const L = EVIDENCE.forecastLongHistory;
  const S = EVIDENCE.forecastShortHistory;
  const P = EVIDENCE.proofNoEffect;
  const R = EVIDENCE.proofRealLift;

  return (
    <div className={osClass("min-h-screen")} style={{ background: OS.bg }}>
      <OsNav links={[{ href: "/demo", label: "Sample campaign" }, { href: "/pricing", label: "Pricing" }]} />

      <main className="mx-auto max-w-[1080px] px-5 pb-24 pt-14 sm:px-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: OS.amber }}>
          Accuracy
        </div>
        <h1 className="mt-4 max-w-3xl font-display text-[clamp(36px,5vw,56px)] leading-[1.04] tracking-[-0.02em] text-balance">
          How far to trust Swell — measured, not claimed.
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-pretty" style={{ color: OS.muted }}>
          No forecast of a restaurant&apos;s sales is 100% accurate: weather, a local event or a viral post move
          real numbers. What Swell promises instead is that its ranges mean what they say, and that it never
          calls a campaign a success your register doesn&apos;t back up. Here is the evidence.
        </p>

        {/* ── Live ─────────────────────────────────────────── */}
        <section className="mt-14">
          <SectionTitle icon={<Receipt className="size-4" />} title="Live: real campaigns, measured on real registers" />
          {!live || live.finished < MIN_FOR_AGGREGATE ? (
            <div className="mt-4 rounded-lg border p-6 text-[15px] leading-relaxed" style={{ borderColor: OS.line2, background: OS.panel }}>
              <span className="font-semibold">
                {live && live.measured > 0
                  ? `${live.measured} campaign${live.measured === 1 ? "" : "s"} measured so far.`
                  : "No customer campaigns have been measured yet."}
              </span>{" "}
              <span style={{ color: OS.muted }}>
                Results appear here automatically, in aggregate, once at least {MIN_FOR_AGGREGATE} campaigns have run
                long enough to judge — including the ones that didn&apos;t work. We won&apos;t fill this space with
                testimonials in the meantime.
              </span>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <Stat big={String(live.finished)} label="campaigns measured" />
              <Stat big={pct(live.proven, live.finished)} label="proven on the register" tone={OS.mint} />
              <Stat big={pct(live.promising + live.noLift, live.finished)} label="not proven (promising or no lift)" />
              <Stat big={`$${Math.round(live.provenCautious).toLocaleString()}`} label="proven lift, cautious end, all campaigns" tone={OS.mint} />
            </div>
          )}
        </section>

        {/* ── Forecast calibration ──────────────────────────── */}
        <section className="mt-16">
          <SectionTitle icon={<FlaskConical className="size-4" />} title="Forecasts: do the ranges hold on days the model never saw?" />
          <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-pretty" style={{ color: OS.muted }}>
            We simulate restaurants with known weekly patterns, trends and noise, train Swell on their history,
            then check its 80% and 95% ranges against each restaurant&apos;s true next 30 days. An honest 80% range
            should contain the real number about 80% of the time — not 100% (that would mean it&apos;s uselessly
            wide) and not 60% (overconfident).
          </p>
          <div className="mt-5 overflow-x-auto rounded-lg border" style={{ borderColor: OS.line2, background: OS.panel }}>
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead>
                <tr className="border-b text-[12px]" style={{ borderColor: OS.line2, color: OS.subtle }}>
                  <th className="px-5 py-3 font-medium">History uploaded</th>
                  <th className="px-5 py-3 font-medium">Future days checked</th>
                  <th className="px-5 py-3 font-medium">80% range held</th>
                  <th className="px-5 py-3 font-medium">95% range held</th>
                  <th className="px-5 py-3 font-medium">Beat &ldquo;same as last week&rdquo;</th>
                </tr>
              </thead>
              <tbody>
                {[L, S].map((e) => (
                  <tr key={e.label} className="border-b last:border-0" style={{ borderColor: OS.line }}>
                    <td className="px-5 py-3.5 font-medium">{e.label}</td>
                    <td className="px-5 py-3.5 font-mono">{e.days.toLocaleString()} ({e.restaurants} restaurants)</td>
                    <td className="px-5 py-3.5 font-mono">{pct(e.covered80, e.days)}</td>
                    <td className="px-5 py-3.5 font-mono">{pct(e.covered95, e.days)}</td>
                    <td className="px-5 py-3.5 font-mono">
                      {e.beatNaive} of {e.restaurants}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px]" style={{ color: OS.subtle }}>
            With little history the ranges are deliberately wider (so they hold more often than 80%) and the model
            tells you it can&apos;t yet test itself. Upload 45+ days for sharper ranges.
          </p>
        </section>

        {/* ── Proof ─────────────────────────────────────────── */}
        <section className="mt-16">
          <SectionTitle icon={<Check className="size-4" />} title="Proof: does it only say “proven” when it’s true?" />
          <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-pretty" style={{ color: OS.muted }}>
            Proof can trigger a charge, so it has to be hard to fool. We run it on simulated campaigns that did
            nothing at all, and on campaigns that genuinely added about 10% a day.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat big={`${P.falseProven} of ${P.restaurants}`} label={`campaigns that did nothing were wrongly called “proven” (${pct(P.falseProven, P.restaurants)})`} />
            <Stat big={pct(P.rangeCoveredZero, P.restaurants)} label="of those, the 80% range correctly included zero lift" />
            <Stat big={`${R.detected} of ${R.restaurants}`} label={`campaigns that really added ~$${R.liftPerDay}/day were proven`} tone={OS.mint} />
          </div>
          <p className="mt-3 text-[13px]" style={{ color: OS.subtle }}>
            &ldquo;Proven&rdquo; requires about 95% confidence the lift is above zero. Pay-for-proof bills 15% of the
            cautious end of the range, never the headline number.
          </p>
        </section>

        {/* ── Limits ────────────────────────────────────────── */}
        <section className="mt-16">
          <SectionTitle icon={<AlertTriangle className="size-4" />} title="What Swell can’t know" />
          <ul className="mt-4 grid gap-3 text-[14.5px] sm:grid-cols-2">
            {LIMITS.map((l) => (
              <li key={l} className="rounded-lg border p-4 leading-relaxed" style={{ borderColor: OS.line2, background: OS.panel, color: OS.muted }}>
                {l}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-14 text-[13px]" style={{ color: OS.subtle }}>
          Reproduce every simulated figure on this page: the code and tests are public —{" "}
          <a className="underline" href="https://github.com/rohitdvv/swell/blob/main/test/evidence.test.ts">
            test/evidence.test.ts
          </a>{" "}
          recomputes them on every change, and fails if any number here drifts from what the code does. See the{" "}
          <Link className="underline" href="/demo">
            live demo
          </Link>{" "}
          for a campaign&apos;s own model card.
        </p>
      </main>
    </div>
  );
}

const LIMITS = [
  "Simulated restaurants are cleaner than real ones. Real results will be noisier — which is why live results sit at the top of this page.",
  "How many guests act on an offer, and how much of that spend is truly new, can't be read from a POS export. Projections swing both at their pessimistic and optimistic edges instead of guessing one number.",
  "Weather past the 16-day forecast uses 5-year averages for that date, marked 'est.' — and is never used in a caption.",
  "Proof compares against what the model expected without the campaign. A big one-off (a festival, a road closure) during the campaign can move the result; the report shows every day so you can see it.",
];

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[19px] font-semibold">
      <span style={{ color: OS.amber }}>{icon}</span>
      {title}
    </h2>
  );
}

function Stat({ big, label, tone }: { big: string; label: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: OS.line2, background: OS.panel }}>
      <div className="font-display text-3xl" style={{ color: tone ?? OS.fg }}>
        {big}
      </div>
      <div className="mt-1.5 text-[13px] leading-snug" style={{ color: OS.muted }}>
        {label}
      </div>
    </div>
  );
}
