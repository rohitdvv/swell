/** The Swell backend — the same API the website uses. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://swell-ten-theta.vercel.app").replace(/\/$/, "");
export const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
