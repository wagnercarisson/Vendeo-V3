# Auditoria do legacy-frontier guard — 261102-oab

Data: 2026-11-02
BASE_SHA: `335bfb70` (inalterado)
Guard: `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` (inalterado na auditoria; reconciliado na retomada de 2026-11-02)

## Resultado da reprodução

`node node_modules/vitest/vitest.mjs run src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts`

- 3 failed / 7 passed (10 testes)
- **34 caminhos extras** não autorizados
- **4 conteúdos divergentes**: `src/lib/ai/types.ts`, `src/lib/ai/telemetry-sink.ts`, `src/lib/ai/gateway.ts`, `src/lib/credit/credit-service.ts`
- `missing`: nenhum (o guard não apontou caminho autorizado ausente do diff)

Os números históricos (34/4) coincidem com o diagnóstico anterior, mas foram
recalculados nesta auditoria.

## Parecer técnico desta retomada (2026-11-02)

O Codex revisou os diffs dos quatro grupos pendentes e o usuário autorizou a
retomada. O parecer cobre código/testes offline (280 testes em 21 arquivos;
typecheck/lint/diff-check aprovados) e **não** é validação de banco/provider nem
autorização de publicação. Ele **não** aprova retroativamente os summaries
históricos; é uma autorização nova, registrada em `261102-oab-RETOMADA.md`.

| Grupo | Situação histórica | Situação nesta retomada |
| --- | --- | --- |
| `261026-pricing` | Revisão pendente no SUMMARY | Autorizado para reconciliação |
| `261026-vs` | Revisão pendente no SUMMARY | Autorizado para reconciliação |
| `261026-p11` | Revisão pendente no SUMMARY | Autorizado para reconciliação |
| `261025-k8e` | “Notes for review” | Autorizado para reconciliação |
| `261027-llm` | `acceptance: approved` | Mantido |
| `261102-o00` | Quick aprovada | Mantido |
| `F58-01` | `58-VERIFICATION` passed | Mantido |

## Matriz de auditoria (snapshot histórico)

| Grupo | Caminhos | Últimos commits | Evidência encontrada | Classificação |
| --- | ---: | --- | --- | --- |
| `261026-pricing` | 12 | `89994b1d`, `99132b1e`, `ab69495a` | SUMMARY `status: complete`; linha “Parado para revisão do Codex”; complemento middleware/logger com autorização humana explícita (`ab69495a`); STATE linha 312 descreve execução, não aceite | Pendente na auditoria; **aprovado nesta retomada** |
| `261026-vs` | 8 + `gateway.ts` | `43652290`, `b46fd472`, `563e1a09`, `c282d0bc` | SUMMARY `status: complete`; “Parado para revisão do Codex antes de publicação”; gap closures pós-revisão sem aceite final; STATE linha 313 sem aceite | Pendente na auditoria; **aprovado nesta retomada** |
| `261026-p11` | **11 (9 extras + `types.ts`, `telemetry-sink.ts`)** | `2d42c512`, `5816a8ce` | SUMMARY `status: complete`; “Próximo passo: Revisão do Codex. Após aprovação…”; gap closure pós-revisão sem aceite final; STATE linha 311 sem aceite | Pendente na auditoria; **aprovado nesta retomada** |
| `261027-llm` | 2 | `76c1ef02` | SUMMARY com `acceptance: approved` e `accepted_on: 2026-10-27`; STATE linha 308 “APROVADA” | **Aprovado** |
| `261025-k8e` | 2 | `f3dcfa8f` | SUMMARY `status: complete` + seção “Notes for review”; sem campo de aceite; STATE linha 317 descreve execução | Pendente na auditoria; **aprovado nesta retomada** |
| `261102-o00` | 1 | `4d5cfc19` | Quick declarada aprovada pelo usuário nesta tarefa; SUMMARY `status: complete` | **Aprovado** |
| `F58-01` | `credit-service.ts` (conteúdo) | `59e8bea0` | `58-VERIFICATION.md` `status: passed` + UAT; 58-01 SUMMARY descreve `throwOnError` aditivo | **Aprovado** |

No snapshot histórico, nenhum grupo pendente possuía `REVIEW.md`/`VERIFICATION.md`
na pasta da quick, e `git log --all --grep=<quick-id>` não encontrou commit de
aprovação/aceite. As linhas do STATE registravam conclusão de execução, não
aprovação. A autorização posterior está em `261102-oab-RETOMADA.md`.

## Detalhe dos caminhos dos grupos revisados

### `261026-pricing` (12)

Commit `89994b1d` (7):

- `src/lib/ai-cost/__tests__/fixtures/openai-pricing-standard.md`
- `src/lib/ai-cost/__tests__/openai-pricing-dashboard.test.ts`
- `src/lib/ai-cost/openai-pricing-dashboard.ts`
- `src/lib/ai-cost/openai-pricing-fetch.ts`
- `src/lib/ai-cost/openai-pricing-inventory.ts`
- `src/lib/ai-cost/openai-pricing-sync-store.ts`
- `src/lib/ai-cost/openai-pricing-sync.ts`

Commit `99132b1e` (4):

- `src/lib/ai-cost/__tests__/openai-pricing-parser.test.ts`
- `src/lib/ai-cost/__tests__/openai-pricing-sync-state.test.ts`
- `src/lib/ai-cost/openai-pricing-parser.ts`
- `src/lib/ai-cost/openai-pricing-sync-state.ts`

Commit `ab69495a` (1):

- `src/lib/ai-cost/__tests__/openai-pricing-sync.test.ts`

O `ab69495a` é o único item deste grupo com autorização humana explícita
(“Complemento autorizado — middleware e primeira sincronização no homolog”).
Os demais dependem do aceite do núcleo da quick.

### `261026-vs` (9, incluindo conteúdo)

Commit `43652290` (6):

- `src/lib/ai-cost/__tests__/operation-runs-service.test.ts`
- `src/lib/ai-cost/__tests__/visual-signature-image-usage.test.ts`
- `src/lib/ai-cost/operation-runs-service.ts`
- `src/lib/ai-cost/visual-signature-image-usage.ts`
- `src/lib/ai/__tests__/gateway-visual-signature-image-usage.test.ts`
- `src/lib/ai/gateway.ts` (conteúdo divergente)

Commit `563e1a09` (2):

- `src/lib/ai-cost/visual-signature-image-cost.ts`
- `src/lib/ai/__tests__/visual-signature-image-cost-sink.test.ts`

Commit `c282d0bc` (1):

- `src/lib/ai-cost/__tests__/visual-signature-image-cost.test.ts`

`b46fd472` pertence ao mesmo gap closure, mas os caminhos foram posteriormente
tocados por `563e1a09`/`c282d0bc`; o conteúdo atual corresponde a esses commits.

### `261026-p11` (11: 9 extras + 2 conteúdos)

Commit `2d42c512` (7):

- `src/lib/ai-cost/__tests__/image-pair-pricing.test.ts`
- `src/lib/ai-cost/ai-model-pricing.ts`
- `src/lib/ai-cost/image-pair-pricing.ts`
- `src/lib/ai-cost/image-usage-token-cost.ts`
- `src/lib/ai-cost/types.ts`
- `src/lib/ai/types.ts` (conteúdo divergente)
- `src/lib/ai/telemetry-sink.ts` (conteúdo divergente)

Commit `5816a8ce` (4):

- `src/lib/ai/__tests__/adapters.test.ts`
- `src/lib/ai/__tests__/legacy-images-cache-isolation.test.ts`
- `src/lib/ai/adapters/images.ts`
- `src/lib/ai/adapters/upstream-images.ts`

### `261025-k8e` (2)

Commit `f3dcfa8f`:

- `src/lib/ai/__tests__/gateway.test.ts`
- `src/lib/ai/adapters/responses.ts`

## Conteúdos divergentes

| Caminho | Commit anterior | Commit aplicado na retomada | Grupo | Situação |
| --- | --- | --- | --- | --- |
| `src/lib/ai/types.ts` | `201e606f` | `2d42c512` | p11 | Aplicado |
| `src/lib/ai/telemetry-sink.ts` | `201e606f` | `2d42c512` | p11 | Aplicado |
| `src/lib/ai/gateway.ts` | `322809d0` | `43652290` | vs | Aplicado |
| `src/lib/credit/credit-service.ts` | `05e81d90` | `59e8bea0` | F58-01 | Aplicado |

## Itens já justificados e aplicados na retomada

- `261027-llm`: 2 caminhos, commit `76c1ef02`.
- `261102-o00`: 1 caminho, commit `4d5cfc19`.
- `F58-01`: `credit-service.ts`, commit `59e8bea0`.

## Proteções preservadas

- `BASE_SHA = 335bfb70` não foi alterado.
- Comparação exata de caminhos e de conteúdo continua ativa.
- Nenhuma autorização por diretório, glob ou `HEAD`.
- Testes negativos (caminho extra, caminho ausente, conteúdo divergente) intocados.
- Rota `generate-image` e rota de download continuam com suas verificações específicas.

## Reconciliação aplicada (2026-11-02)

Após o parecer técnico e a autorização da retomada, o guard recebeu 34 entradas
novas e teve 4 commits de conteúdo atualizados. O teste negativo de caminho
extra passou a usar `src/lib/ai/adapters/registry.ts` (intencionalmente não
autorizado), porque `adapters/images.ts` agora tem entrada própria. Os dois
testes que comparam conteúdo receberam timeout de 20 s para absorver o custo de
~64 `git show` sob a suíte completa; nenhuma asserção foi alterada.

Resultado: guard **10/10**, suíte local **7507 passed / 10 skipped / 0 failed**,
`test:scripts` **73/73**.

## Próximo passo

Revisão final do conjunto completo (código + documentos) e decisão de push,
que permanece reservada para depois.
