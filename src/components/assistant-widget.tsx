"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; text: string };

const STARTERS = [
  "What's the 30-day revenue forecast?",
  "What's the offer on the 15th, and why?",
  "Which event is driving a day this month?",
  "When are my busiest hours?",
];

export function AssistantWidget({
  slug,
  brandColor,
  restaurantName,
}: {
  slug: string;
  brandColor: string;
  restaurantName: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, question }),
      });
      const data = await res.json();
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: data.answer || data.error || "Hmm, try rephrasing that." },
      ]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Connection hiccup — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Ask Swell"
        className="fixed bottom-5 right-5 z-40 flex h-13 items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lift transition hover:brightness-105"
        style={{ background: brandColor }}
      >
        {open ? <X className="size-4" /> : <MessageCircle className="size-4" />}
        {!open && <span className="hidden sm:block">Ask Swell</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 30,
              opacity: { type: "tween", duration: 0.18 },
            }}
            className="fixed bottom-20 right-5 z-40 flex max-h-[70vh] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lift"
          >
            {/* header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3" style={{ background: `${brandColor}14` }}>
              <span
                className="flex size-7 items-center justify-center rounded-full text-white"
                style={{ background: brandColor }}
              >
                <Sparkles className="size-3.5" />
              </span>
              <div>
                <div className="text-sm font-semibold leading-tight">Swell assistant</div>
                <div className="text-[11px] text-fg-subtle">Answers from this campaign&apos;s data</div>
              </div>
            </div>

            {/* messages */}
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-fg-muted">
                    Hi! I know everything about the {restaurantName} campaign. Ask me anything:
                  </p>
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="block w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-left text-[13px] text-fg-muted transition hover:border-border-strong hover:text-fg"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                    m.role === "user"
                      ? "ml-auto rounded-br-md text-white"
                      : "mr-auto rounded-bl-md bg-surface-2 text-fg"
                  )}
                  style={m.role === "user" ? { background: brandColor } : undefined}
                >
                  {m.text}
                </div>
              ))}
              {busy && (
                <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg-subtle">
                  <Spinner className="size-3.5" /> thinking…
                </div>
              )}
            </div>

            {/* input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex items-center gap-2 border-t border-border p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about this campaign…"
                className="h-10 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-sm outline-none placeholder:text-fg-subtle focus:border-ember-400"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="flex size-10 items-center justify-center rounded-xl text-white transition disabled:opacity-40"
                style={{ background: brandColor }}
              >
                <Send className="size-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
