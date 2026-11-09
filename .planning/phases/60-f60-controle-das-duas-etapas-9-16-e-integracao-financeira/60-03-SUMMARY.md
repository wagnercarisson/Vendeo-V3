# F60 / Plano 60-03 — Summary de implementação

**Status:** **CONCLUÍDO E APROVADO — revisão offline + validação Postgres.** Offline **42/42 + 10/10**; Postgres **RUN 2: exit 0, 26/26 PASS**. RUN 1 preservada como histórico. O aceite libera a **revisão do 60-04**, não sua execução automática.

> **60-03 concluído e aprovado — revisão offline e validação Postgres.**
> Evidências: `60-03-POSTGRES-RUN-1.md` (histórico, 24/26) e `60-03-POSTGRES-RUN-2.md` (26/26).

## Correções da revisão

| Grupo | Correção |
|---|---|
| 1 — confirmação | Lê a autoridade antes de mutar, valida vínculo de loja, respeita `resume.action='blocked'`/`failedOutcome`, recusa `refunded`/terminal, trata `delivered` como replay idempotente (sem novas mutações) e exige `storagePath`/`evidenceRef` não vazios na sonda vertical |
| 2 — caminho administrativo | `probeArtifact` decide pela **origem canônica**: `9_16_two_stage` exige a sonda vertical final; sem suporte falha fechado (`FormatUnavailableError`) e nunca cai na sonda quadrada. `resolveUnknown` repassa `client` e projeções usando o mesmo cliente injetado |
| 3 — preflight | `evaluateF60Target`/`assertF60Target` compartilhados recusam alvo remoto, protocolo não-Postgres, homolog sem autorização/janela e falta de `F60_TEST_ALLOW_WRITES=1`; usados nas três suítes e no `f60GateStatus` |
| 4 — integração real | Suítes atravessam `TwoStageFinancialService` e `SupabasePendingOperationsRepository` reais sobre Postgres via adaptador controlado; `LegacyPendingReader` implementado; comparação de campos legados, listagem, resolução administrativa, negativos e ordem `source` corrigida |
| 5 — estorno x loja | `refundOnDefinitiveFailure` lê a autoridade financeira e recusa `storeId` divergente **antes** da sonda/epoch/`closeFailedOperation` |
| 6 — projeção vertical | `resolveUnknown({decision:'deliver'})` exige `verticalArtifactProbe` controlada, valida a arte 9:16 final e projeta com `expectedArtifactPath` real; sem sonda válida falha fechado (nunca presume `art-1024.jpg`) |
| 7 — comparação Postgres | `latestAttemptAt` esperado é normalizado com `toISOString()`, preservando o instante exato contra o adaptador |

## Implementação

| Arquivo | Conteúdo |
|---|---|
| `src/lib/product-9-16-two-stage/two-stage-financial-service.ts` | Reserva única com `amount=1` na autoridade; confirmação somente na entrega vertical com bloqueios/replay; estorno com `observedEpoch` antes da sonda e `artKind` real; `resolveUnknown` com ator/identidade/cliente/projeções |
| `src/lib/product-1-1/pending/pending-operations-repository.ts` | Views de histórico/ativos/desfechos; origem/etapa canônica; ordenação temporal do fluxo novo e legado preservado; sonda por origem |
| `src/lib/product-9-16-two-stage/__tests__/pg-supabase.ts` | Adaptador Postgres → superfície mínima Supabase para exercitar serviços reais com dependências controladas |
| `src/app/api/admin/product-1-1-pending/route.ts` | Sem alteração funcional; teste de rota comprova que arte quadrada não autoriza entrega de origem nova |

## Decisões preservadas

- `integral` em falha definitiva **não estorna e não entrega automaticamente**; apenas indica `delivery_required`.
- `invalid`/`indeterminate` recusam sem presumir `absent`.
- Nenhum ledger paralelo, migration, armazenamento ou expansão real.
- `search_path=""` e `SECURITY DEFINER` preservados.

## Testes offline executados

| Gate | Resultado |
|---|---|
| `two-stage-control.test.ts` | **25/25 PASS** |
| `two-stage-financial-service.test.ts` | **13/13 PASS** |
| `pending-operations-repository.test.ts` | **3/3 PASS** |
| `admin-pending-route.test.ts` | **1/1 PASS** |
| `f60-window.test.mjs` | **10/10 PASS** |
| `npx tsc -p tsconfig.typecheck.json --noEmit` | **0 erros** |
| `npm.cmd run lint` | **0 erros / 0 warnings** |
| `node scripts/testing/test-status.mjs` | inventário válido |
| `git diff --check` | limpo |
| suíte local completa | **8282 PASS / 4 FAIL** — somente os 2 arquivos já conhecidos (`landing-page.test.tsx`, `legacy-frontier.guard.test.ts`) |

Fixtures contratuais pré-existentes foram ajustadas para as views de união (sem alterar semântica) e o guard de não-ativação ganhou exceção EXATA para o serviço reutilizar a autoridade 1:1.

## Suítes Postgres criadas (não executadas)

- `financial-integration.integration.test.ts` — serviço real: reserva única, base/expansão, entrega vertical/idempotência, estorno único, `delivered` recusa estorno, `unknown` + resolução administrativa, negativos, contagens de `credit_transactions`.
- `shared-reading-compatibility.integration.test.ts` — `LegacyPendingReader` x repositório real em 1:1 e 9:16 direto; comparação de campos legados; listagem; entre etapas; anti-join; ordem `ORDER BY source` (`9_16_two_stage` antes de `legacy`).
- `origin-views.postgres.test.ts` — views/segurança, `SECURITY DEFINER`/`search_path=""`.

Comando: `node scripts/testing/run-integration.mjs f60`. Exige nova autorização, alvo e janela vigente; nenhum acesso a homolog nesta etapa. As três suítes usam o preflight compartilhado ANTES do pool.

## Próximo passo

- **60-03 concluído e aprovado.** RUN 1 permanece como histórico; RUN 2 é a evidência de aceite Postgres.
- **60-04: revisão liberada, execução não autorizada.** Após aprovação do 60-04, poderá ser avaliado o fechamento do primeiro módulo.
- Produção, deploy e IA seguem fora do aceite.

## Limitações

- Postgres **aprovado pelo aceite técnico da RUN 2 (26/26 PASS, exit 0)**. RUN 1 permanece como histórico (24/26; falhas de harness).
- Suíte local global mantém 2 arquivos com falhas não relacionadas (`landing-page.test.tsx` e `legacy-frontier.guard.test.ts`), em acompanhamento separado.
- `60-04` não iniciado; produção/deploy/IA fora.
