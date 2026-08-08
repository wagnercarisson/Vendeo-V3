import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import type { TextProvider } from "@/lib/text-provider/types";
import type { TextProviderOptions } from "@/lib/text-provider/types";
import {
  CopyDirectorInputSchema,
  CopyDirectorResultSchema,
} from "@/lib/copy/schema";
import type { CopyDirectorInput, CopyDirectorResult } from "@/lib/copy/schema";
import { MalformedResponseError } from "@/lib/copy/errors";
import type { AiCallInfo } from "@/lib/ai-cost/types";

const SYSTEM_PROMPT = "Você é um copywriter especialista em marketing para lojas físicas.";

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
  private readonly provider: TextProvider;
  private readonly promptLoader: PromptLoader;

  constructor(provider: TextProvider, promptLoader?: PromptLoader) {
    this.provider = provider;
    this.promptLoader = promptLoader ?? new PromptLoader();
  }

  async generateCopy(
    input: CopyDirectorInput,
    options?: { signal?: AbortSignal },
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

    const textOpts: TextProviderOptions = {
      system: SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 1000,
    };

    if (options?.signal) {
      textOpts.signal = options.signal;
    }

    const startTime = Date.now();
    const result = await this.provider.generateText(prompt, textOpts);
    const durationMs = Date.now() - startTime;

    // Best-effort telemetry — never blocks generation (D7). Exposes the real
    // usage the TextProvider already reports (furo 1: copy sem custo).
    this.invokeOnCall(onCall, {
      provider: this.provider.name,
      model: result.model,
      usage: result.usage,
      durationMs,
    });

    return this.parseResult(result.content);
  }

  /**
   * Invoke the onCall callback best-effort (D7): a throwing or rejecting
   * callback is logged and ignored — it never breaks copy generation.
   */
  private invokeOnCall(
    onCall: ((info: AiCallInfo) => void | Promise<void>) | undefined,
    info: AiCallInfo
  ): void {
    if (!onCall) return;
    try {
      Promise.resolve(onCall(info)).catch((err) => {
        console.error(
          `[CopyDirectorService] onCall callback failed (best-effort): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });
    } catch (err) {
      console.error(
        `[CopyDirectorService] onCall callback failed (best-effort): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
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
