## Context

O copy da campanha é determinístico — concatena nome + descrição + CTA sem inteligência. A F23 cria a fundação de IA para texto: `TextProvider` (abstração genérica) e `CopyDirectorService` (geração de copy persuasivo). Não há UI, rotas HTTP ou migrações de banco — é fundação pura.

**Estado atual (pós-F22):**
- `ImageProvider` existe em `src/lib/image-generation/providers/` com `createImageProvider()`
- `PromptLoader` existe em `src/lib/image-generation/prompt-loader.ts`
- `buildPublicationCopySnapshot()` é determinístico em `src/lib/campaign/`
- `CampaignBrief` definido em `src/components/campaign/types.ts`
- OpenAI já configurado como provider de imagem

## Goals / Non-Goals

**Goals:**
- `TextProvider` interface + OpenAI (GPT-4o) + Mock + Factory em `src/lib/text-provider/`
- `CopyDirectorService` com `generateCopy(input): CopyDirectorResult`
- Prompt template em `prompts/campaign-copy-director.md`
- Schemas `CopyDirectorInput` + `CopyDirectorResult` (Zod)
- `PublicationCopySnapshot` ganha `title?` (opcional, sem breaking change)
- 15+ testes (TextProvider factory, Copy Director com mock, parse de saída)
- Copy Director chamável standalone (programaticamente)

**Non-Goals:**
- Integração no pipeline `POST /api/campaign/generate-image` (F25)
- Rota HTTP própria para Copy Director (F25)
- Substituir `buildPublicationCopySnapshot()` determinístico (F25)
- Rate limit / controle de custos de IA (F25)
- `mandatoryArtworkText` na UI, schema e Image Director (F25)
- Implementação de provider Anthropic ou Gemini (fora de escopo)
- UI de créditos, pagamento, observabilidade (F26+)

## Decisions

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

`prompt` como string simples é o padrão das Chat Completion APIs (OpenAI, Gemini). Flexível, evolui sem quebrar contrato.

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
  constructor(private provider: TextProvider) {
    this.promptLoader = new PromptLoader();
  }

  async generateCopy(input: CopyDirectorInput): Promise<CopyDirectorResult> {
    const prompt = this.promptLoader.load("campaign-copy-director", { ... });
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

Variável de ambiente: `TEXT_PROVIDER` (valores: `openai` | `mock`). Default: `openai`.
Modelo padrão: `gpt-4o` (sobrescrito via `OPENAI_TEXT_MODEL`).

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Qualidade do copy depende do prompt — prompt fraco = copy fraco | Prompt versionado e iterável. Testar com exemplos reais de cada segmento |
| Parse da saída JSON da IA falha — geração quebra | Fallback em 3 camadas: JSON → regex → texto bruto como caption |
| `title` opcional não é considerado pela UI existente | `PublicationCopySnapshot` com `title?`. UI legada trata como opcional sem quebra |
| Copy Director acoplado ao `CampaignBrief` | `CopyDirectorInput` próprio quebra o acoplamento. Transformação explícita no chamador |
| Custo de tokens sem controle | F23 ignora controle de custo (F25). Prompt deve ser eficiente |
| Usuário sem loja testar copy | Copy Director é chamável standalone — testa com input mínimo sem depender de loja |
