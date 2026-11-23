import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveCampaignFormat } from "../format-resolution";
import {
  deriveFormatAdditionEligibility,
  FORMAT_ADDITION_CREDITS,
} from "../format-addition";
import type {
  FormatAdditionDurableRead,
  FormatAdditionEligibilityInput,
  FormatAdditionSourceRead,
} from "../format-addition";

const SQUARE = resolveCampaignFormat({ product: { name: "X" } });
const VERTICAL = resolveCampaignFormat({
  campaignFormat: "9:16",
  formatContractVersion: "f59-vertical-9-16-v1",
});
const UNAVAILABLE_FORMAT = resolveCampaignFormat(null);

function loaded(
  overrides: Partial<Extract<FormatAdditionSourceRead, { kind: "loaded" }>> = {},
): FormatAdditionSourceRead {
  return {
    kind: "loaded",
    origin: "new_flow_1_1",
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    integrity: "valid",
    checksum: "verified",
    pathCanonical: true,
    ...overrides,
  };
}

function input(
  overrides: Partial<FormatAdditionEligibilityInput> = {},
): FormatAdditionEligibilityInput {
  return {
    campaignStatus: "ready",
    formatResolution: SQUARE,
    addition: { kind: "none" },
    source: loaded(),
    ...overrides,
  };
}

function withAddition(
  addition: FormatAdditionDurableRead,
): FormatAdditionEligibilityInput {
  return input({ addition });
}

describe("F62 — elegibilidade pura da adição 9:16", () => {
  describe("fonte compatível", () => {
    it("1024×1024 JPEG do fluxo novo é elegível com 1 crédito", () => {
      const result = deriveFormatAdditionEligibility(input());

      expect(result).toEqual({
        kind: "eligible",
        sourceOrigin: "new_flow_1_1",
        credits: 1,
      });
      expect(FORMAT_ADDITION_CREDITS).toBe(1);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it("1024×1024 JPEG legado é elegível sem operação financeira original", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: loaded({ origin: "legacy_campaign" }) }),
      );

      expect(result).toEqual({
        kind: "eligible",
        sourceOrigin: "legacy_campaign",
        credits: 1,
      });
    });

    it("a idade/origem não é inferida: só a origem declarada decide", () => {
      const legacy = deriveFormatAdditionEligibility(
        input({ source: loaded({ origin: "legacy_campaign" }) }),
      );
      const modern = deriveFormatAdditionEligibility(
        input({ source: loaded({ origin: "new_flow_1_1" }) }),
      );

      expect(legacy.kind).toBe("eligible");
      expect(modern.kind).toBe("eligible");
    });
  });

  describe("incompatibilidade comprovada", () => {
    it("1080×1080 é incompatível nas duas origens", () => {
      for (const origin of ["new_flow_1_1", "legacy_campaign"] as const) {
        const result = deriveFormatAdditionEligibility(
          input({ source: loaded({ origin, width: 1080, height: 1080 }) }),
        );
        expect(result).toEqual({
          kind: "incompatible",
          reason: "unsupported_dimensions",
        });
      }
    });

    it("dimensão não quadrada é incompatível", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: loaded({ width: 1024, height: 1080 }) }),
      );

      expect(result).toEqual({
        kind: "incompatible",
        reason: "unsupported_dimensions",
      });
    });

    it("MIME diferente de JPEG é incompatível", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: loaded({ mimeType: "image/png" }) }),
      );

      expect(result).toEqual({
        kind: "incompatible",
        reason: "unsupported_mime",
      });
    });

    it("bytes inválidos/decodificação inválida são incompatíveis", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: loaded({ integrity: "invalid" }) }),
      );

      expect(result).toEqual({
        kind: "incompatible",
        reason: "artifact_invalid",
      });
    });

    it("checksum divergente é incompatível", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: loaded({ checksum: "divergent" }) }),
      );

      expect(result).toEqual({
        kind: "incompatible",
        reason: "artifact_invalid",
      });
    });

    it("path não canônico é incompatível", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: loaded({ pathCanonical: false }) }),
      );

      expect(result).toEqual({
        kind: "incompatible",
        reason: "path_not_canonical",
      });
    });

    it("origem não suportada é incompatível de contrato", () => {
      for (const origin of ["composition_artifact", "", "legacy"]) {
        const result = deriveFormatAdditionEligibility(
          input({ source: loaded({ origin }) }),
        );
        expect(result).toEqual({
          kind: "incompatible",
          reason: "source_origin_invalid",
        });
      }
    });

    it("campanha não pronta é incompatível", () => {
      for (const campaignStatus of ["generating", "error", "draft", ""]) {
        const result = deriveFormatAdditionEligibility(
          input({ campaignStatus }),
        );
        expect(result).toEqual({
          kind: "incompatible",
          reason: "campaign_not_ready",
        });
      }
    });

    it("formato vertical persistido não recebe a adição", () => {
      const result = deriveFormatAdditionEligibility(
        input({ formatResolution: VERTICAL }),
      );

      expect(result).toEqual({
        kind: "incompatible",
        reason: "format_not_square",
      });
    });

    it("contrato de formato indeterminado falha fechado como não quadrado", () => {
      const result = deriveFormatAdditionEligibility(
        input({ formatResolution: UNAVAILABLE_FORMAT }),
      );

      expect(result).toEqual({
        kind: "incompatible",
        reason: "format_not_square",
      });
    });
  });

  describe("ausência e leitura indisponível", () => {
    it("fonte ausente não é incompatibilidade", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: { kind: "absent" } }),
      );

      expect(result).toEqual({
        kind: "unavailable",
        reason: "artifact_absent",
      });
    });

    it("fonte indeterminada não é incompatibilidade", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: { kind: "indeterminate" } }),
      );

      expect(result).toEqual({
        kind: "unavailable",
        reason: "artifact_indeterminate",
      });
    });

    it("falha de leitura da fonte não é incompatibilidade", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: { kind: "read_failed" } }),
      );

      expect(result).toEqual({
        kind: "unavailable",
        reason: "read_failed",
      });
    });

    it("conflito de identidade não é incompatibilidade", () => {
      const result = deriveFormatAdditionEligibility(
        input({ source: { kind: "identity_conflict" } }),
      );

      expect(result).toEqual({
        kind: "unavailable",
        reason: "identity_conflict",
      });
    });

    it("falha de leitura do vínculo tem precedência sobre a fonte", () => {
      const result = deriveFormatAdditionEligibility(
        input({
          addition: { kind: "read_failed" },
          source: { kind: "absent" },
        }),
      );

      expect(result).toEqual({
        kind: "unavailable",
        reason: "read_failed",
      });
    });

    it("nenhuma leitura indisponível vira motivo definitivo", () => {
      const reads: FormatAdditionSourceRead[] = [
        { kind: "absent" },
        { kind: "indeterminate" },
        { kind: "read_failed" },
        { kind: "identity_conflict" },
      ];

      for (const source of reads) {
        const result = deriveFormatAdditionEligibility(input({ source }));
        expect(result.kind).toBe("unavailable");
      }
    });
  });

  describe("vínculo durável como autoridade", () => {
    it("delivered tem precedência sobre fonte/campanha divergentes", () => {
      const result = deriveFormatAdditionEligibility(
        input({
          addition: { kind: "delivered" },
          campaignStatus: "error",
          formatResolution: VERTICAL,
          source: loaded({ width: 1080, height: 1080 }),
        }),
      );

      expect(result).toEqual({ kind: "delivered", state: "delivered" });
    });

    it("operação aberta vira processing", () => {
      const result = deriveFormatAdditionEligibility(
        withAddition({ kind: "processing" }),
      );

      expect(result).toEqual({ kind: "processing", state: "processing" });
    });

    it("resultado incerto vira unknown, nunca ausência", () => {
      const result = deriveFormatAdditionEligibility(
        withAddition({ kind: "unknown" }),
      );

      expect(result).toEqual({ kind: "processing", state: "unknown" });
      expect(result).not.toMatchObject({ kind: "absent" });
    });

    it("estorno conhecido vira absent/refunded", () => {
      const result = deriveFormatAdditionEligibility(
        withAddition({ kind: "refunded" }),
      );

      expect(result).toEqual({
        kind: "absent",
        state: "absent",
        refunded: true,
      });
    });

    it("estorno não é reinterpretado como nova elegibilidade", () => {
      const result = deriveFormatAdditionEligibility(
        input({
          addition: { kind: "refunded" },
          campaignStatus: "error",
        }),
      );

      expect(result.kind).toBe("absent");
      if (result.kind === "absent") expect(result.refunded).toBe(true);
    });
  });

  describe("pureza e segurança do contrato", () => {
    it("é determinística e devolve objetos congelados", () => {
      const first = deriveFormatAdditionEligibility(input());
      const second = deriveFormatAdditionEligibility(input());

      expect(first).toEqual(second);
      expect(Object.isFrozen(first)).toBe(true);

      for (const result of [
        deriveFormatAdditionEligibility(input({ source: { kind: "absent" } })),
        deriveFormatAdditionEligibility(withAddition({ kind: "unknown" })),
        deriveFormatAdditionEligibility(withAddition({ kind: "refunded" })),
      ]) {
        expect(Object.isFrozen(result)).toBe(true);
      }
    });

    it("não importa server-only, Supabase, sharp, fetch, storage ou provider", () => {
      for (const file of ["types.ts", "eligibility.ts", "index.ts"]) {
        const source = readFileSync(
          join(process.cwd(), "src/lib/campaign/format-addition", file),
          "utf8",
        );

        expect(source).not.toMatch(/["']server-only["']/);
        expect(source).not.toMatch(/@\/lib\/supabase/);
        expect(source).not.toMatch(/from\s+["']sharp["']/);
        expect(source).not.toMatch(/\bfetch\s*\(/);
        expect(source).not.toMatch(/from\s+["']node:/);
        expect(source).not.toMatch(/\.storage\b/);
        expect(source).not.toMatch(/from\s+["'][^"']*storage/i);
        expect(source).not.toMatch(/from\s+["'][^"']*provider/i);
      }
    });

    it("contrato não expõe snapshot, path, URL, bytes ou miniatura", () => {
      for (const file of ["types.ts", "eligibility.ts"]) {
        const source = readFileSync(
          join(process.cwd(), "src/lib/campaign/format-addition", file),
          "utf8",
        );

        expect(source).not.toMatch(/input_snapshot/);
        expect(source).not.toMatch(/storagePath/);
        expect(source).not.toMatch(/thumbnail|miniatura/i);
        expect(source).not.toMatch(/https?:\/\//);
        expect(source).not.toMatch(/\bBuffer\b/);
      }
    });
  });
});
