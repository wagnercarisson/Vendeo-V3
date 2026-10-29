"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Sparkles,
  Store,
  UserCircle,
} from "lucide-react";
import { SidebarBadge } from "@/components/changelog/sidebar-badge";
import type { ShellMessages, SupportedUiLocale } from "@/lib/i18n";

interface SidebarProps {
  isDrawer?: boolean;
  onNavigate?: () => void;
  latestEntryId?: string | null;
  messages: ShellMessages;
  locale?: SupportedUiLocale;
  lang?: string;
}

type NavLabelKey = "dashboard" | "campaigns" | "store" | "account" | "news";

const NAV_ITEMS: Array<{
  href: string;
  labelKey: NavLabelKey;
  icon: typeof LayoutDashboard;
}> = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/campanhas", labelKey: "campaigns", icon: Megaphone },
  { href: "/loja", labelKey: "store", icon: Store },
  { href: "/conta", labelKey: "account", icon: UserCircle },
  { href: "/novidades", labelKey: "news", icon: Sparkles },
];

export function Sidebar({
  isDrawer,
  onNavigate,
  latestEntryId,
  messages,
  locale,
  lang,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={`flex flex-col gap-1 ${isDrawer ? "" : "p-4"}`}
      aria-label={messages.nav.ariaLabel}
      lang={lang ?? (locale === "es-419" ? "es-419" : undefined)}
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
            {messages.nav[item.labelKey]}
            {item.href === "/novidades" && (
              <SidebarBadge
                latestEntryId={latestEntryId}
                messages={messages.badge}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
