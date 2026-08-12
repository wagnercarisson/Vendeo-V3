"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Segment } from "@/lib/ai-cost/operation-runs-service";

const SEGMENT_LABELS: Record<Segment, string> = {
  test: "Teste",
  "freemium/promotional": "Freemium/promocional",
  paid: "Pago",
  "manual/admin": "Manual/admin",
  unknown: "Desconhecido",
};

const OPERATION_TYPE_OPTIONS = [
  { value: "campaign_delivery", label: "Campanha" },
  { value: "visual_signature", label: "Assinatura visual" },
  { value: "brand_profile", label: "Perfil de marca" },
  { value: "theme", label: "Tema" },
];

const STATUS_OPTIONS = [
  { value: "success", label: "Sucesso" },
  { value: "failed", label: "Falha" },
];

/** Presets de período (D3) — janela 7/30/90 dias; a API limita a 365d (400). */
const PERIOD_PRESETS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
] as const;

export interface AiOperationCostsFilterState {
  periodStart: string | null;
  periodEnd: string | null;
  storeId: string | null;
  operationRunType: string | null;
  status: string | null;
  provider: string | null;
  model: string | null;
  generationType: string | null;
  operationRunId: string | null;
  segment: Segment | null;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function applyPreset(days: number): { periodStart: string; periodEnd: string } {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  return { periodStart: toDateInputValue(start), periodEnd: toDateInputValue(end) };
}

interface AiOperationCostsFiltersProps {
  filters: AiOperationCostsFilterState;
}

/**
 * Filtros do painel (D3/D9) — período com presets 7/30/90 dias (+ limite de
 * janela da API, 365d), loja, tipo de entrega, status, provider, model,
 * generation_type, operation_run_id e segmento econômico. Submit → atualiza
 * os searchParams da página (a listagem/KPIs vêm do service).
 */
export function AiOperationCostsFilters({
  filters,
}: AiOperationCostsFiltersProps) {
  const router = useRouter();
  const [form, setForm] = useState<AiOperationCostsFilterState>(filters);

  function set<K extends keyof AiOperationCostsFilterState>(
    key: K,
    value: AiOperationCostsFilterState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildQueryString(state: AiOperationCostsFilterState): string {
    const params = new URLSearchParams();
    const entries: Array<[string, string]> = [];
    if (state.periodStart) entries.push(["periodStart", state.periodStart]);
    if (state.periodEnd) entries.push(["periodEnd", state.periodEnd]);
    if (state.storeId) entries.push(["storeId", state.storeId]);
    if (state.operationRunType)
      entries.push(["operationRunType", state.operationRunType]);
    if (state.status) entries.push(["status", state.status]);
    if (state.provider) entries.push(["provider", state.provider]);
    if (state.model) entries.push(["model", state.model]);
    if (state.generationType)
      entries.push(["generationType", state.generationType]);
    if (state.operationRunId) entries.push(["operationRunId", state.operationRunId]);
    if (state.segment) entries.push(["segment", state.segment]);
    for (const [key, value] of entries) params.set(key, value);
    const qs = params.toString();
    return qs ? `/admin/ai-operation-costs?${qs}` : "/admin/ai-operation-costs";
  }

  function navigate(state: AiOperationCostsFilterState) {
    router.push(buildQueryString(state));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(form);
  }

  function handlePreset(days: number) {
    const range = applyPreset(days);
    navigate({ ...form, periodStart: range.periodStart, periodEnd: range.periodEnd });
  }

  const selectClasses =
    "rounded-md border border-border bg-bg-surface px-2 py-1.5 text-sm";
  const inputClasses =
    "rounded-md border border-border bg-bg-surface px-2 py-1.5 text-sm";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-border bg-bg-surface p-4"
      aria-label="Filtros de custos de operação"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Período
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={form.periodStart ?? ""}
              onChange={(e) => set("periodStart", e.target.value || null)}
              aria-label="Período início"
              className={inputClasses}
            />
            <span className="text-muted-foreground">até</span>
            <input
              type="date"
              value={form.periodEnd ?? ""}
              onChange={(e) => set("periodEnd", e.target.value || null)}
              aria-label="Período fim"
              className={inputClasses}
            />
          </div>
        </div>
        <div className="flex gap-1">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => handlePreset(preset.days)}
              className="rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-bg-elevated"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Loja (ID)
          <input
            value={form.storeId ?? ""}
            onChange={(e) => set("storeId", e.target.value || null)}
            placeholder="uuid da loja"
            className={inputClasses}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Tipo de entrega
          <select
            value={form.operationRunType ?? ""}
            onChange={(e) => set("operationRunType", e.target.value || null)}
            className={selectClasses}
          >
            <option value="">Todos</option>
            {OPERATION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Status
          <select
            value={form.status ?? ""}
            onChange={(e) => set("status", e.target.value || null)}
            className={selectClasses}
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Segmento econômico
          <select
            value={form.segment ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              set(
                "segment",
                value === "" ? null : (value as Segment),
              );
            }}
            className={selectClasses}
          >
            <option value="">Todos</option>
            {(Object.keys(SEGMENT_LABELS) as Segment[]).map((seg) => (
              <option key={seg} value={seg}>
                {SEGMENT_LABELS[seg]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Provider
          <input
            value={form.provider ?? ""}
            onChange={(e) => set("provider", e.target.value || null)}
            placeholder="ex.: openai"
            className={inputClasses}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Modelo
          <input
            value={form.model ?? ""}
            onChange={(e) => set("model", e.target.value || null)}
            placeholder="ex.: gpt-4o"
            className={inputClasses}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Etapa (generation_type)
          <input
            value={form.generationType ?? ""}
            onChange={(e) => set("generationType", e.target.value || null)}
            placeholder="ex.: campaign_image"
            className={inputClasses}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          ID da entrega (run)
          <input
            value={form.operationRunId ?? ""}
            onChange={(e) => set("operationRunId", e.target.value || null)}
            placeholder="uuid do operation_run_id"
            className={inputClasses}
          />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Janela de período limitada a 365 dias pela API.
        </p>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Aplicar filtros
        </button>
      </div>
    </form>
  );
}
