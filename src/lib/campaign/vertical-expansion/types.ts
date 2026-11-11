/**
 * F60.3 — Contrato puro da expansão por IA da campanha 1:1 → 9:16.
 *
 * Este módulo é puro: roda em qualquer runtime, sem dependência de servidor,
 * sem processamento de imagem, sem cliente de banco/armazenamento, sem
 * criptografia e sem acesso a filesystem. Ele apenas reusa, por tipo, os
 * contratos da F60/F60.1 e descreve a entrada, a evidência da chamada e a
 * união discriminada de resultado.
 *
 * Nenhum papel, dimensão, MIME, classe de falha, uso de tokens ou resolução de
 * custo é redefinido aqui: `ArtifactRecord`, `AuthorizationContext`,
 * `ProviderFailure`, `ProviderFailureClass`, `CostResolution` e `TokenUsage`
 * vêm dos módulos donos.
 */

import type { CostResolution, TokenUsage } from "@/lib/ai-cost/types";
import type {
  ArtifactRecord,
  AuthorizationContext,
} from "@/lib/campaign/composition-artifacts/types";
import type {
  ProviderFailure,
  ProviderFailureClass,
} from "@/lib/product-9-16-two-stage/types";

/** Identidade de origem: sempre o quadrado preparado interno (1:1 JPEG). */
export interface ExpandVerticalSourceIdentity {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: "square_prepared";
}

/**
 * Tentativa informada pelo chamador (F60). O módulo apenas registra — não cria
 * contador, não decide repetição e não persiste estado de tentativa.
 */
export interface ExpandVerticalAttempt {
  /** 1-based, inteiro positivo. */
  readonly number: number;
  /** Referência opaca da tentativa, não vazia (até 200 caracteres). */
  readonly reference: string;
}

export interface ExpandVerticalInput {
  readonly source: ExpandVerticalSourceIdentity;
  /** Operação 9:16 de destino e chave de correlação de custo. */
  readonly operationId: string;
  readonly attempt: ExpandVerticalAttempt;
  /** Contexto derivado no servidor; o chamador não escolhe o dono da loja. */
  readonly authorization: AuthorizationContext;
  /** Prazo do chamador; só pode encurtar o teto do módulo. */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

/**
 * Evidência da chamada real (uma por invocação paga). `returnedSize` é medido
 * dos bytes devolvidos, nunca copiado do tamanho solicitado. `cost` segue a
 * verdade do contrato de custo: desconhecido é `estimatedCostUsd: null` +
 * `costSource: "not_available"`, nunca zero.
 */
export interface ExpansionCallEvidence {
  readonly callId: string;
  readonly operationId: string;
  readonly attemptNumber: number;
  readonly attemptReference: string;
  readonly provider: string;
  readonly model: string;
  readonly protocol: "images";
  readonly quality: "low";
  readonly requestedSize: "1152x2048";
  readonly returnedSize: string | null;
  readonly durationMs: number;
  readonly callStatus: "success" | "failed" | "timeout";
  readonly outcome:
    | "expanded"
    | "invalid_output"
    | "provider_failure"
    | "unknown"
    | "persistence_failed";
  readonly usage?: TokenUsage;
  readonly cost: CostResolution;
  readonly errorType?: string;
}

/** Motivos fechados de entrada recusada antes de qualquer I/O. */
export type ExpansionInvalidReason =
  | "input_not_object"
  | "source_identity_invalid"
  | "source_role_not_prepared"
  | "operation_id_invalid"
  | "attempt_number_invalid"
  | "attempt_reference_invalid"
  | "authorization_missing"
  | "timeout_invalid"
  | "path_not_accepted"
  | "url_not_accepted"
  | "bytes_not_accepted"
  | "model_not_accepted"
  | "quality_not_accepted"
  | "prompt_not_accepted"
  | "size_not_accepted";

export type ExpandVerticalResult =
  | {
      readonly kind: "expanded";
      readonly artifact: ArtifactRecord;
      readonly bytes: Buffer;
      readonly persistence: "created";
      readonly call: ExpansionCallEvidence;
    }
  | {
      readonly kind: "reused";
      readonly artifact: ArtifactRecord;
      readonly bytes: Buffer;
      readonly adoption: boolean;
      readonly call: ExpansionCallEvidence | null;
    }
  | { readonly kind: "invalid_input"; readonly reason: ExpansionInvalidReason }
  | {
      readonly kind: "authorization_denied";
      readonly reason: "not_owner" | "store_mismatch" | "identity_conflict";
    }
  | {
      readonly kind: "source_unavailable";
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
      readonly detail?: string;
    }
  | {
      readonly kind: "model_unavailable";
      readonly reason:
        | "catalog_row_missing"
        | "catalog_read_failed"
        | "unsupported_protocol"
        | "quality_not_eligible";
      readonly detail?: string;
    }
  | {
      readonly kind: "pricing_unavailable";
      readonly reason: "row_missing" | "code_default" | "incomplete_coverage";
      readonly missing?: readonly string[];
    }
  | {
      readonly kind: "existing_artifact_conflict";
      readonly reason:
        | "incompatible"
        | "object_unverified"
        | "object_invalid"
        | "row_object_missing";
      readonly artifact?: ArtifactRecord;
    }
  | {
      readonly kind: "provider_failure";
      readonly failure: ProviderFailure & {
        readonly class: Extract<ProviderFailureClass, "transient" | "definitive">;
      };
      readonly call: ExpansionCallEvidence;
    }
  | {
      readonly kind: "definitive_failure";
      readonly reason:
        | "auth"
        | "quota"
        | "billing"
        | "capability"
        | "content_filter"
        | "invalid_request";
      readonly call: ExpansionCallEvidence;
    }
  | {
      readonly kind: "unknown_result";
      readonly reason: "timeout" | "abort" | "comm_lost";
      readonly failure: ProviderFailure & { readonly class: "unknown" };
      readonly call: ExpansionCallEvidence;
    }
  | {
      readonly kind: "invalid_output";
      readonly reason:
        | "decode_failed"
        | "dimensions_mismatch"
        | "aspect_mismatch"
        | "not_image";
      readonly returnedSize: string | null;
      readonly call: ExpansionCallEvidence;
    }
  | {
      readonly kind: "export_failed";
      readonly reason:
        | "source_decode_failed"
        | "source_dimension_mismatch"
        | "source_aspect_mismatch"
        | "artifact_format_not_jpeg"
        | "artifact_dimension_mismatch";
      readonly call: ExpansionCallEvidence;
    }
  | {
      readonly kind: "conflict";
      readonly reason:
        | "content_conflict"
        | "identity_conflict"
        | "metadata_conflict"
        | "provenance_conflict";
      readonly detail: string;
      readonly existing: ArtifactRecord | null;
      readonly call: ExpansionCallEvidence;
    }
  | {
      readonly kind: "persistence_failed";
      readonly reason: "integrity_failure" | "persistence_failure";
      readonly detail: string;
      readonly storagePath?: string;
      readonly call: ExpansionCallEvidence;
    }
  | {
      readonly kind: "readback_failed";
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
      readonly detail?: string;
      readonly call: ExpansionCallEvidence;
    }
  | {
      readonly kind: "blocked";
      readonly reason: "pre_call_probe_indeterminate";
      readonly call: null;
    };
