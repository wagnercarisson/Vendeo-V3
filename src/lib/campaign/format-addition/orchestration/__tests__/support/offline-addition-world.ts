/**
 * F62/62-04 — Mundo offline declarado para as jornadas da adição.
 *
 * Contadores explícitos de efeitos; nenhum banco/Storage/provider é acessado.
 * `campaignWrites`/`squareWrites`/`copyWrites` devem permanecer em zero nas
 * jornadas de entrega/estorno.
 */
export interface OfflineAdditionCounters {
  providerCalls: number;
  expansionCalls: number;
  deliveryCalls: number;
  refundCalls: number;
  thumbnailCalls: number;
  campaignWrites: number;
  squareWrites: number;
  copyWrites: number;
}

export interface OfflineAdditionWorld {
  readonly counters: OfflineAdditionCounters;
  recordProviderCall(): void;
  recordExpansionCall(): void;
  recordDeliveryCall(): void;
  recordRefundCall(): void;
  recordThumbnailCall(): void;
  recordCampaignWrite(): void;
  recordSquareWrite(): void;
  recordCopyWrite(): void;
  snapshot(): OfflineAdditionCounters;
}

export function createOfflineAdditionWorld(): OfflineAdditionWorld {
  const counters: OfflineAdditionCounters = {
    providerCalls: 0,
    expansionCalls: 0,
    deliveryCalls: 0,
    refundCalls: 0,
    thumbnailCalls: 0,
    campaignWrites: 0,
    squareWrites: 0,
    copyWrites: 0,
  };

  return {
    counters,
    recordProviderCall: () => {
      counters.providerCalls += 1;
    },
    recordExpansionCall: () => {
      counters.expansionCalls += 1;
    },
    recordDeliveryCall: () => {
      counters.deliveryCalls += 1;
    },
    recordRefundCall: () => {
      counters.refundCalls += 1;
    },
    recordThumbnailCall: () => {
      counters.thumbnailCalls += 1;
    },
    recordCampaignWrite: () => {
      counters.campaignWrites += 1;
    },
    recordSquareWrite: () => {
      counters.squareWrites += 1;
    },
    recordCopyWrite: () => {
      counters.copyWrites += 1;
    },
    snapshot: () => Object.freeze({ ...counters }),
  };
}
