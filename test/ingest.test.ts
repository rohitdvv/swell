import { describe, it, expect } from "vitest";
import { buildSampleCsv } from "@/lib/sample";
import { parseSalesFile, SalesParseError } from "@/lib/csv";
import { SalesSummarySchema, BrandKitSchema, AssistantBodySchema } from "@/lib/schemas";
import { trainSalesModel } from "@/lib/model";

// End-to-end ingest: a genuine transaction-level POS export → summary →
// request schema → model. The same path an owner's upload takes.
describe("POS export → validated summary → trained model", () => {
  const { csv } = buildSampleCsv(60);
  const summary = parseSalesFile(Buffer.from(csv), "export.csv", "Osteria Lume");

  it("parses a daily series covering the export", () => {
    expect(summary.daily?.length).toBeGreaterThanOrEqual(55);
    expect(summary.total_net_sales).toBeGreaterThan(0);
    expect(summary.top_items.length).toBeGreaterThan(0);
  });

  it("produces a summary the server's own schema accepts", () => {
    const r = SalesSummarySchema.safeParse(summary);
    if (!r.success) console.error(r.error.issues);
    expect(r.success).toBe(true);
  });

  it("trains a model that beats 'same as last week'", () => {
    const m = trainSalesModel(summary)!;
    expect(m).not.toBeNull();
    expect(m.cv.mae).toBeLessThanOrEqual(m.cv.naiveMae);
  });

  it("refuses files it can't understand, with a human error", () => {
    expect(() => parseSalesFile(Buffer.from("foo,bar\n1,2\n"), "x.csv", "X")).toThrow(SalesParseError);
  });
});

describe("request schemas — hostile clients", () => {
  const brand = {
    source_url: "https://osterialume.com",
    domain: "osterialume.com",
    name: "Osteria Lume",
    logo_url: "https://osterialume.com/logo.png",
    image_urls: ["https://osterialume.com/a.jpg"],
    primary_color: "#7a1f2b",
    secondary_color: "#f4e9d8",
    text_on_primary: "light",
    font_family: "Fraunces",
    tagline: null,
    voice_summary: "warm, neighborhood",
    voice_keywords: ["warm"],
    voice_vector_dims: 0,
    extraction_notes: [],
  };

  it("accepts a real brand kit", () => {
    expect(BrandKitSchema.safeParse(brand).success).toBe(true);
  });

  it.each([
    ["non-hex colour (SVG injection)", { primary_color: 'red"/><script>' }],
    ["javascript: logo", { logo_url: "javascript:alert(1)" }],
    ["data: image", { image_urls: ["data:image/svg+xml,<svg onload=alert(1)>"] }],
    ["oversized image list", { image_urls: Array(50).fill("https://a.com/x.jpg") }],
    ["unknown text_on_primary", { text_on_primary: "blink" }],
  ])("rejects %s", (_label, patch) => {
    expect(BrandKitSchema.safeParse({ ...brand, ...patch }).success).toBe(false);
  });

  it("bounds assistant questions", () => {
    expect(AssistantBodySchema.safeParse({ slug: "demo", question: "Why Tuesday?" }).success).toBe(true);
    expect(AssistantBodySchema.safeParse({ slug: "demo", question: "   " }).success).toBe(false);
    expect(AssistantBodySchema.safeParse({ slug: "demo", question: "x".repeat(501) }).success).toBe(false);
  });
});
