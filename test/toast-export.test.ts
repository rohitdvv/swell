import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { fileToRows, summarize, detectVenue, itemLines } from "@/lib/csv";
import { readUpload, UploadTooLargeError } from "@/lib/upload";

// Toast's flat line-item export. Every column that could be mistaken for
// sales (discount_amount, comp_amount, order_total…) is present on purpose.
const HEADER =
  "order_guid,item_selection_guid,service_date,opened_at,closed_at,order_source,employee_name,table_name,guest_count,item_name,category,quantity,unit_price,modifier_names,modifier_total,line_total,order_subtotal,discount_amount,order_tax,order_tip,comp_amount,order_total,location_name,has_modifiers,order_is_voided";

function toastCsv(days = 20): string {
  const lines = [HEADER];
  for (let d = 0; d < days; d++) {
    const date = new Date(Date.UTC(2026, 5, 11 + d)).toISOString().slice(0, 10);
    for (let o = 0; o < 4; o++) {
      const id = `ord-${d}-${o}`;
      const hour = [11, 15, 18, 22][o];
      // Two lines per order: $20 burger + $5 fries = $25 order, $3 discount, $2 tax, $4 tip.
      for (const [item, price] of [["Bacon Avocado Burger", "20.00"], ["Sweet Potato Fries", "5.00"]]) {
        lines.push(
          [id, `${id}-${item}`, date, `${date} ${hour}:05:00`, `${date} ${hour + 1}:00:00`, "Dine In", "Sam", "T1", 2,
           item, "Food", 1, price, "", "0.0", price, "25.00", "3.00", "2.00", "4.00", "0.0", "28.00",
           '"Main Street Grill - Austin, TX"', "False", o === 3 && d === 0 ? "True" : "False"].join(",")
        );
      }
    }
  }
  return lines.join("\n");
}

describe("Toast flat export", () => {
  const rows = fileToRows(Buffer.from(toastCsv()), "toast_sales_history_flat.csv");
  const s = summarize(rows, "x");

  it("sums line_total — never discount, comp, tax, tip or order-level totals", () => {
    // 20 days × 4 orders × $25, minus the one voided order.
    expect(s.total_net_sales).toBe(20 * 4 * 25 - 25);
    expect(s.order_count).toBe(20 * 4 - 1);
    expect(s.top_items[0]).toMatchObject({ name: "Bacon Avocado Burger", net_sales: 79 * 20 });
  });

  it("is recognised as Toast and reads the venue from the file", () => {
    expect(s.source).toBe("toast");
    expect(detectVenue(rows)).toEqual({ name: "Main Street Grill", location: "Austin, TX" });
  });

  it("reads dayparts from opened_at, not closed_at", () => {
    expect(s.by_daypart.Lunch.orders).toBe(20);
    expect(s.by_daypart["Late-Night"].orders).toBe(19);
  });

  it("gives Proof the same per-line amounts", () => {
    const lines = itemLines(rows);
    expect(lines.reduce((a, l) => a + l.net, 0)).toBe(20 * 4 * 25 - 25);
  });
});

describe("compressed uploads", () => {
  it("round-trips a gzipped CSV and restores its real name", async () => {
    const csv = toastCsv(3);
    const file = new File([zlib.gzipSync(csv)], "export.csv.gz");
    const { buf, name } = await readUpload(file);
    expect(name).toBe("export.csv");
    expect(buf.toString()).toBe(csv);
  });

  it("refuses a zip bomb instead of inflating it", async () => {
    const bomb = zlib.gzipSync(Buffer.alloc(100 * 1024 * 1024)); // 100 MB of zeros → ~100 KB
    expect(bomb.length).toBeLessThan(200 * 1024);
    await expect(readUpload(new File([bomb], "x.csv.gz"))).rejects.toBeInstanceOf(UploadTooLargeError);
  });
});

describe("brand kit from a real restaurant site", () => {
  it("finds the venue in an SEO title, whichever side of the pipe it's on", async () => {
    const { nameFromTitle } = await import("@/lib/brand");
    expect(nameFromTitle("Best American Restaurant in Austin | Hyde Park Bar & Grill", "hpbng.com")).toBe("Hyde Park Bar & Grill");
    expect(nameFromTitle("Moonshine Patio Bar & Grill Best Comfort Food in Austin Texas", "moonshinegrill.com")).toBe("Moonshine Patio Bar & Grill");
    expect(nameFromTitle("Osteria Lume — Handmade Pasta, West Village", "osterialume.com")).toBe("Osteria Lume");
    expect(nameFromTitle("null")).toBeNull();
    expect(nameFromTitle("Best Pizza in Town")).toBeNull();
  });

  it("never takes white, black or grey as the brand colour", async () => {
    const { brandable } = await import("@/lib/brand");
    for (const c of ["#ffffff", "#000000", "#777777", "#f5f5f5", "#101010"]) expect(brandable(c)).toBeNull();
    for (const c of ["#3f8b8b", "#c84b14", "#b9be2d"]) expect(brandable(c)).toBe(c);
  });
});
