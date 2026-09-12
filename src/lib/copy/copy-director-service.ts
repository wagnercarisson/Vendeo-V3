import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import {
  CopyDirectorInputSchema,
  CopyDirectorResultSchema,
} from "@/lib/copy/schema";
import type { CopyDirectorInput, CopyDirectorResult } from "@/lib/copy/schema";
import { MalformedResponseError } from "@/lib/copy/errors";
import type { AiCallInfo } from "@/lib/ai-cost/types";
import { defaultAiGateway, withOnCallTelemetry } from "@/lib/ai";
import type {
  AiInvocationRequest,
  AiInvocationTarget,
  AiInvoker,
  AiTelemetryContext,
} from "@/lib/ai";

const SYSTEM_PROMPT = "Você é um copywriter especialista em marketing para lojas físicas.";

/** Options aditivas do `generateCopy` (F46-03, D11). */
export interface GenerateCopyOptions {
  signal?: AbortSignal;
  /** Seleção explícita do alvo (o serviço é o dono único do `invoke`). */
  target?: AiInvocationTarget;
  /** Contexto de telemetria do caller (run/sink) — obrigatório para invocar. */
  telemetry?: AiTelemetryContext;
}

function parseViaJson(raw: string): CopyDirectorResult | null {
  try {
    const parsed = JSON.parse(raw);
    const result = CopyDirectorResultSchema.parse(parsed);
    return result;
  } catch {
    return null;
  }
}

function parseViaRegex(raw: string): CopyDirectorResult | null {
  const titleMatch = raw.match(/['"](?:title|título)['"]\s*[:：]\s*["']([^"']+)["']/i);
  const captionMatch = raw.match(/['"](?:caption|legenda)['"]\s*[:：]\s*["']([^"']+)["']/i);
  const ctaMatch = raw.match(/['"]cta_post['"]\s*[:：]\s*["']([^"']+)["']/i);
  const hashtagsMatch = raw.match(/['"]hashtags['"]\s*[:：]\s*\[([^\]]*)\]/i);

  const title = titleMatch?.[1] ?? "";
  const caption = captionMatch?.[1] ?? "";
  const cta_post = ctaMatch?.[1] ?? "";

  let hashtags: string[] = [];
  if (hashtagsMatch?.[1]) {
    hashtags = hashtagsMatch[1]
      .split(",")
      .map((t) => t.trim().replace(/["']/g, ""))
      .filter(Boolean);
  }

  if (!caption) return null;

  try {
    return CopyDirectorResultSchema.parse({ title: title || "Promoção Especial", caption, hashtags, cta_post: cta_post || "Saiba mais!" });
  } catch {
    return null;
  }
}

export class CopyDirectorService {
  private readonly invoker: AiInvoker;
  private readonly promptLoader: PromptLoader;

  /**
   * `invoker` é o gateway (seam de teste). Default = instância padrão de
   * `@/lib/ai`. Testes injetam um fake.
   */
  constructor(invoker: AiInvoker = defaultAiGateway, promptLoader?: PromptLoader) {
    this.invoker = invoker;
    this.promptLoader = promptLoader ?? new PromptLoader();
  }

  /** Indica se `campaign_copy` tem fallback configurado (≠ primary). */
  async hasFallback(): Promise<boolean> {
    return this.invoker.hasFallback("campaign_copy");
  }

  async generateCopy(
    input: CopyDirectorInput,
    options?: GenerateCopyOptions,
    onCall?: (info: AiCallInfo) => void | Promise<void>
  ): Promise<CopyDirectorResult> {
    const validated = CopyDirectorInputSchema.parse(input);

    const campaignIntent = validated.campaignIntent ?? "offer";

    const variables: Record<string, string> = {
      productName: validated.productName,
      description: validated.description ?? "",
      commercialFrame: validated.commercialFrame,
      campaignIntent,
      storeName: validated.storeName,
      segment: validated.segment,
      toneOfVoice: validated.toneOfVoice ?? "",
      positioning: validated.positioning ?? "",
      shortDescription: validated.shortDescription ?? "",
      slogan: validated.slogan ?? "",
      brandPersonality: validated.brandPersonality ?? "",
      campaignGuidelines: validated.campaignGuidelines ?? "",
    };

    const promptName = `campaign-copy-director-${campaignIntent}`;
    const prompt = this.promptLoader.load(promptName, variables);

    const request: AiInvocationRequest = {
      prompt,
      system: SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 1000,
    };

    if (options?.signal) {
      request.signal = options.signal;
    }

    const telemetry = options?.telemetry;
    if (!telemetry) {
      throw new Error(
        '[CopyDirectorService] AiTelemetryContext é obrigatório para invoke("campaign_copy")'
      );
    }

    // Dono único de invoke("campaign_copy"): o gateway gera o envelope e o sink
    // persiste (D9). O `onCall` legado apenas recebe o envelope já produzido.
    const result = await this.invoker.invoke(
      "campaign_copy",
      request,
      withOnCallTelemetry(telemetry, onCall),
      options?.target
    );

    return this.parseResult(result.content ?? "");
  }

  private parseResult(raw: string): CopyDirectorResult {
    const fromJson = parseViaJson(raw);
    if (fromJson) return fromJson;

    const fromRegex = parseViaRegex(raw);
    if (fromRegex) return fromRegex;

    throw new MalformedResponseError(
      "Não foi possível extrair campos válidos da resposta do Copy Director"
    );
  }
}
