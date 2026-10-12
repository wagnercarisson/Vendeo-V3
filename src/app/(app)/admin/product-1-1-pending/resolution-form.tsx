"use client";

import { useState } from "react";
import { AlertTriangle, Check, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * F56.2b1b (Plano 07, Superfície 4 / UI-SPEC) — superfície CLIENT de lista e
 * resolução administrativa de pendências do Produto 1:1.
 *
 * Este módulo é um CLIENT component: NÃO importa nenhum módulo
 * `@/lib/product-1-1/**` (os tipos do view model são declarados localmente e
 * chegam por props). O gate de evidência é fail-closed no cliente E no servidor;
 * a evidência EXIBIDA é derivada SERVER-SIDE (F5) — o servidor é a autoridade.
 *
 * A lista é SOMENTE uma lista: NENHUMA geração é reiniciada, reenfileirada ou
 * enviada automaticamente ao provedor. O único afeto é a resolução por evidência
 * (entregar arte existente ou estornar uma vez). E1/D13: um claim `in_progress`
 * residual ("Processando") e a evidência indeterminada ("Não foi possível
 * confirmar o estado") BLOQUEIAM a resolução — sem promessa de continuidade/
 * retomada ("continuaremos"/"retomaremos"/"Gerar novamente" são PROIBIDOS).
 */

export type PendingArtifactKind = "integral" | "absent" | "invalid" | "indeterminate";
export type PendingResolutionAction = "deliver_existing_art" | "refund_once";

export interface PendingOperationItem {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly status: string;
  readonly amount: number;
  readonly artifactKind: PendingArtifactKind;
  readonly processing: boolean;
  readonly unknown: boolean;
  readonly terminal: boolean;
  readonly supportReference: string | null;
  readonly createdAt: string | null;
  readonly latestAttemptAt: string | null;
}

const CONTROL_CLASS =
  "min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none transition-colors duration-200 placeholder:text-text-muted focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20";

const LABEL_CLASS = "text-xs font-semibold uppercase tracking-wider text-text-secondary";

const MISSING_REASON = "Motivo obrigatório";
const SAVE_ERROR =
  "Não foi possível registrar a resolução. Confira o motivo e as evidências; tente novamente.";

function statusLabel(status: string): string {
  if (status === "reserved") return "Reservado";
  if (status === "art_uploaded") return "Arte enviada (não entregue)";
  if (status === "delivered") return "Entregue";
  if (status === "refunded") return "Estornado";
  return status;
}

function artifactLabel(kind: PendingArtifactKind): string {
  if (kind === "integral") return "Arte íntegra disponível";
  if (kind === "absent") return "Arte ausente (confirmada)";
  if (kind === "invalid") return "Arte presente e inválida";
  return "Não foi possível verificar a arte";
}

/**
 * IN-08: rótulo do crédito DERIVADO do estado. "Reserva temporária" só descreve
 * uma operação ainda NÃO liquidada; um estado terminal (`delivered`/`refunded`)
 * não é uma reserva temporária (wording enganoso em linha terminal).
 */
function creditReservationLabel(item: PendingOperationItem): string {
  if (item.status === "delivered") return "Crédito consumido";
  if (item.status === "refunded") return "Crédito estornado";
  if (item.terminal) return "Operação encerrada";
  return "Reserva temporária";
}

/** WR-01: chave estável de UMA pendência (seleção da lista + remount do form). */
export function pendingItemKey(item: PendingOperationItem): string {
  return `${item.campaignId}:${item.operationId}`;
}

/**
 * Distingue os estados bloqueados (E1/D13) sem prometer continuidade:
 * - "Processando": operação ativa/claim `in_progress` sem evidência de encerramento.
 * - "Não foi possível confirmar o estado": evidência indeterminada/desconhecida.
 */
export function pendingStateLabel(item: PendingOperationItem): string | null {
  if (item.processing && !item.terminal) return "Processando";
  if (item.artifactKind === "indeterminate" || item.unknown) {
    return "Não foi possível confirmar o estado";
  }
  return null;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("pt-BR");
}

/** Aviso permanente (região B) — a lista NUNCA executa nada. */
export function PendingReadOnlyNotice() {
  return (
    <div className="rounded-xl border border-accent-blue/20 bg-accent-blue/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent-blue" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-heading text-sm font-semibold text-text-primary">
            Somente para consulta e resolução por evidência.
          </p>
          <p className="text-sm text-text-secondary">
            Nenhuma geração é reiniciada, reenfileirada ou enviada automaticamente ao provedor.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Lista das pendências (uma linha por operação; selecionável quando `onSelect`). */
export function PendingOperationsList({
  operations,
  selectedKey,
  onSelect,
}: {
  operations: PendingOperationItem[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}) {
  if (operations.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Nenhuma pendência de geração"
          description="Não há gerações aguardando resolução por evidência."
        />
      </Card>
    );
  }

  return (
    <div className="grid max-w-5xl gap-4">
      {operations.map((item) => {
        const blocked = pendingStateLabel(item);
        const key = pendingItemKey(item);
        const isSelected = selectedKey === key;
        return (
          <Card
            key={key}
            className={`space-y-3 p-5${isSelected ? " ring-2 ring-accent-blue" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="font-mono text-xs text-text-primary">{item.campaignId}</code>
              <Badge variant={item.terminal ? "ready" : "generating"}>
                {statusLabel(item.status)}
              </Badge>
            </div>
            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-wider text-text-muted">Crédito</dt>
                <dd className="mt-1 text-text-secondary">
                  {creditReservationLabel(item)} · {item.amount}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-text-muted">Arte</dt>
                <dd className="mt-1 text-text-secondary">{artifactLabel(item.artifactKind)}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-text-muted">
                  Referência de suporte
                </dt>
                <dd className="mt-1 font-mono text-text-secondary">
                  {item.supportReference ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-text-muted">
                  Criado em
                </dt>
                <dd className="mt-1 text-text-secondary">{formatTimestamp(item.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-text-muted">
                  Última tentativa
                </dt>
                <dd className="mt-1 text-text-secondary">
                  {formatTimestamp(item.latestAttemptAt)}
                </dd>
              </div>
            </dl>
            {blocked && (
              <p className="flex items-center gap-1 text-xs text-accent-amber">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {blocked}
              </p>
            )}
            {onSelect && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant={isSelected ? "secondary" : "ghost"}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(key)}
                >
                  {isSelected ? "Selecionada para resolução" : "Selecionar para resolver"}
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/**
 * WR-01 — painel de resolução com SELEÇÃO: lista TODAS as pendências
 * (selecionáveis) e resolve a SELECIONADA. Qualquer pendência pode ser resolvida,
 * não apenas a primeira. O `key` do formulário é a identidade da operação, então
 * trocar a seleção reinicializa o rascunho.
 */
export function PendingResolutionPanel({
  operations,
}: {
  operations: PendingOperationItem[];
}) {
  const [selectedKey, setSelectedKey] = useState<string>(() =>
    operations.length > 0 ? pendingItemKey(operations[0]) : "",
  );
  const selected =
    operations.find((item) => pendingItemKey(item) === selectedKey) ?? operations[0] ?? null;
  if (!selected) return null;

  return (
    <div className="space-y-6">
      <PendingOperationsList
        operations={operations}
        selectedKey={pendingItemKey(selected)}
        onSelect={setSelectedKey}
      />
      <ResolutionForm key={pendingItemKey(selected)} item={selected} />
    </div>
  );
}

type Draft = {
  action: PendingResolutionAction | "";
  reason: string;
  operationId: string | null;
  fingerprint: string | null;
  confirming: boolean;
  loading: boolean;
  error: string | null;
  success: string | null;
};

function enabledActions(item: PendingOperationItem): {
  deliver: boolean;
  refund: boolean;
} {
  const resolvable = !item.processing && !item.terminal;
  return {
    deliver: resolvable && item.artifactKind === "integral",
    refund: resolvable && item.artifactKind === "absent",
  };
}

/** Painel de resolução (client) de UMA pendência. Gate de evidência fail-closed. */
export function ResolutionForm({ item }: { item: PendingOperationItem }) {
  const enabled = enabledActions(item);
  const defaultAction: PendingResolutionAction | "" = enabled.deliver
    ? "deliver_existing_art"
    : enabled.refund
      ? "refund_once"
      : "";

  const [draft, setDraft] = useState<Draft>({
    action: defaultAction,
    reason: "",
    operationId: null,
    fingerprint: null,
    confirming: false,
    loading: false,
    error: null,
    success: null,
  });

  const blocked = pendingStateLabel(item);
  const canSubmit = Boolean(draft.action) && !blocked && !draft.loading;

  function edit(update: Partial<Draft>) {
    setDraft((previous) => ({
      ...previous,
      ...update,
      operationId: null,
      fingerprint: null,
      confirming: false,
      success: null,
      error: null,
    }));
  }

  async function submit() {
    if (!draft.reason.trim()) {
      setDraft((previous) => ({ ...previous, error: MISSING_REASON, success: null }));
      return;
    }
    if (!draft.action) return;

    const body = {
      campaignId: item.campaignId,
      operationId: item.operationId,
      action: draft.action,
      reason: draft.reason.trim(),
    };
    const fingerprint = JSON.stringify(["resolve", body]);
    const resolutionOperationId =
      draft.fingerprint === fingerprint && draft.operationId
        ? draft.operationId
        : crypto.randomUUID();

    setDraft((previous) => ({
      ...previous,
      operationId: resolutionOperationId,
      fingerprint,
      confirming: false,
      loading: true,
      error: null,
      success: null,
    }));

    try {
      const response = await fetch("/api/admin/product-1-1-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, resolutionOperationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error?.message === "string" ? data.error.message : SAVE_ERROR);
      }
      setDraft((previous) => ({
        ...previous,
        loading: false,
        operationId: null,
        fingerprint: null,
        reason: "",
        success: "Resolução registrada com auditoria.",
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

  function onResolveClick() {
    if (!draft.reason.trim()) {
      setDraft((previous) => ({ ...previous, error: MISSING_REASON, success: null }));
      return;
    }
    if (!draft.action) return;
    if (draft.action === "refund_once") {
      setDraft((previous) => ({ ...previous, confirming: true, error: null }));
      return;
    }
    void submit();
  }

  return (
    <section aria-labelledby="pending-resolution-heading" className="max-w-5xl space-y-4">
      <h2
        id="pending-resolution-heading"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Resolução da pendência
      </h2>

      {blocked && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{blocked}</span>
        </div>
      )}

      <Card className="space-y-5 p-6">
        <fieldset className="rounded-lg border border-border p-4">
          <legend className={`px-1 ${LABEL_CLASS}`}>Evidência (verificada no servidor)</legend>
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-semibold uppercase tracking-wider text-text-muted">
                Arte existente?
              </dt>
              <dd className="mt-1 text-text-secondary">{artifactLabel(item.artifactKind)}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wider text-text-muted">
                Execução encerrada?
              </dt>
              <dd className="mt-1 text-text-secondary">
                {item.processing ? "Não — execução em andamento" : "Sim"}
              </dd>
            </div>
          </dl>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="resolution-action" className={LABEL_CLASS}>
            Ação
          </label>
          <select
            id="resolution-action"
            className={CONTROL_CLASS}
            value={draft.action}
            onChange={(event) =>
              edit({ action: event.target.value as PendingResolutionAction | "" })
            }
          >
            <option value="" disabled>
              Selecione uma ação
            </option>
            <option value="deliver_existing_art" disabled={!enabled.deliver}>
              Entregar arte existente
            </option>
            <option value="refund_once" disabled={!enabled.refund}>
              Estornar uma vez
            </option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="resolution-reason" className={LABEL_CLASS}>
            Motivo da resolução
          </label>
          <textarea
            id="resolution-reason"
            className={`${CONTROL_CLASS} py-2`}
            value={draft.reason}
            placeholder="Motivo obrigatório para auditoria"
            onChange={(event) => edit({ reason: event.target.value })}
          />
        </div>

        {!enabled.deliver && item.artifactKind !== "integral" && (
          <p className="text-xs text-text-secondary">
            Não há arte íntegra para entregar nesta operação.
          </p>
        )}
        {!enabled.refund && item.artifactKind !== "absent" && !item.processing && (
          <p className="text-xs text-text-secondary">
            Confirme a ausência de arte e o encerramento da execução antes de estornar.
          </p>
        )}

        {draft.confirming ? (
          <div
            role="dialog"
            aria-label="Estornar esta operação?"
            className="space-y-3 rounded-lg border border-accent-red/30 bg-accent-red/5 p-4"
          >
            <p className="font-heading text-sm font-semibold text-text-primary">
              Estornar esta operação?
            </p>
            <p className="text-xs text-text-secondary">
              Esta ação devolve o crédito reservado uma única vez e não pode ser desfeita.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" loading={draft.loading} onClick={submit}>
                Estornar
              </Button>
              <Button type="button" variant="ghost" onClick={() => edit({ confirming: false })}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" loading={draft.loading} disabled={!canSubmit} onClick={onResolveClick}>
              Resolver pendência
            </Button>
          </div>
        )}

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
