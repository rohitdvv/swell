"use client";

import * as React from "react";
import Image from "next/image";
import { TrendingUp, CloudRain, Ticket } from "lucide-react";

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Reveal children on scroll. Wraps content in a div that fades + slides up the
 * first time it enters the viewport. No-op under prefers-reduced-motion (the
 * CSS already renders `.reveal` fully visible in that case).
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (REDUCED) return setShown(true);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? "in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * The hero's 3D product stack: the real dashboard as a back panel, with a
 * poster and a live "money" card floating forward in Z. Tilts toward the
 * cursor for parallax depth; sits at a gentle resting angle otherwise.
 */
export function TiltStack() {
  const sceneRef = React.useRef<HTMLDivElement | null>(null);
  const tiltRef = React.useRef<HTMLDivElement | null>(null);
  const raf = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (REDUCED) return;
    const scene = sceneRef.current;
    const tilt = tiltRef.current;
    if (!scene || !tilt) return;

    function onMove(e: MouseEvent) {
      const r = scene!.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
      const py = (e.clientY - r.top) / r.height - 0.5;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        tilt!.style.transform = `rotateX(${(-py * 10).toFixed(2)}deg) rotateY(${(px * 14).toFixed(2)}deg)`;
      });
    }
    function reset() {
      if (raf.current) cancelAnimationFrame(raf.current);
      tilt!.style.transform = "rotateX(0deg) rotateY(0deg)";
    }

    scene.addEventListener("mousemove", onMove);
    scene.addEventListener("mouseleave", reset);
    return () => {
      scene.removeEventListener("mousemove", onMove);
      scene.removeEventListener("mouseleave", reset);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div ref={sceneRef} className="scene relative mx-auto w-full max-w-4xl">
      <div
        ref={tiltRef}
        className="tilt relative"
        style={{ transform: "rotateX(6deg) rotateY(-9deg)" }}
      >
        {/* Back panel — the real campaign dashboard */}
        <div
          className="overflow-hidden rounded-2xl border border-white/10 shadow-deep"
          style={{ transform: "translateZ(0px)" }}
        >
          <Image
            src="/preview/dashboard.png"
            alt="A Swell campaign: a calendar of daily offers with live weather, projected revenue and agent activity"
            width={2880}
            height={2480}
            priority
            className="w-full"
          />
        </div>

        {/* Floating poster — front right */}
        <div
          className="absolute -right-4 -top-8 hidden w-32 overflow-hidden rounded-xl border border-white/15 shadow-deep sm:block md:-right-10 md:w-44"
          style={{ transform: "translateZ(90px)" }}
        >
          <Image
            src="/preview/poster.png"
            alt="An auto-branded poster generated for one day of the campaign"
            width={1080}
            height={1350}
            className="w-full"
          />
        </div>

        {/* Floating money card — front left */}
        <div
          className="absolute -bottom-7 -left-4 hidden rounded-2xl border border-white/15 bg-[#15100b]/90 p-3.5 shadow-deep backdrop-blur sm:block md:-left-10"
          style={{ transform: "translateZ(130px)" }}
        >
          <div className="flex items-center gap-2 text-[11px] font-medium text-white/60">
            <TrendingUp className="size-3.5 text-mint-400" /> Projected next 30 days
          </div>
          <div className="mt-1 font-display text-2xl text-white">
            +$3,246 <span className="align-middle text-xs font-medium text-mint-400">▲ 3.2%</span>
          </div>
          <div className="mt-1 text-[11px] text-white/45">Range $1.5K – $5.9K · moderate confidence</div>
        </div>

        {/* Floating context chip — top left */}
        <div
          className="absolute -left-2 top-10 hidden items-center gap-1.5 rounded-full border border-white/15 bg-[#15100b]/90 px-2.5 py-1 text-[11px] font-medium text-white/75 shadow-deep backdrop-blur md:flex"
          style={{ transform: "translateZ(160px)" }}
        >
          <CloudRain className="size-3 text-sky-300" /> Rain Tue
          <span className="mx-0.5 text-white/25">·</span>
          <Ticket className="size-3 text-rose-accent" /> Game Sat
        </div>
      </div>
    </div>
  );
}
