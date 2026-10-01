"use client";

import { AlertCircle, CheckCircle2, Loader2, PenLine, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  BenchIdentityReference,
  BenchTextIntegrityAlert,
  BenchTextIntegrityEvidence,
} from "@/lib/lab/bench/domain/schemas";

import { LabTextarea } from "../../_components/lab-textarea";

/**
 * Painel de **preflight** do prompt da bancada (F48.2.3, D17; spec
 * `lab-bench-prompt-preflight` + `lab-admin-ui`).
 *
 * Etapa explícita anterior à geração: "Compor prompt" → prompt compilado visível
 * (blocos canônicos) → edição manual → **"Aprovar prompt"**. Somente após a
 * aprovação o caminho de estimativa/confirmação é habilitado (no painel de
 * execução). A **confirmação financeira** permanece um passo **separado** da
 * aprovação do prompt.
 *
 * Componente **presentacional**: o contêiner (`BenchWorkbench`) é o dono do
 * estado e da invalidação centralizada (`invalidatePreflight`). Este painel
 * apenas exibe e delega as ações.
 */

export type BenchPreflightStatus =
  | "idle"
  | "composed"
  | "edited"
  | "approved"
  | "invalidated";

/**
 * Evidência do preflight aprovada — alinhada ao `BenchPreflightEvidenceSchema`
 * **estrito** (F48.2.4, D11/D14). Além dos campos legados, carrega as versões das
 * políticas, a versão do prompt-base padrão e a referência canônica da identidade
 * (sem URL assinada) — capturados no momento da aprovação — de modo que
 * `POST /runs` não responda 400 por campo ausente.
 *
 * **Correção de UAT (separação aprovação e execução):** a evidência **não** carrega
 * `presetId` nem a configuração de execução (`modelo`/`qualidade`) — eles não
 * participam da composição textual e são enviados separadamente em `POST /runs`
 * como configuração de execução. Trocar de preset/modelo/qualidade reutiliza o
 * mesmo prompt aprovado byte a byte.
 */
export interface BenchPreflightEvidenceView {
  promptBase: string;
  promptCompiled: string;
  promptApproved: string;
  promptBlocks: Record<string, string>;
  composerVersion: string;
  textIntegrityEvidence: BenchTextIntegrityEvidence;
  policyVersions?: Record<string, string>;
  promptBaseVersion?: string;
  identityReference?: BenchIdentityReference | null;
}

export interface BenchTextIntegrityReviewView {
  policyVersion: string;
  reviewRevision: string;
  alerts: BenchTextIntegrityAlert[];
  stale: boolean;
}

interface BenchPreflightPanelProps {
  status: BenchPreflightStatus;
  compiledPrompt: string;
  finalPrompt: string;
  composerVersion: string;
  composing: boolean;
  error: string | null;
  disabled?: boolean;
  /** Versões das políticas resolvidas (exibidas junto ao prompt compilado). */
  policyVersions?: Record<string, string>;
  /** Versão do prompt-base padrão (exibida junto ao prompt compilado). */
  promptBaseVersion?: string;
  onCompose: () => void;
  onEditFinal: (value: string) => void;
  onApprove: () => void;
  textIntegrityReview?: BenchTextIntegrityReviewView | null;
  onKeepExactly?: () => void;
}

const STATUS_LABELS: Record<BenchPreflightStatus, string> = {
  idle: "Prompt não composto",
  composed: "Prompt composto",
  edited: "Prompt editado",
  approved: "Prompt aprovado",
  invalidated: "Prompt invalidado — recomponha e aprove",
};

export function BenchPreflightPanel({
  status,
  compiledPrompt,
  finalPrompt,
  composerVersion,
  composing,
  error,
  disabled = false,
  policyVersions,
  promptBaseVersion,
  onCompose,
  onEditFinal,
  onApprove,
  textIntegrityReview = null,
  onKeepExactly,
}: BenchPreflightPanelProps) {
  const showCompiled = status === "composed" || status === "edited" || status === "approved";
  const canApprove =
    (status === "composed" || status === "edited") && finalPrompt.trim().length > 0;
  const invalidated = status === "invalidated";
  const policyVersionsText =
    policyVersions && Object.keys(policyVersions).length > 0
      ? Object.entries(policyVersions)
          .map(([dimension, version]) => `${dimension}:${version}`)
          .join(" · ")
      : "—";

  return (
    <section
      data-testid="bench-preflight-panel"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-preflight-title"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="bench-preflight-title"
          className="font-heading text-lg font-semibold text-text-primary"
        >
          Prompt compilado
        </h2>
        {composerVersion ? (
          <span className="font-mono text-xs text-text-muted">{composerVersion}</span>
        ) : null}
      </div>

      <p
        data-testid="bench-preflight-status"
        className={`flex items-center gap-2 text-sm font-body ${
          status === "approved"
            ? "text-accent-green"
            : invalidated
              ? "text-accent-amber"
              : "text-text-secondary"
        }`}
      >
        {status === "approved" ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : invalidated ? (
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        ) : (
          <PenLine className="h-4 w-4" aria-hidden="true" />
        )}
        {STATUS_LABELS[status]}
      </p>

      {textIntegrityReview && (
        <section
          role="alert"
          data-testid="bench-text-integrity-review"
          className="space-y-3 rounded-lg border border-accent-amber/50 bg-accent-amber/10 p-4"
          aria-labelledby="bench-text-integrity-review-title"
        >
          <div>
            <h3
              id="bench-text-integrity-review-title"
              className="font-heading text-sm font-semibold text-text-primary"
            >
              {textIntegrityReview.stale
                ? "Revisão textual desatualizada"
                : "Revise os textos destacados"}
            </h3>
            <p className="mt-1 text-xs text-text-secondary font-body">
              São sugestões de possíveis problemas; o sistema não corrige nem altera seus textos.
              Edite os campos e recomponha, ou mantenha exatamente esta revisão.
            </p>
          </div>
          {textIntegrityReview.alerts.length > 0 ? (
            <ul className="space-y-2">
              {textIntegrityReview.alerts.map((alert, index) => (
                <li
                  key={`${alert.field}:${alert.ruleId}:${index}`}
                  data-testid="bench-text-integrity-alert"
                  className="rounded-md border border-border bg-bg-elevated p-3"
                >
                  <p className="text-xs font-semibold text-text-primary font-heading">
                    {alert.field} · {alert.ruleId}
                  </p>
                  <p className="mt-1 break-words font-mono text-xs text-text-secondary">
                    {alert.excerpt}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary font-body">{alert.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-secondary font-body">
              Nenhum alerta está ativo. Recompose para emitir uma revisão atual.
            </p>
          )}
          {textIntegrityReview.alerts.length > 0 && onKeepExactly ? (
            <Button
              type="button"
              variant="secondary"
              data-testid="bench-keep-text-exactly-button"
              onClick={onKeepExactly}
              disabled={disabled || composing}
            >
              Manter exatamente como informado
            </Button>
          ) : null}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          data-testid="bench-compose-button"
          onClick={onCompose}
          disabled={disabled}
          loading={composing}
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          Compor prompt
        </Button>
        <Button
          type="button"
          data-testid="bench-approve-button"
          onClick={onApprove}
          disabled={disabled || !canApprove}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Aprovar prompt
        </Button>
      </div>

      <dl
        data-testid="bench-preflight-versions"
        className="grid gap-3 rounded-lg border border-border bg-bg-deep/40 p-3 sm:grid-cols-3"
      >
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
            Versão do compositor
          </dt>
          <dd className="break-words font-mono text-xs text-text-primary">
            {composerVersion || "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
            Prompt-base padrão
          </dt>
          <dd className="break-words font-mono text-xs text-text-primary">
            {promptBaseVersion || "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
            Versões das políticas
          </dt>
          <dd className="break-words font-mono text-xs text-text-primary">
            {policyVersionsText}
          </dd>
        </div>
      </dl>

      {showCompiled && (
        <LabTextarea
          label="Prompt compilado"
          value={finalPrompt}
          rows={12}
          disabled={disabled || composing}
          hint="Revise e edite o prompt final. A aprovação é explícita e a geração envia exatamente este texto."
          onChange={(event) => onEditFinal(event.target.value)}
        />
      )}

      {!showCompiled && compiledPrompt.length > 0 ? (
        <LabTextarea
          label="Prompt compilado"
          value={compiledPrompt}
          rows={12}
          disabled
          onChange={() => {}}
        />
      ) : null}

      {composing && (
        <p className="flex items-center gap-2 text-sm text-text-secondary font-body">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Compondo o prompt…
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-center gap-1 text-sm text-accent-red font-body"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  );
}
