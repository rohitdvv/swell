import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";

/**
 * Signed out → "Sign in" + "Get started" (Clerk pages, Google button included).
 * Signed in  → "Console" link + Clerk's user avatar menu.
 * No Clerk keys (fresh keyless deploy) → the demo link only, so public pages
 * never render broken auth chrome.
 */
export function AuthNav() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <Link
        href="/demo"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ember-gradient px-3.5 text-sm font-medium text-white shadow-ember transition hover:brightness-105"
      >
        See the demo <ArrowRight className="size-3.5" />
      </Link>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <Link href="/sign-in" className="hidden text-sm text-fg-muted hover:text-fg sm:block">
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ember-gradient px-3.5 text-sm font-medium text-white shadow-ember transition hover:brightness-105"
        >
          Get started <ArrowRight className="size-3.5" />
        </Link>
      </Show>

      <Show when="signed-in">
        <Link href="/console" className="hidden text-sm text-fg-muted hover:text-fg sm:block">
          Console
        </Link>
        <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
      </Show>
    </>
  );
}
