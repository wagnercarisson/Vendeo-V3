"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Store,
  UserCircle,
} from "lucide-react";

interface SidebarProps {
  isDrawer?: boolean;
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/loja", label: "Loja", icon: Store },
  { href: "/conta", label: "Conta", icon: UserCircle },
];

export function Sidebar({ isDrawer, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={`flex flex-col gap-1 ${isDrawer ? "" : "p-4"}`}
      aria-label="Navegação principal"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname
          ? pathname === item.href || pathname.startsWith(item.href + "/")
          : false;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-heading font-medium transition-colors duration-200 ${
              isActive
                ? "bg-accent-green/10 text-accent-green"
                : "text-text-muted hover:bg-bg-elevated hover:text-text-primary"
            }`}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
