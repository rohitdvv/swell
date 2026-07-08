"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type Toast = { id: number; msg: string; tone: "success" | "error" | "info" };

export function toast(msg: string, tone: Toast["tone"] = "success") {
  window.dispatchEvent(new CustomEvent("got60:toast", { detail: { msg, tone } }));
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    let counter = 0;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { msg: string; tone: Toast["tone"] };
      const id = ++counter;
      setToasts((t) => [...t, { id, ...detail }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
    };
    window.addEventListener("got60:toast", handler);
    return () => window.removeEventListener("got60:toast", handler);
  }, []);

  const icon = {
    success: <CheckCircle2 className="size-4 text-mint-500" />,
    error: <AlertCircle className="size-4 text-red-500" />,
    info: <Info className="size-4 text-ember-500" />,
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-fg shadow-lift"
          >
            {icon[t.tone]}
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
