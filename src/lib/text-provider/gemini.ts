import type { TextProvider, TextProviderOptions, TextProviderResult } from "./types";
import { AuthConfigError, MalformedResponseError } from "@/lib/copy/errors";

export class GeminiTextProvider implements TextProvider {
  readonly name = "gemini";
  private readonly model: string;

  constructor(
    private readonly apiKey?: string,
    model?: string
  ) {
    this.model = model ?? process.env.GEMINI_TEXT_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
  }

  async generateText(prompt: string, options?: TextProviderOptions): Promise<TextProviderResult> {
    const key = this.apiKey ?? process.env.GEMINI_API_KEY;
    if (!key) {
      throw new AuthConfigError("GEMINI_API_KEY não configurada");
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(key);

    const model = genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: options?.system,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      },
    });

    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new MalformedResponseError("Gemini retornou resposta vazia");
    }

    const usage = response.usageMetadata;

    return {
      content: text,
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
      },
      model: this.model,
    };
  }
}
