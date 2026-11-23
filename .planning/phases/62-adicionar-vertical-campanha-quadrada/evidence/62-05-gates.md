# 62-05 — Evidência de gates (execução local/offline)

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Escopo:** `62-05` apenas. `62-06` não iniciado. Sem banco/Storage/provider/migration/ambiente/merge/push/deploy/sync/archive.

## Commits

| Commit | Conteúdo |
|---|---|
| `fd4b060f` | plano reconciliado: R7, contratos atuais, injeções reais e guard estreito |
| `1c20029b` | rota, token HMAC, modal, detalhe e testes |
| `96bcec61` | plano: correções C6–C9 |
| `c6c69bf9` | retomada idempotente, polling contínuo, download seguro e fonte incerta |
| `eb1f7f3a` | plano: correção C10 |
| `e61926a5` | isolamento de sessão e descarte de respostas obsoletas |
| `2dca1d31` | plano: correção C11 |
| `f9e2f866` | liberação do submitting por identidade do POST |

## Correções C6–C9

- **C6:** POST retoma processing/unknown via `continueFormatAddition` com reserva/economia duráveis; GET emite token de retomada pelo request original mesmo com flag off; replay R1 antes de R2; nova abertura ainda bloqueada por flag off.
- **C7:** polling reagenda após cada resposta processing/unknown, sem sobreposição; para em terminal/fechar/desmontar; botão de retomada quando há token.
- **C8:** preview vertical + falha de download ⇒ `downloadDisabled=true` e `downloadUrl=""`, sem herdar o quadrado, nos dois caminhos.
- **C9:** ranking de falhas preserva incerteza (`artifact_indeterminate` etc.) sobre rejeição de path da outra origem.
- **C10:** cada abertura é uma sessão; fechar/desmontar/trocar campanha invalida GET/POST, callbacks, timers e `finally`; respostas antigas não substituem terminal nem disparam navegação; entrega única.
- **C11:** identidade do POST separada da sequência; POST atual libera `submitting` mesmo com GET posterior; POST antigo não libera outro POST/sessão.

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
| Foco total | os sete arquivos acima | **7 arquivos / 146 testes PASS** |
| Boundaries | `npx vitest run src/lib/campaign/square-base/__tests__/boundaries.contract.test.ts src/lib/product-two-format/orchestration/__tests__/joint-boundaries.contract.test.ts` | **2 arquivos / 13 testes PASS** |
| Diretórios afetados | rota + format-addition + detalhe + campanha + guards | **23 arquivos / 414 testes PASS** |

## Gates gerais

| Gate | Resultado |
|---|---|
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** |
| `npm.cmd run build` | exit **0**; 102/102 páginas |
| Suíte global | **exit 0**; 860 arquivos PASS + 2 skipped; **10.738 testes PASS** + 10 skipped |
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
  failure mantêm o quadrado. Download vertical é URL assinada; se a assinatura
  falhar, o download fica indisponível e não herda a URL do quadrado.
- Retomada: GET emite token para operação aberta; POST continua via reserva
  durável mesmo com flag off; replay R1 não devolve R2.
- Polling: múltiplas respostas `processing` consecutivas reagendam até entrega.
- Fonte: `indeterminate` da origem nova prevalece sobre rejeição de path da legada.
- Sessão: POST pendente fechado/desmontado não agenda consulta nem navega; reabrir
  isola resposta antiga; GET entregue antes do POST conclui uma única vez.
- Submitting: GET posterior `processing` não deixa o botão de retomada preso após
  o POST terminar; fechamento é provado com relógio falso além de 3 s.
- Modal confirma, acompanha e fecha sem POST; ESC fecha; incompatível não promete
  confirmação. Chip do detalhe abre modal; lista/dashboard mantêm ajuda local.
- Guards de não-ativação e boundaries foram estendidos apenas com caminhos
  explícitos do 62-05.

## Limitações

- Fakes/offline: sem prova de RLS, locks, concorrência PostgREST, Storage ou provider reais.
- `FORMAT_ADDITION_CONFIRMATION_SECRET` precisa existir no ambiente de ativação; não foi alterado aqui.
- A rota de download dedicada não foi alterada; o vertical usa URL assinada nesta fase.
- `62-06` não iniciado; lista/dashboard permanecem sem ação.
