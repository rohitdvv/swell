import { SignUp } from "@clerk/nextjs";
import { Check } from "lucide-react";
import { osClass, OS } from "@/components/os-theme";
import { OsNav } from "@/components/os-nav";
import { clerkOsAppearance } from "@/components/clerk-os-appearance";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <div className={osClass("relative flex min-h-screen flex-col overflow-hidden")} style={{ background: OS.bg }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(70% 50% at 50% -10%, rgba(232,163,61,0.10) 0%, transparent 55%)" }}
      />
      <OsNav links={[{ href: "/demo", label: "Sample campaign" }, { href: "/pricing", label: "Pricing" }]} />
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-12">
        <h1 className="mb-1 font-display text-3xl">Create your account</h1>
        <p className="mb-6 text-sm" style={{ color: OS.muted }}>
          Sign up, pick a plan, and generate your first campaign in minutes.
        </p>
        <SignUp appearance={clerkOsAppearance} />
        <ul className="mt-6 space-y-1.5">
          {[
            "30-day campaign from your real sales",
            "Live weather + local-event targeting",
            "A branded poster for every day",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2 text-xs" style={{ color: OS.muted }}>
              <Check className="size-3.5" style={{ color: OS.mint }} /> {t}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
