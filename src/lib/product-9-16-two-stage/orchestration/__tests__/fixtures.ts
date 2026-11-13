import { createHash } from "node:crypto";

/**
 * Fixture compartilhada do estado duravel: bytes originais, data URL exato,
 * descriptor e `resumeContext` no mesmo formato que a rota grava.
 */
export const DURABLE_BYTES = Buffer.from("durable-image-bytes");
export const DURABLE_DATA_URL = `data:image/png;base64,${DURABLE_BYTES.toString("base64")}`;
export const DURABLE_CONTENT_ID = createHash("sha256")
  .update(DURABLE_DATA_URL)
  .digest("hex");

export const DURABLE_BRIEFING = {
  backgroundDirection: "studio",
  product: { name: "Produto" },
  commercial: { intent: "offer" },
  constraints: { mandatoryArtworkText: null },
};

export function durableDescriptor() {
  return {
    kind: "product" as const,
    role: "primary" as const,
    index: 0,
    contentId: DURABLE_CONTENT_ID,
    storagePath: "s/c/inputs/durable.png",
    mimeType: "image/png",
    dataUrlPrefix: "data:image/png;base64,",
    byteSize: DURABLE_BYTES.byteLength,
  };
}

export function durableResumeContext() {
  return {
    briefing: DURABLE_BRIEFING,
    briefingText: JSON.stringify(DURABLE_BRIEFING),
    campaignIntent: "offer",
    backgroundDirection: "studio",
    identityDirective: null,
    identityContext: null,
    copyContext: { storeName: "Loja" },
    economicSnapshot: { usdBrlRateAtGeneration: 5.1, creditValueBrlAtGeneration: 1 },
    inputFiles: [durableDescriptor()],
  };
}

export function durableFrozenReferences() {
  return [
    {
      kind: "product",
      id: DURABLE_CONTENT_ID,
      role: "primary",
      index: 0,
    },
  ];
}

export function durableRow() {
  return {
    input_snapshot: {
      resumeContext: durableResumeContext(),
      frozenContentReferences: durableFrozenReferences(),
    },
    identity_snapshot: null,
  };
}

export function durableClient(row: unknown = durableRow()) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  } as never;
}

export const readDurableBytes = async () =>
  ({ kind: "bytes" as const, bytes: DURABLE_BYTES });

/** Deps de reconstrucao para suites que executam a etapa base. */
export function durableReconstruction(row: unknown = durableRow()) {
  return {
    client: durableClient(row),
    readInputBytes: readDurableBytes,
  };
}
