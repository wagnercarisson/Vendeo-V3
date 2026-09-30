// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveBenchIdentityImageDataUrl,
  BenchIdentityTransportError,
} from "@/lib/lab/bench/execution/bench-identity-transport";
import type { BenchIdentityReference } from "@/lib/lab/bench/domain/resolve-bench-identity";

/**
 * Contrato do **transporte canônico da identidade** (F48.2.4, D10 / spec
 * lab-bench-identity-transport).
 *
 * Prova que: (a) `logo`/`visual_signature` assinam o `storagePath` já resolvido
 * e devolvem o data URL do objeto selecionado; (b) `text_only` não envia imagem;
 * (c) a única validação adicional é a compatibilidade `identityState`×`kind`;
 * (d) o transporte **consome** a referência já resolvida (sem re-resolver);
 * (e) indisponível falha com `bench_identity_reference_unavailable` antes de
 * qualquer chamada paga, sem fallback; e (f) a URL assinada é transitória e
 * nunca retornada/persistida.
 *
 * O signer restrito de branding é **mockado** e o storage é um **fake em
 * memória** — nenhuma chamada de rede e nenhuma chamada paga.
 */

const state = vi.hoisted(() => ({
  signCalls: [] as Array<{ bucket: string; path: string }>,
  signFails: false,
}));

vi.mock("@/lib/lab/bench/persistence/bench-branding-signer", () => ({
  createBenchBrandingSignedUrl: async (params: { bucket: string; path: string }) => {
    state.signCalls.push({ bucket: params.bucket, path: params.path });
    if (state.signFails) throw new Error("bench_branding_signed_url_failed");
    return "https://signed.example/transient-token";
  },
}));

// ─── Fake de storage em memória ──────────────────────────────────────────────

interface StoredObject {
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

class FakeStorage {
  private readonly objects = new Map<string, StoredObject>();

  put(bucket: string, storagePath: string, bytes: Buffer, type = "image/png"): void {
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    this.objects.set(`${bucket}/${storagePath}`, { type, arrayBuffer: async () => arrayBuffer });
  }

  from(bucket: string) {
    return {
      download: async (storagePath: string) => {
        const object = this.objects.get(`${bucket}/${storagePath}`);
        if (!object) return { data: null, error: { message: "not_found" } };
        return { data: object, error: null };
      },
    };
  }
}

const LOGO_BYTES = Buffer.from("LOGO");
const SIG_BYTES = Buffer.from("SIG");
const LOGO_REF: BenchIdentityReference = {
  kind: "logo",
  variantType: "normalized",
  storagePath: "store-1/logo-normalized.png",
};
const SIG_REF: BenchIdentityReference = {
  kind: "visual_signature",
  variantType: null,
  storagePath: "store-1/signature.png",
};

let storage: FakeStorage;
let client: SupabaseClient;

beforeEach(() => {
  state.signCalls.length = 0;
  state.signFails = false;
  storage = new FakeStorage();
  storage.put("store-brand-assets", LOGO_REF.storagePath, LOGO_BYTES);
  storage.put("visual-signatures", SIG_REF.storagePath, SIG_BYTES, "image/png");
  client = { storage } as unknown as SupabaseClient;
});

describe("resolveBenchIdentityImageDataUrl — 3 estados da identidade", () => {
  it("logo: assina o storagePath já resolvido e devolve o data URL do logo", async () => {
    const result = await resolveBenchIdentityImageDataUrl({
      client,
      identityState: "logo",
      identityReference: LOGO_REF,
    });

    expect(result).toBe(`data:image/png;base64,${LOGO_BYTES.toString("base64")}`);
    // Bucket restrito correto e path exatamente o da referência recebida.
    expect(state.signCalls).toEqual([
      { bucket: "store-brand-assets", path: LOGO_REF.storagePath },
    ]);
    // A URL assinada é transitória: nunca é retornada.
    expect(result).not.toContain("signed.example");
  });

  it("visual_signature: assina o storagePath já resolvido e devolve a assinatura", async () => {
    const result = await resolveBenchIdentityImageDataUrl({
      client,
      identityState: "visual_signature",
      identityReference: SIG_REF,
    });

    expect(result).toBe(`data:image/png;base64,${SIG_BYTES.toString("base64")}`);
    expect(state.signCalls).toEqual([
      { bucket: "visual-signatures", path: SIG_REF.storagePath },
    ]);
  });

  it("text_only: não envia imagem de identidade e não assina nada", async () => {
    const result = await resolveBenchIdentityImageDataUrl({
      client,
      identityState: "text_only",
      identityReference: null,
    });

    expect(result).toBeNull();
    expect(state.signCalls).toHaveLength(0);
  });
});

describe("resolveBenchIdentityImageDataUrl — compatibilidade identityState × kind", () => {
  it("logo com referência de assinatura é incompatível (sem substituição silenciosa)", async () => {
    await expect(
      resolveBenchIdentityImageDataUrl({
        client,
        identityState: "logo",
        identityReference: SIG_REF,
      }),
    ).rejects.toMatchObject({
      name: "BenchIdentityTransportError",
      code: "bench_identity_reference_incompatible",
    });
    // Nenhuma assinatura é gerada para uma combinação incompatível.
    expect(state.signCalls).toHaveLength(0);
  });

  it("visual_signature com referência de logo é incompatível", async () => {
    await expect(
      resolveBenchIdentityImageDataUrl({
        client,
        identityState: "visual_signature",
        identityReference: LOGO_REF,
      }),
    ).rejects.toBeInstanceOf(BenchIdentityTransportError);
    expect(state.signCalls).toHaveLength(0);
  });

  it("text_only com referência não nula é incompatível", async () => {
    await expect(
      resolveBenchIdentityImageDataUrl({
        client,
        identityState: "text_only",
        identityReference: LOGO_REF,
      }),
    ).rejects.toMatchObject({ code: "bench_identity_reference_incompatible" });
  });

  it("estado desconhecido falha de forma determinística (fail-closed)", async () => {
    await expect(
      resolveBenchIdentityImageDataUrl({
        client,
        identityState: "unknown",
        identityReference: null,
      }),
    ).rejects.toMatchObject({ code: "bench_identity_reference_incompatible" });
  });
});

describe("resolveBenchIdentityImageDataUrl — consome a referência já resolvida (sem re-resolver)", () => {
  it("usa o storagePath recebido verbatim (não escolhe variante/tipo)", async () => {
    const custom: BenchIdentityReference = {
      kind: "logo",
      variantType: "original",
      storagePath: "store-9/logo-original.png",
    };
    storage.put("store-brand-assets", custom.storagePath, Buffer.from("CUSTOM"));
    const result = await resolveBenchIdentityImageDataUrl({
      client,
      identityState: "logo",
      identityReference: custom,
    });

    expect(result).toBe(`data:image/png;base64,${Buffer.from("CUSTOM").toString("base64")}`);
    expect(state.signCalls[0].path).toBe(custom.storagePath);
  });

  it("o módulo não invoca resolveBenchIdentity (fonte)", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/lab/bench/execution/bench-identity-transport.ts",
      ),
      "utf8",
    );
    // Importa apenas os TIPOS do domínio; nunca chama o resolver nem escolhe variante.
    expect(source).not.toContain("resolveBenchIdentity(");
    expect(source).not.toContain("resolveBenchIdentity({");
  });
});

describe("resolveBenchIdentityImageDataUrl — indisponível falha antes da chamada paga", () => {
  it("referência ausente quando exigida ⇒ bench_identity_reference_unavailable", async () => {
    await expect(
      resolveBenchIdentityImageDataUrl({
        client,
        identityState: "logo",
        identityReference: null,
      }),
    ).rejects.toMatchObject({ code: "bench_identity_reference_unavailable" });
    expect(state.signCalls).toHaveLength(0);
  });

  it("arquivo ausente no storage ⇒ bench_identity_reference_unavailable (sem fallback)", async () => {
    const missing: BenchIdentityReference = {
      kind: "visual_signature",
      variantType: null,
      storagePath: "store-1/signature-missing.png",
    };
    await expect(
      resolveBenchIdentityImageDataUrl({
        client,
        identityState: "visual_signature",
        identityReference: missing,
      }),
    ).rejects.toMatchObject({ code: "bench_identity_reference_unavailable" });
  });

  it("falha ao gerar a URL assinada ⇒ bench_identity_reference_unavailable", async () => {
    state.signFails = true;
    await expect(
      resolveBenchIdentityImageDataUrl({
        client,
        identityState: "logo",
        identityReference: LOGO_REF,
      }),
    ).rejects.toMatchObject({ code: "bench_identity_reference_unavailable" });
  });

  it("nunca devolve a URL assinada (transitória, não persistida)", async () => {
    const result = await resolveBenchIdentityImageDataUrl({
      client,
      identityState: "logo",
      identityReference: LOGO_REF,
    });
    expect(result?.startsWith("data:image/png;base64,")).toBe(true);
    expect(result).not.toContain("signed.example");
    expect(result).not.toContain("token");
  });
});
