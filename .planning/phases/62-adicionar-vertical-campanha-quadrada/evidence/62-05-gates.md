# 62-05 — Evidência de gates (execução local/offline)

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Escopo:** `62-05` apenas. `62-06` não iniciado. Sem banco/Storage/provider/migration/ambiente/merge/push/deploy/sync/archive.

## Commits

| Commit | Conteúdo |
|---|---|
| `fd4b060f` | plano reconciliado: R7, contratos atuais, injeções reais e guard estreito |
| `1c20029b` | rota, token HMAC, modal, detalhe e testes |

## Gates dirigidos

| Gate | Comando | Resultado |
|---|---|---|
| Rota | `npx vitest run "src/app/api/campaign/[id]/format-additions/__tests__/route.test.ts"` | PASS |
| Token | `npx vitest run src/lib/campaign/format-addition/__tests__/confirmation-token.test.ts` | PASS |
| Página | `npx vitest run "src/app/(app)/campanhas/[id]/__tests__/format-addition.test.tsx"` | PASS |
| F61 existente | `npx vitest run src/__tests__/app/campaign-detail-format.test.tsx` | PASS |
| Modal | `npx vitest run src/components/campaign/__tests__/add-vertical-dialog.test.tsx` | PASS |
| Chip (R7) | `npx vitest run src/components/campaign/__tests__/campaign-format-chips.test.tsx` | PASS |
| Guard de não-ativação | `npx vitest run src/lib/product-1-1/__tests__/non-activation.contract.test.ts` | PASS |
| Foco total | os sete arquivos acima | **7 arquivos / 134 testes PASS** |
| Boundaries | `npx vitest run src/lib/campaign/square-base/__tests__/boundaries.contract.test.ts src/lib/product-two-format/orchestration/__tests__/joint-boundaries.contract.test.ts` | **2 arquivos / 13 testes PASS** |
| Diretórios afetados | rota + format-addition + detalhe + campanha + guards | **23 arquivos / 406 testes PASS** |

## Gates gerais

| Gate | Resultado |
|---|---|
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** |
| `npm.cmd run build` | exit **0**; 102/102 páginas |
| Suíte global | **exit 0**; 860 arquivos PASS + 2 skipped; **10.726 testes PASS** + 10 skipped |
| OpenSpec strict | **1 passed, 0 failed** |
| `git diff --check` | limpo |

## Provas da jornada

- GET elegível emite token/requestId sem executar geração; DTO sem operationId.
- Flag off bloqueia nova adição, mas mantém delivered visível.
- Refunded emite token de retry com flag on; flag off remove retry.
- Fonte incompatível explica sem token; segredo ausente retorna 503.
- POST recusa corpo/token inválido, replay delivered/processing/refunded sem run,
  retry fora de refunded e checksum divergente.
- POST usa checksum/requestId do token, seleção vigente, e injeta
  `authorizeProductFlow`/`pilotSpendResolver` reais; mapeia saldo/rate para 402/429.
- Detalhe seleciona vertical só com preview/arte; refunded/processing/unknown/read
  failure mantêm o quadrado. Download vertical é URL assinada.
- Modal confirma, acompanha e fecha sem POST; ESC fecha; incompatível não promete
  confirmação. Chip do detalhe abre modal; lista/dashboard mantêm ajuda local.
- Guards de não-ativação e boundaries foram estendidos apenas com caminhos
  explícitos do 62-05.

## Limitações

- Fakes/offline: sem prova de RLS, locks, concorrência PostgREST, Storage ou provider reais.
- `FORMAT_ADDITION_CONFIRMATION_SECRET` precisa existir no ambiente de ativação; não foi alterado aqui.
- A rota de download dedicada não foi alterada; o vertical usa URL assinada nesta fase.
- `62-06` não iniciado; lista/dashboard permanecem sem ação.
