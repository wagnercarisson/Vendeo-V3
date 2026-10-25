"use client";

import { useState } from "react";
import { AlertTriangle, Check, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VisualSignatureAdminConfigView } from "@/lib/visual-signature/admin-config-view";

/**
 * Card dedicado da capacidade `visual_signature_image`.
 *
 * A "Configuração vigente" é SEMPRE o último estado confirmado pelo servidor
 * (view discriminada dedicated/legacy/error). O formulário abaixo é apenas um
 * rascunho: alterá-lo NÃO muda a vigente. A vigente só é promovida quando a
 * resposta do endpoint confirma por releitura (`confirmed: true`). Falha de
 * leitura é exibida como erro explícito — nunca como ausência/legado.
 *
 * Save chama SOMENTE o endpoint dedicado com
 * `{ orchestratorModel, imageModel, imageQuality, reason, operationId }`;
 * reset envia `{ expectedConfigVersionId, reason, operationId }`. Nenhum
 * recarregamento de página.
 */

type OrchestratorSource = "selection" | "default";

interface VisualSignatureModelCardProps {
  view: VisualSignatureAdminConfigView;
  inheritedOrchestratorModel: string;
  inheritedOrchestratorSource: OrchestratorSource;
}

type Draft = {
  orchestratorModel: string;
  imageModel: string;
  imageQuality: string;
  reason: string;
  operationId: string | null;
  operationFingerprint: string | null;
  loading: boolean;
  error: string | null;
  success: string | null;
};

const ORCHESTRATOR_LABELS: Record<string, string> = {
  "gpt-5.5": "GPT-5.5",
  "gpt-6-luna": "GPT-6-Luna",
};

const IMAGE_MODEL_LABELS: Record<string, string> = {
  "gpt-image-2.5-flare": "Flare",
  "gpt-image-2.5-sunburst": "Sunburst",
};

const QUALITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
};

const ORCHESTRATOR_OPTIONS = ["gpt-5.5", "gpt-6-luna"] as const;
const IMAGE_MODEL_OPTIONS = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"] as const;
const QUALITY_OPTIONS = ["low", "medium"] as const;

const DEFAULT_DRAFT = {
  orchestratorModel: "gpt-5.5",
  imageModel: "gpt-image-2.5-flare",
  imageQuality: "low",
} as const;

const SAVE_UNCONFIRMED =
  "Salvo, mas não foi possível confirmar a exibição. Recarregue a página.";
const RESET_UNCONFIRMED =
  "Removido, mas não foi possível confirmar a exibição. Recarregue a página.";
const MISSING_REASON = "Motivo obrigatório";
const READ_ERROR =
  "Não foi possível ler a configuração dedicada. O estado atual não é exibido como ausência.";

const SAFE_ERRORS: Record<string, string> = {
  invalid_orchestrator: "Modelo de orquestrador inválido.",
  invalid_image_model: "Modelo de imagem inválido.",
  invalid_image_quality: "Qualidade de imagem inválida.",
  invalid_preset_tuple: "Combinação de modelo e qualidade inválida.",
  operation_id_conflict: "Esta operação já foi aplicada com outro conteúdo.",
  environment_unresolved: "Ambiente administrativo não pôde ser resolvido.",
  config_version_mismatch:
    "A configuração mudou desde o carregamento. Recarregue a página e tente novamente.",
  config_missing: "Não há configuração dedicada vigente para remover.",
  instance_identity_mismatch:
    "O ambiente mudou desde o carregamento. Recarregue a página e tente novamente.",
  deactivate_required:
    "A configuração está ativa em um fluxo de liberação e não pode ser removida por esta tela.",
  missing_config_version_id: "Versão da configuração ausente. Recarregue a página.",
  invalid_rpc_response: "O servidor não confirmou a operação. Tente novamente.",
  unexpected_error: "Não foi possível concluir a operação.",
  "Dados inválidos": "Dados inválidos. Confira os campos e tente novamente.",
  "Corpo da requisição inválido":
    "Requisição inválida. Recarregue a página e tente novamente.",
};

const CONTROL_CLASS =
  "min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none transition-colors duration-200 placeholder:text-text-muted focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20";
const LABEL_CLASS =
  "block text-xs font-medium uppercase tracking-wider text-text-secondary";

function orchestratorLabel(value: string): string {
  return ORCHESTRATOR_LABELS[value] ?? value;
}
function imageModelLabel(value: string): string {
  return IMAGE_MODEL_LABELS[value] ?? value;
}
function qualityLabel(value: string): string {
  return QUALITY_LABELS[value] ?? value;
}

function draftFieldsFromView(
  view: VisualSignatureAdminConfigView,
  inheritedOrchestratorModel: string,
): Pick<Draft, "orchestratorModel" | "imageModel" | "imageQuality"> {
  if (view.status === "dedicated") {
    return {
      orchestratorModel: view.config.orchestratorModel,
      imageModel: view.config.imageModel,
      imageQuality: view.config.imageQuality,
    };
  }
  return {
    orchestratorModel: ORCHESTRATOR_OPTIONS.includes(
      inheritedOrchestratorModel as (typeof ORCHESTRATOR_OPTIONS)[number],
    )
      ? inheritedOrchestratorModel
      : DEFAULT_DRAFT.orchestratorModel,
    imageModel: DEFAULT_DRAFT.imageModel,
    imageQuality: DEFAULT_DRAFT.imageQuality,
  };
}

function makeDraft(
  view: VisualSignatureAdminConfigView,
  inheritedOrchestratorModel: string,
): Draft {
  return {
    ...draftFieldsFromView(view, inheritedOrchestratorModel),
    reason: "",
    operationId: null,
    operationFingerprint: null,
    loading: false,
    error: null,
    success: null,
  };
}

function safeErrorMessage(code: unknown): string {
  if (typeof code === "string" && SAFE_ERRORS[code]) return SAFE_ERRORS[code];
  return SAFE_ERRORS.unexpected_error;
}

export function VisualSignatureModelCard({
  view,
  inheritedOrchestratorModel,
  inheritedOrchestratorSource,
}: VisualSignatureModelCardProps) {
  const [currentView, setCurrentView] = useState<VisualSignatureAdminConfigView>(view);
  const [draft, setDraft] = useState<Draft>(() =>
    makeDraft(view, inheritedOrchestratorModel),
  );
  const [unconfirmed, setUnconfirmed] = useState<"save" | "reset" | null>(null);

  function edit(update: Partial<Draft>) {
    setDraft((previous) => ({
      ...previous,
      ...update,
      operationId: null,
      operationFingerprint: null,
      success: null,
      error: null,
    }));
    setUnconfirmed(null);
  }

  function operationIdFor(action: "save" | "reset", body: Record<string, unknown>): string {
    const fingerprint = JSON.stringify([action, body]);
    return draft.operationFingerprint === fingerprint && draft.operationId
      ? draft.operationId
      : crypto.randomUUID();
  }

  async function save() {
    if (!draft.reason.trim()) {
      setDraft((previous) => ({ ...previous, error: MISSING_REASON, success: null }));
      return;
    }

    const body = {
      orchestratorModel: draft.orchestratorModel,
      imageModel: draft.imageModel,
      imageQuality: draft.imageQuality,
      reason: draft.reason.trim(),
    };
    const operationId = operationIdFor("save", body);
    setDraft((previous) => ({
      ...previous,
      operationId,
      operationFingerprint: JSON.stringify(["save", body]),
      loading: true,
      error: null,
      success: null,
    }));
    setUnconfirmed(null);

    try {
      const response = await fetch("/api/admin/visual-signature-model-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, operationId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        confirmed?: boolean;
        view?: VisualSignatureAdminConfigView;
        warning?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(safeErrorMessage(data.error));

      if (data.confirmed === true && data.view) {
        setCurrentView(data.view);
        setDraft((previous) => ({
          ...previous,
          ...draftFieldsFromView(data.view!, inheritedOrchestratorModel),
          reason: "",
          operationId: null,
          operationFingerprint: null,
          loading: false,
          error: null,
          success: "Configuração salva e confirmada.",
        }));
        setUnconfirmed(null);
        return;
      }

      setDraft((previous) => ({
        ...previous,
        loading: false,
        error: null,
        success: null,
      }));
      setUnconfirmed("save");
    } catch (error) {
      setDraft((previous) => ({
        ...previous,
        loading: false,
        error: error instanceof Error ? error.message : SAFE_ERRORS.unexpected_error,
      }));
    }
  }

  async function reset() {
    if (currentView.status !== "dedicated") return;
    if (!draft.reason.trim()) {
      setDraft((previous) => ({ ...previous, error: MISSING_REASON, success: null }));
      return;
    }

    const body = {
      expectedConfigVersionId: currentView.config.configVersionId,
      reason: draft.reason.trim(),
    };
    const operationId = operationIdFor("reset", body);
    setDraft((previous) => ({
      ...previous,
      operationId,
      operationFingerprint: JSON.stringify(["reset", body]),
      loading: true,
      error: null,
      success: null,
    }));
    setUnconfirmed(null);

    try {
      const response = await fetch("/api/admin/visual-signature-model-config", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, operationId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        confirmed?: boolean;
        view?: VisualSignatureAdminConfigView;
        warning?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(safeErrorMessage(data.error));

      if (data.confirmed === true && data.view?.status === "legacy") {
        setCurrentView({ status: "legacy" });
        setDraft((previous) => ({
          ...previous,
          ...draftFieldsFromView({ status: "legacy" }, inheritedOrchestratorModel),
          reason: "",
          operationId: null,
          operationFingerprint: null,
          loading: false,
          error: null,
          success: "Configuração dedicada removida e confirmada.",
        }));
        setUnconfirmed(null);
        return;
      }

      setDraft((previous) => ({
        ...previous,
        loading: false,
        error: null,
        success: null,
      }));
      setUnconfirmed("reset");
    } catch (error) {
      setDraft((previous) => ({
        ...previous,
        loading: false,
        error: error instanceof Error ? error.message : SAFE_ERRORS.unexpected_error,
      }));
    }
  }

  const resetDisabled =
    currentView.status !== "dedicated" || unconfirmed !== null || draft.loading;

  return (
    <article className="rounded-xl border border-border bg-bg-surface p-5 transition-colors duration-200 hover:border-border-light">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-sm font-semibold text-text-primary">
            visual_signature_image
          </h3>
          <p className="mt-1 text-xs text-text-muted">Assinatura Visual</p>
        </div>
      </div>

      <section
        aria-label="Configuração vigente"
        className="mt-4 space-y-3 rounded-lg border border-border bg-bg-deep/40 p-3"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Configuração vigente
        </p>

        {currentView.status === "dedicated" && (
          <dl className="space-y-2 text-sm text-text-primary">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-secondary">Orquestrador</dt>
              <dd>
                <span title={currentView.config.orchestratorModel}>
                  {orchestratorLabel(currentView.config.orchestratorModel)}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-secondary">Imagem</dt>
              <dd>
                <span title={currentView.config.imageModel}>
                  {imageModelLabel(currentView.config.imageModel)}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-secondary">Qualidade</dt>
              <dd>
                <span title={currentView.config.imageQuality}>
                  {qualityLabel(currentView.config.imageQuality)}
                </span>
              </dd>
            </div>
          </dl>
        )}

        {currentView.status === "legacy" && (
          <dl className="space-y-2 text-sm text-text-primary">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-secondary">Orquestrador</dt>
              <dd>
                <span title={inheritedOrchestratorModel}>
                  {orchestratorLabel(inheritedOrchestratorModel)}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-secondary">Origem do orquestrador</dt>
              <dd className="text-xs text-text-secondary">
                {inheritedOrchestratorSource === "selection"
                  ? "Seleção persistida"
                  : "Default do sistema"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-secondary">Imagem</dt>
              <dd>Padrão da API</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-secondary">Qualidade</dt>
              <dd>auto</dd>
            </div>
          </dl>
        )}

        {currentView.status === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-accent-red/30 bg-accent-red/5 p-3 text-xs text-accent-red">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span role="alert">{READ_ERROR}</span>
          </div>
        )}

        {unconfirmed !== null && (
          <div className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span role="status">{unconfirmed === "save" ? SAVE_UNCONFIRMED : RESET_UNCONFIRMED}</span>
          </div>
        )}
      </section>

      <div className="mt-4 space-y-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="visual-signature-orchestrator">
            Orquestrador
          </label>
          <select
            id="visual-signature-orchestrator"
            className={CONTROL_CLASS}
            value={draft.orchestratorModel}
            onChange={(event) => edit({ orchestratorModel: event.target.value })}
          >
            {ORCHESTRATOR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {orchestratorLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="visual-signature-image-model">
            Modelo de imagem
          </label>
          <select
            id="visual-signature-image-model"
            className={CONTROL_CLASS}
            value={draft.imageModel}
            onChange={(event) => edit({ imageModel: event.target.value })}
          >
            {IMAGE_MODEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {imageModelLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="visual-signature-image-quality">
            Qualidade
          </label>
          <select
            id="visual-signature-image-quality"
            className={CONTROL_CLASS}
            value={draft.imageQuality}
            onChange={(event) => edit({ imageQuality: event.target.value })}
          >
            {QUALITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {qualityLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="visual-signature-reason">
            Motivo da alteração
          </label>
          <input
            id="visual-signature-reason"
            className={CONTROL_CLASS}
            value={draft.reason}
            placeholder="Motivo obrigatório para auditoria"
            onChange={(event) => edit({ reason: event.target.value })}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" loading={draft.loading} onClick={save}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Salvar conjunto
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={resetDisabled}
          onClick={reset}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Remover configuração dedicada
        </Button>
      </div>

      {draft.error && (
        <p className="mt-3 text-xs text-accent-red" role="alert">
          {draft.error}
        </p>
      )}
      {draft.success && (
        <p className="mt-3 flex items-center gap-1 text-xs text-accent-green" role="status">
          <Check className="h-4 w-4" aria-hidden="true" />
          {draft.success}
        </p>
      )}
    </article>
  );
}

export type { VisualSignatureModelCardProps };
