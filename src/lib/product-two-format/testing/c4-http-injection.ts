import "server-only";

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiInvoker } from "@/lib/ai/gateway";
import type { SquareBaseImageGateway } from "@/lib/campaign/square-base/transport";
import { runSquareBase } from "@/lib/campaign/square-base/run-square-base";
import { expandVerticalToNineSixteen } from "@/lib/campaign/vertical-expansion/expand";
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

const deterministicCopyInvoker: AiInvoker = {
  invoke: async () => ({ content: COPY_JSON, model: DETERMINISTIC_MODEL }),
  hasFallback: async () => false,
};

const deterministicImageGateway: SquareBaseImageGateway = {
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
  invokePrepared: async () => ({
    imageBase64: await deterministicImageBase64("square"),
    mimeType: "image/jpeg",
    model: DETERMINISTIC_MODEL,
  }),
};

const deterministicExpansionInvoker = {
  invokePrepared: async () => ({
    imageBase64: await deterministicImageBase64("vertical"),
    mimeType: "image/jpeg",
    model: DETERMINISTIC_MODEL,
  }),
};

/** Exportado para teste offline dos bytes determinísticos. */
export function c4DeterministicImageBase64(
  kind: "square" | "vertical",
): Promise<string> {
  return deterministicImageBase64(kind);
}

export function createC4HttpInjection(input: {
  readonly client: SupabaseClient;
}): RunNineSixteenDeps {
  const baseDeps = createNineSixteenDeps({
    client: input.client,
    copyInvoker: deterministicCopyInvoker,
  });
  return {
    ...baseDeps,
    base: (baseInput, deps) =>
      runSquareBase(baseInput, {
        ...(deps ?? {}),
        client: input.client,
        imageGateway: deterministicImageGateway,
        copyInvoker: deterministicCopyInvoker,
      }),
    expand: (expandInput, deps) =>
      expandVerticalToNineSixteen(expandInput, {
        ...deps,
        client: input.client,
        invoker: deterministicExpansionInvoker,
      }),
  };
}
