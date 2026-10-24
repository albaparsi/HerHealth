"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Tilts its panel a few degrees toward the pointer, so the lesson reads as a surface in 3D space. */
export default function Tilt({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2 + 200)));
        const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2 + 200)));
        el.style.setProperty("--ry", `${x * 3}deg`);
        el.style.setProperty("--rx", `${-y * 2.5}deg`);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="scene">
      <div ref={ref} className={`float-panel ${className ?? ""}`}>
        {children}
      </div>
    </div>
  );
}
