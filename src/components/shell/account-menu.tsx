"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, ChevronDown, Sparkles, UserCircle } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import type { JwtPayload } from "@/types/auth";
import type { ShellMessages, SupportedUiLocale } from "@/lib/i18n";

interface AccountMenuProps {
  user: { claims: JwtPayload };
  messages: ShellMessages;
  locale?: SupportedUiLocale;
  lang?: string;
  isAdmin?: boolean;
}

const itemClassName =
  "flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-200 font-body";

export function AccountMenu({
  user,
  messages,
  lang,
  isAdmin,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName =
    user.claims.email ||
    user.claims.sub?.slice(0, 8) ||
    messages.account.fallbackUser;
  const isFallbackUser = !user.claims.email && !user.claims.sub;
  // O e-mail/identificador não deve herdar es-419 do trigger; o fallback
  // traduzido ("Usuario") mantém o idioma da interface.
  const identifierLang = isFallbackUser ? lang : lang ? "" : undefined;

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
        aria-label={messages.account.trigger}
        lang={lang}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-0 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-200 font-body sm:gap-2 sm:px-3"
      >
        <span lang={identifierLang} className="hidden sm:inline-block max-w-[120px] truncate">{displayName}</span>
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
          {isAdmin ? (
            <>
              <Link
                href="/conta"
                lang={lang}
                onClick={() => setIsOpen(false)}
                className={itemClassName}
              >
                <Settings className="h-4 w-4" />
                {messages.account.settings}
              </Link>
              <Link
                href="/novidades"
                lang={lang}
                onClick={() => setIsOpen(false)}
                className={itemClassName}
              >
                <Sparkles className="h-4 w-4" />
                {messages.nav.news}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/conta"
                lang={lang}
                onClick={() => setIsOpen(false)}
                className={itemClassName}
              >
                <UserCircle className="h-4 w-4" />
                {messages.nav.account}
              </Link>
              <Link
                href="/novidades"
                lang={lang}
                onClick={() => setIsOpen(false)}
                className={itemClassName}
              >
                <Sparkles className="h-4 w-4" />
                {messages.nav.news}
              </Link>
              <Link
                href="/configuracoes"
                lang={lang}
                onClick={() => setIsOpen(false)}
                className={itemClassName}
              >
                <Settings className="h-4 w-4" />
                {messages.account.settings}
              </Link>
            </>
          )}
          <div
            lang={lang}
            className="flex min-h-[44px] items-center rounded-lg px-1 text-sm text-text-secondary hover:bg-bg-elevated transition-colors duration-200 font-body"
          >
            <LogoutButton label={messages.account.logout} />
          </div>
        </div>
      )}
    </div>
  );
}
