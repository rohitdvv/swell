"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui";

export function CopyLink({ label = "Copy link" }: { label?: string }) {
  const [copied, setCopied] = React.useState(false);
  function copy() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      {copied ? <Check className="size-3.5 text-mint-600" /> : <Link2 className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
