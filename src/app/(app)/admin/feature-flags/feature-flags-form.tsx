"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface FeatureFlagRow {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  description: string | null;
  updatedByEmail: string | null;
  updatedAt: string | null;
}

const FLAG_DESCRIPTION =
  "Quando ligada, o Vendeo executa novamente a validação por IA das imagens mesmo depois da revisão humana do brief. Use apenas para diagnóstico, auditoria ou se houver suspeita de que campanhas problemáticas estão passando pela revisão humana.";

type RowState = {
  enabled: boolean;
  reason: string;
  loading: boolean;
  error: string | null;
  success: string | null;
};

export function FeatureFlagsForm({ rows }: { rows: FeatureFlagRow[] }) {
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.key,
        {
          enabled: r.enabled,
          reason: "",
          loading: false,
          error: null,
          success: null,
        },
      ]),
    ),
  );

  function patchRow(key: string, patch: Partial<RowState>) {
    setState((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  async function saveFlag(row: FeatureFlagRow) {
    const s = state[row.key];
    if (!s.reason.trim()) {
      patchRow(row.key, { error: "Motivo obrigatório" });
      return;
    }
    if (s.enabled === row.enabled) {
      patchRow(row.key, { error: "Nenhuma alteração de estado" });
      return;
    }

    patchRow(row.key, { loading: true, error: null, success: null });
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: row.key,
          enabled: s.enabled,
          reason: s.reason.trim(),
          operationId: crypto.randomUUID(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const data = await res.json();
      patchRow(row.key, {
        loading: false,
        enabled: data.enabled ?? s.enabled,
        success: "Estado da flag atualizado com auditoria.",
        reason: "",
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      patchRow(row.key, {
        loading: false,
        error: err instanceof Error ? err.message : "Erro ao salvar",
      });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        As flags são lidas em tempo real pelo backend — a alteração vale sem
        deploy. Alteração exige motivo (obrigatório) e é auditada.
      </p>
      <div className="space-y-3">
        {rows.map((row) => {
          const s = state[row.key];
          return (
            <div key={row.key} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label htmlFor={`flag-${row.key}`} className="text-sm font-medium">
                    {row.label}
                  </label>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {row.key}
                  </div>
                </div>
                <Badge variant={s.enabled ? "ready" : "default"}>
                  {s.enabled ? "Ligada" : "Desligada"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.description || FLAG_DESCRIPTION}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={s.loading}
                  onClick={() => patchRow(row.key, { enabled: !s.enabled })}
                  className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                    s.enabled
                      ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
                      : "border-accent-red/40 bg-accent-red/10 text-accent-red"
                  }`}
                >
                  {s.enabled ? "Ligada" : "Desligada"}
                </button>
                <input
                  id={`flag-${row.key}`}
                  type="text"
                  value={s.reason}
                  disabled={s.loading}
                  placeholder="Motivo da alteração (obrigatório)"
                  onChange={(e) => patchRow(row.key, { reason: e.target.value })}
                  className="w-64 rounded-md border border-border bg-bg-surface px-2 py-1 text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={s.loading}
                  onClick={() => saveFlag(row)}
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {s.loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Salvar
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {row.updatedByEmail && <span>Atualizado por: {row.updatedByEmail}</span>}
                {row.updatedAt && (
                  <span>Em: {new Date(row.updatedAt).toLocaleString("pt-BR")}</span>
                )}
              </div>
              {s.error && <p className="mt-1 text-xs text-destructive">{s.error}</p>}
              {s.success && <p className="mt-1 text-xs text-accent-green">{s.success}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}