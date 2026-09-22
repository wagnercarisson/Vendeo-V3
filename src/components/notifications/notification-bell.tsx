"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function NotificationBell() {
  const [count, setCount] = useState(0);
  useEffect(() => { fetch("/api/notifications/read").then(r => r.ok ? r.json() : null).then(d => setCount(d?.unreadCount ?? 0)).catch(() => undefined); }, []);
  return <Link href="/conta#notificacoes" aria-label={count ? `${count} notificações não lidas` : "Notificações"} className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text-primary">
    <Bell className="h-5 w-5" />{count > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-accent-red px-1 text-center text-[10px] font-bold text-white">{count > 9 ? "9+" : count}</span>}
  </Link>;
}
