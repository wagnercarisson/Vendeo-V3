import type { TextProvider, TextProviderOptions, TextProviderResult } from "./types";

const DEFAULT_MODEL = "gpt-4o";

function resolveModel(): string {
  return process.env.OPENAI_TEXT_MODEL || DEFAULT_MODEL;
}

export class OpenAITextProvider implements TextProvider {
  readonly name = "openai";
  private readonly model: string;

  constructor(model?: string) {
    this.model = model ?? resolveModel();
  }

  async generateText(prompt: string, options?: TextProviderOptions): Promise<TextProviderResult> {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const messages: { role: "system" | "user"; content: string }[] = [];

    if (options?.system) {
      messages.push({ role: "system", content: options.system });
    }

    messages.push({ role: "user", content: prompt });

    const response = await openai.chat.completions.create(
      {
        model: this.model,
        messages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      },
      { signal: options?.signal }
    );

    const content = response.choices?.[0]?.message?.content ?? "";
    const usage = response.usage;

    return {
      content,
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
      },
      model: this.model,
    };
  }
}
