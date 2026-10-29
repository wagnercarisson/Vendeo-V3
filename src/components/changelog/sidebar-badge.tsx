"use client";

import { useChangelogState } from "@/hooks/use-changelog-state";
import type { ShellMessages } from "@/lib/i18n";

interface SidebarBadgeProps {
  latestEntryId?: string | null;
  messages: ShellMessages["badge"];
}

/**
 * Indicador de novidades na sidebar. Ponto verde discreto renderizado apenas
 * quando há content novo não visto. `latestEntryId` vem por prop do server
 * (layout → AppShell → Sidebar) — NUNCA importa módulos server-only.
 * A cor não é o único indicador: aria-label + title para a11y (MASTER.md 11).
 */
export function SidebarBadge({ latestEntryId, messages }: SidebarBadgeProps) {
  const { hasUnseen } = useChangelogState();

  if (!latestEntryId || !hasUnseen(latestEntryId)) return null;

  return (
    <span
      role="status"
      aria-label={messages.available}
      title={messages.view}
      className="ml-auto inline-block h-2 w-2 rounded-full bg-accent-green"
    />
  );
}
