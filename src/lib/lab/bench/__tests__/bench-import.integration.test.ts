// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";

import {
  createLocalDatabase,
  createLocalDestination,
  importOneStore,
} from "../../../../../scripts/lab/48-2-3-bench-import-stores.mjs";

/**
 * Teste integrado REAL (PostgreSQL + Storage locais) do endurecimento da
 * importação (F48.2.3). Cobre em conjunto: ordenação topológica/FK, JSONB,
 * MIME, bucket (`store-brand-assets`/`visual-signatures`), manifesto, auditoria
 * e cleanup. Exige o stack Supabase local ativo e é OPT-IN:
 *   BENCH_IMPORT_REAL_INTEGRATION=1 npm.cmd test -- --run <este arquivo>
 * Sem a env var, o bloco é ignorado (a suíte padrão não depende de infra).
 */
const RUN = process.env.BENCH_IMPORT_REAL_INTEGRATION === "1";
const maybe = RUN ? describe : describe.skip;

const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082",
  "hex",
);

// Estrutura exata observada no remoto: 1 `original` + 5 variantes, com as
// variantes retornadas ANTES do pai (ordem fora de ordem).
const VARIANT_ORDER = ["normalized", "on_dark", "horizontal_safe", "original", "on_light", "square_safe"];

maybe("importação integrada real (PostgreSQL + Storage locais)", () => {
  it("importa 6 assets fora de ordem com FKs, JSONB, MIME, bucket, manifesto e cleanup", async () => {
    const storeId = randomUUID();
    const parentId = randomUUID();
    const signatureId = randomUUID();
    const assetIdByVariant = new Map(
      VARIANT_ORDER.map((variant) => [variant, variant === "original" ? parentId : randomUUID()]),
    );

    const store = {
      id: storeId,
      name: "Loja Teste Integração",
      segment: "eletronicos-tecnologia",
      subsegment: null,
      tone_of_voice: null,
      positioning: null,
      short_description: "loja de teste",
      slogan: null,
      brand_color: "#0F172A",
      identity_state: "logo",
      is_test_store: true,
      updated_at: "2026-09-29T00:00:00.000Z",
    };
    const profile = {
      id: randomUUID(),
      store_id: storeId,
      source: "logo_analysis",
      status: "synced",
      typography_direction: "sans moderna",
      safe_color_tokens: { primary: "#22C55E" },
      brand_colors_chosen: ["#22C55E", null],
      logo_colors_detected: ["#ffffff"],
      visual_style: "clean",
      visual_tone: "caloroso",
      brand_personality: "proxima",
      campaign_guidelines: "sem exageros",
      campaign_brief: "oferta clara",
      inferred_primary_color: "#22C55E",
      active_logo_asset_id: parentId,
      visual_signature_id: signatureId,
      updated_at: "2026-09-29T00:00:00.000Z",
    };
    const assets = VARIANT_ORDER.map((variant) => ({
      id: assetIdByVariant.get(variant),
      store_id: storeId,
      asset_type: "logo",
      variant_type: variant,
      source: "user_upload",
      parent_asset_id: variant === "original" ? null : parentId,
      storage_path: `loja/${variant}.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      size_bytes: PNG_BYTES.length,
      checksum: null,
      version: 1,
      status: "active",
      metadata: { variant },
      updated_at: "2026-09-29T00:00:00.000Z",
    }));
    const signature = {
      id: signatureId,
      store_id: storeId,
      storage_path: "loja/assinatura.png",
      asset_url: null,
      type: "ai_generated",
      status: "active",
      metadata: { note: "sig" },
      updated_at: "2026-09-29T00:00:00.000Z",
    };

    const objectBytes = new Map();
    for (const asset of assets) objectBytes.set(`store-brand-assets:${asset.storage_path}`, "buffer");
    objectBytes.set(`visual-signatures:${signature.storage_path}`, "blob");

    const source = {
      host: "source.local:54321",
      async select(table: string, _columns: string, filters: { maybeSingle?: boolean } = {}) {
        const rows =
          table === "stores"
            ? [store]
            : table === "store_brand_profiles"
              ? [profile]
              : table === "store_brand_assets"
                ? assets
                : table === "store_visual_signatures"
                  ? [signature]
                  : [];
        return filters.maybeSingle ? (rows[0] ?? null) : rows;
      },
      async download(bucket: string, objectPath: string) {
        const kind = objectBytes.get(`${bucket}:${objectPath}`);
        if (!kind) throw new Error(`missing_object:${bucket}:${objectPath}`);
        if (kind === "blob") {
          return {
            type: "image/png",
            async arrayBuffer() {
              return Uint8Array.from(PNG_BYTES).buffer;
            },
          };
        }
        return PNG_BYTES;
      },
    };

    const destination = createLocalDestination();
    const db = createLocalDatabase();
    const query = async <T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> =>
      ((await db.query(text, values)) as { rows: T[] }).rows;
    const manifest = { stores: [] as Array<{ id: string; label: string }> };
    const manifestStore = {
      async load() {
        return { stores: [...manifest.stores] };
      },
      async save(next: { stores: Array<{ id: string; label: string }> }) {
        manifest.stores = next.stores;
      },
    };

    const ownerEmail = `bench-store+${storeId}@bench.local`;

    try {
      const result = await importOneStore({ storeId, source, destination, db, manifestStore, importedBy: "integracao" });
      expect(result.imported).toBe(true);
      expect(result.assetCount).toBe(6);

      const stores = await query<{ id: string; name: string }>("select id, name from public.stores where id = $1", [storeId]);
      expect(stores).toHaveLength(1);

      const assetRows = await query<{ id: string; variant_type: string; parent_asset_id: string | null }>(
        "select id, variant_type, parent_asset_id from public.store_brand_assets where store_id = $1 order by variant_type",
        [storeId],
      );
      expect(assetRows).toHaveLength(6);
      for (const row of assetRows) {
        if (row.variant_type === "original") expect(row.parent_asset_id).toBeNull();
        else expect(row.parent_asset_id).toBe(parentId);
      }

      const profileRows = await query<{
        active_logo_asset_id: string | null;
        visual_signature_id: string | null;
        safe_color_tokens: unknown;
        brand_colors_chosen: unknown;
      }>(
        "select active_logo_asset_id, visual_signature_id, safe_color_tokens, brand_colors_chosen from public.store_brand_profiles where store_id = $1",
        [storeId],
      );
      expect(profileRows).toHaveLength(1);
      expect(profileRows[0].active_logo_asset_id).toBe(parentId);
      expect(profileRows[0].visual_signature_id).toBe(signatureId);
      expect(typeof profileRows[0].safe_color_tokens).toBe("object");
      expect(Array.isArray(profileRows[0].brand_colors_chosen)).toBe(true);

      const sigRows = await query<{ id: string }>("select id from public.store_visual_signatures where store_id = $1", [storeId]);
      expect(sigRows).toHaveLength(1);

      const auditRows = await query<{ status: string; detail: unknown }>(
        "select status, detail from public.lab_bench_store_imports where store_id = $1",
        [storeId],
      );
      expect(auditRows).toHaveLength(1);
      expect(typeof auditRows[0].detail).toBe("object");

      expect(manifest.stores).toContainEqual({ id: storeId, label: "Loja Teste Integração" });

      const objects = await query<{ bucket_id: string; mimetype: string | null; c: number }>(
        "select bucket_id, metadata->>'mimetype' as mimetype, count(*)::int as c from storage.objects where split_part(name,'/',1) = $1 group by bucket_id, metadata->>'mimetype'",
        [storeId],
      );
      const byBucket = Object.fromEntries(objects.map((row) => [row.bucket_id, row]));
      expect(byBucket["store-brand-assets"]?.c).toBe(6);
      expect(byBucket["store-brand-assets"]?.mimetype).toBe("image/png");
      expect(byBucket["visual-signatures"]?.c).toBe(1);
      expect(byBucket["store-logos"]).toBeUndefined();
    } finally {
      // Cleanup integral (FKs desabilitadas dentro da transação).
      await db.query("begin").catch(() => {});
      await db.query("set local session_replication_role = replica").catch(() => {});
      await db.query("delete from public.lab_bench_store_imports where store_id = $1", [storeId]).catch(() => {});
      await db.query("delete from public.store_brand_profiles where store_id = $1", [storeId]).catch(() => {});
      await db.query("delete from public.store_brand_assets where store_id = $1", [storeId]).catch(() => {});
      await db.query("delete from public.store_visual_signatures where store_id = $1", [storeId]).catch(() => {});
      await db.query("delete from public.stores where id = $1", [storeId]).catch(() => {});
      await db.query("delete from auth.users where email = $1", [ownerEmail]).catch(() => {});
      await db.query("commit").catch(() => {});

      const leftovers = await query<{ bucket_id: string; name: string }>(
        "select bucket_id, name from storage.objects where split_part(name,'/',1) = $1",
        [storeId],
      ).catch(() => [] as Array<{ bucket_id: string; name: string }>);
      if (leftovers.length) {
        await destination
          .removeBrandingObjects(leftovers.map((row) => ({ bucket: row.bucket_id, path: row.name })))
          .catch(() => {});
      }
      await db.close().catch(() => {});
    }
  }, 60000);
});
