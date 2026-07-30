import { SignIn } from "@clerk/nextjs";
import { osClass, OS } from "@/components/os-theme";
import { OsNav } from "@/components/os-nav";
import { clerkOsAppearance } from "@/components/clerk-os-appearance";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className={osClass("relative flex min-h-screen flex-col overflow-hidden")} style={{ background: OS.bg }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(70% 50% at 50% -10%, rgba(232,163,61,0.10) 0%, transparent 55%)" }}
      />
      <OsNav links={[{ href: "/demo", label: "Sample campaign" }, { href: "/pricing", label: "Pricing" }]} />
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-12">
        <h1 className="mb-6 font-display text-3xl">Welcome back</h1>
        <SignIn appearance={clerkOsAppearance} />
      </main>
    </div>
  );
}
