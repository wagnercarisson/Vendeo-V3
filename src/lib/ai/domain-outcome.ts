import type { AiCallEnvelope, AiTelemetryContext } from "./types";

/**
 * Resultado de **domínio** de uma capacidade estruturada (F46-03/D11).
 *
 * O `status` do `AiCallEnvelope` permanece o resultado **HTTP** (o gateway emite
 * um envelope por tentativa real). A classificação de domínio — decidida pelo
 * serviço DEPOIS de o gateway retornar, ao interpretar o conteúdo — é anexada
 * ao `metadata` do evento (`domainStatus`/`domainErrorType`), preservando um
 * **único** envelope.
 */
export interface AiDomainOutcome {
  domainStatus: "success" | "failed";
  domainErrorType?: string;
}

export interface AiDomainOutcomeHandle {
  /** Contexto a passar ao `invoke` — bufferiza o envelope até `complete()`. */
  telemetry: AiTelemetryContext;
  /**
   * Encaminha o envelope bufferizado (uma única vez) ao sink original,
   * anexando `domainStatus`/`domainErrorType` ao metadata quando houver outcome.
   * Idempotente. Sem outcome (ex.: falha HTTP, sem interpretação de domínio),
   * encaminha o envelope como está.
   */
  complete(outcome?: AiDomainOutcome): Promise<void>;
}

/**
 * Envolve um `AiTelemetryContext` para que o serviço anexe a classificação de
 * domínio ao **mesmo** envelope emitido pelo gateway — sem emitir um segundo
 * evento e sem conduzir a persistência (o sink original continua sendo o único
 * persistidor; `onCostResolved` é preservado, pois o flush passa pelo sink real).
 *
 * Reutilizável por qualquer capacidade estruturada (JSON) migrada na F46.
 */
export function withDomainOutcome(telemetry: AiTelemetryContext): AiDomainOutcomeHandle {
  const pending: AiCallEnvelope[] = [];
  let completed = false;

  const buffered: AiTelemetryContext = {
    ...telemetry,
    sink: {
      emit(envelope: AiCallEnvelope): void {
        pending.push(envelope);
      },
    },
  };

  return {
    telemetry: buffered,
    async complete(outcome?: AiDomainOutcome): Promise<void> {
      if (completed) return;
      completed = true;
      const envelopes = pending.splice(0, pending.length);
      for (const envelope of envelopes) {
        try {
          await telemetry.sink.emit(outcome ? annotate(envelope, outcome) : envelope);
        } catch (err) {
          // Best-effort: falha do sink nunca escapa nem sobrescreve o resultado
          // do serviço (a classificação/retorno segue normalmente).
          console.error(
            "[ai-domain-outcome] flush do envelope falhou (best-effort):",
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    },
  };
}

function annotate(envelope: AiCallEnvelope, outcome: AiDomainOutcome): AiCallEnvelope {
  return {
    ...envelope,
    metadata: {
      ...(envelope.metadata ?? {}),
      domainStatus: outcome.domainStatus,
      ...(outcome.domainErrorType ? { domainErrorType: outcome.domainErrorType } : {}),
    },
  };
}
