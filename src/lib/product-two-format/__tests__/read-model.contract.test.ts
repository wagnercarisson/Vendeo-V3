// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  deriveTwoFormatDeliveryView,
  type TwoFormatDeliverySource,
} from "../read-model";
import type { TwoFormatDeliveryLink, TwoFormatFormat } from "../types";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const SQUARE_DELIVERY = "44444444-4444-4444-8444-444444444444";

const SQUARE_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`;
const VERTICAL_PATH = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

type LinkOverride = Partial<TwoFormatDeliveryLink>;

function linkFor(
  format: TwoFormatFormat,
  overrides: LinkOverride = {},
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

function squareSource(overrides: Partial<TwoFormatDeliverySource> = {}): TwoFormatDeliverySource {
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
) {
  return deriveTwoFormatDeliveryView({
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    square: overrides.square ?? squareSource(),
    vertical: overrides.vertical ?? verticalSource(),
  });
}

describe("deriveTwoFormatDeliveryView — formato entregue", () => {
  it("deriva delivered a partir de vínculo + crédito + artefato compatível", () => {
    const view = deriveView();

    expect(view.origin).toBe("two_format_two_stage");
    expect(view.campaignId).toBe(CAMPAIGN);
    expect(view.operationId).toBe(OPERATION);
    expect(view.square).toEqual({
      format: "1:1",
      state: "delivered",
      creditRefunded: false,
      deliveryOperationId: SQUARE_DELIVERY,
      artifactRole: "square_original",
      artifactPath: SQUARE_PATH,
      supportReference: null,
    });
    expect(view.vertical).toMatchObject({
      format: "9:16",
      state: "delivered",
      artifactRole: "vertical",
      artifactPath: VERTICAL_PATH,
      deliveryOperationId: OPERATION,
    });
  });
});

describe("deriveTwoFormatDeliveryView — estados de crédito", () => {
  it("reservado e arte enviada são processing", () => {
    expect(
      deriveView({ square: squareSource({ credit: { kind: "found", status: "reserved" } }) })
        .square.state,
    ).toBe("processing");
    expect(
      deriveView({
        square: squareSource({ credit: { kind: "found", status: "art_uploaded" } }),
      }).square.state,
    ).toBe("processing");
  });

  it("crédito devolvido é absent com a marca explícita", () => {
    const square = deriveView({
      square: squareSource({ credit: { kind: "found", status: "refunded" } }),
    }).square;

    expect(square.state).toBe("absent");
    expect(square.creditRefunded).toBe(true);
    expect(square.artifactPath).toBeNull();
    expect(square.artifactRole).toBeNull();
  });

  it("crédito ausente com vínculo presente é unavailable", () => {
    expect(
      deriveView({ square: squareSource({ credit: { kind: "missing" } }) }).square
        .state,
    ).toBe("unavailable");
  });

  it("falha de leitura de crédito é unknown com referência de suporte", () => {
    const square = deriveView({
      square: squareSource({
        credit: { kind: "read_failed", reason: "timeout" },
      }),
    }).square;

    expect(square.state).toBe("unknown");
    expect(square.creditRefunded).toBe(false);
    expect(square.supportReference).not.toBeNull();
    expect(square.supportReference).toContain(CAMPAIGN);
    expect(square.supportReference).toContain("1:1");
    expect(square.artifactPath).toBeNull();
  });

  it("crédito entregue sem artefato é unknown, nunca absent", () => {
    const missing = deriveView({
      square: squareSource({ artifact: { kind: "missing" } }),
    }).square;
    expect(missing.state).toBe("unknown");
    expect(missing.supportReference).not.toBeNull();

    const failed = deriveView({
      square: squareSource({ artifact: { kind: "read_failed" } }),
    }).square;
    expect(failed.state).toBe("unknown");
  });

  it("artefato incompatível com a política de papel é unknown", () => {
    const wrongDimension = deriveView({
      square: squareSource({
        artifact: {
          kind: "found",
          role: "square_original",
          format: "1:1",
          width: 1152,
          height: 1152,
          mimeType: "image/jpeg",
          storagePath: SQUARE_PATH,
        },
      }),
    }).square;
    expect(wrongDimension.state).toBe("unknown");

    const prepared = deriveView({
      square: squareSource({
        artifact: {
          kind: "found",
          role: "square_prepared",
          format: "1:1",
          width: 1024,
          height: 1024,
          mimeType: "image/jpeg",
          storagePath: SQUARE_PATH,
        },
      }),
    }).square;
    expect(prepared.state).toBe("unknown");
    expect(prepared.artifactRole).toBeNull();

    const wrongMime = deriveView({
      square: squareSource({
        artifact: {
          kind: "found",
          role: "square_original",
          format: "1:1",
          width: 1024,
          height: 1024,
          mimeType: "image/png",
          storagePath: SQUARE_PATH,
        },
      }),
    }).square;
    expect(wrongMime.state).toBe("unknown");
  });

  it("preserva o outro formato comprovadamente entregue", () => {
    const view = deriveView({
      square: squareSource({ credit: { kind: "read_failed", reason: "timeout" } }),
    });

    expect(view.square.state).toBe("unknown");
    expect(view.vertical.state).toBe("delivered");
    expect(view.preferredThumbnail).toBe("vertical");
  });
});

describe("deriveTwoFormatDeliveryView — vínculos incoerentes", () => {
  it("vínculo ausente ou inválido é unavailable", () => {
    expect(
      deriveView({ square: squareSource({ link: { kind: "missing" } }) }).square
        .state,
    ).toBe("unavailable");
    expect(
      deriveView({
        square: squareSource({
          link: { kind: "invalid", reason: "duplicate_link" },
        }),
      }).square.state,
    ).toBe("unavailable");
  });

  it("formato do vínculo divergente é unavailable", () => {
    expect(
      deriveView({
        square: squareSource({
          link: { kind: "found", link: linkFor("9:16") },
        }),
      }).square.state,
    ).toBe("unavailable");
  });

  it("papel incompatível com o formato é unavailable", () => {
    expect(
      deriveView({
        square: squareSource({
          link: { kind: "found", link: linkFor("1:1", { artifactRole: "vertical" }) },
        }),
      }).square.state,
    ).toBe("unavailable");
    expect(
      deriveView({
        vertical: verticalSource({
          link: {
            kind: "found",
            link: linkFor("9:16", { artifactRole: "square_original" }),
          },
        }),
      }).vertical.state,
    ).toBe("unavailable");
  });

  it("identidade financeira divergente do esperado é unavailable", () => {
    // vertical precisa reutilizar a identidade de controle
    expect(
      deriveView({
        vertical: verticalSource({
          link: {
            kind: "found",
            link: linkFor("9:16", { deliveryOperationId: SQUARE_DELIVERY }),
          },
        }),
      }).vertical.state,
    ).toBe("unavailable");

    // quadrado precisa ter identidade financeira própria (distinta do controle)
    expect(
      deriveView({
        square: squareSource({
          link: {
            kind: "found",
            link: linkFor("1:1", { deliveryOperationId: OPERATION }),
          },
        }),
      }).square.state,
    ).toBe("unavailable");
  });

  it("vínculo de outra campanha/operação é unavailable", () => {
    expect(
      deriveView({
        square: squareSource({
          link: {
            kind: "found",
            link: linkFor("1:1", {
              campaignId: "99999999-9999-4999-8999-999999999999",
            }),
          },
        }),
      }).square.state,
    ).toBe("unavailable");
    expect(
      deriveView({
        vertical: verticalSource({
          link: {
            kind: "found",
            link: linkFor("9:16", {
              operationId: "99999999-9999-4999-8999-999999999999",
            }),
          },
        }),
      }).vertical.state,
    ).toBe("unavailable");
  });

  it("nenhum path é exposto fora do estado delivered", () => {
    const states = deriveView({
      square: squareSource({
        credit: { kind: "found", status: "reserved" },
      }),
      vertical: verticalSource({
        link: { kind: "invalid", reason: "duplicate_link" },
      }),
    });

    expect(states.square.artifactPath).toBeNull();
    expect(states.vertical.artifactPath).toBeNull();
    expect(states.vertical.artifactRole).toBeNull();
  });
});

describe("deriveTwoFormatDeliveryView — miniatura preferida", () => {
  it("prefere o quadrado entregue mesmo com o vertical também entregue", () => {
    expect(deriveView().preferredThumbnail).toBe("square");
  });

  it("prefere o quadrado quando o vertical está processing ou absent", () => {
    expect(
      deriveView({
        vertical: verticalSource({ credit: { kind: "found", status: "reserved" } }),
      }).preferredThumbnail,
    ).toBe("square");
    expect(
      deriveView({
        vertical: verticalSource({ credit: { kind: "found", status: "refunded" } }),
      }).preferredThumbnail,
    ).toBe("square");
  });

  it("usa o vertical somente quando ele é o único entregue", () => {
    expect(
      deriveView({
        square: squareSource({ credit: { kind: "found", status: "refunded" } }),
      }).preferredThumbnail,
    ).toBe("vertical");
    expect(
      deriveView({
        square: squareSource({ artifact: { kind: "missing" } }),
      }).preferredThumbnail,
    ).toBe("vertical");
  });

  it("não escolhe fonte quando nenhum formato está entregue", () => {
    const view = deriveView({
      square: squareSource({ credit: { kind: "found", status: "refunded" } }),
      vertical: verticalSource({ credit: { kind: "found", status: "refunded" } }),
    });

    expect(view.preferredThumbnail).toBeNull();
    expect(view.square.creditRefunded).toBe(true);
    expect(view.vertical.creditRefunded).toBe(true);
  });

  it("square_prepared nunca é fonte de entrega", () => {
    const view = deriveView({
      square: squareSource({
        artifact: {
          kind: "found",
          role: "square_prepared",
          format: "1:1",
          width: 1152,
          height: 1152,
          mimeType: "image/jpeg",
          storagePath: SQUARE_PATH,
        },
      }),
    });

    expect(view.square.state).not.toBe("delivered");
    expect(view.square.artifactRole).toBeNull();
    expect(view.preferredThumbnail).toBe("vertical");
  });
});
