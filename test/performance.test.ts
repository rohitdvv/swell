import { it, expect } from "vitest";
import { performanceFee } from "@/lib/billing/performance";

const proven = { verdict: "proven" as const, low80: 4000, days_covered: 30 };

it("bills 15% of the cautious end of a proven lift", () => {
  expect(performanceFee(proven, 0.15, 1500)).toMatchObject({ amount: 600, basis: 4000, billable: true, final: true });
});

it("bills nothing unless the register proves it", () => {
  for (const verdict of ["promising", "no-lift", "too-early"] as const) {
    expect(performanceFee({ ...proven, verdict }, 0.15, 1500).amount).toBe(0);
  }
  expect(performanceFee({ ...proven, low80: -200 }, 0.15, 1500).billable).toBe(false);
});

it("respects the monthly cap, including what was already billed", () => {
  expect(performanceFee({ ...proven, low80: 50_000 }, 0.15, 1500).amount).toBe(1500);
  expect(performanceFee(proven, 0.15, 1500, 1200).amount).toBe(300);
  expect(performanceFee(proven, 0.15, 1500, 1500).billable).toBe(false);
});

it("keeps a mid-campaign measurement as an estimate, not an invoice", () => {
  expect(performanceFee({ ...proven, days_covered: 14 }, 0.15, 1500)).toMatchObject({ amount: 600, final: false });
});
