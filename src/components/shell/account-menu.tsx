"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, ChevronDown, Sparkles } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import type { JwtPayload } from "@/types/auth";

interface AccountMenuProps {
  user: { claims: JwtPayload };
}

export function AccountMenu({ user }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName =
    user.claims.email || user.claims.sub?.slice(0, 8) || "Usuário";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Menu da conta"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-0 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-200 font-body sm:gap-2 sm:px-3"
      >
        <span className="hidden sm:inline-block max-w-[120px] truncate">{displayName}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${reducedMotion ? "" : "duration-200"} ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-bg-surface p-1 shadow-lg z-50"
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsOpen(false);
          }}
        >
          <div className="px-3 py-2 text-xs text-text-muted font-body border-b border-border mb-1">
            {displayName}
          </div>
          <Link
            href="/conta"
            onClick={() => setIsOpen(false)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-200 font-body"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
          <Link
            href="/novidades"
            onClick={() => setIsOpen(false)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-200 font-body"
          >
            <Sparkles className="h-4 w-4" />
            Novidades
          </Link>
          <div className="flex min-h-[44px] items-center rounded-lg px-1 text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-200 font-body">
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}
