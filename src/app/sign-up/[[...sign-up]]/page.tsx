import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-texture opacity-50" />
        <div
          className="absolute -top-32 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #f75410, transparent 70%)" }}
        />
      </div>

      <header className="border-b border-border/70 glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Logo />
          <div className="ml-auto flex items-center gap-3">
            <Link href="/pricing" className="text-sm text-fg-muted hover:text-fg">
              Pricing
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <h1 className="mb-1 font-display text-3xl">Create your account</h1>
        <p className="mb-6 text-sm text-fg-muted">
          Sign up, pick a plan, and generate your first campaign in minutes.
        </p>
        <SignUp />
        <ul className="mt-6 space-y-1.5">
          {[
            "30-day campaign from your real sales",
            "Live weather + local-event targeting",
            "A branded poster for every day",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2 text-xs text-fg-muted">
              <Check className="size-3.5 text-mint-600" /> {t}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
