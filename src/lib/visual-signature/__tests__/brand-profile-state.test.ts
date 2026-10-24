import { describe, expect, it } from "vitest";
import {
  buildBrandProfileContext,
  deriveBrandProfileState,
  type BrandProfileSnapshotFields,
  type BrandProfileStateRecord,
} from "../brand-profile-state";

const SNAPSHOT: BrandProfileSnapshotFields = {
  segment: "moda",
  subsegment: "calcados",
  tone_of_voice: "jovem",
  name: "Loja",
  positioning: null,
  short_description: null,
  slogan: null,
};

function record(params: {
  id: string;
  source: string;
  status: string;
  assetId?: string | null;
  snapshot?: BrandProfileSnapshotFields;
  at: string;
}): BrandProfileStateRecord {
  const origin =
    params.source === "logo_analysis"
      ? "logo_analysis"
      : params.source === "text_only"
        ? "text_only"
        : "without_logo";
  const context = buildBrandProfileContext({
    origin,
    assetId: params.assetId ?? null,
    inputSnapshot: params.snapshot ?? SNAPSHOT,
  });
  return {
    id: params.id,
    source: params.source,
    status: params.status,
    created_at: params.at,
    updated_at: params.at,
    visual_signature_id: origin === "without_logo" ? params.assetId ?? null : null,
    active_logo_asset_id: origin === "logo_analysis" ? params.assetId ?? null : null,
    metadata: {
      input_snapshot: context.inputSnapshot,
      context_hash: context.contextHash,
    },
  };
}

describe("F47.2 — atualidade do perfil por origem e ativo", () => {
  it("assinatura atual é o perfil synced do contexto corrente", () => {
    const derived = deriveBrandProfileState({
      records: [record({ id: "p1", source: "without_logo", status: "synced", assetId: "vs1", at: "2026-10-24T10:00:00Z" })],
      activeOrigin: "without_logo",
      activeAssetId: "vs1",
      currentSnapshot: SNAPSHOT,
    });
    expect(derived.state).toBe("current");
    expect(derived.current?.id).toBe("p1");
  });

  it("troca de ativo com texto idêntico não mantém o perfil anterior como atual", () => {
    const derived = deriveBrandProfileState({
      records: [record({ id: "p1", source: "without_logo", status: "synced", assetId: "vs1", at: "2026-10-24T10:00:00Z" })],
      activeOrigin: "without_logo",
      activeAssetId: "vs2",
      currentSnapshot: SNAPSHOT,
    });
    expect(derived.current).toBeNull();
    expect(derived.previous.map((item) => item.id)).toEqual(["p1"]);
  });

  it("falha mais recente não promove o perfil anterior", () => {
    const derived = deriveBrandProfileState({
      records: [
        record({ id: "p1", source: "without_logo", status: "synced", assetId: "vs1", at: "2026-10-24T10:00:00Z" }),
        record({ id: "f1", source: "without_logo", status: "failed", assetId: "vs1", at: "2026-10-24T11:00:00Z" }),
      ],
      activeOrigin: "without_logo",
      activeAssetId: "vs1",
      currentSnapshot: SNAPSHOT,
    });
    expect(derived.state).toBe("failed");
    expect(derived.lastFailure?.id).toBe("f1");
  });

  it("sem asset removido identificado não há fallback", () => {
    const derived = deriveBrandProfileState({
      records: [record({ id: "l1", source: "logo_analysis", status: "synced", assetId: "logo1", at: "2026-10-24T10:00:00Z" })],
      activeOrigin: "text_only",
      activeAssetId: null,
      currentSnapshot: SNAPSHOT,
      fallbackLogoAssetId: null,
    });
    expect(derived.current).toBeNull();
    expect(derived.currentKind).toBeNull();
  });

  it("perfil de outro logo não é usado como fallback", () => {
    const derived = deriveBrandProfileState({
      records: [record({ id: "l1", source: "logo_analysis", status: "synced", assetId: "logo-outro", at: "2026-10-24T10:00:00Z" })],
      activeOrigin: "text_only",
      activeAssetId: null,
      currentSnapshot: SNAPSHOT,
      fallbackLogoAssetId: "logo-removido",
    });
    expect(derived.current).toBeNull();
    expect(derived.currentKind).toBeNull();
  });

  it("perfil de logo removido permanece fallback atual", () => {
    const derived = deriveBrandProfileState({
      records: [record({ id: "l1", source: "logo_analysis", status: "synced", assetId: "logo1", at: "2026-10-24T10:00:00Z" })],
      activeOrigin: "text_only",
      activeAssetId: null,
      currentSnapshot: SNAPSHOT,
      fallbackLogoAssetId: "logo1",
    });
    expect(derived.current?.id).toBe("l1");
    expect(derived.currentKind).toBe("logo_removed_fallback");
  });
});
