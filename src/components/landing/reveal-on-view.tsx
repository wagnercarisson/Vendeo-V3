"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./reveal-on-view.module.css";

/**
 * Minimal, additive entrance for the demonstration sets (apresentação and
 * abordagens): when the wrapped set enters the viewport, a single 280ms
 * ease-out transform animation (translateY(16px) -> translateY(0)) runs once.
 *
 * Safety rules (approved):
 * - Content is ALWAYS visible by default; nothing is pre-hidden and there is
 *   no opacity change — the animation is only an enhancement.
 * - With no JavaScript, no IntersectionObserver or `prefers-reduced-motion:
 *   reduce`, the set stays completely static and visible (the animation class
 *   is never added).
 * - No timers, no dependencies, no network; transform does not affect layout.
 */
export function RevealOnView({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={revealed ? "on" : "off"}
      className={`${className} ${revealed ? styles.reveal : ""}`.trim()}
    >
      {children}
    </div>
  );
}
