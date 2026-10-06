import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PUBLIC_GENERATION_FAILURE_CODE,
  buildPublicGenerationFailure,
  generateSupportReference,
  normalizeDiagnosisErrorCode,
  sanitizeDiagnosisText,
  type ImageGenerationDiagnosisInput,
  type ImageGenerationFailureTarget,
  type ImageGenerationInternalDiagnosis,
} from "./image-generation-support-reference";

/**
 * Repositório **server-only** e **durável** do diagnóstico de falha do novo
 * fluxo (F56.1, D-19/D-26).
 *
 * A referência de atendimento opaca (UUID v4) e o diagnóstico interno são
 * persistidos em `public.image_generation_failure_diagnoses` e recuperados por
 * uma **nova instância do repositório/requisição** — um store em memória não
 * cumpre o contrato de suporte (D-26).
 *
 * Segue o **seam de client injetável** de `ai-model-selection-service.ts`: o
 * cliente Supabase é recebido no construtor, permitindo que testes de
 * durabilidade construam clientes/instâncias independentes. O `normalized_error`
 * é reduzido a um **código do conjunto fechado** (`normalizeDiagnosisErrorCode`)
 * e a `message_public` é sanitizada ANTES de persistir — nunca gravar texto
 * cru/chave/URL. Nenhuma chamada de provider.
 */

/** Resultado da gravação: a referência opaca que o lojista recebe. */
export interface RecordImageGenerationDiagnosisResult {
  reference: string;
}

/** Contrato do repositório durável de diagnósticos de falha. */
export interface ImageGenerationDiagnosisRepository {
  recordDiagnosis(
    input: ImageGenerationDiagnosisInput,
  ): Promise<RecordImageGenerationDiagnosisResult>;
  findByReference(reference: string): Promise<ImageGenerationInternalDiagnosis | null>;
}

/** Linha crua da tabela `image_generation_failure_diagnoses` (snake_case). */
interface ImageGenerationFailureDiagnosisRow {
  reference: string;
  internal_category: string;
  model: string | null;
  quality: string | null;
  target: ImageGenerationFailureTarget | null;
  attempt_number: number | null;
  normalized_error: string | null;
  run_id: string | null;
  trace_id: string | null;
}

const TABLE = "image_generation_failure_diagnoses";

const SELECT_COLUMNS =
  "reference, internal_category, model, quality, target, attempt_number, normalized_error, run_id, trace_id";

function mapRowToDiagnosis(row: ImageGenerationFailureDiagnosisRow): ImageGenerationInternalDiagnosis {
  return {
    reference: row.reference,
    internalCategory: row.internal_category,
    model: row.model ?? "",
    quality: row.quality ?? "",
    target: row.target ?? "primary",
    attemptNumber: row.attempt_number ?? 1,
    normalizedError: row.normalized_error ?? "",
    ...(row.run_id !== null ? { runId: row.run_id } : {}),
    ...(row.trace_id !== null ? { traceId: row.trace_id } : {}),
  };
}

/**
 * Implementação Supabase-backed do repositório durável. O cliente é injetado para
 * permitir provas de durabilidade com instâncias/ requisições independentes.
 */
export class SupabaseImageGenerationDiagnosisRepository
  implements ImageGenerationDiagnosisRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async recordDiagnosis(
    input: ImageGenerationDiagnosisInput,
  ): Promise<RecordImageGenerationDiagnosisResult> {
    const providedReference = input.reference?.trim();
    const reference = providedReference ? providedReference : generateSupportReference();

    // A referência é o elo público↔interno; a mensagem pública é derivada da mesma
    // ocorrência e ambos são persistidos no MESMO INSERT.
    const publicFailure = buildPublicGenerationFailure({ ...input, reference });

    const { error } = await this.client.from(TABLE).insert({
      reference,
      code: PUBLIC_GENERATION_FAILURE_CODE,
      internal_category: input.internalCategory,
      model: input.model ?? null,
      quality: input.quality ?? null,
      target: input.target ?? null,
      attempt_number: input.attemptNumber ?? null,
      // Código do conjunto fechado ANTES de persistir (D-19): nunca grava o texto
      // cru do provider — entrada desconhecida vira `unknown_provider_error`.
      normalized_error: normalizeDiagnosisErrorCode(input.normalizedError),
      run_id: input.runId ?? null,
      trace_id: input.traceId ?? null,
      message_public: sanitizeDiagnosisText(publicFailure.message),
    });

    if (error) {
      throw new Error(`image_generation_failure_diagnosis_insert_failed:${error.message}`);
    }

    return { reference };
  }

  async findByReference(reference: string): Promise<ImageGenerationInternalDiagnosis | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select(SELECT_COLUMNS)
      .eq("reference", reference)
      .maybeSingle<ImageGenerationFailureDiagnosisRow>();

    if (error) {
      throw new Error(`image_generation_failure_diagnosis_read_failed:${error.message}`);
    }
    if (!data) return null;

    return mapRowToDiagnosis(data);
  }
}
