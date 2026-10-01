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
  type BenchTextIntegrityReviewView,
} from "./bench-preflight-panel";
import { BenchPromptEditor } from "./bench-prompt-editor";
import { BenchStoreSelector, type BenchStoreOption } from "./bench-store-selector";
import { buildValidityDisplayText } from "@/lib/lab/bench/domain/form-rules";
import type {
  BenchTextIntegrityEvidence,
  BenchTextIntegrityField,
} from "@/lib/lab/bench/domain/schemas";

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
 * loja/branding, produto/campanha, imagens/referências, condições comerciais,
 * intenção/formato/tipo de conteúdo/estrutura/tema, textos obrigatórios,
 * prompt-base e o prompt final após a aprovação. Nenhum hash é persistido: a
 * revisão vive apenas no estado da UI.
 *
 * **Separação aprovação e configuração de execução (correção de UAT):** trocar
 * `preset`/`modelo`/`qualidade` **NÃO** invalida o prompt compilado/aprovado nem
 * exige nova composição — esses campos não participam da composição textual.
 * Trocar a configuração de execução apenas **invalida a estimativa e a confirmação
 * financeira** (`executionConfigRevision`), mantendo o mesmo prompt aprovado, que
 * é reutilizado byte a byte.
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

function buildProductPayload(campaign: BenchCampaignFormValue): BenchProductPayload {
  return {
    name: campaign.productName,
    ...(campaign.productDescription.length > 0
      ? { description: campaign.productDescription }
      : {}),
    ...(campaign.priceCents > 0 ? { priceCents: campaign.priceCents } : {}),
    ...(campaign.originalPriceCents > 0
      ? { originalPriceCents: campaign.originalPriceCents }
      : {}),
    ...(campaign.mandatoryArtworkText.length > 0
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
  // Revisão da configuração de execução (preset/modelo/qualidade). Trocar a
  // configuração NÃO invalida o prompt aprovado; invalida apenas a estimativa e a
  // confirmação financeira no painel de execução (correção de UAT).
  const [executionConfigRevision, setExecutionConfigRevision] = useState(0);
  const [upload, setUpload] = useState<BenchUploadResult | null>(null);
  const [runEvidence, setRunEvidence] = useState<{
    run: BenchRunEvidence;
    artifacts: BenchArtifactView[];
  } | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // Preflight (D17/D20).
  const [preflightRevision, setPreflightRevision] = useState(0);
  const preflightRevisionRef = useRef(0);
  const composeRequestIdRef = useRef(0);
  const [preflightStatus, setPreflightStatus] = useState<BenchPreflightStatus>("idle");
  const [compiledPrompt, setCompiledPrompt] = useState("");
  const [finalPrompt, setFinalPrompt] = useState("");
  const [promptBlocks, setPromptBlocks] = useState<Record<string, string>>({});
  const [composerVersion, setComposerVersion] = useState("");
  const [policyVersions, setPolicyVersions] = useState<Record<string, string>>({});
  const [composedPromptBaseVersion, setComposedPromptBaseVersion] =
    useState(promptBaseVersion);
  const [textIntegrityEvidence, setTextIntegrityEvidence] =
    useState<BenchTextIntegrityEvidence | null>(null);
  const [textIntegrityReview, setTextIntegrityReview] =
    useState<BenchTextIntegrityReviewView | null>(null);
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
    const nextRevision = preflightRevisionRef.current + 1;
    preflightRevisionRef.current = nextRevision;
    composeRequestIdRef.current += 1;
    setPreflightRevision(nextRevision);
    setPreflightStatus(hasComposedRef.current ? "invalidated" : "idle");
    setCompiledPrompt("");
    setFinalPrompt("");
    setPromptBlocks({});
    setComposerVersion("");
    setPolicyVersions({});
    setTextIntegrityEvidence(null);
    setTextIntegrityReview(null);
    setPreflightError(null);
    setComposing(false);
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
    // Preset/modelo/qualidade NÃO compõem o texto: o prompt aprovado permanece
    // válido byte a byte. Apenas a estimativa e a confirmação financeira são
    // invalidadas (o painel de execução reinicia ao ver a nova revisão).
    setExecutionConfigRevision((revision) => revision + 1);
  }

  function handleUploaded(result: BenchUploadResult) {
    setUpload(result);
    setRunEvidence(null);
    setEvidenceError(null);
    invalidatePreflight();
  }

  function handleCompose() {
    void submitCompose();
  }

  async function submitCompose(evidenceOverride?: BenchTextIntegrityEvidence) {
    const inputRevision = preflightRevisionRef.current;
    const requestId = composeRequestIdRef.current + 1;
    composeRequestIdRef.current = requestId;
    setComposing(true);
    setPreflightError(null);
    const evidenceForRequest = evidenceOverride ?? textIntegrityEvidence ?? undefined;

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
          ...(evidenceForRequest ? { textIntegrityEvidence: evidenceForRequest } : {}),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        compiledPrompt?: string;
        blocks?: Record<string, string>;
        composerVersion?: string;
        policyVersions?: Record<string, string>;
        promptBaseVersion?: string;
        textIntegrityEvidence?: BenchTextIntegrityEvidence;
        textIntegrityReview?: Omit<BenchTextIntegrityReviewView, "stale">;
      };

      // Uma mudança de qualquer entrada coberta invalida esta requisição. A
      // resposta antiga não pode recompor/aprovar dados que já não estão visíveis.
      if (
        requestId !== composeRequestIdRef.current ||
        inputRevision !== preflightRevisionRef.current
      ) {
        return;
      }

      if (
        (data.error === "text_integrity_review_required" ||
          data.error === "text_integrity_review_stale") &&
        data.textIntegrityReview
      ) {
        setCompiledPrompt("");
        setFinalPrompt("");
        setPromptBlocks({});
        setComposerVersion("");
        setPolicyVersions({});
        setTextIntegrityEvidence(null);
        setTextIntegrityReview({
          ...data.textIntegrityReview,
          stale: data.error === "text_integrity_review_stale",
        });
        setPreflightStatus(hasComposedRef.current ? "invalidated" : "idle");
        setPreflightError(
          data.error === "text_integrity_review_stale"
            ? "A revisão textual ficou desatualizada. Revise os valores atuais e recomponha."
            : null,
        );
        setComposing(false);
        return;
      }

      if (
        !response.ok ||
        typeof data.compiledPrompt !== "string" ||
        !data.textIntegrityEvidence
      ) {
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
      setTextIntegrityEvidence(data.textIntegrityEvidence);
      setTextIntegrityReview(null);
      setPreflightStatus("composed");
      setComposing(false);
    } catch {
      if (
        requestId !== composeRequestIdRef.current ||
        inputRevision !== preflightRevisionRef.current
      ) {
        return;
      }
      setPreflightError("Não foi possível compor o prompt. Tente novamente.");
      setComposing(false);
    }
  }

  function handleKeepTextExactly() {
    if (!textIntegrityReview || textIntegrityReview.alerts.length === 0) return;
    void submitCompose({
      policyVersion: textIntegrityReview.policyVersion,
      reviewRevision: textIntegrityReview.reviewRevision,
      decision: "keep_exactly",
    });
  }

  function handleVerifyTextField(field: BenchTextIntegrityField) {
    const target = document.querySelector<HTMLElement>(
      `[data-bench-text-field="${field}"]`,
    );
    if (!target) return;
    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }

  function handleEditFinal(value: string) {
    setFinalPrompt(value);
    // Editar o prompt final após a aprovação invalida a aprovação (D17).
    setPreflightStatus("edited");
  }

  function handleApprove() {
    if (finalPrompt.trim().length === 0 || !textIntegrityEvidence) return;
    setPreflightStatus("approved");
  }

  const approvedPrompt = preflightStatus === "approved" ? finalPrompt : null;
  const canonicalIdentityReference = branding?.identityReference
    ? {
        kind: branding.identityReference.kind,
        variantType: branding.identityReference.variantType,
        storagePath: branding.identityReference.storagePath,
      }
    : null;
  // Evidência **textual** capturada no momento da aprovação, com os campos exigidos
  // pelo `BenchPreflightEvidenceSchema` estrito (D11/D14): `policyVersions`,
  // `promptBaseVersion` e `identityReference` (sem URL assinada). **Não** inclui
  // `presetId`/`config` de execução (correção de UAT): o preset/modelo/qualidade é
  // enviado separadamente em `POST /runs` como configuração de execução.
  const preflightEvidence: BenchPreflightEvidenceView | null =
    preflightStatus === "approved" && textIntegrityEvidence
      ? {
          promptBase: prompt,
          promptCompiled: compiledPrompt,
          promptApproved: finalPrompt,
          promptBlocks,
          composerVersion,
          policyVersions,
          promptBaseVersion: composedPromptBaseVersion,
           identityReference: canonicalIdentityReference,
           textIntegrityEvidence,
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
          textIntegrityReview={textIntegrityReview}
          onKeepExactly={handleKeepTextExactly}
          onVerifyField={handleVerifyTextField}
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
          configRevision={executionConfigRevision}
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
