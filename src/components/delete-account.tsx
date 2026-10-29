"use client";

import * as React from "react";
import { useClerk } from "@clerk/nextjs";
import { Trash2 } from "lucide-react";

/** Permanently delete the account (also required for the iOS app — App Store 5.1.1(v)). */
export function DeleteAccount() {
  const { signOut } = useClerk();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete the account.");
      await signOut({ redirectUrl: "/?deleted=1" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the account.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "rgba(180,35,24,0.35)" }}>
      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--os-rust)" }}>
        <Trash2 className="size-4" /> Delete account
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted text-pretty">
        Permanently deletes your login, campaigns, posters, stored sales summaries, credits and history, and cancels any
        subscription. Invoices already issued are kept, anonymised, for accounting. This can&apos;t be undone.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 rounded-md border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: "rgba(180,35,24,0.35)", color: "var(--os-rust)" }}>
          Delete my account…
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type DELETE"
            className="rounded border border-border bg-bg px-3 py-2 text-sm"
          />
          <button
            disabled={text !== "DELETE" || busy}
            onClick={remove}
            className="rounded-md px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--os-rust)" }}
          >
            {busy ? "Deleting…" : "Permanently delete"}
          </button>
          <button onClick={() => setOpen(false)} className="px-2 text-[13px] text-fg-muted">
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs" style={{ color: "var(--os-rust)" }}>{error}</p>}
    </div>
  );
}
