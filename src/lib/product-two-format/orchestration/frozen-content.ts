import { createHash } from "node:crypto";

/**
 * F60.7 C1 — hash estável do conteúdo congelado da campanha conjunta.
 *
 * Mesmo contrato do novo fluxo 9:16: serialização com chaves ordenadas, sem o
 * `id` volátil das imagens e sem as chaves de IDENTIDADE DURÁVEL/volátil
 * (`jointResumeContext`, `resumeContext`, `frozenContentReferences`). O JSON
 * round-trip alinha a representação em memória à representação JSONB
 * persistida (campos `undefined` não sobrevivem).
 */
export const FROZEN_CONTENT_REFERENCES_KEY = "frozenContentReferences" as const;

/** Chaves que NUNCA entram no hash de conteúdo. */
export const VOLATILE_SNAPSHOT_KEYS = Object.freeze([
  FROZEN_CONTENT_REFERENCES_KEY,
  "resumeContext",
  "jointResumeContext",
] as const);

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, inner]) => `${JSON.stringify(key)}:${stableStringify(inner)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Remove o `id` volátil (uuid por chamada) das imagens do snapshot congelado. */
export function canonicalFrozenSnapshot(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const media = snapshot.media as { images?: unknown } | undefined;
  const images =
    media && Array.isArray(media.images)
      ? (media.images as Record<string, unknown>[]).map((image) => ({
          role: image.role ?? null,
          source: image.source ?? null,
          mimeType: image.mimeType ?? null,
          provided: image.provided ?? null,
        }))
      : [];
  return { ...snapshot, media: { ...(media ?? {}), images } };
}

/** Hash estável do conteúdo congelado (snapshot canônico + seleções de conteúdo). */
export function computeFrozenContentHash(
  snapshot: Record<string, unknown>,
  references: readonly unknown[],
): string {
  const normalized = JSON.parse(
    JSON.stringify({ snapshot: canonicalFrozenSnapshot(snapshot), references }),
  ) as { snapshot: Record<string, unknown>; references: readonly unknown[] };
  return createHash("sha256")
    .update(stableStringify(normalized))
    .digest("hex");
}

/** Remove as chaves voláteis antes de comparar o conteúdo persistido. */
export function stripVolatileSnapshotKeys(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const copy = { ...snapshot };
  for (const key of VOLATILE_SNAPSHOT_KEYS) {
    delete copy[key];
  }
  return copy;
}
