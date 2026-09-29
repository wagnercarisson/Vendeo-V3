// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  BENCH_IDENTITY_STATES,
  resolveBenchIdentity,
  type BenchIdentityInput,
} from "../domain/resolve-bench-identity";

/**
 * Resolver puro de identidade da bancada (F48.2.3).
 *
 * Módulo puro e determinístico: nenhuma rede, nenhum banco, nenhuma URL assinada.
 * A seleção é por **presença do registro ativo** e o descritor devolvido nunca
 * depende do sucesso de assinatura. Cobre os três estados, a prioridade de
 * variante, a ausência do asset esperado, a coexistência logo+assinatura, o
 * estado desconhecido (fail-closed) e o determinismo.
 */

const LOGO_PATH = "loja/logo.png";

function resolve(input: Partial<BenchIdentityInput>) {
  return resolveBenchIdentity({
    identityState: input.identityState ?? null,
    logoAssets: input.logoAssets ?? [],
    visualSignature: input.visualSignature ?? null,
  });
}

describe("resolveBenchIdentity — conjunto fechado de estados", () => {
  it("expõe exatamente o conjunto fechado do banco", () => {
    expect(BENCH_IDENTITY_STATES).toEqual(["text_only", "logo", "visual_signature"]);
  });
});

describe("resolveBenchIdentity — text_only", () => {
  it("não expõe imagem de identidade, mesmo com logo e assinatura presentes", () => {
    const result = resolve({
      identityState: "text_only",
      logoAssets: [{ variantType: "normalized", storagePath: LOGO_PATH }],
      visualSignature: { storagePath: "loja/assinatura.png" },
    });

    expect(result.identityState).toBe("text_only");
    expect(result.reference).toBeNull();
    expect(result.reason).toBe("text_only:no_identity_image");
  });
});

describe("resolveBenchIdentity — logo", () => {
  it("seleciona a variante por prioridade normalized > original > on_dark", () => {
    const result = resolve({
      identityState: "logo",
      logoAssets: [
        { variantType: "on_dark", storagePath: "loja/on_dark.png" },
        { variantType: "original", storagePath: "loja/original.png" },
        { variantType: "normalized", storagePath: "loja/normalized.png" },
      ],
    });

    expect(result.reference).toEqual({
      kind: "logo",
      variantType: "normalized",
      storagePath: "loja/normalized.png",
    });
    expect(result.reason).toBe("logo:selected");
  });

  it("cai para original quando não há normalized", () => {
    const result = resolve({
      identityState: "logo",
      logoAssets: [
        { variantType: "on_dark", storagePath: "loja/on_dark.png" },
        { variantType: "original", storagePath: "loja/original.png" },
      ],
    });

    expect(result.reference?.variantType).toBe("original");
  });

  it("cai para on_dark quando não há normalized nem original", () => {
    const result = resolve({
      identityState: "logo",
      logoAssets: [{ variantType: "on_dark", storagePath: "loja/on_dark.png" }],
    });

    expect(result.reference?.variantType).toBe("on_dark");
  });

  it("seleciona pela presença do registro, independente de assinatura (não há URL na entrada)", () => {
    const result = resolve({
      identityState: "logo",
      logoAssets: [{ variantType: "original", storagePath: LOGO_PATH }],
    });

    expect(result.reference).toEqual({
      kind: "logo",
      variantType: "original",
      storagePath: LOGO_PATH,
    });
    // O descritor nunca carrega URL assinada.
    expect(Object.keys(result.reference ?? {})).toEqual(["kind", "variantType", "storagePath"]);
  });

  it("sem variante ativa presente devolve referência nula com motivo explícito", () => {
    const result = resolve({ identityState: "logo", logoAssets: [] });

    expect(result.reference).toBeNull();
    expect(result.reason).toBe("logo:missing_active_asset");
  });

  it("não cai para outra variante quando a selecionada não tem storagePath (paridade produtiva)", () => {
    const result = resolve({
      identityState: "logo",
      logoAssets: [
        { variantType: "normalized", storagePath: "" },
        { variantType: "original", storagePath: "loja/original.png" },
      ],
    });

    expect(result.reference).toBeNull();
    expect(result.reason).toBe("logo:missing_active_asset");
  });

  it("ignora variantes fora da prioridade canônica", () => {
    const result = resolve({
      identityState: "logo",
      logoAssets: [{ variantType: "square_safe", storagePath: "loja/square.png" }],
    });

    expect(result.reference).toBeNull();
    expect(result.reason).toBe("logo:missing_active_asset");
  });
});

describe("resolveBenchIdentity — visual_signature", () => {
  it("seleciona a assinatura ativa e devolve o descritor sem variantType", () => {
    const result = resolve({
      identityState: "visual_signature",
      visualSignature: { storagePath: "loja/assinatura.png" },
    });

    expect(result.reference).toEqual({
      kind: "visual_signature",
      variantType: null,
      storagePath: "loja/assinatura.png",
    });
    expect(result.reason).toBe("visual_signature:selected");
  });

  it("sem assinatura ativa devolve referência nula com motivo explícito", () => {
    const result = resolve({ identityState: "visual_signature", visualSignature: null });

    expect(result.reference).toBeNull();
    expect(result.reason).toBe("visual_signature:missing_active_signature");
  });

  it("não cai para o logo quando a assinatura esperada falta", () => {
    const result = resolve({
      identityState: "visual_signature",
      logoAssets: [{ variantType: "normalized", storagePath: LOGO_PATH }],
      visualSignature: null,
    });

    expect(result.reference).toBeNull();
  });
});

describe("resolveBenchIdentity — coexistência logo + assinatura", () => {
  it("estado logo escolhe apenas o logo", () => {
    const result = resolve({
      identityState: "logo",
      logoAssets: [{ variantType: "original", storagePath: LOGO_PATH }],
      visualSignature: { storagePath: "loja/assinatura.png" },
    });

    expect(result.reference?.kind).toBe("logo");
  });

  it("estado visual_signature escolhe apenas a assinatura", () => {
    const result = resolve({
      identityState: "visual_signature",
      logoAssets: [{ variantType: "original", storagePath: LOGO_PATH }],
      visualSignature: { storagePath: "loja/assinatura.png" },
    });

    expect(result.reference?.kind).toBe("visual_signature");
  });
});

describe("resolveBenchIdentity — estado desconhecido (fail-closed)", () => {
  it.each([undefined, null, "", "legacy", "LOGO", "logo "])(
    "estado %p devolve referência nula e motivo unknown_identity_state",
    (value) => {
      const result = resolve({
        identityState: value as string | null | undefined,
        logoAssets: [{ variantType: "normalized", storagePath: LOGO_PATH }],
        visualSignature: { storagePath: "loja/assinatura.png" },
      });

      expect(result.identityState).toBe("unknown");
      expect(result.reference).toBeNull();
      expect(result.reason).toBe("unknown_identity_state");
    },
  );
});

describe("resolveBenchIdentity — determinismo e pureza", () => {
  it("mesma entrada ⇒ mesma saída (chamadas repetidas)", () => {
    const input: BenchIdentityInput = {
      identityState: "logo",
      logoAssets: [
        { variantType: "original", storagePath: "loja/original.png" },
        { variantType: "normalized", storagePath: "loja/normalized.png" },
      ],
      visualSignature: null,
    };

    const first = resolveBenchIdentity(input);
    const second = resolveBenchIdentity(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("o módulo-fonte é puro: sem I/O, sem ambiente, sem serviço produtivo", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/resolve-bench-identity.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@\/lib\/supabase/);
    expect(source).not.toMatch(/@\/lib\/store-identity-service/);
    expect(source).not.toMatch(/\bawait\b/);
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/signedUrl/);
  });
});
