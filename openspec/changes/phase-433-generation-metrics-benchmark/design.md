## Context

A fase 4.3.2 entregou um pipeline maduro com validação visual, revisão de qualidade, direção criativa contextual e machine state de correção. O diretor de marketing está performando bem. O que falta é base objetiva para comparar evolução: sem métricas por execução, não há como avaliar tempo, custo, estabilidade entre modelos/providers.

Estado atual:
- Provider de imagem hardcoded (`OpenAIImageProvider` na route handler)
- Modelos configuráveis via `config.ts` com fallbacks padrão (`gpt-5.5`, `gpt-image-2`, `gpt-4o`)
- Nenhum registro de execução (apenas `console.log`/`console.error` esparsos, gateados por `IMAGE_GENERATION_DEBUG`)
- Eventos de progresso com `detail` técnico exposto na UI colapsável
- Sem forma de comparar execuções entre diferentes configurações

## Goals / Non-Goals

**Goals:**
- Registrar automaticamente métricas de cada geração em JSONL (local/dev/benchmark apenas)
- Permitir troca de provider e modelo de imagem via `.env.local`
- Criar bateria fixa de cenários para benchmark entre modelos
- Separar claramente: (1) eventos técnicos para logs/metrics vs (2) mensagens humanas para UI
- Refinar orientação do campo "detalhes adicionais" como repertório comercial (não obrigatório na arte)
- Ajustar regras de validação/revisão para preservar divergências aceitáveis
- Preparar para testar Gemini com mesmos cenários e formato de métricas

**Non-Goals:**
- Criar tabelas no banco de dados para métricas
- Implementar fallback automático entre providers
- Dashboard de métricas ou analytics
- Export/download final
- Legendas, hashtags, textos complementares
- Editor avançado de arte ou variações
- Sistema de créditos/planos
- Termos legais (apenas premissa registrada)

## Decisions

### D1 — Métricas: JSONL local, sem dependências externas

**Decisão:** Cada execução do pipeline produz um objeto de métricas estruturado que é appended a um arquivo `.jsonl` no diretório `metrics/` na raiz do projeto. O código do writer fica em `src/lib/image-generation/metrics/`. Adicionar `/metrics/*.jsonl` ao `.gitignore`. Em produção (Vercel), o filesystem não é persistente — métricas podem ser desabilitadas por env var ou direcionadas para `console.log` estruturado (stdout).

**Alternativa considerada:** Supabase table para métricas. Rejeitada porque (a) métricas não precisam ser queryáveis agora, (b) adiciona coupling com banco, (c) fase explícita "sem banco". JSONL permite parse simples com ferramentas padrão.

**Best-effort:** Falha ao gravar métricas **nunca** deve quebrar a geração da campanha. Se não conseguir criar pasta, escrever JSONL, ou em ambiente sem filesystem, o pipeline loga o erro técnico e continua. Métrica é importante, mas não pode derrubar geração.

**Sanitização explícita — o que NÃO registrar:**
- Imagem/base64 da imagem gerada ou do produto
- Prompt completo enviado ao provider
- API keys ou tokens de autenticação
- Payload bruto da requisição
- Headers HTTP
- Resposta bruta do provider
- Dados sensíveis desnecessários

**O que registrar (apenas resumo seguro):**
- Nome do produto (sanitizado, truncado se necessário)
- Nome da loja
- Segmento da loja
- Objetivo da campanha
- Tipo/formato da campanha
- Categoria inferida
- Flags importantes (override, conflitos)

**Estrutura do registro de métricas:**
```typescript
interface GenerationMetrics {
  runId: string;
  timestamp: string;
  environment: string;
  provider: string;
  model: string;
  promptVersion?: string;
  totalDurationMs: number;
  phaseDurationsMs?: Record<string, number>;
  estimatedCostUsd?: number;
  costEstimationSource?: "static_table" | "provider_usage" | "unavailable";
  retryCount: number;
  validationResult?: string;
  inferredCategory?: string;
  conflictsDetected: string[];
  hadOverride: boolean;
  reviewPassed?: boolean;
  reviewFailureType?: string;
  rejectionReason?: string;
  technicalError?: string;
  imageIdentifier?: string;
  sanitizedInputs: {
    productName: string;
    storeName: string;
    storeSegment: string;
  };
}
```

### D2 — Provider/Model Switch por env var, factory mínima

**Decisão:** Adicionar `IMAGE_PROVIDER` env var em `config.ts` (valores: `"openai"`, futuro `"gemini"`). Criar factory function `createImageProvider()` em módulo dedicado (`providers/factory.ts`) que retorna a implementação correta de `ImageProvider`. Não criar discovery pattern complexo — apenas um switch simples. Módulo separado evita risco de import circular com `OpenAIImageProvider`.

Novas env vars:
```
IMAGE_PROVIDER=openai
IMAGE_GENERATION_RESPONSES_MODEL=gpt-5.5
IMAGE_GENERATION_PROVIDER_API_KEY= (opcional, fallback para OPENAI_API_KEY)
```

Modelo de validação/revisão (`VISION_REVIEW_MODEL`) permanece configurável via env var (já existe). Só será extraído para provider separado se houver necessidade real de usar modelos diferentes de providers diferentes para validação vs geração — isso não é necessário agora.

**Alternativa considerada:** Provider discovery pattern com registro dinâmico. Rejeitado por overengineering — só temos 1 provider agora e no máximo 2 no futuro próximo.

### D3 — Eventos técnicos separados da UI de progresso

**Decisão:** Dividir o callback de progresso em duas camadas:

1. **`onMetricsEvent?(event: GenerationMetricsEvent)`** — novo callback opcional no service. Contém dados técnicos: `runId`, `phase`, `provider`, `model`, `elapsedMs`, `attempt`, `estimatedCostUsd`. Consumido internamente pelo sistema de métricas. **Nunca exposto na UI.**

2. **`onPhaseChange(event: GenerationPhaseEvent)`** — mantido, mas com `message` humanizada e sem `detail` técnico por padrão. O `detail` existe apenas para debug. A UI principal não deve mostrá-lo.

**Mensagens de UI (novas, humanizadas):**
```typescript
const PHASE_MESSAGES: Record<string, string[]> = {
  input_validation: [
    "Estamos validando as informações do produto.",
    "Checando se a imagem está adequada para publicação.",
  ],
  prompt_assembly: [
    "Criando o ambiente visual da campanha.",
    "Aplicando a assinatura visual da loja.",
    "Pensando em frases de impacto para valorizar a oferta.",
  ],
  image_generation: [
    "Compondo os elementos visuais da arte.",
    "Destacando o preço e a intenção da campanha.",
  ],
  quality_review: [
    "Revisando a campanha antes de entregar.",
    "Preparando sua campanha para entrega.",
  ],
};
```

As mensagens podem ser rotativas ou baseadas em tempo decorrido dentro da mesma fase. O tom é profissional, próximo, tranquilizador — sem humor, gamificação ou termos técnicos.

**UI component:** `GenerationProgress` mantém os indicadores de fase, mas substitui a seção "Detalhes técnicos" colapsável por algo mais limpo (ou remove se não agregar). Os indicadores de fase (bolinhas) continuam iguais.

### D4 — Bateria de benchmark: script autônomo

**Decisão:** Criar script `scripts/benchmark.ts` (executável via `npx tsx` — verificar se `tsx` já existe no projeto; se não, adicionar como devDependency) que:
1. Lê cenários fixos de um arquivo de configuração (ou array inline)
2. Para cada cenário, chama `ImageGenerationService.generateImage()` com os mesmos inputs
3. Registra métricas no mesmo formato JSONL em `metrics/benchmark-{timestamp}.jsonl`
4. Ao final, gera sumário comparativo no console

Cenários fixos (definidos em `scripts/benchmark-scenarios.ts`):
- JBL Boombox / eletrônico / oferta com "de/por"
- Heineken / bebida branded / oferta
- 51 Ice / possível divergência de nome/volume
- Pantufa / produto popular / preço único
- Produto de moda / item único
- Loja sem logo
- Loja com cor forte
- Preço com "de/por"
- Preço só final
- "Poucas unidades", "cores variadas", "vários sabores"

O script aceita `--provider` e `--model` para comparar diferentes configurações com os mesmos cenários.

**Nota sobre imagens de teste:** Os cenários que usam marcas ou produtos reais (Heineken, JBL, etc.) devem usar fixtures locais em `scripts/benchmark-fixtures/`. Não commitar imagens de terceiros sem verificação de direito de uso. O script deve aceitar caminho de imagem via configuração local. Adicionar `scripts/benchmark-fixtures/` ao `.gitignore` se contiver imagens reais de teste.

### D5 — Validação/Revisão: preservar divergências aceitáveis

**Decisão:** Refinar `applyValidationContextToReviewResult()` e as regras do `ImageReviewService`:

- **Erros claros de ortografia**: o validador já corrige (`auto-fix`). Manter.
- **Erros grotescos e conflitos fortes**: `wrong_price`, `wrong_store_name`, `generated_product_mismatch` continuam bloqueantes.
- **Divergências aceitáveis**: se o modelo de revisão aponta `product_image_conflict` ou `product_image_low_confidence` mas o usuário confirmou override, a revisão não falha. Já implementado em 4.3.2. Reforçar que divergências com contexto suficiente (ex: loja de bebidas vendendo 51 Ice com nome correto na arte) devem ser aprovadas.

O ajuste principal é no prompt do revisor (`campaign-image-reviewer.md`): explicitar que a liberdade criativa do diretor deve ser preservada **quando os dados essenciais estiverem corretos**. Ela não pode sobrepor preço, produto, nome da loja, legibilidade ou conflito forte produto × imagem.

### D6 — "Detalhes adicionais" como repertório, não obrigação

**Decisão:** O prompt do diretor (`campaign-image-director.md`) já recebe `commercialRepertoire` (build em `buildCommercialRepertoire()` desde 4.3.2). A orientação a ser reforçada no prompt:

- O campo "detalhes adicionais" é repertório comercial para **inspiração**, não instrução obrigatória.
- Nem toda informação precisa aparecer na arte. Algumas são mais adequadas para legenda, hashtag ou texto complementar (futuro).
- O diretor deve usar seu julgamento para selecionar o que fortalece a peça visual.

Isso é uma alteração de **prompt apenas**, não de código.

### D7 — creativeContextGuidance por segmento + produto

**Decisão:** Adicionar variável opcional `creativeContextGuidance` no prompt do diretor: sugestão de tom/abordagem que considera **segmento da loja** e **categoria inferida do produto**, além do **conflito ou alinhamento** entre ambos.

Exemplos:
- Loja de alimentação vendendo bebida energética: `"Valorize energia e disposição. Preço é oportunidade."`
- Loja popular vendendo eletrônico premium: `"Equilibre varejo popular com desejo por tecnologia."`
- Loja de moda vendendo tênis esportivo: `"Valorize estilo e performance. Preço é investimento."`

Quando há conflito de categoria, a guidance deve equilibrar os dois universos sem poluir o prompt. Implementado como mapeamento simples em `buildPromptVariables()`.

## Risks / Trade-offs

- **[JSONL em produção]** → Filesystem efêmero no Vercel. Mitigação: métricas desabilitadas por padrão em produção nesta fase; quando habilitadas, vão para stdout. Decisão consciente de não usar banco ainda.
- **[Provider switch simplificado]** → Se no futuro houver 5+ providers, o switch simples precisará virar factory pattern real. Aceitável porque a interface `ImageProvider` já abstrai a implementação.
- **[Mensagens humanas dessincronizadas]** → Mensagens rotativas podem não refletir a fase real exata. Mitigação: o indicador visual (bolinhas) continua atrelado à fase real; apenas o texto pode ser ligeiramente defasado. Isso é intencional para UX.
- **[Benchmark sem automação CI]** → O script é manual. Em fase futura, pode ser integrado a um workflow. Aceitável para V1.
- **[Custo estimado impreciso]** → Cálculo será baseado em tabela de preços aproximada por modelo. Não é contábil, apenas indicativo. Pode ser removido se gerar confusão.
- **[Premissa legal não implementada]** → Registrada como premissa futura. O lojista é responsável pelo direito de uso das imagens fornecidas. Não implementar agora.

## Migration Plan

1. **config.ts**: adicionar `IMAGE_PROVIDER` env var; criar `providers/factory.ts` com `createImageProvider()`
2. **Metrics types**: criar tipos e writer JSONL em `src/lib/image-generation/metrics/`
3. **ImageGenerationService**: injetar `MetricsWriter`, emitir `onMetricsEvent`, refatorar `onPhaseChange` para mensagens humanas
4. **Route handler**: usar `createImageProvider()` em vez de instanciar `OpenAIImageProvider` diretamente
5. **Prompt adjustments**: `campaign-image-director.md` (repertório), `campaign-image-reviewer.md` (divergências aceitáveis)
6. **GenerationProgress UI**: substituir mensagens, ocultar detalhes técnicos
7. **Benchmark script**: criar `scripts/benchmark.ts` + `scripts/benchmark-scenarios.ts`
8. `.env.example`: documentar novas variáveis

## Resolved Questions

As seguintes questões foram fechadas durante o design:

1. **MetricsWriter**: append assíncrono com `fs.promises.appendFile`, best-effort com try/catch. Não usar queue + flush para manter simplicidade.
2. **runId**: `crypto.randomUUID()` — nativo, sem dependência externa.
3. **Benchmark rate limit**: delay configurável entre cenários + limite máximo obrigatório de execuções para evitar estouro de custo.
