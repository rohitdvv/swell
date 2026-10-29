import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H } from "@/components/legal-page";
import { SupportForm } from "@/components/support-form";

export const metadata: Metadata = { title: "Support" };

export default function Support() {
  return (
    <LegalPage title="Support">
      <p>Questions, problems, data requests or feedback — send us a note and we&apos;ll reply by email within one business day.</p>
      <SupportForm />
      <H>Quick answers</H>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Which files work?</strong> Sales exports from Toast, Square or Clover (CSV or Excel). 30–90 days works best.
        </li>
        <li>
          <strong>Delete my account?</strong> Account → Delete account, in the app or on the{" "}
          <Link className="underline" href="/account">website</Link>.
        </li>
        <li>
          <strong>How accurate is it?</strong> See the <Link className="underline" href="/accuracy">accuracy page</Link>.
        </li>
        <li>
          <strong>Privacy?</strong> Read the <Link className="underline" href="/privacy">privacy policy</Link>.
        </li>
      </ul>
    </LegalPage>
  );
}
