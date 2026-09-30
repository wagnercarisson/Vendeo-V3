"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BenchBrandingPanel, type BenchBrandingView } from "./bench-branding-panel";
import {
  BenchCampaignForm,
  EMPTY_BENCH_CAMPAIGN_FORM,
  type BenchCampaignFormValue,
} from "./bench-campaign-form";
import {
  BenchEvidencePanel,
  type BenchArtifactView,
  type BenchRunEvidence,
} from "./bench-evidence-panel";
import {
  BenchExecutionPanel,
  type BenchOfferPayload,
  type BenchProductPayload,
} from "./bench-execution-panel";
import { BenchImageUpload, type BenchUploadResult } from "./bench-image-upload";
import {
  BenchAttemptsPanel,
  type BenchAttemptView,
} from "./bench-attempts-panel";
import {
  BenchPoliciesPanel,
  type BenchPromptPolicyView,
} from "./bench-policies-panel";
import { BenchPresetSelector } from "./bench-preset-selector";
import {
  BenchPreflightPanel,
  type BenchPreflightEvidenceView,
  type BenchPreflightStatus,
} from "./bench-preflight-panel";
import { BenchPromptEditor } from "./bench-prompt-editor";
import { BenchStoreSelector, type BenchStoreOption } from "./bench-store-selector";
import { buildValidityDisplayText } from "@/lib/lab/bench/domain/form-rules";

/**
 * Contêiner cliente da bancada (F48.2.2, D15; F48.2.3, D17/D20).
 *
 * A página `bancada/page.tsx` é um server component (guarda de ambiente +
 * leitura server-side de lojas/presets). Este contêiner é o dono do estado que
 * atravessa os painéis:
 *  - a loja de teste selecionada e o branding (somente leitura) carregado por ela;
 *  - o formulário **fiel** produto/oferta, o prompt-base manual e o preset;
 *  - o `operationId` estável e o `runId`/`references` elevados do upload;
 *  - o estado do **preflight** (não composto / composto / editado / aprovado /
 *    invalidado) e o prompt final aprovado propagado à execução.
 *
 * **Invalidação centralizada (D17):** um ponto único `invalidatePreflight()`
 * incrementa o contador em memória `preflightRevision` e limpa a composição
 * aprovada. **Toda** transição de entrada usada na composição passa por ele —
 * loja/briefing, produto/campanha, imagens/referências, intenção/formato/config,
 * prompt-base e o prompt final após a aprovação. Nenhum hash é persistido: a
 * revisão vive apenas no estado da UI.
 *
 * Ele mantém apenas estado de UI; nenhuma chamada paga parte daqui.
 */

export interface BenchPresetOption {
  id: string;
  label: string;
  capability: string;
  provider: string;
  model: string;
  protocol: string;
  quality: string;
  size: string;
  enabled: boolean;
  reason?: string;
}

export interface BenchConfigDimensionOption {
  id: string;
  label: string;
  enabled: boolean;
  reason?: string;
}

export interface BenchConfigOptions {
  dimensions: Record<string, BenchConfigDimensionOption[]>;
  defaults: Record<string, string>;
}

export interface BenchWorkbenchProps {
  stores: BenchStoreOption[];
  presets: BenchPresetOption[];
  config: BenchConfigOptions;
  /** Prompt-base padrão resolvido server-side (props iniciais — D6/D16). */
  defaultPromptBase: string;
  /** Versão do prompt-base padrão (evidência — D14). */
  promptBaseVersion: string;
  /** Políticas habilitadas do recorte (id/valor/versão) — props iniciais. */
  enabledPolicies: BenchPromptPolicyView[];
  /** Versão estática do compositor (evidência — D20). */
  composerVersion: string;
}

/** Config canônica (8 dimensões) aprovada no preflight — modelo/qualidade do preset. */
function buildCanonicalConfig(
  config: BenchConfigOptions,
  preset: BenchPresetOption | undefined,
): Record<string, string> | null {
  if (!preset) return null;
  return {
    pipeline: config.defaults.pipeline ?? "",
    formato: config.defaults.formato ?? "",
    modelo: preset.model,
    qualidade: preset.quality,
    intencao: config.defaults.intencao ?? "",
    tipoConteudo: config.defaults.tipoConteudo ?? "",
    estrutura: config.defaults.estrutura ?? "",
    tema: config.defaults.tema ?? "",
  };
}

function buildProductPayload(campaign: BenchCampaignFormValue): BenchProductPayload {
  return {
    name: campaign.productName,
    ...(campaign.productDescription.trim().length > 0
      ? { description: campaign.productDescription }
      : {}),
    ...(campaign.priceCents > 0 ? { priceCents: campaign.priceCents } : {}),
    ...(campaign.originalPriceCents > 0
      ? { originalPriceCents: campaign.originalPriceCents }
      : {}),
    ...(campaign.mandatoryArtworkText.trim().length > 0
      ? { mandatoryArtworkText: campaign.mandatoryArtworkText }
      : {}),
    ...(campaign.preserveImageContext ? { preserveImageContext: true } : {}),
  };
}

function buildOfferPayload(campaign: BenchCampaignFormValue): BenchOfferPayload {
  const validity = buildValidityDisplayText({
    validityMode: campaign.validityMode,
    validityStartDate: campaign.validityStartDate,
    validityEndDate: campaign.validityEndDate,
    validityCustomText: campaign.validityCustomText,
  });
  return {
    ...(campaign.badge ? { badge: campaign.badge } : {}),
    campaignIntent: campaign.campaignIntent,
    ...(validity ? { validity } : {}),
    showIllustrativeNotice: campaign.showIllustrativeNotice,
  };
}

export function BenchWorkbench(props: BenchWorkbenchProps) {
  const {
    stores,
    presets,
    config,
    defaultPromptBase,
    promptBaseVersion,
    enabledPolicies,
    composerVersion: composerVersionConstant,
  } = props;

  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [branding, setBranding] = useState<BenchBrandingView | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<BenchCampaignFormValue>(
    EMPTY_BENCH_CAMPAIGN_FORM,
  );
  // O editor do prompt-base é semeado pelo padrão resolvido server-side (props
  // iniciais) — sem depender de `POST /compose` (D6/D16).
  const [prompt, setPrompt] = useState(defaultPromptBase);
  const [presetId, setPresetId] = useState(
    presets.find((preset) => preset.enabled)?.id ?? presets[0]?.id ?? "",
  );
  const [upload, setUpload] = useState<BenchUploadResult | null>(null);
  const [runEvidence, setRunEvidence] = useState<{
    run: BenchRunEvidence;
    artifacts: BenchArtifactView[];
  } | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // Preflight (D17/D20).
  const [preflightRevision, setPreflightRevision] = useState(0);
  const [preflightStatus, setPreflightStatus] = useState<BenchPreflightStatus>("idle");
  const [compiledPrompt, setCompiledPrompt] = useState("");
  const [finalPrompt, setFinalPrompt] = useState("");
  const [promptBlocks, setPromptBlocks] = useState<Record<string, string>>({});
  const [composerVersion, setComposerVersion] = useState("");
  const [policyVersions, setPolicyVersions] = useState<Record<string, string>>({});
  const [composedPromptBaseVersion, setComposedPromptBaseVersion] =
    useState(promptBaseVersion);
  const [composing, setComposing] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const hasComposedRef = useRef(false);

  // Tentativas por linhagem explícita (D12/D13).
  const [attempts, setAttempts] = useState<BenchAttemptView[]>([]);
  const [startingAttempt, setStartingAttempt] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);

  const operationRef = useRef<{ id: string; fingerprint: string } | null>(null);

  const getOperationId = useCallback((fingerprint: string): string => {
    const current = operationRef.current;
    if (current && current.fingerprint === fingerprint) return current.id;
    const id = crypto.randomUUID();
    operationRef.current = { id, fingerprint };
    return id;
  }, []);

  /**
   * Ponto único de invalidação do preflight (D17/D20). Incrementa a revisão em
   * memória e descarta a composição aprovada. Chamado por **qualquer** mudança de
   * entrada usada na composição — nunca apenas por `handleStoreChange`. A F48.2.4
   * o reforça para cobrir prompt-base, configuração multidimensional
   * (incl. modelo/qualidade) e as versões resolvidas.
   */
  const invalidatePreflight = useCallback(() => {
    setPreflightRevision((revision) => revision + 1);
    setPreflightStatus(hasComposedRef.current ? "invalidated" : "idle");
    setCompiledPrompt("");
    setFinalPrompt("");
    setPromptBlocks({});
    setComposerVersion("");
    setPolicyVersions({});
    setPreflightError(null);
  }, []);

  function handleStoreChange(nextStoreId: string) {
    setStoreId(nextStoreId);
    // O draft pertence à loja: trocar de loja invalida o upload anterior.
    setUpload(null);
    setRunEvidence(null);
    setEvidenceError(null);
    operationRef.current = null;
    invalidatePreflight();
  }

  function handleCampaignChange(next: BenchCampaignFormValue) {
    setCampaign(next);
    invalidatePreflight();
  }

  function handlePromptBaseChange(next: string) {
    setPrompt(next);
    invalidatePreflight();
  }

  function handleResetPromptBase() {
    setPrompt(defaultPromptBase);
    invalidatePreflight();
  }

  function handlePresetChange(nextPresetId: string) {
    setPresetId(nextPresetId);
    invalidatePreflight();
  }

  function handleUploaded(result: BenchUploadResult) {
    setUpload(result);
    setRunEvidence(null);
    setEvidenceError(null);
    invalidatePreflight();
  }

  async function handleCompose() {
    setComposing(true);
    setPreflightError(null);

    try {
      const response = await fetch("/api/admin/laboratorio/bancada/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          presetId,
          product: buildProductPayload(campaign),
          offer: buildOfferPayload(campaign),
          promptBase: prompt,
          references: upload?.references ?? [],
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        compiledPrompt?: string;
        blocks?: Record<string, string>;
        composerVersion?: string;
        policyVersions?: Record<string, string>;
        promptBaseVersion?: string;
      };

      if (!response.ok || typeof data.compiledPrompt !== "string") {
        setPreflightError(
          "Não foi possível compor o prompt. Verifique os dados do produto/oferta e tente novamente.",
        );
        setComposing(false);
        return;
      }

      hasComposedRef.current = true;
      setCompiledPrompt(data.compiledPrompt);
      setFinalPrompt(data.compiledPrompt);
      setPromptBlocks(data.blocks ?? {});
      setComposerVersion(data.composerVersion ?? composerVersionConstant);
      setPolicyVersions(data.policyVersions ?? {});
      setComposedPromptBaseVersion(data.promptBaseVersion ?? promptBaseVersion);
      setPreflightStatus("composed");
      setComposing(false);
    } catch {
      setPreflightError("Não foi possível compor o prompt. Tente novamente.");
      setComposing(false);
    }
  }

  function handleEditFinal(value: string) {
    setFinalPrompt(value);
    // Editar o prompt final após a aprovação invalida a aprovação (D17).
    setPreflightStatus("edited");
  }

  function handleApprove() {
    if (finalPrompt.trim().length === 0) return;
    setPreflightStatus("approved");
  }

  const approvedPrompt = preflightStatus === "approved" ? finalPrompt : null;
  const selectedPreset = presets.find((preset) => preset.id === presetId);
  const canonicalConfig = buildCanonicalConfig(config, selectedPreset);
  const canonicalIdentityReference = branding?.identityReference
    ? {
        kind: branding.identityReference.kind,
        variantType: branding.identityReference.variantType,
        storagePath: branding.identityReference.storagePath,
      }
    : null;
  // Evidência capturada no momento da aprovação, com TODOS os campos exigidos pelo
  // `BenchPreflightEvidenceSchema` estrito (D11/D14) — inclusive `presetId`,
  // `config` canônica (modelo/qualidade + recorte), `policyVersions`,
  // `promptBaseVersion` e `identityReference` (sem URL assinada). Sem esses campos
  // `POST /runs` responde 400 por preflight-evidence ausente.
  const preflightEvidence: BenchPreflightEvidenceView | null =
    preflightStatus === "approved"
      ? {
          promptBase: prompt,
          promptCompiled: compiledPrompt,
          promptApproved: finalPrompt,
          promptBlocks,
          composerVersion,
          policyVersions,
          promptBaseVersion: composedPromptBaseVersion,
          identityReference: canonicalIdentityReference,
          presetId,
          ...(canonicalConfig ? { config: canonicalConfig } : {}),
        }
      : null;

  const handleCompleted = useCallback((completedRunId: string) => {
    setEvidenceLoading(true);
    setEvidenceError(null);

    fetch(
      `/api/admin/laboratorio/bancada/runs/${encodeURIComponent(completedRunId)}`,
      { method: "GET" },
    )
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          run?: BenchRunEvidence;
          artifacts?: BenchArtifactView[];
          attempts?: BenchAttemptView[];
        };
        if (!response.ok || !data.run) {
          setEvidenceError("Não foi possível carregar as evidências.");
          setEvidenceLoading(false);
          return;
        }
        setRunEvidence({ run: data.run, artifacts: data.artifacts ?? [] });
        setAttempts(data.attempts ?? []);
        setEvidenceLoading(false);
      })
      .catch(() => {
        setEvidenceError("Não foi possível carregar as evidências.");
        setEvidenceLoading(false);
      });
  }, []);

  /**
   * "Nova tentativa" (D12/D13): cria um novo run `draft` a partir do run de
   * origem (último da linhagem, terminal) via `POST /runs/[id]/attempts`,
   * reaproveitando as entradas copiadas server-side (sem reupload manual) e
   * elevando `runId`/`references`/`operationId` do novo draft. Nenhuma chamada
   * paga parte daqui; o operador edita/recompõe/aprova o novo prompt.
   */
  async function handleNewAttempt() {
    const sourceId =
      attempts.length > 0
        ? attempts[attempts.length - 1].id
        : (runEvidence?.run.id ?? null);
    if (!sourceId) return;

    setStartingAttempt(true);
    setAttemptsError(null);

    try {
      const operationId = crypto.randomUUID();
      const response = await fetch(
        `/api/admin/laboratorio/bancada/runs/${encodeURIComponent(sourceId)}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationId }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        runId?: string;
        references?: string[];
      };

      if (!response.ok || !data.runId || !Array.isArray(data.references)) {
        setAttemptsError("Não foi possível iniciar uma nova tentativa. Tente novamente.");
        setStartingAttempt(false);
        return;
      }

      setUpload({
        runId: data.runId,
        references: data.references,
        operationId,
        inputs: [],
      });
      setRunEvidence(null);
      setEvidenceError(null);
      invalidatePreflight();
      setStartingAttempt(false);
    } catch {
      setAttemptsError("Não foi possível iniciar uma nova tentativa. Tente novamente.");
      setStartingAttempt(false);
    }
  }

  useEffect(() => {
    if (!storeId) {
      setBranding(null);
      return;
    }
    let cancelled = false;
    setBrandingLoading(true);
    setBrandingError(null);

    fetch(
      `/api/admin/laboratorio/bancada/branding?storeId=${encodeURIComponent(storeId)}`,
      { method: "GET" },
    )
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          branding?: BenchBrandingView;
        };
        if (cancelled) return;
        if (!response.ok || !data.branding) {
          setBrandingError("Não foi possível carregar o branding da loja de teste.");
        } else {
          setBranding(data.branding);
        }
        setBrandingLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setBrandingError("Não foi possível carregar o branding da loja de teste.");
        setBrandingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <BenchStoreSelector
          stores={stores}
          value={storeId}
          onChange={handleStoreChange}
        />
        <BenchBrandingPanel
          branding={branding}
          loading={brandingLoading}
          error={brandingError}
        />
        <BenchCampaignForm value={campaign} onChange={handleCampaignChange} />
        <BenchImageUpload
          storeId={storeId}
          getOperationId={getOperationId}
          onUploaded={handleUploaded}
        />
        <BenchPromptEditor
          value={prompt}
          onChange={handlePromptBaseChange}
          promptBaseVersion={promptBaseVersion}
          onResetToDefault={handleResetPromptBase}
        />
        <BenchPoliciesPanel
          policies={enabledPolicies}
          composerVersion={composerVersionConstant}
          promptBaseVersion={promptBaseVersion}
        />
        <BenchPreflightPanel
          key={preflightRevision}
          status={preflightStatus}
          compiledPrompt={compiledPrompt}
          finalPrompt={finalPrompt}
          composerVersion={composerVersion}
          policyVersions={policyVersions}
          promptBaseVersion={composedPromptBaseVersion}
          composing={composing}
          error={preflightError}
          onCompose={handleCompose}
          onEditFinal={handleEditFinal}
          onApprove={handleApprove}
        />
        <BenchPresetSelector
          presets={presets}
          config={config}
          presetId={presetId}
          onChange={handlePresetChange}
        />
      </div>
      <div className="space-y-6" data-testid="bench-result-column">
        <BenchExecutionPanel
          storeId={storeId}
          presetId={presetId}
          approvedPrompt={approvedPrompt}
          preflightEvidence={preflightEvidence}
          product={buildProductPayload(campaign)}
          offer={buildOfferPayload(campaign)}
          runId={upload?.runId ?? null}
          references={upload?.references ?? []}
          operationId={upload?.operationId ?? null}
          onCompleted={handleCompleted}
        />
        {(evidenceLoading || runEvidence !== null || evidenceError !== null) && (
          <BenchEvidencePanel
            run={runEvidence?.run ?? null}
            artifacts={runEvidence?.artifacts ?? []}
            loading={evidenceLoading}
            error={evidenceError}
          />
        )}
        <BenchAttemptsPanel
          attempts={attempts}
          error={attemptsError}
          canStartAttempt={attempts.length > 0 || runEvidence !== null}
          starting={startingAttempt}
          onNewAttempt={handleNewAttempt}
        />
      </div>
    </div>
  );
}
