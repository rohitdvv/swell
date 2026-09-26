import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { OS } from "@/components/os-theme";

type NavLink = { href: string; label: string };

/**
 * The single Swell OS top nav, shared by every page so the site never feels
 * like it jumped to a different website. The logo is always the way home.
 */
export function OsNav({ links = DEFAULT_LINKS }: { links?: NavLink[] }) {
  return (
    <header
      className="sticky top-0 z-50 flex h-16 items-center gap-8 border-b px-5 sm:px-10"
      style={{ borderColor: OS.line, background: "rgba(251,248,243,0.86)", backdropFilter: "blur(14px)" }}
    >
      <Link href="/" className="flex items-baseline gap-2.5">
        <span className="font-display text-2xl font-medium tracking-[-0.02em]">Swell</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: OS.amber }}>
          OS
        </span>
      </Link>
      <nav className="ml-auto flex items-center gap-5 text-[13px] sm:gap-7">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hidden hover:text-fg sm:block" style={{ color: OS.muted }}>
            {l.label}
          </Link>
        ))}
        <AuthNav />
      </nav>
    </header>
  );
}

const DEFAULT_LINKS: NavLink[] = [
  { href: "/demo", label: "Sample campaign" },
  { href: "/pricing", label: "Pricing" },
];
