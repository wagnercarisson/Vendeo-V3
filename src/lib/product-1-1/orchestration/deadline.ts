/**
 * F56.2b2d (Plano 02) — orçamento de tempo PURO do fluxo Produto 1:1.
 *
 * Módulo SEM `server-only`, SEM env e SEM I/O/relógio implícito (todo instante é
 * passado pelo chamador como parâmetro — o único `Date.now()` é o default
 * conservador de `createDeadlineRejection`). É o análogo puro de
 * `src/lib/product-1-1/pilot/copy-estimate.ts`.
 *
 * Objetivo (design D2 / spec hosted-pilot + generation-orchestration): o timeout
 * interno do novo fluxo é ESTRITAMENTE menor que o teto da função Vercel
 * (`PRODUCT_1_1_PLATFORM_TIMEOUT_MS`) e reserva margem para a ÚLTIMA escrita
 * durável (persistência cooperativa). NÃO se promete escrita após um kill
 * abrupto: o estado durável anterior permanece a verdade recuperável.
 *
 * IMPORTANTE: este módulo NÃO usa `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` (legado,
 * default 300000) — o default legado permanece intacto.
 */

/** Teto da função da plataforma (Vercel `functionDefaultTimeout` = 300s). Fato
 *  não configurável em runtime. */
export const PRODUCT_1_1_PLATFORM_TIMEOUT_MS = 300_000;

/**
 * Deadline global interno do novo fluxo. DEVE ser estritamente menor que o teto.
 * Faixa aprovada no design (Open Question 1 / W9): 240–270s; default proposto
 * **240_000** (registrado no SUMMARY).
 */
export const PRODUCT_1_1_GENERATION_DEADLINE_MS = 240_000;

/**
 * Reserva de persistência: tempo mantido para a ÚLTIMA escrita durável
 * (marcador terminal `unknown`). Estritamente maior que zero e menor que
 * `PLATFORM - DEADLINE`.
 */
export const PRODUCT_1_1_PERSISTENCE_RESERVE_MS = 20_000;

/** Lança `product_1_1_deadline_not_below_platform` quando o deadline é inválido
 *  (`<= 0`) ou NÃO é estritamente menor que o teto da plataforma. */
export function assertDeadlineBelowPlatform(
  deadlineMs: number = PRODUCT_1_1_GENERATION_DEADLINE_MS,
  platformMs: number = PRODUCT_1_1_PLATFORM_TIMEOUT_MS,
): void {
  if (!(deadlineMs > 0 && deadlineMs < platformMs)) {
    throw new Error("product_1_1_deadline_not_below_platform");
  }
}

/**
 * Instante-limite ABSOLUTO. `startMs` é o INÍCIO DA REQUISIÇÃO (não a entrada do
 * orquestrador) — o tempo já consumido antes do orquestrador é descontado.
 */
export function deadlineAt(
  startMs: number,
  deadlineMs: number = PRODUCT_1_1_GENERATION_DEADLINE_MS,
): number {
  return startMs + deadlineMs;
}

/**
 * Orçamento restante para uma escrita durável, já descontada a reserva.
 * `Math.max(0, ...)` — nunca negativo.
 */
export function remainingBeforeDeadline(
  nowMs: number,
  deadlineAtMs: number,
  reserveMs: number = PRODUCT_1_1_PERSISTENCE_RESERVE_MS,
): number {
  return Math.max(0, deadlineAtMs - nowMs - reserveMs);
}

/** Orçamento restante até o deadline (timer/abort), sem descontar a reserva. */
export function remainingBudget(nowMs: number, deadlineAtMs: number): number {
  return Math.max(0, deadlineAtMs - nowMs);
}

/**
 * Guarda de escrita durável NÃO-terminal: só autoriza quando ainda há reserva
 * (`nowMs + reserveMs < deadlineAtMs`, comparação ESTRITA). NÃO promete escrita
 * após kill — se `false`, a escrita não deve ser iniciada.
 */
export function canStartDurableWrite(
  nowMs: number,
  deadlineAtMs: number,
  reserveMs: number = PRODUCT_1_1_PERSISTENCE_RESERVE_MS,
): boolean {
  return nowMs + reserveMs < deadlineAtMs;
}

/** Promessa de rejeição de deadline + cancelamento cooperativo. */
export interface DeadlineRejection {
  /** Rejeita com `product_1_1_deadline_reached` no instante-limite. */
  readonly promise: Promise<never>;
  /**
   * Limpa o timer e impede um disparo POSTERIOR. NÃO assenta a promessa: um
   * cancelamento NUNCA pode ser confundido com um resultado do provider (vazio),
   * com uma falha confirmada ou com autorização de estorno. Idempotente; sem
   * efeito se o deadline já disparou.
   */
  cancel(): void;
  /** `true` SOMENTE quando o deadline DISPAROU (não quando cancelado). */
  didHit(): boolean;
}

/**
 * Cria a promessa de rejeição do deadline. Quando o orçamento já é `<= 0` a
 * rejeição é IMEDIATA. `cancel()` limpa o timer e assenta a promessa (evita
 * timer pendente e rejeição posterior). `didHit()` expõe se o deadline disparou.
 */
export function createDeadlineRejection(
  deadlineAtMs: number,
  nowMs: number = Date.now(),
): DeadlineRejection {
  let hit = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let rejectFn: (reason: unknown) => void = () => {};

  const promise = new Promise<never>((_resolve, reject) => {
    rejectFn = reject;
  });
  // Nunca deixar a rejeição (ex.: orçamento já esgotado no construtor) sem
  // handler — o `Promise.race` do chamador anexa o handler efetivo.
  void promise.catch(() => {});

  const fire = (): void => {
    if (settled) return;
    settled = true;
    hit = true;
    rejectFn(new Error("product_1_1_deadline_reached"));
  };

  const remaining = deadlineAtMs - nowMs;
  if (remaining <= 0) {
    fire();
  } else {
    timer = setTimeout(fire, remaining);
  }

  return {
    promise,
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      // NÃO assenta a promessa com valor: cancelar NUNCA pode parecer um
      // resultado do provider (vazio) nem uma falha confirmada. Apenas impede
      // um disparo posterior do deadline.
      settled = true;
    },
    didHit(): boolean {
      return hit;
    },
  };
}
