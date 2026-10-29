export function money(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K` : `$${Math.round(a)}`;
  return n < 0 ? `−${s}` : s;
}
export const signed = (n: number) => `${n >= 0 ? "+" : ""}${money(n)}`;

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function caption(day: { copy: string; pct_off: number; item: string; discount_window: string }, restaurant: string): string {
  const tag = (s: string) => "#" + s.replace(/[^A-Za-z0-9]/g, "");
  return `${day.copy}\n\n${day.pct_off}% off ${day.item} · ${day.discount_window}\n📍 ${restaurant}\n\n${tag(restaurant)} ${tag(day.item)} #DealOfTheDay`;
}
