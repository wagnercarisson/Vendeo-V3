import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveCampaignFormat } from "../format-resolution";
import {
  buildIndividualFormatPresentation,
  buildJointFormatPresentation,
  buildUnavailableFormatPresentation,
  buildUnknownFormatPresentation,
  individualLifecycleFromStatus,
  type CampaignFormatKey,
} from "../format-presentation";

const BOTH: readonly CampaignFormatKey[] = ["1:1", "9:16"];

describe("F61 — modelo puro de apresentação dos formatos", () => {
  describe("conjunta", () => {
    it("completa: dois delivered, partial=false", () => {
      const presentation = buildJointFormatPresentation({
        "1:1": { state: "delivered", refunded: false },
        "9:16": { state: "delivered", refunded: false },
      });

      expect(presentation.flow).toBe("two_format");
      expect(presentation.partial).toBe(false);
      expect(presentation.anyDelivered).toBe(true);
      for (const key of BOTH) {
        expect(presentation.formats[key]).toEqual({
          state: "delivered",
          refunded: false,
          reason: null,
          active: false,
        });
      }
    });

    it("parcial: um delivered e um absent ⇒ partial=true e reason not_delivered", () => {
      const presentation = buildJointFormatPresentation({
        "1:1": { state: "delivered", refunded: false },
        "9:16": { state: "absent", refunded: false },
      });

      expect(presentation.partial).toBe(true);
      expect(presentation.anyDelivered).toBe(true);
      expect(presentation.formats["9:16"]).toEqual({
        state: "absent",
        refunded: false,
        reason: "not_delivered",
        active: false,
      });
    });

    it("estornada: absent preserva refunded=true e nunca vira delivered/processing", () => {
      const presentation = buildJointFormatPresentation({
        "1:1": { state: "delivered", refunded: false },
        "9:16": { state: "absent", refunded: true },
      });

      expect(presentation.formats["9:16"]).toEqual({
        state: "absent",
        refunded: true,
        reason: "not_delivered",
        active: false,
      });
      expect(presentation.formats["9:16"].state).not.toBe("delivered");
      expect(presentation.formats["9:16"].state).not.toBe("processing");
    });

    it("não presume estorno fora de absent", () => {
      const presentation = buildJointFormatPresentation({
        "1:1": { state: "delivered", refunded: true },
        "9:16": { state: "processing", refunded: true },
      });

      expect(presentation.formats["1:1"].refunded).toBe(false);
      expect(presentation.formats["9:16"].refunded).toBe(false);
    });

    it("unknown/unavailable são copiados sem reinterpretação", () => {
      const presentation = buildJointFormatPresentation({
        "1:1": { state: "unknown", refunded: false },
        "9:16": { state: "unavailable", refunded: false },
      });

      expect(presentation.formats["1:1"].state).toBe("unknown");
      expect(presentation.formats["9:16"].state).toBe("unavailable");
      expect(presentation.partial).toBe(false);
      expect(presentation.anyDelivered).toBe(false);
    });

    it("active só no formato passado e apenas se delivered", () => {
      const delivered = buildJointFormatPresentation(
        {
          "1:1": { state: "delivered", refunded: false },
          "9:16": { state: "delivered", refunded: false },
        },
        "9:16",
      );
      expect(delivered.formats["9:16"].active).toBe(true);
      expect(delivered.formats["1:1"].active).toBe(false);

      const absentActive = buildJointFormatPresentation(
        {
          "1:1": { state: "delivered", refunded: false },
          "9:16": { state: "absent", refunded: false },
        },
        "9:16",
      );
      expect(absentActive.formats["9:16"].active).toBe(false);

      const noActive = buildJointFormatPresentation({
        "1:1": { state: "delivered", refunded: false },
        "9:16": { state: "delivered", refunded: false },
      });
      expect(noActive.formats["1:1"].active).toBe(false);
      expect(noActive.formats["9:16"].active).toBe(false);
    });
  });

  describe("individual", () => {
    it("pronta: persistido delivered, outro absent/not_requested, partial=false", () => {
      const presentation = buildIndividualFormatPresentation(
        {
          resolution: resolveCampaignFormat({}),
          lifecycle: "delivered",
        },
        "1:1",
      );

      expect(presentation.flow).toBe("single_format");
      expect(presentation.partial).toBe(false);
      expect(presentation.anyDelivered).toBe(true);
      expect(presentation.formats["1:1"]).toEqual({
        state: "delivered",
        refunded: false,
        reason: null,
        active: true,
      });
      expect(presentation.formats["9:16"]).toEqual({
        state: "absent",
        refunded: false,
        reason: "not_requested",
        active: false,
      });
    });

    it("em processamento", () => {
      const presentation = buildIndividualFormatPresentation({
        resolution: resolveCampaignFormat({}),
        lifecycle: "processing",
      });

      expect(presentation.formats["1:1"].state).toBe("processing");
      expect(presentation.formats["1:1"].active).toBe(false);
      expect(presentation.formats["9:16"].reason).toBe("not_requested");
      expect(presentation.partial).toBe(false);
    });

    it("estornada: absent + refunded, sem active", () => {
      const presentation = buildIndividualFormatPresentation(
        {
          resolution: resolveCampaignFormat({}),
          lifecycle: "refunded",
        },
        "1:1",
      );

      expect(presentation.formats["1:1"]).toEqual({
        state: "absent",
        refunded: true,
        reason: "not_delivered",
        active: false,
      });
      expect(presentation.formats["9:16"].state).toBe("absent");
      expect(presentation.formats["9:16"].reason).toBe("not_requested");
      expect(presentation.partial).toBe(false);
    });

    it("error/stale representados como unknown, nunca absent", () => {
      expect(individualLifecycleFromStatus("error")).toBe("unknown");
      expect(individualLifecycleFromStatus("ready")).toBe("delivered");
      expect(individualLifecycleFromStatus("generating")).toBe("processing");

      const presentation = buildIndividualFormatPresentation({
        resolution: resolveCampaignFormat({}),
        lifecycle: individualLifecycleFromStatus("error"),
      });

      expect(presentation.formats["1:1"].state).toBe("unknown");
      expect(presentation.formats["1:1"].state).not.toBe("absent");
      expect(presentation.formats["9:16"].reason).toBe("not_requested");
      expect(presentation.partial).toBe(false);
    });

    it("vertical persistido: 9:16 recebe o estado e 1:1 é not_requested", () => {
      const presentation = buildIndividualFormatPresentation(
        {
          resolution: resolveCampaignFormat({
            campaignFormat: "9:16",
            formatContractVersion: "f59-vertical-9-16-v1",
          }),
          lifecycle: "delivered",
        },
        "9:16",
      );

      expect(presentation.formats["9:16"]).toEqual({
        state: "delivered",
        refunded: false,
        reason: null,
        active: true,
      });
      expect(presentation.formats["1:1"]).toEqual({
        state: "absent",
        refunded: false,
        reason: "not_requested",
        active: false,
      });
    });

    it("resolução unavailable ⇒ ambos unavailable, sem fallback 1:1", () => {
      for (const lifecycle of [
        "delivered",
        "processing",
        "refunded",
        "unknown",
      ] as const) {
        const presentation = buildIndividualFormatPresentation(
          {
            resolution: resolveCampaignFormat(null),
            lifecycle,
          },
          "1:1",
        );

        expect(presentation.flow).toBe("single_format");
        expect(presentation.partial).toBe(false);
        expect(presentation.anyDelivered).toBe(false);
        expect(presentation.formats["1:1"]).toEqual({
          state: "unavailable",
          refunded: false,
          reason: null,
          active: false,
        });
        expect(presentation.formats["9:16"].state).toBe("unavailable");
      }
    });
  });

  describe("indeterminação e snapshot", () => {
    it("unknown/unavailable globais", () => {
      expect(buildUnknownFormatPresentation()).toMatchObject({
        flow: "single_format",
        partial: false,
        anyDelivered: false,
        formats: {
          "1:1": { state: "unknown", reason: null, refunded: false, active: false },
          "9:16": { state: "unknown", reason: null, refunded: false, active: false },
        },
      });
      expect(buildUnavailableFormatPresentation()).toMatchObject({
        formats: {
          "1:1": { state: "unavailable" },
          "9:16": { state: "unavailable" },
        },
      });
    });

    it("snapshot objeto sem chaves ⇒ 1:1 histórico", () => {
      const resolution = resolveCampaignFormat({ product: { name: "X" } });
      expect(resolution).toEqual({ kind: "1:1", source: "absent" });

      const presentation = buildIndividualFormatPresentation({
        resolution,
        lifecycle: "delivered",
      });
      expect(presentation.formats["1:1"].state).toBe("delivered");
      expect(presentation.formats["9:16"].reason).toBe("not_requested");
    });

    it("snapshot nulo ⇒ unavailable ⇒ ambos unavailable", () => {
      const resolution = resolveCampaignFormat(null);
      expect(resolution.kind).toBe("unavailable");
      const presentation = buildIndividualFormatPresentation({
        resolution,
        lifecycle: "delivered",
      });
      expect(presentation.formats["1:1"].state).toBe("unavailable");
      expect(presentation.formats["9:16"].state).toBe("unavailable");
    });

    it("contrato desconhecido/incoerente ⇒ unavailable ⇒ ambos unavailable", () => {
      const unknownFormat = resolveCampaignFormat({
        campaignFormat: "3:4",
        formatContractVersion: "x",
      });
      const incoherent = resolveCampaignFormat({
        campaignFormat: "9:16",
        formatContractVersion: "f60.7-two-format-v1",
      });

      for (const resolution of [unknownFormat, incoherent]) {
        expect(resolution.kind).toBe("unavailable");
        const presentation = buildIndividualFormatPresentation({
          resolution,
          lifecycle: "delivered",
        });
        expect(presentation.formats["1:1"].state).toBe("unavailable");
        expect(presentation.formats["9:16"].state).toBe("unavailable");
      }
    });

    it("snapshot não-objeto/array ⇒ unavailable; fluxo indeterminado usa unknown", () => {
      for (const snapshot of ["texto", 42, [], ["x"]]) {
        expect(resolveCampaignFormat(snapshot).kind).toBe("unavailable");
      }
      const indeterminate = buildUnknownFormatPresentation();
      expect(indeterminate.formats["1:1"].state).toBe("unknown");
      expect(indeterminate.formats["9:16"].state).toBe("unknown");
    });
  });

  describe("segurança e pureza", () => {
    it("retorna objetos congelados e nunca lança", () => {
      const outputs = [
        buildJointFormatPresentation({
          "1:1": { state: "delivered", refunded: false },
          "9:16": { state: "absent", refunded: true },
        }),
        buildIndividualFormatPresentation({
          resolution: resolveCampaignFormat(null),
          lifecycle: "unknown",
        }),
        buildUnknownFormatPresentation(),
        buildUnavailableFormatPresentation(),
      ];

      for (const output of outputs) {
        expect(Object.isFrozen(output)).toBe(true);
        expect(Object.isFrozen(output.formats)).toBe(true);
        expect(Object.isFrozen(output.formats["1:1"])).toBe(true);
        expect(Object.isFrozen(output.formats["9:16"])).toBe(true);
      }
    });

    it("módulo não importa server-only, Supabase, fetch, React ou storage", () => {
      const source = readFileSync(
        join(process.cwd(), "src/lib/campaign/format-presentation.ts"),
        "utf8",
      );

      expect(source).not.toMatch(/["']server-only["']/);
      expect(source).not.toMatch(/@\/lib\/supabase/);
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/from\s+["']react["']/);
      expect(source).not.toMatch(/\.storage\b/);
      expect(source).not.toMatch(/from\s+["'][^"']*storage/i);
      expect(source).not.toMatch(/from\s+["']@\/lib\/product-two-format/);
    });
  });
});
