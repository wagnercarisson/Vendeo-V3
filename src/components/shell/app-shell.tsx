"use client";

import { useRef, useState } from "react";
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { SidebarDrawer } from "./sidebar-drawer";
import type { JwtPayload } from "@/types/auth";

interface AppShellProps {
  user: { claims: JwtPayload };
  storeName?: string | null;
  children: React.ReactNode;
}

export function AppShell({ user, storeName, children }: AppShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex h-screen bg-bg-deep">
      <aside className="hidden w-56 flex-shrink-0 overflow-y-auto border-r border-border bg-bg-surface md:block">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="text-lg font-bold text-text-primary font-heading">
            Vendeo
          </span>
        </div>
        <Sidebar />
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <Topbar
          user={user}
          storeName={storeName}
          onToggleMenu={() => setIsDrawerOpen(!isDrawerOpen)}
          isDrawerOpen={isDrawerOpen}
          toggleButtonRef={toggleButtonRef}
        />
        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6">{children}</main>
      </div>

      <SidebarDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          toggleButtonRef.current?.focus();
        }}
        toggleButtonRef={toggleButtonRef}
      />
    </div>
  );
}
