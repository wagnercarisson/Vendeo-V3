"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { AccountMenu } from "./account-menu";
import type { JwtPayload } from "@/types/auth";
import type { RefObject, MouseEvent } from "react";

interface TopbarProps {
  user: { claims: JwtPayload };
  storeName?: string | null;
  onToggleMenu: () => void;
  isDrawerOpen: boolean;
  toggleButtonRef?: RefObject<HTMLButtonElement | null>;
}

const NEW_CAMPAIGN_PATH = "/campanhas/nova";

export function Topbar({ user, storeName, onToggleMenu, isDrawerOpen, toggleButtonRef }: TopbarProps) {
  const handleNewCampaignClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Clicking "Nova Campanha" while already on /campanhas/nova is a client-side
    // navigation to the same route, which does NOT remount the page components.
    // Force a hard reload so useOperationCosts refetches fresh cost state.
    if (window.location.pathname === NEW_CAMPAIGN_PATH) {
      e.preventDefault();
      window.location.reload();
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-bg-surface px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          ref={toggleButtonRef}
          onClick={onToggleMenu}
          aria-controls="mobile-drawer"
          aria-expanded={isDrawerOpen}
          aria-label="Abrir menu de navegação"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-text-secondary hover:bg-bg-elevated hover:text-text-primary md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="truncate text-lg font-bold text-text-primary font-heading">
          {storeName ?? "Vendeo"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={NEW_CAMPAIGN_PATH}
          onClick={handleNewCampaignClick}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-accent-green px-3 py-1.5 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Link>
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
