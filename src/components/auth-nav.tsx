import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";

// Swell OS amber CTA — shared so the nav button matches every page.
const CTA =
  "inline-flex h-9 items-center gap-1.5 rounded px-4 text-[13px] font-semibold transition hover:brightness-110";
const CTA_STYLE = { background: "var(--os-amber, #E8A33D)", color: "#FFFFFF" };

/**
 * Signed out → "Sign in" + "Get started" (Clerk pages, Google button included).
 * Signed in  → "Console" link + Clerk's user avatar menu.
 * No Clerk keys (fresh keyless deploy) → the demo link only, so public pages
 * never render broken auth chrome.
 */
export function AuthNav() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <Link href="/demo" className={CTA} style={CTA_STYLE}>
        See the demo <ArrowRight className="size-3.5" />
      </Link>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <Link href="/sign-in" className="hidden text-sm hover:text-fg sm:block text-fg-muted">
          Sign in
        </Link>
        <Link href="/sign-up" className={CTA} style={CTA_STYLE}>
          Get started <ArrowRight className="size-3.5" />
        </Link>
      </Show>

      <Show when="signed-in">
        <Link href="/console" className="hidden text-sm hover:text-fg sm:block text-fg-muted">
          Console
        </Link>
        <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
      </Show>
    </>
  );
}
