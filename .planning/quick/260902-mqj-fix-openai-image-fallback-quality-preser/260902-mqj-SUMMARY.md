---
phase: 260902-mqj-openai-fallback-preserva-referencias
plan: 01
subsystem: image-generation
tags:
  - fallback-images-edit
  - envio-multi-imagem
  - identidade-visual
  - provider-openai
dependency_graph:
  requires: []
  provides:
    - "openai.ts fallback envia primary + auxiliares + identity ao images.edit (gate relaxado para 'exige primary')"
  affects:
    - "OpenAIImageProvider.generateImage (caminho de retry/fallback pós-erro)"
    - "openai-provider.test.ts (co-migração 18/18b + novos testes 20-23)"
tech-stack:
  added:
    - "openai@^6.39.0 SDK multi-image: image: Uploadable | Array<Uploadable> no images.edit (até 16 imagens)"
  patterns:
    - "helper module-scope parseEditImageDataUrl (regex única png|jpeg|webp, mensagem de erro parametrizada)"
    - "array determinístico [primary, auxiliares..., identity?] + dedupe primary==lista[0] + 1 imagem → escalar"
key-files:
  created: []
  modified:
    - src/lib/image-generation/providers/openai.ts
    - src/lib/image-generation/providers/__tests__/openai-provider.test.ts
decisions:
  - "Envio-multi (não bloqueio): images.edit recebe TODAS as referências (decisão supera a premissa F41 D7 de '1 base image', verificada no SDK v6.39 — ImageEditParamsBase.image: Uploadable | Array<Uploadable>)"
  - "Gate relaxado canUseEditFallback exige apenas primary presente; sem primary o fallback não é usado (comportamento sem-imagem inalterado)"
  - "Identidade é essencial: fetch falho bloqueia com o erro PT-BR existente (nunca gera arte sem assinatura visual); fetch OK → identity por último no array"
  - "Wire format preservado: 1 imagem → escalar (byte a byte igual ao atual); 2+ → array determinístico; nenhum parâmetro novo (prompt/size/n/signal inalterados)"
  - "Log operacional mínimo via console.error (sem telemetria/métricas): model, images=<n>, identityIncluded, promptChars"
metrics:
  duration: "~7 min"
  completed_date: "2026-09-02"
---

# Phase [260902-mqj] Plan [01]: Fallback OpenAI preserva referências (primary + auxiliares + identity) no images.edit

**One-liner:** Fallback `images.edit` do OpenAI agora envia todas as referências disponíveis em ordem determinística — primary (base) + auxiliares de `productImagesDataUrls` + identidade visual (`identityImageUrl`) — em vez de descartá-las, restaurando a fidelidade ao caminho primário.

**Commits:**
- `3e01c325` — feat(image-generation): fallback images.edit envia referencias multi-imagem (primary + auxiliares + identity) no provider (quick-260902-mqj)
- `7df02e0e` — test(image-generation): co-migra testes 18/18b + novos testes multi-imagem/identidade/erros do fallback (quick-260902-mqj)

**TDD Gate Compliance:** N/A — plano `type: execute` (não tdd), sem fase RED dedicada; co-migração de testes acompanhou a mudança de código.

## Result

Bug de produção corrigido: quando o caminho Responses falha (`provider error ... message=terminated`) e o pipeline cai no fallback `images.edit`, a arte NÃO degrada mais a identidade visual da loja. A causa raiz era a premissa falsa registrada no F41 D7 ("`images.edit` aceita apenas 1 base image", TODO em `openai.ts:300-305`) — verificada no SDK instalado (`openai@^6.39.0`, `node_modules/openai/resources/images.d.ts:435-447`): `image: Uploadable | Array<Uploadable>` com até 16 imagens para os GPT image models (incl. `gpt-image-2`, o modelo do fallback). A correção é envio-multi, não bloqueio.

### Gate (Task 1)

`isSinglePrimary` (exigia `length === 1`) substituída por `canUseEditFallback` (exige apenas a existência de primary) nos 2 call sites:
- **Gate 1 pre-response** (`attempt >= 1`): retry pula direto pro fallback quando há primary.
- **Gate 2 pós-erro**: CATCH com `isResponsesApiError` (auth/quota/rate-limit continuam propagando sem fallback).

### Montagem do envio (Task 1)

`fallbackToImageApi` agora monta `files` em ordem determinística `[primary, auxiliares..., identity?]`:
1. **Primary** resolvida como antes (`productImageDataUrl ?? productImagesDataUrls?.[0]`), SEMPRE na posição 0 (base do edit); mensagem de erro atual preservada (`Invalid productImageDataUrl. ...`).
2. **Auxiliares** de `productImagesDataUrls` a partir do índice 1, com **dedupe por igualdade exata** contra a primary já enviada (shape real de produção: service envia `productImageDataUrl === productImagesDataUrls[0]`) — a primary nunca entra 2x. Auxiliar inválida → erro explícito `Invalid product reference image data URL. ...` (invariante violada nunca é descartada silenciosamente). Nome: `reference-<índice>.<ext>`.
3. **Identidade**: fetch existente preservado — falha → bloqueio com o erro PT-BR existente (`Falha ao carregar imagem de identidade...`); OK → `identityFile` apenda POR ÚLTIMO.
4. **TODO removido** (a limitação documentada não existe no SDK v6.39).
5. **Log operacional mínimo** (`console.error`, sem telemetria): `[OpenAIImageProvider] images.edit fallback — model=..., images=<n>, identityIncluded=<bool>, promptChars=<n>`.
6. Chamada final: `image: files.length === 1 ? files[0] : files` — 1 imagem → escalar (wire format atual); 2+ → array. Prompt/size (`1024x1024`)/n(1)/signal inalterados. Retorno inalterado.

Helper novo module-scope `parseEditImageDataUrl(dataUrl, invalidMessage)` reutiliza a MESMA regex png|jpeg|webp do caminho primário.

### Testes (Task 2)

- **Teste 1 reforçado (AC2)**: product + identity → `images.edit` com array de 2 (`product.png`, `identity.png`), fetch 1x na URL de identidade, resultado/model assertados.
- **Teste 18 INVERTE (gate relaxado)**: 2+ produtos + attempt 1 → edit chamado com array de 2 (`product.png`, `reference-1.png`).
- **Teste 18b INVERTE (gate 2 + dedupe)**: shape real de produção (ambos campos, `productImageDataUrl === lista[0]`) + erro `isResponsesApiError` → edit chamado com array deduplicado de 2 (sem primary duplicada).
- **Testes 19/19b mantidos (AC1)**: legado e `[primary]` → edit chamado com `image` ESCALAR (`filename === 'product.png'`).
- **Novos 20-23**: multi-referência completa (4 arquivos na ordem exata `['product.png','reference-1.webp','reference-2.png','identity.png']`, tipos preservados); fetch de identidade falho → bloqueio PT-BR e edit NÃO chamado; auxiliar malformada (gif) → erro explícito e edit NÃO chamado; primary inválida → mensagem existente preservada.
- **Higiene**: `originalFetch` capturado e restaurado em `afterEach` nos dois describes.

## Verification

| Gate | Resultado |
|------|-----------|
| `npm run typecheck` | Limpo (exit 0) |
| `npx vitest run .../openai-provider.test.ts` | 12/12 passed |
| `npx vitest run src/lib/image-generation` | 85/85 passed (5 files) — service/rota/schema/reviewer/prompts verdes SEM edição |
| `isSinglePrimary` em openai.ts | 0 ocorrências (removido) |
| `canUseEditFallback` em openai.ts | 3 ocorrências (definição + 2 call sites) |
| `identityIncluded` / log `images.edit fallback` | presentes |
| TODO "aceita apenas uma imagem como base" | 0 ocorrências |
| `git diff` escopo | restrito aos 2 arquivos do plano |

Task 1 deixou EXATAMENTE 2 falhas esperadas (Teste 18 e 18b — invertem por design, co-migrados na Task 2); demais testes verdes — não tratado como bloqueio, conforme instrução.

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito (2 arquivos tocados; superfícies intocadas verdes sem edição).

## Supersession da premissa F41 D7

O F41 D7 permanece como spec arquivada (não editada). A premissa *"`images.edit` aceita apenas 1 base image"* foi superada pelo SDK `openai@^6.39.0`: `ImageEditParamsBase.image: Uploadable | Array<Uploadable>` com até 16 imagens para os GPT image models (gpt-image-1, gpt-image-1-mini, gpt-image-1.5, gpt-image-2, gpt-image-2-2026-04-21, chatgpt-image-latest). O gate restrito a "SÓ com primary única" não existe mais; o fallback envia todas as referências.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum — superfície inalterada: as mesmas imagens já enviadas ao caminho primário (Responses path) agora cruzam o mesmo provedor/API key no `images.edit`; teto natural de 5 arquivos (MAX_CAMPAIGN_IMAGES=4 + 1 identity) muito abaixo do limite de 16 do SDK. Sem endpoint novo, sem schema novo, sem input novo.

## Self-Check: PASSED

- Commit `3e01c325` existe (`git log` confirmado).
- Commit `7df02e0e` existe (`git log` confirmado).
- Arquivos modificados existem: `src/lib/image-generation/providers/openai.ts` e `src/lib/image-generation/providers/__tests__/openai-provider.test.ts`.
- Caminho não relacionado `docs/alinhamento-fase-44-temas-de-campanhas` não tocado/não commitado.
