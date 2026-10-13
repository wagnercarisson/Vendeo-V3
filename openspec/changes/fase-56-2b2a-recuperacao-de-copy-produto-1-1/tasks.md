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

## 3. Anti-duplicação, histórico e segurança

- [ ] 3.1 Garantir anti-duplicação: clique duplo, reload e reenvio não duplicam chamadas nem reiniciam contadores
- [ ] 3.2 Rejeitar conclusão **atrasada** de tentativa superada (`stale_attempt`) sem sobrescrever o estado
- [ ] 3.3 Contabilizar chamadas técnicas/fallback no limite (sem tentativas escondidas)
- [ ] 3.4 Garantir que a recuperação tenta **somente os textos** (`campaign_copy`), não regenera/altera a imagem e mantém a imagem `delivered` acessível
- [ ] 3.5 Garantir que **nenhum crédito adicional** é consumido e que o **custo interno** é registrado
- [ ] 3.6 Exigir autenticação e verificação de **ownership**; negar sem chamada de IA
- [ ] 3.7 Garantir a **independência do estado da imagem** (recuperação de copy com imagem `delivered`)
- [ ] 3.8 Exibir a ação manual condicional conforme `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode) e `openspec/design-system/pages/campaign-preview.md`

## 4. Testes (contrato, Postgres isolado, navegador)

- [ ] 4.1 Cobrir por **contrato**: política 30s/5s/10s, teto de 6, clique manual, `stale_attempt`, terminal não sobrescrito, falha definitiva, anti-duplicação, independência copy×imagem
- [ ] 4.2 Cobrir em **Postgres isolado** as transições condicionais e a proteção de terminal (instância descartável; nenhuma migration remota)
- [ ] 4.3 Cobrir no **navegador** com **provider simulado** (nenhuma chamada paga)
- [ ] 4.4 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)

## 5. Checkpoint final

- [ ] 5.1 Rodar `openspec validate --strict` desta change e `git diff --check`
- [ ] 5.2 Submeter a B2.1 à **revisão humana**; confirmar que B2.2/B2.3 e a F56.3 não foram antecipadas
- [ ] 5.3 Registrar o resultado sem iniciar GSD
