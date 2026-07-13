"use client";

import { useState } from "react";
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { SidebarDrawer } from "./sidebar-drawer";
import type { JwtPayload } from "@/types/auth";

interface AppShellProps {
  user: { claims: JwtPayload };
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-deep">
      <aside className="hidden w-56 flex-shrink-0 border-r border-border bg-bg-surface md:block">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="text-lg font-bold text-text-primary font-heading">
            Vendeo
          </span>
        </div>
        <Sidebar />
      </aside>

      <div className="flex flex-1 flex-col">
        <Topbar
          user={user}
          onToggleMenu={() => setIsDrawerOpen(!isDrawerOpen)}
          isDrawerOpen={isDrawerOpen}
        />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      <SidebarDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
