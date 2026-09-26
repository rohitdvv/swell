import { it, expect } from "vitest";
import { valueOf } from "@/lib/value";

it("turns a slow-hour revenue lift into profit, a year of it, and its share of typical profit", () => {
  // The demo: +$2.8K/month on a $99.2K/month restaurant, Starter at $49.
  const v = valueOf(2800, 99_200, 49);
  expect(v.profitPerMonth).toBe(1680);
  expect(v.profitPerYear).toBe(20_160);
  expect(v.typicalAnnualProfit).toBe(59_520);
  expect(v.profitShare).toBeCloseTo(0.339, 2);
  expect(v.roiMultiple).toBeCloseTo(34.3, 1);
});

it("never shows negative value or divides by zero", () => {
  const v = valueOf(-500, 0, null);
  expect(v.profitPerYear).toBe(0);
  expect(v.profitShare).toBe(0);
  expect(v.roiMultiple).toBeNull();
});
