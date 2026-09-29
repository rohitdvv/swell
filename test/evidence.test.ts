import { it, expect } from "vitest";
import { EVIDENCE } from "@/lib/evidence";
import { forecastEvidence, proofFalseAlarms, series, iso } from "./helpers/synthetic";
import { trainSalesModel } from "@/lib/model";
import { measureProof } from "@/lib/proof";

// Every number on the public /accuracy page, recomputed. Deterministic seeds,
// so these must match exactly — change the model and this tells you which
// public claim moved.

it("forecast coverage, long histories", () => {
  const e = forecastEvidence(45, 105, 60, 2026);
  const c = EVIDENCE.forecastLongHistory;
  expect([e.days, Math.round(e.cover80 * e.days), Math.round(e.cover95 * e.days), e.beatNaive]).toEqual([c.days, c.covered80, c.covered95, c.beatNaive]);
}, 120_000);

it("forecast coverage, short histories", () => {
  const e = forecastEvidence(21, 45, 60, 77);
  const c = EVIDENCE.forecastShortHistory;
  expect([e.days, Math.round(e.cover80 * e.days), Math.round(e.cover95 * e.days), e.beatNaive]).toEqual([c.days, c.covered80, c.covered95, c.beatNaive]);
}, 120_000);

it("Proof on campaigns that did nothing", () => {
  const p = proofFalseAlarms(180, 100);
  expect(p).toEqual(EVIDENCE.proofNoEffect);
}, 300_000);

it("Proof on campaigns that really worked", () => {
  const days = Array.from({ length: 30 }, (_, i) => ({ date: iso(90 + i), item: "x", daypart: "Dinner", projected_revenue: 0 })) as never;
  let detected = 0;
  for (let k = 0; k < EVIDENCE.proofRealLift.restaurants; k++) {
    const m = trainSalesModel({ daily: series(0, 90, 250, 0, 100 + k) } as never)!;
    const p = measureProof({ model: m, days, after: series(90, 30, 250, 0, 1000 + k, EVIDENCE.proofRealLift.liftPerDay), lines: [], campaignStart: iso(90) });
    if (p.verdict === "proven") detected++;
  }
  expect(detected).toBe(EVIDENCE.proofRealLift.detected);
}, 300_000);
