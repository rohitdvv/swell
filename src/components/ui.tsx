"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// ---------------- Button ----------------
type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-ember-gradient text-white shadow-ember hover:brightness-[1.05] active:brightness-95 border border-ember-600/20",
  secondary:
    "bg-surface text-fg border border-border-strong hover:bg-surface-2 shadow-soft",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-2",
  outline: "border border-border-strong text-fg hover:bg-surface-2",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-soft",
};
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-[15px] rounded-xl gap-2",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
  }
>(function Button(
  { className, variant = "primary", size = "md", loading, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ember-500/50 disabled:opacity-50 disabled:pointer-events-none select-none",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

// ---------------- Badge ----------------
export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "ember" | "mint" | "muted";
}) {
  const tones = {
    neutral: "bg-surface-2 text-fg-muted border-border",
    ember: "bg-ember-50 text-ember-700 border-ember-200 dark:bg-ember-950/40 dark:text-ember-300 dark:border-ember-800/50",
    mint: "bg-mint-500/10 text-mint-600 border-mint-500/20 dark:text-mint-400",
    muted: "bg-transparent text-fg-subtle border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// ---------------- Card ----------------
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface shadow-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------------- Field / Input ----------------
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">{label}</span>
      )}
      {children}
      {hint && <span className="mt-1.5 block text-xs text-fg-subtle">{hint}</span>}
    </label>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full h-11 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-fg placeholder:text-fg-subtle outline-none transition focus:border-ember-400 focus:ring-2 focus:ring-ember-500/20",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none transition focus:border-ember-400 focus:ring-2 focus:ring-ember-500/20 resize-none",
        className
      )}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full h-11 rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-fg outline-none transition focus:border-ember-400 focus:ring-2 focus:ring-ember-500/20 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat",
        className
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
});

// ---------------- Spinner ----------------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

// ---------------- Segmented toggle ----------------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl border border-border bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
            value === o.value
              ? "bg-surface text-fg shadow-soft"
              : "text-fg-subtle hover:text-fg-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
