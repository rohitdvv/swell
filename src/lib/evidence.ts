// ============================================================
// The simulation evidence behind every accuracy claim on /accuracy.
// These are not hand-typed marketing numbers: test/evidence.test.ts
// recomputes each one from the same seeded synthetic restaurants on every CI
// run and fails if any figure here drifts from what the code actually does.
// ============================================================

export const EVIDENCE = {
  forecastLongHistory: {
    label: "45–104 days of history",
    restaurants: 60,
    days: 1800,
    covered80: 1468,
    covered95: 1709,
    beatNaive: 59,
  },
  forecastShortHistory: {
    label: "21–44 days of history",
    restaurants: 60,
    days: 1800,
    covered80: 1562,
    covered95: 1722,
    beatNaive: 55,
  },
  proofNoEffect: {
    restaurants: 180,
    falseProven: 13,
    rangeCoveredZero: 143,
  },
  proofRealLift: {
    restaurants: 180,
    liftPerDay: 300,
    detected: 180,
  },
} as const;
