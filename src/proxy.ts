import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Only these need a signed-in user. Everything else stays public:
 * the landing page, /pricing, the shareable campaign artifact (/c/[slug])
 * and the poster/assistant endpoints it calls, and the Stripe webhook.
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

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
