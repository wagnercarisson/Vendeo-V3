---
phase: 260902-mqj-openai-fallback-preserva-referencias
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/image-generation/providers/openai.ts
  - src/lib/image-generation/providers/__tests__/openai-provider.test.ts
autonomous: true
requirements:
  - MQJ-FALLBACK-REFS
  - MQJ-IDENTITY-SENT
  - MQJ-FALLBACK-MULTI-SDK
  - MQJ-NO-SURFACE-REGRESSION
must_haves:
  truths:
    - "Fallback com APENAS a imagem do produto (legado ou lista de 1) continua gerando: `images.edit` recebe exatamente 1 imagem (escalar, wire format atual preservado)"
    - "Fallback com `identityImageUrl` presente envia a identidade visual JUNTO com a imagem do produto ao `images.edit` (array de 2); se a identidade não puder ser carregada, o fallback bloqueia com erro explícito PT-BR — nunca gera arte sem a assinatura visual"
    - "Fallback com `productImagesDataUrls` (2+ imagens) envia TODAS as referências ao `images.edit`, preservando a primeira (primary) como base e as demais como referências auxiliares"
    - "A ordem das imagens no `images.edit` é determinística: [primary, auxiliares..., identity?] — identidade sempre por último, quando houver"
    - "Gate do fallback passa a exigir apenas a existência de primary (não mais 'exatamente 1 imagem'); sem primary o fallback NÃO é usado (comportamento de sem-imagem inalterado)"
    - "Log operacional mínimo no fallback (console.error, sem sistema de telemetria/métricas): modelo usado, quantidade de imagens enviadas e se a identidade foi enviada"
    - "Nenhuma mudança em prompts, UI, schema público, contrato HTTP, domínio/snapshot ou revisor de imagem (superfícies intocadas verdes sem edição)"
  artifacts:
    - path: "src/lib/image-generation/providers/openai.ts"
      provides: "Fallback monta lista ordenada de arquivos (primary + auxiliares de productImagesDataUrls + identity) e chama openai.images.edit com image: File | File[]"
      contains: "canUseEditFallback"
    - path: "src/lib/image-generation/providers/__tests__/openai-provider.test.ts"
      provides: "Co-migração dos testes 18/18b (gate relaxado) + novos testes multi-imagem/identidade/erros — imagens.edit recebe array quando há referências"
      contains: "images.edit"
  key_links:
    - from: "src/lib/image-generation/providers/openai.ts (generateImage, call sites ~L59 e ~L182)"
      to: "fallbackToImageApi"
      via: "canUseEditFallback(input) — primary presente (qualquer contagem de imagens) habilita o fallback"
      pattern: "canUseEditFallback"
    - from: "fallbackToImageApi"
      to: "openai.images.edit"
      via: "image: File | File[] montado em ordem [primary, aux..., identity]"
      pattern: "images.edit"
---

<objective>
Corrigir a qualidade do fallback de geração de imagem do OpenAI: hoje, quando o caminho primário
(Responses API) falha e o pipeline cai no fallback `images.edit`, a chamada envia APENAS a imagem
principal do produto — as referências auxiliares e a assinatura visual da loja (`identityImageUrl`)
são descartadas, permitindo que a arte entregue distorça a identidade visual da loja (bug observado
em produção: `provider error ... message=terminated` → fallback com assinatura visual adulterada).

A causa raiz é uma premissa falsa registrada no F41 D7: *"`images.edit` aceita apenas 1 base image"*
(`openai.ts:300-305` TODO). Verificada no SDK instalado (`openai@^6.39.0`, em
`node_modules/openai/resources/images.d.ts:435-447`):

> `image: Uploadable | Array<Uploadable>` — "For the GPT image models (… `gpt-image-2`, …), each
> image should be a png, webp, or jpg file less than 50MB. You can provide up to 16 images."

Ou seja: o SDK e o modelo do fallback (`IMAGE_EDIT_FALLBACK_MODEL`, default `gpt-image-2`) SUPORTAM
múltiplas imagens de entrada no `images.edit`. A restrição que motivou o gate "SÓ com primary única"
não existe mais — a correção é **ENVIAR** as referências (decisão envio-multi, não bloqueio).

Purpose: restaurar a fidelidade do fallback ao caminho primário — prompt completo já existente +
imagem principal do produto (base) + imagens adicionais do produto (`productImagesDataUrls`) +
identidade visual da loja (`identityImageUrl`) — mantendo simplicidade e toque cirúrgico.

Limites (NÃO alterar — MQJ-NO-SURFACE-REGRESSION): prompts (`prompts/*.md`), UI/form
(`use-campaign-form.ts`), schema público (`image-generation/schema.ts`), contrato HTTP
(`body.*`), domínio/snapshot (`brief.ts`, mapper, `mediaImagesDataUrls`), revisor de imagem
(`image-review-service.ts`), config (`config.ts`), factory e demais providers. Sem refatoração
ampla, sem provider novo. O F41 D7 segue como documentação histórica arquivada (não editar o
openspec arquivado) — o SUMMARY registra a supersessão da premissa pelo SDK.

Output: `openai.ts` com fallback multi-referência (primary + auxiliares + identity, ordem
determinística), gate relaxado para "exige primary" e log operacional mínimo; `openai-provider.test.ts`
co-migrado + novos testes. Aceite mapeado 1:1 aos critérios do pedido (AC1→escalar single, AC2→
identidade enviada ou bloqueio explícito, AC3→todas as referências com primary preservada, AC4→
testes do array no `images.edit`, AC5→nenhuma mudança nas superfícies).
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/image-generation/providers/openai.ts
@src/lib/image-generation/providers/__tests__/openai-provider.test.ts
@src/lib/image-generation/config.ts
@src/lib/image-generation/providers/types.ts

# Investigação (pontos exatos de alteração)

- `src/lib/image-generation/providers/openai.ts` — TODA a mudança de produção fica neste arquivo:
  - **Gate 1 (pre-response, `attempt >= 1`):** L58-61 — `if (attempt >= 1 && this.isSinglePrimary(input)) return this.fallbackToImageApi(...)`. É o caminho que o bug de produção percorreu (retry `attempt>=1` pula direto pro fallback, sem checar tipo de erro).
  - **Gate 2 (pós-erro):** L180-187 — `if (this.isSinglePrimary(input) && this.isResponsesApiError(err)) return this.fallbackToImageApi(...)`.
  - **`isSinglePrimary`:** L195-204 — implementa a política F41 D7 ("SÓ com primary única"); será substituída por `canUseEditFallback` (exige primary, aceita qualquer contagem — a premissa de 1 imagem caiu).
  - **`fallbackToImageApi`:** L239-325 — resolve a primary (L246-248: `input.productImageDataUrl ?? input.productImagesDataUrls?.[0]`), valida dataUrl (L250-258), converte `toFile` (L260-277), **busca `identityFile` mas NUNCA envia** (L279-295), chama `images.edit` com `image: imageFile` só (L306-312). O TODO L300-305 documenta a limitação que não existe mais — REMOVER.
  - Nota: o fetch da identidade JÁ lança erro explícito PT-BR (L290-294: "Falha ao carregar imagem de identidade para a geração de fallback. Tente novamente.") — a semântica "identidade é essencial, sem ela bloqueia" já é a intenção do código; com o envio multi ela passa a fazer sentido (antes o arquivo era buscado e descartado).
- Shape real de produção (service `image-generation-service.ts:397` + `generateWithRetry` L1102-1110): o `ImageProviderInput` chega com **AMBOS** `productImageDataUrl` (= `mediaImagesDataUrls(brief)[0]`, a primary) E `productImagesDataUrls` (lista ordenada completa, primary na posição 0) E `identityImageUrl` (`context.identity.imageUrl`). Deduplicação necessária: quando `productImageDataUrl === productImagesDataUrls[0]`, não enviar a primary duas vezes (iterar auxiliares a partir do índice 1).
- Capacidade: `MAX_CAMPAIGN_IMAGES = 4` (1 primary + 3 auxiliares) + 1 identity = máx. 5 arquivos — muito abaixo do teto de 16 do SDK. Nenhum guard de teto necessário; o log operacional expõe a contagem.
- `config.ts:12-13`: `IMAGE_EDIT_FALLBACK_MODEL = process.env.IMAGE_EDIT_FALLBACK_MODEL || GPT_IMAGE_MODEL` e `GPT_IMAGE_MODEL = process.env.GPT_IMAGE_MODEL || "gpt-image-2"` — modelo do fallback é um GPT image model (suporta multi-imagem).

<interfaces>
<!-- Contratos existentes que o executor NÃO deve renegociar -->

From src/lib/image-generation/providers/types.ts (NÃO alterar):
export interface ImageProviderInput {
  prompt: string;
  productImageDataUrl?: string;
  /** F41 D7: lista ordenada de dataUrls das imagens do produto; posição 0 = primary. */
  productImagesDataUrls?: string[];
  identityImageUrl?: string;
  size?: "1024x1024" | "2048x2048";
  quality?: "low" | "medium" | "high" | "auto";
  signal?: AbortSignal;
  attempt?: number;
}

From node_modules/openai/resources/images.d.ts:435-447 (SDK real instalado, openai@^6.39.0):
export interface ImageEditParamsBase {
  image: Uploadable | Array<Uploadable>;
  prompt: string;
  // ... model?: (string & {}) | ImageModel | null; size?: ...; n?: number | null; ...
}
// Doc do campo image: "For the GPT image models (gpt-image-1, gpt-image-1-mini, gpt-image-1.5,
// gpt-image-2, gpt-image-2-2026-04-21, chatgpt-image-latest): ... up to 16 images."
// → image: File[] é VÁLIDO no contrato do SDK. Envio-multi, sem bloqueio.

From src/lib/image-generation/providers/openai.ts (estado atual a substituir):
private isSinglePrimary(input: ImageProviderInput): boolean {
  return input.productImagesDataUrls
    ? input.productImagesDataUrls.length === 1
    : Boolean(input.productImageDataUrl);
}
// chamado em L59 (pre-response, attempt>=1) e L182 (pós-erro isResponsesApiError)

private async fallbackToImageApi(openai: any, input: ImageProviderInput, size: string): Promise<ImageProviderOutput> {
  // L246-248: const productImageDataUrl = input.productImageDataUrl ?? input.productImagesDataUrls?.[0];
  // L250-258: dataUrlMatch com /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i → senão throw "Invalid productImageDataUrl. Expected data:image/png|jpeg|webp;base64,..."
  // L260-277: mimeType/extension → const imageFile = await toFile(imageBuffer, `product.${extension}`, { type: mimeType });
  // L279-295: se input.identityImageUrl → fetch → identityFile = toFile(buffer, 'identity.png', { type: 'image/png' }); fetch falha → throw PT-BR (NÃO mudar a mensagem)
  // L306-312: openai.images.edit({ model: this.editFallbackModel, image: imageFile, prompt: input.prompt, size: "1024x1024", n: 1 }, { signal: input.signal });
}

From src/lib/image-generation/providers/__tests__/openai-provider.test.ts (estado atual):
// vi.mock('openai') com default class { responses={create}, images={edit} } e toFile mock
// que retorna { buffer, filename, ...options } — asserts usam mockImagesEdit.mock.calls[0][0]
// (body) e [1] ({ signal }). Nomes de testes numerados 17/18/18b/19/19b (F41 D7).
// Teste 18 (L104): 2+ itens + attempt>=1 → edit NÃO chamado. Teste 18b (L121): ambos campos +
// isResponsesApiError → edit NÃO chamado. AMBOS INVERTEM com o gate relaxado.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fallback multi-referência no openai.ts (primary + auxiliares + identity, ordem determinística, gate relaxado, log operacional mínimo) — MQJ-FALLBACK-REFS / MQJ-IDENTITY-SENT / MQJ-FALLBACK-MULTI-SDK</name>
  <files>src/lib/image-generation/providers/openai.ts</files>
  <action>
    **A) Gate — substituir `isSinglePrimary` por `canUseEditFallback` (L195-204):**
    Renomear o método e trocar a condição de `length === 1` para exigir APENAS a existência de primary:
    ```ts
    private canUseEditFallback(input: ImageProviderInput): boolean {
      return Boolean(input.productImageDataUrl) || (input.productImagesDataUrls?.length ?? 0) >= 1;
    }
    ```
    Novo JSDoc (bloco comentado acima do método), em PT-BR: o gate F41 D7 restringia o fallback a
    "SÓ com primary única (1 imagem)" porque `images.edit` era considerado limitado a 1 base image
    (TODO em openai.ts:300-305). Verificado no SDK `openai@^6.39.0` — `ImageEditParamsBase.image:
    Uploadable | Array<Uploadable>` com até 16 imagens para os GPT image models (incl. gpt-image-2,
    modelo do fallback): a premissa não existe mais; o fallback agora envia TODAS as referências e
    não degrada fidelidade. O gate permanece apenas como "sem primary → fallback NÃO usado" (input
    sem imagem de produto segue no caminho Responses, comportamento inalterado).

    **B) Call sites — atualizar os DOIS usos (L58-61 pre-response e L180-187 pós-erro):**
    Trocar `this.isSinglePrimary(input)` por `this.canUseEditFallback(input)` nos dois lugares.
    Atualizar os comentários inline: pre-response (L58) → "attempt 1+ → skip to Image API edit
    fallback (quando há primary — gate relaxado MQJ; F41 D7 premisa de 1 imagem superada pelo SDK
    v6.39 multi-image)"; pós-erro (L181) → "Fallback to Image API edit when a product primary is
    available" (manter o `isResponsesApiError` como está — erro de auth/quota/rate-limit continua
    propagando sem fallback).

    **C) Comentário de topo da classe (L16-21):** ajustar o parágrafo do fallback para refletir que
    ele envia primary + referências auxiliares + identidade visual quando disponíveis (remover a
    noção implícita de "apenas product image"). Sem mudança de modelo/constantes.

    **D) `fallbackToImageApi` (L239-325) — montar lista ordenada de arquivos e enviar:**
    1. Extrair a conversão dataUrl→File (lógica atual de L250-277) para um helper privado reutilizável
       (module-scope ou método privado — escolha local simples): `parseEditImageDataUrl(dataUrl:
       string): { mimeType, extension, buffer }` validando com a MESMA regex
       `/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i` e lançando erro explícito quando não casa.
    2. Resolver a primary como hoje (L246-248: `input.productImageDataUrl ?? input.productImagesDataUrls?.[0]`);
       se a primary não for válida, manter EXATAMENTE a mensagem atual
       `"Invalid productImageDataUrl. Expected data:image/png|jpeg|webp;base64,..."`.
    3. Montar `files` (evitar anotação explícita `File[]` se o TS reclamar — inferir pelo retorno de
       `toFile` ou usar um tipo local derivado; NÃO importar/alterar interfaces nem globals):
       `const files = [primaryFile];` (primary na posição 0 = base do edit — SEMPRE a primeira).
    4. Se `input.productImagesDataUrls` tiver comprimento > 1: iterar os itens a partir do índice 1
       (posição 0 é a primary). Pular item quando for EXATAMENTE igual a `productImageDataUrl` já
       enviado (dedupe do shape de produção em que o service envia `productImageDataUrl ===
       productImagesDataUrls[0]`). Para cada auxiliar: converter via helper; se inválida → lançar
       erro explícito (invariante violada — validação upstream garante png|jpeg|webp; NUNCA descartar
       silenciosamente uma referência, princípio do D7): mensagem
       `"Invalid product reference image data URL. Expected data:image/png|jpeg|webp;base64,..."`.
       Nomear o arquivo `reference-<índice>.<ext>` (ex.: `reference-1.webp`). Formato suportado do
       SDK: png|jpeg|webp.
    5. Identidade (manter o fetch existente L279-295 INTACTO na lógica): quando
       `input.identityImageUrl` presente e fetch OK → `identityFile` (nome `identity.png`, type
       `image/png`); fetch falha → o throw PT-BR existente ("Falha ao carregar imagem de
       identidade para a geração de fallback. Tente novamente.") é o bloqueio explícito do AC2
       (sem identidade não há arte). Quando o fetch OK → APPENDAR `identityFile` POR ÚLTIMO em `files`.
     6. REMOVER o bloco TODO (L300-305) — a limitação documentada não existe no SDK v6.39.
     7. Log operacional mínimo — NÃO é telemetria: apenas `console.error` (padrão do arquivo),
        sem métricas/eventos/custo e sem puxar `route`, metrics writer ou service para o escopo.
        Imediatamente antes da chamada, logar:
       `console.error('[OpenAIImageProvider] images.edit fallback — model=' + this.editFallbackModel + ', images=' + files.length + ', identityIncluded=' + identityIncluded + ', promptChars=' + input.prompt.length);`
       com `identityIncluded = Boolean(identityFile)` calculado no escopo.
    8. Chamada final — preservar `model`, `prompt: input.prompt` (prompt completo já existente, NÃO
       alterar), `size: "1024x1024"` (conservador atual), `n: 1` e o 2º argumento `{ signal:
       input.signal }`:
       `openai.images.edit({ model: this.editFallbackModel, image: files.length === 1 ? files[0] : files, prompt: input.prompt, size: imageApiSize, n: 1 }, { signal: input.signal })`
       — 1 imagem → escalar (wire format atual byte a byte); 2+ → array na ordem determinística
       [primary, auxiliares..., identity?]. NÃO adicionar `quality`/`background`/`input_fidelity`
       (fora do escopo — sem mudança de parâmetros além de `image`).
    9. Retorno inalterado (L314-324): `imageBase64 = response.data?.[0]?.b64_json`, throw
       "Image API returned no image data" se vazio, retorno `{ imageBase64, mimeType: "image/png",
       model: this.editFallbackModel }`.

    Não alterar: imports existentes, `generateImage` principal (Responses path L48-193), `config`,
    `types.ts`, prompts, service, revisor, factory.
  </action>
  <verify>
    <automated>npm run typecheck; npx vitest run src/lib/image-generation/providers/__tests__/openai-provider.test.ts --reporter=verbose</automated>
  </verify>
  <done>
    - `isSinglePrimary` substituída por `canUseEditFallback` (exige primary; qualquer contagem de imagens) e usada nos 2 call sites
    - `fallbackToImageApi` monta `files` ordenado [primary, auxiliares..., identity?] com dedupe primary==lista[0]; 1 imagem → escalar; 2+ → array; identity por último; mensagens de erro explícitas preservadas/nova para auxiliar inválida; TODO removido
    - Log operacional mínimo (console.error, sem telemetria/métricas) antes do `images.edit` com model/images/identityIncluded; prompt, size (1024x1024), n:1 e signal inalterados
    - `npm run typecheck` limpo; suíte do provider com EXATAMENTE 2 falhas esperadas (Teste 18 e Teste 18b — invertem por design e são co-migrados na Task 2); testes 1/19/19b verdes
  </done>
</task>

<task type="auto">
  <name>Task 2: Co-migração dos testes 18/18b + novos testes multi-imagem/identidade/erros no openai-provider.test.ts — MQJ-FALLBACK-MULTI-SDK / MQJ-IDENTITY-SENT / MQJ-NO-SURFACE-REGRESSION</name>
  <files>src/lib/image-generation/providers/__tests__/openai-provider.test.ts</files>
  <action>
    Editar SOMENTE `src/lib/image-generation/providers/__tests__/openai-provider.test.ts` (mock de
    `openai` e `toFile` já existentes: `toFile(buffer, filename, options)` retorna
    `{ buffer, filename, ...options }` — asserts de arquivo usam `.filename` e `.type`).

    **Higiene de fetch (global):** adicionar `const originalFetch = global.fetch;` no escopo do
    describe e restaurar em `afterEach` (`global.fetch = originalFetch;`) para o mock de fetch não
    vazar entre testes.

    **Teste 1 (L34-51) — reforçar para o AC2:** input atual (productImageDataUrl + identityImageUrl +
    attempt 1). Mockar `global.fetch` OK (como hoje). Trocar o `mockImagesEdit.mockRejectedValue`
    por `mockResolvedValue({ data: [{ b64_json: 'base64-result' }] })`; renomear para refletir a
    nova semântica (ex.: "attempt >= 1 com productImageDataUrl + identityImageUrl → fallback envia
    product + identity ao images.edit") e adicionar asserts:
    - resultado: `result.imageBase64 === 'base64-result'` e `result.model === 'test-fallback-model'`;
    - `global.fetch` chamado 1x com `identityImageUrl`;
    - `body = mockImagesEdit.mock.calls[0][0]`: `Array.isArray(body.image) === true`,
      `body.image.length === 2`, `body.image[0].filename === 'product.png'`,
      `body.image[1].filename === 'identity.png'`, `body.prompt === input.prompt`,
      `body.model === 'test-fallback-model'`.

    **Teste 18 (L104-119) — INVERTE (gate relaxado):** input com `productImagesDataUrls: [primary,
    aux1]` + attempt 1. Novo comportamento: `images.edit` É chamado com array dos 2 produtos.
    Renomear (ex.: "18: productImagesDataUrls com 2+ itens + attempt>=1 → fallback envia TODAS as
    imagens (primary + auxiliar) ao images.edit"). `mockImagesEdit.mockResolvedValue({ data:
    [{ b64_json: 'base64-result' }] })`; asserts: `body.image.length === 2`,
    `body.image[0].filename === 'product.png'`, `body.image[1].filename === 'reference-1.png'`,
    `body.prompt === input.prompt`; `result.imageBase64 === 'base64-result'`. Remover o
    `mockResponsesCreate.mockRejectedValue` desnecessário (o pre-response gate nem chama responses)
    ou mantê-lo como rede de segurança — assert de que `responses.create` NÃO foi chamado é
    opcional; preferir assert positivo no edit.

    **Teste 18b (L121-142) — INVERTE (gate 2 relaxado):** input com AMBOS os campos
    (productImageDataUrl === productImagesDataUrls[0], shape real de produção) + attempt 0 + erro
    `isResponsesApiError` no responses.create (`model_not_found: ...`). Novo comportamento: o CATCH
    (gate 2) chama `images.edit` com a lista deduplicada (primary não duplicada). Asserts:
    `body.image.length === 2`, `body.image[0].filename === 'product.png'`,
    `body.image[1].filename === 'reference-1.png'` (sem terceiro arquivo duplicado da primary);
    atualizar o comentário explicativo (L123-126) para a nova semântica (a dedupe evita enviar a
    primary 2x quando `productImageDataUrl === lista[0]`).

    **Teste 19 (L144-154) — mantém (AC1), reforçar:** legado (só productImageDataUrl) + attempt 1 →
    edit chamado 1x e `Array.isArray(body.image) === false` (escalar preservado),
    `body.image.filename === 'product.png'`. Manter o reject ('edit failed') ou resolver — asserts
    de args funcionam nos dois casos; preferir resolver e assertar resultado + shape.

    **Teste 19b (L156-166) — mantém (AC1):** `productImagesDataUrls: [primary]` sem legacy + attempt
    1 → edit chamado 1x, `body.image` escalar com `filename === 'product.png'` (resolve a primary da
    lista, sem "Invalid productImageDataUrl").

    **Novos testes (adicionar no describe F41/fallback):**
    1. **Multi-referência completa (AC3):** `productImagesDataUrls: [primary, aux1(webp), aux2(png)]`
       + `identityImageUrl` + attempt 1, fetch da identidade OK →
       `body.image.length === 4`; ordem exata `['product.png', 'reference-1.webp',
       'reference-2.png', 'identity.png']`; `body.prompt` intacto; result.ok.
    2. **Fetch da identidade falha → bloqueio explícito (AC2):** productImageDataUrl + identityImageUrl
       + attempt 1, `global.fetch` OK=false (ou reject) → `rejects.toThrow('Falha ao carregar imagem
       de identidade para a geração de fallback')` e `mockImagesEdit` NÃO chamado (nunca gera arte
       sem a assinatura visual).
    3. **Auxiliar malformada → erro explícito, sem descarte silencioso:** `productImagesDataUrls:
       [primary, 'data:image/gif;base64,xxx']` (mime fora do suportado) + attempt 1 →
       `rejects.toThrow('Invalid product reference image data URL')` e `mockImagesEdit` NÃO chamado.
    4. **Primary inválida (sem lista):** `productImageDataUrl: 'data:image/gif;base64,xxx'` + attempt 1
       → `rejects.toThrow('Invalid productImageDataUrl. Expected data:image/png|jpeg|webp;base64,...')`
       (regressão da mensagem existente do fallback).

    **Regressão das superfícies intocadas (MQJ-NO-SURFACE-REGRESSION):** NÃO editar
    `image-generation-service.ts`/seus testes, `schema.ts`, `brief.ts`, `config.ts`,
    `image-review-service.ts`, prompts ou rotas. Rodar a pasta `src/lib/image-generation` inteira
    para provar que nada além do provider mudou de comportamento.
  </action>
  <verify>
    <automated>npx vitest run src/lib/image-generation/providers/__tests__/openai-provider.test.ts --reporter=verbose; npx vitest run src/lib/image-generation; npm run typecheck</automated>
  </verify>
  <done>
    - Testes 18/18b co-migrados para a nova política (edit chamado com array quando há 2+ produtos; 18b cobre a dedupe do shape real de produção); Testes 1/19/19b reforçados com asserts de shape do `body.image`
    - Novos testes verdes: multi-referência completa (4 arquivos na ordem determinística), bloqueio por fetch de identidade falho, auxiliar malformada bloqueada, primary inválida com mensagem preservada
    - `openai-provider.test.ts` inteiro verde; `src/lib/image-generation` verde (regressão de service/rota/schema/reviewer SEM edição); `npm run typecheck` limpo
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| provider (openai.ts) → OpenAI Images API | Data URLs de produto/identidade (validadas upstream) cruzam o `images.edit` multipart; mudança só amplia QUANTAS imagens o fallback envia (mesmas imagens já enviadas ao Responses path) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-MQJ-01 | Spoofing | fallbackToImageApi (montagem de `files`) | mitigate | Ordem determinística [primary, aux..., identity] com primary SEMPRE na posição 0 (base do edit); auxiliares validadas pela MESMA regex png/jpeg/webp do caminho primário; identidade buscada de `identityImageUrl` validada upstream (`validateIdentityReference`) — sem nova superfície de input |
| T-MQJ-02 | Tampering | dedupe primary × lista | mitigate | Comparação por igualdade exata de dataUrl com `productImageDataUrl` já enviado — nunca envia a primary duplicada (shape real: `productImageDataUrl === productImagesDataUrls[0]`); teste 18b trava a invariante |
| T-MQJ-03 | Denial of service | payload do images.edit | mitigate | Teto natural de 5 arquivos (MAX_CAMPAIGN_IMAGES=4 + 1 identity) muito abaixo do limite de 16 do SDK; sem guard adicional; log operacional expõe `images=<n>` para observabilidade |
| T-MQJ-04 | Information disclosure | identidade da loja em arquivo enviado ao fallback | accept | Mesma imagem de identidade já enviada ao caminho primário (Responses path, `detail: low`) — sem aumento de superfície; o fallback é o mesmo provedor/API key |
| T-MQJ-05 | Tampering | bloqueio vs degradação da identidade | mitigate | Fetch da identidade falho → throw PT-BR existente mantido (nunca gera arte sem assinatura visual); AC2 coberto por teste (images.edit não chamado) |
| T-MQJ-06 | Tampering | npm/pip/cargo installs | accept | Nenhuma instalação de pacote neste plano (sem package-legacy gate aplicável) |
</threat_model>

<verification>
- Gate: `Select-String -Path "src/lib/image-generation/providers/openai.ts" -Pattern "isSinglePrimary"` → 0 (removido); `-Pattern "canUseEditFallback"` → ≥ 3 ocorrências (definição + 2 call sites)
- Fallback: `Select-String -Path "src/lib/image-generation/providers/openai.ts" -Pattern "identityIncluded|images.edit fallback"` → presentes; TODO "aceita apenas uma imagem" removido (0 ocorrências de "aceita apenas uma imagem como base")
- Shape do envio coberto por teste: `images.edit` com `image` escalar (AC1) e com array de 2-4 na ordem [primary, aux..., identity] (AC2/AC3); bloqueio explícito quando identidade não carrega (AC2) — tudo em `openai-provider.test.ts`
- Superfícies intocadas: `git diff --stat` limita mudanças a `src/lib/image-generation/providers/openai.ts` e `openai-provider.test.ts`; suíte `src/lib/image-generation` verde sem edição de service/schema/domínio/reviewer/prompts
- Gates: `npm run typecheck` exit 0; `npx vitest run src/lib/image-generation` verde
</verification>

<success_criteria>
- Fallback com apenas imagem de produto continua funcionando com o wire format atual (escalar) — AC1
- Fallback com `identityImageUrl` envia a identidade visual JUNTO (array de 2) ou bloqueia explicitamente se a identidade não puder ser carregada — nunca gera arte sem assinatura visual — AC2
- Fallback com `productImagesDataUrls` envia TODAS as referências suportadas, preservando a primeira como primary (base) — AC3
- Testes provam que `images.edit` recebe >1 imagem quando há identidade/referências (decisão envio-multi, SDK `openai@^6.39.0` suporta `image: Uploadable | Array<Uploadable>` até 16 imagens para GPT image models) — AC4
- Nenhuma mudança em prompt, UI, schema público, contrato HTTP, domínio/snapshot ou revisor — AC5 (suítes dessas superfícies verdes sem edição; `git diff` restrito a 2 arquivos)
- Gate do fallback exige apenas primary presente; sem primary o fallback não é usado (comportamento sem-imagem inalterado)
- Log operacional mínimo no fallback (console.error, sem sistema de telemetria): modelo, contagem de imagens e flag de identidade
- F41 D7 permanece como spec arquivada (não editada); a supersessão da premissa pelo SDK é registrada no SUMMARY
</success_criteria>

<output>
Create `.planning/quick/260902-mqj-fix-openai-image-fallback-quality-preser/260902-mqj-SUMMARY.md` when done
</output>
