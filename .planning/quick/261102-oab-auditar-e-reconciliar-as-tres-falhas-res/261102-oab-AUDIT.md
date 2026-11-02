# Auditoria do legacy-frontier guard — 261102-oab

Data: 2026-11-02
BASE_SHA: `335bfb70` (inalterado)
Guard: `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` (inalterado)

## Resultado da reprodução

`node node_modules/vitest/vitest.mjs run src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts`

- 3 failed / 7 passed (10 testes)
- **34 caminhos extras** não autorizados
- **4 conteúdos divergentes**: `src/lib/ai/types.ts`, `src/lib/ai/telemetry-sink.ts`, `src/lib/ai/gateway.ts`, `src/lib/credit/credit-service.ts`
- `missing`: nenhum (o guard não apontou caminho autorizado ausente do diff)

Os números históricos (34/4) coincidem com o diagnóstico anterior, mas foram
recalculados nesta auditoria.

## Matriz de auditoria

| Grupo | Caminhos | Últimos commits | Evidência encontrada | Classificação |
| --- | ---: | --- | --- | --- |
| `261026-pricing` | 12 | `89994b1d`, `99132b1e`, `ab69495a` | SUMMARY `status: complete`; linha “Parado para revisão do Codex”; complemento middleware/logger com autorização humana explícita (`ab69495a`); STATE linha 312 descreve execução, não aceite | **11 pendentes + 1 com autorização explícita** |
| `261026-vs` | 8 + `gateway.ts` | `43652290`, `b46fd472`, `563e1a09`, `c282d0bc` | SUMMARY `status: complete`; “Parado para revisão do Codex antes de publicação”; gap closures pós-revisão sem aceite final; STATE linha 313 sem aceite | **Pendente** |
| `261026-p11` | 5 + `types.ts`, `telemetry-sink.ts` | `2d42c512`, `5816a8ce` | SUMMARY `status: complete`; “Próximo passo: Revisão do Codex. Após aprovação…”; gap closure pós-revisão sem aceite final; STATE linha 311 sem aceite | **Pendente** |
| `261027-llm` | 2 | `76c1ef02` | SUMMARY com `acceptance: approved` e `accepted_on: 2026-10-27`; STATE linha 308 “APROVADA” | **Aprovado** |
| `261025-k8e` | 2 | `f3dcfa8f` | SUMMARY `status: complete` + seção “Notes for review”; sem campo de aceite; STATE linha 317 descreve execução | **Pendente** |
| `261102-o00` | 1 | `4d5cfc19` | Quick declarada aprovada pelo usuário nesta tarefa; SUMMARY `status: complete` | **Aprovado** |
| `F58-01` | `credit-service.ts` (conteúdo) | `59e8bea0` | `58-VERIFICATION.md` `status: passed` + UAT; 58-01 SUMMARY descreve `throwOnError` aditivo | **Aprovado** |

Nenhum grupo pendente possui `REVIEW.md`/`VERIFICATION.md` na pasta da quick, e
`git log --all --grep=<quick-id>` não encontrou commit de aprovação/aceite. As
linhas do STATE registram conclusão de execução, não aprovação.

## Detalhe dos caminhos pendentes

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

### `261026-p11` (7, incluindo conteúdo)

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

| Caminho | Commit autorizado atual | Último commit real | Grupo | Situação |
| --- | --- | --- | --- | --- |
| `src/lib/ai/types.ts` | `201e606f` | `2d42c512` | p11 | Pendente |
| `src/lib/ai/telemetry-sink.ts` | `201e606f` | `2d42c512` | p11 | Pendente |
| `src/lib/ai/gateway.ts` | `322809d0` | `43652290` | vs | Pendente |
| `src/lib/credit/credit-service.ts` | `05e81d90` | `59e8bea0` | F58-01 | Aprovado |

## Itens já justificados (não aplicados)

Conforme decisão do usuário, **não** serão reconciliados isoladamente agora:

- `261027-llm`: 2 caminhos, commit `76c1ef02`.
- `261102-o00`: 1 caminho, commit `4d5cfc19`.
- `F58-01`: `credit-service.ts`, commit `59e8bea0`.

## Proteções preservadas

- `BASE_SHA = 335bfb70` não foi alterado.
- Comparação exata de caminhos e de conteúdo continua ativa.
- Nenhuma autorização por diretório, glob ou `HEAD`.
- Testes negativos (caminho extra, caminho ausente, conteúdo divergente) intocados.
- Rota `generate-image` e rota de download continuam com suas verificações específicas.

## Próximo passo

Revisão técnica individual dos quatro pacotes em `review/`. Após aceite explícito
de cada grupo, retomar a reconciliação com referências imutáveis (commits por
caminho) e só então buscar a suíte verde.
