---
phase: 59-f59-campanhas-de-produto-vertical-9-16
plan: "01"
subsystem: contracts
tags: [format-contract, safe-area, dimensions, artifact-path, thumbnail, vitest]

# Dependency graph
requires:
  - phase: 56.2.6
    provides: contrato puro do novo fluxo 1:1, path de artefato e classificação de fluxo
  - phase: 56.2.2
    provides: reconhecimento de paths de miniatura (legado, v2/v3, 1:1)
provides:
  - resolução pura e fail-closed de formato/versão (`resolveCampaignFormat`)
  - namespace vertical que apenas reexporta a tabela neutra
  - contrato de dimensões 1152 × 2048 → 1080 × 1920 com proporção por inteiros
  - política versionada `safe-area-9-16-v1` (percentuais + pixels por canvas + proveniência)
  - path vertical determinístico e regex exclusiva
  - reconhecimento aditivo do path vertical no mecanismo de miniaturas
  - inventário read-only que dispensa migration estrutural
affects: [59-03, 59-04, 59-05, 59-06, 59-07, 59-08, 59-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - resolvedor puro com união discriminada fail-closed
    - tabela única neutra reexportada pelo namespace vertical
    - proporção por multiplicação cruzada inteira (sem float)
    - política congelada com proveniência por valor
    - regex de path estrita e cruzada (1:1 × 9:16)

key-files:
  created:
    - .planning/phases/59-f59-campanhas-de-produto-vertical-9-16/59-01-SCHEMA-INVENTORY.md
    - .planning/phases/59-f59-campanhas-de-produto-vertical-9-16/59-01-SAFE-AREA-SOURCES.md
    - src/lib/campaign/format-resolution.ts
    - src/lib/product-vertical-9-16/format.ts
    - src/lib/product-vertical-9-16/dimensions.ts
    - src/lib/product-vertical-9-16/safe-area.ts
    - src/lib/product-vertical-9-16/artifact/artifact-path.ts
    - src/lib/product-vertical-9-16/__tests__/format.contract.test.ts
    - src/lib/product-vertical-9-16/__tests__/dimensions.contract.test.ts
    - src/lib/product-vertical-9-16/__tests__/safe-area.contract.test.ts
    - src/lib/product-vertical-9-16/__tests__/artifact-path.contract.test.ts
  modified:
    - src/lib/campaign/thumbnail/thumbnail-path.ts
    - src/lib/campaign/thumbnail/__tests__/thumbnail-path.test.ts

key-decisions:
  - "A tabela de formato vive no módulo neutro e o namespace vertical apenas reexporta; nenhuma variante local."
  - "Proveniência de topo/base/laterais ficou `pending` porque o corpo da página oficial da Meta não pôde ser lido; only o canto inferior direito é `conservative`."
  - "O regex vertical aceita somente `.jpg`; o mecanismo de miniatura aceita `.jpe?g` como já fazia nos outros shapes."
  - "O reconhecimento vertical na miniatura é aditivo e duplica o regex localmente para manter o módulo sem dependência do vertical."

patterns-established:
  - "Leitores de formato devem consumir a MESMA tabela neutra e falhar fechado em indisponibilidade."
  - "Pixels de área segura do canvas de entrega são literais; pixels do canvas de geração derivam por percentual."

requirements-completed: [REQ-59-01, REQ-59-03, REQ-59-06, REQ-59-07]

# Metrics
duration: 25min
completed: 2026-11-04
---

# Phase 59 Plan 01: Contratos puros de formato, dimensões, área segura e paths

**Tabela única fail-closed de formato/versão, contrato de dimensões 1152×2048→1080×1920, política versionada de áreas seguras, path vertical exclusivo e reconhecimento aditivo na miniatura — com inventário que dispensa migration estrutural.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-11-04T21:40:00Z (aprox.)
- **Completed:** 2026-11-04T22:05:11Z
- **Tasks:** 3
- **Files modified:** 13 (11 criados, 2 modificados)

## Accomplishments

- `resolveCampaignFormat` total e exaustivo: ambas as chaves ausentes ⇒ `1:1`; `1:1` explícito, par incoerente, versão ausente/desconhecida e formato malformado ⇒ `unavailable`; nunca cai para `1:1`.
- Dimensões congeladas com divisibilidade por 16 e igualdade de proporção por multiplicação cruzada inteira; `1080 × 1920` explicitamente rejeitado como tamanho de provider.
- `safe-area-9-16-v1` com percentuais primários, pixels literais do canvas de entrega (269/672/65/324×768), pixels derivados do canvas de geração (287/717/69/346×819) e proveniência por valor.
- Path vertical `{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg` com regex exclusiva; o regex 1:1 continua rejeitando o path vertical e vice-versa.
- Miniatura reconhece o path vertical sem importar o módulo vertical; denylist e expectativas legado/v2/v3/1:1 preservadas.
- Inventário read-only conclui **“Nenhuma migration estrutural necessária”** com evidência `arquivo#linha` para tabelas, constraints, índices, RPCs e `campaigns.input_snapshot`.

## Task Commits

1. **Task 1: Inventário read-only de schema** — `bf51df3d` (docs)
2. **Task 2: Formato neutro, reexport vertical e dimensões** — `38ffca38` (feat)
3. **Task 3: Área segura, path vertical e miniatura** — `dea770e3` (feat)

**Plan metadata:** commit de SUMMARY/tracking (ver histórico imediatamente após este arquivo).

## Files Created/Modified

- `.planning/.../59-01-SCHEMA-INVENTORY.md` — evidência read-only de schema e dispensa de migration.
- `.planning/.../59-01-SAFE-AREA-SOURCES.md` — conferência da fonte oficial e veredito por valor.
- `src/lib/campaign/format-resolution.ts` — tabela neutra e pura de formato/versão.
- `src/lib/product-vertical-9-16/format.ts` — reexport da mesma tabela.
- `src/lib/product-vertical-9-16/dimensions.ts` — constantes e checagens tipadas de dimensão.
- `src/lib/product-vertical-9-16/safe-area.ts` — política `safe-area-9-16-v1` e linhas de prompt.
- `src/lib/product-vertical-9-16/artifact/artifact-path.ts` — path e regex vertical.
- `src/lib/product-vertical-9-16/__tests__/*.contract.test.ts` — 4 suítes de contrato.
- `src/lib/campaign/thumbnail/thumbnail-path.ts` — reconhecimento aditivo do path vertical.
- `src/lib/campaign/thumbnail/__tests__/thumbnail-path.test.ts` — casos verticais + denylist; expectativas antigas mantidas.

## Decisions Made

- A tabela neutra é a única fonte; o namespace vertical reexporta sem cópia (provado por teste de fonte).
- Proveniência `pending` para topo/base/laterais, pois a página oficial da Meta respondeu mas o corpo numérico é renderizado por JavaScript; o canto inferior direito permanece `conservative`.
- O regex do path vertical usa `.jpg` estrito (contrato de entrega); a miniatura continua tolerando `.jpeg` como nos shapes existentes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentários de cabeçalho disparavam os greps de aceitação**
- **Found during:** verificação de aceitação das Tasks 2 e 3
- **Issue:** `Select-String` de imports proibidos encontrava as palavras `product-1-1`, `sharp` e `server-only` em comentários (sendo que o header de `thumbnail-path.ts` já continha `server-only` antes desta fase).
- **Fix:** reescrita mínima de comentários para descrever a ausência de dependência sem usar os literais monitorados; nenhuma mudança de comportamento.
- **Files modified:** `src/lib/campaign/format-resolution.ts`, `src/lib/campaign/thumbnail/thumbnail-path.ts`
- **Verification:** greps de aceitação agora retornam 0; testes e typecheck continuam verdes.
- **Committed in:** `38ffca38` e `dea770e3`

---

**Total deviations:** 1 auto-fixed (Rule 1, documentação/verificação).
**Impact on plan:** nenhum desvio de escopo ou comportamento; apenas texto de comentário.

## Issues Encountered

- A fonte oficial da Meta (`https://www.facebook.com/business/help/980593475366490`) respondeu com título e descrição, mas o corpo do artigo não é entregue sem JavaScript. Consequência honesta: veredito `pending` para topo/base/laterais, registrado em `59-01-SAFE-AREA-SOURCES.md`. A política v1 permanece com os literais aprovados.
- `eslint .` retorna exit 0, mas a configuração atual do ESLint não associa `files` a `.ts`/`.tsx`; os arquivos aparecem como “no matching configuration was supplied”. O gate de lint, portanto, **não prova** os arquivos novos nesta wave.

## Validation

| Gate | Resultado |
|---|---|
| Testes focados (4 suítes novas + miniatura) | **5 arquivos, 65 testes, todos passando** |
| Regressão 1:1 focada (`artifact-store`, `artifact-recovery`, diretório de miniaturas) | **7 arquivos, 108 testes, todos passando** |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | **exit 0**, porém sem regras associadas a TS (limitação da config) |
| `git diff --check` | **limpo** |
| `git status --porcelain src/lib/product-1-1` | **vazio** |
| `git status --porcelain supabase/migrations` | **vazio** |
| Imports de `product-vertical-9-16` em `src/lib/product-1-1/**` | **0** |
| Gates de banco (homolog/local/f50-4/Produto 1:1) | **NÃO EXECUTADOS** — exigem ambiente e autorização próprios |
| `next build` | **NÃO EXECUTADO** — gate da Wave 6/59-09 |
| OpenSpec `--strict` | **NÃO EXECUTADO** — gate da 59-09 |

### Evidência de preservação do 1:1

- Nenhum arquivo de `src/lib/product-1-1/**` foi alterado; nenhum importa o módulo vertical.
- Os 108 testes de `artifact-store`, `artifact-recovery` e miniaturas passaram sem alteração de expectativa.
- Testes cruzados provam que 1:1 não casa o path vertical e que o vertical não casa `art-1024.jpg`.

## User Setup Required

None - nenhuma configuração externa ou variável de ambiente nova nesta wave.

## Next Phase Readiness

- Wave 1 concluída no limite autorizado; **Wave 2 não iniciada**.
- Próximos passos dependentes de autorização:
  - **59-02** exige **checkpoint pago** (14 chamadas, teto US$ 3,00, estimativa vertical antes da primeira chamada, matriz/ambiente).
  - **59-03** (composição) não é paga, mas só deve iniciar após revisão desta wave e liberação da Wave 2.
- Pendências: confirmar os números da área segura em fonte oficial citável; validação visual com sobreposições reais continua em homolog.

## Self-Check: PASSED

- Arquivos criados existem em disco.
- Testes focados e regressão 1:1 executados após as correções de comentário.
- Critérios de aceitação das três tasks reexecutados (contagens de grep, suítes, typecheck, ausência de diff em `product-1-1`/migrations).
- Limitações declaradas: lint sem cobertura TS; build, OpenSpec strict e gates de banco não executados nesta wave.

---
*Phase: 59-f59-campanhas-de-produto-vertical-9-16*
*Completed: 2026-11-04*
