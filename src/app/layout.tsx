import {ClerkProvider} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: {
    default: "Swell — Restaurant marketing that proves it paid",
    template: "%s · Swell",
  },
  description:
    "Swell reads your POS, fills your slow hours, plans your staffing — and proves on your own register what it earned. Free audit in a minute; pay only for proven results.",
  openGraph: {
    title: "Swell — Restaurant marketing that proves it paid",
    description:
      "Is your marketing working? Your register knows. Free 60-second audit — no sign-up.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

// Prevent theme flash: honor saved preference before paint.
const themeScript = `(function(){try{var t=localStorage.getItem('swell-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-fg">
        {/* Keyless deploys still serve every public page — ClerkProvider
            throws without a publishable key, so it only mounts when set. */}
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider>
            {children}
            <Toaster />
          </ClerkProvider>
        ) : (
          <>
            {children}
            <Toaster />
          </>
        )}
      </body>
    </html>
  );
}