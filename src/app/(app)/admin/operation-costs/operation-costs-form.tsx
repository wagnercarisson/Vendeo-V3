"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OperationKey } from "@/lib/credit/types";
import type { EconomicParameterResolution } from "@/lib/economic/types";

export interface OperationCostRow {
  operationKey: OperationKey;
  costCredits: number;
  enabled: boolean;
  updatedByEmail: string | null;
  updatedAt: string | null;
  source: "table" | "fallback";
}

type RowState = {
  costCredits: number;
  enabled: boolean;
  reason: string;
  loading: boolean;
  error: string | null;
  success: string | null;
};

export function OperationCostsForm({ rows }: { rows: OperationCostRow[] }) {
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.operationKey,
        {
          costCredits: r.costCredits,
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

  async function saveCost(row: OperationCostRow) {
    const s = state[row.operationKey];
    if (!s.reason.trim()) {
      patchRow(row.operationKey, { error: "Motivo obrigatório" });
      return;
    }
    if (s.costCredits < 1) {
      patchRow(row.operationKey, { error: "Custo deve ser ≥ 1" });
      return;
    }
    if (s.costCredits === row.costCredits) {
      patchRow(row.operationKey, { error: "Nenhuma alteração de custo" });
      return;
    }

    patchRow(row.operationKey, { loading: true, error: null, success: null });
    try {
      const res = await fetch("/api/admin/operation-costs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationKey: row.operationKey,
          costCredits: s.costCredits,
          reason: s.reason.trim(),
          operationId: crypto.randomUUID(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const data = await res.json();
      patchRow(row.operationKey, {
        loading: false,
        success: `Salvo. audit_id: ${data.audit_id}. Não altera em produção até salvar.`,
        reason: "",
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      patchRow(row.operationKey, {
        loading: false,
        error: err instanceof Error ? err.message : "Erro ao salvar",
      });
    }
  }

  async function saveEnabled(row: OperationCostRow) {
    const s = state[row.operationKey];
    if (!s.reason.trim()) {
      patchRow(row.operationKey, { error: "Motivo obrigatório" });
      return;
    }
    if (s.enabled === row.enabled) {
      patchRow(row.operationKey, { error: "Nenhuma alteração de habilitação" });
      return;
    }

    patchRow(row.operationKey, { loading: true, error: null, success: null });
    try {
      const res = await fetch("/api/admin/operation-costs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationKey: row.operationKey,
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
      patchRow(row.operationKey, {
        loading: false,
        success: `Salvo. audit_id: ${data.audit_id}. Não altera em produção até salvar.`,
        reason: "",
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      patchRow(row.operationKey, {
        loading: false,
        error: err instanceof Error ? err.message : "Erro ao salvar",
      });
    }
  }

  return (
    <div className="space-y-4 overflow-x-auto">
      <p className="text-xs text-muted-foreground">
        Alterações não valem em produção até salvar (uma mutação por vez:
        custo OU habilitação).
      </p>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Operação</th>
            <th className="py-2 pr-3 font-medium">Custo</th>
            <th className="py-2 pr-3 font-medium">Habilitada</th>
            <th className="py-2 pr-3 font-medium">Atualizado por</th>
            <th className="py-2 pr-3 font-medium">Atualizado em</th>
            <th className="py-2 pr-3 font-medium">Fonte</th>
            <th className="py-2 pr-3 font-medium">Motivo</th>
            <th className="py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const s = state[row.operationKey];
            return (
              <tr key={row.operationKey} className="border-b align-top">
                <td className="py-3 pr-3 font-mono text-xs">
                  {row.operationKey}
                </td>
                <td className="py-3 pr-3">
                  <input
                    type="number"
                    min={1}
                    value={s.costCredits}
                    disabled={s.loading}
                    onChange={(e) =>
                      patchRow(row.operationKey, {
                        costCredits: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-20 rounded-md border border-border bg-bg-surface px-2 py-1 text-sm disabled:opacity-50"
                  />
                </td>
                <td className="py-3 pr-3">
                  <button
                    type="button"
                    disabled={s.loading}
                    onClick={() =>
                      patchRow(row.operationKey, { enabled: !s.enabled })
                    }
                    className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                      s.enabled
                        ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
                        : "border-accent-red/40 bg-accent-red/10 text-accent-red"
                    }`}
                  >
                    {s.enabled ? "Sim" : "Não"}
                  </button>
                </td>
                <td className="py-3 pr-3 text-xs">
                  {row.updatedByEmail ?? "—"}
                </td>
                <td className="py-3 pr-3 text-xs">
                  {row.updatedAt
                    ? new Date(row.updatedAt).toLocaleString("pt-BR")
                    : "—"}
                </td>
                <td className="py-3 pr-3">
                  <Badge variant={row.source === "table" ? "ready" : "default"}>
                    {row.source === "table" ? "tabela" : "fallback"}
                  </Badge>
                </td>
                <td className="py-3 pr-3">
                  <input
                    type="text"
                    value={s.reason}
                    disabled={s.loading}
                    placeholder="Motivo da alteração (obrigatório)"
                    onChange={(e) =>
                      patchRow(row.operationKey, { reason: e.target.value })
                    }
                    className="w-48 rounded-md border border-border bg-bg-surface px-2 py-1 text-sm disabled:opacity-50"
                  />
                </td>
                <td className="py-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={s.loading}
                      onClick={() => saveCost(row)}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {s.loading && <Loader2 className="h-3 w-3 animate-spin" />}
                      Salvar custo
                    </button>
                    <button
                      type="button"
                      disabled={s.loading}
                      onClick={() => saveEnabled(row)}
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium disabled:opacity-50"
                    >
                      Salvar habilitação
                    </button>
                    {s.error && (
                      <p className="text-xs text-destructive">{s.error}</p>
                    )}
                    {s.success && (
                      <p className="text-xs text-accent-green">{s.success}</p>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const PARAM_LABELS: Record<string, string> = {
  usd_brl_rate: "Taxa de conversão",
  credit_value_brl: "Valor operacional do crédito",
};

const PARAM_HINTS: Record<string, string> = {
  usd_brl_rate:
    "Multiplicador que converte o custo estimado do provider para a moeda local.",
  credit_value_brl:
    "Valor interno da entrega usado para estimar a receita operacional.",
};

type ParamState = {
  value: number;
  draft: string;
  reason: string;
  loading: boolean;
  error: string | null;
  success: string | null;
};

function formatParamValue(value: number): string {
  return value.toFixed(2);
}

function parseParamDraft(draft: string): number | null {
  const normalized = draft.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function ParamsForm({
  parameters,
}: {
  parameters: EconomicParameterResolution[];
}) {
  const [state, setState] = useState<Record<string, ParamState>>(() =>
    Object.fromEntries(
      parameters.map((p) => [
        p.key,
        {
          value: p.value,
          draft: formatParamValue(p.value),
          reason: "",
          loading: false,
          error: null,
          success: null,
        },
      ]),
    ),
  );

  function patchParam(key: string, patch: Partial<ParamState>) {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function saveParam(param: EconomicParameterResolution) {
    const s = state[param.key];
    // T-38.2-31 (Tampering): motivo obrigatório no form — espelha o zod
    // min(1) da API e o reason NOT NULL da audit table.
    if (!s.reason.trim()) {
      patchParam(param.key, { error: "Motivo obrigatório" });
      return;
    }
    const parsed = parseParamDraft(s.draft);
    if (parsed === null || parsed <= 0) {
      patchParam(param.key, { error: "Valor deve ser maior que zero" });
      return;
    }

    patchParam(param.key, { loading: true, error: null, success: null });
    try {
      const res = await fetch("/api/admin/economic-parameters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: param.key,
          value: parsed,
          reason: s.reason.trim(),
          // Idempotência por operationId gerado no client (T-38.2-31/D2).
          operationId: crypto.randomUUID(),
        }),
      });
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const data = await res.json();
      patchParam(param.key, {
        loading: false,
        value: parsed,
        draft: formatParamValue(parsed),
        success: `Parâmetro atualizado — auditoria: ${data.auditId}`,
        reason: "",
      });
    } catch (err) {
      patchParam(param.key, {
        loading: false,
        error: err instanceof Error ? err.message : "Erro ao salvar",
      });
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Parâmetros de conversão monetária — fonte única de USD→BRL e do valor
        operacional do crédito. Alterações não valem em produção até salvar
        (motivo obrigatório + auditoria).
      </p>
      <div className="space-y-3">
        {parameters.map((p) => {
          const s = state[p.key];
          return (
            <div
              key={p.key}
              data-testid={`param-${p.key}`}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`param-${p.key}`} className="text-sm font-medium">
                  {PARAM_LABELS[p.key] ?? p.key}
                </label>
                <Badge variant={p.source === "table" ? "ready" : "default"}>
                  {p.source === "table" ? "tabela" : "fallback"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {PARAM_HINTS[p.key]}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  id={`param-${p.key}`}
                  type="text"
                  inputMode="decimal"
                  value={s.draft}
                  disabled={s.loading}
                  onBlur={() => {
                    const parsed = parseParamDraft(s.draft);
                    patchParam(p.key, {
                      draft: formatParamValue(
                        parsed === null ? s.value : parsed,
                      ),
                    });
                  }}
                  onChange={(e) =>
                    patchParam(p.key, { draft: e.target.value })
                  }
                  className="w-28 rounded-md border border-border bg-bg-surface px-2 py-1 text-sm disabled:opacity-50"
                />
                <input
                  type="text"
                  value={s.reason}
                  disabled={s.loading}
                  placeholder="Motivo da alteração (obrigatório)"
                  onChange={(e) =>
                    patchParam(p.key, { reason: e.target.value })
                  }
                  className="w-48 rounded-md border border-border bg-bg-surface px-2 py-1 text-sm disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={s.loading}
                  onClick={() => saveParam(p)}
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {s.loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Salvar
                </button>
              </div>
              {s.error && (
                <p className="mt-1 text-xs text-destructive">{s.error}</p>
              )}
              {s.success && (
                <p className="mt-1 text-xs text-accent-green">{s.success}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
