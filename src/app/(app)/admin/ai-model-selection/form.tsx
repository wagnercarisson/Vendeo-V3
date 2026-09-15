"use client";

import { useState } from "react";
import { AlertTriangle, Check, RotateCcw, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiModelSelectionViewModel, AiModelCapabilityView } from "@/lib/ai/ai-model-selection-view";

type Draft = {
  provider: string;
  model: string;
  protocol: string;
  fallback: string;
  reason: string;
  operationId: string | null;
  operationFingerprint: string | null;
  loading: boolean;
  error: string | null;
  success: string | null;
};

const groups = [
  { key: "text", label: "Texto", description: "Copy, análise e briefing comercial." },
  { key: "vision", label: "Visual", description: "Validação e leitura de referências." },
  { key: "image", label: "Imagem", description: "Geração, edição e assinatura visual." },
] as const;

function targetKey(target: { provider: string; model: string; protocol: string } | null): string {
  return target ? `${target.provider}|${target.model}|${target.protocol}` : "";
}

function targetLabel(target: { provider: string; model: string; protocol: string }): string {
  return `${target.model} · ${target.provider} · ${target.protocol}`;
}

function statusClass(status: string): string {
  if (status === "active") return "border-accent-green/30 bg-accent-green/10 text-accent-green";
  if (status === "deprecated") return "border-accent-amber/30 bg-accent-amber/10 text-accent-amber";
  return "border-accent-red/30 bg-accent-red/10 text-accent-red";
}

function makeDraft(item: AiModelCapabilityView): Draft {
  return {
    provider: item.current.primary.provider,
    model: item.current.primary.model,
    protocol: item.current.primary.protocol,
    fallback: item.capability === "campaign_copy" ? targetKey(item.current.fallback) : "",
    reason: "",
    operationId: null,
    operationFingerprint: null,
    loading: false,
    error: null,
    success: null,
  };
}

export function AiModelSelectionForm({ view }: { view: AiModelSelectionViewModel }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(view.capabilities.map((item) => [item.capability, makeDraft(item)])),
  );

  function patch(capability: string, update: Partial<Draft>) {
    setDrafts((previous) => ({ ...previous, [capability]: { ...previous[capability], ...update } }));
  }

  function edit(capability: string, update: Partial<Draft>) {
    patch(capability, { ...update, operationId: null, operationFingerprint: null, success: null, error: null });
  }

  async function mutate(item: AiModelCapabilityView, action: "save" | "reset") {
    const draft = drafts[item.capability];
    if (!draft.reason.trim()) {
      patch(item.capability, { error: "Motivo obrigatório" });
      return;
    }
    try {
      const body = action === "reset"
        ? { capability: item.capability, reason: draft.reason.trim() }
        : {
            capability: item.capability,
            provider: draft.provider,
            model: draft.model,
            protocol: draft.protocol,
            fallback: draft.fallback ? (() => {
              const [provider, model, protocol] = draft.fallback.split("|");
              return { provider, model, protocol };
            })() : null,
            reason: draft.reason.trim(),
          };
      const fingerprint = JSON.stringify([action, body]);
      const operationId = draft.operationFingerprint === fingerprint && draft.operationId
        ? draft.operationId
        : crypto.randomUUID();
      const requestBody = { ...body, operationId };
      patch(item.capability, { operationId, operationFingerprint: fingerprint, loading: true, error: null, success: null });
      const response = await fetch("/api/admin/ai-model-selection", {
        method: action === "reset" ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
      const resetNoop = action === "reset" && data.reset?.reset === false;
      patch(item.capability, { loading: false, operationId: null, operationFingerprint: null, reason: "", success: resetNoop ? "A capacidade já estava no padrão; nenhuma alteração foi auditada." : action === "reset" ? "Padrão restaurado com auditoria." : "Seleção salva com auditoria." });
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      patch(item.capability, { loading: false, error: error instanceof Error ? error.message : "Não foi possível concluir a operação." });
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-accent-blue/20 bg-accent-blue/5 p-4 text-sm text-text-secondary">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-blue" aria-hidden="true" />
          <p><strong className="text-text-primary">Catálogo somente leitura.</strong> Novos modelos entram por migration. Alterações de seleção são auditadas e valem para as próximas chamadas.</p>
        </div>
      </div>

      {groups.map((group) => {
        const items = view.capabilities.filter((item) => item.segment === group.key);
        return (
          <section key={group.key} aria-labelledby={`group-${group.key}`} className="space-y-3">
            <div>
              <h2 id={`group-${group.key}`} className="font-heading text-lg font-semibold text-text-primary">{group.label}</h2>
              <p className="text-sm text-text-secondary">{group.description}</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((item) => {
                const draft = drafts[item.capability];
                const activeOptions = view.catalog.filter((row) => row.capability === item.capability && row.status === "active");
                const configured = item.configured;
                const draftPricing = item.pricingOptions?.find((status) => status.target.provider === draft.provider && status.target.model === draft.model && status.target.protocol === draft.protocol);
                const draftFallbackPricing = item.capability === "campaign_copy" && draft.fallback
                  ? item.pricingOptions?.find((status) => {
                      const [provider, model, protocol] = draft.fallback.split("|");
                      return status.target.provider === provider && status.target.model === model && status.target.protocol === protocol;
                    })
                  : undefined;
                return (
                  <article key={item.capability} className="rounded-xl border border-border bg-bg-surface p-5 transition-colors duration-200 hover:border-border-light">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-heading text-sm font-semibold text-text-primary">{item.capability}</h3>
                        <p className="mt-1 text-xs text-text-muted">{item.source === "selection" ? "Seleção persistida" : "Default do sistema"}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(item.current.primary.catalogStatus)}`}>
                        {item.current.primary.catalogStatus}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Executado agora</p>
                        <p className="mt-1 break-words text-sm text-text-primary">{targetLabel(item.current.primary)}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Default registry</p>
                        <p className="mt-1 break-words text-sm text-text-primary">{targetLabel(item.default.primary)}</p>
                      </div>
                    </div>

                    {configured?.primary && configured.primary.catalogStatus !== "active" && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Configuração persistida: {targetLabel(configured.primary)} ({configured.primary.catalogStatus}).</span>
                      </div>
                    )}

                    {item.capability === "campaign_copy" && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Fallback executado</p>
                          <p className="mt-1 break-words text-sm text-text-primary">{item.current.fallback ? targetLabel(item.current.fallback) : "Sem fallback"}</p>
                          {item.current.fallback && <span className={`mt-2 inline-block rounded-full border px-2 py-1 text-[10px] uppercase ${statusClass(item.current.fallback.catalogStatus)}`}>{item.current.fallback.catalogStatus}</span>}
                        </div>
                        <div className="rounded-lg border border-border bg-bg-deep/40 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Fallback default</p>
                          <p className="mt-1 break-words text-sm text-text-primary">{item.default.fallback ? targetLabel(item.default.fallback) : "Sem fallback"}</p>
                          {item.default.fallback && <span className={`mt-2 inline-block rounded-full border px-2 py-1 text-[10px] uppercase ${statusClass(item.default.fallback.catalogStatus)}`}>{item.default.fallback.catalogStatus}</span>}
                        </div>
                      </div>
                    )}

                    {item.capability === "campaign_copy" && configured?.fallback && configured.fallback.catalogStatus !== "active" && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Fallback persistido: {targetLabel(configured.fallback)} ({configured.fallback.catalogStatus}).</span>
                      </div>
                    )}

                    {draftPricing && draftPricing.pricingCoverage !== "complete" && (
                      <div className="mt-3 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
                        Pricing {draftPricing.pricingCoverage}: faltam {draftPricing.missingComponents.join(", ")}. A seleção continua permitida; a estimativa segue a cadeia de custo existente.
                      </div>
                    )}
                    {draftFallbackPricing && draftFallbackPricing.pricingCoverage !== "complete" && (
                      <div className="mt-3 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
                        Pricing do fallback {draftFallbackPricing.pricingCoverage}: faltam {draftFallbackPricing.missingComponents.join(", ")}. A seleção continua permitida; a estimativa segue a cadeia de custo existente.
                      </div>
                    )}

                    <div className="mt-4 space-y-3">
                      <label className="block text-xs font-medium uppercase tracking-wider text-text-secondary" htmlFor={`primary-${item.capability}`}>Novo primary</label>
                      <select id={`primary-${item.capability}`} value={`${draft.provider}|${draft.model}|${draft.protocol}`} onChange={(event) => {
                        const [provider, model, protocol] = event.target.value.split("|");
                        edit(item.capability, { provider, model, protocol });
                      }} className="min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none transition-colors duration-200 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20">
                        {configured?.primary && configured.primary.catalogStatus !== "active" && <option disabled value={targetKey(configured.primary)}>{targetLabel(configured.primary)} · {configured.primary.catalogStatus}</option>}
                        {activeOptions.map((option) => <option key={option.id} value={`${option.provider}|${option.model}|${option.protocol}`}>{targetLabel(option)}</option>)}
                      </select>

                      {item.capability === "campaign_copy" && (
                        <>
                          <label className="block text-xs font-medium uppercase tracking-wider text-text-secondary" htmlFor={`fallback-${item.capability}`}>Fallback genérico</label>
                          <select id={`fallback-${item.capability}`} value={draft.fallback} onChange={(event) => edit(item.capability, { fallback: event.target.value })} className="min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none transition-colors duration-200 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20">
                            <option value="">Sem fallback</option>
                            {configured?.fallback && configured.fallback.catalogStatus !== "active" && <option disabled value={targetKey(configured.fallback)}>{targetLabel(configured.fallback)} · {configured.fallback.catalogStatus}</option>}
                            {view.catalog.filter((row) => row.capability === "campaign_copy" && row.status === "active").map((option) => <option key={`fallback-${option.id}`} value={`${option.provider}|${option.model}|${option.protocol}`}>{targetLabel(option)}</option>)}
                          </select>
                        </>
                      )}

                      <label className="block text-xs font-medium uppercase tracking-wider text-text-secondary" htmlFor={`reason-${item.capability}`}>Motivo da alteração</label>
                      <input id={`reason-${item.capability}`} value={draft.reason} onChange={(event) => edit(item.capability, { reason: event.target.value })} placeholder="Motivo obrigatório para auditoria" className="min-h-11 w-full rounded-lg border border-border-light bg-bg-deep px-3 text-sm text-text-primary outline-none transition-colors duration-200 placeholder:text-text-muted focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" size="sm" loading={draft.loading} onClick={() => mutate(item, "save")}><Save className="h-4 w-4" aria-hidden="true" />Salvar seleção</Button>
                      <Button type="button" size="sm" variant="secondary" disabled={draft.loading} onClick={() => mutate(item, "reset")}><RotateCcw className="h-4 w-4" aria-hidden="true" />Restaurar padrão</Button>
                    </div>
                    {draft.error && <p className="mt-3 text-xs text-accent-red" role="alert">{draft.error}</p>}
                    {draft.success && <p className="mt-3 flex items-center gap-1 text-xs text-accent-green"><Check className="h-4 w-4" aria-hidden="true" />{draft.success}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
