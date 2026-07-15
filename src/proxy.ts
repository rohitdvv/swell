import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Only these need a signed-in user. Everything else stays public:
 * the landing page, /pricing, /demo, the shareable campaign artifact
 * (/c/[slug]) and the poster/assistant endpoints it calls, and the
 * Stripe webhook.
 */
const isProtectedRoute = createRouteMatcher([
  "/console(.*)",
  "/account(.*)",
  "/api/generate(.*)",
  "/api/runs(.*)",
  "/api/parse-csv(.*)",
  "/api/brand-kit(.*)",
  "/api/billing/checkout(.*)",
  "/api/billing/portal(.*)",
]);

const hasClerk =
  !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Without Clerk keys, clerkMiddleware throws on EVERY request — which used to
 * 500 the whole site, including the public demo. A keyless deploy now serves
 * every public page and simply refuses the owner-only routes.
 */
export default hasClerk
  ? clerkMiddleware(async (auth, request) => {
      if (isProtectedRoute(request)) {
        await auth.protect();
      }
    })
  : function keylessProxy(request: NextRequest) {
      if (isProtectedRoute(request)) {
        return NextResponse.json(
          { error: "Sign-in is not configured on this deployment (missing Clerk keys)." },
          { status: 503 }
        );
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
