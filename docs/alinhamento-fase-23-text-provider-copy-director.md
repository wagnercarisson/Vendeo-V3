# Alinhamento Fase 23 — TextProvider + Copy Director (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F23 — TextProvider + Copy Director (fundação IA de texto)          ← esta fase
  ├── F24 — Credit Tables + CreditService (fundação financeira)
  ├── F25 — Integração no Pipeline (Copy Director + créditos + rate limit)
  ├── F26 — Pagamento (Stripe Checkout + Webhook)
  ├── F27 — Conta + Saldo Visível (UI de créditos)
  ├── F28 — Observabilidade + Deploy + Operação
  └── F29 — Refinamento Visual + Experiência Publicável + Launch Readiness
```

A milestone v1.4 (Experiência SaaS, F18–F22) foi concluída com 713+ testes. O Vendeo tem app shell profissional, dashboard, onboarding, busca, mobile hardening — produto com acabamento SaaS.

**Problema:** O copy da campanha ainda é determinístico e primitivo — concatena nome + descrição + CTA sem inteligência de persuasão, tom de voz ou segmento. Não há camada de IA para texto. O ImageProvider existe (gera imagens), mas não há equivalente para geração de texto persuasivo.

**Dependências:** Provider de IA existente (OpenAI já configurado). `PromptLoader` existente em `src/lib/image-generation/prompt-loader.ts`. `CampaignBrief` já definido em `src/components/campaign/types.ts`. **Nenhuma migração de banco necessária.**

---

## Propósito

1. Criar `TextProvider` — abstração de IA para texto, paralela ao `ImageProvider`
2. Implementar provider OpenAI (GPT-4o) + MockProvider para testes
3. Criar `CopyDirectorService` — serviço que gera copy persuasivo com IA
4. Criar prompt template `campaign-copy-director.md`
5. Definir contratos: `CopyDirectorInput`, `CopyDirectorResult`
6. Estabelecer fronteira clara entre **copy** (texto persuasivo) e **texto obrigatório na arte** (legal/regulatório)
7. Testes unitários com MockProvider (15+)

**Entrega verificável:**
- `TextProvider` funcional com OpenAI (GPT-4o), intercambiável via config
- `CopyDirectorService.generateCopy(input)` produz `{ title, caption, hashtags[], cta_post, toneDescription? }`
- Copy Director chamável standalone (programaticamente, sem rota HTTP)
- Prompt template em `prompts/campaign-copy-director.md`
- `PublicationCopySnapshot` evolui para aceitar `title?` (campo opcional)
- Copy Director **não recebe** `mandatoryArtworkText` — fronteira explícita
- 15+ testes (TextProvider factory, Copy Director com mock, parse de saída)
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F22)

```
                                   ANTES (F22)                        DEPOIS (F23)
═══════════════════════════════════════════════════════════════════════════════════════════

TextProvider:
  Abstração IA texto              inexistente                          TextProvider interface
  Provider OpenAI texto            inexistente                          OpenAITextProvider (GPT-4o)
  Provider Mock                    inexistente                          MockTextProvider (testes/dev)
  Factory                          inexistente                          createTextProvider()

Copy Director:
  Geração de copy                 buildPublicationCopySnapshot()        CopyDirectorService
                                   determinístico (concatena)           .generateCopy(input) via IA
  Input                            inline no pipeline                   CopyDirectorInput (Zod)
  Output                           { caption, hashtags[], cta_post }   { title, caption, hashtags[],
                                                                          cta_post, toneDescription? }
  Prompt template                  inexistente                          prompts/campaign-copy-director.md
  Chamável standalone              ✗ (só no pipeline)                   ✓ (programático)

PublicationCopySnapshot:
  Campo title                      inexistente                          title? (opcional)

Fronteiras:
  Texto obrigatório na arte        não existe conceito                  mandato VISUAL (F25)
  Copy Director vê esse texto      N/A                                  EXPLICITAMENTE NÃO

Dependências npm:
  openai                           ✓ instalado                          ✓ mantido
  @anthropic-ai/sdk                ✗ não instalado                      ✗ removido do escopo
```

---

## Decisões de Arquitetura

### D1 — TextProvider standalone em `src/lib/text-provider/`

`DECIDIDO`

O TextProvider é uma abstração genérica de IA para texto, paralela ao `ImageProvider` em `src/lib/image-generation/providers/`. Vive em diretório próprio.

```
src/lib/text-provider/
├── types.ts                     # TextProvider interface, options, result
├── openai.ts                    # OpenAITextProvider (GPT-4o)
├── mock.ts                      # MockTextProvider (testes/dev)
├── factory.ts                   # createTextProvider()
└── __tests__/
    └── text-provider.test.ts    # Factory + providers
```

**Provider Anthropic:** removido do escopo da F23. Gemini (Google) é o candidato a segundo provider, como extensão planejada, não obrigatória. A abstração `TextProvider` já suporta a troca.

**Provider Gemini:** não implementar agora. O contrato da interface está pronto para recebê-lo quando necessário.

---

### D2 — Interface: `generateText(prompt: string, options?)`

`DECIDIDO`

```typescript
export interface TextProvider {
  readonly name: string;
  generateText(
    prompt: string,
    options?: TextProviderOptions
  ): Promise<TextProviderResult>;
}

export interface TextProviderOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TextProviderResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  model: string;
}
```

**Motivo:** `prompt` como string simples é o padrão das Chat Completion APIs (OpenAI, Gemini). Flexível, evolui sem quebrar contrato.

---

### D3 — CopyDirectorInput específico (não CampaignBrief inteiro)

`DECIDIDO`

O Copy Director recebe **apenas** os campos que precisa. Isso reduz tokens, acoplamento e ruído semântico.

```typescript
export interface CopyDirectorInput {
  productName: string;
  description?: string;
  offer: string;            // Montado pelo chamador a partir de badge, preço e oferta atual
  storeName: string;
  segment: string;
  toneOfVoice?: string;
  positioning?: string;
  shortDescription?: string;
  slogan?: string;
  brandPersonality?: string;
  campaignGuidelines?: string;
}
```

> **Nota sobre `offer`:** O formulário atual não possui um campo literal "oferta". O chamador (F25) monta este campo a partir do badge (ex.: "50% OFF"), preço original e preço com desconto — formando algo como "50% OFF — de R$ 99,90 por R$ 49,90". A F23 apenas define o contrato; a montagem vem na integração.

**O que o Copy Director NÃO recebe:**
- `mandatoryArtworkText` — texto obrigatório na arte é contrato **visual**, não de copy
- `identity.imageUrl`, `identity.directive` — dados visuais irrelevantes
- `brandProfile.brand_colors_chosen` — cores não informam copy

A transformação `CampaignBrief` → `CopyDirectorInput` é feita pelo código chamador (em F25, o pipeline; agora, testes).

---

### D4 — Output: `CopyDirectorResult` exige `title`; `PublicationCopySnapshot` aceita `title?`

`DECIDIDO`

O Copy Director **sempre** produz `title`. A opcionalidade está no `PublicationCopySnapshot` — campanhas existentes (v1.3/v1.4) não têm `title`, e a UI trata sua ausência sem quebras.

```typescript
export interface CopyDirectorResult {
  title: string;
  caption: string;
  hashtags: string[];
  cta_post: string;
  toneDescription?: string;
}
```

**Evolução do `PublicationCopySnapshot`:**

O campo `title` é novo e opcional. O snapshot evolui para:

```typescript
publication_copy_snapshot: {
  title?: string;
  caption: string;
  hashtags: string[];
  cta_post: string;
}
```

**Isso NÃO requer migração de banco.** `publication_copy_snapshot` é JSONB — adicionar `title` no JSON é compatível retroativo. Campanhas existentes (v1.3/v1.4) têm snapshot sem `title`; a UI trata `title` como opcional.

---

### D5 — MockTextProvider: apenas testes/dev, nunca fallback em produção

`DECIDIDO`

MockTextProvider é instanciado apenas em teste ou dev explícito (`TEXT_PROVIDER=mock`). Em produção, se a API falhar, o pipeline falha com estorno — não gera copy mock. Isso evita que o lojista publique "mock caption para testes".

---

### D6 — CopyDirectorService como classe (padrão do projeto)

`DECIDIDO`

Segue o padrão de `ImageGenerationService`:

```typescript
class CopyDirectorService {
  private provider: TextProvider;
  private promptLoader: PromptLoader;

  constructor(provider: TextProvider) {
    this.provider = provider;
    this.promptLoader = new PromptLoader();
  }

  async generateCopy(input: CopyDirectorInput): Promise<CopyDirectorResult> {
    const prompt = this.promptLoader.load("campaign-copy-director", {
      productName: input.productName,
      // ... mapeamento de campos do input para {{variaveis}} do template
    });
    const result = await this.provider.generateText(prompt, {
      system: "Você é um copywriter especialista em marketing para lojas físicas.",
      temperature: 0.7,
      maxTokens: 1000,
    });
    return this.parseResult(result.content);
  }

  private parseResult(raw: string): CopyDirectorResult {
    // 1. JSON.parse() → valida Zod → sucesso
    // 2. Regex fallback → extrai campos do texto bruto
    // 3. Fallback determinístico → raw como caption
  }
}
```

---

### D7 — Fronteira Copy × Arte: mandatoryArtworkText é contrato visual

`DECIDIDO` (registro conceitual para implementação em F25)

```
Copy Director (F23)                     Image Director (F25)
─────────────────────                   ─────────────────────
Vê:                                     Vê:
  productName                             productName
  description (opcional)                  description (opcional)
  offer                                   offer
  storeName                               storeName
  segment                                 segment
  toneOfVoice                             brandProfile (cores, estilo)
  positioning                             identity (logo, assinatura)
  slogan                                  mandatoryArtworkText
  brandPersonality                        ← SOMENTE AQUI
  campaignGuidelines

NÃO Vê:                                 NÃO Vê:
  mandatoryArtworkText                    N/A (tudo que precisa)
  identity.imageUrl
  brandProfile.cores
```

**Regra:** Copy Director não recebe `mandatoryArtworkText`. A melhor instrução é a ausência do campo — elimina ambiguidade, reduz tokens, evita que a IA repita texto legal na legenda.

**Implementação do campo obrigatório (F25):**
- UI: `mandatoryArtworkText` como campo separado no formulário
- Schema: novo campo no request `POST /api/campaign/generate-image`
- Input snapshot: guarda o texto obrigatório
- Image Director: recebe ordem de inclusão apenas quando preenchido ("Incluir obrigatoriamente na arte, em tipografia mínima legível: [texto]")
- Copy Director: **não recebe o campo** (fronteira mantida)

---

### D8 — Prompt template: saída JSON estruturada

`DECIDIDO`

O prompt do Copy Director instrui a IA a retornar JSON. O `parseResult()` faz:
1. `JSON.parse()` → validação Zod → sucesso
2. Regex fallback → extrai campos do texto bruto
3. Fallback determinístico → texto bruto como `caption`

**Variáveis do template:**

| Variável | Origem | Obrigatório? |
|----------|--------|:---:|
| `{{productName}}` | CopyDirectorInput | ✓ |
| `{{description}}` | CopyDirectorInput | opcional |
| `{{offer}}` | CopyDirectorInput | ✓ |
| `{{storeName}}` | CopyDirectorInput | ✓ |
| `{{segment}}` | CopyDirectorInput | ✓ |
| `{{toneOfVoice}}` | CopyDirectorInput | opcional |
| `{{positioning}}` | CopyDirectorInput | opcional |
| `{{slogan}}` | CopyDirectorInput | opcional |
| `{{brandPersonality}}` | CopyDirectorInput | opcional |
| `{{campaignGuidelines}}` | CopyDirectorInput | opcional |

---

### D9 — PromptLoader reutilizado (sem loader específico)

`DECIDIDO`

`PromptLoader` de `src/lib/image-generation/prompt-loader.ts` é reutilizado. Carrega `prompts/campaign-copy-director.md`, faz cache em memória, interpola `{{variavel}}`.

---

### D10 — Provider primário: OpenAI (GPT-4o), config por env var

`DECIDIDO`

| Provider | Status | Ativação |
|----------|--------|----------|
| OpenAI (GPT-4o) | Implementar na F23 | `TEXT_PROVIDER=openai` (default) |
| Mock | Implementar na F23 | `TEXT_PROVIDER=mock` (dev/test) |
| Gemini | Extensão planejada | Futuro |

Variável de ambiente: `TEXT_PROVIDER` (valores: `openai` | `mock`). Default: `openai`.

Modelo padrão: `gpt-4o` (pode ser sobrescrito via `OPENAI_TEXT_MODEL`).

---

## Plano de Execução

A F23 é uma fase de fundação pura — sem UI, sem rotas HTTP, sem migrações de banco. Um plano único.

### Plano 23-01 — TextProvider + Copy Director

| Item | Arquivos |
|------|----------|
| **TextProvider base** | `src/lib/text-provider/types.ts` — interface + options + result |
| **OpenAI implementation** | `src/lib/text-provider/openai.ts` — OpenAITextProvider |
| **Mock implementation** | `src/lib/text-provider/mock.ts` — MockTextProvider |
| **Factory** | `src/lib/text-provider/factory.ts` — createTextProvider() |
| **Testes TextProvider** | `src/lib/text-provider/__tests__/text-provider.test.ts` — factory + openai + mock |
| **Copy Director schema** | `src/lib/copy/schema.ts` — CopyDirectorInput (Zod) + CopyDirectorResult (Zod) |
| **Copy Director service** | `src/lib/copy/copy-director-service.ts` — CopyDirectorService class |
| **Testes Copy Director** | `src/lib/copy/__tests__/copy-director-service.test.ts` — 10+ cenários |
| **Prompt template** | `prompts/campaign-copy-director.md` |
| **Evolução tipo** | `src/lib/campaign/types.ts` — PublicationCopySnapshot ganha `title?` |
| **Config** | Variável `TEXT_PROVIDER` + `OPENAI_TEXT_MODEL` |

---

## Estrutura de Código

```
src/lib/text-provider/              ← NOVO
├── types.ts                        # TextProvider interface
├── openai.ts                       # OpenAITextProvider
├── mock.ts                         # MockTextProvider
├── factory.ts                      # createTextProvider()
└── __tests__/
    └── text-provider.test.ts       # Testes

src/lib/copy/                       ← NOVO
├── schema.ts                       # CopyDirectorInput + CopyDirectorResult (Zod)
├── copy-director-service.ts        # CopyDirectorService
└── __tests__/
    └── copy-director-service.test.ts # Testes com MockTextProvider

src/lib/campaign/types.ts           ← MODIFICADO
    # PublicationCopySnapshot ganha title? (opcional)

prompts/
└── campaign-copy-director.md       ← NOVO: prompt template
```

---

## Testes

### TextProvider (5+ testes)

| Teste | O que valida |
|-------|-------------|
| `createTextProvider()` default retorna OpenAITextProvider | Factory com env vazio |
| `createTextProvider('openai')` retorna OpenAITextProvider | Factory explícita |
| `createTextProvider('mock')` retorna MockTextProvider | Factory explícita |
| `OpenAITextProvider.generateText()` chama OpenAI com prompt correto | Integração via mock |
| `MockTextProvider.generateText()` retorna dados determinísticos | Comportamento do mock |

### Copy Director (10+ testes)

| Teste | O que valida |
|-------|-------------|
| `generateCopy()` com input completo retorna CopyDirectorResult válido | Parse bem-sucedido |
| `generateCopy()` com input mínimo (só obrigatórios) funciona | Campos opcionais ausentes |
| `generateCopy()` — title não vazio, caption não vazio | Qualidade mínima do output |
| `generateCopy()` — hashtags contém ao menos 3 itens | Cardinalidade do array |
| `generateCopy()` — cta_post presente e não vazio | Campo obrigatório no output |
| `generateCopy()` com toneOfVoice vazio não quebra | Campo opcional |
| `generateCopy()` — saída malformatada cai no fallback | Robustez do parseResult |
| `generateCopy()` — saída JSON inválida usa fallback determinístico | Resiliência |
| `CopyDirectorInput` schema rejeita `productName` vazio | Validação de entrada |
| `CopyDirectorResult` schema rejeita `caption` ausente | Validação de saída |
| Copy Director **não aceita** `mandatoryArtworkText` no schema | Fronteira explícita |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Qualidade do copy depende do prompt** — prompt fraco = copy fraco | Prompt é tratado como código: versionado, iterável. Testar com exemplos reais de cada segmento |
| **Parse da saída JSON da IA falha** — geração quebra | Fallback em 3 camadas: JSON → regex → texto bruto como caption. Nunca quebra sem fallback |
| **`title` opcional não é considerado pela UI existente** | Atualizar `PublicationCopySnapshot` com `title?`. UI legada trata como opcional |
| **Copy Director acoplado ao CampaignBrief** | `CopyDirectorInput` próprio quebra o acoplamento. Transformação explícita no chamador |
| **Custo de tokens sem controle** | F23 ignora controle de custo (F25). Mas o prompt deve ser eficiente — evitar repetição, contexto desnecessário |
| **Usuário sem loja testar copy** | Copy Director é chamável standalone — pode ser testado com input mínimo sem depender de loja |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Integração no pipeline `POST /api/campaign/generate-image` | F25 |
| Rota HTTP própria para Copy Director | F25 (se necessário) |
| Substituir `buildPublicationCopySnapshot()` determinístico | F25 |
| Rate limit / controle de custos de IA | F25 |
| `mandatoryArtworkText` na UI, schema e Image Director | F25 |
| Provider Anthropic | Sem decisão real de uso. Removido |
| Provider Gemini | Extensão planejada, não obrigatória |
| Migração de banco | Nenhuma necessária |
| UI de créditos ou saldo | F27 |
| Stripe / pagamento | F26 |
| Testes de pipeline integrado | F25 |
| Observabilidade (logging, telemetria) | F28 |
| Refinamento visual da experiência | F29 |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — TextProvider standalone em `src/lib/text-provider/`
- [ ] D2 — Interface `generateText(prompt: string, options?)`
- [ ] D3 — CopyDirectorInput específico (não CampaignBrief)
- [ ] D4 — CopyDirectorResult com `title` + `PublicationCopySnapshot` evolui com `title?`
- [ ] D5 — MockTextProvider apenas testes/dev, nunca fallback em produção
- [ ] D6 — CopyDirectorService como classe (padrão ImageGenerationService)
- [ ] D7 — Fronteira Copy × Arte: mandatoryArtworkText é contrato visual (F25)
- [ ] D8 — Prompt com saída JSON estruturada + parseResult em 3 camadas
- [ ] D9 — PromptLoader reutilizado (sem loader específico)
- [ ] D10 — Provider primário OpenAI (GPT-4o), config por `TEXT_PROVIDER` env var

### Plano 23-01 — TextProvider + Copy Director
- [ ] `src/lib/text-provider/types.ts`: TextProvider interface, TextProviderOptions, TextProviderResult
- [ ] `src/lib/text-provider/openai.ts`: OpenAITextProvider (GPT-4o)
- [ ] `src/lib/text-provider/mock.ts`: MockTextProvider
- [ ] `src/lib/text-provider/factory.ts`: createTextProvider() com `TEXT_PROVIDER` env
- [ ] `src/lib/text-provider/__tests__/text-provider.test.ts`: 5+ testes
- [ ] `src/lib/copy/schema.ts`: CopyDirectorInput (Zod) + CopyDirectorResult (Zod)
- [ ] `src/lib/copy/copy-director-service.ts`: CopyDirectorService class
- [ ] `src/lib/copy/__tests__/copy-director-service.test.ts`: 10+ testes
- [ ] `prompts/campaign-copy-director.md`: prompt template com variáveis e formato JSON
- [ ] `src/lib/campaign/types.ts`: PublicationCopySnapshot ganha `title?` (opcional)

### Verificação final
- [ ] `createTextProvider()` sem env = OpenAITextProvider
- [ ] `createTextProvider('mock')` = MockTextProvider
- [ ] `CopyDirectorService.generateCopy()` com input completo → output válido
- [ ] `CopyDirectorService.generateCopy()` com input mínimo → funciona
- [ ] Parse de saída JSON válida → CopyDirectorResult correto
- [ ] Parse de saída inválida → fallback não quebra
- [ ] Copy Director **não aceita** mandatoryArtworkText (schema não tem o campo)
- [ ] `PublicationCopySnapshot` interface aceita `title?` sem breaking change
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando (15+ novos + 713 existentes)
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-16*
*Baseado no alinhamento da milestone v1.5, exploração do estado atual do código (pós-F22), discussão entre dois agentes com decisões registradas.*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Fase 23.*
