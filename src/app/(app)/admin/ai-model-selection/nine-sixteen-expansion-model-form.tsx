"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { NineSixteenExpansionConfigView } from "@/lib/ai/nine-sixteen-expansion-model-config-view";

/**
 * Formulário cliente da configuração da expansão 9:16 (F60.6, D7).
 *
 * Uma única seleção (modelo + qualidade), motivo obrigatório, idempotência por
 * fingerprint de conteúdo (`operationId` estável até qualquer edição) e
 * feedback auditável. O aviso de cobertura de pricing do rascunho é recomputado
 * a cada mudança de seletor a partir do mapa `${model}|${quality}` da view: uma
 * chave ausente (cobertura desconhecida) não renderiza nada e nunca "Completa".
 * O aviso **nunca** desabilita o CTA — salvar é permitido com cobertura
 * incompleta; a execução futura bloqueia antes do gasto.
 */

type Draft = {
  model: string;
  quality: string;
  reason: string;
  operationId: string | null;
  operationFingerprint: string | null;
  loading: boolean;
  error: string | null;
  success: string | null;
};

const MISSING_REASON = "Motivo obrigatório";
const MISSING_SELECTION = "Selecione o modelo e a qualidade";
const INVALID_COMBINATION = "Modelo ou qualidade fora das opções da expansão";
const SAVE_ERROR =
  "Não foi possível salvar a configuração da expansão. Confira o motivo e a combinação escolhida; tente novamente.";
const CONFLICT_ERROR =
  "Esta operação já foi registrada com outro conteúdo. Recarregue a página e tente novamente.";
const SUCCESS = "Configuração da expansão salva com auditoria.";

const CONTROL_CLASS =
  "min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none transition-colors duration-200 placeholder:text-text-muted focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20";

const LABEL_CLASS = "text-xs font-semibold uppercase tracking-wider text-text-secondary";

const MODEL_PLACEHOLDER = "Selecione o modelo";
const QUALITY_PLACEHOLDER = "Selecione a qualidade";

type CoverageLabel = "Completa" | "Parcial" | "Ausente";

function coverageLabel(
  coverage: "complete" | "partial" | "missing",
): CoverageLabel {
  if (coverage === "complete") return "Completa";
  if (coverage === "partial") return "Parcial";
  return "Ausente";
}

function makeDraft(view: NineSixteenExpansionConfigView): Draft {
  return {
    model: view.current?.model ?? "",
    quality: view.current?.quality ?? "",
    reason: "",
    operationId: null,
    operationFingerprint: null,
    loading: false,
    error: null,
    success: null,
  };
}

function saveErrorMessage(raw: string | undefined): string {
  if (!raw) return SAVE_ERROR;
  const lower = raw.toLowerCase();
  if (lower.includes("operation_id_conflict") || lower.includes("operation_config_conflict")) {
    return CONFLICT_ERROR;
  }
  if (lower.includes("reason")) return MISSING_REASON;
  if (
    lower.includes("model") ||
    lower.includes("quality") ||
    lower.includes("catalog") ||
    lower.includes("eligible")
  ) {
    return INVALID_COMBINATION;
  }
  return SAVE_ERROR;
}

export function NineSixteenExpansionModelForm({
  view,
}: {
  view: NineSixteenExpansionConfigView;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => makeDraft(view));

  function edit(update: Partial<Draft>) {
    setDraft((previous) => ({
      ...previous,
      ...update,
      operationId: null,
      operationFingerprint: null,
      success: null,
      error: null,
    }));
  }

  async function save() {
    if (!draft.model || !draft.quality) {
      setDraft((previous) => ({ ...previous, error: MISSING_SELECTION, success: null }));
      return;
    }
    if (!draft.reason.trim()) {
      setDraft((previous) => ({ ...previous, error: MISSING_REASON, success: null }));
      return;
    }

    const body = {
      model: draft.model,
      quality: draft.quality,
      reason: draft.reason.trim(),
    };
    const fingerprint = JSON.stringify(["save", body]);
    const operationId =
      draft.operationFingerprint === fingerprint && draft.operationId
        ? draft.operationId
        : crypto.randomUUID();

    setDraft((previous) => ({
      ...previous,
      operationId,
      operationFingerprint: fingerprint,
      loading: true,
      error: null,
      success: null,
    }));

    try {
      const response = await fetch("/api/admin/nine-sixteen-expansion-model-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, operationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(saveErrorMessage(data.error));

      setDraft((previous) => ({
        ...previous,
        loading: false,
        operationId: null,
        operationFingerprint: null,
        reason: "",
        success: SUCCESS,
      }));
      window.setTimeout(() => router.refresh(), 700);
    } catch (error) {
      setDraft((previous) => ({
        ...previous,
        loading: false,
        error: error instanceof Error ? error.message : SAVE_ERROR,
      }));
    }
  }

  const draftKey = `${draft.model}|${draft.quality}`;
  const draftCoverage = view.targetCoverageByCombination[draftKey];
  const showCoverageWarning =
    draftCoverage !== undefined && draftCoverage.pricingCoverage !== "complete";

  const warningId = "nine-sixteen-expansion-coverage-warning";
  const errorId = "nine-sixteen-expansion-error";
  const describedBy =
    [showCoverageWarning ? warningId : null, draft.error ? errorId : null]
      .filter((value): value is string => value !== null)
      .join(" ") || undefined;

  return (
    <section aria-labelledby="nine-sixteen-expansion-form-heading" className="space-y-4">
      <h3
        id="nine-sixteen-expansion-form-heading"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Configuração da expansão
      </h3>

      <Card className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nine-sixteen-expansion-model" className={LABEL_CLASS}>
              Modelo
            </label>
            <select
              id="nine-sixteen-expansion-model"
              className={CONTROL_CLASS}
              value={draft.model}
              onChange={(event) => edit({ model: event.target.value })}
            >
              {!view.configured && (
                <option value="" disabled>
                  {MODEL_PLACEHOLDER}
                </option>
              )}
              {view.eligibleModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nine-sixteen-expansion-quality" className={LABEL_CLASS}>
              Qualidade
            </label>
            <select
              id="nine-sixteen-expansion-quality"
              className={CONTROL_CLASS}
              value={draft.quality}
              onChange={(event) => edit({ quality: event.target.value })}
            >
              {!view.configured && (
                <option value="" disabled>
                  {QUALITY_PLACEHOLDER}
                </option>
              )}
              {view.eligibleQualities.map((quality) => (
                <option key={quality} value={quality}>
                  {quality}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showCoverageWarning && draftCoverage && (
          <div
            id={warningId}
            role="status"
            className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Cobertura de pricing {coverageLabel(draftCoverage.pricingCoverage)}: faltam{" "}
              {draftCoverage.missingComponents.join(", ")}. Você pode salvar, mas novas expansões
              exigem cobertura completa para o modelo e a qualidade selecionados.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nine-sixteen-expansion-reason" className={LABEL_CLASS}>
            Motivo da alteração
          </label>
          <textarea
            id="nine-sixteen-expansion-reason"
            className={`${CONTROL_CLASS} py-2`}
            value={draft.reason}
            placeholder="Motivo obrigatório para auditoria"
            aria-required="true"
            aria-describedby={describedBy}
            onChange={(event) => edit({ reason: event.target.value })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" loading={draft.loading} onClick={save}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {draft.loading ? "Salvando..." : "Salvar configuração"}
          </Button>
        </div>

        {draft.error && (
          <p id={errorId} className="text-xs text-accent-red" role="alert">
            {draft.error}
          </p>
        )}
        {draft.success && (
          <p className="flex items-center gap-1 text-xs text-accent-green" role="status">
            <Check className="h-4 w-4" aria-hidden="true" />
            {draft.success}
          </p>
        )}
      </Card>
    </section>
  );
}
