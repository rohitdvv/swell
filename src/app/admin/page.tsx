import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { osClass, OS } from "@/components/os-theme";
import { OsNav } from "@/components/os-nav";
import { getAccountEmail } from "@/lib/billing/account";
import { repo } from "@/lib/db";
import { foundingStatus } from "@/lib/billing/founding";

export const metadata: Metadata = { title: "Founder dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Emails allowed in, from ADMIN_EMAILS (comma-separated). Anyone else gets a 404. */
function isAdmin(email: string | null): boolean {
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allow.includes(email.toLowerCase());
}

export default async function AdminPage() {
  if (!isAdmin(await getAccountEmail())) notFound();
  const [s, leads, founding] = await Promise.all([repo.adminStats(), repo.listLeads(100), foundingStatus()]);
  const funnel: Array<[string, number, string?]> = [
    ["Sign-ups", s.users, `+${s.usersWeek} this week`],
    ["Campaigns built", s.campaigns, `+${s.campaignsWeek} this week`],
    ["Published", s.published],
    ["Proof uploads", s.proofs],
    ["Proven / estimating charges", s.proven],
  ];

  return (
    <div className={osClass("min-h-screen")} style={{ background: OS.bg }}>
      <OsNav links={[{ href: "/audit", label: "Free audit" }, { href: "/pricing", label: "Pricing" }]} />
      <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-10 sm:px-10">
        <h1 className="font-display text-4xl">Founder dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: OS.muted }}>
          Who to call today, and whether the funnel is moving.
        </p>

        <section className="mt-8 grid gap-3 sm:grid-cols-4">
          <Kpi label="Invoiced pay-for-proof" value={`$${s.billed.toLocaleString()}`} />
          <Kpi label="Pay-for-proof accounts" value={String(s.performance)} sub={`${founding.left} founding spots left`} />
          <Kpi label="Flat-fee subscriptions" value={String(s.paying)} />
          <Kpi label="Leads" value={String(s.leads)} />
        </section>

        <section className="mt-8 rounded-lg border p-5" style={{ borderColor: OS.line2, background: OS.panel }}>
          <h2 className="text-sm font-semibold">Funnel</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            {funnel.map(([k, v, sub]) => (
              <div key={k}>
                <div className="font-display text-3xl">{v}</div>
                <div className="text-xs" style={{ color: OS.muted }}>
                  {k}
                </div>
                {sub && <div className="text-[11px]" style={{ color: OS.mint }}>{sub}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold">Leads — call these first</h2>
          <Table
            head={["When", "Email", "Phone", "Restaurant", "Found / mo", "From"]}
            rows={leads.map((l) => [
              l.created_at.slice(0, 16).replace("T", " "),
              <a key="e" className="underline" href={`mailto:${l.email}`}>{l.email}</a>,
              l.phone ? <a key="p" className="underline" href={`tel:${l.phone}`}>{l.phone}</a> : "—",
              l.restaurant ?? "—",
              l.found_per_month ? `$${l.found_per_month.toLocaleString()}` : "—",
              l.source,
            ])}
            empty="No leads yet. Share /audit with ten restaurant owners."
          />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold">Newest sign-ups</h2>
            <Table
              head={["When", "Name", "Email"]}
              rows={s.recentUsers.map((u) => [u.created_at.slice(0, 10), u.name, u.email])}
              empty="No sign-ups yet."
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Newest campaigns</h2>
            <Table
              head={["When", "Restaurant", "Status", "Proof"]}
              rows={s.recentCampaigns.map((c) => [
                c.created_at.slice(0, 10),
                <Link key="l" className="underline" href={`/c/${c.slug}`}>{c.restaurant}</Link>,
                c.status,
                c.hasProof ? "✓" : "—",
              ])}
              empty="No campaigns yet."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: OS.line2, background: OS.panel }}>
      <div className="font-display text-3xl">{value}</div>
      <div className="text-xs" style={{ color: OS.muted }}>
        {label}
      </div>
      {sub && <div className="mt-1 text-[11px]" style={{ color: OS.mint }}>{sub}</div>}
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border" style={{ borderColor: OS.line2, background: OS.panel }}>
      {rows.length === 0 ? (
        <p className="p-5 text-sm" style={{ color: OS.subtle }}>
          {empty}
        </p>
      ) : (
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-b text-[11px]" style={{ borderColor: OS.line2, color: OS.subtle }}>
              {head.map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0" style={{ borderColor: OS.line }}>
                {r.map((c, j) => (
                  <td key={j} className="px-4 py-2.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
