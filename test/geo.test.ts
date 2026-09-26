import { it, expect, vi, afterEach } from "vitest";
import { geocode } from "@/lib/context/geo";

const HITS: Record<string, unknown[]> = {
  "Hyde Park": [{ name: "Hyde Park", admin1: "Vermont", country_code: "US", latitude: 44.59, longitude: -72.62 }],
  Austin: [
    { name: "Austin", admin1: "Texas", country_code: "US", latitude: 30.27, longitude: -97.74, population: 960000 },
    { name: "Austin", admin1: "Minnesota", country_code: "US", latitude: 43.67, longitude: -92.97, population: 25000 },
  ],
};

afterEach(() => vi.unstubAllGlobals());

it("uses the rest of the address to pick the right place (not Hyde Park, Vermont)", async () => {
  vi.stubGlobal("fetch", async (url: string) => {
    const name = new URL(url).searchParams.get("name")!;
    return new Response(JSON.stringify({ results: HITS[name] ?? [] }));
  });
  const g = await geocode("Hyde Park, Austin, TX");
  expect(g).toMatchObject({ name: "Austin", admin1: "Texas" });
});
