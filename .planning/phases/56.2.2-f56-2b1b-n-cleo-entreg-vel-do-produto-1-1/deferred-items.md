# F56.2.2 — Plano 09: itens adiados (fora de escopo)

Durante uma execução ampla acidental do Vitest (o filtro de arquivo via splatting do
PowerShell não foi aplicado na primeira tentativa), foram observadas falhas **pré-existentes**
e NÃO relacionadas a este plano. Elas estão FORA de escopo (a verificação do Plano 09 roda
apenas as 6 suítes de integração da b1b, que passam 44/44 com 0 skipped).

## Falhas pré-existentes observadas (não corrigidas)

| Arquivo | Sintoma | Observação |
|---|---|---|
| `src/lib/lab/bench/domain/__tests__/intent-schema.contract.test.ts` | 5 falhas | schema da bancada exige `backgroundDirection` |
| `src/lib/lab/bench/__tests__/branding-service.test.ts` | 3 falhas | `missing_campaign_snapshot:bench_background_direction_required` |
| `src/lib/lab/bench/__tests__/prompt-base.contract.test.ts` | 3 falhas | idem (briefing da bancada) |
| `src/lib/lab/bench/__tests__/form-parity.contract.test.ts` | 2 falhas | idem |
| `src/lib/lab/bench/__tests__/run-history.contract.test.ts` | 1 falha | idem |
| `src/lib/legal/__tests__/legal-document-versions.test.ts` | 1 falha | arquivo `openspec/changes/.../terms-of-service-v1-5.md` ausente |
| `src/lib/visual-signature/__tests__/ai-image-generator.test.ts` | timeout | teste aguarda provider; timeout de 5s |
| `src/lib/image-generation/providers/__tests__/openai-provider.test.ts` | timeout | idem |
| `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` | timeout | idem |
| `src/lib/lab/bench/__tests__/candidate-manifest-isolation.test.ts` | timeout | varredura de arquivos |

> Nenhuma dessas falhas é causada pelas mudanças do Plano 09 (novos arquivos de teste de
> integração + runner + evidência). Não foram corrigidas (boundary de escopo). Encaminhar
> ao responsável/verificação da fase se aplicável.

## Reconciliação (Plano 10 — Task 3, checkpoint, 2026-10-12)

**Correção de classificação — NÃO era pré-existente.** A entrada
`src/__tests__/api/campaign-page-server.test.tsx` (3 falhas) constava como "pré-existente";
a investigação contra a baseline provou que é uma **REGRESSÃO DE TESTE ORIGINADA NA FASE
(Plano 06)** — o `vi.mock("@/lib/campaign/display")` não fornecia os exports
`mapNewFlowDisplayState`/`mapNewFlowCopy` que a página
`src/app/(app)/campanhas/[id]/page.tsx` passou a importar no Plano 06. **CORRIGIDO** (mock
parcial via `importOriginal`, mesmo padrão de `campaign-detail-page.test.tsx`) **sem alterar
asserções** e sem tocar produção/migration/flag/provider. O arquivo agora passa **5/5**
(commit `51f6c2b6`). Por isso a linha foi **removida** da tabela de pré-existentes acima.

**Confirmação das demais (pré-existentes à fase) — evidência contra a baseline `50152297`**
(commit imediatamente anterior ao primeiro commit de código do Plano 01 = `2a4e08b6`):

- `git diff 50152297..HEAD -- src/lib/lab/bench src/lib/visual-signature src/lib/image-generation/providers src/lib/image-generation/services src/lib/legal` = **vazio** — a fase **NÃO** tocou nenhum desses caminhos (nenhum está nos 102 arquivos alterados pela fase).
- Últimos commits que tocaram cada área **predate a baseline**: lab/bench `b7ab7b1b` (2026-10-09), legal `198f299e` (2026-09-23), visual-signature `83b0bb37` (2026-09-21), image-generation/providers `31e1c667` (2026-09-14), image-generation/services `f4f43147` (2026-09-16) — **nenhum** no range `50152297..HEAD`.
- Sintomas reconfirmados por reexecução direta: lab/bench **14** (`backgroundDirection` obrigatório), legal **1** (`ENOENT .../fase-50-.../terms-of-service-v1-5.md` — change da fase 50), provider **3** (`Error: Test timed out in 5000ms`).

**Totais da suíte após o fix (reconciliados):** `npm test` → **18 falhas / 5542 passed /
115 skipped** (Test Files: 25 failed / 438 passed / 2 skipped de 465). As 18 falhas restantes
são todas **pré-existentes** (14 lab/bench + 3 provider/timeout + 1 legal) e **NÃO** são
declaradas verdes.

## Reconciliação posterior (quick 261013-hxm, 2026-10-13) — as 18 falhas acima foram corrigidas

> **Nota de tracking.** Esta seção é **aditiva**; a evidência histórica do fechamento da b1b
> acima permanece íntegra e **não foi reescrita**.

As 18 falhas **pré-existentes** registradas na tabela original (14 lab/bench de
`backgroundDirection` + 3 provider/timeout + 1 legal) foram investigadas e **corrigidas** na
quick `261013-hxm` (`.planning/quick/261013-hxm-corrigir-as-18-falhas-investigadas-pos-f/`,
PLAN + SUMMARY): 13 fixtures do laboratório com `backgroundDirection` explícita; snapshot do
laboratório derivando `preserveImageContext` (snapshot e `briefSnapshot.creativeContext`)
exclusivamente de `backgroundDirection` (mapper legado intocado); 3 timeouts isolados com mocks
determinísticos do resolvedor de modelo; teste legal apontando para o archive da F50. Commits
`e13732a2`, `af28dc7e`, `f3c96912`, `08e6f0f2`.

**Resultado da suíte completa após a correção:** `5590 passed / 0 failed / 115 skipped`. A guarda
congelada `legacy-frontier`, que sinalizava 7 caminhos `src/lib/lab/bench/**`, foi **reconciliada com
autorização explícita do responsável** (recorte 5, `afe4cdbf`), preservando `BASE_SHA`,
`LEGACY_FRONTIER_PATHS`, a comparação de conteúdo com o commit aprovado e os testes negativos. Os
arquivos que não executam dependem do runner isolado (ausência de ambiente), não de falha de
implementação.


