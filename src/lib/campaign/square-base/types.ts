/**
 * F60.4 — Contrato puro da composição da base quadrada (etapa interna 9:16).
 *
 * Este módulo é puro: roda em qualquer runtime, sem dependência de servidor, sem
 * processamento de imagem, sem cliente de banco/armazenamento, sem criptografia e
 * sem acesso a filesystem. Ele apenas reusa, por TIPO, os contratos da F60/F60.1,
 * do Produto 1:1 e da F60.3 — `ArtifactRecord`, `AuthorizationContext`,
 * `ProviderFailure`, `CostResolution`, `TokenUsage`,
 * `ProductPromptCompositionBriefing`, `ProductOneToOneCopyContext`,
 * `ProductOneToOneIntent`, `ProductOneToOneBackgroundDirection` e
 * `ProductOneToOneEvidenceReference` vêm dos módulos donos, nunca são
 * redeclarados aqui.
 *
 * O contrato público (`SquareBaseInput`) NÃO aceita path, URL, bytes de arte,
 * modelo, qualidade, prompt, prompt base, tamanho de imagem ou decisão de retry:
 * essas decisões pertencem ao módulo. A base de prompt só pode ser substituída em
 * dependência de teste (fora deste contrato).
 */

import type { CostResolution, TokenUsage } from "@/lib/ai-cost/types";
import type { ImageQuality } from "@/lib/ai/image-model-pair";
import type {
  ArtifactRecord,
  AuthorizationContext,
} from "@/lib/campaign/composition-artifacts/types";
import type { ProductOneToOneBackgroundDirection } from "@/lib/product-1-1/background-direction";
import type { ProductOneToOneCopyContext } from "@/lib/product-1-1/copy/default-copy-runner";
import type { ProductOneToOneIntent } from "@/lib/product-1-1/intent-selection";
import type { ProductPromptCompositionBriefing } from "@/lib/product-1-1/policies/types";
import type { ProductOneToOneEvidenceReference } from "@/lib/product-1-1/snapshot/persist-snapshot";
import type { ProviderFailure } from "@/lib/product-9-16-two-stage/types";

/** Alvo explícito da tentativa (a F60 decide qual alvo e quando). */
export type SquareBaseTarget = "primary" | "fallback";

/**
 * Tentativa informada pelo chamador (F60). O módulo apenas registra e
 * correlaciona — não cria contador, não decide repetição e não persiste estado de
 * tentativa.
 */
export interface SquareBaseAttempt {
  /** 1-based, inteiro positivo. */
  readonly number: number;
  /** Alvo explícito desta invocação. */
  readonly target: SquareBaseTarget;
  /** Referência opaca da tentativa, não vazia (até 200 caracteres). */
  readonly reference: string;
}

/**
 * Conteúdo congelado da operação, serializado canonicamente no campo textual
 * `product_1_1_snapshot_frozen_evidence.briefing`.
 *
 * `references` é o fallback legado exigido pela task OpenSpec 3.1: é congelado na
 * primeira composição e usado SOMENTE quando `referenceSelections` está vazio —
 * mesma paridade de `productReferenceIds` em `generation-orchestrator.ts`.
 */
export interface FrozenContentPayload {
  readonly briefing: ProductPromptCompositionBriefing;
  readonly copyContext: ProductOneToOneCopyContext | null;
  readonly identityDirective: string | null;
  readonly campaignIntent: ProductOneToOneIntent;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly referenceSelections: readonly ProductOneToOneEvidenceReference[];
  readonly references?: readonly string[];
  readonly promptBaseVersion: string;
  readonly composerVersion: string;
  readonly policyVersions: Readonly<Record<string, string>>;
}

/**
 * Contrato público fechado. O chamador entrega identidade, autorização já
 * resolvida no servidor, o conteúdo da operação e a tentativa F60; qualquer
 * tentativa de substituir decisões internas é recusada como `invalid_input`.
 */
export interface SquareBaseInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;

  readonly briefing: ProductPromptCompositionBriefing;
  readonly briefingText: string;
  readonly campaignIntent: ProductOneToOneIntent;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  /** Ao menos a imagem principal; data URLs `data:image/`. */
  readonly productImagesDataUrls: readonly string[];
  readonly identityImageUrl?: string;
  /** Primeira execução: congelada; retomada: o congelado é a autoridade. */
  readonly identityDirective?: string;
  readonly references?: readonly string[];
  readonly referenceSelections?: readonly ProductOneToOneEvidenceReference[];

  /** Primeira execução: solicitado se presente; retomada: congelado é a autoridade. */
  readonly copyContext?: ProductOneToOneCopyContext;
  readonly attempt: SquareBaseAttempt;

  readonly usdBrlRateAtGeneration?: number | null;
  readonly creditValueBrlAtGeneration?: number | null;
  readonly runId?: string;
  readonly traceId?: string;
  /** Orçamento restante; só pode ENCURTAR o teto do módulo (180 s). */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

/** Desfecho da arte quadrada. */
export type ArtOutcome =
  | {
      readonly kind: "created";
      readonly artifact: ArtifactRecord;
      readonly snapshotOriginalId: string;
    }
  | {
      readonly kind: "reused";
      readonly artifact: ArtifactRecord;
      readonly adoption: boolean;
      readonly snapshotOriginalId?: string;
    };

/** Desfecho da copy (independente da arte). */
export type CopyOutcome =
  | {
      readonly kind: "completed";
      readonly attemptSeq: number;
      readonly text: string | null;
      readonly payload: Record<string, unknown> | null;
      readonly origin: "generated" | "reused";
    }
  | {
      readonly kind: "failed";
      readonly attemptSeq?: number;
      readonly failureClass: "transient" | "definitive" | null;
      readonly unconfirmed: boolean;
    }
  | { readonly kind: "in_progress"; readonly attemptSeq?: number }
  | { readonly kind: "waiting"; readonly waitRemainingMs: number }
  | { readonly kind: "not_requested" }
  | {
      readonly kind: "unavailable";
      readonly reason:
        | "not_attempted"
        | "acquisition_failed"
        | "read_failed"
        | "attempt_limit"
        | "automatic_closed"
        | "budget_exhausted";
    };

/**
 * Evidência da chamada real (uma por invocação paga). `requestedSize` é um
 * template literal derivado de `PROVIDER_SIZE` (nunca um literal de dimensão
 * duplicado aqui) e `quality` vem do alvo congelado do snapshot. `cost` segue a
 * verdade do contrato de custo: desconhecido é `estimatedCostUsd: null` +
 * `costSource: "not_available"`, nunca zero.
 */
export interface SquareBaseCallEvidence {
  readonly callId: string;
  readonly operationId: string;
  readonly attemptNumber: number;
  readonly attemptReference: string;
  readonly provider: "openai";
  readonly model: string;
  readonly protocol: "images";
  readonly quality: string;
  readonly requestedSize: `${number}x${number}`;
  readonly durationMs: number;
  readonly callStatus: "success" | "failed" | "timeout";
  readonly outcome:
    | "generated"
    | "invalid_output"
    | "provider_failure"
    | "definitive_failure"
    | "unknown"
    | "persistence_failed"
    | "readback_failed";
  readonly usage?: TokenUsage;
  readonly cost: CostResolution;
  readonly errorType?: string;
}

/** Motivos fechados de `snapshot_failed` (inclui a reserva de persistência). */
export type SnapshotFailedReason =
  | "snapshot_persist_failed"
  | "snapshot_read_failed"
  | "evidence_read_failed"
  | "operation_identity_conflict"
  | "frozen_evidence_persist_failed"
  | "persistence_reserve_reached";

/** Aspecto divergente entre conteúdo recebido e conteúdo congelado. */
export type ContentDivergenceReason =
  | "fingerprint"
  | "briefing"
  | "copy_context"
  | "references"
  | "prompt_version"
  | "composer_version"
  | "policy_version";

/** Estados possíveis do estado congelado (um snapshot por campanha). */
export type FrozenStateKind =
  | "absent"
  | "complete"
  | "repairable"
  | "bound_to_other_operation"
  | "unproven"
  | "corrupt"
  | "indeterminate";

/** União fechada e discriminada do resultado da etapa. */
export type SquareBaseResult =
  | {
      readonly kind: "completed";
      readonly copy: CopyOutcome;
      readonly art: ArtOutcome;
      readonly call: SquareBaseCallEvidence | null;
    }
  | {
      readonly kind: "provider_failure";
      readonly copy: CopyOutcome;
      readonly failure: ProviderFailure;
      readonly call: SquareBaseCallEvidence;
    }
  | {
      readonly kind: "definitive_failure";
      readonly copy: CopyOutcome;
      readonly reason:
        | "auth"
        | "quota"
        | "billing"
        | "capability"
        | "content_filter"
        | "invalid_request";
      readonly call: SquareBaseCallEvidence;
    }
  | {
      readonly kind: "unknown_result";
      readonly copy: CopyOutcome;
      readonly reason: "timeout" | "abort" | "comm_lost";
      readonly failure: ProviderFailure;
      readonly call: SquareBaseCallEvidence;
    }
  | {
      readonly kind: "invalid_output";
      readonly copy: CopyOutcome;
      readonly reason: "empty_image" | "decode_failed" | "resize_failed";
      readonly call: SquareBaseCallEvidence;
    }
  | {
      readonly kind: "existing_artifact_conflict";
      readonly copy: CopyOutcome;
      readonly reason:
        | "incompatible"
        | "object_unverified"
        | "object_invalid"
        | "row_object_missing";
      readonly artifact?: ArtifactRecord;
      readonly call: SquareBaseCallEvidence | null;
    }
  | {
      readonly kind: "persistence_failed";
      readonly copy: CopyOutcome;
      readonly reason: "integrity_failure" | "persistence_failure";
      readonly detail: string;
      readonly storagePath?: string;
      readonly call: SquareBaseCallEvidence;
    }
  | {
      readonly kind: "readback_failed";
      readonly copy: CopyOutcome;
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
      readonly detail?: string;
      readonly call: SquareBaseCallEvidence;
    }
  | {
      readonly kind: "snapshot_failed";
      readonly copy: CopyOutcome;
      readonly reason: SnapshotFailedReason;
      readonly call: null;
    }
  | {
      readonly kind: "content_divergence";
      readonly reason: ContentDivergenceReason;
      readonly copy: null;
      readonly call: null;
    }
  | {
      readonly kind: "frozen_state_conflict";
      readonly reason: "bound_to_other_operation" | "unproven" | "corrupt" | "indeterminate";
      readonly copy: null;
      readonly call: null;
    }
  | {
      readonly kind: "blocked";
      readonly copy: CopyOutcome | null;
      readonly reason:
        | "pre_call_probe_indeterminate"
        | "preflight_failed"
        | "persistence_reserve_reached"
        | "frozen_state_read_failed"
        | "frozen_content_invalid"
        | "artifact_without_frozen_state";
      readonly call: null;
    }
  | { readonly kind: "invalid_input"; readonly reason: string }
  | {
      readonly kind: "authorization_denied";
      readonly reason: "not_owner" | "store_mismatch" | "identity_conflict";
    };

/**
 * Snapshot congelado lido do banco (colunas `image_generation_config_snapshots`),
 * já normalizado para camelCase. Um snapshot por campanha.
 */
export interface FrozenSnapshotRecord {
  readonly id: string;
  readonly campaignId: string;
  readonly primaryModel: string;
  readonly primaryQuality: ImageQuality;
  readonly fallbackModel: string;
  readonly fallbackQuality: ImageQuality;
  readonly configVersionId: string;
  readonly origin: "human_decision" | "selection";
  readonly runId: string | null;
  readonly traceId: string | null;
  readonly createdAt: string;
}

/**
 * Evidência congelada lida do banco (colunas
 * `product_1_1_snapshot_frozen_evidence`), já normalizada para camelCase.
 * `briefing` é sempre a string CANÔNICA do `FrozenContentPayload`.
 */
export interface FrozenEvidenceRecord {
  readonly id: string;
  readonly snapshotOriginalId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly campaignIntent: ProductOneToOneIntent;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly briefing: string;
  readonly referenceSelections: readonly ProductOneToOneEvidenceReference[];
  readonly baseVersion: string;
  readonly composerVersion: string;
  readonly policyVersions: Readonly<Record<string, string>>;
}

/** Binding de conteúdo (PK/UNIQUE por `snapshot_original_id`). */
export interface FrozenBindingRecord {
  readonly snapshotOriginalId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly contentFingerprint: string;
}

/** Motivo fechado de estado `corrupt`. */
export type FrozenCorruptReason =
  | "evidence_incoherent"
  | "frozen_content_invalid"
  | "fingerprint_divergent";

/**
 * Resultado da leitura read-only do estado congelado. `snapshot_original_id`
 * (PK do binding, UNIQUE na evidência) é a prova da operação vinculada.
 */
export type FrozenStateReadResult =
  | { readonly kind: "absent" }
  | {
      readonly kind: "complete";
      readonly snapshot: FrozenSnapshotRecord;
      readonly evidence: FrozenEvidenceRecord;
      readonly fingerprint: string;
      readonly payload: FrozenContentPayload;
      readonly snapshotOriginalId: string;
    }
  | {
      readonly kind: "repairable";
      readonly snapshot: FrozenSnapshotRecord;
      readonly fingerprint: string;
      readonly snapshotOriginalId: string;
    }
  | {
      readonly kind: "bound_to_other_operation";
      readonly snapshot: FrozenSnapshotRecord;
      readonly operationId: string;
      readonly snapshotOriginalId: string;
    }
  | {
      readonly kind: "unproven";
      readonly snapshot: FrozenSnapshotRecord;
      readonly snapshotOriginalId: string;
    }
  | { readonly kind: "corrupt"; readonly reason: FrozenCorruptReason }
  | { readonly kind: "indeterminate"; readonly detail: string };

/**
 * Conteúdo recebido na retomada, usado APENAS para comparação. Campos opcionais
 * ausentes são preenchidos pelo congelado antes da comparação; as versões só
 * divergem quando explicitamente informadas (recomposição atual).
 */
export interface SquareBaseReceivedContent {
  readonly briefing?: ProductPromptCompositionBriefing;
  readonly copyContext?: ProductOneToOneCopyContext | null;
  readonly identityDirective?: string | null;
  readonly campaignIntent?: ProductOneToOneIntent;
  readonly backgroundDirection?: ProductOneToOneBackgroundDirection;
  readonly productImagesDataUrls?: readonly string[];
  readonly identityImageUrl?: string;
  readonly references?: readonly string[];
  readonly referenceSelections?: readonly ProductOneToOneEvidenceReference[];
  readonly promptBaseVersion?: string;
  readonly composerVersion?: string;
  readonly policyVersions?: Readonly<Record<string, string>>;
}

/** Resultado da comparação de retomada (nunca lança, nunca escreve). */
export type FrozenContentComparison =
  | {
      readonly ok: true;
      readonly fingerprint: string;
      readonly payload: FrozenContentPayload;
    }
  | { readonly ok: false; readonly reason: ContentDivergenceReason };
