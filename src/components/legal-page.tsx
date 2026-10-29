import { osClass, OS } from "@/components/os-theme";
import { OsNav } from "@/components/os-nav";

export const LEGAL_UPDATED = "October 29, 2026";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={osClass("min-h-screen")} style={{ background: OS.bg }}>
      <OsNav />
      <main className="mx-auto max-w-[760px] px-5 pb-24 pt-12 sm:px-10">
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="mt-2 text-sm" style={{ color: OS.subtle }}>
          Last updated {LEGAL_UPDATED}
        </p>
        <div className="legal mt-8 space-y-5 text-[15px] leading-relaxed" style={{ color: OS.muted }}>
          {children}
        </div>
      </main>
    </div>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-4 text-[18px] font-semibold" style={{ color: OS.fg }}>{children}</h2>;
}
