import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeBR } from "@/lib/formatters";
import {
  getOpenAiPricingDashboard,
  type OpenAiPricingDashboardResult,
  type OpenAiPricingDashboardRow,
} from "@/lib/ai-cost/openai-pricing-dashboard";
import type {
  PricingSyncAttemptSummary,
  PricingSyncState,
} from "@/lib/ai-cost/openai-pricing-sync-state";

/**
 * Seção administrativa “Tarifas OpenAI” (somente leitura).
 * Mostra os valores PERSISTIDOS em ai_model_pricing e o estado da última
 * tentativa de sincronização — nunca os valores recém-extraídos.
 */

function formatTokenPrice(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

function qualityLabel(quality: string | null): string {
  if (quality === null) return "—";
  if (quality === "low") return "Low";
  if (quality === "medium") return "Medium";
  return quality;
}

function attemptStatusLabel(attempt: PricingSyncAttemptSummary | null): string {
  if (!attempt) return "—";
  if (attempt.status === "success") return "sucesso";
  if (attempt.status === "running") return "em andamento";
  return "falhou";
}

function stateBadge(state: PricingSyncState): { variant: "ready" | "error" | "generating" | "default"; label: string } {
  switch (state.kind) {
    case "fresh":
      return { variant: "ready", label: "Confirmada" };
    case "running":
      return { variant: "generating", label: "Em andamento" };
    case "failed":
      return { variant: "error", label: "Pendente" };
    case "stale":
      return { variant: "error", label: "Pendente" };
    case "never":
      return { variant: "error", label: "Nunca confirmada" };
    case "interrupted":
      return { variant: "error", label: "Interrompida" };
    case "unavailable":
      return { variant: "default", label: "Estado indisponível" };
  }
}

function syncNotice(
  state: PricingSyncState,
): { variant: "info" | "warning"; lines: string[] } | null {
  const success = state.lastSuccessAt
    ? formatDateTimeBR(state.lastSuccessAt)
    : "nunca confirmada";
  const lastResolvedAttempt = state.lastAttemptAt
    ? `${formatDateTimeBR(state.lastAttemptAt)} — ${
        state.lastAttemptStatus === "failed"
          ? "falhou"
          : state.lastAttemptStatus === "success"
            ? "sucesso"
            : "em andamento"
      }`
    : "sem tentativa registrada";
  const runningLine =
    state.running && state.runningSince
      ? `Nova consulta em andamento desde ${formatDateTimeBR(state.runningSince)}.`
      : null;

  if (state.kind === "fresh") return null;

  if (state.kind === "running") {
    return {
      variant: "info",
      lines: [
        "Atualização das tarifas OpenAI em andamento.",
        `Última confirmação: ${success}.`,
        ...(runningLine ? [runningLine] : []),
      ],
    };
  }

  if (state.kind === "failed") {
    return {
      variant: "warning",
      lines: [
        "Atualização das tarifas OpenAI pendente.",
        `Última confirmação: ${success}.`,
        `Última tentativa: ${lastResolvedAttempt}.`,
        ...(runningLine ? [runningLine] : []),
        "Os custos continuam sendo estimados com a última tabela confirmada.",
      ],
    };
  }

  if (state.kind === "stale") {
    return {
      variant: "warning",
      lines: [
        "Atualização das tarifas OpenAI pendente.",
        `Última confirmação: ${success} (há mais de 36 horas).`,
        `Última tentativa: ${lastResolvedAttempt}.`,
        ...(runningLine ? [runningLine] : []),
        "Os custos continuam sendo estimados com a última tabela confirmada.",
      ],
    };
  }

  if (state.kind === "interrupted") {
    const interruptedAt = state.lastAttemptAt ?? null;
    return {
      variant: "warning",
      lines: [
        "Atualização das tarifas OpenAI pendente.",
        state.lastSuccessAt
          ? `Última confirmação: ${success}.`
          : "Nenhuma confirmação automática registrada.",
        interruptedAt
          ? `A última execução ficou interrompida em ${formatDateTimeBR(interruptedAt)}.`
          : "A última execução ficou interrompida.",
        ...(runningLine ? [runningLine] : []),
        "Os custos continuam sendo estimados com a última tabela confirmada.",
      ],
    };
  }

  if (state.kind === "never") {
    return {
      variant: "warning",
      lines: [
        "Atualização das tarifas OpenAI pendente.",
        "Nenhuma confirmação automática registrada.",
        `Última tentativa: ${lastResolvedAttempt}.`,
        ...(runningLine ? [runningLine] : []),
        "Os custos continuam sendo estimados com a última tabela disponível.",
      ],
    };
  }

  return {
    variant: "warning",
    lines: [
      "Não foi possível consultar o estado da atualização das tarifas OpenAI.",
      "A tabela exibida reflete os últimos valores persistidos, sem confirmação de atualização.",
    ],
  };
}

function hasAny(
  prices: readonly OpenAiPricingDashboardRow[],
  selector: (row: OpenAiPricingDashboardRow) => number | null,
): boolean {
  return prices.some((row) => selector(row) !== null);
}

export function OpenAiPricingSectionView({
  data,
}: {
  data: OpenAiPricingDashboardResult;
}) {
  const badge = stateBadge(data.state);
  const notice = syncNotice(data.state);

  const showTextCache = hasAny(data.prices, (row) => row.cachedInputTokenUsdPer1M);
  const showTextOutput = hasAny(data.prices, (row) => row.outputTokenUsdPer1M);
  const showImageInput = hasAny(data.prices, (row) => row.inputImageTokenUsdPer1M);
  const showImageCache = hasAny(
    data.prices,
    (row) => row.cachedInputImageTokenUsdPer1M,
  );
  const showImageOutput = hasAny(data.prices, (row) => row.outputImageTokenUsdPer1M);
  const perUnitRows = data.prices.filter((row) => row.imageUnitUsd !== null);

  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Tarifas OpenAI</h2>
            <p className="text-sm text-muted-foreground">
              US$ por 1 milhão de tokens
            </p>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        {notice && (
          <div
            role={notice.variant === "warning" ? "alert" : "status"}
            className={
              notice.variant === "warning"
                ? "rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 text-sm text-accent-amber"
                : "rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-3 text-sm text-accent-blue"
            }
          >
            {notice.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}

        <div className="grid gap-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Última conferência</p>
            <p data-testid="openai-pricing-last-success">
              {data.lastSuccessAt
                ? formatDateTimeBR(data.lastSuccessAt)
                : "Nunca confirmada"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Última tentativa</p>
            <p data-testid="openai-pricing-last-attempt">
              {data.lastAttempt
                ? `${formatDateTimeBR(data.lastAttempt.startedAt)} — ${attemptStatusLabel(
                    data.lastAttempt,
                  )}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Última alteração de preços</p>
            <p data-testid="openai-pricing-last-change">
              {data.lastPriceChangedAt
                ? formatDateTimeBR(data.lastPriceChangedAt)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Fonte</p>
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent-blue hover:underline"
            >
              OpenAI Pricing
            </a>
          </div>
        </div>

        {data.pricesQueryFailed ? (
          <p className="text-sm text-destructive">
            Não foi possível consultar as tarifas persistidas.
          </p>
        ) : data.prices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma tarifa OpenAI persistida.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Modelo</th>
                  <th className="px-3 py-2 font-medium">Qualidade</th>
                  <th className="px-3 py-2 font-medium">Entrada textual</th>
                  {showTextCache && (
                    <th className="px-3 py-2 font-medium">Entrada textual em cache</th>
                  )}
                  {showTextOutput && (
                    <th className="px-3 py-2 font-medium">Saída textual</th>
                  )}
                  {showImageInput && (
                    <th className="px-3 py-2 font-medium">Entrada de imagem</th>
                  )}
                  {showImageCache && (
                    <th className="px-3 py-2 font-medium">
                      Entrada de imagem em cache
                    </th>
                  )}
                  {showImageOutput && (
                    <th className="px-3 py-2 font-medium">Saída de imagem</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.prices.map((row) => (
                  <tr key={row.id} data-testid={`openai-pricing-row-${row.id}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {row.model}
                      </div>
                    </td>
                    <td className="px-3 py-2">{qualityLabel(row.quality)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatTokenPrice(row.inputTokenUsdPer1M)}
                    </td>
                    {showTextCache && (
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTokenPrice(row.cachedInputTokenUsdPer1M)}
                      </td>
                    )}
                    {showTextOutput && (
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTokenPrice(row.outputTokenUsdPer1M)}
                      </td>
                    )}
                    {showImageInput && (
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTokenPrice(row.inputImageTokenUsdPer1M)}
                      </td>
                    )}
                    {showImageCache && (
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTokenPrice(row.cachedInputImageTokenUsdPer1M)}
                      </td>
                    )}
                    {showImageOutput && (
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTokenPrice(row.outputImageTokenUsdPer1M)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {perUnitRows.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Preços por unidade de imagem</h3>
            <p className="text-xs text-muted-foreground">US$ por imagem</p>
            <p className="text-xs text-muted-foreground">
              Valores preservados pelo versionamento de preços. Eles não são
              conferidos pela sincronização automática das tarifas por token; o
              selo de conferência acima se refere somente aos valores por 1
              milhão de tokens.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-surface text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Modelo</th>
                    <th className="px-3 py-2 font-medium">Qualidade</th>
                    <th className="px-3 py-2 font-medium">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {perUnitRows.map((row) => (
                    <tr key={`unit-${row.id}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.label}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.model}
                        </div>
                      </td>
                      <td className="px-3 py-2">{qualityLabel(row.quality)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTokenPrice(row.imageUnitUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Wrapper de servidor: busca os valores PERSISTIDOS e o estado da sincronização. */
export async function OpenAiPricingSection() {
  const data = await getOpenAiPricingDashboard();
  return <OpenAiPricingSectionView data={data} />;
}
