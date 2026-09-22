import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupportCreditRequestsPage() {
  try { await requireAdmin(); } catch { return <p className="text-destructive">Acesso negado.</p>; }
  const { data, error } = await supabaseAdmin.from("support_credit_requests").select("*").order("created_at", { ascending: false });
  if (error) return <p className="text-destructive">Erro ao carregar solicitações: {error.message}</p>;
  return <div><h1 className="mb-2 font-heading text-2xl font-bold">Solicitações de créditos</h1><p className="mb-6 text-sm text-text-secondary">Protocolos recebidos para análise manual do suporte.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-text-muted"><th className="px-2 py-3">Protocolo</th><th className="px-2 py-3">Email</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Recebido em</th></tr></thead><tbody>{(data ?? []).map((row) => <tr className="border-b" key={row.id}><td className="px-2 py-3 font-mono">{row.protocol}</td><td className="px-2 py-3">{row.requested_email ?? "-"}</td><td className="px-2 py-3">{row.status}</td><td className="px-2 py-3">{new Date(row.received_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div></div>;
}
