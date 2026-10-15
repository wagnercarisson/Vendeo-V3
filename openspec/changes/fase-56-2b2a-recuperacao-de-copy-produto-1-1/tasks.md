# Tasks — B2.1 Recuperação de copy (Produto 1:1)

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. Esta fatia **não** implementa imagem/estorno (B2.2) nem autorização/teste real (B2.3).

> **Dependência:** **F56.2b1b** (arquivada em 2026-10-12) e, transitivamente, F56.2b1a e F56.2a. Deriva da change agregadora substituída (`RECONCILIATION.md`).

> **Tamanho estimado:** **4–5 planos**. Se exceder 8–10, **parar** e propor ajuste sem retirar segurança/testes.

> **Checkpoint humano:** **APROVADO** (`.planning/phases/56.2.3-f56-2b2a-recuperacao-de-copy-do-produto-1-1/56.2.3-UAT.md`, `[x] approved`, 2026-10-15) — **EXCLUSIVAMENTE no escopo B2.1 INATIVA** (flags `false`/autorização `off`); **NÃO** autoriza habilitação/piloto, `db push`/deploy, provider pago, reset ou GSD, nem inicia B2.2/B2.3/F56.3.

> **Reconciliação (2026-10-15):** itens conferidos **um a um** contra `.planning/phases/56.2.3-f56-2b2a-recuperacao-de-copy-do-produto-1-1/56.2.3-VERIFICATION.md`, os SUMMARYs `56.2.3-01..06-SUMMARY.md` e o `56.2.3-UAT.md` aprovado. Cada `[x]` abaixo carrega a evidência correspondente. Referências abreviadas: `VERIFICATION §N` (mesmo diretório), `SUMMARY NN` (`56.2.3-NN-SUMMARY.md`), `UAT` (`56.2.3-UAT.md`), `REVIEW` (`56.2.3-REVIEW.md`). **Nenhum item N/A** (todos os 46 têm evidência aplicável — ver nota final).

## 1. Preparação, dependência e ambiente

- [x] 1.1 Confirmar por escrito a dependência da F56.2b1b e o recorte B2.1 (copy apenas) — `proposal.md` §"Dependência explícita"; `SUMMARY 05` (frontmatter `requires` b1b + recorte copy); `STATE.md`
- [x] 1.2 Confirmar que o novo fluxo permanece inativo (chaves `false`, autorização `off`) e que a b1b está arquivada — `VERIFICATION §4` (flags `false`; stage `off`); `STATE.md` (b1b arquivada 2026-10-12); `SUMMARY 05` (entrega INATIVA)
- [x] 1.3 Confirmar a instância Supabase/Docker isolada e registrar sua identidade (provider simulado) — `VERIFICATION §2` + `§2.2` (`vendeo-f562a-isolated` API `127.0.0.1:56321`/DB `56322`; prova separada `vendeo-f562b-isolated`); provider simulado em toda a suíte isolada
- [x] 1.4 Confirmar que archives/specs principais permanecem intocados e que a change agregadora **não** é sincronizada/arquivada como concluída — `VERIFICATION §4` (última linha: change agregadora não sincronizada/arquivada; `openspec/specs/**` intocado); `STATE.md` (lifecycle OpenSpec não executado)

## 2. Política e identidade de tentativa

- [x] 2.1 Confirmar a implementação atual: `COPY_BUDGET_MS = 30s`; `completed`/`failed` terminais protegidos; sem reabertura/sobrescrita — `SUMMARY 01`; `src/lib/product-1-1/copy/copy-state.ts` (`COPY_BUDGET_MS = 30_000`); migration `20261013000001`
- [x] 2.2 Implementar identidade de tentativa (`attempt_seq` + `attempt_token`) preservando histórico e sem reabrir/sobrescrever terminal — `SUMMARY 01`; migration `20261013000001` (uma linha por tentativa; terminal protegido); `copy-state.ts`
- [x] 2.3 Preservar a **compatibilidade** dos leitores/RPCs atuais (leitura da maior `attempt_seq`; tentativa única ≡ `attempt_seq = 1`; envelope e terminal protegido) — `SUMMARY 01` (`readCopyState`/`readCopyDelivery` `order attempt_seq desc`); `copy-recovery.contract` (122 verdes)
- [x] 2.4 Implementar a política: 1ª até 30s; falha transitória → espera 5s → 2ª até 30s; nova falha transitória → espera 10s → 3ª até 30s — `SUMMARY 02`; `copy-recovery-policy.ts`; migration `20261013000002` (`wait_not_elapsed`)
- [x] 2.5 Após as três falhas automáticas, ofertar **ação manual + suporte** — `SUMMARY 02` (`manual_with_support`); `copy-recovery-panel.tsx` (suporte mailto); `UAT` (Teste 4 aprovado)
- [x] 2.6 Limitar a **3 tentativas manuais** (6 no total); cada clique inicia **uma** tentativa e não reinicia o ciclo automático — `SUMMARY 02` (`COPY_RECOVERY_MANUAL_LIMIT=3`/`TOTAL=6`); migration `20261013000002`; `UAT` (Teste 3 aprovado)
- [x] 2.7 Encerrar as tentativas no sucesso; não repetir cegamente falhas **definitivas** (configuração/permissão) — `SUMMARY 02` (`definitive_exit`); `copy-state.ts` (classificação server-side); `UAT` (Teste 2 aprovado)
- [x] 2.8 Garantir que a recuperação só é oferecida com a copy **pendente/falha**; copy **entregue encerra** — `SUMMARY 04` (`display.ts` `mapNewFlowCopyRecovery`); `copy-recovery.ts` (gate `completed`); `UAT` (Teste 1 aprovado)
- [x] 2.9 Implementar a **aquisição atômica** da tentativa (RPC condicional sob a trava da operação: tentativa **ativa**, próximo `attempt_seq`, **limites** 3+3=6, entrega **já `completed`**, **vencedor**) **antes** de qualquer chamada ao provider; perdedoras apenas acompanham — `SUMMARY 06`; migration `20261013000002`; `copy-acquisition-client.ts`
- [x] 2.10 Integrar a **tentativa inicial** (drenagem da copy no ciclo da requisição) ao modelo de identidade (`attempt_seq`+`attempt_token`), contabilização e **classificação** da falha — `SUMMARY 02`; `generation-orchestrator.ts` (`startCopy` adquire antes do dreno); `VERIFICATION §3` (lacuna 1)
- [x] 2.11 Garantir que **cada chamada efetiva** (primária/fallback) seja **uma tentativa identificada** que segue a política; **sem** fallback escondido — `SUMMARY 02` (uma chamada por tentativa; fallback = tentativa seguinte); `default-copy-runner.ts`; `copy-recovery.ts` (`resolveTarget`)
- [x] 2.12 Garantir que a **imagem `delivered`/terminal financeiro** não encerre nem bloqueie a recuperação de **textos** (terminais financeiro × copy **separados**) — `SUMMARY 06` (sem `operation_terminal`); `copy-acquisition-client.ts`; `VERIFICATION §3` (REQ-56.2.3-10)
- [x] 2.13 Encerrar **atomicamente** a tentativa **expirada** (`pending` com lease vencido, `stale_attempt`) e adquirir a **próxima** na MESMA transação, rejeitando conclusão atrasada — `SUMMARY 06`; migration `20261013000002` (`expired_closed`/`staleAttempt`); `VERIFICATION §3` (lacuna 5); `copy-recovery.integration` (prova isolada)
- [x] 2.14 Validar **server-side** as **transições de `mode`**: sem automática após falha **definitiva** ou após início **manual**; `mode` no corpo não reabre o ciclo — `SUMMARY 06`; migration `20261013000002` (`automatic_closed`)
- [x] 2.15 Exigir `request_token` na **API de acionamento** (ausência ⇒ `missing_request_token`, sem aquisição/IA); a tentativa **inicial interna** gera o próprio token — `SUMMARY 02`/`SUMMARY 03`; `recovery-schemas.ts`; `copy-recovery.ts`; `route.ts` (400); `copy-recovery.contract` (schema + `missing_request_token`)

## 3. Anti-duplicação, histórico e segurança

- [x] 3.1 Garantir anti-duplicação: clique duplo, reload e reenvio não duplicam chamadas nem reiniciam contadores — `SUMMARY 06`; migration `20261013000002` (UNIQUE/dedupe); `VERIFICATION §1` (concorrência pela rota real ⇒ UMA chamada); `UAT` (Teste 9)
- [x] 3.2 Rejeitar conclusão **atrasada** de tentativa superada (`stale_attempt`) sem sobrescrever o estado — `SUMMARY 01`/`SUMMARY 06`; migration `20261013000001` (`stale_attempt` antes de token/terminal); `copy-recovery.contract`
- [x] 3.3 Contabilizar chamadas técnicas/fallback no limite (sem tentativas escondidas) — `SUMMARY 02` (uma chamada efetiva = uma tentativa); `copy-recovery-policy.ts`; `VERIFICATION §3` (REQ-56.2.3-08)
- [x] 3.4 Garantir que a recuperação tenta **somente os textos** (`campaign_copy`), não regenera/altera a imagem e mantém a imagem `delivered` acessível — `SUMMARY 03`/`SUMMARY 04` (rota sem import de crédito/artefato; aviso de escopo); `UAT` (Teste 4); `VERIFICATION §3` (REQ-56.2.3-05)
- [x] 3.5 Garantir que **nenhum crédito adicional** é consumido e que o **custo interno** é registrado — `SUMMARY 02`; `default-copy-runner.ts` (telemetria); `VERIFICATION §3` (REQ-56.2.3-09)
- [x] 3.6 Exigir autenticação e verificação de **ownership**; negar sem chamada de IA — `SUMMARY 03`; `route.ts` (prelude `requireApiUser`→`getCampaign`→`requireOwnership` antes da IA); `copy-recovery.contract`
- [x] 3.7 Garantir a **independência do estado da imagem** (recuperação de copy com imagem `delivered`) — `SUMMARY 04`; `VERIFICATION §3` (REQ-56.2.3-10, prova `(i)`); `copy-recovery.integration`
- [x] 3.8 Exibir a ação manual condicional conforme `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode) e `openspec/design-system/pages/campaign-preview.md` — `SUMMARY 04` (`copy-recovery-panel.tsx`; lucide, sem emojis); `UAT` (Testes 2/3/6/9 aprovados); arquivos do design-system presentes
- [x] 3.9 Garantir que `pending` **não** comprove execução ativa: **posse/lease** da tentativa; **interrompida ≠ ativa**; **esperas (5s/10s) verificadas server-side** (anti-spinner-preso) — `SUMMARY 04`; `copy-state.ts` (`readCopyRecoverySummary` por lease); migration `20261013000002` (espera); `UAT` (Teste 8 aprovado)
- [x] 3.10 Implementar a **barreira de não-ativação e identidade**: campanha do **novo fluxo**, `operationId` correspondente, **elegibilidade/autorização** respeitada; com o fluxo **`off`**, negar **sem chamada de IA**; `mode`/sequência/token do cliente são **solicitações**, nunca autoridade — `SUMMARY 03`; `route.ts` (`classifyCampaignFlow`, `operation_identity_conflict`, `resolveProductFlowAuthorization`)
- [x] 3.11 Implementar a **migração transacional** dos registros existentes da b1b (preservar o **vínculo da mesma tentativa** estado↔cancelamento e **restaurar a imutabilidade**), provada com **fixtures anteriores à B2.1** — `SUMMARY 06`; migration `20261013000003`; `VERIFICATION §2.2` (prova ao vivo limpa em `vendeo-f562b-isolated`: fixtures NULL ⇒ CLI ⇒ vínculo ⇒ imutabilidade)
- [x] 3.12 Fechar a **idempotência do MESMO acionamento** (reenvio atrasado não adquire nova tentativa nem consome slot); identidade do cliente é **condição validada** (dedupe), nunca autoridade/vencedor — `SUMMARY 06`; migration `20261013000002` (`already_acquired`); `copy-recovery.contract` (reenvio mesmo `requestToken`)
- [x] 3.13 Atribuir a **tentativa histórica** da b1b ao contador **automático** (`attempt_seq = 1`, `kind='auto'`) no backfill — `SUMMARY 06`; migration `20261013000003`; `VERIFICATION §2.2` (`kind='auto'` provado)
- [x] 3.14 Explicitar **quem agenda** a 2ª automática (a aba que dirige); `reload`/outra aba **não** retomam automaticamente — `SUMMARY 04`; `copy-recovery-driving.ts`; `client.tsx` (`isDriving`); `UAT` (Testes 6/8)
- [x] 3.15 Fechar a **ligação da aba iniciadora → página de resultado** (handle de condução client-side, efêmero por aba) — `SUMMARY 04`; `copy-recovery-driving.ts`; `copy-recovery-driving.test.tsx` (6/6)

## 4. Testes (contrato, Postgres isolado, navegador)

- [x] 4.1 Cobrir por **contrato**: política 30s/5s/10s, teto de 6, clique manual, `stale_attempt`, terminal não sobrescrito, falha definitiva, anti-duplicação, independência copy×imagem — `SUMMARY 01`/`SUMMARY 02`/`SUMMARY 06`; `copy-recovery.contract.test.ts` (**122 verdes** re-executados)
- [x] 4.2 Cobrir em **Postgres isolado** as transições condicionais e a proteção de terminal (instância descartável; nenhuma migration remota) — `VERIFICATION §1`/`§2` (`copy-state.integration` **8/8**; instância descartável via CLI)
- [x] 4.3 Cobrir no **navegador** com **provider simulado** (nenhuma chamada paga) — `UAT` (inspeção visual em browser real, 9+ cenários; fixtures) + suítes isoladas com provider simulado; `VERIFICATION §1` (zero chamada paga)
- [x] 4.4 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga) — `VERIFICATION §1` (typecheck 0, lint 0, build 0, suíte local); re-execução local: `tsc` exit 0 + contrato 122/122
- [x] 4.5 Provar, no **Postgres isolado**, a concorrência **pela rota real**, os **limites separados** (auto × manual), as **esperas**, o **fallback** e a **tentativa inicial** — `VERIFICATION §1` (`copy-recovery.integration` **23/23**, 0 skipped)
- [x] 4.6 Provar a **migração/backfill** com **fixtures anteriores à B2.1** e a **imutabilidade restaurada** — `VERIFICATION §2.2` (fixtures NULL pré-`0003` ⇒ CLI ⇒ vínculo/`kind='auto'`/imutabilidade ⇒ idempotente)
- [x] 4.7 Provar o **fluxo iniciadora → resultado → espera → 2ª automática** e que `reload`/outra aba apenas acompanham — `copy-recovery-driving.test.tsx` (**6/6**, teste de componente jsdom — `UAT` item (c): automatizado, **não** inspeção visual)
- [x] 4.8 Provar a **migração pelo CLI** (versão registrada em `schema_migrations`), **separada da execução recorrente**, **SEM RESET** — se a versão ainda **não** estiver aplicada, provar na instância **atual**; se **já** estiver aplicada, **parar** e solicitar uma **instância de prova separada** — `VERIFICATION §2`/`§2.2` (aplicada via `migration up --local`; versões registradas; prova de migração separada; ramo tomado: `0003` ainda não aplicada ⇒ prova AO VIVO na instância separada `vendeo-f562b-isolated`, **SEM RESET**)
- [x] 4.9 Provar o **ciclo de 3 automáticas** (token **próprio** em cada: T1≠T2≠T3) e **reenvios** do mesmo acionamento **sem duplicação** — `SUMMARY 04` (T2≠T3); `copy-recovery.contract` + `persisted-state` (tokens distintos; `already_acquired` sem dupla contagem)

## 5. Checkpoint final

- [x] 5.1 Rodar `openspec validate --strict` desta change e `git diff --check` — re-executado em 2026-10-15: `openspec validate fase-56-2b2a-recuperacao-de-copy-produto-1-1 --strict` **valid**; `git diff --check` **limpo** (`VERIFICATION §1` idem)
- [x] 5.2 Submeter a B2.1 à **revisão humana**; confirmar que B2.2/B2.3 e a F56.3 não foram antecipadas — `UAT` (`[x] approved`, 2026-10-15, escopo inativo); `VERIFICATION §5`/`§6` (B2.2/B2.3/F56.3 não iniciados; D13 = gate futuro)
- [x] 5.3 Registrar o resultado sem iniciar GSD — `STATE.md` (fechamento 56.2.3); `VERIFICATION §6` (lifecycle OpenSpec **não** executado, owner-driven)

---

## Nota de reconciliação (2026-10-15)

- **N/A:** nenhum item é N/A — os 46 têm evidência aplicável (o ramo condicional de `4.8` foi resolvido pelo caminho "ainda **não** aplicada ⇒ prova na instância atual/separada", documentado em `VERIFICATION §2.2`).
- **Dívida aceita (LOW, não-bloqueante):** `REVIEW` **WR-02** e **WR-03** permanecem **abertos e aceitos** como dívida não-bloqueante (CR-01 HIGH + WR-01 MEDIUM resolvidos em `7dee0866`); não foram corrigidos nesta reconciliação (fora de escopo).
- **Nyquist:** **não executado por configuração** (`workflow.nyquist_validation=false`) — registrado como "não executado por configuração" (`VERIFICATION §6`); **não** é aprovação nem falha da implementação.
- **D13:** permanece o **GATE operacional futuro** da próxima fatia (imagem/estorno/habilitação — **B2.2**); **não** foi antecipado (`VERIFICATION §5`).
- **Escopo desta reconciliação:** apenas marcação/evidência deste `tasks.md`. Nenhuma refatoração, alteração de migration, `db push`, provider pago ou ativação. Lifecycle OpenSpec (sync/archive) permanece **não executado** — conduzido pelo responsável.
