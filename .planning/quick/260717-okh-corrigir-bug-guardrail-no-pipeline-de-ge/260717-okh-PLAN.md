---
phase: quick-260717-okh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/image-generation/services/image-review-service.ts
  - src/lib/image-generation/services/image-generation-service.ts
  - src/app/api/campaign/generate-image/route.ts
  - src/lib/image-generation/services/__tests__/image-review-service.test.ts
  - src/lib/image-generation/services/__tests__/image-generation-service.test.ts
autonomous: true
requirements: []
user_setup: []
must_haves:
  truths:
    - "ImageReviewService.review() interpola {{badgeText}} corretamente"
    - "Prompts com placeholders não resolvidos bloqueiam antes de qualquer chamada de IA (Copy Director, Image Provider, Reviewer)"
    - "Campanha/crédito ficam em estado consistente quando preflight de prompt falha"
    - "Fluxo normal de retry/revisão continua funcionando para prompts válidos"
  artifacts:
    - path: "src/lib/image-generation/services/image-review-service.ts"
      provides: "interface ImageReviewInput inclui badgeText, promptLoader.load() recebe badgeText"
      contains: "badgeText: input.badgeText ?? ''"
    - path: "src/lib/image-generation/services/image-generation-service.ts"
      provides: "método validatePrompts() público + chamada com badgeText no reviewInput"
      contains: "validatePrompts(brief: CampaignBrief)"
    - path: "src/app/api/campaign/generate-image/route.ts"
      provides: "preflight de prompts antes de Promise.all paralelo"
      contains: "const preflightResult ="
  key_links:
    - from: "route.ts"
      to: "ImageGenerationService.validatePrompts"
      via: "chamada antes de Promise.all"
      pattern: "validatePrompts\\(brief\\)"
    - from: "image-generation-service.ts"
      to: "image-review-service.ts"
      via: "reviewInput contém badgeText"
      pattern: "badgeText: body\\.badgeText"
---

<objective>
Corrigir o bug de placeholder não resolvido no pipeline de geração de campanha e adicionar guardrail de preflight.

**Bug 1:** `ImageReviewService.review()` não interpola `{{badgeText}}` — o prompt `campaign-image-reviewer.md` contém `{{badgeText}}` (linha 15), mas `ImageReviewService` não passa `badgeText` nas variáveis do `promptLoader.load()`, deixando o placeholder literal no prompt enviado ao modelo de visão.

**Bug 2:** `/api/campaign/generate-image` executa Copy Director e Image Director em paralelo. Se o prompt do Image Director tiver placeholders não resolvidos, o Copy Director já consumiu IA antes da validação em `generateWithRetry()` abortar.

**Correções:**
1. Adicionar `badgeText` ao `ImageReviewInput` e passá-lo ao carregar o prompt do revisor.
2. Adicionar método `validatePrompts()` público em `ImageGenerationService` que verifica ambos os prompts (director + reviewer) contra as variáveis disponíveis.
3. Chamar `validatePrompts()` em `route.ts` **antes** de `Promise.all([copyTask(), imageTask()])` — se falhar, emite erro NDJSON, faz refund de crédito e aborta o stream sem nenhuma chamada de IA.
4. Adicionar testes automatizados para cada guardrail.

Purpose: Eliminar chamadas de IA desperdiçadas quando prompts têm placeholders não resolvidos, e garantir que o revisor receba `badgeText` corretamente.
Output: Código corrigido + testes passando.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260717-okh-corrigir-bug-guardrail-no-pipeline-de-ge/260717-okh-PLAN.md

**Arquivos-chave lidos e analisados:**
- `src/app/api/campaign/generate-image/route.ts` — fluxo paralelo copyTask ∥ imageTask (linha 388), refound/error handling já implementado
- `src/lib/image-generation/services/image-generation-service.ts` — `buildPromptVariables()` (linha 722) e `generateWithRetry()` (linha 815) com `validatePrompt()` já no lugar
- `src/lib/image-generation/services/image-review-service.ts` — `review()` (linha 55) carrega prompt sem `badgeText`
- `src/lib/image-generation/services/prompt-validator.ts` — `validatePrompt()` disponível
- `prompts/campaign-image-reviewer.md` — contém `{{badgeText}}` na tabela de dados (linha 15)
- `prompts/campaign-image-director.md` — contém `{{badgeText}}` na tabela e diretrizes

**Todas as variáveis do template director são cobertas por `buildPromptVariables()`.** O bug do revisor é que `badgeText` não é passado nas variáveis. O bug de paralelismo é que a validação em `generateWithRetry()` acontece tarde demais (Copy Director já rodou).

**NENHUMA mudança no fluxo de retry/revisão bem-sucedido.** O preflight só bloqueia quando prompt inválido.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Corrigir ImageReviewService para aceitar/interpolar badgeText</name>
  <files>
    src/lib/image-generation/services/image-review-service.ts
    src/lib/image-generation/services/image-generation-service.ts
  </files>
  <action>
    **Em `image-review-service.ts`:**
    1. Adicionar `badgeText: string` ao `ImageReviewInput` (interface existente, linha 11-17).
    2. Em `review()` (linha 55), adicionar `badgeText: input.badgeText` ao objeto passado para `this.promptLoader.load("campaign-image-reviewer", {...})` (linha 83-89). A ordem das chaves não importa; manter as existentes e adicionar `badgeText`. Usar `input.badgeText ?? ""` como fallback.

    **Em `image-generation-service.ts`:**
    3. No `reviewInput` montado em `generateImage()` (linha 355-363), adicionar `badgeText: body.badgeText ?? ""`:
       ```typescript
       const reviewInput: ImageReviewInput = {
         productName: effectiveProductName,
         storeName: brief.store.name,
         badgeText: body.badgeText ?? "",
         discountedPrice: this.formatPriceBRL(body.discountedPriceCents),
         originalPrice: (body.originalPriceCents ?? 0) > 0
           ? this.formatPriceBRL(body.originalPriceCents ?? 0)
           : undefined,
         validationContext,
       };
       ```
       (Inserir `badgeText` entre `storeName` e `discountedPrice`.)

    **NÃO** alterar `PromptLoader`, `validatePrompt`, ou qualquer outro arquivo.
    **NÃO** mudar a assinatura de `callVisionModel` ou `parseResult`.
  </action>
  <verify>
    <automated>npx vitest run src/lib/image-generation/services/__tests__/image-review-service.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `ImageReviewInput` possui campo `badgeText: string`
    - `review()` passa `badgeText` para `promptLoader.load()`
    - `generateImage()` inclui `badgeText` no `reviewInput`
    - Teste "badgeText é interpolado no prompt do revisor" passa
  </done>
</task>

<task type="auto">
  <name>Task 2: Adicionar preflight validatePrompts() e guardrail no route.ts</name>
  <files>
    src/lib/image-generation/services/image-generation-service.ts
    src/app/api/campaign/generate-image/route.ts
  </files>
  <action>
    **Em `image-generation-service.ts`:**

    1. Adicionar método público `validatePrompts(brief: CampaignBrief): { valid: boolean; errors: string[] }`.
       - Extrair `body` de `brief.campaignInput as GenerateImageRequest`.
       - Chamar `this.buildPromptVariables(body, body.productName, undefined, brief)` para montar o mapa completo de variáveis do diretor.
       - Carregar o prompt do diretor: `this.promptLoader.load("campaign-image-director", directorVariables)`.
       - Validar com `validatePrompt(directorPrompt)`. Se inválido, adicionar ao array de erros.
       - Montar variáveis do revisor manualmente (não usa `buildPromptVariables`):
         ```typescript
         const reviewerVars = {
           productName: body.productName,
           storeName: brief.store.name,
           discountedPrice: this.formatPriceBRL(body.discountedPriceCents),
           originalPrice: (body.originalPriceCents ?? 0) > 0
             ? this.formatPriceBRL(body.originalPriceCents ?? 0)
             : "",
           badgeText: body.badgeText ?? "",
           validationContextSection: "",
         };
         ```
       - Carregar prompt do revisor: `this.promptLoader.load("campaign-image-reviewer", reviewerVars)`.
       - Validar com `validatePrompt(reviewerPrompt)`. Se inválido, adicionar ao array.
       - Retornar `{ valid: errors.length === 0, errors }`.
       - O método é síncrono (não faz chamadas de rede).

    **Em `route.ts`:**

    2. Dentro do stream `start()`, **imediatamente antes** de `await Promise.all([copyTask(), imageTask()])` (linha 388), adicionar:

       ```typescript
       // ── PREFLIGHT: Validate all prompts before parallel IA calls ──
       const preflightResult = imageService.validatePrompts(brief);
       if (!preflightResult.valid) {
         console.error(`[generate-image] prompt_preflight_failed — ${preflightResult.errors.join('; ')}`);
         emit({ type: "error", campaignId: campaignId!, phase: "preflight", code: "invalid_prompt", message: preflightResult.errors.join("; "), httpStatus: 502, retryable: false });
         try { await updateCampaignError(campaignId!, preflightResult.errors.join("; ")); } catch { /* ignore */ }
         try { await creditService.refundCredit(creditTxId!, "invalid_prompt", { idempotencyKey: `refund_${creditTxId}` }); } catch { /* ignore */ }
         clearTimeout(timeoutId);
         try { controller.close(); } catch { /* already closed */ }
         return;
       }
       ```

       **Onde inserir:** Depois da definição das funções `copyTask` e `imageTask` (após linha 384), imediatamente antes de `try { await Promise.all(...`.
       **Manter** todo o resto do fluxo intacto.

    **NÃO** alterar `copyTask`, `imageTask`, o fluxo pós-paralelo, ou qualquer tratamento de erro existente.
    **NÃO** duplicar código de validação — usar o novo método `validatePrompts`.
  </action>
  <verify>
    <automated>npx vitest run src/lib/image-generation/services/__tests__/image-generation-service.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `ImageGenerationService.validatePrompts(brief)` existe e retorna `{ valid, errors }`
    - Prompts inválidos (com `{{...}}` não resolvido) retornam `valid: false`
    - Prompts válidos retornam `valid: true`
    - `route.ts` aborta com refund antes de IA se preflight falhar
    - Testes de preflight passam
  </done>
</task>

<task type="auto">
  <name>Task 3: Adicionar testes automatizados</name>
  <files>
    src/lib/image-generation/services/__tests__/image-review-service.test.ts
    src/lib/image-generation/services/__tests__/image-generation-service.test.ts
  </files>
  <action>
    **Criar `src/lib/image-generation/services/__tests__/image-review-service.test.ts`:**

    Dependências mockadas:
    - `@/lib/image-generation/prompt-loader` → `PromptLoader` mockado com `vi.fn()` no método `load`
    - `openai` → mockar o import dinâmico (ou usar `vi.mock` no módulo)

    Testes a implementar:
    1. **"review() interpola badgeText no prompt"**
       - Instanciar `ImageReviewService` com `PromptLoader` mockado (que retorna `{{badgeText}}` literal).
       - Chamar `review()` com `ImageReviewInput` contendo `badgeText: "Oferta Imperdível"`.
       - Verificar que o argumento passado para `promptLoader.load()` inclui `badgeText: "Oferta Imperdível"`.
       - (Opicional) Verificar que após `PromptLoader.load()`, o `{{badgeText}}` no prompt é substituído por "Oferta Imperdível".

    2. **"review() usa fallback string vazia quando badgeText é undefined"**
       - Chamar `review()` sem `badgeText` no input.
       - Verificar que `promptLoader.load()` recebe `badgeText: ""`.

    **Criar `src/lib/image-generation/services/__tests__/image-generation-service.test.ts`:**

    Dependências mockadas:
    - `@/lib/image-generation/prompt-loader` → `PromptLoader` que retorna conteúdo controlável (por default, retorna o template com `{{productName}}` e `{{storeName}}`)
    - `@/lib/image-generation/services/input-validation-service` → mock sem-op
    - `@/lib/image-generation/services/image-review-service` → mock sem-op
    - `@/lib/image-generation/metrics/writer` → mock sem-op
    - `@/lib/image-generation/providers/types` → mock do provider
    - `@/lib/constants` → import real (STORE_SEGMENTS é usado em buildPromptVariables)

    Testes a implementar:
    1. **"validatePrompts retorna valid=true para prompt válido"**
       - Configurar `PromptLoader.load()` para retornar "Prompt sobre {{productName}}" (e o mock de variáveis preenche `productName`).
       - Criar `CampaignBrief` com dados mínimos.
       - Chamar `service.validatePrompts(brief)`.
       - Verificar `result.valid === true` e `result.errors` vazio.

    2. **"validatePrompts retorna valid=false quando director prompt tem placeholder não resolvido"**
       - Configurar `PromptLoader.load("campaign-image-director", ...)` para retornar string com `{{variavelInexistente}}` (simular falha de interpolação).
       - Chamar `validatePrompts(brief)`.
       - Verificar `result.valid === false` e `result.errors` conter "Diretor de imagem".

    3. **"validatePrompts retorna valid=false quando reviewer prompt tem placeholder não resolvido"**
       - Configurar `PromptLoader.load("campaign-image-reviewer", ...)` para retornar string com `{{outraVar}}`.
       - Chamar `validatePrompts(brief)`.
       - Verificar `result.valid === false` e `result.errors` conter "Revisor de imagem".

    **NÃO** mockar `validatePrompt` — usar a implementação real.
    **NÃO** modificar arquivos de teste existentes.
    **NÃO** adicionar testes de integração com rota (o mock atual de ImageGenerationService não expõe validatePrompts facilmente). A verificação de rota será manual ou via teste e2e futuro.
  </action>
  <verify>
    <automated>npx vitest run src/lib/image-generation/services/__tests__/ 2>&1 | tail -30</automated>
  </verify>
  <done>
    - Testes do reviewer (badgeText interpolado) passam
    - Testes do validatePrompts (válido / inválido diretor / inválido revisor) passam
    - Nenhum teste existente quebrado (`npx vitest run` sem falhas inesperadas)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client→API | POST /api/campaign/generate-image — dados de campanha não confiáveis |
| API→Provider IA | Prompt enviado a OpenAI/Anthropic — prompt injection via campos de texto do lojista |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Tampering | prompt-loader.ts / validatePrompts | mitigate | Preflight bloqueia antes de IA se prompt contiver `{{...}}` não resolvido, evitando envio de prompt malformado ao provider |
| T-quick-02 | Information Disclosure | image-review-service.ts | mitigate | badgeText agora é interpolado corretamente; não há mais vazamento de placeholder literal para modelo de visão |
| T-quick-03 | Denial of Service | route.ts parallel flow | mitigate | Preflight antes de Promise.all evita chamadas IA desnecessárias que consumiriam cota/tempo |
</threat_model>

<verification>
1. `npx vitest run src/lib/image-generation/services/__tests__/` — todos os novos testes passam
2. `npx vitest run src/app/api/campaign/generate-image/__tests__/route.test.ts` — testes existentes continuam passando
3. `npx tsc --noEmit` — sem erros de tipo
4. `grep -rn "{{badgeText}}" src/lib/image-generation/services/image-review-service.ts` — NÃO deve encontrar `{{badgeText}}` no código (deve estar apenas nos arquivos .md de prompt)
</verification>

<success_criteria>
1. ImageReviewService aceita `badgeText` no input e interpola no prompt
2. Prompts inválidos (com `{{...}}` não resolvidos) bloqueiam no preflight antes de QUALQUER chamada de IA
3. Crédito é estornado e campanha marcada como erro quando preflight falha
4. Fluxo de retry/revisão para prompts válidos permanece inalterado
5. Todos os testes passam (novos + existentes)
</success_criteria>

<output>
Create `.planning/quick/260717-okh-corrigir-bug-guardrail-no-pipeline-de-ge/260717-okh-01-SUMMARY.md` when done.
</output>
