import { createHash } from "node:crypto";

/**
 * F56.2.2-04 (correção de integração — B1) — conversão da identidade visual da
 * loja para o formato `data URL` ACEITO pelo adapter do novo fluxo.
 *
 * Por que existe: `resolveStoreIdentity` produz a identidade a partir de uma
 * **URL assinada HTTPS rotativa** (`createSignedUrl(..., 3600)`). O
 * `UpstreamImagesAdapter` (`src/lib/ai/adapters/upstream-images.ts`,
 * `dataUrlToFile`) aceita SOMENTE `data:image/png|jpeg|webp;base64,...`; enviar
 * a URL assinada faz a geração FALHAR antes da chamada ao modelo.
 *
 * Esta função baixa os BYTES da imagem de identidade de uma fonte CONFIÁVEL (a
 * URL assinada gerada server-side) com LIMITES explícitos e devolve o `data URL`
 * aceito + o identificador ESTÁVEL de CONTEÚDO (SHA-256 dos bytes). A URL
 * assinada rotativa NUNCA define a identidade: rotacionar a URL com os MESMOS
 * bytes mantém o mesmo `contentId`.
 *
 * Segurança/limites (falha ⇒ `null` ⇒ sem imagem de identidade, text-only):
 * - timeout de download;
 * - teto de bytes EFETIVO: o corpo é lido em CHUNKS (`response.body.getReader()`)
 *   e o reader é CANCELADO assim que o número de bytes REALMENTE recebidos
 *   excede o teto — nunca confia apenas no `content-length` declarado (que pode
 *   estar ausente ou INCORRETO); o `content-length` permanece apenas como
 *   fast-path de rejeição;
 * - whitelist de `content-type` `image/png|jpeg|webp`.
 *
 * Nenhuma chamada a provider/IA: apenas `fetch` de leitura.
 */

/** Content-types aceitos pelo adapter de imagem do novo fluxo. */
export const IDENTITY_IMAGE_ALLOWED_MIME_TYPES = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
] as const);

export type IdentityImageMimeType = (typeof IDENTITY_IMAGE_ALLOWED_MIME_TYPES)[number];

/** Timeout padrão do download da imagem de identidade (ms). */
export const IDENTITY_IMAGE_DOWNLOAD_TIMEOUT_MS = 5000;

/** Teto padrão de bytes da imagem de identidade baixada. */
export const IDENTITY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Resultado da conversão: data URL aceito + id ESTÁVEL de conteúdo. */
export interface ResolvedIdentityImage {
  /** `data:image/png|jpeg|webp;base64,...` — o formato aceito pelo adapter. */
  readonly dataUrl: string;
  /** SHA-256 (hex) dos BYTES da imagem — id de conteúdo (NUNCA a URL). */
  readonly contentId: string;
  readonly mimeType: IdentityImageMimeType;
  readonly byteLength: number;
}

export interface ResolveIdentityImageDeps {
  /** `fetch` injetável em teste (default: `globalThis.fetch`). */
  readonly fetchFn?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

function normalizeMimeType(contentType: string | null): IdentityImageMimeType | null {
  const value = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  return (IDENTITY_IMAGE_ALLOWED_MIME_TYPES as readonly string[]).includes(value)
    ? (value as IdentityImageMimeType)
    : null;
}

/**
 * Baixa a imagem de identidade da URL fornecida e devolve o `data URL` aceito
 * pelo adapter + o id de conteúdo estável. Devolve `null` em QUALQUER falha ou
 * violação de limite (a identidade cai para text-only, consistente com
 * `validateIdentityReference` anulando a URL).
 */
export async function resolveIdentityImageAsDataUrl(
  url: string | null | undefined,
  deps: ResolveIdentityImageDeps = {},
): Promise<ResolvedIdentityImage | null> {
  if (!url) return null;

  const fetchFn = deps.fetchFn ?? fetch;
  const timeoutMs = deps.timeoutMs ?? IDENTITY_IMAGE_DOWNLOAD_TIMEOUT_MS;
  const maxBytes = deps.maxBytes ?? IDENTITY_IMAGE_MAX_BYTES;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const mimeType = normalizeMimeType(response.headers.get("content-type"));
    if (!mimeType) return null;

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;

    // Teto EFETIVO — lê o corpo em CHUNKS e CANCELA o reader assim que o número
    // de bytes REALMENTE recebidos excede o teto. `arrayBuffer()` bufferizaria o
    // corpo INTEIRO antes da checagem (memória ilimitada sem `content-length`
    // confiável); aqui a leitura para no primeiro chunk que estoura o teto.
    // O `content-length` declarado NÃO é a única guarda (é só o fast-path acima).
    const reader = response.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          // Estourou o teto pelos bytes REAIS ⇒ cancela (não bufferiza o resto).
          await reader.cancel().catch(() => undefined);
          return null;
        }
        chunks.push(value);
      }
    } catch {
      // Falha de leitura (inclui abort por timeout) ⇒ cancela e cai para text-only.
      await reader.cancel().catch(() => undefined);
      return null;
    }

    if (totalBytes === 0) return null;

    const buffer = Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk)),
      totalBytes,
    );
    if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) return null;

    return {
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
      contentId: createHash("sha256").update(buffer).digest("hex"),
      mimeType,
      byteLength: buffer.byteLength,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
