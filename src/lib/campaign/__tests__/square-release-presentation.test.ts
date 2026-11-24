import { describe, expect, it } from "vitest";

import { buildIndividualFormatPresentation } from "../format-presentation";
import { resolveCampaignFormat } from "../format-resolution";

const VERTICAL = resolveCampaignFormat({
  campaignFormat: "9:16",
  formatContractVersion: "f59-vertical-9-16-v1",
});

function build(release?: {
  state: "delivered" | "refunded" | "unknown" | "unavailable";
}, active: "1:1" | "9:16" | null = "9:16") {
  return buildIndividualFormatPresentation(
    {
      resolution: VERTICAL,
      lifecycle: "delivered",
      ...(release === undefined
        ? {}
        : { release: { format: "1:1", state: release.state } }),
    },
    active,
  );
}

describe("apresentação da liberação do quadrado 1:1", () => {
  it("sem liberação/pendente ⇒ quadrado permanece ausente/not_requested", () => {
    const presentation = build();
    expect(presentation.formats["1:1"]).toMatchObject({
      state: "absent",
      reason: "not_requested",
      active: false,
      refunded: false,
    });
    expect(presentation.formats["9:16"].state).toBe("delivered");
  });

  it("liberado ⇒ quadrado delivered e selecionável", () => {
    const presentation = build({ state: "delivered" }, "1:1");
    expect(presentation.formats["1:1"]).toMatchObject({
      state: "delivered",
      active: true,
      reason: null,
    });
    expect(presentation.formats["9:16"].state).toBe("delivered");
    expect(presentation.formats["9:16"].active).toBe(false);
  });

  it("estornado ⇒ ausente com crédito devolvido, nunca delivered", () => {
    const presentation = build({ state: "refunded" });
    expect(presentation.formats["1:1"]).toMatchObject({
      state: "absent",
      refunded: true,
      reason: "not_delivered",
      active: false,
    });
  });

  it("unknown/unavailable são preservados sem inventar entrega", () => {
    expect(build({ state: "unknown" }).formats["1:1"].state).toBe("unknown");
    expect(build({ state: "unavailable" }).formats["1:1"].state).toBe(
      "unavailable",
    );
  });
});
