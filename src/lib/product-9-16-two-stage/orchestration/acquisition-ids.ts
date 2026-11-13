import { isArtifactUuid } from "@/lib/campaign/composition-artifacts/identity";
import type { AcquisitionIds } from "./types";

export type ParseAcquisitionIdsResult =
  | { readonly ok: true; readonly ids: AcquisitionIds }
  | { readonly ok: false; readonly reason: "invalid_pair" | "same_id" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseAcquisitionIds(raw: unknown): ParseAcquisitionIdsResult {
  if (!isRecord(raw)) return Object.freeze({ ok: false as const, reason: "invalid_pair" as const });
  const keys = Object.keys(raw);
  if (keys.length !== 2 || !keys.includes("base") || !keys.includes("expansion")) {
    return Object.freeze({ ok: false as const, reason: "invalid_pair" as const });
  }
  const base = raw.base;
  const expansion = raw.expansion;
  if (!isArtifactUuid(base) || !isArtifactUuid(expansion)) {
    return Object.freeze({ ok: false as const, reason: "invalid_pair" as const });
  }
  const normalizedBase = base.toLowerCase();
  const normalizedExpansion = expansion.toLowerCase();
  if (normalizedBase === normalizedExpansion) {
    return Object.freeze({ ok: false as const, reason: "same_id" as const });
  }
  return Object.freeze({
    ok: true as const,
    ids: Object.freeze({ base: normalizedBase, expansion: normalizedExpansion }),
  });
}

export function newAcquisitionIds(): AcquisitionIds {
  return Object.freeze({
    base: crypto.randomUUID(),
    expansion: crypto.randomUUID(),
  });
}
