"use client";

import { useState } from "react";
import { AlertTriangle, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INITIAL_IMAGE_MODEL_PAIR } from "@/lib/ai/image-model-pair";
import type { ImageModelPairConfigView } from "@/lib/ai/image-model-pair-config-view";
import type { ImagePairPricingCoverage } from "@/lib/ai-cost/types";

/**
 * Aviso permanente (região B) de que a configuração NÃO está ativa em produção
 * (D-23 / T-56.1-32). Não-dismissível e presente em todos os estados da tela.
 * Exportado para a página compor a região B antes das regiões C/D/E, mantendo
 * uma única instância e permitindo provar por teste sua permanência.
 */
export function ImageModelPairInactiveBanner() {
  return (
    <div className="rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-amber" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-heading text-sm font-semibold text-accent-amber">
            Esta configuração NÃO está ativa em produção.
          </p>
          <p className="text-sm text-text-secondary">
            Ela prepara o novo fluxo de imagem Produto 1:1. Nenhuma campanha usa estes modelos e o fluxo
            atual permanece inalterado.
          </p>
        </div>
      </div>
    </div>
  );
}

type Draft = {
  primaryModel: string;
  primaryQuality: string;
  fallbackModel: string;
  fallbackQuality: string;
  reason: string;
  operationId: string | null;
  operationFingerprint: string | null;
  loading: boolean;
  error: string | null;
  success: string | null;
};

const MISSING_REASON = "Motivo obrigatório";
const INVALID_PAIR = "Modelo ou qualidade fora do catálogo elegível";
const SAVE_ERROR =
  "Não foi possível salvar a configuração. Confira o motivo e se os modelos escolhidos pertencem ao catálogo elegível; tente novamente.";

const CONTROL_CLASS =
  "min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none transition-colors duration-200 placeholder:text-text-muted focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20";

const LABEL_CLASS = "text-xs font-semibold uppercase tracking-wider text-text-secondary";

function coverageLabel(coverage: ImagePairPricingCoverage): string {
  if (coverage === "complete") return "Completa";
  if (coverage === "partial") return "Parcial";
  return "Ausente";
}

function makeDraft(view: ImageModelPairConfigView): Draft {
  const primary = view.current?.primary ?? INITIAL_IMAGE_MODEL_PAIR.primary;
  const fallback = view.current?.fallback ?? INITIAL_IMAGE_MODEL_PAIR.fallback;
  return {
    primaryModel: primary.model,
    primaryQuality: primary.quality,
    fallbackModel: fallback.model,
    fallbackQuality: fallback.quality,
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
  if (
    lower.includes("catalog") ||
    lower.includes("quality") ||
    lower.includes("eligible") ||
    lower.includes("model_not_in")
  ) {
    return INVALID_PAIR;
  }
  if (lower.includes("reason")) return MISSING_REASON;
  return raw;
}

/**
 * Formulário cliente (região E) da configuração do par principal/fallback.
 * Restrito ao catálogo elegível, com motivo obrigatório, idempotência por
 * fingerprint (`operationId` estável até edição) e feedback auditável. A
 * cobertura de pricing incompleta é exibida como aviso âmbar que **não**
 * desabilita o salvamento (D-24).
 */
export function ImageModelPairConfigForm({ view }: { view: ImageModelPairConfigView }) {
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
    if (!draft.reason.trim()) {
      setDraft((previous) => ({ ...previous, error: MISSING_REASON, success: null }));
      return;
    }

    const body = {
      primaryModel: draft.primaryModel,
      primaryQuality: draft.primaryQuality,
      fallbackModel: draft.fallbackModel,
      fallbackQuality: draft.fallbackQuality,
      reason: draft.reason.trim(),
    };
    const fingerprint = JSON.stringify(["save", body]);
    const operationId =
      draft.operationFingerprint === fingerprint && draft.operationId
        ? draft.operationId
        : crypto.randomUUID();
    const requestBody = { ...body, operationId };

    setDraft((previous) => ({
      ...previous,
      operationId,
      operationFingerprint: fingerprint,
      loading: true,
      error: null,
      success: null,
    }));

    try {
      const response = await fetch("/api/admin/image-model-pair", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(saveErrorMessage(data.error));

      setDraft((previous) => ({
        ...previous,
        loading: false,
        operationId: null,
        operationFingerprint: null,
        reason: "",
        success: "Configuração salva com auditoria.",
      }));
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setDraft((previous) => ({
        ...previous,
        loading: false,
        error: error instanceof Error ? error.message : SAVE_ERROR,
      }));
    }
  }

  const coverage = view.pricing;
  const incomplete = coverage !== null && coverage.pricingCoverage !== "complete";
  const coverageWarningId = "pair-coverage-warning";
  const describedBy = incomplete ? coverageWarningId : undefined;

  return (
    <section aria-labelledby="pair-config-form-heading" className="space-y-4">
      <h2 id="pair-config-form-heading" className="font-heading text-lg font-semibold text-text-primary">
        Configuração do par
      </h2>

      {incomplete && coverage && (
        <div
          id={coverageWarningId}
          role="status"
          className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Cobertura de pricing {coverageLabel(coverage.pricingCoverage)}: faltam{" "}
            {coverage.missingComponents.join(", ")}. Você pode salvar, mas a execução exige cobertura
            completa para principal e fallback.
          </span>
        </div>
      )}

      <Card className="space-y-5 p-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <fieldset className="rounded-lg border border-border p-4">
            <legend className={`px-1 ${LABEL_CLASS}`}>Par principal</legend>
            <div className="grid gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pair-primary-model" className={LABEL_CLASS}>
                  Modelo
                </label>
                <select
                  id="pair-primary-model"
                  className={CONTROL_CLASS}
                  value={draft.primaryModel}
                  onChange={(event) => edit({ primaryModel: event.target.value })}
                >
                  {!view.eligibleModels.includes(draft.primaryModel) && (
                    <option disabled value={draft.primaryModel}>
                      {draft.primaryModel} (fora do catálogo)
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
                <label htmlFor="pair-primary-quality" className={LABEL_CLASS}>
                  Qualidade
                </label>
                <select
                  id="pair-primary-quality"
                  className={CONTROL_CLASS}
                  value={draft.primaryQuality}
                  onChange={(event) => edit({ primaryQuality: event.target.value })}
                >
                  {view.eligibleQualities.map((quality) => (
                    <option key={quality} value={quality}>
                      {quality}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-border p-4">
            <legend className={`px-1 ${LABEL_CLASS}`}>Par fallback</legend>
            <div className="grid gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pair-fallback-model" className={LABEL_CLASS}>
                  Modelo
                </label>
                <select
                  id="pair-fallback-model"
                  className={CONTROL_CLASS}
                  value={draft.fallbackModel}
                  onChange={(event) => edit({ fallbackModel: event.target.value })}
                >
                  {!view.eligibleModels.includes(draft.fallbackModel) && (
                    <option disabled value={draft.fallbackModel}>
                      {draft.fallbackModel} (fora do catálogo)
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
                <label htmlFor="pair-fallback-quality" className={LABEL_CLASS}>
                  Qualidade
                </label>
                <select
                  id="pair-fallback-quality"
                  className={CONTROL_CLASS}
                  value={draft.fallbackQuality}
                  onChange={(event) => edit({ fallbackQuality: event.target.value })}
                >
                  {view.eligibleQualities.map((quality) => (
                    <option key={quality} value={quality}>
                      {quality}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pair-reason" className={LABEL_CLASS}>
            Motivo da alteração
          </label>
          <textarea
            id="pair-reason"
            className={`${CONTROL_CLASS} py-2`}
            value={draft.reason}
            placeholder="Motivo obrigatório para auditoria"
            aria-describedby={describedBy}
            onChange={(event) => edit({ reason: event.target.value })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" loading={draft.loading} onClick={save} aria-describedby={describedBy}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {draft.loading ? "Salvando..." : "Salvar configuração"}
          </Button>
        </div>

        {draft.error && (
          <p className="text-xs text-accent-red" role="alert">
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
