export interface TextProviderOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TextProviderResult {
  content: string;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export interface TextProvider {
  readonly name: string;
  generateText(prompt: string, options?: TextProviderOptions): Promise<TextProviderResult>;
}
