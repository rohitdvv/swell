import "server-only";
import { NextResponse } from "next/server";
import { getAccountEmail } from "./billing/account";
import type { Campaign } from "./types";

// ============================================================
// Authorization — one place, every route.
//
//   VIEW  a campaign: it's published, or it's the public demo, or you own it.
//         Drafts are private: slugs are guessable (restaurant-month), so an
//         unpublished plan would otherwise leak a competitor's revenue.
//   EDIT  a campaign: you own it. System-owned campaigns (the demo) are
//         editable by nobody.
// ============================================================

export const DEMO_SLUG = "demo";

type Owned = Pick<Campaign, "owner_email" | "status" | "slug">;

export function canView(c: Owned, viewerEmail: string | null): boolean {
  if (c.status === "published" || c.slug === DEMO_SLUG) return true;
  return !!viewerEmail && !!c.owner_email && c.owner_email === viewerEmail;
}

export function canEdit(c: Owned, viewerEmail: string | null): boolean {
  return !!viewerEmail && !!c.owner_email && c.owner_email === viewerEmail;
}

/**
 * For mutating routes. Returns an error response to send, or null when the
 * caller owns the campaign. 404 (not 403) for campaigns you can't even see,
 * so private drafts don't confirm their own existence.
 */
export async function requireOwner(c: Owned | null): Promise<NextResponse | null> {
  const email = await getAccountEmail();
  if (!email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!c || !canView(c, email)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canEdit(c, email)) {
    return NextResponse.json({ error: "Only the campaign owner can change it." }, { status: 403 });
  }
  return null;
}

/**
 * Strip server-only identity before a campaign crosses to a client or a
 * public response. Owner emails never leave the server.
 */
export function toPublic<T extends { owner_email: string | null }>(c: T): T {
  return { ...c, owner_email: null };
}

/** For read routes that serve private drafts only to their owner. */
export async function requireViewer(c: Owned | null): Promise<NextResponse | null> {
  if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (c.status === "published" || c.slug === DEMO_SLUG) return null; // public, skip auth lookup
  const email = await getAccountEmail();
  if (!canView(c, email)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return null;
}
