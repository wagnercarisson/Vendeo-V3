# Tasks — B2.1 Recuperação de copy (Produto 1:1)

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. Esta fatia **não** implementa imagem/estorno (B2.2) nem autorização/teste real (B2.3).

> **Dependência:** **F56.2b1b** (arquivada em 2026-10-12) e, transitivamente, F56.2b1a e F56.2a. Deriva da change agregadora substituída (`RECONCILIATION.md`).

> **Tamanho estimado:** **4–5 planos**. Se exceder 8–10, **parar** e propor ajuste sem retirar segurança/testes.

## 1. Preparação, dependência e ambiente

- [ ] 1.1 Confirmar por escrito a dependência da F56.2b1b e o recorte B2.1 (copy apenas)
- [ ] 1.2 Confirmar que o novo fluxo permanece inativo (chaves `false`, autorização `off`) e que a b1b está arquivada
- [ ] 1.3 Confirmar a instância Supabase/Docker isolada e registrar sua identidade (provider simulado)
- [ ] 1.4 Confirmar que archives/specs principais permanecem intocados e que a change agregadora **não** é sincronizada/arquivada como concluída

## 2. Política e identidade de tentativa

- [ ] 2.1 Confirmar a implementação atual: `COPY_BUDGET_MS = 30s`; `completed`/`failed` terminais protegidos; sem reabertura/sobrescrita
- [ ] 2.2 Implementar identidade de tentativa (`attempt_seq` + `attempt_token`) preservando histórico e sem reabrir/sobrescrever terminal
- [ ] 2.3 Preservar a **compatibilidade** dos leitores/RPCs atuais (leitura da maior `attempt_seq`; tentativa única ≡ `attempt_seq = 1`; envelope e terminal protegido)
- [ ] 2.4 Implementar a política: 1ª até 30s; falha transitória → espera 5s → 2ª até 30s; nova falha transitória → espera 10s → 3ª até 30s
- [ ] 2.5 Após as três falhas automáticas, ofertar **ação manual + suporte**
- [ ] 2.6 Limitar a **3 tentativas manuais** (6 no total); cada clique inicia **uma** tentativa e não reinicia o ciclo automático
- [ ] 2.7 Encerrar as tentativas no sucesso; não repetir cegamente falhas **definitivas** (configuração/permissão)
- [ ] 2.8 Garantir que a recuperação só é oferecida com a copy **pendente/falha**; copy **entregue encerra**
- [ ] 2.9 Implementar a **aquisição atômica** da tentativa (RPC condicional sob a trava da operação: tentativa **ativa**, próximo `attempt_seq`, **limites** 3+3=6, entrega **já `completed`**, **vencedor**) **antes** de qualquer chamada ao provider; perdedoras apenas acompanham
- [ ] 2.10 Integrar a **tentativa inicial** (drenagem da copy no ciclo da requisição) ao modelo de identidade (`attempt_seq`+`attempt_token`), contabilização e **classificação** da falha
- [ ] 2.11 Garantir que **cada chamada efetiva** (primária/fallback) seja **uma tentativa identificada** que segue a política; **sem** fallback escondido
- [ ] 2.12 Garantir que a **imagem `delivered`/terminal financeiro** não encerre nem bloqueie a recuperação de **textos** (terminais financeiro × copy **separados**)
- [ ] 2.13 Encerrar **atomicamente** a tentativa **expirada** (`pending` com lease vencido, `stale_attempt`) e adquirir a **próxima** na MESMA transação, rejeitando conclusão atrasada
- [ ] 2.14 Validar **server-side** as **transições de `mode`**: sem automática após falha **definitiva** ou após início **manual**; `mode` no corpo não reabre o ciclo
- [ ] 2.15 Exigir `request_token` na **API de acionamento** (ausência ⇒ `missing_request_token`, sem aquisição/IA); a tentativa **inicial interna** gera o próprio token

## 3. Anti-duplicação, histórico e segurança

- [ ] 3.1 Garantir anti-duplicação: clique duplo, reload e reenvio não duplicam chamadas nem reiniciam contadores
- [ ] 3.2 Rejeitar conclusão **atrasada** de tentativa superada (`stale_attempt`) sem sobrescrever o estado
- [ ] 3.3 Contabilizar chamadas técnicas/fallback no limite (sem tentativas escondidas)
- [ ] 3.4 Garantir que a recuperação tenta **somente os textos** (`campaign_copy`), não regenera/altera a imagem e mantém a imagem `delivered` acessível
- [ ] 3.5 Garantir que **nenhum crédito adicional** é consumido e que o **custo interno** é registrado
- [ ] 3.6 Exigir autenticação e verificação de **ownership**; negar sem chamada de IA
- [ ] 3.7 Garantir a **independência do estado da imagem** (recuperação de copy com imagem `delivered`)
- [ ] 3.8 Exibir a ação manual condicional conforme `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode) e `openspec/design-system/pages/campaign-preview.md`
- [ ] 3.9 Garantir que `pending` **não** comprove execução ativa: **posse/lease** da tentativa; **interrompida ≠ ativa**; **esperas (5s/10s) verificadas server-side** (anti-spinner-preso)
- [ ] 3.10 Implementar a **barreira de não-ativação e identidade**: campanha do **novo fluxo**, `operationId` correspondente, **elegibilidade/autorização** respeitada; com o fluxo **`off`**, negar **sem chamada de IA**; `mode`/sequência/token do cliente são **solicitações**, nunca autoridade
- [ ] 3.11 Implementar a **migração transacional** dos registros existentes da b1b (preservar o **vínculo da mesma tentativa** estado↔cancelamento e **restaurar a imutabilidade**), provada com **fixtures anteriores à B2.1**
- [ ] 3.12 Fechar a **idempotência do MESMO acionamento** (reenvio atrasado não adquire nova tentativa nem consome slot); identidade do cliente é **condição validada** (dedupe), nunca autoridade/vencedor
- [ ] 3.13 Atribuir a **tentativa histórica** da b1b ao contador **automático** (`attempt_seq = 1`, `kind='auto'`) no backfill
- [ ] 3.14 Explicitar **quem agenda** a 2ª automática (a aba que dirige); `reload`/outra aba **não** retomam automaticamente
- [ ] 3.15 Fechar a **ligação da aba iniciadora → página de resultado** (handle de condução client-side, efêmero por aba)

## 4. Testes (contrato, Postgres isolado, navegador)

- [ ] 4.1 Cobrir por **contrato**: política 30s/5s/10s, teto de 6, clique manual, `stale_attempt`, terminal não sobrescrito, falha definitiva, anti-duplicação, independência copy×imagem
- [ ] 4.2 Cobrir em **Postgres isolado** as transições condicionais e a proteção de terminal (instância descartável; nenhuma migration remota)
- [ ] 4.3 Cobrir no **navegador** com **provider simulado** (nenhuma chamada paga)
- [ ] 4.4 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)
- [ ] 4.5 Provar, no **Postgres isolado**, a concorrência **pela rota real**, os **limites separados** (auto × manual), as **esperas**, o **fallback** e a **tentativa inicial**
- [ ] 4.6 Provar a **migração/backfill** com **fixtures anteriores à B2.1** e a **imutabilidade restaurada**
- [ ] 4.7 Provar o **fluxo iniciadora → resultado → espera → 2ª automática** e que `reload`/outra aba apenas acompanham
- [ ] 4.8 Provar a **migração pelo CLI** (versão registrada em `schema_migrations`), **separada da execução recorrente**, **SEM RESET** — se a versão ainda **não** estiver aplicada, provar na instância **atual**; se **já** estiver aplicada, **parar** e solicitar uma **instância de prova separada**
- [ ] 4.9 Provar o **ciclo de 3 automáticas** (token **próprio** em cada: T1≠T2≠T3) e **reenvios** do mesmo acionamento **sem duplicação**

## 5. Checkpoint final

- [ ] 5.1 Rodar `openspec validate --strict` desta change e `git diff --check`
- [ ] 5.2 Submeter a B2.1 à **revisão humana**; confirmar que B2.2/B2.3 e a F56.3 não foram antecipadas
- [ ] 5.3 Registrar o resultado sem iniciar GSD
