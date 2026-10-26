// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import { render, screen, within } from "@testing-library/react";
import { OpenAiPricingSectionView } from "../openai-pricing-section";
import type { OpenAiPricingDashboardResult } from "@/lib/ai-cost/openai-pricing-dashboard";
import type { PricingSyncState } from "@/lib/ai-cost/openai-pricing-sync-state";

function makeData(
  overrides: Partial<OpenAiPricingDashboardResult> = {},
): OpenAiPricingDashboardResult {
  const fresh: PricingSyncState = {
    kind: "fresh",
    lastSuccessAt: "2026-10-26T19:01:00.000Z",
    lastAttemptAt: "2026-10-26T19:00:00.000Z",
    lastAttemptStatus: "success",
  };

  return {
    prices: [
      {
        id: "row-gpt55",
        provider: "openai",
        model: "gpt-5.5",
        label: "GPT-5.5",
        quality: null,
        inputTokenUsdPer1M: 5,
        cachedInputTokenUsdPer1M: 0.5,
        outputTokenUsdPer1M: 30,
        inputImageTokenUsdPer1M: null,
        cachedInputImageTokenUsdPer1M: null,
        outputImageTokenUsdPer1M: null,
        imageUnitUsd: null,
        effectiveFrom: "2026-10-20T10:00:00.000Z",
      },
      {
        id: "row-flare-low",
        provider: "openai",
        model: "gpt-image-2.5-flare",
        label: "GPT Image 2.5 Flare",
        quality: "low",
        inputTokenUsdPer1M: 5,
        cachedInputTokenUsdPer1M: 1.25,
        outputTokenUsdPer1M: null,
        inputImageTokenUsdPer1M: 8,
        cachedInputImageTokenUsdPer1M: 2,
        outputImageTokenUsdPer1M: 30,
        imageUnitUsd: 0.036,
        effectiveFrom: "2026-10-25T12:00:00.000Z",
      },
    ],
    pricesQueryFailed: false,
    lastPriceChangedAt: "2026-10-25T12:00:00.000Z",
    lastSuccessAt: fresh.lastSuccessAt,
    lastAttempt: {
      id: "attempt-1",
      status: "success",
      startedAt: "2026-10-26T19:00:00.000Z",
      finishedAt: "2026-10-26T19:01:00.000Z",
      failureStage: null,
      failureCode: null,
    },
    state: fresh,
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
    ...overrides,
  };
}

describe("OpenAiPricingSectionView — tabela persistida e estado", () => {
  it("mostra unidade, datas em America/Sao_Paulo, valores persistidos e ID do modelo", () => {
    render(<OpenAiPricingSectionView data={makeData()} />);

    expect(screen.getByText("Tarifas OpenAI")).toBeInTheDocument();
    expect(screen.getByText("US$ por 1 milhão de tokens")).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument();

    // 19:01 UTC = 16:01 America/Sao_Paulo.
    expect(screen.getByTestId("openai-pricing-last-success")).toHaveTextContent(
      "26/10/2026, 16:01",
    );
    expect(screen.getByTestId("openai-pricing-last-change")).toHaveTextContent(
      "25/10/2026, 09:00",
    );

    const gpt55 = screen.getByTestId("openai-pricing-row-row-gpt55");
    expect(within(gpt55).getByText("GPT-5.5")).toBeInTheDocument();
    expect(within(gpt55).getByText("gpt-5.5")).toBeInTheDocument();
    expect(within(gpt55).getByText("5,00")).toBeInTheDocument();
    expect(within(gpt55).getByText("0,50")).toBeInTheDocument();
    expect(within(gpt55).getByText("30,00")).toBeInTheDocument();

    const flare = screen.getByTestId("openai-pricing-row-row-flare-low");
    expect(within(flare).getByText("Low")).toBeInTheDocument();
    expect(within(flare).getByText("8,00")).toBeInTheDocument();
    expect(within(flare).getByText("2,00")).toBeInTheDocument();
    expect(within(flare).getByText("30,00")).toBeInTheDocument();

    // Preço por unidade não é misturado com a unidade por 1M de tokens.
    expect(screen.getByText("Preços por unidade de imagem")).toBeInTheDocument();
    expect(screen.getByText("US$ por imagem")).toBeInTheDocument();
    expect(screen.getByText("0,036")).toBeInTheDocument();
  });

  it("dimensão não aplicável aparece como '—', nunca zero", () => {
    render(<OpenAiPricingSectionView data={makeData()} />);

    const gpt55 = screen.getByTestId("openai-pricing-row-row-gpt55");
    // Entrada/saída de imagem não aplicáveis ao modelo textual.
    expect(within(gpt55).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("sucesso fresco não mostra aviso ativo", () => {
    render(<OpenAiPricingSectionView data={makeData()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("falha após sucesso mantém aviso com última confirmação e tentativa", () => {
    const data = makeData({
      state: {
        kind: "failed",
        lastSuccessAt: "2026-10-26T19:01:00.000Z",
        lastAttemptAt: "2026-10-26T19:30:00.000Z",
        lastAttemptStatus: "failed",
      },
      lastAttempt: {
        id: "attempt-fail",
        status: "failed",
        startedAt: "2026-10-26T19:30:00.000Z",
        finishedAt: "2026-10-26T19:31:00.000Z",
        failureStage: "fetch",
        failureCode: "fetch_timeout",
      },
    });

    render(<OpenAiPricingSectionView data={data} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Atualização das tarifas OpenAI pendente.");
    expect(alert).toHaveTextContent("Última confirmação: 26/10/2026, 16:01.");
    expect(alert).toHaveTextContent("Última tentativa: 26/10/2026, 16:30 — falhou.");
    expect(alert).toHaveTextContent(
      "Os custos continuam sendo estimados com a última tabela confirmada.",
    );
  });

  it("stale (>36h) adapta o aviso", () => {
    const data = makeData({
      state: {
        kind: "stale",
        lastSuccessAt: "2026-10-24T10:00:00.000Z",
        lastAttemptAt: "2026-10-26T19:00:00.000Z",
        lastAttemptStatus: "success",
      },
    });

    render(<OpenAiPricingSectionView data={data} />);
    expect(screen.getByRole("alert")).toHaveTextContent("há mais de 36 horas");
  });

  it("nunca confirmada adapta o aviso", () => {
    const data = makeData({
      state: {
        kind: "never",
        lastSuccessAt: null,
        lastAttemptAt: "2026-10-26T19:00:00.000Z",
        lastAttemptStatus: "failed",
      },
      lastSuccessAt: null,
    });

    render(<OpenAiPricingSectionView data={data} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nenhuma confirmação automática registrada.",
    );
    expect(screen.getAllByText("Nunca confirmada").length).toBeGreaterThan(0);
  });

  it("estado indisponível não afirma que a tabela está atualizada", () => {
    const data = makeData({
      state: {
        kind: "unavailable",
        lastSuccessAt: null,
        lastAttemptAt: null,
        lastAttemptStatus: null,
      },
      lastSuccessAt: null,
      lastAttempt: null,
    });

    render(<OpenAiPricingSectionView data={data} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Não foi possível consultar o estado da atualização das tarifas OpenAI.",
    );
    expect(alert).toHaveTextContent("sem confirmação de atualização");
    expect(screen.getByText("Estado indisponível")).toBeInTheDocument();
  });

  it("falha na consulta das tarifas persistidas mostra erro explícito", () => {
    render(<OpenAiPricingSectionView data={makeData({ pricesQueryFailed: true })} />);
    expect(
      screen.getByText("Não foi possível consultar as tarifas persistidas."),
    ).toBeInTheDocument();
  });
});
