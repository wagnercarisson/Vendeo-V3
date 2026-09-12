import type { AIProvider, ProviderRawResponse } from "./types";
import type { CampaignGenerationInput } from "../schema";
import { CampaignSpecSchema } from "../schema";
import { defaultAiGateway } from "@/lib/ai";
import { AiInvocationError } from "@/lib/ai";
import type { AiInvoker, AiTelemetryContext } from "@/lib/ai";

/**
 * OpenAIProvider — provider legado de `campaign_spec` (F46, D6).
 *
 * Executa via camada única (`invoke("campaign_spec")`, default `gpt-4o-mini`),
 * preservando Structured Outputs (`json_schema` derivado de `CampaignSpecSchema`),
 * a sobreposição de `generation_metadata` e a validação Zod. NÃO instancia
 * `new OpenAI()` nem lê `OPENAI_MODEL`.
 *
 * O fallback `json_schema`→`json_object` deixa de ser retry interno do SDK: vira
 * uma **segunda `invoke` explícita** (attemptNumber 2), acionada **somente** por
 * erro de `capability` relacionado a `response_format`/`json_schema` (D4/D4.1).
 *
 * All user-facing strings in the prompt are in Brazilian Portuguese (PT-BR).
 * Requires OPENAI_API_KEY (via `getApiKey`) in environment.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private readonly invoker: AiInvoker;

  /**
   * @param invoker - Gateway (seam de teste). Default = instância padrão de `@/lib/ai`.
   */
  constructor(invoker: AiInvoker = defaultAiGateway) {
    this.invoker = invoker;
  }

  async generate(
    input: CampaignGenerationInput,
    telemetry?: AiTelemetryContext
  ): Promise<ProviderRawResponse> {
    const systemPrompt = `Você é um assistente especializado em criar campanhas publicitárias para lojas físicas brasileiras.

Sua função é gerar uma especificação completa de campanha para o produto + oferta informados pelo lojista. A campanha será renderizada como uma imagem quadrada (1080×1080px) para redes sociais (Instagram, Facebook, WhatsApp).

REGRAS IMPORTANTES:
- Use português brasileiro natural e comercial, como um lojista falaria com seus clientes
- O título deve ser impactante e incluir o nome do produto e da loja
- O subtítulo deve reforçar o benefício
- A chamada (hook) deve gerar urgência ou desejo
- O CTA deve ser curto, direto e orientado à ação
- Preços devem estar em formato BRL (R$)
- O badge_text deve refletir o tipo de oferta (ex: "Oferta", "30% OFF", "Lançamento")
- A cor de destaque (palette_accent) deve usar a cor da marca fornecida
- O layout deve priorizar a imagem do produto
- Campos sem valor aplicável (ex: original_price_display quando não há preço original) devem retornar null, nunca undefined ou string vazia`;

    const userPrompt = `Gere uma campanha para o seguinte produto:

**Loja:** ${input.storeName}
**Segmento:** ${input.storeSegment}
**Cidade/Estado:** ${[input.city, input.state].filter(Boolean).join("/") || "Não informado"}
**Produto:** ${input.productName}
**Descrição:** ${input.description || "Nenhuma descrição fornecida"}
**Preço original:** ${input.originalPriceCents ? `R$ ${(input.originalPriceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "N/A"}
**Preço com desconto:** ${input.discountedPriceCents ? `R$ ${(input.discountedPriceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "N/A"}
**Badge:** ${input.badge || "Automático (baseado no desconto)"}
**Cor da marca:** ${input.brandColor}

Gere a campanha seguindo exatamente o esquema especificado.`;

    if (!telemetry) {
      throw new Error(
        '[OpenAIProvider] AiTelemetryContext é obrigatório para invoke("campaign_spec")'
      );
    }

    // ── Step 1: invoke com Structured Outputs (json_schema) ─────────
    let result;
    try {
      result = await this.invoker.invoke(
        "campaign_spec",
        {
          prompt: userPrompt,
          system: systemPrompt,
          responseFormat: "json_schema",
          jsonSchema: { name: "campaign_spec", schema: CampaignSpecSchema },
        },
        { ...telemetry, attemptNumber: 1 }
      );
    } catch (err) {
      // ── Step 1a: fallback json_object — SEGUNDA invoke explícita só por
      //             erro de capability de response_format/json_schema ────
      if (!isJsonSchemaCapabilityError(err)) {
        // Auth, rate limit, network, quota, validation errors → surface
        throw err;
      }

      result = await this.invoker.invoke(
        "campaign_spec",
        {
          prompt: userPrompt,
          system: `${systemPrompt}\n\nVocê DEVE responder APENAS com um objeto JSON válido. Nenhum texto antes ou depois do JSON.`,
          responseFormat: "json_object",
        },
        { ...telemetry, attemptNumber: 2 }
      );
    }

    // ── Step 2: Extract content ─────────────────────────────────────
    const content = result.content;
    if (!content) {
      throw new Error("OpenAI returned empty response content");
    }

    // ── Step 3: Parse, overwrite metadata, re-stringify ─────────────
    // Never trust the model for metadata — overwrite with real backend values.
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { raw: content };
    }

    if (parsed && typeof parsed === "object") {
      (parsed as Record<string, unknown>).generation_metadata = {
        provider: "openai",
        model: result.model,
        generated_at: new Date().toISOString(),
      };
    }

    // Defense-in-depth validation even with Structured Outputs.
    const validation = CampaignSpecSchema.safeParse(parsed);
    if (!validation.success) {
      console.error(
        "[OpenAIProvider] Zod validation failed after Structured Outputs:",
        validation.error
      );
    }

    return { raw: JSON.stringify(parsed) };
  }
}

/** Gate do fallback técnico: só capability de `response_format`/`json_schema`. */
function isJsonSchemaCapabilityError(err: unknown): boolean {
  if (!(err instanceof AiInvocationError)) return false;
  if (err.kind !== "capability") return false;
  const message = err.message.toLowerCase();
  return message.includes("response_format") || message.includes("json_schema");
}
