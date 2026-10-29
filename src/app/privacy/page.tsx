import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Swell helps restaurants plan promotions and staffing from their own sales data, and measure what worked. This
        policy explains what we collect, why, who processes it for us, and how to delete it. It covers the website and
        the Swell iOS app.
      </p>

      <H>What we collect</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Account details</strong> — your email address and name, through our sign-in provider. We never see
          your password.
        </li>
        <li>
          <strong>Sales exports you upload</strong> (Toast, Square, Clover or similar).{" "}
          <em>Free audit:</em> the file is analysed in memory and not stored. <em>Campaigns:</em> we keep a summary — daily
          totals, sales by day of week and daypart, top items, payment mix — not the individual transactions.{" "}
          <em>Proof:</em> we keep the resulting report (daily totals and promo-dish counts), not the file.
        </li>
        <li>
          <strong>Restaurant details you give us</strong> — name, website (we read its public pages for logo, colours and
          photos) and location (used to look up weather and local events; we never use your device&apos;s GPS).
        </li>
        <li>
          <strong>Billing</strong> — handled by Stripe. We store your plan and Stripe customer reference, never your card
          number.
        </li>
        <li>
          <strong>Contact requests</strong> — if you ask us to get in touch, the email/phone you give.
        </li>
        <li>
          <strong>Cookies</strong> — a sign-in session cookie, and if you arrive through a referral link, a cookie that
          remembers who invited you for 90 days. No advertising or cross-site tracking cookies.
        </li>
      </ul>

      <H>How we use it</H>
      <p>
        To run the service you asked for: build campaigns, posters and staffing plans, measure results, bill for proven
        results on pay-for-proof, credit referrals, and answer you. We do not sell your data, use it for advertising, or
        use one restaurant&apos;s data to train models used for another.
      </p>

      <H>Who processes data for us</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>Vercel (hosting) and Neon (database), in the United States.</li>
        <li>Clerk (sign-in) and Stripe (payments).</li>
        <li>
          AI text providers (Groq, xAI or Anthropic) receive campaign facts — offers, dish names, aggregated numbers — to
          write captions and answer questions. Not your sales file.
        </li>
        <li>
          Open-Meteo, Nager.Date and Ticketmaster receive a city-level location and dates; TheMealDB and TheCocktailDB
          receive dish names to fetch photos.
        </li>
      </ul>

      <H>Notifications</H>
      <p>
        The iOS app can remind you to post each day&apos;s special. These are scheduled on your phone; we don&apos;t
        collect a push token or send notifications from our servers.
      </p>

      <H>Keeping and deleting your data</H>
      <p>
        We keep your data while your account is open. You can delete your account at any time in the app (Account →
        Delete account) or on the website (<Link className="underline" href="/account">Account</Link>). Deletion
        removes your login, campaigns, posters, stored sales summaries, credits and history, and cancels any
        subscription. Invoices already issued are kept for accounting with your identity removed. To get a copy of your
        data, contact us through <Link className="underline" href="/support">support</Link>.
      </p>

      <H>Children</H>
      <p>Swell is a business tool for restaurant owners and is not directed at children under 16.</p>

      <H>Changes and contact</H>
      <p>
        We&apos;ll post changes here and update the date above. Questions:{" "}
        <Link className="underline" href="/support">
          contact support
        </Link>
        .
      </p>
    </LegalPage>
  );
}
