"use client";

import { useState } from "react";
import { AlertTriangle, Check, RotateCcw, Save, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  VisualSignatureConfigViewRow,
  VisualSignatureModelConfigView,
  VisualSignaturePresetPricingView,
} from "@/lib/ai/visual-signature-model-config-view";
import type {
  VisualSignatureImagePreset,
  VisualSignatureOrchestrator,
} from "@/lib/ai/visual-signature-model-config";

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("pt-BR");
}

function originLabel(origin: VisualSignatureModelConfigView["inherited"]["origin"]): string {
  if (origin === "human_decision") return "Decisão humana";
  if (origin === "selection") return "Seleção";
  return "Default do sistema";
}

function diagnosticLabel(
  diagnostic: VisualSignatureModelConfigView["diagnostic"],
  environment?: string,
): string {
  if (diagnostic.status === "dedicated_valid") {
    return `em uso no ambiente ${environment ?? "configurado"}`;
  }
  if (diagnostic.status === "inherited_opt_in_disabled") {
    return "seleção herdada — opt-in desligado";
  }
  if (diagnostic.status === "inherited_absent") {
    return "seleção herdada — ausência confirmada";
  }
  if (diagnostic.status === "inherited_not_published") {
    return "seleção herdada — configuração não publicada";
  }
  if (diagnostic.status === "inherited_not_activated") {
    return "seleção herdada — configuração não ativada";
  }
  if (diagnostic.status === "inherited_outside_pilot") {
    return "seleção herdada — loja fora do piloto";
  }
  if (diagnostic.reason === "guard") return "geração bloqueada — guard local";
  if (diagnostic.reason === "identity") return "geração bloqueada — identidade divergente";
  if (diagnostic.reason === "tuple") return "geração bloqueada — tuple inválida";
  return "geração bloqueada — falha de leitura";
}

function diagnosticVariant(
  diagnostic: VisualSignatureModelConfigView["diagnostic"],
): "ready" | "generating" | "error" | "default" {
  if (diagnostic.status === "dedicated_valid") return "ready";
  if (diagnostic.status === "blocked") return "error";
  if (diagnostic.status === "inherited_opt_in_disabled") return "generating";
  return "default";
}

function diagnosticDescription(
  diagnostic: VisualSignatureModelConfigView["diagnostic"],
  hasCurrent: boolean,
): string {
  if (diagnostic.status === "dedicated_valid") {
    return hasCurrent
      ? "Configuração dedicada válida: guard, identidade e tuple foram aceitos pelo runtime."
      : "Configuração dedicada válida, mas os detalhes não puderam ser carregados para exibição.";
  }
  if (diagnostic.status === "inherited_opt_in_disabled") {
    return hasCurrent
      ? "A configuração está registrada, mas o opt-in local está desligado. A geração usa a seleção herdada."
      : "Opt-in local desligado. A geração usa a seleção herdada.";
  }
  if (diagnostic.status === "inherited_absent") {
    return "Guard válido e ausência confirmada de configuração dedicada. A geração usa a seleção herdada.";
  }
  if (diagnostic.status === "inherited_not_published") {
    return "A configuração existe, mas não está publicada. A geração usa a seleção herdada.";
  }
  if (diagnostic.status === "inherited_not_activated") {
    return "A configuração está publicada, mas não ativada. A geração usa a seleção herdada.";
  }
  if (diagnostic.status === "inherited_outside_pilot") {
    return "A loja está fora da allowlist do piloto. A geração usa a seleção herdada.";
  }
  if (diagnostic.reason === "guard") {
    return "O guard local bloqueia a geração. A configuração dedicada não é aplicada.";
  }
  if (diagnostic.reason === "identity") {
    return "A identidade da linha diverge da identidade canônica. A geração falha antes do provider.";
  }
  if (diagnostic.reason === "tuple") {
    return "A tuple de configuração é inválida. A geração falha antes do provider.";
  }
  return "Falha ao ler a configuração dedicada. A geração falha; a ausência não é presumida.";
}

function coverageLabel(pricing: VisualSignaturePresetPricingView): string {
  if (pricing.status === "complete") return "Completa";
  if (pricing.status === "partial") return "Parcial";
  return "Ausente";
}

function coverageVariant(pricing: VisualSignaturePresetPricingView): "ready" | "generating" | "error" {
  if (pricing.status === "complete") return "ready";
  if (pricing.status === "partial") return "generating";
  return "error";
}

export function VisualSignatureConfigForm({ view: initialView }: { view: VisualSignatureModelConfigView }) {
  const [view, setView] = useState<VisualSignatureModelConfigView>(initialView);
  const initial = view.current;
  const [orchestrator, setOrchestrator] = useState<VisualSignatureOrchestrator>(
    initial?.orchestratorModel ?? view.orchestrators[0],
  );
  const [preset, setPreset] = useState<VisualSignatureImagePreset>(
    initial?.imagePreset ?? view.presets[0]?.preset ?? "flare_low",
  );
  const [reason, setReason] = useState("");
  const [pilotStoreIds, setPilotStoreIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [operation, setOperation] = useState<{ fingerprint: string; id: string } | null>(null);

  const selectedPreset = view.presets.find((item) => item.preset === preset) ?? view.presets[0];
  const selectedPricing = view.pricingByPreset[preset];
  const effective = view.diagnostic.status === "dedicated_valid";

  function idempotencyKey(fingerprint: string): string {
    if (operation?.fingerprint === fingerprint) return operation.id;
    const id = crypto.randomUUID();
    setOperation({ fingerprint, id });
    return id;
  }

  async function mutate(action: "save" | "reset") {
    setError(null);
    setSuccess(null);
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Motivo obrigatório");
      return;
    }
    if (action === "reset" && !view.configured) {
      setError("Não há configuração dedicada para remover.");
      return;
    }
    if (action === "reset" && !view.current?.configVersionId) {
      setError("Versão da configuração indisponível; recarregue a página.");
      return;
    }

    const body =
      action === "reset"
        ? {
            expectedConfigVersionId: view.current?.configVersionId,
            reason: trimmed,
          }
        : { orchestratorModel: orchestrator, imagePreset: preset, reason: trimmed };
    const fingerprint = JSON.stringify([action, body]);
    const operationId = idempotencyKey(fingerprint);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/visual-signature-model-config", {
        method: action === "reset" ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, operationId }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);

      // Estado CONFIRMADO pelo servidor: relê o view model e sincroniza
      // seletores, versão/autor/motivo e disponibilidade do reset.
      const refreshed = await fetch("/api/admin/visual-signature-model-config", {
        method: "GET",
        cache: "no-store",
      });
      if (!refreshed.ok) {
        setSuccess(
          action === "reset"
            ? "Configuração dedicada removida; recarregue a página para atualizar o diagnóstico."
            : "Configuração salva; recarregue a página para atualizar o diagnóstico.",
        );
        setError("A operação foi concluída, mas não foi possível recarregar o estado confirmado.");
        return;
      }
      const next = (await refreshed.json()) as VisualSignatureModelConfigView;
      setView(next);
      setOrchestrator(next.current?.orchestratorModel ?? orchestrator);
      setPreset(next.current?.imagePreset ?? preset);
      setReason("");
      setOperation(null);
      setSuccess(
        action === "reset"
          ? "Configuração dedicada removida; a próxima geração usará a seleção herdada."
          : "Configuração da Assinatura Visual salva com auditoria.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a operação.");
    } finally {
      setLoading(false);
    }
  }

  async function mutateRelease(action: "publish" | "unpublish" | "pilot" | "none") {
    setError(null);
    setSuccess(null);
    const trimmed = reason.trim();
    const expectedConfigVersionId = view.current?.configVersionId;
    if (!expectedConfigVersionId) {
      setError("Salve a configuração antes de alterar a liberação.");
      return;
    }
    if (!trimmed) {
      setError("Motivo obrigatório");
      return;
    }
    const ids = pilotStoreIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (action === "pilot" && ids.length === 0) {
      setError("Informe ao menos uma loja para o piloto.");
      return;
    }

    const body =
      action === "publish" || action === "unpublish"
        ? {
            action: "publish",
            expectedConfigVersionId,
            published: action === "publish",
            reason: trimmed,
          }
        : {
            action: "activate",
            expectedConfigVersionId,
            mode: action === "pilot" ? "pilot" : "none",
            ...(action === "pilot" ? { pilotStoreIds: ids } : {}),
            reason: trimmed,
          };

    const operationId = idempotencyKey(JSON.stringify(body));
    setLoading(true);
    try {
      const response = await fetch("/api/admin/visual-signature-model-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, operationId }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);

      const refreshed = await fetch("/api/admin/visual-signature-model-config", {
        method: "GET",
        cache: "no-store",
      });
      if (refreshed.ok) {
        setView((await refreshed.json()) as VisualSignatureModelConfigView);
      }
      setReason("");
      setOperation(null);
      setSuccess("Estado de liberação atualizado com auditoria.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível alterar a liberação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <CurrentConfigCard
        current={view.current}
        diagnostic={view.diagnostic}
        readError={view.readError}
        environment={view.release?.environment}
      />

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Liberação da configuração</h3>
            <p className="text-xs text-text-secondary">
              {view.release
                ? `Ambiente ${view.release.environment} · publicação ${view.release.published ? "ativa" : "inativa"} · ativação ${view.release.activationMode}`
                : "Sem estado de liberação vinculado à versão."}
            </p>
          </div>
          <Badge variant={effective ? "ready" : "default"}>
            {effective
              ? "em uso"
              : view.release?.activated
                ? "registrado — não efetivo"
                : "herdado"}
          </Badge>
        </div>
        <label className="space-y-1.5 text-sm text-text-secondary">
          <span className="block text-xs font-medium uppercase tracking-wider">
            Lojas do piloto (UUID separados por vírgula)
          </span>
          <input
            aria-label="Lojas do piloto da Assinatura Visual"
            value={pilotStoreIds}
            onChange={(event) => setPilotStoreIds(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={loading || !view.current} onClick={() => mutateRelease("publish")}>
            Publicar
          </Button>
          <Button type="button" variant="secondary" disabled={loading || !view.current} onClick={() => mutateRelease("unpublish")}>
            Despublicar
          </Button>
          <Button type="button" variant="secondary" disabled={loading || !view.current} onClick={() => mutateRelease("pilot")}>
            Ativar piloto
          </Button>
          <Button type="button" variant="secondary" disabled={loading || !view.current} onClick={() => mutateRelease("none")}>
            Desativar
          </Button>
        </div>
      </Card>

      <Card className="space-y-5 p-6">
        <div className="flex items-start gap-3 rounded-xl border border-accent-blue/20 bg-accent-blue/5 p-4 text-sm text-text-secondary">
          <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-blue" aria-hidden="true" />
          <p>
            <strong className="text-text-primary">Configuração dedicada.</strong> Salva apenas este
            card, via RPC auditada. Não altera o Produto 1:1 nem a seleção genérica. O reasoning é
            fixo em <code className="font-mono text-xs text-text-primary">low</code> e derivado no
            servidor.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm text-text-secondary">
            <span className="block text-xs font-medium uppercase tracking-wider">Orquestrador</span>
            <select
              aria-label="Orquestrador da Assinatura Visual"
              value={orchestrator}
              onChange={(event) => {
                setOrchestrator(event.target.value as VisualSignatureOrchestrator);
                setOperation(null);
              }}
              className="min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20"
            >
              {view.orchestrators.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm text-text-secondary">
            <span className="block text-xs font-medium uppercase tracking-wider">Preset de imagem</span>
            <select
              aria-label="Preset de imagem da Assinatura Visual"
              value={preset}
              onChange={(event) => {
                setPreset(event.target.value as VisualSignatureImagePreset);
                setOperation(null);
              }}
              className="min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20"
            >
              {view.presets.map((item) => (
                <option key={item.preset} value={item.preset}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-border bg-bg-deep/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Preview do mapeamento</p>
          <p className="mt-1 break-words text-sm text-text-primary">
            {selectedPreset?.label ?? preset} → <code className="font-mono text-xs">{selectedPreset?.model}</code> ·{" "}
            {selectedPreset?.quality}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {view.orchestrators.length} orquestradores × {view.presets.length} presets ={" "}
            {view.combinations.length} combinações.
          </p>
        </div>

        {selectedPricing && selectedPricing.status !== "complete" && (
          <div className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Pricing {coverageLabel(selectedPricing).toLowerCase()}: faltam{" "}
              {selectedPricing.missingRates.join(", ") || "tarifas comprovadas"}. A seleção continua
              permitida; o custo desconhecido será registrado como parcial/ausente.
            </span>
          </div>
        )}

        <label className="block space-y-1.5 text-sm text-text-secondary">
          <span className="block text-xs font-medium uppercase tracking-wider">Motivo da alteração</span>
          <input
            aria-label="Motivo da alteração da Assinatura Visual"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setOperation(null);
            }}
            placeholder="Motivo obrigatório para auditoria"
            className="min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" loading={loading} onClick={() => void mutate("save")}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Salvar Assinatura Visual
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={loading}
            disabled={!view.configured}
            onClick={() => void mutate("reset")}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Voltar à seleção herdada
          </Button>
        </div>

        {error && (
          <p className="text-xs text-accent-red" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center gap-1 text-xs text-accent-green">
            <Check className="h-4 w-4" aria-hidden="true" />
            {success}
          </p>
        )}
      </Card>

      <InheritedCard inherited={view.inherited} />

      {selectedPricing && (
        <p className="text-xs text-text-muted">
          Cobertura de pricing do preset selecionado: <Badge variant={coverageVariant(selectedPricing)}>{coverageLabel(selectedPricing)}</Badge>
          {selectedPricing.historicalReferenceUsd != null &&
            ` · referência histórica local US$ ${selectedPricing.historicalReferenceUsd} (não é custo estimado)`}
        </p>
      )}
    </div>
  );
}

function CurrentConfigCard({
  current,
  diagnostic,
  readError,
  environment,
}: {
  current: VisualSignatureConfigViewRow | null;
  diagnostic: VisualSignatureModelConfigView["diagnostic"];
  readError: string | null;
  environment?: string;
}) {
  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-lg font-semibold text-text-primary">
          Configuração dedicada
        </h3>
        <Badge variant={diagnosticVariant(diagnostic)}>{diagnosticLabel(diagnostic, environment)}</Badge>
      </div>
      <p
        className={`rounded-lg border p-3 text-xs ${
          diagnostic.status === "blocked"
            ? "border-accent-red/20 bg-accent-red/5 text-accent-red"
            : diagnostic.status === "dedicated_valid"
              ? "border-accent-blue/20 bg-accent-blue/5 text-text-secondary"
              : "border-accent-amber/20 bg-accent-amber/5 text-accent-amber"
        }`}
      >
        {diagnosticDescription(diagnostic, current !== null)}
      </p>
      {readError && (
        <p className="text-xs text-accent-red" role="alert">
          {readError}
        </p>
      )}
      {!current ? (
        <p className="text-sm text-text-secondary">
          Nenhum registro dedicado para exibir. O diagnóstico acima é a fonte de verdade sobre a
          geração.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Orquestrador</p>
          <p className="mt-1 text-sm text-text-primary">{current.orchestratorModel}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Preset / imagem</p>
          <p className="mt-1 break-words text-sm text-text-primary">
            {current.imagePreset} · {current.imageModel} · {current.imageQuality}
          </p>
        </div>
      </div>
      <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <dt className="font-semibold uppercase tracking-wider text-text-muted">Versão</dt>
          <dd className="mt-1 break-all font-mono text-text-primary">{current.configVersionId}</dd>
        </div>
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <dt className="font-semibold uppercase tracking-wider text-text-muted">Reasoning</dt>
          <dd className="mt-1 text-text-primary">{current.reasoningEffort}</dd>
        </div>
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <dt className="font-semibold uppercase tracking-wider text-text-muted">Autor</dt>
          <dd className="mt-1 break-all text-text-primary">{current.updatedBy ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <dt className="font-semibold uppercase tracking-wider text-text-muted">Atualizado em</dt>
          <dd className="mt-1 text-text-primary">{formatTimestamp(current.updatedAt)}</dd>
        </div>
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3 sm:col-span-2">
          <dt className="font-semibold uppercase tracking-wider text-text-muted">Motivo</dt>
          <dd className="mt-1 break-words text-text-primary">{current.reason ?? "—"}</dd>
        </div>
        </dl>
        </>
      )}
    </Card>
  );
}

function InheritedCard({ inherited }: { inherited: VisualSignatureModelConfigView["inherited"] }) {
  return (
    <Card className="space-y-4 p-6" aria-labelledby="inherited-selection-heading">
      <div>
        <h3 id="inherited-selection-heading" className="font-heading text-lg font-semibold text-text-primary">
          Seleção herdada — somente leitura
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          Diagnóstico de <code className="font-mono text-xs">visual_signature_image</code>. Não é um
          segundo editor; o reset dedicado retorna a geração a esta seleção.
        </p>
      </div>
      <div className="grid gap-3 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <p className="font-semibold uppercase tracking-wider text-text-muted">Provider</p>
          <p className="mt-1 text-text-primary">{inherited.provider}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <p className="font-semibold uppercase tracking-wider text-text-muted">Modelo</p>
          <p className="mt-1 break-all text-text-primary">{inherited.model}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <p className="font-semibold uppercase tracking-wider text-text-muted">Protocolo</p>
          <p className="mt-1 text-text-primary">{inherited.protocol}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <p className="font-semibold uppercase tracking-wider text-text-muted">Origem</p>
          <p className="mt-1 text-text-primary">{originLabel(inherited.origin)}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-deep/40 p-3 sm:col-span-2">
          <p className="font-semibold uppercase tracking-wider text-text-muted">Status de catálogo</p>
          <p className="mt-1 flex items-center gap-2 text-text-primary">
            {inherited.catalogStatus}
            <Badge variant={inherited.eligible ? "ready" : "error"}>
              {inherited.eligible ? "elegível" : "fora do catálogo ativo"}
            </Badge>
          </p>
        </div>
      </div>
    </Card>
  );
}
