## Context

O `ImageGenerationService` atual executa geração de imagem em pipeline síncrono de etapa única (validate → generate → review → correct/regenerate) via POST `/api/campaign/generate-image`. O cliente envia o payload e aguarda 80s–2min+ por uma resposta — sem visibilidade de progresso, sem diagnóstico intermediário, sem timeout dedicado. Falhas retornam códigos genéricos (`provider_failure`, `review_failed`) sem diferenciação para o usuário.

O serviço já possui um state machine interno de 5 estados (`INITIAL`, `REVIEW`, `CORRECT`, `REGENERATE`, `COMPLETE`, `ERROR`) e o provider (`OpenAIImageProvider`) já implementa fallback entre Responses API e Image API. A infraestrutura base existe — falta expor as fases, estruturar erros e dar visibilidade ao cliente.

## Goals / Non-Goals

**Goals:**
- Substituir o endpoint síncrono por resposta streaming (NDJSON) com eventos de fase e resultado final
- Definir taxonomia de fases: `input_validation`, `prompt_assembly`, `image_generation`, `quality_review`, `done`
- Definir tipos de erro estruturados por fase, com mensagens diagnósticas para o usuário
- Adicionar timeout global com budget compartilhado entre fases e retries (default 300s) e timeouts referenciais por fase
- Implementar retry controlado para falhas recuperáveis (rate limit, erro temporário, quality_review com tipos específicos)
- Criar componente de progresso multifase no lado do cliente, durante a geração
- Adicionar logs diagnósticos visíveis por etapa
- Preservar input da campanha em sessionStorage antes da geração começar
- Remover obrigatoriedade de `originalPrice` para tipos de oferta sem preço original

**Non-Goals:**
- Fallback Gemini como provedor alternativo (apenas arquitetura preparada)
- Direção criativa ou densidade visual por segmento (4.3.2)
- Acabamento visual, hierarquia de publicabilidade (4.3.3)
- Review, Adjust & Export (Phase 5)
- Edição visual de camadas da campanha

## Decisions

### Decision 1: Streaming HTTP response (NDJSON) sobre POST

**Contexto:** O payload de geração inclui imagem do produto como data URL (base64) + dezenas de campos de formulário — inviável para GET (SSE). WebSocket adiciona complexidade de conexão e gerenciamento de estado.

**Decisão:** O endpoint `/api/campaign/generate-image` muda de resposta JSON única para streaming NDJSON (`Content-Type: application/x-ndjson`). Cada linha é um evento JSON:
- `{"type":"phase","phase":"input_validation","status":"running","message":"Validando dados da campanha..."}`
- `{"type":"phase","phase":"input_validation","status":"complete"}`
- `{"type":"phase","phase":"prompt_assembly","status":"running","message":"Montando briefing criativo..."}`
- `{"type":"phase","phase":"image_generation","status":"running","message":"Gerando imagem... (pode levar até 2 minutos)"}`
- `{"type":"phase","phase":"quality_review","status":"running","message":"Revisando qualidade da imagem..."}`
- `{"type":"result","success":true,"imageDataUrl":"data:image/...","inputCorrections":{...}}`
- `{"type":"error","phase":"image_generation","code":"provider_error","message":"...","retryable":true}`

**Por que NDJSON em vez de SSE?** SSE exige GET, mas precisamos enviar o payload grande via POST. NDJSON sobre Fetch API `response.body.getReader()` funciona com POST, é suportado em todos os browsers modernos, e não depende de EventSource.

**Por que em vez de polling?** Polling adiciona latência (a cada N segundos), complexidade de job management, e overhead de requisições. Streaming é mais simples e mais rápido para o usuário.

### Decision 2: Progress callback no ImageGenerationService

**Contexto:** O serviço atual executa toda a pipeline internamente sem expor progresso.

**Decisão:** `ImageGenerationService.generateImage()` aceita um callback opcional `onPhaseChange?: (phase: GenerationPhaseEvent) => void`. Cada etapa do pipeline chama o callback:
- Antes de iniciar cada fase
- Ao completar cada fase
- Ao encontrar erro em cada fase

O callback é conectado ao stream response no handler da API route. Isso mantém o service testável (callback é opcional, sem dependência de stream).

### Decision 3: Taxonomia de fases

```
input_validation   → validação produto vs imagem (pré-existente)
prompt_assembly    → montagem do prompt de direção criativa
image_generation   → chamada ao ImageProvider (com retries)
quality_review     → revisão por visão (pré-existente)
done               → fase terminal (sucesso ou falha exaustiva)
```

Cada fase implementa `GenerationPhase`:
```typescript
type GenerationPhaseStatus = "pending" | "running" | "complete" | "skipped" | "failed";

interface GenerationPhaseEvent {
  phase: "input_validation" | "prompt_assembly" | "image_generation" | "quality_review" | "done";
  status: GenerationPhaseStatus;
  message?: string;
  detail?: string;
}
```

### Decision 4: Tipos de erro estruturados

**Contexto:** Atualmente erros retornam `{ success: false, code: string, message: string }`. Precisamos de tipos diagnósticos que o cliente possa interpretar.

**Decisão:** Discriminated union de erros por fase:

```typescript
type GenerationErrorCode =
  | "no_image_in_response"        // API respondeu 200 sem imagem
  | "empty_review"                // modelo de revisão retornou vazio
  | "insufficient_image"          // imagem gerada é insuficiente (baixa qualidade, cortada, etc.)
  | "input_low_confidence"        // pré-validação produto vs imagem não determinou match
  | "review_low_confidence"       // revisão da arte gerada com confiança baixa
  | "product_image_conflict"      // pré-validação: produto não confere com a imagem
  | "generated_product_mismatch"  // pós-revisão: arte gerada exibe nome de produto errado
  | "provider_error"              // erro transiente do provedor (429, 503, rede)
  | "provider_auth_error"         // erro de autenticação ou quota do provedor
  | "provider_timeout"            // timeout real de rede/SDK na chamada ao provider
  | "invalid_data"                // dados de entrada inválidos
  | "global_timeout";             // orçamento global de tempo excedido

interface GenerationError {
  phase: string;
  code: GenerationErrorCode;
  message: string;              // mensagem amigável para o usuário (PT-BR)
  detail?: string;              // diagnóstico para desenvolvedor (opcional, sanitizado)
  retryable: boolean;           // true se pode tentar novamente automaticamente
  requiresUserAction?: boolean; // true se precisa de intervenção do usuário
}
```

Erros detectáveis **antes** do stream começar (payload inválido, validação síncrona) retornam HTTP normal (400, etc.) sem abrir stream.

Depois que o stream começou (`Content-Type: application/x-ndjson` já enviado), o status HTTP é sempre 200. Erros terminais são enviados como evento NDJSON com campo `httpStatus` para referência:

```typescript
interface GenerationError {
  // ...
  httpStatus: number;  // 400, 409, 502, 504 — apenas informativo
}
```

A UI lê o evento `type: "error"` do stream e decide o tratamento. O status HTTP deixa de ser o canal de sinalização — o NDJSON carrega toda a informação.

Erros retryable (`provider_error` 429/503/rede, `provider_timeout`, `no_image_in_response`, `empty_review`, `insufficient_image`, `review_low_confidence`) são tratados internamente pelo serviço sem expor ao cliente, a menos que todos os retries se esgotem. Erros não retryable (`provider_auth_error`, `generated_product_mismatch`, `product_image_conflict`, `input_low_confidence`, `invalid_data`, `global_timeout`) são emitidos como terminais imediatamente.

### Decision 5: Retry policy

| Erro | Retryável? | Tentativas | Backoff | Ação |
|------|-----------|------------|---------|------|
| `provider_error` (429, 503, rede) | Sim | 2 | 1s, 3s | Retry no mesmo provider |
| `provider_timeout` | Sim | 1 | Imediato | Tentar fallback configurado no provider |
| `no_image_in_response` | Sim | 1 | Imediato | Tentar com fallback de modelo/config |
| `empty_review` | Sim | 1 | Imediato | Regenerar e revisar novamente |
| `insufficient_image` | Sim | 2 | Imediato | Regenerar com instrução de correção específica |
| `review_low_confidence` | Sim | 1 | Imediato | Regenerar com instrução para melhorar qualidade |
| `provider_auth_error` | Não | — | — | Emitir erro terminal imediatamente |
| `product_image_conflict` | Não | — | — | Retornar 409 antes do stream, aguardar ação do usuário |
| `input_low_confidence` | Não | — | — | Retornar 409 antes do stream, aguardar ação do usuário |
| `generated_product_mismatch` | Não | — | — | Emitir erro no stream (sem override, usuário deve corrigir) |
| `invalid_data` | Não | — | — | Emitir erro (400 antes do stream ou NDJSON se já iniciado) |
| `global_timeout` | Não | — | — | Emitir erro no stream com `httpStatus: 504` |

O retry acontece dentro do `ImageGenerationService`, não exposto ao cliente. O cliente vê apenas os eventos de fase `running` → (retry invisível) → `running` (nova tentativa). Se todos os retries falharem, a fase transiciona para `failed` com o erro terminal.

### Decision 6: Timeout strategy (budget-aware)

Implementado via `AbortController` hierárquico com **budget de tempo global** compartilhado entre fases e retries.

- **Timeout global**: `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` (default 300s = 5min) — `AbortController` no handler da API route. Aborta toda a operação e encerra o stream com `global_timeout`.
- **Per-phase windows recomendados** (não vinculantes — diagnóstico e orçamento apenas, NÃO abortam a fase):
  - `input_validation`: 30s
  - `prompt_assembly`: 10s (síncrono, só montagem de string)
  - `image_generation`: 120s por tentativa
  - `quality_review`: 45s

`provider_timeout` é um conceito distinto: representa timeout real de rede/SDK na comunicação com o provedor (ex: conexão TCP expirou, SDK jogou timeout). Não é disparado pelas janelas recomendadas acima. Se o SDK não responder dentro do prazo dele, o erro chega como `provider_timeout` e pode ser retryado.

**Regra de retry no orçamento**: retry só é tentado se o tempo já consumido + tempo estimado para nova tentativa ainda couber no timeout global. Ou seja:

```
tempoRestante = globalTimeout - tempoJaGasto
se tentativaExtra > tempoRestante → pula retry, emite erro terminal
```

Isso evita que retries matem gerações que já gastaram muito tempo, mas também não corta tentativas legítimas que ainda cabem no orçamento global. A UI recebe evento `"phase"` com `status: "running"` e mensagem como "Tentando novamente..." quando um retry está em andamento dentro do orçamento.

Quando o timeout global estoura, aborta imediatamente com `global_timeout` via `AbortController`.

### Decision 7: Provider interface para suporte a timeout e fallback

**Contexto:** `ImageProvider` atual não recebe `AbortSignal` nem tem metadata de fallback.

**Decisão:** Estender `ImageProviderInput`:
```typescript
interface ImageProviderInput {
  prompt: string;
  productImageDataUrl?: string;
  size?: "1024x1024" | "2048x2048";
  quality?: "low" | "medium" | "high" | "auto";
  signal?: AbortSignal;             // NOVO
  attempt?: number;                  // NOVO - tentativa atual (0, 1, 2)
}
```

O provider primário configurado no `OpenAIImageProvider` é usado na tentativa 0. Se falhar com erro retryável de timeout, a tentativa 1 vai para o fallback já configurado no provider atual (`Image API edit`). Isso aproveita o fallback já existente, mas o torna explícito e rastreável.

### Decision 8: Componente GenerationProgress

**Contexto:** Atualmente o formulário mostra `isSubmitting=true` com spinner simples.

**Decisão:** Novo componente `GenerationProgress` no lado do cliente, exibido durante `isSubmitting` no `useCampaignForm`:

- Barra de progresso visual com etapas: validação → prompt → geração → revisão
- Círculo/ícone por etapa: pending (cinza), running (animado/acento), complete (check verde), failed (X vermelho)
- Mensagem de texto dinâmica abaixo da barra (ex: "Validando dados...", "Gerando imagem... normalmente leva até 2 minutos")
- Área de logs diagnósticos colapsável (opcional, para debug)
- Em caso de erro: destaca a fase que falhou, mostra mensagem de erro, botão de retry

O componente recebe eventos do stream via callback e atualiza o estado interno.

### Decision 9: Cliente streaming via Fetch API

**Contexto:** O hook `useCampaignForm` atualmente faz POST e aguarda resposta JSON.

**Decisão:** Substituir `fetch().then(res => res.json())` por consumo de stream:

```typescript
const response = await fetch("/api/campaign/generate-image", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // chunk pode conter múltiplas linhas NDJSON
  for (const line of chunk.split("\n").filter(Boolean)) {
    const event = JSON.parse(line);
    handleEvent(event);
  }
}
```

Os eventos atualizam o estado do `GenerationProgress` em tempo real. O evento `result` finaliza o fluxo (sucesso ou erro terminal).

### Decision 10: Input preservation

**Contexto:** Se a geração falha, o formulário atual mantém o estado React mas não há proteção contra navegação acidental ou refresh.

**Decisão:** Auto-save do formulário em sessionStorage a cada alteração de campo (debounced 500ms). Ao montar o formulário, verificar se existe draft salvo e restaurar. Após geração bem-sucedida, limpar o draft. Isso garante que mesmo se o usuário der refresh durante a geração longa, os dados não são perdidos.

Estrutura:
```typescript
const DRAFT_KEY = "campaign_draft";
// Salvar: sessionStorage.setItem(DRAFT_KEY, JSON.stringify(fields))
// Restaurar: sessionStorage.getItem(DRAFT_KEY)
// Limpar: sessionStorage.removeItem(DRAFT_KEY) após sucesso
```

### Decision 11: `originalPrice` não obrigatório

**Contexto:** O schema atual requer `originalPrice` para todos os tipos de oferta. Ofertas como "Leve 2 pague 1" ou "Promoção relâmpago" não têm preço original.

**Decisão:** O campo `originalPrice` passa de `string` para `string | undefined` no Zod schema. Quando ausente, o display de "De: R$ X" é omitido na renderização. O badge de oferta ainda pode existir sem preço original.

## Risks / Trade-offs

- **[Risco]** Stream NDJSON aumenta complexidade do endpoint e do cliente — não é tão simples quanto `res.json()`.
  → **Mitigação:** Usar `ReadableStream` nativo do Next.js App Router para escrever eventos NDJSON. O handler da API route retorna `new NextResponse(readableStream, { headers: { "Content-Type": "application/x-ndjson" } })`. A lógica de escrita é encapsulada em um helper que recebe o `WritableStream` e o `ImageGenerationService` call, escrevendo cada evento como linha NDJSON.

- **[Risco]** Cliente consumindo stream pode ter parsing quebrado se o NDJSON chegar parcial (meia linha).
  → **Mitigação:** Usar buffer de linha no cliente — acumular chunk, split por `\n`, processar linhas completas, manter linha parcial para próximo chunk.

- **[Risco]** Aumento de timeout pode mascarar problemas reais de performance.
  → **Mitigação:** Timeouts são configuráveis via `IMAGE_GENERATION_TIMEOUT_MS` e `IMAGE_GENERATION_PHASE_TIMEOUT_MS` em `config.ts`. Monitorar em produção e ajustar.

- **[Risco]** Retry automático pode encobrir erros de billing/quota, gerando custos inesperados.
  → **Mitigação:** Retry NÃO é aplicado para erros de auth/quota — apenas para rate limit (429), timeout, e transient server errors (5xx específicos).

- **[Risco]** `AbortSignal` no provider — OpenAI client pode não respeitar o signal em todas as versões.
  → **Mitigação:** Verificar compatibilidade. O `AbortController.timeout()` é padrão e o OpenAI SDK respeita `signal` nas chamadas HTTP subjacentes.

- **[Risco]** Auto-save em sessionStorage pode causar perda de draft se o usuário tiver múltiplas abas.
  → **Mitigação:** Aceitável para fase 1. Futuramente migrar para `localStorage` com versionamento de aba, ou server-side draft.

- **[Risco]** Cliente pode fechar a aba durante a geração e perder o resultado.
  → **Mitigação:** O resultado nunca é persistido no servidor (por design). Se o usuário fecha a aba, o resultado é perdido — comportamento esperado. O fluxo é: gerar → ver preview → exportar. Se fechar antes de exportar, precisa gerar novamente.
