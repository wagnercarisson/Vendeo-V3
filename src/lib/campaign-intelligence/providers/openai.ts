import type { AIProvider, ProviderRawResponse } from "./types";
import type { CampaignGenerationInput } from "../schema";
import { CampaignSpecSchema } from "../schema";

/**
 * OpenAIProvider — real AI provider that calls OpenAI Chat Completions API
 * using Structured Outputs (json_schema response_format) derived from
 * CampaignSpecSchema via zodResponseFormat.
 *
 * All user-facing strings in the prompt are in Brazilian Portuguese (PT-BR).
 * The provider name is "openai".
 *
 * Requires OPENAI_API_KEY in environment. Falls back to json_object mode
 * only when the model explicitly does not support json_schema (e.g., some
 * older fine-tuned models). Other errors (auth, rate limit, network, quota,
 * validation) are surfaced as exceptions for the service layer to handle.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private readonly model: string;

  /**
   * @param model - OpenAI model identifier. Defaults to OPENAI_MODEL env var
   *                or "gpt-4o-mini".
   */
  constructor(model?: string) {
    this.model = model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  async generate(
    input: CampaignGenerationInput
  ): Promise<ProviderRawResponse> {
    // ── Step 1: Dynamic imports (never static — avoids ESM/CJS mismatch
    //            and keeps this module tree-shakeable) ────────────────
    const { default: OpenAI } = await import("openai");
    const { zodResponseFormat } = await import("openai/helpers/zod");

    // ── Step 2: Build the prompt ────────────────────────────────────

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
**Preço original:** R$ ${(input.originalPriceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
**Preço com desconto:** R$ ${(input.discountedPriceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
**Badge:** ${input.badge || "Automático (baseado no desconto)"}
**Cor da marca:** ${input.brandColor}

Gere a campanha seguindo exatamente o esquema especificado.`;

    // ── Step 3: Create OpenAI client ────────────────────────────────

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ── Step 4: Prepare structured output format ────────────────────

    const format = zodResponseFormat(CampaignSpecSchema, "campaign_spec");

    // ── Step 5: Call the API ────────────────────────────────────────

    let response;
    try {
      response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: format,
      });
    } catch (err) {
      // ── Step 5a: Fall back to json_object for model capability
      //            errors (e.g., fine-tuned models that don't support
      //            json_schema) but not for auth/rate-limit/etc. ────
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      const isSchemaModelError =
        errorMessage.includes("response_format") &&
        (errorMessage.includes("json_schema") ||
          errorMessage.includes("not supported") ||
          errorMessage.includes("does not support"));

      if (isSchemaModelError) {
        response = await openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: "system",
              content: `${systemPrompt}\n\nVocê DEVE responder APENAS com um objeto JSON válido. Nenhum texto antes ou depois do JSON.`,
            },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        });
      } else {
        // Auth, rate limit, network, quota, validation errors → surface
        throw err;
      }
    }

    // ── Step 6: Extract content ─────────────────────────────────────

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned empty response content");
    }

    // ── Step 7: Parse, overwrite metadata, re-stringify ─────────────
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
        model: this.model,
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
