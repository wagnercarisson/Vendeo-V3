import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createBenchBrandingSignedUrl } from "../persistence/bench-branding-signer";
import type {
  BenchIdentityReference,
  BenchIdentityState,
} from "../domain/resolve-bench-identity";

/**
 * Transporte canônico da identidade visual da bancada (F48.2.4, D10).
 *
 * Este módulo **consome** a `identityReference` **já resolvida** por
 * `loadBenchBranding` (via `resolveBenchIdentity`) e a converte em um data URL
 * transitório para a invocação do modelo. Ele **não** re-invoca
 * `resolveBenchIdentity` em `POST /runs` e **não** escolhe variante/tipo de
 * identidade — a única validação adicional é a **compatibilidade** entre
 * `identityState` e `identityReference.kind`.
 *
 * Regras (fail-closed, antes da chamada paga):
 *  - `text_only` → `null` (nenhuma imagem de identidade); referência não nula é
 *    incompatível;
 *  - `logo` → a referência tem de ser `kind: "logo"`; `visual_signature` → a
 *    referência tem de ser `kind: "visual_signature"`;
 *  - referência ausente quando exigida, arquivo indisponível, download falho ou
 *    URL assinada que não pôde ser gerada ⇒ `BenchIdentityTransportError` com
 *    código `bench_identity_reference_unavailable`, **sem** fallback para outra
 *    variante/tipo.
 *
 * A URL assinada é **transitória**: é usada apenas como gate do signer restrito
 * de branding (allowlist de bucket/path, TTL do servidor) e **nunca** é
 * persistida; o retorno é somente o data URL. Nenhum secret é exposto.
 */

// ─── Erros determinísticos ───────────────────────────────────────────────────

export type BenchIdentityTransportErrorCode =
  | "bench_identity_reference_unavailable"
  | "bench_identity_reference_incompatible";

/** Erro determinístico do transporte de identidade (falha antes da chamada paga). */
export class BenchIdentityTransportError extends Error {
  readonly code: BenchIdentityTransportErrorCode;

  constructor(code: BenchIdentityTransportErrorCode, detail: string) {
    super(`${code}:${detail}`);
    this.name = "BenchIdentityTransportError";
    this.code = code;
  }
}

// ─── Mapeamento kind → bucket restrito (paridade com o loader de branding) ────

const IDENTITY_BUCKET_BY_KIND: Record<BenchIdentityReference["kind"], string> = {
  logo: "store-brand-assets",
  visual_signature: "visual-signatures",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Resolve o MIME do objeto baixado (cabeçalho do storage; fallback pela extensão). */
function resolveImageMime(declaredType: string | undefined, storagePath: string): string {
  if (declaredType && declaredType.startsWith("image/")) return declaredType;
  const extension = storagePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "image/png";
}

/**
 * Resolve o data URL da identidade canônica **já resolvida** por
 * `loadBenchBranding`. Pura em relação à identidade: **não** re-resolve nem
 * substitui variante/tipo. `client` entra por parâmetro (fakes em testes —
 * nenhuma chamada de rede/paga nos testes).
 */
export async function resolveBenchIdentityImageDataUrl(params: {
  client: SupabaseClient;
  identityState: BenchIdentityState;
  identityReference: BenchIdentityReference | null;
}): Promise<string | null> {
  const { client, identityState, identityReference } = params;

  // `text_only`: nenhuma imagem de identidade — referência nula esperada.
  if (identityState === "text_only") {
    if (identityReference) {
      throw new BenchIdentityTransportError(
        "bench_identity_reference_incompatible",
        `text_only:${identityReference.kind}`,
      );
    }
    return null;
  }

  // Estado reconhecido com imagem exigida (`logo`/`visual_signature`).
  if (identityState === "logo" || identityState === "visual_signature") {
    if (!identityReference) {
      throw new BenchIdentityTransportError(
        "bench_identity_reference_unavailable",
        `${identityState}:missing_reference`,
      );
    }
    if (identityReference.kind !== identityState) {
      // Nunca substituir logo por assinatura (ou vice-versa).
      throw new BenchIdentityTransportError(
        "bench_identity_reference_incompatible",
        `${identityState}:${identityReference.kind}`,
      );
    }

    const bucket = IDENTITY_BUCKET_BY_KIND[identityReference.kind];
    const storagePath = identityReference.storagePath;

    // Gate do signer restrito de branding (allowlist de bucket/path, TTL do
    // servidor). A URL assinada é transitória — nunca persistida nem retornada.
    try {
      await createBenchBrandingSignedUrl({ client, bucket, path: storagePath });
    } catch {
      throw new BenchIdentityTransportError(
        "bench_identity_reference_unavailable",
        `${identityState}:sign_failed`,
      );
    }

    // Baixa o objeto selecionado (arquivo ausente/erro ⇒ indisponível).
    let buffer: Buffer;
    let declaredType: string | undefined;
    try {
      const { data, error } = await client.storage.from(bucket).download(storagePath);
      if (error || !data) {
        throw new Error("bench_identity_download_failed");
      }
      declaredType = typeof (data as { type?: unknown }).type === "string"
        ? ((data as { type: string }).type)
        : undefined;
      buffer = Buffer.from(await (data as Blob).arrayBuffer());
    } catch {
      throw new BenchIdentityTransportError(
        "bench_identity_reference_unavailable",
        `${identityState}:download_failed`,
      );
    }

    if (buffer.length === 0) {
      throw new BenchIdentityTransportError(
        "bench_identity_reference_unavailable",
        `${identityState}:empty_object`,
      );
    }

    const mimeType = resolveImageMime(declaredType, storagePath);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  // Estado ausente/desconhecido: fail-closed, sem conversão silenciosa.
  throw new BenchIdentityTransportError(
    "bench_identity_reference_incompatible",
    `unknown_identity_state:${String(identityState)}`,
  );
}
