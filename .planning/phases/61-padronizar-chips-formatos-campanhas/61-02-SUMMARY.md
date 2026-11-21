# Phase 61 Plan 02: Lista e dashboard com chips padronizados

**Status:** ✅ **ACEITO LOCALMENTE/OFFLINE EM 2026-11-21** — sem bloqueadores; `61-03` autorizado isoladamente; fase **NÃO** concluída até o Review Stop do `61-03`.

**Executado em:** 2026-11-21
**Branch:** `feat/campaign-format-chips`
**Base da wave:** `4f5d8e00` (aceite local do `61-01`)
**HEAD ao final da execução:** `f31ecd95`

> Este documento registra a execução e o ACEITE LOCAL/OFFLINE do plano `61-02`
> (integração dos chips na listagem `/campanhas` e nas campanhas disponíveis do
> dashboard). `61-03` foi autorizado após a revisão e permanece sujeito ao seu
> próprio Review Stop. Build e suíte global permanecem como evidência anterior
> do executor.

---

## Objetivo executado

1. `CampaignListItem.formatPresentation` (obrigatório) construído no servidor em
   `src/lib/campaign/list.ts`, depois de `readTwoFormatListSummaries` e das
   assinaturas de miniatura.
2. `EligibleCampaignCard.formatPresentation` com a **mesma matriz** em
   `src/lib/dashboard/campaigns.ts`, no `rows.map` final pós-summaries.
3. Chips compartilhados e **informativos** (sem `href`) no card de `/campanhas`.
4. Chips informativos na linha de campanha disponível do dashboard, preservando
   `openHref`, contagem, miniatura/fallback e abertura.
5. Testes de matriz, localização (`pt-BR`/`es-419`), responsividade e prova de
   **zero chamadas adicionais**.

Nenhuma migration, RPC, flag, pricing, copy, miniatura, aprovação ou recuperação
foi criada/alterada. Nenhum acesso a banco, Storage, homolog, produção ou
provider. Sem merge, push, deploy, sync ou archive.

---

## Commits locais

| Commit | Tipo | Conteúdo |
|---|---|---|
| `8b5b4fb6` | feat | `formatPresentation` em `CampaignListItem` e `EligibleCampaignCard` + wiring test (matriz + chamadas) |
| `ff250330` | feat | Chips informativos no card de `/campanhas` (`client.tsx`) + testes da listagem |
| `f31ecd95` | feat | Chips informativos nos cards do dashboard + testes de componente/página/localização |

---

## Arquivos

### Criados

- `src/lib/campaign/__tests__/format-presentation-wiring.test.ts` (26 testes)
- `.planning/phases/61-padronizar-chips-formatos-campanhas/evidence/61-02-*.log` (10 logs)

### Alterados (escopo do plano)

- `src/lib/campaign/list.ts` — `CampaignListItemBase = Omit<..., "formatPresentation">`,
  helper puro `buildListFormatPresentation` (classificação conjunta → resumo →
  individual) e montagem no `itemsWithThumbnails`.
- `src/lib/dashboard/campaigns.ts` — campo obrigatório, helper
  `buildDashboardFormatPresentation` (mesma ordem) e montagem no `rows.map` final.
- `src/app/(app)/campanhas/client.tsx` — removeu `formatLabel`/`jointLabels`;
  renderiza `<CampaignFormatChips presentation={campaign.formatPresentation}
  messages={messages.formats} />`; coluna de conteúdo ganhou `min-w-0`.
- `src/components/dashboard/available-campaign-card.tsx` — props
  `formatPresentation` + `messages`; chips na linha de metadados.
- `src/components/dashboard/dashboard-campaigns.tsx` — removeu
  `formatLabel`/`formatLabels`; passa apresentação e `messages.formats`.
- Testes: `campaign-list-joint`, `campaign-list-format`, `dashboard/__tests__/campaigns`,
  `minhas-campanhas-client`, `campaign-card-thumbnail`,
  `available-campaign-card`, `dashboard-campaigns`, `dashboard-localization`,
  `dashboard-page`.

### Alterado por desvio (Rule 3)

- `src/__tests__/app/dashboard/dashboard-layout-order.test.tsx` — fixture
  `ITEMS` do `loadCampaignSection` recebeu `formatPresentation`; sem isso o
  render quebrava com `Cannot read properties of undefined (reading 'formats')`.
  Arquivo **não** listado em `files_modified`, mas coberto pelo `<verify>` do
  plano (`src/__tests__/app/dashboard`). A alteração é apenas de fixture/import.

### Intocados (confirmado por `git diff --stat`)

- `src/lib/product-two-format/**`
- `src/lib/campaign/format-resolution.ts`
- `supabase/**`
- `package.json` / `package-lock.json` (nenhuma dependência nova)

---

## Gates — resultados reais

| Gate | Comando | Exit | Resultado |
|---|---|---|---|
| Baseline em leitura (antes de editar) | `npx vitest run .../evidence/baseline-calls.test.ts` | **0** | `toEqual` contra o JSON imutável |
| Typecheck (Task 1) | `npm.cmd run typecheck` | **0** | Sem erros |
| Typecheck (Task 2) | `npm.cmd run typecheck` | **0** | Sem erros |
| Typecheck (final, pós-Task 3) | `npm.cmd run typecheck` | **0** | Sem erros |
| Lint (final) | `npm.cmd run lint` | **0** | Sem erros/avisos novos |
| Testes Task 1 | `npx vitest run <wiring, list-joint, list-format, dashboard campaigns, baseline>` | **0** | 5 arquivos / **44 testes** |
| Testes Task 2 | `npx vitest run <minhas-campanhas-client, campaign-card-thumbnail>` | **0** | 2 arquivos / **34 testes** |
| Testes Task 3 | `npx vitest run <available-campaign-card, dashboard-campaigns, dashboard-localization, dashboard-page>` | **0** | 4 arquivos / **43 testes** |
| Suítes dirigidas finais (plano) | `npx vitest run src/lib/campaign/__tests__ src/lib/dashboard/__tests__ "src/app/(app)/campanhas/__tests__" src/__tests__/app/minhas-campanhas-client.test.tsx src/components/dashboard/__tests__ src/__tests__/app/dashboard .../baseline-calls.test.ts` | **0** | **37 arquivos / 318 testes PASS** |
| Baseline em leitura (depois) | `npx vitest run .../evidence/baseline-calls.test.ts` | **0** | `toEqual`; SHA-256 do JSON **idêntico** antes/depois (`257C3C1B…D4C36`) |
| Diff-check | `git diff --check` | **0** | Limpo |
| Status | `git status --porcelain` | — | Apenas os logs `61-02-*.log` (untracked até o commit documental) |

**Não reexecutados nesta rodada (por instrução):** build (`npm.cmd run build`) e
suíte global (`npm.cmd run test`). A evidência anterior do executor do `61-01`
registra build exit 0 e suíte global 10.375 PASS/10 skipped; esta wave não os
repetiu.

### Falhas observadas durante a execução (corrigidas, não preexistentes)

1. `generateBatchPreferredThumbnailUrls`/`generateBatchThumbnailUrls` do
   dashboard só são interceptáveis via `vi.mock("@/lib/campaign/list")` (import
   externo). O wiring test foi ajustado para instrumentar como o baseline.
2. `getByText("Cuadrado 1:1")`/`"Não foi possível confirmar"` falhavam por haver
   dois chips na mesma tela; asserções passaram a usar `getAllByText` com a
   contagem esperada.
3. `dashboard-layout-order.test.tsx` quebrou no render por fixture sem o novo
   campo obrigatório — corrigido (Rule 3, documentado acima).

Nenhuma falha preexistente de teste/typecheck/lint foi introduzida ou mascarada.

---

## Contagens de chamadas — baseline × observado

Fonte imutável: `evidence/baseline-calls.json` (capturado no `61-01`). A leitura
foi reexecutada **antes e depois** desta wave com `toEqual` e hash idêntico.

### Lista (`listCampaigns`) — JSON do baseline (inalterado)

| Cenário | `from` | `readTwoFormatListSummaries` | `createSignedUrl` | `createSignedUrls` |
|---|---:|---:|---:|---:|
| `list.joint` | 1 | 1 | 0 | 1 |
| `list.legacy_only` | 1 | 1 | 2 | 0 |
| `list.no_signable_thumbnail` | 1 | 1 | 0 | 0 |
| `list.batch_1` | 1 | 1 | 0 | 1 |
| `list.batch_3` | 1 | 1 | 0 | 1 |

### Dashboard (`queryEligibleCampaigns`) — JSON do baseline (inalterado)

| Cenário | `from` | `readTwoFormatListSummaries` | `generateBatchPreferredThumbnailUrls` | `generateBatchThumbnailUrls` |
|---|---:|---:|---:|---:|
| `dashboard.joint` | 1 | 1 | 1 | 1 |
| `dashboard.legacy_only` | 1 | 1 | 1 | 1 |
| `dashboard.no_signable_thumbnail` | 1 | 1 | 1 | 1 |

### Observado no wiring test (pós-chips)

| Fixture | `from` | leitura conjunta | lote preferidas | lote legado | `createSignedUrls` | `createSignedUrl` |
|---|---:|---:|---:|---:|---:|---:|
| Lista: 2 conjuntas + 2 legadas | 1 | 1 (com as 4 campanhas) | — | — | 1 | 2 |
| Dashboard: 2 conjuntas + 1 legada | 1 | 1 | 1 | 1 | 1 | 1 |
| Dashboard: 3 conjuntas | 1 | 1 | 1 | 1 | 1 | 0 |

**Conclusão:** mesmas contagens do baseline para o mesmo conjunto; os chips
introduzem **zero** chamadas adicionais. Os builders são provados puros
(nenhum contador de banco/Storage incrementa ao montar apresentações).

---

## Contagens de testes (antes × depois, por arquivo)

Contagem de casos (`it`/`test`) na base `4f5d8e00` × HEAD `f31ecd95`:

| Arquivo | Antes | Depois |
|---|---:|---:|
| `src/lib/campaign/__tests__/format-presentation-wiring.test.ts` | 0 | 26 |
| `src/lib/campaign/__tests__/campaign-list-joint.test.ts` | 2 | 3 |
| `src/lib/campaign/__tests__/campaign-list-format.test.ts` | 2 | 2 |
| `src/lib/dashboard/__tests__/campaigns.test.ts` | 12 | 12 |
| `src/__tests__/app/minhas-campanhas-client.test.tsx` | 20 | 29 |
| `src/app/(app)/campanhas/__tests__/campaign-card-thumbnail.test.tsx` | 4 | 5 |
| `src/components/dashboard/__tests__/available-campaign-card.test.tsx` | 9 | 15 |
| `src/components/dashboard/__tests__/dashboard-campaigns.test.tsx` | 8 | 10 |
| `src/__tests__/app/dashboard/dashboard-localization.test.tsx` | 5 | 6 |
| `src/__tests__/app/dashboard/dashboard-page.test.tsx` | 11 | 12 |
| `src/__tests__/app/dashboard/dashboard-layout-order.test.tsx` | 5 | 5 |
| **Total dos arquivos tocados** | **78** | **125** (+47) |

Suítes dirigidas do plano (diretórios completos, incluindo arquivos não tocados):
**37 arquivos / 318 testes PASS**.

---

## Matriz de comportamento entregue

| Caso | Lista | Dashboard |
|---|---|---|
| Legado quadrado (snapshot histórico `1:1`) | `1:1` disponível, `9:16` não incluído | idem |
| Individual `9:16` pronta / vertical por expansão | `9:16` disponível, `1:1` não incluído, não parcial | idem |
| `generating` | `processing` no formato persistido | (não chega: `ready`-only) |
| `error` | `unknown` (nunca ausente, nunca “Não gerado”) | (não chega: `ready`-only) |
| Conjunta completa | dois disponíveis, não parcial | dois disponíveis, uma linha |
| Conjunta parcial estornada | `absent` + `Crédito devolvido`, `partial=true` | idem |
| Conjunta `inconsistent` | ambos `unavailable` | idem |
| Conjunta sem operação | ambos `unavailable` | idem |
| Leitura conjunta falha | ambos `unknown` | idem |
| Snapshot nulo legado | ambos `unavailable` | idem |
| Chips | sem `href`, sem navegação, sem geração | sem `href`, sem navegação, sem geração |

`active` permanece sempre `false` em lista/dashboard (sem seleção nessas
superfícies). Nenhum `input_snapshot`/`storage_path`/URL entra no DTO de
apresentação (teste dedicado).

---

## Desvios do plano

### Auto-corrigidos

**1. [Rule 3 — bloqueio de fixture] `dashboard-layout-order.test.tsx`**
- **Encontrado durante:** suítes dirigidas finais (Task 3).
- **Problema:** o arquivo não está em `files_modified`, mas está no glob de
  verificação; a fixture de `loadCampaignSection` não tinha o campo obrigatório
  e o render quebrava em `presentation.formats`.
- **Correção:** import de `buildIndividualFormatPresentation` e campo adicionado
  à fixture. Nenhuma asserção de comportamento foi relaxada.
- **Commit:** `f31ecd95`.

**2. [Rule 3 — instrumentação de teste] contadores de lote no dashboard**
- **Encontrado durante:** Task 1 (primeira execução).
- **Problema:** os contadores `generateBatch*` só existem quando o módulo é
  importado de fora (dashboard); a lista mede Storage diretamente.
- **Correção:** `vi.mock("@/lib/campaign/list", importOriginal)` no wiring test,
  espelhando o baseline. Nenhum código de produção alterado.

Nenhum desvio de escopo. Nenhuma decisão arquitetural nova.

---

## Riscos, limites e pontos para revisão

1. **Pequena duplicação intencional da matriz** entre `list.ts` e
   `dashboard/campaigns.ts`, conforme o plano ("aplicar exatamente a mesma
   ordem/matriz" em cada arquivo). Um futuro fator comum exigiria novo arquivo
   fora do `files_modified` desta wave.
2. **Divergência de evidência é permitida e preservada**: dashboard é
   `ready`-only, então `error → unknown` só é exercitado na lista; o vocabulário
   é o mesmo (catálogo compartilhado).
3. **`CampaignListItem.format`/`EligibleCampaignCard.format` continuam no DTO**
   (miniatura/`?format=` das ações atuais), embora a UI não os use mais para
   rótulos. Removê-los não é escopo desta fase.
4. **Build e suíte global não reexecutados** nesta rodada (instrução explícita);
   permanecem como evidência anterior do executor.
5. **Gates de integração de banco/Storage/homolog/produção não executados** por
   ausência de autorização/ambiente.
6. **`61-03` autorizado após o aceite; não iniciado até esta revisão.** A fase
   não está concluída nem aceita como um todo; nenhum `sync`, `archive`, `merge`,
   `push` ou `deploy` foi executado.

---

## Aceite local/offline

**Aceito em 2026-11-21, sem bloqueadores.**

Evidência da revisão de aceite:
- 38 arquivos / **324 testes PASS** (318 dirigidos + 6 de fronteiras);
- baseline em leitura passou; JSON original preservado;
- `git diff --check` do range limpo e árvore limpa;
- chips informativos, sem navegação/geração; classificação e estados coerentes;
- ações, miniaturas e contagens preservadas; nenhuma chamada adicional no
  percurso testado;
- ajuste de `dashboard-layout-order.test.tsx` restrito à fixture exigida pelo
  novo campo, sem enfraquecer asserções.

Build e suíte global não foram reexecutados nesta revisão; devem ser atualizados
no fechamento do `61-03`. `61-03` está autorizado isoladamente e deve parar no
seu Review Stop.

## Próximo passo

Executar somente o `61-03` (detalhe `/campanhas/[id]`) e parar no Review Stop.
A validação visual das superfícies continua necessária antes do fechamento.

## Self-Check: PASSED

- Arquivos criados/alterados conferidos no disco (todos presentes).
- Commits `8b5b4fb6`, `ff250330`, `f31ecd95` verificáveis em `git log`.
- `git diff --stat` restrito ao escopo do plano + 1 fixture (desvio documentado).
- `src/lib/product-two-format/**`, `src/lib/campaign/format-resolution.ts`,
  `supabase/**` e `package*.json` sem alteração no range.
- Baseline em leitura antes/depois com `toEqual` e hash do JSON idêntico.
