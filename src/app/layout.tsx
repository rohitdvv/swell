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
    default: "Got60 — A brain that's been in the kitchen",
    template: "%s · Got60",
  },
  description:
    "Restaurants don't need more tools. They need a brain. Upload your sales, paste your website, get a 30-day branded discount campaign — generated, not requested.",
  openGraph: {
    title: "Got60 — A brain that's been in the kitchen",
    description:
      "Upload sales history, paste your website, get a 30-day branded campaign as a shareable URL.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

// Prevent theme flash: honor saved preference before paint.
const themeScript = `(function(){try{var t=localStorage.getItem('got60-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
