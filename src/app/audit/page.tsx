import type { Metadata } from "next";
import { osClass, OS } from "@/components/os-theme";
import { OsNav } from "@/components/os-nav";
import { AuditTool } from "@/components/audit-tool";

export const metadata: Metadata = {
  title: "Free restaurant audit — find the money, check your marketing",
  description:
    "Upload a Toast, Square or Clover export. In about a minute: the labor and slow-hour profit you're leaving on the table, and whether your marketing actually worked. No sign-up, nothing stored.",
};

export default function AuditPage() {
  return (
    <div className={osClass("min-h-screen")} style={{ background: OS.bg }}>
      <OsNav
        links={[
          { href: "/demo", label: "Sample campaign" },
          { href: "/accuracy", label: "Accuracy" },
          { href: "/pricing", label: "Pricing" },
        ]}
      />
      <main className="mx-auto max-w-[1040px] px-5 pb-24 pt-12 sm:px-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: OS.amber }}>
          Free audit · no sign-up · nothing stored
        </div>
        <h1 className="mt-4 max-w-3xl font-display text-[clamp(36px,5.5vw,60px)] leading-[1.02] tracking-[-0.02em] text-balance">
          Your register already knows. Ask it.
        </h1>
        <p className="mt-5 max-w-2xl text-[16.5px] leading-relaxed text-pretty" style={{ color: OS.muted }}>
          Drop in a sales export from Toast, Square or Clover. In about a minute you&apos;ll see the profit you&apos;re
          leaving on the table — or whether the marketing you already pay for is actually working. Your file is
          analysed in memory and never saved.
        </p>
        <AuditTool />
      </main>
    </div>
  );
}
