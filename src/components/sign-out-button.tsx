"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Clerk's sign-out. Its own component so the hook only runs where it's
 * rendered — pages stay prerenderable on keyless builds (no ClerkProvider).
 */
export function SignOutButton() {
  const { signOut } = useClerk();
  return (
    <Button variant="ghost" onClick={() => signOut({ redirectUrl: "/" })} className="ml-auto">
      <LogOut className="size-4" /> Sign out
    </Button>
  );
}
