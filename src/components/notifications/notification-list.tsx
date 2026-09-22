"use client";

import { useState } from "react";

export type InAppNotification = { id: string; kind: string; payload: Record<string, unknown>; created_at: string; inapp_read_at: string | null };

export function NotificationList({ initialNotifications }: { initialNotifications: InAppNotification[] }) {
  const [items, setItems] = useState(initialNotifications);
  async function markRead(id: string) {
    const response = await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) setItems(current => current.map(item => item.id === id ? { ...item, inapp_read_at: new Date().toISOString() } : item));
  }
  return <div id="notificacoes" className="space-y-2">{items.length === 0 ? <p className="text-sm text-text-muted">Nenhuma notificação.</p> : items.map(item => <button key={item.id} type="button" onClick={() => markRead(item.id)} className={`block w-full rounded-lg border p-3 text-left text-sm ${item.inapp_read_at ? "border-border text-text-muted" : "border-accent-blue/40 bg-bg-elevated text-text-primary"}`}><span className="font-semibold">{String(item.payload.title ?? item.kind)}</span><span className="mt-1 block">{String(item.payload.message ?? "Há uma atualização na sua conta.")}</span></button>)}</div>;
}
