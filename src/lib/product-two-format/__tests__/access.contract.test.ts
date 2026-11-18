// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  deriveTwoFormatDeliveryView,
  type TwoFormatDeliverySource,
  type TwoFormatDeliveryView,
} from "../read-model";
import type { TwoFormatDeliveryLink, TwoFormatFormat } from "../types";
import {
  TWO_FORMAT_ARTIFACT_POLICY,
  resolveTwoFormatAccess,
} from "../access";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_DELIVERY = "44444444-4444-4444-8444-444444444444";

const SQUARE_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`;
const PREPARED_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/square_prepared.jpg`;
const VERTICAL_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

const SQUARE_THUMB = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.thumb-v1.webp`;
const VERTICAL_THUMB = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.thumb-v1.webp`;

function linkFor(
  format: TwoFormatFormat,
  overrides: Partial<TwoFormatDeliveryLink> = {},
): TwoFormatDeliveryLink {
  return {
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    storeId: STORE,
    format,
    deliveryOperationId: format === "1:1" ? SQUARE_DELIVERY : OPERATION,
    artifactRole: format === "1:1" ? "square_original" : "vertical",
    createdAt: "2026-11-17T00:00:00.000Z",
    ...overrides,
  };
}

function squareSource(
  overrides: Partial<TwoFormatDeliverySource> = {},
): TwoFormatDeliverySource {
  return {
    format: "1:1",
    link: { kind: "found", link: linkFor("1:1") },
    credit: { kind: "found", status: "delivered" },
    artifact: {
      kind: "found",
      role: "square_original",
      format: "1:1",
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
      storagePath: SQUARE_PATH,
    },
    ...overrides,
  };
}

function verticalSource(
  overrides: Partial<TwoFormatDeliverySource> = {},
): TwoFormatDeliverySource {
  return {
    format: "9:16",
    link: { kind: "found", link: linkFor("9:16") },
    credit: { kind: "found", status: "delivered" },
    artifact: {
      kind: "found",
      role: "vertical",
      format: "9:16",
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      storagePath: VERTICAL_PATH,
    },
    ...overrides,
  };
}

function deriveView(
  overrides: {
    square?: TwoFormatDeliverySource;
    vertical?: TwoFormatDeliverySource;
  } = {},
): TwoFormatDeliveryView {
  return deriveTwoFormatDeliveryView({
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    square: overrides.square ?? squareSource(),
    vertical: overrides.vertical ?? verticalSource(),
  });
}

describe("TWO_FORMAT_ARTIFACT_POLICY", () => {
  it("define apenas square_original e vertical, congelados", () => {
    expect(Object.isFrozen(TWO_FORMAT_ARTIFACT_POLICY)).toBe(true);
    expect(TWO_FORMAT_ARTIFACT_POLICY["1:1"]).toEqual({
      role: "square_original",
      format: "1:1",
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
    });
    expect(TWO_FORMAT_ARTIFACT_POLICY["9:16"]).toEqual({
      role: "vertical",
      format: "9:16",
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
    });
    expect(Object.isFrozen(TWO_FORMAT_ARTIFACT_POLICY["1:1"])).toBe(true);
    expect(Object.isFrozen(TWO_FORMAT_ARTIFACT_POLICY["9:16"])).toBe(true);
  });
});

describe("resolveTwoFormatAccess — formato 1:1", () => {
  it("libera artefato original e miniatura derivada quando entregue", () => {
    const result = resolveTwoFormatAccess(
      { view: deriveView(), format: "1:1" },
      { deriveThumbnailPath: deriveThumbnailStub },
    );

    expect(result).toEqual({
      allowed: true,
      artifactRole: "square_original",
      artifactPath: SQUARE_PATH,
      thumbnailPath: SQUARE_THUMB,
      thumbnailPlaceholder: false,
    });
    if (!result.allowed) throw new Error("expected allowed");
    expect(result.thumbnailPath).not.toBe(result.artifactPath);
  });

  it("nega processing e absent sem expor path, URL ou miniatura", () => {
    const processing = resolveTwoFormatAccess({
      view: deriveView({
        square: squareSource({ credit: { kind: "found", status: "reserved" } }),
      }),
      format: "1:1",
    });
    expect(processing).toEqual({ allowed: false, reason: "not_delivered" });
    expect(processing).not.toHaveProperty("artifactPath");
    expect(processing).not.toHaveProperty("thumbnailPath");

    const absent = resolveTwoFormatAccess({
      view: deriveView({
        square: squareSource({ credit: { kind: "found", status: "refunded" } }),
      }),
      format: "1:1",
    });
    expect(absent).toEqual({ allowed: false, reason: "not_delivered" });
  });

  it("nega indeterminate sem tratar como ausência", () => {
    const unknown = resolveTwoFormatAccess({
      view: deriveView({ square: squareSource({ artifact: { kind: "missing" } }) }),
      format: "1:1",
    });
    expect(unknown).toEqual({ allowed: false, reason: "indeterminate" });

    const unavailable = resolveTwoFormatAccess({
      view: deriveView({ square: squareSource({ link: { kind: "missing" } }) }),
      format: "1:1",
    });
    expect(unavailable).toEqual({ allowed: false, reason: "indeterminate" });
  });
});

describe("resolveTwoFormatAccess — formato 9:16 e formatos inválidos", () => {
  it("libera o vertical entregue com miniatura derivada", () => {
    const result = resolveTwoFormatAccess(
      { view: deriveView(), format: "9:16" },
      { deriveThumbnailPath: deriveThumbnailStub },
    );

    expect(result).toEqual({
      allowed: true,
      artifactRole: "vertical",
      artifactPath: VERTICAL_PATH,
      thumbnailPath: VERTICAL_THUMB,
      thumbnailPlaceholder: false,
    });
  });

  it("nega o vertical não entregue", () => {
    const result = resolveTwoFormatAccess({
      view: deriveView({
        vertical: verticalSource({
          credit: { kind: "found", status: "reserved" },
        }),
      }),
      format: "9:16",
    });

    expect(result).toEqual({ allowed: false, reason: "not_delivered" });
  });

  it("recusa formato desconhecido", () => {
    expect(
      resolveTwoFormatAccess({ view: deriveView(), format: "16:9" }),
    ).toEqual({ allowed: false, reason: "unsupported_format" });
    expect(
      resolveTwoFormatAccess({ view: deriveView(), format: "" }),
    ).toEqual({ allowed: false, reason: "unsupported_format" });
  });

  it("nunca aceita square_prepared como artefato de entrega", () => {
    const base = deriveView();
    const tampered = {
      ...base,
      square: {
        ...base.square,
        state: "delivered" as const,
        artifactRole: "square_original" as const,
        artifactPath: PREPARED_PATH,
      },
    };

    expect(
      resolveTwoFormatAccess({ view: tampered, format: "1:1" }),
    ).toEqual({ allowed: false, reason: "artifact_incompatible" });
  });

  it("recusa caminho fora do contrato canônico de composição", () => {
    const base = deriveView();
    const tampered = {
      ...base,
      square: {
        ...base.square,
        state: "delivered" as const,
        artifactRole: "square_original" as const,
        artifactPath: "arbitrary/path.jpg",
      },
    };

    expect(
      resolveTwoFormatAccess({ view: tampered, format: "1:1" }),
    ).toEqual({ allowed: false, reason: "artifact_incompatible" });
  });

  it("recusa caminho de outra campanha ou operação", () => {
    const base = deriveView();
    const otherOperation = "99999999-9999-4999-8999-999999999999";
    const tampered = {
      ...base,
      square: {
        ...base.square,
        state: "delivered" as const,
        artifactRole: "square_original" as const,
        artifactPath: `${STORE}/${CAMPAIGN}/${otherOperation}/square_original.jpg`,
      },
    };

    expect(
      resolveTwoFormatAccess({ view: tampered, format: "1:1" }),
    ).toEqual({ allowed: false, reason: "artifact_incompatible" });
  });

  it("nega artefato ausente mesmo com estado delivered", () => {
    const base = deriveView();
    const tampered = {
      ...base,
      square: {
        ...base.square,
        state: "delivered" as const,
        artifactRole: null,
        artifactPath: null,
      },
    };

    expect(
      resolveTwoFormatAccess({ view: tampered, format: "1:1" }),
    ).toEqual({ allowed: false, reason: "artifact_missing" });
  });
});

describe("resolveTwoFormatAccess — miniatura não elegível", () => {
  it("mantém preview/download com placeholder e nunca cai ao original", () => {
    const result = resolveTwoFormatAccess(
      { view: deriveView(), format: "1:1" },
      { deriveThumbnailPath: () => null },
    );

    expect(result).toEqual({
      allowed: true,
      artifactRole: "square_original",
      artifactPath: SQUARE_PATH,
      thumbnailPath: null,
      thumbnailPlaceholder: true,
    });
    if (!result.allowed) throw new Error("expected allowed");
    expect(result.thumbnailPath).not.toBe(result.artifactPath);
  });
});

describe("fronteira do contrato de acesso", () => {
  it("não faz I/O nem assina URL", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/product-two-format/access.ts"),
      "utf8",
    );

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("@supabase/");
    expect(source).not.toContain('from "next/');
    expect(source).not.toContain("sharp");
    expect(source).not.toContain("createSignedUrl");
    expect(source).not.toContain("await ");
  });
});

function deriveThumbnailStub(originalPath: string): string | null {
  if (originalPath === SQUARE_PATH) return SQUARE_THUMB;
  if (originalPath === VERTICAL_PATH) return VERTICAL_THUMB;
  return null;
}
