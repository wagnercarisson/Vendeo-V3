import "server-only";
import crypto from "crypto";
import { OPENAI_PRICING_SOURCE_URL } from "./openai-pricing-inventory";

/**
 * Leitura pública da página oficial de preços (Markdown), sem chave OpenAI.
 *
 * - timeout curto e limite de tamanho;
 * - redirects NÃO são seguidos (evita origem não autorizada);
 * - só aceita a origem oficial;
 * - hash/ETag/Last-Modified são evidências auxiliares, nunca prova de sucesso
 *   nem data de vigência.
 */

const ALLOWED_ORIGIN = "https://developers.openai.com";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_DOCUMENT_BYTES = 2_000_000;

export class OpenAiPricingFetchError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "OpenAiPricingFetchError";
  }
}

export interface FetchedOpenAiPricingDocument {
  sourceUrl: string;
  content: string;
  contentHash: string;
  etag: string | null;
  lastModified: string | null;
}

export type OpenAiPricingFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function isAllowedUrl(value: string): boolean {
  try {
    return new URL(value).origin === ALLOWED_ORIGIN;
  } catch {
    return false;
  }
}

export async function fetchOpenAiPricingDocument(
  fetchImpl: OpenAiPricingFetch = fetch,
): Promise<FetchedOpenAiPricingDocument> {
  let response: Response;
  try {
    response = await fetchImpl(OPENAI_PRICING_SOURCE_URL, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        accept: "text/markdown, text/plain;q=0.9",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OpenAiPricingFetchError("timeout");
    }
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new OpenAiPricingFetchError("timeout");
    }
    throw new OpenAiPricingFetchError("network_error");
  }

  if (response.status >= 300 && response.status < 400) {
    throw new OpenAiPricingFetchError("unexpected_redirect");
  }
  if (!response.ok) {
    throw new OpenAiPricingFetchError(`http_${response.status}`);
  }
  if (response.url && !isAllowedUrl(response.url)) {
    throw new OpenAiPricingFetchError("unexpected_origin");
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType && !/^text\/(markdown|plain|x-markdown)/.test(contentType)) {
    throw new OpenAiPricingFetchError("unexpected_content_type");
  }

  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DOCUMENT_BYTES) {
    throw new OpenAiPricingFetchError("document_too_large");
  }

  let content: string;
  try {
    content = await response.text();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OpenAiPricingFetchError("timeout");
    }
    throw new OpenAiPricingFetchError("read_failed");
  }

  if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES) {
    throw new OpenAiPricingFetchError("document_too_large");
  }
  if (!content.includes("# Pricing")) {
    throw new OpenAiPricingFetchError("unexpected_document");
  }

  return {
    sourceUrl: OPENAI_PRICING_SOURCE_URL,
    content,
    contentHash: crypto.createHash("sha256").update(content, "utf8").digest("hex"),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}
