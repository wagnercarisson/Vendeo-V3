---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-03
subsystem: lab
tags: [zod, fixtures, sha256, canonical-json, sharp, supabase, lab-scenarios, path-traversal]

# Dependency graph
requires:
  - phase: 48.1-laboratorio-ia-minimo
    provides: migration local das 8 tabelas `lab_*` + bucket `lab-artifacts` (48-1-01) e guarda de ambiente fail-closed + constantes de limite (48-1-02)
provides:
  - "`LabScenarioContent` (Zod) extensível com rejeição determinística de modalidade não suportada (`unsupported_scenario_mode` por campo)"
  - "Corpus inicial de 3 cenários de oferta com imagens controladas versionadas (`fixtures/lab/scenarios/**`)"
  - "Hash canônico SHA-256 determinístico do JSON do cenário (`computeScenarioContentHash`)"
  - "Carregamento confinado de fixtures com data URLs resolvidos server-side (`loadScenarioFixture`)"
  - "Materialização idempotente e imutável em `lab_scenarios`/`lab_scenario_versions` (`materializeScenarios`)"
  - "Bootstrap local-only idempotente (`scripts/uat/48-local-scenarios.mjs`)"
  - "Mapper `LabScenarioContent` → `CampaignBrief` + `ResolvedCampaignContext` com `brief_review_confirmed` fixo (D7)"
affects: [48-1-05 (harness do gateway consome brief/contexto), 48-1-07 (snapshot registra cenário/versão/hash), 48-1-08 (API `/scenarios`), 48-1-09 (UI de cenários), 48-1-11/48-1-12 (testes), 48-1-14 (UAT local)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSON canônico (ordenação recursiva de chaves, arrays posicionais) + SHA-256 como identidade verificável de versão"
    - "Confinamento de caminho em duas camadas: whitelist de slug + verificação lexical (`path.relative`) e pós-`realpath` (symlink)"
    - "MIME real detectado por magic bytes (nunca pela extensão) antes de montar o data URL"
    - "Porta mínima de persistência (`LabScenarioStore`) para tornar a materialização testável em memória sem rede"
    - "Bootstrap local-only que recusa host remoto/produção antes de qualquer leitura/escrita"

key-files:
  created:
    - src/lib/lab/scenarios/schema.ts
    - src/lib/lab/scenarios/mapper.ts
    - src/lib/lab/scenarios/service.ts
    - src/lib/lab/scenarios/__tests__/schema.test.ts
    - src/lib/lab/scenarios/__tests__/mapper.test.ts
    - src/lib/lab/scenarios/__tests__/service.test.ts
    - fixtures/lab/scenarios/produto-oferta-preco/scenario.json
    - fixtures/lab/scenarios/produto-oferta-preco/images/produto.jpg
    - fixtures/lab/scenarios/produto-oferta-preco/images/produto-auxiliar.jpg
    - fixtures/lab/scenarios/produto-oferta-texto-obrigatorio/scenario.json
    - fixtures/lab/scenarios/produto-oferta-texto-obrigatorio/images/produto.jpg
    - fixtures/lab/scenarios/produto-oferta-logo/scenario.json
    - fixtures/lab/scenarios/produto-oferta-logo/images/produto.jpg
    - fixtures/lab/scenarios/produto-oferta-logo/images/logo.png
    - scripts/uat/48-local-scenarios.mjs
  modified: []

key-decisions:
  - "Slug do terceiro cenário = `produto-oferta-logo` (design.md D4 + 48.1-CONTEXT.md D4/<specifics>); o `tasks.md` (item 3.2) citava `produto-oferta-badge` e estava desatualizado — divergência já registrada no objetivo do plano"
  - "Uniões extensíveis (`SCENARIO_INTENTS`/`SCENARIO_FORMATS`/`SCENARIO_LOCALES`/`SCENARIO_MEDIA_KINDS`) descrevem modalidades futuras, mas `SUPPORTED_SCENARIO_MODES` só executa `offer`/`1:1`/`pt-BR` — a diferença é o que `unsupported_scenario_mode` sinaliza"
  - "`materializeScenarios` recebe uma porta mínima `LabScenarioStore` (get/insert/update/list de hash) em vez do client Supabase cru, para permitir o cliente fake em memória exigido pelo plano sem abrir mão da semântica de upsert"
  - "`mandatoryArtworkText` do cenário é composto com a regra canônica do formulário (`ILLUSTRATIVE_NOTICE_TEXT\\n<texto livre>`) — mantém a fixture fiel ao caminho real que alimenta o diretor de arte"
  - "Imagens controladas geradas localmente com `sharp` a partir de buffers de pixel determinísticos (sem SVG, sem download, sem asset de lojista): 4 JPEG 512×512 (~3 KB) + 1 PNG 256×256 (~0,8 KB)"
  - "`campaignInput` inclui também os campos opcionais presentes no cenário (badge, detalhes, hook, cta, objective, targetChannel, format, sensitiveConstraints) para que brief e contexto permaneçam coerentes entre si"
  - "Bootstrap lê `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` quando presentes e cai para `npx supabase status -o env` (padrão do `47-local-bootstrap.mjs`); ambas as origens passam pelo mesmo bloqueio de host não local/produção e a chave anônima não é aceita"

patterns-established:
  - "Cenário versionado: fixture em disco → hash canônico → `(scenario_id, version)` imutável; hash novo ⇒ `max + 1`, hash igual ⇒ no-op"
  - "Erros de fixture determinísticos e nomeados: `unsupported_scenario_mode` / `exactly_one_primary_image` / `invalid_scenario_path` / `missing_scenario_image:<path>` / `scenario_not_found`"

requirements-completed: [lab-scenarios]

# Metrics
duration: 7min
completed: 2026-09-16
---

# Phase 48.1 Plan 48-1-03: Cenários Controlados do Laboratório Summary

**Schema `LabScenarioContent` extensível com rejeição de modalidade não suportada, 3 fixtures de oferta com imagens controladas geradas localmente e hash canônico SHA-256 verificado ponta a ponta contra o banco local (created 3 → created 0)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-16T13:03:48Z
- **Completed:** 2026-09-16T13:10:58Z
- **Tasks:** 3
- **Files modified:** 15 (todos criados)

## Accomplishments

- **Schema do cenário (`schema.ts`)** — `LabScenarioContent` `.strict()` com uniões extensíveis (`intent`/`format`/`locale`/`mediaKinds`) e conjunto suportado travado em `offer`/`1:1`/`pt-BR`. Modalidade fora do conjunto gera issue com mensagem `unsupported_scenario_mode` no campo culpado e `parseLabScenarioContent` a traduz em `UnsupportedScenarioModeError { code, field, value }`. Travas adicionais: `fictitious: z.literal(true)`, slug whitelisted (`^[a-z0-9]+(-[a-z0-9]+)*$`, sem `..`/`/`/maiúsculas`), `brandColor` `#RRGGBB`, exatamente 1 imagem `primary` (`exactly_one_primary_image`) e identidade `text_only | logo(+logoPath)`.
- **Corpus inicial de 3 cenários (`fixtures/lab/scenarios/**`)** — `produto-oferta-preco` (preço + imagem auxiliar `reference`, sem logo), `produto-oferta-texto-obrigatorio` (texto obrigatório + aviso ilustrativo canônico + validade, sem logo) e `produto-oferta-logo` (oferta com `identity.state: "logo"` e `logoPath: images/logo.png`). Todos `offer`/`1:1`/`pt-BR`, `fictitious: true`, loja/produto/oferta inventados. Imagens controladas geradas localmente com `sharp` a partir de buffers de pixel determinísticos: 4 JPEG 512×512 (~3 KB cada) + 1 PNG 256×256 (~0,8 KB) — muito abaixo do teto de 200 KB, sem download e sem ativo de lojista.
- **Mapper (`mapper.ts`)** — `mapScenarioToCampaignBrief` produz `CampaignBrief` com `metadata.schemaVersion = "campaign_brief_v1"`, `product.source = "manual"`, preços/badge/detalhes em `commercial`, `validity`/`legalNotice` estruturados e `media.images` com `mimeType` derivado do data URL e exatamente 1 `primary`. `mapScenarioToResolvedContext` monta a loja fictícia (campos de identidade `null`, `brandProfile: null`) e o `campaignInput` com `campaignIntent: "offer"` e `inputValidationOverride.productImageCheck = "brief_review_confirmed"` (D7 — validação de visão dispensada). Path de imagem ausente no mapa ⇒ `missing_scenario_image:<path>` (nenhum run é iniciado).
- **Serviço de cenários (`service.ts`)** — `canonicalizeScenarioContent` (ordenação recursiva de chaves, arrays posicionais) + `computeScenarioContentHash` (SHA-256 hex, 64 chars); `listScenarioFixtures` (3 itens ordenados por slug) e `loadScenarioFixture` com confinamento de caminho em duas camadas (slug whitelisted + `path.relative` lexical + verificação pós-`realpath` contra symlink) e data URLs montados a partir do MIME real detectado nos magic bytes (JPEG/PNG/WebP). `materializeScenarios` é idempotente por `content_hash` (hash igual ⇒ `skipped`; hash novo ⇒ `version = max + 1`, jamais sobrescrevendo a anterior).
- **Bootstrap local (`scripts/uat/48-local-scenarios.mjs`)** — materializa as fixtures no Supabase **local** com o mesmo hash canônico (espelho JS mínimo, sem importar TS), recusando host não local/`*.supabase.co` antes de qualquer escrita. **Executado de verdade contra o Supabase local**: 1ª execução `created: 3 / skipped: 0`; 2ª execução `created: 0 / skipped: 3`. Os 3 hashes gravados no banco **conferem exatamente** com os hashes calculados pelo serviço TS (verificado com probe temporário, removido antes do commit).
- **Mitigações do threat model aplicadas:** T-48-1-16 (confinamento de path + `invalid_scenario_path`), T-48-1-17 (`missing_scenario_image:<path>` antes de qualquer run), T-48-1-18 (SHA-256 do JSON canônico, determinismo e unicidade testados), T-48-1-19 (nunca sobrescreve versão; `max + 1`), T-48-1-20 (`fictitious: true` obrigatório, zero dado real), T-48-1-21 (script recusa host não local — validado com `*.supabase.co`), T-48-1-22 (`unsupported_scenario_mode`). T-48-1-SC: nenhum pacote novo (`sharp` e `@supabase/supabase-js` já eram dependências).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Schema Zod LabScenarioContent + rejeição de modalidade não suportada** — `cc07636f` (feat)
2. **Task 2: 3 fixtures de oferta com imagens controladas + mapper para CampaignBrief/ResolvedCampaignContext** — `50f399bd` (feat)
3. **Task 3: Serviço de cenários (hash canônico SHA-256) + bootstrap idempotente local** — `4424c432` (feat)

**Plan metadata:** `(este commit)` (docs: complete plan)

## Files Created/Modified

- `src/lib/lab/scenarios/schema.ts` — `LabScenarioContent` (Zod, `.strict()`), uniões extensíveis, `SUPPORTED_SCENARIO_MODES`, `UnsupportedScenarioModeError`, `parseLabScenarioContent`
- `src/lib/lab/scenarios/mapper.ts` — `mapScenarioToCampaignBrief` / `mapScenarioToResolvedContext` (data URLs resolvidos server-side, `brief_review_confirmed` fixo)
- `src/lib/lab/scenarios/service.ts` — canonicalização, hash SHA-256, `listScenarioFixtures`, `loadScenarioFixture`, `materializeScenarios`, porta `LabScenarioStore`
- `src/lib/lab/scenarios/__tests__/schema.test.ts` — 20 testes (modalidade, slug, imagens, travas, strict)
- `src/lib/lab/scenarios/__tests__/mapper.test.ts` — 15 testes puros (brief, contexto, mime, erro de imagem ausente)
- `src/lib/lab/scenarios/__tests__/service.test.ts` — 15 testes (hash determinístico, fixtures reais, confinamento, materialização idempotente com store em memória)
- `fixtures/lab/scenarios/produto-oferta-preco/{scenario.json,images/produto.jpg,images/produto-auxiliar.jpg}` — oferta com preço + 1 auxiliar `reference`, sem logo
- `fixtures/lab/scenarios/produto-oferta-texto-obrigatorio/{scenario.json,images/produto.jpg}` — texto obrigatório + aviso ilustrativo + validade, sem logo
- `fixtures/lab/scenarios/produto-oferta-logo/{scenario.json,images/produto.jpg,images/logo.png}` — oferta com logo controlado
- `scripts/uat/48-local-scenarios.mjs` — bootstrap local-only idempotente das fixtures em `lab_scenarios`/`lab_scenario_versions`

## Decisions Made

- **Slug `produto-oferta-logo`** — confirmado em `design.md` (D4), `48.1-CONTEXT.md` (D4 + `<specifics>`) e no objetivo deste plano; o `tasks.md` citava `produto-oferta-badge` e estava desatualizado (divergência já registrada no próprio plano).
- **Porta `LabScenarioStore`** em vez do client Supabase cru — o plano exige teste com "cliente fake em memória"; a porta é a superfície mínima (get/insert/update/list-hash) que reproduz a semântica de upsert idempotente sem acoplar o serviço ao PostgREST.
- **Composição canônica do texto obrigatório** — `illustrativeNoticeEnabled` + texto livre ⇒ `${ILLUSTRATIVE_NOTICE_TEXT}\n${texto livre}`, espelhando `buildMandatoryArtworkText` do formulário real (o cenário 2 exercita o bloco de aviso ilustrativo do diretor).
- **MIME por magic bytes** — `data:image/jpeg|png|webp;base64,...` derivado do conteúdo binário, nunca da extensão do arquivo.
- **Imagens geradas por buffers de pixel + `sharp`** — determinístico, sem dependência de SVG/renderer externo, sem download e sem ativo real; binários versionados no repositório.
- **`campaignInput` com os campos opcionais presentes** — além do mínimo exigido (productName, campaignIntent, preços, mandatoryArtworkText, validity, productImages, inputValidationOverride), inclui badge/detalhes/hook/cta/objective/targetChannel/format/sensitiveConstraints quando existem, para manter brief e contexto coerentes.
- **Bootstrap com dupla origem de conexão** — env vars quando presentes, senão `npx supabase status -o env` (precedente do `47-local-bootstrap.mjs`); as duas passam pelo mesmo bloqueio de host e a chave anônima é insuficiente (as tabelas `lab_*` só têm grants para `service_role`).

## Deviations from Plan

### Auto-fixed / adapted

**1. [Rule 3 - Bloqueio de teste] Assinatura de `materializeScenarios` adaptada para uma porta de persistência**
- **Found during:** Task 3 (serviço de cenários + bootstrap)
- **Issue:** o plano declara `materializeScenarios(client)` e, ao mesmo tempo, exige o teste "com um cliente fake em memória". Um client Supabase cru não é tipável nem injetável sem rede.
- **Fix:** o parâmetro passou a ser a porta mínima `LabScenarioStore` (`getScenarioBySlug`, `insertScenario`, `updateScenarioCurrentVersion`, `listScenarioVersionHashes`, `insertScenarioVersion`), que reproduz exatamente a semântica de upsert idempotente descrita no plano. O script de bootstrap implementa a mesma semântica contra o Supabase real.
- **Files modified:** `src/lib/lab/scenarios/service.ts`, `src/lib/lab/scenarios/__tests__/service.test.ts`, `scripts/uat/48-local-scenarios.mjs`
- **Verification:** teste de idempotência com store em memória (1ª chamada `created: 3`, 2ª `created: 0 / skipped: 3`) + execução real contra o Supabase local com o mesmo resultado + hashes do banco conferindo com os do serviço TS.
- **Committed in:** `4424c432` (Task 3)

---

**Total deviations:** 1 adaptada (bloqueio de testabilidade, sem mudança de comportamento ou de semântica de dados)
**Impact on plan:** Nenhum escopo extra. O comportamento contratado (idempotência por `content_hash`, nova versão `max + 1`, imutabilidade da versão anterior) é idêntico ao descrito; apenas a superfície de injeção ficou explícita e testável.

## Issues Encountered

- **`tasks.md` desatualizado no slug do 3º cenário** (`produto-oferta-badge` vs `produto-oferta-logo`) — divergência já registrada no objetivo do plano; adotado `produto-oferta-logo` (design.md D4 + CONTEXT D4/`<specifics>`), sem impacto em código.
- **`SERVICE_ROLE_KEY` não é suficiente via env no ambiente de execução** — resolvido com o fallback para `npx supabase status -o env`, o mesmo padrão já usado pelo `47-local-bootstrap.mjs`.
- Nenhum outro problema: `npx vitest run src/lib/lab/scenarios` (50 testes), `npx tsc -p tsconfig.typecheck.json --noEmit` e `npm run lint` verdes na primeira tentativa após a implementação.

## User Setup Required

None - nenhuma configuração de serviço externo. O bootstrap é local-only e usa o stack Supabase local já existente.

## Verification

| Verificação | Exit | Resultado |
|---|---|---|
| `npx vitest run src/lib/lab/scenarios` | **0** | 3 arquivos / **50 testes** (20 schema + 15 mapper + 15 service) |
| `npx vitest run src/lib/lab/scenarios/__tests__/schema.test.ts` | **0** | 20 testes |
| `npx vitest run src/lib/lab/scenarios/__tests__/mapper.test.ts` | **0** | 15 testes |
| `npx vitest run src/lib/lab/scenarios/__tests__/service.test.ts` | **0** | 15 testes |
| `npx tsc -p tsconfig.typecheck.json --noEmit` | **0** | limpo |
| `npm run lint` | **0** | limpo (inclui o `.mjs` do bootstrap) |
| `npx vitest run src/lib/ai/__tests__/architecture-guard.test.ts` | **0** | 9 testes (gate global cobre `src/lib/lab/**`) |
| `Get-ChildItem fixtures/lab/scenarios -Directory` | — | **3** diretórios |
| `rg -c '"slug"' fixtures/lab/scenarios/*/scenario.json` | — | **1** em cada um dos 3 arquivos |
| `rg -c '"intent": "offer"\|"format": "1:1"\|"locale": "pt-BR"' …` | — | **3** em cada um dos 3 arquivos |
| `rg -c '"fictitious": true' …` | — | **1** em cada um dos 3 arquivos |
| `Get-ChildItem fixtures/lab/scenarios -Recurse -File \| Where-Object Length -gt 204800` | — | **vazio** (maior arquivo ~3,2 KB) |
| `rg 'createHash\("sha256"\)' src/lib/lab/scenarios/service.ts` | — | **1** linha |
| `rg 'invalid_scenario_path\|missing_scenario_image' service.ts` | — | ambas presentes |
| `rg 'missing_scenario_image' mapper.ts` / `rg 'brief_review_confirmed' mapper.ts` | — | **1** linha cada |
| `node scripts/uat/48-local-scenarios.mjs` (1ª execução, Supabase local) | **0** | `created: 3, skipped: 0` |
| `node scripts/uat/48-local-scenarios.mjs` (2ª execução) | **0** | `created: 0, skipped: 3` |
| bootstrap com `NEXT_PUBLIC_SUPABASE_URL=https://<proj>.supabase.co` | **1** | recusado: `Recusando host de producao` (antes de qualquer escrita) |
| hashes do banco local × `computeScenarioContentHash` (TS) | — | **idênticos** para os 3 cenários |
| `rg 'campaign-images\|generation_events\|OPENAI_API_KEY\|GEMINI_API_KEY\|ai_model_selection' fixtures src/lib/lab/scenarios` | — | **vazio** |

## Known Stubs

Nenhum. As fixtures estão completas e parseáveis, os data URLs são resolvidos de arquivos reais versionados e a materialização grava conteúdo + hash + `fixture_path` reais. `visual_signature` permanece fora do schema por decisão de escopo da F48.1 (não-goal documentado), não como stub.

## Next Phase Readiness

- **Pronto para 48-1-04/48-1-05:** o harness do gateway consome `mapScenarioToCampaignBrief`/`mapScenarioToResolvedContext` e o `content_hash` de `loadScenarioFixture` para montar o snapshot do run (D8) com `brief_review_confirmed` já fixado no `campaignInput` (D7).
- **Estado do banco local:** `lab_scenarios` com 3 linhas `active` (`current_version = 1`) e 3 linhas em `lab_scenario_versions` (1 versão por cenário, hashes distintos). O remoto **não** foi tocado (push deliberado só no 48-1-14).
- **Sem pendências ou bloqueios.** Nenhuma superfície produtiva foi alterada (UI/form, contrato HTTP, schema público, snapshot, domínio e prompts oficiais intactos).

---

*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-16*

## Self-Check: PASSED

- Todos os 15 arquivos criados existem no disco (schema/mapper/service + 3 suítes + 3 `scenario.json` + 5 imagens + bootstrap).
- Commits confirmados no histórico: `cc07636f` (Task 1), `50f399bd` (Task 2), `4424c432` (Task 3).
- Gates reexecutados após o último commit: `npx vitest run src/lib/lab/scenarios` → 0 (50 testes); `npx tsc -p tsconfig.typecheck.json --noEmit` → 0; `npm run lint` → 0.

