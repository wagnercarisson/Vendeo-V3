import type { TextProvider, TextProviderOptions, TextProviderResult } from "./types";

const MOCK_CONTENT = JSON.stringify({
  title: "Mock Título Persuasivo",
  caption: "Descrição do produto. Aproveite esta oferta especial por tempo limitado!",
  hashtags: ["#Promoção", "#Oferta", "#Imperdível", "#Aproveite"],
  cta_post: "Garanta já a sua!",
  toneDescription: "mock",
});

export class MockTextProvider implements TextProvider {
  readonly name = "mock";

  async generateText(_prompt: string, _options?: TextProviderOptions): Promise<TextProviderResult> {
    return {
      content: MOCK_CONTENT,
      usage: { promptTokens: 0, completionTokens: 0 },
      model: "mock-model-v1",
    };
  }
}
