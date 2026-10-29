"use client";

import * as React from "react";
import { Check } from "lucide-react";

export function SupportForm() {
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, note, source: "support" }),
    });
    if (res.ok) setSent(true);
    else setErr((await res.json().catch(() => ({}))).error ?? "Couldn't send — try again.");
  }

  if (sent)
    return (
      <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--os-mint)" }}>
        <Check className="size-4" /> Thanks — we&apos;ll reply by email.
      </p>
    );
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <input required type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-border bg-bg px-3 py-2 text-sm" />
      <textarea required minLength={5} maxLength={1000} rows={5} placeholder="How can we help?" value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border border-border bg-bg px-3 py-2 text-sm" />
      <button className="rounded-md px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--os-amber)" }}>
        Send
      </button>
      {err && <p className="text-xs" style={{ color: "var(--os-rust)" }}>{err}</p>}
    </form>
  );
}
