import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function Terms() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms cover your use of Swell — the website and the iOS app. By creating an account you agree to them.
      </p>

      <H>The service</H>
      <p>
        Swell analyses sales data you provide, suggests promotions and staffing, produces posters and captions, and
        measures results against a forecast. You decide what to run, post and charge; you&apos;re responsible for your
        offers complying with the law and with any platform you post on.
      </p>

      <H>Forecasts are estimates</H>
      <p>
        Projections, ranges and staffing plans are statistical estimates, not promises. We publish how we test them on
        our <Link className="underline" href="/accuracy">accuracy page</Link>. Real results depend on things no model
        controls.
      </p>

      <H>Plans and payment</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Free</strong> — no charge.
        </li>
        <li>
          <strong>Pay for proof</strong> — no monthly fee. When Proof marks a completed campaign &ldquo;proven&rdquo;, we
          charge the agreed share (15%, or 10% for founding accounts) of the low end of the measured 80% range, capped
          at $1,500 per calendar month, to the card you saved. Nothing is charged for results that aren&apos;t proven.
          Referral credits are applied automatically.
        </li>
        <li>
          <strong>Pro and Agency</strong> — a fixed monthly or annual fee, billed in advance until you cancel.
        </li>
      </ul>
      <p>Plans are bought and managed on the website; the iOS app doesn&apos;t sell anything.</p>

      <H>Your data</H>
      <p>
        Your sales data and content remain yours. You give us permission to process them to provide the service, as
        described in our <Link className="underline" href="/privacy">privacy policy</Link>. You can delete your account at
        any time.
      </p>

      <H>Acceptable use</H>
      <p>
        Don&apos;t upload data you don&apos;t have the right to use, attempt to access other accounts, overload or probe
        the service, or misuse referral credits. We may suspend accounts that do.
      </p>

      <H>Liability</H>
      <p>
        Swell is provided &ldquo;as is&rdquo;. To the extent the law allows, we aren&apos;t liable for indirect or
        consequential losses, and our total liability is limited to what you paid us in the 12 months before the claim.
      </p>

      <H>Changes</H>
      <p>
        We may update these terms; we&apos;ll post changes here and, for material changes, tell you in the product.
        Questions: <Link className="underline" href="/support">support</Link>.
      </p>
    </LegalPage>
  );
}
