import "server-only";
import { createServerClient, supabaseAdmin } from "@/lib/supabase/server";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS } from "@/lib/image-generation/config";
import { ILLUSTRATIVE_NOTICE_TEXT } from "./constants";
import type {
  CampaignArtVersion,
  CampaignIntent,
  CampaignRecord,
  CampaignStatus,
} from "./types";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Recorte 3 (Plano 10) — classifica o aviso ilustrativo de forma ESTRITA: só é o
 * aviso quando o texto é o canônico COMPLETO ou o canônico seguido do separador
 * esperado (`\n`/`\r\n`). Qualquer outro texto (mesmo começando igual) é TEXTO
 * LIVRE e permanece ÍNTEGRO — nunca truncamos texto arbitrário.
 */
function classifyIllustrativeNotice(text: string): {
  showIllustrativeNotice: boolean;
  free: string;
} {
  if (text === ILLUSTRATIVE_NOTICE_TEXT) {
    return { showIllustrativeNotice: true, free: "" };
  }
  const crlf = `${ILLUSTRATIVE_NOTICE_TEXT}\r\n`;
  if (text.startsWith(crlf)) {
    return { showIllustrativeNotice: true, free: text.slice(crlf.length) };
  }
  const lf = `${ILLUSTRATIVE_NOTICE_TEXT}\n`;
  if (text.startsWith(lf)) {
    return { showIllustrativeNotice: true, free: text.slice(lf.length) };
  }
  return { showIllustrativeNotice: false, free: text };
}

// F37.1 (D2): estado de aprovação da campanha — derivado de campaign_art_versions
// + campaigns (single source). `regenerating` deriva do marcador
// correction_in_progress (decisão 5) e é inalcançável na 37.1 (nenhum fluxo o
// ativa — correção é 37.2); entra no contrato para preservar isDeliveryReleased.
export type ApprovalDisplayState =
  | { status: "not_enabled" } // flag off → comportamento atual (entrega livre)
  | { status: "legacy" } // flag on, zero linhas em campaign_art_versions → entregue como hoje
  | { status: "pending" } // flag on, campanha nova não aprovada → revisão (gate)
  | { status: "approved"; approvedAt: string }
  | { status: "regenerating" }; // derivado de correction_in_progress (decisão 5) — inalcançável na 37.1

export interface CampaignPageProps {
  imageUrl: string | null;
  caption: string;
  hashtags: string[];
  ctaPost: string;
  title?: string;
  displayStatus: "ready" | "generating" | "stale" | "error";
  productName: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  campaignId: string;
  isPublicationCopyEdited: boolean;
  /**
   * F56.2b1b (B1B-D7 / REQ-56.2.2-09): estado do NOVO fluxo Product 1:1, derivado
   * da OPERAÇÃO PERSISTIDA (`getCampaignOperation`) — nunca de `campaign.status`.
   * Presente ⇒ a página renderiza SOMENTE as superfícies do novo fluxo (nunca
   * `StaleView`/`ErrorView`). Ausente ⇒ campanha legada (caminho atual).
   */
  newFlow?: {
    state: NewFlowDisplayState;
    supportReference?: string | null;
    /** Identidade da operação para a consulta query-only (`Verificar novamente`). */
    operationId?: string | null;
    supportEmail?: string;
    /**
     * F56.2b1b — copy do NOVO FLUXO recuperada POR OPERAÇÃO
     * (`readCopyDelivery`/`readCopyCancellation`). `null`/ausente ⇒ sem informação
     * de copy (a arte é exibida; nenhuma promessa de sucesso). `delivered` mostra
     * os textos completos; `failed`/`canceled` mostram feedback seguro (âmbar).
     */
    copy?: NewFlowCopyView | null;
    /**
     * F56.2b2a (B2.1 / Plano 04) — superfície de RECUPERAÇÃO de copy derivada do
     * SUMÁRIO read-only (`readCopyRecoverySummary`) e mapeada por
     * `mapNewFlowCopyRecovery`. `null` ⇒ SEM superfície (sem tentativa:
     * `attemptSeq === 0`/`state === null`) — nenhum painel/CTA. Leitura
     * indisponível ⇒ `indeterminada` (nunca autoriza nova chamada).
     */
    recovery?: NewFlowCopyRecoveryView | null;
    /**
     * F56.2b2b (B2.2 / C4 / B2B-D9) — snapshot ESTRUTURAL do formulário
     * restaurado, resolvido SERVER-SIDE no ramo `refunded` (SOMENTE-leitura,
     * fail-closed). `null`/ausente ⇒ sem promessa de preservação de dados. A
     * origem chega a `/campanhas/nova` pelo canal autenticado (`restoreFrom`).
     */
    restoredForm?: CampaignFormRestore | null;
  };
  /** F37.1 (D2/decisão 3): estado de aprovação + candidata ativa (pending/regenerating). */
  approval?: {
    state: ApprovalDisplayState;
    candidateImageUrl?: string | null;
    candidateVersionId?: string | null;
    /** F37.2 (R1): candidata é a v1 → habilita [Informar problema] se houver oportunidade. */
    isV1?: boolean;
    /** F37.2 (R1): caso sem consumo (relato inexistente ou `open`). */
    hasOpportunity?: boolean;
  };
}

/**
 * F56.2b1b — estado do novo fluxo derivado do ESTADO PERSISTIDO da operação.
 * A união de `status` é declarada AQUI (local) — `display.ts` NÃO importa
 * `product-1-1` (G-NA); a página passa `operation.status` estruturalmente.
 */
export type NewFlowDisplayState = "running" | "delivered" | "refunded" | "unknown";

export interface NewFlowOperationSnapshot {
  readonly status: "reserved" | "art_uploaded" | "delivered" | "refunded";
  /** `true` quando o resultado desconhecido está PERSISTIDO (C1). */
  readonly unknown: boolean;
  /**
   * P2 (F56.2b2b) — marcador PERSISTIDO de finalidade: `'unknown'`/`'failed'`
   * enquanto a operação é NÃO terminal. `'failed'` NUNCA é geração ativa —
   * significa pendência de resolução. Terminal ⇒ nulo (precedência).
   */
  readonly outcome?: "unknown" | "failed" | null;
  readonly supportReference?: string | null;
}

/**
 * Deriva o estado de exibição do novo fluxo a partir da OPERAÇÃO PERSISTIDA.
 *
 * - `null` (operação ausente) ⇒ `null` (campanha legada).
 * - I2 — precedência TERMINAL: `delivered`/`refunded` PREVALECEM, MESMO quando o
 *   marcador histórico existe (a linha de `product_1_1_generation_outcomes` é
 *   imutável).
 * - SÓ para operação NÃO terminal: `unknown === true` (persistido) OU
 *   `outcome === "failed"` (falha FINAL persistida) ⇒ `"unknown"` (PENDÊNCIA de
 *   resolução) — NUNCA geração ativa.
 * - `reserved`/`art_uploaded` sem marcador persistido ⇒ `"running"` ("Processando").
 *
 * C1 — NUNCA infere `unknown` por dedução de tempo (`elapsedMs`) nem por posição
 * no teto/orçamento: a única origem é o registro persistido.
 */
export function mapNewFlowDisplayState(
  operation: NewFlowOperationSnapshot | null,
): NewFlowDisplayState | null {
  if (!operation) return null;

  if (operation.status === "delivered") return "delivered";
  if (operation.status === "refunded") return "refunded";

  if (operation.unknown === true || operation.outcome === "failed") return "unknown";

  return "running";
}


/**
 * F56.2b1b — visão da copy entregue pelo NOVO FLUXO (por operação). `display.ts`
 * NÃO importa `product-1-1` (G-NA): o tipo é ESTRUTURAL e a página passa o
 * registro lido de `product_1_1_copy_state`.
 *
 * - `delivered` ⇒ textos completos (título/legenda/hashtags/CTA) disponíveis;
 * - `failed`/`canceled` ⇒ feedback SEGURO (âmbar), nunca sucesso falso;
 * - `pending` ⇒ ainda gerando (sem superfície de retry);
 * - `null` ⇒ sem informação de copy.
 */
export type NewFlowCopyState = "delivered" | "failed" | "canceled" | "pending";

export interface NewFlowCopyView {
  readonly state: NewFlowCopyState;
  readonly title?: string;
  readonly caption: string;
  readonly hashtags: string[];
  readonly ctaPost: string;
}

/** Registro ESTRUTURAL lido de `product_1_1_copy_state` (sem importar product-1-1). */
export interface NewFlowCopyRecord {
  readonly state: "pending" | "completed" | "failed";
  readonly copyText: string | null;
  readonly copyPayload: Record<string, unknown> | null;
}

/**
 * Mapeia o registro persistido da copy (por operação) para a visão exibida.
 * NUNCA inventa sucesso: `completed` exibe os textos; `failed` distingue
 * `canceled` (cancelamento registrado separadamente) de falha; `pending` aguarda.
 */
export function mapNewFlowCopy(
  record: NewFlowCopyRecord | null,
  canceled: boolean,
): NewFlowCopyView | null {
  if (!record) return null;

  if (record.state === "completed") {
    const payload = record.copyPayload ?? {};
    const caption =
      typeof payload.caption === "string" ? payload.caption : (record.copyText ?? "");
    const hashtags = Array.isArray(payload.hashtags)
      ? (payload.hashtags.filter((tag) => typeof tag === "string") as string[])
      : [];
    return {
      state: "delivered",
      ...(typeof payload.title === "string" ? { title: payload.title } : {}),
      caption,
      hashtags,
      ctaPost: typeof payload.cta_post === "string" ? payload.cta_post : "",
    };
  }

  if (record.state === "failed") {
    return {
      state: canceled ? "canceled" : "failed",
      caption: "",
      hashtags: [],
      ctaPost: "",
    };
  }

  return { state: "pending", caption: "", hashtags: [], ctaPost: "" };
}

/**
 * F56.2b2a (B2.1 / Plano 04) — estado LOCAL da recuperação de copy. A união é
 * declarada AQUI (LOCAL): `display.ts` NÃO importa `product-1-1` (G-NA); a página
 * passa o registro estrutural lido do sumário (`readCopyRecoverySummary`).
 *
 * Precedência OBRIGATÓRIA (UI-SPEC §Surface): `concluída` > `ativa`/`aguardando` >
 * `indeterminada` > `falha definitiva` > `falha` > `interrompida`.
 */
export type NewFlowCopyRecoveryState =
  | "concluida"
  | "ativa"
  | "aguardando"
  | "indeterminada"
  | "falha_definitiva"
  | "falha"
  | "interrompida";

/** Visão exibida da superfície de recuperação (sem importar `product-1-1`). */
export interface NewFlowCopyRecoveryView {
  readonly state: NewFlowCopyRecoveryState;
  /** Contador de tentativas AUTOMÁTICAS (0..3). */
  readonly autoAttempts: number;
  /** Contador de tentativas MANUAIS (0..3) — limite INDEPENDENTE das automáticas. */
  readonly manualAttempts: number;
  /** Espera REPORTADA pelo servidor (ms) antes da próxima automática. */
  readonly waitRemainingMs: number;
  /** Habilita o CTA manual (estado permite + há manual restante). */
  readonly canRetry: boolean;
}

/**
 * Registro ESTRUTURAL da recuperação (lido do sumário `readCopyRecoverySummary`
 * — Plano 01). `state` é NULLABLE: alinhado ao sumário quando NÃO há tentativa.
 */
export interface NewFlowCopyRecoveryRecord {
  readonly state: "pending" | "completed" | "failed" | null;
  readonly attemptSeq: number;
  /** Tentativa ATIVA confirmada pelo SERVIDOR (LEASE vigente). */
  readonly attemptActive: boolean;
  /** Espera REPORTADA pelo servidor (ms) — a UI NÃO infere por tempo local. */
  readonly waitRemainingMs: number;
  readonly autoAttempts: number;
  readonly manualAttempts: number;
  /** Falha DEFINITIVA (configuração/permissão) — saída antecipada, sem esperas. */
  readonly definitive: boolean;
}

/** Limite de tentativas automáticas e manuais (teto 3 + 3 = 6 por entrega). */
const COPY_RECOVERY_AUTO_LIMIT = 3 as const;
const COPY_RECOVERY_MANUAL_LIMIT = 3 as const;

function clampAttempts(value: number, limit: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(limit, Math.floor(value));
}

function copyRecoveryView(
  state: NewFlowCopyRecoveryState,
  autoAttempts: number,
  manualAttempts: number,
  waitRemainingMs: number,
  canRetry: boolean,
): NewFlowCopyRecoveryView {
  return { state, autoAttempts, manualAttempts, waitRemainingMs, canRetry };
}

/**
 * Mapeia o sumário persistido da recuperação (+ a entrega da copy) para a visão
 * exibida, aplicando a PRECEDÊNCIA OBRIGATÓRIA da UI-SPEC:
 *
 *   `concluída` > `ativa`/`aguardando` > `indeterminada` > `falha definitiva` >
 *   `falha` > `interrompida`.
 *
 * Regras:
 *  - copy comprovadamente ENTREGUE (entrega `completed`) ⇒ `concluida` com
 *    PRECEDÊNCIA MÁXIMA — prevalece ATÉ sobre `record === null` (textos entregues
 *    são exibidos; nenhuma recuperação permanece; `canRetry = false`);
 *  - `record === null` (LEITURA INDISPONÍVEL / fail-closed) ⇒ `indeterminada`
 *    (`canRetry = false`) — não comprova ausência de tentativa;
 *  - `attemptSeq === 0` OU `state === null` (SEM tentativa) ⇒ `null` = SEM
 *    superfície (nenhum painel, NENHUM CTA; `canRetry = false`) — distinto de
 *    `indeterminada` (leitura INDISPONÍVEL);
 *  - copy entregue no registro (`completed`) ⇒ `concluida` (sucesso ABSOLUTO;
 *    `canRetry = false`);
 *  - `attemptActive === true` (LEASE do servidor) ⇒ `ativa` (`canRetry = false`);
 *  - `failed` transitório + automáticas restantes + `manualAttempts === 0`
 *    (ciclo AUTOMÁTICO ABERTO — só antes de qualquer início MANUAL) ⇒ `aguardando`:
 *    `waitRemainingMs > 0` = contagem regressiva (CTA MANUAL `disabled` —
 *    anti-duplicação); `waitRemainingMs === 0` = espera JÁ VENCIDA ⇒
 *    `canRetry = manual restante` (a aba dirigente emite a próxima automática
 *    imediatamente; reload/outra aba oferece a retomada MANUAL);
 *  - após QUALQUER início MANUAL (`manualAttempts > 0`) NENHUMA nova automática é
 *    agendada: o ciclo automático está FECHADO ⇒ `interrompida` (`canRetry =
 *    manual restante`, retomada MANUAL);
 *  - `definitive === true` ⇒ `falha_definitiva` (`canRetry = manual restante`);
 *  - `failed` com automáticas esgotadas ⇒ `falha` (`canRetry = manual restante`);
 *  - `pending` SEM lease vigente ⇒ `interrompida` (`canRetry = manual restante`);
 *  - demais ⇒ `interrompida` (sem tentativa ativa confirmada ⇒ pode tentar).
 *
 * `null`/indisponibilidade NUNCA autoriza nova tentativa (autorização server-side).
 */
export function mapNewFlowCopyRecovery(
  record: NewFlowCopyRecoveryRecord | null,
  delivery: NewFlowCopyRecord | null,
): NewFlowCopyRecoveryView | null {
  // 0. `concluída` — sucesso ABSOLUTO com PRECEDÊNCIA MÁXIMA: a copy
  //    comprovadamente ENTREGUE (entrega `completed`, com textos legíveis)
  //    prevalece ATÉ sobre um sumário INDISPONÍVEL (`record === null`) — os
  //    textos lidos são exibidos e nenhuma superfície de recuperação permanece.
  if (delivery?.state === "completed") {
    return copyRecoveryView(
      "concluida",
      record ? clampAttempts(record.autoAttempts, COPY_RECOVERY_AUTO_LIMIT) : 0,
      record ? clampAttempts(record.manualAttempts, COPY_RECOVERY_MANUAL_LIMIT) : 0,
      0,
      false,
    );
  }

  // Leitura INDISPONÍVEL (fail-closed) ⇒ indeterminada; NÃO habilita nova chamada.
  if (record === null) {
    return copyRecoveryView("indeterminada", 0, 0, 0, false);
  }

  // SEM tentativa (sumário sem linhas) ⇒ SEM superfície de recuperação.
  if (record.attemptSeq === 0 || record.state === null) {
    return null;
  }

  const autoAttempts = clampAttempts(record.autoAttempts, COPY_RECOVERY_AUTO_LIMIT);
  const manualAttempts = clampAttempts(record.manualAttempts, COPY_RECOVERY_MANUAL_LIMIT);
  const manualAvailable = manualAttempts < COPY_RECOVERY_MANUAL_LIMIT;

  // 1. `concluída` — sucesso ABSOLUTO (remove toda ação de recuperação). O registro
  //    `completed` prevalece sobre falhas (a entrega `completed` já foi tratada no
  //    passo 0, com precedência máxima).
  if (record.state === "completed") {
    return copyRecoveryView("concluida", autoAttempts, manualAttempts, 0, false);
  }

  // 2. `ativa` — tentativa ATIVA confirmada pelo SERVIDOR (LEASE vigente).
  if (record.attemptActive === true) {
    return copyRecoveryView("ativa", autoAttempts, manualAttempts, record.waitRemainingMs, false);
  }

  // 3. `aguardando` — falha transitória com automáticas restantes e SEM nenhuma
  //    tentativa MANUAL iniciada (o ciclo AUTOMÁTICO só está ABERTO antes de
  //    qualquer início MANUAL). A UI apenas REFLETE a espera reportada pelo
  //    servidor (nunca infere por tempo): `waitRemainingMs > 0` ⇒ contagem
  //    regressiva com o CTA MANUAL `disabled` (anti-duplicação); `waitRemainingMs
  //    === 0` ⇒ espera JÁ VENCIDA (ex.: chegada após o prazo) ⇒ libera o CTA
  //    MANUAL (`canRetry = manual restante`) — a aba dirigente emite IMEDIATAMENTE
  //    a próxima automática. Após QUALQUER início MANUAL o ciclo automático está
  //    FECHADO: não mapeia aqui e cai em `interrompida` (retomada MANUAL).
  if (
    record.state === "failed" &&
    record.definitive !== true &&
    autoAttempts < COPY_RECOVERY_AUTO_LIMIT &&
    manualAttempts === 0
  ) {
    return copyRecoveryView(
      "aguardando",
      autoAttempts,
      manualAttempts,
      Math.max(0, record.waitRemainingMs),
      record.waitRemainingMs <= 0 && manualAvailable,
    );
  }

  // 4. `falha definitiva` — saída antecipada (sem esperas nem nova automática).
  if (record.definitive === true) {
    return copyRecoveryView("falha_definitiva", autoAttempts, manualAttempts, 0, manualAvailable);
  }

  // 5. `falha` — automáticas esgotadas.
  if (record.state === "failed" && autoAttempts >= COPY_RECOVERY_AUTO_LIMIT) {
    return copyRecoveryView("falha", autoAttempts, manualAttempts, 0, manualAvailable);
  }

  // 6. `interrompida` — SEM tentativa ativa confirmada (`pending` sem lease, ou
  //    falha transitória sem espera agendada): pode tentar (manual restante).
  //    NUNCA spinner.
  return copyRecoveryView("interrompida", autoAttempts, manualAttempts, 0, manualAvailable);
}

/**
 * F56.2b2b (B2.2 / C4 / B2B-D9) — snapshot ESTRUTURAL do formulário restaurado.
 * `display.ts` NÃO importa `product-1-1` (G-NA): o tipo é LOCAL e a página passa
 * o `input_snapshot`/`identity_snapshot` de `campaigns` estruturalmente.
 *
 * A imagem do produto/referências é CLIENT-ONLY ⇒ `imageRestoreLimited` é sempre
 * `true` — NUNCA prometemos restauração de imagem.
 */
export type RestoredBackgroundDirection = "studio" | "original" | "ambient";

export interface CampaignFormRestore {
  /** Campanha-ORIGEM (usada para escopar o rascunho; NUNCA a operação estornada). */
  readonly campaignId: string;
  readonly productName: string;
  readonly description: string;
  readonly originalPriceCents: number;
  readonly discountedPriceCents?: number;
  readonly badge: string;
  readonly campaignIntent: CampaignIntent;
  readonly preserveImageContext: boolean;
  readonly validityDisplayText?: string;
  readonly mandatoryArtworkTextFree: string;
  /**
   * Recorte 3 (Plano 10) — checkbox ilustrativo RESTAURADO SEPARADAMENTE do texto
   * livre (derivado do snapshot quando o aviso canônico está presente). Ausente em
   * snapshots antigos ⇒ `false` (compatibilidade explícita; nunca presume `true`).
   */
  readonly showIllustrativeNotice?: boolean;
  readonly backgroundDirection?: RestoredBackgroundDirection;
  /**
   * F56.2b2b (P1) — `true` SOMENTE quando a direção de fundo NÃO pôde ser
   * resolvida (fonte ausente/indisponível): o formulário AVISA e BLOQUEIA a
   * submissão até escolha EXPLÍCITA. NUNCA cai em `studio` silencioso.
   */
  readonly backgroundDirectionUnresolved?: boolean;
  readonly identityDirective?: string | null;
  readonly referenceSelections: ReadonlyArray<unknown>;
  /** LIMITAÇÃO HONESTA: a imagem do produto/referências é client-only. */
  readonly imageRestoreLimited: true;
}

export interface RestorableSnapshotInput {
  readonly campaignId: string;
  readonly inputSnapshot: Record<string, unknown> | null | undefined;
  readonly identitySnapshot?: Record<string, unknown> | null;
  /**
   * F56.2b2b (P1) — direção de fundo ESTRUTURAL já resolvida SERVER-SIDE a partir
   * da EVIDÊNCIA CONGELADA (`readProductOneToOneBackgroundDirection`). `null`/
   * ausente ⇒ `backgroundDirectionUnresolved` (exige escolha explícita). `display.ts`
   * NÃO importa `product-1-1` (G-NA): a direção entra estruturalmente.
   */
  readonly backgroundDirection?: RestoredBackgroundDirection | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const RESTORABLE_INTENTS: readonly CampaignIntent[] = [
  "offer",
  "spotlight",
  "exclusive",
];

/**
 * Mapeia o snapshot PERSISTIDO da campanha (`input_snapshot` + `identity_snapshot`)
 * para a visão ESTRUTURAL do formulário restaurado — MESMO padrão puro de
 * `mapNewFlowDisplayState`/`mapNewFlowCopyRecovery`.
 *
 * Fail-closed: snapshot ausente/malformado OU sem produto nomeado ⇒ `null` (nunca
 * autoriza promessa falsa de restauração). Não inicia geração/cobrança.
 */
export function mapRestoredForm(
  input: RestorableSnapshotInput,
): CampaignFormRestore | null {
  const snap = asRecord(input.inputSnapshot);
  if (!snap) return null;

  const product = asRecord(snap.product);
  const name = typeof product?.name === "string" ? product.name : "";
  if (!name.trim()) return null;

  const commercial = asRecord(snap.commercial) ?? {};
  const creative = asRecord(snap.creativeContext) ?? {};
  const validity = asRecord(commercial.validity);
  const legalNotice = asRecord(commercial.legalNotice);

  const intent =
    typeof commercial.intent === "string" &&
    RESTORABLE_INTENTS.includes(commercial.intent as CampaignIntent)
      ? (commercial.intent as CampaignIntent)
      : "offer";

  const originalPriceCents =
    typeof commercial.originalPriceCents === "number"
      ? commercial.originalPriceCents
      : 0;
  const discountedPriceCents =
    typeof commercial.discountedPriceCents === "number"
      ? commercial.discountedPriceCents
      : undefined;
  const badge =
    typeof commercial.badgeText === "string" ? commercial.badgeText : "";
  const description =
    typeof product?.description === "string" ? product.description : "";
  const preserveImageContext = creative.preserveImageContext === true;
  const validityDisplayText =
    typeof validity?.displayText === "string" ? validity.displayText : undefined;
  const mandatoryArtworkTextFreeRaw =
    typeof legalNotice?.text === "string" ? legalNotice.text : "";
  const { showIllustrativeNotice, free: mandatoryArtworkTextFree } =
    classifyIllustrativeNotice(mandatoryArtworkTextFreeRaw);
  const backgroundDirection =
    input.backgroundDirection === "studio" ||
    input.backgroundDirection === "original" ||
    input.backgroundDirection === "ambient"
      ? input.backgroundDirection
      : snap.backgroundDirection === "studio" ||
          snap.backgroundDirection === "original" ||
          snap.backgroundDirection === "ambient"
        ? (snap.backgroundDirection as RestoredBackgroundDirection)
        : undefined;
  const identityDirective =
    typeof snap.identityDirective === "string" ? snap.identityDirective : null;
  const referenceSelections = Array.isArray(snap.frozenContentReferences)
    ? (snap.frozenContentReferences as unknown[])
    : [];

  return {
    campaignId: input.campaignId,
    productName: name,
    description,
    originalPriceCents,
    ...(discountedPriceCents !== undefined ? { discountedPriceCents } : {}),
    badge,
    campaignIntent: intent,
    preserveImageContext,
    ...(validityDisplayText !== undefined ? { validityDisplayText } : {}),
    mandatoryArtworkTextFree,
    showIllustrativeNotice,
    ...(backgroundDirection !== undefined
      ? { backgroundDirection }
      : { backgroundDirectionUnresolved: true }),
    identityDirective,
    referenceSelections,
    imageRestoreLimited: true,
  };
}

export async function getCampaignForDisplay(id: string): Promise<CampaignRecord | null> {
  if (!UUID_V4_REGEX.test(id)) {
    return null;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CampaignRecord | null;
}

export async function generateSignedPreviewUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .createSignedUrl(storagePath, 3600);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export function getEffectivePublicationCopy(
  campaign: CampaignRecord
): { title?: string; caption: string; hashtags: string[]; cta_post: string } {
  const current = campaign.publication_copy_current as Record<string, unknown> | null;
  const snapshot = campaign.publication_copy_snapshot as Record<string, unknown> | null;

  if (
    current &&
    typeof current.caption === "string" &&
    Array.isArray(current.hashtags) &&
    current.hashtags.every((tag) => typeof tag === "string") &&
    typeof current.cta_post === "string"
  ) {
    return {
      title: typeof current.title === "string" ? current.title : undefined,
      caption: current.caption,
      hashtags: current.hashtags,
      cta_post: current.cta_post,
    };
  }

  if (
    snapshot &&
    typeof snapshot.caption === "string" &&
    Array.isArray(snapshot.hashtags) &&
    snapshot.hashtags.every((tag) => typeof tag === "string") &&
    typeof snapshot.cta_post === "string"
  ) {
    return {
      title: typeof snapshot.title === "string" ? snapshot.title : undefined,
      caption: snapshot.caption,
      hashtags: snapshot.hashtags,
      cta_post: snapshot.cta_post,
    };
  }

  return { caption: "", hashtags: [], cta_post: "" };
}

export function computeDisplayStatus(
  campaign: { status: CampaignStatus; updated_at: string }
): "ready" | "generating" | "stale" | "error" {
  if (campaign.status === "ready") return "ready";
  if (campaign.status === "error") return "error";

  if (campaign.status === "generating") {
    const staleThreshold = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000;
    const elapsed = Date.now() - new Date(campaign.updated_at).getTime();
    if (elapsed > staleThreshold) return "stale";
    return "generating";
  }

  return "error";
}

// F37.1 (D2): deriva o estado de aprovação da campanha. Ordem: !flagEnabled →
// not_enabled; flag + zero versões → legacy; approved_version_id → approved
// (+approvedAt); candidata ativa com correction_in_progress → regenerating
// (inalcançável na 37.1 — contrato reservado); senão pending. NÃO deriva de
// campaign.status (decisão 5 — permanece generating|ready|error).
export function computeApprovalState(
  campaign: CampaignRecord,
  versions: CampaignArtVersion[],
  flagEnabled: boolean
): ApprovalDisplayState {
  if (!flagEnabled) {
    return { status: "not_enabled" };
  }

  if (versions.length === 0) {
    return { status: "legacy" };
  }

  if (campaign.approved_version_id != null) {
    return {
      status: "approved",
      approvedAt: campaign.approved_at ?? "",
    };
  }

  const activeCandidate = versions.find((v) => v.asset_status === "active");
  if (activeCandidate?.correction_in_progress === true) {
    return { status: "regenerating" };
  }

  return { status: "pending" };
}

// F37.1 (D2): true para not_enabled | legacy | approved; false para pending |
// regenerating. Base fail-closed dos gates de download/publication-copy.
export function isDeliveryReleased(state: ApprovalDisplayState): boolean {
  switch (state.status) {
    case "not_enabled":
    case "legacy":
    case "approved":
      return true;
    case "pending":
    case "regenerating":
      return false;
  }
}

// F37.1 (decisão 3): retorna a candidata ativa (asset_status='active') — fonte
// oficial da arte da revisão. null → legado usa campaigns.storage_path; aprovada
// usa campaigns.storage_path repontado no approve (D8).
export function getActiveCandidateArtVersion(
  versions: CampaignArtVersion[]
): CampaignArtVersion | null {
  return versions.find((v) => v.asset_status === "active") ?? null;
}

export function mapCampaignToProps(campaign: CampaignRecord, id: string): CampaignPageProps {
  const effective = getEffectivePublicationCopy(campaign);
  return {
    imageUrl: null,
    caption: effective.caption,
    hashtags: effective.hashtags,
    ctaPost: effective.cta_post,
    title: effective.title ?? undefined,
    displayStatus: computeDisplayStatus(campaign),
    productName: campaign.product_name ?? "",
    createdAt: campaign.created_at ?? new Date().toISOString(),
    updatedAt: campaign.updated_at ?? new Date().toISOString(),
    downloadUrl: `/api/campaign/${id}/download`,
    campaignId: id,
    isPublicationCopyEdited: campaign.publication_copy_current !== null,
  };
}
