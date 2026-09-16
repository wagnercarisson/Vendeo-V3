import { resolveAiCost } from "@/lib/ai-cost/cost-estimator";
import type { CostResolution, TokenUsage } from "@/lib/ai-cost/types";
import { CAPABILITY_GENERATION_TYPE } from "./generation-type-map";
import { sanitizeAiErrorMessage } from "./types";
import type { AiCallEnvelope, AiCapability, AiProtocol, AiTelemetrySink } from "./types";

/**
 * Sink de telemetria do Laboratório de IA (F48.1, D6/D8/D15).
 *
 * Vive em `src/lib/ai/**` por exigência do gate de arquitetura: `resolveAiCost`
 * só é permitido neste prefixo.
 *
 * Diferença central em relação ao sink de produção: o laboratório **calcula o
 * custo em modo leitura** e **acumula** as entradas sanitizadas no run. Ele
 * **não** persiste telemetria produtiva — nenhum evento de geração é gravado e
 * o tracker de custos não é acionado (T-48-1-35).
 *
 * A `CostResolution` é preservada **real e completa** (fonte, versão de pricing,
 * versão da fórmula, nota de estimativa e componentes da fórmula): o
 * `estimatedCostUsd` é o agregado, não a única evidência. A cobertura
 * `complete|partial|missing` é derivada no domínio do laboratório a partir
 * desses campos reais (T-48-1-37).
 *
 * Nenhum secret: a entrada carrega apenas capability/provider/modelo/protocolo/
 * status/latência/usage/custo/errorType sanitizado (T-48-1-36).
 */

/** Uma chamada real acumulada no run — evidência técnica, sem secret. */
export interface LabCallEntry {
  capability: AiCapability;
  provider: string;
  model: string;
  protocol: AiProtocol;
  status: "success" | "failed" | "timeout";
  durationMs: number;
  usage?: TokenUsage;
  cost: CostResolution;
  errorType?: string;
}

export interface LabTelemetrySinkParams {
  /** Callback opcional chamado a cada entrada acumulada (ordem de emissão). */
  onEntry?: (entry: LabCallEntry) => void;
}

export class LabTelemetrySink implements AiTelemetrySink {
  private readonly collected: LabCallEntry[] = [];

  constructor(private readonly params: LabTelemetrySinkParams = {}) {}

  async emit(envelope: AiCallEnvelope): Promise<void> {
    // Exatamente **uma** entrada por envelope: o cálculo/construção pode falhar
    // (registro sanitizado) e a notificação do consumidor é best-effort à parte.
    const entry = await this.buildEntry(envelope);
    this.collected.push(entry);
    this.notify(entry);
  }

  /**
   * Calcula o custo e monta a entrada. Uma falha aqui (ex.: `resolveAiCost`)
   * registra a entrada de forma sanitizada, sem custo conhecido — o run prossegue.
   */
  private async buildEntry(envelope: AiCallEnvelope): Promise<LabCallEntry> {
    try {
      const generationType = CAPABILITY_GENERATION_TYPE[envelope.capability];
      const cost = await resolveAiCost({
        provider: envelope.provider,
        model: envelope.model,
        usage: envelope.usage,
        providerReportedCostUsd: envelope.providerReportedCostUsd,
        // A tool image_generation só conta quando o envelope declara o uso REAL
        // (nunca inferida do protocolo) — mesma regra do sink de produção.
        imageGenerationTool: envelope.usageMeta?.imageGenerationTool === true,
        generationType,
      });

      return {
        capability: envelope.capability,
        provider: envelope.provider,
        model: envelope.model,
        protocol: envelope.protocol,
        status: envelope.status,
        durationMs: envelope.durationMs,
        usage: envelope.usage,
        cost,
        errorType: envelope.errorType ? sanitizeAiErrorMessage(envelope.errorType) : undefined,
      };
    } catch (err) {
      return {
        capability: envelope.capability,
        provider: envelope.provider,
        model: envelope.model,
        protocol: envelope.protocol,
        status: envelope.status,
        durationMs: envelope.durationMs,
        usage: envelope.usage,
        cost: { estimatedCostUsd: null, costSource: "not_available" },
        errorType: sanitizeAiErrorMessage(err instanceof Error ? err.message : String(err)),
      };
    }
  }

  /**
   * Notifica o consumidor **best-effort**, em try/catch separado: uma falha do
   * callback (ex.: stream NDJSON desconectado) nunca é interpretada como falha do
   * sink, nunca adiciona uma segunda entrada e nunca escapa para o gateway.
   */
  private notify(entry: LabCallEntry): void {
    try {
      this.params.onEntry?.(entry);
    } catch {
      // Best-effort: o consumidor não pode corromper a evidência do run.
    }
  }

  /** Entradas acumuladas, na ordem de emissão. */
  get entries(): readonly LabCallEntry[] {
    return this.collected;
  }

  /**
   * `CostResolution` agregada do run: soma dos `estimatedCostUsd` não nulos e
   * demais campos da **última** entrada (fonte/versões/componentes). `null`
   * quando nenhuma chamada foi registrada.
   */
  get costSummary(): CostResolution | null {
    if (this.collected.length === 0) return null;

    const costs = this.collected.map((entry) => entry.cost);
    const known = costs.filter((cost) => cost.estimatedCostUsd !== null);
    const total = known.reduce((sum, cost) => sum + (cost.estimatedCostUsd ?? 0), 0);
    const last = costs[costs.length - 1];

    return {
      ...last,
      estimatedCostUsd: known.length > 0 ? Number(total.toFixed(6)) : null,
    };
  }
}
