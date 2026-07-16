# Phase 23: Text Provider + Copy Director — Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-23-text-provider-copy-director/`

<domain>
## Phase Boundary

Criar a fundação de IA para texto no Vendeo: `TextProvider` (abstração genérica de IA para texto, paralela ao `ImageProvider` existente) e `CopyDirectorService` (geração de copy persuasivo profissional). Sem UI, sem rotas HTTP, sem migrações de banco — fundação pura.

O copy das campanhas hoje é determinístico e primitivo — concatena nome + descrição + CTA sem inteligência de persuasão, tom de voz ou segmento. A F23 resolve isso com uma camada de IA para texto, paralela ao ImageProvider existente.

**Estado atual (pós-F22):**
- `ImageProvider` existe em `src/lib/image-generation/providers/` com `createImageProvider()`
- `PromptLoader` existe em `src/lib/image-generation/prompt-loader.ts`
- `buildPublicationCopySnapshot()` é determinístico em `src/lib/campaign/`
- `CampaignBrief` definido em `src/components/campaign/types.ts`
- OpenAI já configurado como provider de imagem
- `PublicationCopySnapshot` atual: `{ caption, hashtags, cta_post }` sem `title`

</domain>

<decisions>
## Implementation Decisions

### D1 — TextProvider standalone em `src/lib/text-provider/`

Abstração genérica de IA para texto, paralela ao `ImageProvider`. Vive em diretório próprio com types, openai, mock, factory.

```
src/lib/text-provider/
├── types.ts           # TextProvider interface, options, result
├── openai.ts          # OpenAITextProvider (GPT-4o)
├── mock.ts            # MockTextProvider (testes/dev)
├── factory.ts         # createTextProvider()
└── __tests__/
    └── text-provider.test.ts
```

Provider Anthropic removido do escopo. Gemini é extensão planejada futura. A interface já suporta troca.

### D2 — Interface: `generateText(prompt: string, options?)`

```typescript
interface TextProvider {
  readonly name: string;
  generateText(prompt: string, options?: TextProviderOptions): Promise<TextProviderResult>;
}

interface TextProviderOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

interface TextProviderResult {
  content: string;
  usage: { promptTokens: number; completionTokens: number; };
  model: string;
}
```

`prompt` como string simples é o padrão das Chat Completion APIs.

### D3 — CopyDirectorInput específico (não CampaignBrief)

Copy Director recebe apenas os campos que precisa para reduzir tokens, acoplamento e ruído semântico.

Input: `productName`, `description?`, `offer`, `storeName`, `segment`, `toneOfVoice?`, `positioning?`, `shortDescription?`, `slogan?`, `brandPersonality?`, `campaignGuidelines?`

**Não recebe:** `mandatoryArtworkText`, `identity.imageUrl`, `identity.directive`, `brandProfile.brand_colors_chosen`

### D4 — Output: CopyDirectorResult exige `title`; PublicationCopySnapshot aceita `title?`

Copy Director **sempre** produz `title`. `PublicationCopySnapshot` evolui com `title?` opcional — campanhas existentes (v1.3/v1.4) não têm o campo, e a UI trata sua ausência sem quebras.

### D5 — MockTextProvider: apenas testes/dev, nunca fallback em produção

Mock é instanciado apenas em teste ou dev explícito (`TEXT_PROVIDER=mock`). Em produção, se a API falhar, o pipeline falha com estorno — não gera copy mock.

### D6 — CopyDirectorService como classe (padrão ImageGenerationService)

```typescript
class CopyDirectorService {
  constructor(private provider: TextProvider, private promptLoader?: PromptLoader) {}

  async generateCopy(input: CopyDirectorInput): Promise<CopyDirectorResult> {
    const prompt = this.promptLoader.load("campaign-copy-director", { ... variables });
    const result = await this.provider.generateText(prompt, {
      system: "Você é um copywriter especialista em marketing para lojas físicas.",
      temperature: 0.7,
      maxTokens: 1000,
    });
    return this.parseResult(result.content);
  }

  private parseResult(raw: string): CopyDirectorResult {
    // 1. JSON.parse() → validação Zod
    // 2. Regex fallback → extrai campos do texto bruto
    // 3. Fallback determinístico → raw como caption
  }
}
```

### D7 — Fronteira Copy × Arte

Copy Director não recebe `mandatoryArtworkText`. A melhor instrução é a ausência do campo — elimina ambiguidade, reduz tokens, evita que a IA repita texto legal na legenda.

### D8 — Prompt template: saída JSON estruturada

Prompt instrui IA a retornar JSON. Variáveis do template: `{{productName}}`, `{{description}}`, `{{offer}}`, `{{storeName}}`, `{{segment}}`, `{{toneOfVoice}}`, `{{positioning}}`, `{{slogan}}`, `{{brandPersonality}}`, `{{campaignGuidelines}}`.

### D9 — PromptLoader reutilizado

`PromptLoader` de `src/lib/image-generation/prompt-loader.ts` é reutilizado. Carrega `prompts/campaign-copy-director.md`, faz cache em memória, interpola `{{variavel}}`.

### D10 — Provider primário: OpenAI (GPT-4o), config por env var

| Provider | Status | Ativação |
|----------|--------|----------|
| OpenAI (GPT-4o) | Implementar | `TEXT_PROVIDER=openai` (default) |
| Mock | Implementar | `TEXT_PROVIDER=mock` (dev/test) |
| Gemini | Extensão planejada | Futuro |

Variáveis de ambiente: `TEXT_PROVIDER` (openai|mock, default openai), `OPENAI_TEXT_MODEL` (default `gpt-4o`)

### the agent's Discretion
- Estrutura exata dos testes (quantidade, cenários) desde que 15+ testes com MockProvider
- Uso de `vi.mock` vs integração real com OpenAI nos testes — testes unitários com Mock e sem chamadas HTTP
- Tratamento de erro específico na factory (provider inválido)
- Ordem exata das tarefas dentro de cada plano

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### TextProvider Pattern (ImageProvider analógico)
- `src/lib/image-generation/providers/types.ts` — ImageProvider interface pattern
- `src/lib/image-generation/providers/openai.ts` — OpenAIImageProvider implementation pattern (257 lines)
- `src/lib/image-generation/providers/factory.ts` — createImageProvider() factory pattern (33 lines)
- `src/lib/image-generation/providers/__tests__/openai-provider.test.ts` — Test pattern for providers (62 lines)

### PromptLoader (reutilizado)
- `src/lib/image-generation/prompt-loader.ts` — PromptLoader class with in-memory cache (55 lines)

### Campaign Types (modificado)
- `src/lib/campaign/types.ts` — PublicationCopySnapshot atual, CampaignRecord (89 lines)
- `src/lib/campaign/publication-copy.ts` — validatePublicationCopy contract (171 lines)

### Env Config Pattern
- `src/lib/image-generation/config.ts` — IMAGE_PROVIDER env var pattern (41 lines)

### OpenSpec Source of Truth
- `openspec/changes/fase-23-text-provider-copy-director/proposal.md` — Why, What, Capabilities, Impact
- `openspec/changes/fase-23-text-provider-copy-director/design.md` — 10 design decisions (D1-D10), goals/non-goals, risks
- `openspec/changes/fase-23-text-provider-copy-director/tasks.md` — 7 task groups, 50 steps
- `openspec/changes/fase-23-text-provider-copy-director/specs/text-provider/spec.md` — TextProvider requirements + scenarios
- `openspec/changes/fase-23-text-provider-copy-director/specs/copy-director/spec.md` — CopyDirector requirements + scenarios
- `openspec/changes/fase-23-text-provider-copy-director/specs/campaign-types/spec.md` — Campaign types evolution

### Project Requirements
- `.planning/REQUIREMENTS.md` — COPY-01, COPY-02, COPY-03, COPY-04 mapped to Phase 23

</canonical_refs>

<specifics>
## Specific Ideas

- TextProvider deve seguir exatamente o padrão ImageProvider: interface em `types.ts`, implementação em `openai.ts` e `mock.ts`, factory em `factory.ts`
- PromptLoader é reutilizado, não duplicado — import de `src/lib/image-generation/prompt-loader.ts`
- `PublicationCopySnapshot` ganha `title?` sem breaking change (JSONB, compatível retroativo)
- CopyDirectorService usa injeção de dependência: recebe `TextProvider` no constructor
- Parse de saída em 3 camadas: JSON → regex → fallback determinístico
- Copy Director é chamável standalone: `new CopyDirectorService(provider).generateCopy(input)`
- Nenhuma UI nova, nenhuma rota HTTP, nenhuma migração de banco
- `TEXT_PROVIDER` env var com valores openai/mock, default openai
- `OPENAI_TEXT_MODEL` env var para configurar modelo (default gpt-4o)

</specifics>

<deferred>
## Deferred Ideas

- Integração no pipeline `POST /api/campaign/generate-image` (F25)
- Rota HTTP própria para Copy Director (F25)
- Substituir `buildPublicationCopySnapshot()` determinístico (F25)
- Rate limit / controle de custos de IA (F25)
- `mandatoryArtworkText` na UI, schema e Image Director (F25)
- Implementação de provider Anthropic ou Gemini (fora de escopo)
- UI de créditos, pagamento, observabilidade (F26+)

</deferred>

---

*Phase: 23-text-provider-copy-director*
*Context gathered: 2026-07-16 via OpenSpec source of truth*
