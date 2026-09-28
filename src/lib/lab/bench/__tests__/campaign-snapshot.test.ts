// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  BenchCampaignSnapshotError,
  assertBenchCampaignSnapshot,
  buildBenchCampaignSnapshot,
  resolveBenchIntent,
} from "../domain/campaign-snapshot";
import type { BenchConfig, BenchOffer, BenchProduct } from "../domain/schemas";

/**
 * Snapshot de campanha da bancada (F48.2.2, D1).
 *
 * Módulo **puro** — nenhum I/O, nenhuma rede, nenhum serviço produtivo. Cobre:
 * montagem produto/oferta com intenção resolvida registrada explicitamente;
 * intenção inferida dos preços marcada como `inferred_from_prices`; determinismo;
 * campos mínimos exigidos por `assertBenchCampaignSnapshot`; e ausência de imports
 * de crédito/entrega/correção/publicação e de client Supabase.
 */

const CONFIG: BenchConfig = {
  pipeline: "manual-direto",
  formato: "1:1",
  modelo: "gpt-image-2",
  qualidade: "low",
  intencao: "oferta",
  tipoConteudo: "produto",
  estrutura: "peca-unica",
  tema: "nenhum",
};

const PRODUCT: BenchProduct = {
  name: "Cafeteira Aurora",
  priceCents: 12990,
  originalPriceCents: 19990,
  description: "Cafeteira 30 xícaras",
};

const OFFER: BenchOffer = { text: "Oferta da semana", validUntil: "2026-10-01" };

// ─── Intenção resolvida ──────────────────────────────────────────────────────

describe("resolveBenchIntent", () => {
  it("infere a intenção a partir do preço promocional", () => {
    expect(resolveBenchIntent({ product: PRODUCT, offer: OFFER })).toEqual({
      intent: "offer",
      intentResolvedFrom: "inferred_from_prices",
    });
  });

  it("marca a intenção como explícita quando não há preço promocional", () => {
    const product: BenchProduct = { name: "Cafeteira Aurora", priceCents: 12990 };
    expect(resolveBenchIntent({ product, offer: OFFER })).toEqual({
      intent: "offer",
      intentResolvedFrom: "explicit",
    });
  });

  it("não infere quando o preço original não é maior que o preço atual", () => {
    const product: BenchProduct = {
      name: "Cafeteira Aurora",
      priceCents: 19990,
      originalPriceCents: 19990,
    };
    expect(resolveBenchIntent({ product, offer: OFFER }).intentResolvedFrom).toBe("explicit");
  });
});

// ─── Snapshot produto/oferta ─────────────────────────────────────────────────

describe("buildBenchCampaignSnapshot", () => {
  it("monta o snapshot compatível e registra a intenção resolvida explicitamente", () => {
    const snapshot = buildBenchCampaignSnapshot({ product: PRODUCT, offer: OFFER, config: CONFIG });

    expect(snapshot.product).toEqual({
      source: "manual",
      name: "Cafeteira Aurora",
      description: "Cafeteira 30 xícaras",
    });
    expect(snapshot.commercial).toEqual({
      intent: "offer",
      originalPriceCents: 19990,
      discountedPriceCents: 12990,
      validity: { enabled: true, displayText: "2026-10-01" },
    });
    expect(snapshot.offer).toEqual({ text: "Oferta da semana", validUntil: "2026-10-01" });
    expect(snapshot.intent).toBe("offer");
    expect(snapshot.intentResolvedFrom).toBe("inferred_from_prices");
    expect(snapshot.format).toBe("1:1");
    expect(snapshot.locale).toBe("pt-BR");
  });

  it("é determinístico (mesma entrada ⇒ mesma saída)", () => {
    const first = buildBenchCampaignSnapshot({ product: PRODUCT, offer: OFFER, config: CONFIG });
    const second = buildBenchCampaignSnapshot({ product: PRODUCT, offer: OFFER, config: CONFIG });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

// ─── Campos mínimos ──────────────────────────────────────────────────────────

describe("assertBenchCampaignSnapshot", () => {
  it("aceita um snapshot completo", () => {
    const snapshot = buildBenchCampaignSnapshot({ product: PRODUCT, offer: OFFER, config: CONFIG });
    expect(assertBenchCampaignSnapshot(snapshot)).toBe(snapshot);
  });

  it.each([
    ["sem produto", { offer: OFFER, intent: "offer", intentResolvedFrom: "explicit", config: CONFIG }],
    [
      "sem oferta",
      { product: PRODUCT, intent: "offer", intentResolvedFrom: "explicit", config: CONFIG },
    ],
    [
      "sem intenção",
      { product: PRODUCT, offer: OFFER, intentResolvedFrom: "explicit", config: CONFIG },
    ],
  ])("recusa snapshot %s com missing_campaign_snapshot", (_label, snapshot) => {
    let caught: unknown = null;
    try {
      assertBenchCampaignSnapshot(snapshot);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BenchCampaignSnapshotError);
    expect((caught as BenchCampaignSnapshotError).code).toBe("missing_campaign_snapshot");
  });
});

// ─── Pureza (nenhum serviço produtivo) ───────────────────────────────────────

describe("campaign-snapshot — módulo puro", () => {
  it("não importa serviços de crédito/entrega/correção/publicação nem client Supabase", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/campaign-snapshot.ts"),
      "utf8",
    );
    const importLines = source
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import"));

    expect(importLines.join("\n")).not.toMatch(/credit|delivery|correction|publication/i);
    expect(importLines.join("\n")).not.toMatch(/@\/lib\/supabase/);
  });
});
