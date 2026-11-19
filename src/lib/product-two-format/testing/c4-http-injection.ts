import "server-only";

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiInvoker } from "@/lib/ai/gateway";
import type { SquareBaseImageGateway } from "@/lib/campaign/square-base/transport";
import { runSquareBase } from "@/lib/campaign/square-base/run-square-base";
import { expandVerticalToNineSixteen } from "@/lib/campaign/vertical-expansion/expand";
import type { ExpandVerticalDeps } from "@/lib/campaign/vertical-expansion/expand";
import type { SquareBaseDeps } from "@/lib/campaign/square-base/run-square-base";
import { createNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/delivery-deps";
import type { RunNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/types";

/**
 * F60.7 C4-I — injeção determinística TEST-ONLY da jornada HTTP real.
 *
 * Só é carregado pelo loader quando `F60_7_C4_TEST_INJECTION=1`, fora de
 * produção/Vercel. Substitui exclusivamente as fronteiras de provider:
 * imagem base 1024×1024, copy e expansão 1152×2048. DB/RPC/Storage/probes
 * continuam reais. Nenhuma chamada de rede/SDK/provider é feita aqui.
 */

const DETERMINISTIC_MODEL = "c4-deterministic-provider";

export type C4ActivationStep = "base_image" | "copy" | "vertical_expansion";

export interface C4ActivationEvent {
  readonly step: C4ActivationStep;
  readonly source: "deterministic";
  readonly model: typeof DETERMINISTIC_MODEL;
}

export interface C4ActivationContext {
  readonly campaignId: string;
  readonly operationId: string;
  readonly route: "generate-image" | "continue";
}

/** Log estruturado TEST-ONLY; sem conteúdo, segredos, usage ou custo. */
export function emitC4Activation(
  event: C4ActivationEvent,
  context: C4ActivationContext,
): void {
  console.info(
    `[f60.7-c4-i-activation] ${JSON.stringify({
      type: "f60.7.c4_i.activation",
      campaignId: context.campaignId,
      operationId: context.operationId,
      route: context.route,
      step: event.step,
      source: event.source,
      model: event.model,
    })}`,
  );
}

export interface C4HttpInjection extends RunNineSixteenDeps {
  /** Evidência test-only; sem usage, custo, provider pago ou envelope fictício. */
  readonly activation: readonly C4ActivationEvent[];
  readonly seams: {
    readonly imageGateway: SquareBaseImageGateway;
    readonly copyInvoker: AiInvoker;
    readonly expansionInvoker: ReturnType<
      typeof createDeterministicExpansionInvoker
    >;
  };
}

const activationEvent = (step: C4ActivationStep): C4ActivationEvent =>
  Object.freeze({ step, source: "deterministic", model: DETERMINISTIC_MODEL });

const COPY_JSON = JSON.stringify({
  title: "Oferta C4",
  caption: "Legenda determinística da jornada C4.",
  hashtags: ["#c4", "#teste"],
  cta_post: "Aproveite",
});

const imageCache = new Map<"square" | "vertical", Promise<string>>();

async function deterministicImageBase64(
  kind: "square" | "vertical",
): Promise<string> {
  const cached = imageCache.get(kind);
  if (cached) return cached;
  const dimensions =
    kind === "square"
      ? { width: 1024, height: 1024 }
      : { width: 1152, height: 2048 };
  const created = sharp({
    create: {
      width: dimensions.width,
      height: dimensions.height,
      channels: 3,
      background: kind === "square" ? { r: 40, g: 120, b: 80 } : { r: 120, g: 40, b: 80 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
    .then((buffer) => buffer.toString("base64"));
  imageCache.set(kind, created);
  return created;
}

function createDeterministicCopyInvoker(
  record: (step: C4ActivationStep) => void,
): AiInvoker {
  return {
    invoke: async () => {
      record("copy");
      return { content: COPY_JSON, model: DETERMINISTIC_MODEL };
    },
    hasFallback: async () => false,
  };
}

function createDeterministicImageGateway(
  record: (step: C4ActivationStep) => void,
): SquareBaseImageGateway {
  return {
    prepare: async (capability, target) => ({
      capability,
      target,
      provider: "openai",
      model: DETERMINISTIC_MODEL,
      protocol: "images",
      resolved: {
        provider: "openai",
        model: DETERMINISTIC_MODEL,
        protocol: "images",
      },
    }),
    invokePrepared: async () => {
      record("base_image");
      return {
        imageBase64: await deterministicImageBase64("square"),
        mimeType: "image/jpeg",
        model: DETERMINISTIC_MODEL,
      };
    },
  };
}

function createDeterministicExpansionInvoker(
  record: (step: C4ActivationStep) => void,
) {
  return {
    invokePrepared: async () => {
      record("vertical_expansion");
      return {
        imageBase64: await deterministicImageBase64("vertical"),
        mimeType: "image/jpeg",
        model: DETERMINISTIC_MODEL,
      };
    },
  };
}

/** Exportado para teste offline dos bytes determinísticos. */
export function c4DeterministicImageBase64(
  kind: "square" | "vertical",
): Promise<string> {
  return deterministicImageBase64(kind);
}

export function createC4HttpInjection(input: {
  readonly client: SupabaseClient;
  /** Seams DB/Storage de teste (nunca em produção). */
  readonly baseSeams?: Partial<SquareBaseDeps>;
  readonly expandSeams?: Partial<ExpandVerticalDeps>;
  readonly onActivation?: (event: C4ActivationEvent) => void;
}): C4HttpInjection {
  const activation: C4ActivationEvent[] = [];
  const record = (step: C4ActivationStep) => {
    const event = activationEvent(step);
    activation.push(event);
    input.onActivation?.(event);
  };
  const copyInvoker = createDeterministicCopyInvoker(record);
  const imageGateway = createDeterministicImageGateway(record);
  const expansionInvoker = createDeterministicExpansionInvoker(record);
  const baseDeps = createNineSixteenDeps({
    client: input.client,
    copyInvoker,
  });
  return {
    ...baseDeps,
    base: (baseInput, deps) =>
      runSquareBase(baseInput, {
        ...(input.baseSeams ?? {}),
        ...(deps ?? {}),
        client: input.client,
        imageGateway,
        copyInvoker,
      }),
    expand: (expandInput, deps) =>
      expandVerticalToNineSixteen(expandInput, {
        ...(input.expandSeams ?? {}),
        ...deps,
        client: input.client,
        invoker: expansionInvoker,
      }),
    activation,
    seams: { imageGateway, copyInvoker, expansionInvoker },
  };
}
