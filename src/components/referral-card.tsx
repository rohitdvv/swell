"use client";

import * as React from "react";
import { Gift, Copy, Share2, Check } from "lucide-react";
import { toast } from "@/components/toaster";

type Referral = {
  link: string;
  reward: number;
  signedUp: number;
  proven: number;
  earned: number;
  balance: number;
};

/** "Give $100, get $100 — when their register proves it." */
export function ReferralCard({ compact = false }: { compact?: boolean }) {
  const [r, setR] = React.useState<Referral | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/referrals")
      .then((res) => (res.ok ? res.json() : null))
      .then(setR)
      .catch(() => {});
  }, []);
  if (!r) return null;

  const message = `I use Swell to check whether my marketing actually works — on my own register. Free audit, no sign-up: ${r.link}`;

  async function copy() {
    await navigator.clipboard.writeText(r!.link);
    setCopied(true);
    toast("Link copied.", "success");
    setTimeout(() => setCopied(false), 2000);
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Swell", text: message, url: r!.link });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(message);
    toast("Message copied — paste it to a fellow owner.", "success");
  }

  return (
    <div className="rounded-xl border-2 p-5" style={{ borderColor: "var(--os-mint)", background: "var(--surface)" }}>
      <div className="flex items-center gap-2 text-[15px] font-semibold">
        <Gift className="size-4" style={{ color: "var(--os-mint)" }} />
        Give ${r.reward}, get ${r.reward}
      </div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted text-pretty">
        Know another restaurant owner? When their register proves a Swell campaign worked, you both get ${r.reward} off
        your pay-for-proof fees. Nothing for sign-ups alone — only real results count.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-3 py-2 font-mono text-[12.5px]">{r.link}</code>
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-[13px] font-semibold">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
        </button>
        <button
          onClick={share}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold text-white"
          style={{ background: "var(--os-mint)" }}
        >
          <Share2 className="size-3.5" /> Share
        </button>
      </div>
      {!compact && (
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat value={String(r.signedUp)} label="signed up" />
          <Stat value={String(r.proven)} label="proven results" />
          <Stat value={`$${r.balance.toLocaleString()}`} label="credit available" />
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-surface-2 py-2.5">
      <div className="font-display text-2xl">{value}</div>
      <div className="text-[11px] text-fg-subtle">{label}</div>
    </div>
  );
}
