"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { SidebarDrawer } from "./sidebar-drawer";
import { VendeoBrandLink } from "./vendeo-brand";
import { VendeoSignature } from "./vendeo-signature";
import type { JwtPayload } from "@/types/auth";
import type {
  CommonMessages,
  ShellMessages,
  SupportedUiLocale,
} from "@/lib/i18n";

interface AppShellProps {
  user: { claims: JwtPayload };
  storeName?: string | null;
  latestChangelogEntryId?: string | null;
  locale: SupportedUiLocale;
  commonMessages: CommonMessages;
  shellMessages: ShellMessages;
  commonMessagesEs?: CommonMessages;
  shellMessagesEs?: ShellMessages;
  children: React.ReactNode;
}

export function AppShell({
  user,
  storeName,
  latestChangelogEntryId,
  locale,
  shellMessages,
  shellMessagesEs,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const effectiveLocale: SupportedUiLocale = pathname?.startsWith("/admin")
    ? "pt-BR"
    : locale;
  const shellEffective =
    effectiveLocale === "es-419" ? (shellMessagesEs ?? shellMessages) : shellMessages;
  const lang = effectiveLocale === "es-419" ? "es-419" : undefined;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="flex min-h-dvh bg-bg-deep"
      data-effective-locale={effectiveLocale}
    >
      <aside
        ref={asideRef}
        className="sticky top-0 hidden h-dvh w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-border bg-bg-surface md:flex"
      >
        <div
          ref={headerRef}
          className="flex h-14 shrink-0 items-center border-b border-border px-4"
        >
          <VendeoBrandLink variant="logo" />
        </div>
        <div ref={navRef} className="shrink-0">
          <Sidebar
            latestEntryId={latestChangelogEntryId}
            messages={shellEffective}
            locale={effectiveLocale}
            lang={lang}
          />
        </div>
        <VendeoSignature
          asideRef={asideRef}
          headerRef={headerRef}
          navRef={navRef}
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          storeName={storeName}
          onToggleMenu={() => setIsDrawerOpen(!isDrawerOpen)}
          isDrawerOpen={isDrawerOpen}
          toggleButtonRef={toggleButtonRef}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>

      <SidebarDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          toggleButtonRef.current?.focus();
        }}
        toggleButtonRef={toggleButtonRef}
        latestEntryId={latestChangelogEntryId}
        messages={shellEffective}
        locale={effectiveLocale}
      />
    </div>
  );
}
