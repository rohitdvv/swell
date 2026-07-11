"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarPlus, Copy, Check, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/toaster";

export function BriefActions({
  plainText,
  calendarHref,
  campaignHref,
}: {
  plainText: string;
  calendarHref: string;
  campaignHref: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      toast("Brief copied — paste into email or Slack.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Could not copy.", "error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={campaignHref} className="hidden sm:block">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-3.5" /> Plan
        </Button>
      </Link>
      <Button variant="secondary" size="sm" onClick={copyBrief}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy email"}
      </Button>
      <a href={calendarHref}>
        <Button variant="secondary" size="sm">
          <CalendarPlus className="size-3.5" /> Calendar
        </Button>
      </a>
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        <Printer className="size-3.5" /> Print
      </Button>
    </div>
  );
}
