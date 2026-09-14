# Phase 47: Catálogo e Seleção de Modelos Admin — Research

**Researched:** 2026-09-14
**Domain:** catálogo persistido, resolução de modelos de IA e console administrativo Next.js/Supabase
**Confidence:** HIGH

> **Fonte de verdade:** os artefatos OpenSpec de `openspec/changes/fase-47-catalogo-e-selecao-de-modelos-admin/`. As recomendações abaixo não ampliam o escopo do change. Claims de implementação do repositório estão marcados com `[VERIFIED: codebase grep/read]`; decisões do OpenSpec com `[CITED: OpenSpec ...]`.

## User Constraints

- F47 é o Change B sucessor da fundação F46 e deve consumir o seam assíncrono `AiModelResolver`, sem refazer o gateway. `[CITED: OpenSpec F46 46-CONTEXT.md, decisões D1.1/D-trackings]`
- A seleção persistida é por capacidade; a UI agrupa em Texto, Visual e Imagem. Fallback genérico somente para `campaign_copy`; `campaign_image_edit` é capacidade primária independente. `[CITED: OpenSpec F47 design.md D2/D3]`
- O catálogo é somente leitura na UI; inclusão/depreciação ocorre por migration. Não há homologação automatizada ou chamadas pagas para candidatos nesta fase. `[CITED: OpenSpec F47 design.md decisões consolidadas 3 e 5]`
- Ordem obrigatória: migration local → UAT local → migration remota → deploy do código → ajuste de env-vars remotas somente se ainda existirem. `[CITED: OpenSpec F47 tasks.md linhas 3–5; design.md Migration Plan]`
- Geração mantém prompts, retry/timeout, telemetria e contratos externos; a mudança é apenas a origem da configuração consumida pelo gateway. `[CITED: OpenSpec F47 proposal.md linhas 17–18; design.md D11]`
- A migration remota é **BLOCKING** antes do deploy que lê a seleção. `[CITED: OpenSpec F47 proposal.md linhas 33–40; tasks.md 8.2–8.3]`

## Summary

F47 deve adicionar duas tabelas server-only: `ai_model_catalog`, que é a allowlist por tupla completa `capability + provider + model + protocol`, e `ai_model_selection`, que guarda a configuração efetiva por capacidade. A matriz inicial é explícita: 12 linhas, sendo 11 defaults primários da F46 mais o fallback Gemini de `campaign_copy`; não é produto cartesiano da allowlist. `[CITED: OpenSpec F47 design.md D1 e matriz inicial]`

O núcleo de runtime é `PersistedModelResolver`: ele decorará o `ModelRegistry`, carrega mapas bulk cacheados, aceita seleção válida inclusive `deprecated` ainda vigente, e cai silenciosamente no default do registry para ausência, erro, linha `missing`, parcial ou incompatível. O `AiGateway` não deve ser alterado. `[CITED: OpenSpec F47 design.md D6/D7; VERIFIED: src/lib/ai/model-resolver.ts, model-registry.ts, index.ts]`

A superfície admin é API `GET/PUT/DELETE /api/admin/ai-model-selection` e página `/admin/ai-model-selection`. RPCs SECURITY DEFINER fazem set/reset com motivo, auditoria atômica e idempotência. A tela expõe catálogo ativo, default/origem, status `active|deprecated|missing`, pricing faltante e restauração auditada. `[CITED: OpenSpec F47 specs/admin-ai-model-selection/spec.md; design.md D4/D5/D9]`

**Primary recommendation:** execute exatamente os oito planos do `tasks.md`, mantendo 47-01 como migration/local foundation, 47-02 como leitura/cache, 47-03 como único ponto de integração com o gateway, 47-04/05 como API/UI, 47-06 como enriquecimento de pricing, 47-07 como labels/regressão e 47-08 como UAT/deploy/fechamento.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Persistir catálogo e seleção | Database / Storage | API / Backend | RPCs e CHECKs garantem allowlist, atomicidade, auditoria e idempotência. `[CITED: OpenSpec F47 design.md D1/D4/D5]` |
| Resolver modelo efetivo | API / Backend | Database / Storage | `PersistedModelResolver` compõe seleção/cache com defaults; gateway continua dono da execução. `[VERIFIED: src/lib/ai/model-resolver.ts; CITED: OpenSpec F47 design.md D6]` |
| Executar IA e telemetria | API / Backend | — | F47 não muda `AiGateway`; só injeta outro resolver. `[VERIFIED: src/lib/ai/gateway.ts, index.ts; CITED: OpenSpec F47 design.md D11]` |
| API administrativa | API / Backend | Database / Storage | `apiHandler` + `requireAdmin` + Zod + RPC service-role são o padrão existente. `[VERIFIED: src/app/api/admin/ai-model-pricing/route.ts, feature-flags/route.ts]` |
| Tela Modelos de IA | Browser / Client | API / Backend | Form client-side envia set/reset à API; página server-side carrega dados e o layout já protege admin. `[VERIFIED: src/app/(app)/admin/layout.tsx, feature-flags/page.tsx/form.tsx]` |
| Consistência pricing × capacidade | API / Backend | Browser / Client | O cálculo depende de pricing vigente/bootstrap e dos componentes exigidos pela capacidade; a tela apenas sinaliza. `[CITED: OpenSpec F47 specs/ai-model-pricing/spec.md; VERIFIED: src/lib/ai-cost/ai-model-pricing.ts]` |

## Phase Requirements / OpenSpec Coverage

| OpenSpec capability | Implementação que o plano deve cobrir |
|---|---|
| `ai-model-catalog` | Tabela/RLS/seeds idempotentes, listagem server-only, status active/deprecated, catálogo somente leitura e paridade com os defaults. `[CITED: specs/ai-model-catalog/spec.md]` |
| `ai-model-selection` | Tabela/checks, RPC set/reset, auditoria/idempotência, cache bulk TTL 30s, invalidação e fallback fail-open. `[CITED: specs/ai-model-selection/spec.md; design.md D3–D6]` |
| `ai-model-registry` delta | `PersistedModelResolver` aceita modelos adicionais no catálogo quando o runtime suporta provider/protocolo, sem usar `MODEL_ALLOWLIST` para bloquear override aprovado. `[CITED: specs/ai-model-registry/spec.md]` |
| `ai-model-pricing` delta | Avisar pricing ausente por capacidade sem alterar `resolveAiCost` nem bloquear seleção. `[CITED: specs/ai-model-pricing/spec.md]` |
| `admin-ai-model-selection` | API, página, agrupamento, fallback exclusivo de `campaign_copy`, status, motivo, auditoria, reset e design system. `[CITED: specs/admin-ai-model-selection/spec.md]` |

## Standard Stack

### Core

| Library / padrão | Versão | Uso | Por que é padrão |
|---|---:|---|---|
| Next.js App Router | `^15.3.1` | página, route handlers e server/client split | Stack declarada do projeto e já usada pela área admin. `[VERIFIED: package.json; src/app/(app)/admin]` |
| TypeScript | `^5.8.3` | contratos `AiCapability`, DTOs e resolver | Gate obrigatório `npm run typecheck`. `[VERIFIED: package.json]` |
| Supabase JS | `^2.49.4` | `supabaseAdmin`, RPCs e consultas server-only | Padrão das APIs e serviços admin atuais. `[VERIFIED: package.json; src/app/api/admin/ai-model-pricing/route.ts]` |
| Supabase CLI | `2.104.0` via `npx` | migration local/remota conforme checkpoint | Versão local detectada; a CLI global é 2.75.0 e está desatualizada. `[VERIFIED: npx supabase --version; supabase --version]` |
| Zod | `^3.24.4` | schemas de PUT/DELETE e validação estrutural | Schemas admin existentes usam Zod e retornam 400. `[VERIFIED: package.json; src/lib/admin/schemas.ts]` |
| Vitest | `^4.1.9` | testes unitários, rota e componentes | Script `npx vitest run` é gate da fase. `[VERIFIED: package.json; F46-VERIFICATION.md]` |

### Supporting

| Padrão | Aplicação prescritiva |
|---|---|
| `apiHandler` + `requireAdmin` | Toda operação da API F47 deve seguir o padrão das rotas de pricing/feature flags. `[VERIFIED: src/app/api/admin/ai-model-pricing/route.ts, feature-flags/route.ts]` |
| `supabaseAdmin` + RPC SECURITY DEFINER | A API não faz update direto; chama RPC set/reset com `p_actor_id` e `p_operation_id`. `[CITED: OpenSpec F47 design.md D4/D5]` |
| `server-only` | Serviços de catálogo, seleção, resolver e pricing não devem ser importados pelo client. `[VERIFIED: src/lib/ai-cost/ai-model-pricing.ts; CITED: OpenSpec F47 design.md D6]` |
| Design system existente | Dark OLED, tokens, Lucide, sem emojis/light mode e touch targets ≥44px. `[CITED: openspec/design-system/MASTER.md; OpenSpec F47 proposal.md linha 42]` |

**Installation:** nenhuma dependência nova é prevista. `[CITED: OpenSpec F47 design.md Non-Goals; VERIFIED: package.json]`

## Package Legitimacy Audit

Nenhum pacote externo novo é recomendado ou instalado nesta fase; portanto não há pacote a auditar. A stack usa dependências já presentes no `package.json`. `[VERIFIED: package.json; CITED: OpenSpec F47 design.md Non-Goals]`

## Architecture Patterns

### Fluxo runtime

```text
Admin page -> GET /api/admin/ai-model-selection -> requireAdmin
                                      |-> bulk selection map + bulk catalog/pricing data
                                      v
                         persisted selection response + catalogStatus/pricing warnings

AI caller -> defaultAiGateway -> PersistedModelResolver
                                  | selection valid + catalog active/deprecated
                                  | selection absent/invalid/missing/error
                                  v
                         effective AiModelConfig OR F46 ModelRegistry default
                                  -> unchanged AiGateway -> adapter -> provider -> telemetry sink

Admin form -> PUT/DELETE API -> SECURITY DEFINER RPC -> selection + admin_audit_log atomically
                                      -> explicit cache invalidation -> next resolution sees change
```

### Estrutura recomendada

```text
supabase/migrations/
└── <timestamp>_f47_ai_model_catalog_selection.sql
src/lib/ai/
├── ai-model-catalog-service.ts
├── ai-model-selection-service.ts
├── persisted-model-resolver.ts
└── index.ts                         # composição; gateway.ts intacto
src/app/api/admin/ai-model-selection/
└── route.ts
src/app/(app)/admin/ai-model-selection/
├── page.tsx
└── form.tsx
```

Os nomes `ou equivalente` do proposal devem ser resolvidos mantendo uma única implementação por responsabilidade; não criar um resolver por request nem lookup por capacidade/invoke. `[CITED: OpenSpec F47 proposal.md linhas 37–40; design.md D6]`

### Padrão 1: resolver decorator fail-open

**Use:** `PersistedModelResolver` recebe `ModelRegistry`, `AiModelSelectionService` e `AiModelCatalogService`; `resolve(capability)` monta configuração completa ou retorna o default. `[CITED: OpenSpec F47 design.md D6/D7]`

**Invariantes:** primary completo; fallback completo ou ausente; fallback somente em `campaign_copy`; capability/segment/protocol suportados; primary e fallback diferentes por provider+model; `deprecated` vigente executável; `missing` não executável. `[CITED: OpenSpec F47 design.md D3/D6/D7]`

### Padrão 2: migration como autoridade do catálogo

Seed apenas as 12 linhas da matriz OpenSpec (11 primary + 1 fallback), com `provider='gemini'`; `ON CONFLICT` não altera linhas existentes. RPC set valida a tupla contra catálogo `active`; linhas `deprecated` não podem receber nova seleção. `[CITED: OpenSpec F47 design.md matriz inicial/D4; tasks.md 1.2–1.8]`

### Padrão 3: auditoria atômica

As RPCs devem usar `SECURITY DEFINER`, `SET search_path=''`, `REVOKE` de PUBLIC/anon/authenticated, `GRANT` a `service_role`, validar motivo/operação e atualizar a seleção junto com `admin_audit_log` na mesma transação. `[CITED: OpenSpec F47 design.md D4/D5/RPCs; VERIFIED: supabase/migrations/20260821000001_f43_create_feature_flags.sql]`

### Padrão 4: cache bulk compartilhado

Carregar no máximo dois mapas bulk por janela de 30s: seleções completas e combinações de catálogo necessárias, incluindo `deprecated` referenciadas. Não fazer consulta por capacidade durante `resolve` ou por invoke. Invalidação deve ocorrer após PUT/DELETE; se o mecanismo for apenas por instância, documentar a janela residual até TTL. `[CITED: OpenSpec F47 design.md D6, decisões consolidadas 4]`

## Don't Hand-Roll

| Problema | Não construir | Usar |
|---|---|---|
| Autorização admin | checagem ad hoc de `auth.users` ou client-side | `requireAdmin` no layout e em cada route handler. `[VERIFIED: src/app/(app)/admin/layout.tsx; src/app/api/admin/*/route.ts]` |
| Auditoria/idempotência | update/delete direto em Supabase | RPCs SECURITY DEFINER + `admin_audit_log`, com `operation_id`. `[CITED: OpenSpec F47 design.md D4/D5]` |
| Execução de IA | novo client/provider ou alteração do gateway | resolver injetado no `defaultAiGateway`; `gateway.ts` permanece intacto. `[CITED: OpenSpec F47 design.md D11; VERIFIED: src/lib/ai/index.ts]` |
| Pricing | nova cadeia de custo | `getModelPricing`/`resolveAiCost` e bootstrap existente; somente adicionar verificação de componentes. `[CITED: specs/ai-model-pricing/spec.md; VERIFIED: src/lib/ai-cost/ai-model-pricing.ts]` |
| Catálogo dinâmico de candidatos | produto cartesiano ou UI que cria modelos | matriz explícita em migration; UI somente leitura. `[CITED: specs/ai-model-catalog/spec.md]` |

## Migration and Deploy Ordering

1. **47-01:** criar migration e aplicar/testar somente localmente; validar reaplicação, RLS, CHECKs, seeds e RPCs. `[CITED: tasks.md 1.2–1.8]`
2. **47-02–47-07:** implementar código e UAT automatizado/local sobre o schema local. `[CITED: tasks.md introdução e 8.1]`
3. **47-08.2:** aplicar migration no remoto e confirmar sucesso. Este é checkpoint **BLOCKING**. `[CITED: tasks.md 8.2]`
4. **47-08.3:** somente depois fazer deploy do código que injeta o resolver persistido. `[CITED: design.md Migration Plan]`
5. **47-08.4:** conferir envs remotas apenas como verificação; F46 removeu envs de modelo/provider. `[CITED: tasks.md 8.4; VERIFIED: F46-VERIFICATION.md seção 1]`

O Supabase CLI está instalado via `npx`, mas `npx supabase status` falhou porque o Docker Desktop Linux engine não está disponível. `[VERIFIED: environment probe 2026-09-14]` Portanto, 47-01/47-08 precisam incluir checkpoint para iniciar Docker/Supabase local ou registrar explicitamente o bloqueio; não assumir que um teste SQL local já foi executado.

## Refined 8-Plan Breakdown and Dependencies

| Plan | Wave | Deve entregar | Dependências / orientação de arquivos |
|---|---:|---|---|
| 47-01 | 1 | tracking + uma migration F47 local com tabelas, RLS, 12 seeds, RPCs, CHECKs e testes SQL | precede todo código; atualizar os 5 tracking files sem reescrever histórico F46; migration depende do `admin_audit_log` existente e do padrão F43/F38. `[CITED: tasks.md 1.1–1.8; VERIFIED: supabase/migrations]` |
| 47-02 | 1 | `AiModelCatalogService`, `AiModelSelectionService`, bulk maps, TTL/invalidação, paridade registry×catalog | depende do schema local; `src/lib/ai/*`; não colocar `resolve` nos serviços. `[CITED: tasks.md 2.1–2.3]` |
| 47-03 | 2 | `PersistedModelResolver` e composição em `src/lib/ai/index.ts` | depende de 47-02; não editar `gateway.ts`; cobrir defaults, deprecated, missing, provider/protocol, fallback nulo. `[CITED: tasks.md 3.1–3.4; VERIFIED: src/lib/ai/index.ts]` |
| 47-04 | 2 | Zod, route GET/PUT/DELETE, labels de auditoria e testes HTTP | depende das RPCs e services; `GET` precisa calcular status por tupla completa e retornar pricing/catalog data sem N+1. `[CITED: tasks.md 4.1–4.4]` |
| 47-05 | 3 | página/form e nav admin | depende do contrato GET e API; página server-side + form client-side, agrupamento por segmento, `campaign_image_edit` independente, motivo/reset. `[CITED: tasks.md 5.1–5.6; VERIFIED: admin patterns]` |
| 47-06 | 3 | verificação pricing ciente da capacidade | pode usar API/service existente, sem alterar `resolveAiCost`; exigir tokens, tool e image unit conforme D8. `[CITED: tasks.md 6.1–6.2; specs/ai-model-pricing]` |
| 47-07 | 4 | labels efetivos em image generation, VS e benchmark + regressão/gates | depende do resolver integrado; alterar apenas rótulos diagnósticos identificados em `image-generation-service.ts`, `server-actions.ts`, `scripts/benchmark.ts`. `[CITED: tasks.md 7.1–7.6; VERIFIED: grep 2026-09-14]` |
| 47-08 | 5 | UAT local, migration remota, deploy, verificação, tracking/arquivamento preparado | depende de todos; UAT deve provar set/reset, fallback, deprecated, pricing, telemetria e labels; migration remota antes do deploy. `[CITED: tasks.md 8.1–8.7]` |

## Contradictions, Gaps, and Required Clarifications

### Confirmed divergences (não bloqueiam o escopo)

- `.planning/STATE.md` ainda identifica `current_phase: 46` e não contém um bloco F47; `.planning/ROADMAP.md` menciona F47 no cabeçalho, mas não tem detalhes/plans da fase. O `tasks.md` já exige corrigir os registros em 47-01/47-08. `[VERIFIED: .planning/STATE.md; .planning/ROADMAP.md; tasks.md 1.1/8.7]`
- O proposal chama os status de catálogo de `catalogStatus: active|deprecated|missing`, enquanto a tabela tem apenas `active|deprecated`; `missing` é status calculado da seleção efetiva, não valor persistido. O plano deve manter essa distinção. `[CITED: proposal.md linha 14; design.md D1/D6; specs/admin-ai-model-selection/spec.md]`
- A API GET deve devolver catálogo ativo, mas também precisa sinalizar seleção `deprecated` e `missing`; portanto não pode derivar status apenas do array de catálogo ativo. Deve consultar o mapa completo do catálogo necessário ou combinar a seleção com lookup em memória. `[CITED: tasks.md 2.1/4.2; design.md D6; specs/admin-ai-model-selection/spec.md cenários GET]`

### Ambiguidades que o planner deve resolver dentro do contrato (não inventar comportamento)

1. **Shape exato do DELETE e `operationId`:** specs exigem DELETE com capability/reason e tasks exigem idempotência por `operationId`, mas não fixam se o payload será JSON ou query string, nem se `operationId` é obrigatório na API. `[CITED: design.md D5; tasks.md 4.1–4.4; specs/admin-ai-model-selection/spec.md]` Prescrever um único shape consistente entre Zod, route, form e RPC; manter UUID gerado no client/server para retry seguro.
2. **Reset sem seleção:** D5 diz no-op sem mutação e sem auditoria, embora o texto geral fale em mesma garantia de auditoria/idempotência. A regra específica D5/linha 110 é a mais precisa: retornar sucesso/reset false sem inserir auditoria; testar esse caso. `[CITED: OpenSpec F47 design.md D5]`
3. **Pricing bulk:** o serviço existente resolve um modelo por consulta e retorna um único `ModelPricing`; F47 exige sinalização por capacidade e no máximo duas consultas de seleção/catálogo. O OpenSpec não fixa nome/contrato de uma leitura bulk de pricing. O planner deve definir um helper bulk/in-memory sem alterar `resolveAiCost`, evitando N+1 na página. `[VERIFIED: src/lib/ai-cost/ai-model-pricing.ts; CITED: specs/ai-model-pricing/spec.md]`
4. **“Cache compartilhado”:** o design permite mecanismo por instância com janela residual, mas não escolhe Redis/outro mecanismo. Não adicionar infraestrutura: implementar o cache compatível com o runtime atual e documentar TTL/invalidação por instância, salvo decisão humana posterior. `[CITED: design.md D6 e decisões consolidadas 4; AGENTS.md constraint de infraestrutura]`
5. **Labels diagnósticos:** o serviço de imagem usa `DEFAULT_IMAGE_MODEL` em vários logs/erros, enquanto o task exige alvo efetivo ou modelo retornado; para mensagens anteriores à chamada, o plano deve escolher resolver efetivo; para resultados, `result.model`. Não usar constante estática F46. `[VERIFIED: src/lib/image-generation/services/image-generation-service.ts linhas 39/162/396/421; CITED: design.md D10]`

## Common Pitfalls

### Pitfall 1: usar `MODEL_ALLOWLIST` como allowlist final

**Falha:** um modelo adicional aprovado por migration, com provider/protocolo suportado, cai no default indevidamente. **Prevenção:** catálogo é autoridade de combinações aprovadas; `MODEL_ALLOWLIST` valida apenas defaults F46. `[CITED: specs/ai-model-catalog/spec.md requisito autoridade; specs/ai-model-registry/spec.md]`

### Pitfall 2: tratar fallback de imagem como fallback genérico

**Falha:** oferecer fallback em `campaign_image` ou persistir fallback para capacidades sem caller genérico. **Prevenção:** somente `campaign_copy` tem fallback configurável; `campaign_image_edit` é capacidade primária independente. `[CITED: design.md D2/D3; specs/admin-ai-model-selection/spec.md]`

### Pitfall 3: fazer lookup Supabase dentro de `resolve`

**Falha:** N+1 por capacidade/invoke e latência variável no pipeline. **Prevenção:** dois mapas bulk, TTL 30s, resolver só em memória. `[CITED: design.md D6; tasks.md 2.1–2.2]`

### Pitfall 4: deixar seleção `deprecated` cair no default

**Falha:** mudança operacional silenciosa e UI incapaz de mostrar o alvo efetivo histórico. **Prevenção:** seleção existente com linha `deprecated` continua executável e é sinalizada; apenas nova seleção deprecated é bloqueada pela RPC. `[CITED: design.md decisões consolidadas 2; specs/ai-model-registry/spec.md]`

### Pitfall 5: validar apenas provider/model ou apenas pricing do modelo

**Falha:** protocolo incompatível pode chamar adapter errado; imagem Responses pode perder o custo da tool; edição pode não ter custo unitário. **Prevenção:** validar tupla completa e pricing por capacidade, incluindo `responses:image_generation` e `image_unit_usd`. `[CITED: design.md D7/D8; specs/ai-model-pricing/spec.md]`

### Pitfall 6: deploy antes da migration remota

**Falha:** o singleton passa a ler tabelas inexistentes. **Prevenção:** checkpoint bloqueante migration remota → deploy. `[CITED: proposal.md linha 36; tasks.md 8.2–8.3]`

## Code Examples

### Composição prevista sem alterar o gateway

```ts
// Padrão F46 confirmado; F47 substitui somente o resolver injetado.
const defaultAiGateway = new AiGateway(
  new PersistedModelResolver({
    registry: new ModelRegistry(),
    selectionService,
    catalogService,
  }),
  defaultAdapterRegistry,
);
```

Esse exemplo é orientação de composição derivada do contrato, não código existente a copiar literalmente. O ponto confirmado é que `AiGateway` recebe `AiModelResolver` no construtor e `src/lib/ai/index.ts` hoje injeta `new ModelRegistry()`. `[VERIFIED: src/lib/ai/gateway.ts, index.ts; CITED: OpenSpec F47 design.md D6]`

### RPC/API padrão existente

```ts
const { data, error } = await supabaseAdmin.rpc("admin_set_ai_model_selection", {
  p_capability: body.capability,
  p_provider: body.provider,
  p_model: body.model,
  p_protocol: body.protocol,
  p_fallback_provider: body.fallback?.provider ?? null,
  p_fallback_model: body.fallback?.model ?? null,
  p_fallback_protocol: body.fallback?.protocol ?? null,
  p_reason: body.reason.trim(),
  p_actor_id: admin.userId,
  p_operation_id: body.operationId ?? crypto.randomUUID(),
});
```

O padrão de `requireAdmin`, parse Zod, chamada RPC e mapeamento de erros 400/500 existe na rota de pricing; os nomes/contrato acima vêm do OpenSpec e devem ser implementados conforme a migration. `[VERIFIED: src/app/api/admin/ai-model-pricing/route.ts; CITED: OpenSpec F47 design.md RPCs]`

## Runtime State Inventory

Embora F47 seja greenfield de persistência, a fase altera estado runtime; o inventário necessário para o plano é:

| Categoria | Itens encontrados | Ação |
|---|---|---|
| Stored data | `ai_model_pricing`, `admin_audit_log`, registry em código; não há ainda `ai_model_catalog`/`ai_model_selection`. `[VERIFIED: grep/read migrations; OpenSpec F47]` | Migration aditiva, seeds idempotentes; sem backfill de seleção (ausência significa default). |
| Live service config | Seleção F47 ainda não existe; nenhum serviço externo identificado além do Supabase remoto. `[VERIFIED: grep do repositório; tasks.md]` | Aplicar migration remota somente após UAT local. |
| OS-registered state | Nenhum estado OS relacionado a modelos encontrado; fase não registra tarefas/processos. `[VERIFIED: escopo/codebase]` | Nenhuma ação. |
| Secrets/env vars | F46 removeu envs de modelo/provider; restam chaves e operacionais. `[VERIFIED: F46-VERIFICATION.md]` | Não reintroduzir env override; apenas confirmar remotas no pós-deploy. |
| Build artifacts/installed packages | Nenhum pacote novo; dependências existentes. `[VERIFIED: package.json]` | Nenhuma migração de artefato. |

## Environment Availability

| Dependência | Necessária por | Disponível | Versão | Fallback |
|---|---|---:|---:|---|
| Node.js | gates e Next/Vitest | ✓ | 24.13.1 | — |
| npm | dependências/scripts | ✓ | 11.8.0 | — |
| Supabase CLI via npx | migration local/remota | ✓ | 2.104.0 | usar `npx`, não a CLI global 2.75.0 |
| Docker Desktop Linux engine | `supabase status`, banco local | ✗ | — | iniciar Docker; sem isso, migration local/UAT SQL ficam bloqueados |
| Supabase remoto/credenciais | migration/deploy | não verificado | — | checkpoint humano em 47-08; não presumir acesso |

O probe `npx supabase status` falhou por ausência do pipe do Docker Desktop Linux engine. `[VERIFIED: environment probe 2026-09-14]`

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest `^4.1.9` + Testing Library já instalados. `[VERIFIED: package.json]` |
| Config | `vitest.config.ts` (confirmar no plano/execução); não criar framework novo. |
| Quick run | `npx vitest run <arquivo-ou-filtro>` |
| Full suite | `npx vitest run` |
| Other gates | `npm run typecheck`; `npm run lint`; `npm run build` — padrão F46. `[VERIFIED: package.json; F46-VERIFICATION.md]` |

### OpenSpec behavior → test map

| Plan | Behaviors that need tests | Type |
|---|---|---|
| 47-01 (Wave 1) | schema/RLS, seed exact 12 rows/idempotência, CHECKs, set/reset errors, audit atomicity/idempotência | SQL/integration |
| 47-02 (Wave 2, após 47-01) | bulk maps, TTL, invalidation, deprecated inclusion, registry/catalog parity | unit/service |
| 47-03 (Wave 3) | valid override, default fallback, deprecated, missing/partial/incompatible, null fallback, no gateway change | unit/integration |
| 47-04 (Wave 4) | 403, Zod 400, GET statuses, PUT/DELETE RPC mapping and cache invalidation | route |
| 47-05 (Wave 5) | segment grouping, capability edit, fallback only campaign_copy, reason/reset, access | component/page |
| 47-06 (Wave 5) | token/tool/image-unit warnings and unchanged cost chain | unit |
| 47-07 (Wave 6) | effective labels and full regression; UI/form/schema/snapshot/domain/prompts unchanged | regression |
| 47-08 (Wave 7) | UAT local set/reset/fallback/deprecated/pricing/telemetry/deploy order | manual + verification |

### Sampling rate

- **Por task:** teste focal + `npm run typecheck`; manter os 4 gates verdes quando o plano tocar integração compartilhada. `[CITED: tasks.md linha 3]`
- **Por wave:** `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build`.
- **Phase gate:** migration remota aplicada, UAT humano aprovado, quatro gates verdes e `47-VERIFICATION.md` goal-backward.

### Wave 0 gaps

- [ ] Confirmar/configurar banco Supabase local (Docker Desktop ausente no probe).
- [ ] Criar fixtures/mocks de Supabase para bulk catalog/selection e RPCs, se não houver analog suficiente.
- [ ] Adicionar testes de component/page para a nova tela; não há tela F47 existente.
- [ ] Definir teste SQL/integration idempotente da migration, baseado nos precedentes F38/F43.

## Security Domain

### Applicable ASVS Categories

| ASVS | Aplica | Controle prescritivo |
|---|---:|---|
| V2 Authentication | sim | `requireAdmin` em layout e cada route handler; RPC recebe actor validado pelo servidor. `[VERIFIED: admin patterns; CITED: OpenSpec F47 specs]` |
| V3 Session Management | sim | usar sessão server-side existente; não confiar em user id vindo do client. `[VERIFIED: src/lib/admin/require-admin.ts pattern]` |
| V4 Access Control | sim | service_role apenas no backend; RLS/revoke; catálogo/seleção não expostos ao anon/authenticated. `[CITED: design.md D1/D4/D5]` |
| V5 Input Validation | sim | Zod + CHECKs + RPC validation de tupla, reason, fallback e operation id. `[CITED: specs/admin-ai-model-selection/spec.md; design.md D4]` |
| V6 Cryptography | não diretamente | não introduzir criptografia; secrets continuam apenas em env server-side. `[VERIFIED: F46 scope; AGENTS.md]` |

### Threat patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| usuário não-admin alterando modelo | Elevation of Privilege | `requireAdmin` + RPC service_role only |
| seleção apontando para adapter/protocolo inválido | Tampering | catálogo por capacidade + validação de provider/protocol + fallback registry |
| mudança sem trilha | Repudiation | RPC atômica e `admin_audit_log` com reason/actor/operation id |
| SQL/RPC permissiva | Tampering/Information Disclosure | parâmetros tipados, `search_path=''`, REVOKE e CHECKs |
| pricing ausente | Tampering/Denial of Service | apenas aviso; cadeia `resolveAiCost` continua com fallback_static, sem bloquear geração |

## State of the Art / Current Project Pattern

| Abordagem anterior | Abordagem F47 | Impacto |
|---|---|---|
| modelo escolhido no registry em código | seleção persistida decorando o registry | troca sem deploy, com fallback fail-open. `[CITED: proposal.md]` |
| pricing versionado por `(provider, model)` | validação de pricing por capacidade e componentes | evita omitir tool de imagem/unidade. `[CITED: specs/ai-model-pricing/spec.md]` |
| labels derivados sempre do default | labels do alvo efetivo/resposta | diagnósticos refletem seleção admin. `[CITED: design.md D10]` |
| admin pages existentes simples | tela por segmento com status/origem/pricing/auditoria | nova superfície sem alterar fluxo do lojista. `[CITED: design.md D9; VERIFIED: admin layout/pages]` |

## Assumptions Log

| # | Claim | Section | Risk |
|---|---|---|---|
| A1 | O cache implementará apenas mecanismo por instância, sem Redis, se nenhum mecanismo compartilhado já existir. `[ASSUMED]` | Cache / Environment | outras instâncias podem observar mudança por até 30s; precisa confirmação/decisão no plano. |
| A2 | `vitest.config.ts` é o config existente do Vitest. `[VERIFIED: glob]` | Validation | preservar o config; adicionar apenas suites F47. |
| A3 | O DELETE usará JSON `{ capability, reason, operationId }`, com `operationId` UUID obrigatório gerado uma vez pela UI e reutilizado em retry. `[DECIDED: user 2026-09-14]` | API/UI/RPC | O servidor não deve gerar outro ID para a mesma tentativa lógica. |

## Open Questions (RESOLVED)

1. **Qual mecanismo compartilhado de invalidação deve ser usado? RESOLVIDO.** Não adicionar infraestrutura; implementar cache server-side por instância, TTL de 30s e invalidação local explícita, documentando a janela residual entre instâncias. `[DECIDED: user 2026-09-14; CITED: design.md D6]`
2. **Qual é o contrato HTTP exato de DELETE? RESOLVIDO.** JSON `{ capability, reason, operationId }`, com `operationId` UUID obrigatório gerado uma vez pela UI e reutilizado em retries; o servidor nunca gera um novo ID. `[DECIDED: user 2026-09-14; CITED: tasks.md 4.1–4.4]`
3. **Como tratar pricing remoto/bootstrap? RESOLVIDO.** A ausência de qualquer componente é warning, não bloqueia seleção; a leitura F47 usa helper bulk/in-memory e as APIs existentes, sem alterar `resolveAiCost` nem `src/lib/ai-cost/ai-model-pricing.ts`. `[DECIDED: user 2026-09-14; CITED: design.md D8]`
4. **Docker/ambiente Supabase local estará disponível antes de 47-01? RESOLVIDO.** Docker/Supabase local é checkpoint bloqueante para executar lint/reset/testes SQL/UAT, mas não bloqueia a geração dos planos. `[DECIDED: user 2026-09-14]`

## Sources

### Primary (HIGH confidence)

- `openspec/changes/fase-47-catalogo-e-selecao-de-modelos-admin/proposal.md` — escopo, impacto, ordem de deploy e não-objetivos.
- `openspec/changes/fase-47-catalogo-e-selecao-de-modelos-admin/design.md` — decisões D1–D11, schema, matriz, RPCs, cache, pricing e migration plan.
- `openspec/changes/fase-47-catalogo-e-selecao-de-modelos-admin/tasks.md` — oito planos e tarefas canônicas.
- `openspec/changes/fase-47-catalogo-e-selecao-de-modelos-admin/specs/*/spec.md` — requisitos e cenários de aceitação.
- `src/lib/ai/{model-resolver,model-registry,index}.ts` — seam e composição reais da F46.
- `src/app/api/admin/{ai-model-pricing,feature-flags}/route.ts`, `src/app/(app)/admin/{layout,feature-flags}/*` — padrões admin reais.
- `supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql` e `20260821000001_f43_create_feature_flags.sql` — precedentes de pricing, RPC, RLS e auditoria.
- `openspec/design-system/MASTER.md` — regras visuais obrigatórias.

### Secondary (MEDIUM confidence)

- `AGENTS.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — constraints e tracking do projeto; alguns registros ainda precisam ser atualizados por 47-01/47-08.
- `.planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-VERIFICATION.md` e `46-09-SUMMARY.md` — evidência de que o seam F46 está concluído e dos gates existentes.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json e implementações reais lidos.
- Architecture: HIGH — OpenSpec canônico alinhado ao código F46 e padrões admin.
- Pitfalls: HIGH — derivados dos invariantes e dos cenários explícitos do OpenSpec.
- Environment: MEDIUM — versões CLI/runtime verificadas; acesso remoto e Docker local não disponíveis.

**Research date:** 2026-09-14
**Valid until:** 2026-09-21 (migration/runtime/admin phase is fast-moving)
