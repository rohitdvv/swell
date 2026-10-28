import { describe, it, expect } from "vitest";
import { fileToRows, summarize, itemLines } from "@/lib/csv";
import { findMoney, checkCampaign, AuditInputError } from "@/lib/audit";
import { buildSampleCsv } from "@/lib/sample";

const load = (days: number, scenario?: { liftFromDay: number; liftPct: number }) => {
  const { csv, meta } = buildSampleCsv(days, scenario);
  const rows = fileToRows(Buffer.from(csv), "x.csv");
  return { sales: summarize(rows, "Sample"), lines: itemLines(rows), meta };
};

describe("free audit — check any campaign", () => {
  it("proves a campaign that really lifted sales, and prices the return", () => {
    const { sales, lines, meta } = load(75, { liftFromDay: 50, liftPct: 0.12 });
    const r = checkCampaign({ sales, lines, start: meta.campaignStart!, monthlySpend: 499 });
    expect(r.proof.verdict).toBe("proven");
    expect(r.proof.low80).toBeGreaterThan(0);
    expect(r.spend!.cautiousReturn!).toBeGreaterThan(1);
  });

  it("does not invent a lift when nothing changed", () => {
    const { sales, lines, meta } = load(75);
    const start = new Date(new Date(meta.start).getTime() + 50 * 864e5).toISOString().slice(0, 10);
    const r = checkCampaign({ sales, lines, start, monthlySpend: 499 });
    expect(r.proof.verdict).not.toBe("proven");
  });

  it("refuses to judge without two weeks of history before the campaign", () => {
    const { sales, lines, meta } = load(45);
    const start = new Date(new Date(meta.start).getTime() + 5 * 864e5).toISOString().slice(0, 10);
    expect(() => checkCampaign({ sales, lines, start })).toThrow(AuditInputError);
  });
});

describe("free audit — find the money", () => {
  it("prices labor and slow-hour profit, and they add up", () => {
    const { sales } = load(45);
    const r = findMoney(sales);
    expect(r.staffing!.trimValue).toBeGreaterThan(0);
    expect(r.promo.profitPerMonth).toBeGreaterThan(0);
    expect(r.totalPerMonth).toBe(r.staffing!.trimValue + r.promo.profitPerMonth);
    expect(r.perYear).toBe(r.totalPerMonth * 12);
    expect(r.promo.low).toBeLessThanOrEqual(r.promo.expected);
  });
});
