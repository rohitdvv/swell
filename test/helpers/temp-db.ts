import { afterAll, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * A throwaway embedded Postgres (PGlite) for one test file — never the
 * developer's data, never the production DATABASE_URL, never Stripe.
 * Call at the top of the file, before any query. Startup (~5s, longer when
 * several files start at once) happens in beforeAll with a generous timeout,
 * so individual tests stay fast; the directory is removed afterwards.
 */
export function setupTempDb(name: string): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `swell-test-${name}-`));
  process.env.SWELL_DATA_DIR = dir;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.STRIPE_SECRET_KEY;
  beforeAll(async () => {
    const { repo } = await import("@/lib/db");
    await repo.ping();
  }, 120_000);
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
}
