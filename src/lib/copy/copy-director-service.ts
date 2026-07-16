import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import type { TextProvider } from "@/lib/text-provider/types";
import {
  CopyDirectorInputSchema,
  CopyDirectorResultSchema,
} from "@/lib/copy/schema";
import type { CopyDirectorInput, CopyDirectorResult } from "@/lib/copy/schema";

const SYSTEM_PROMPT = "Você é um copywriter especialista em marketing para lojas físicas.";

const DETERMINISTIC_FALLBACK = (raw: string): CopyDirectorResult => ({
  title: "Promoção Especial",
  caption: raw,
  hashtags: [],
  cta_post: "Saiba mais!",
});

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

  async generateCopy(input: CopyDirectorInput): Promise<CopyDirectorResult> {
    const validated = CopyDirectorInputSchema.parse(input);

    const variables: Record<string, string> = {
      productName: validated.productName,
      description: validated.description ?? "",
      offer: validated.offer,
      storeName: validated.storeName,
      segment: validated.segment,
      toneOfVoice: validated.toneOfVoice ?? "",
      positioning: validated.positioning ?? "",
      shortDescription: validated.shortDescription ?? "",
      slogan: validated.slogan ?? "",
      brandPersonality: validated.brandPersonality ?? "",
      campaignGuidelines: validated.campaignGuidelines ?? "",
    };

    const prompt = this.promptLoader.load("campaign-copy-director", variables);

    const result = await this.provider.generateText(prompt, {
      system: SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 1000,
    });

    return this.parseResult(result.content);
  }

  private parseResult(raw: string): CopyDirectorResult {
    const fromJson = parseViaJson(raw);
    if (fromJson) return fromJson;

    const fromRegex = parseViaRegex(raw);
    if (fromRegex) return fromRegex;

    return DETERMINISTIC_FALLBACK(raw);
  }
}
