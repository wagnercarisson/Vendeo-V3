# Tasks — F56.2b1b Núcleo entregável

> Dependência obrigatória: b1a fechada/verificada separadamente, inclusive gate de isolamento/schema aprovado. Flags e autorização continuam `off`; nenhuma loja habilitada.
>
> **Fronteiras:** b1b salva a campanha concluída, persistida e recuperável ao retornar ao aplicativo, mas **não** implementa aprovação humana nem aprovação automática (F56.3). Retry de copy, E2E completo, piloto pago e autorização habilitadora pertencem à b2.
>
> **DIFERIDO (não é requisito nem pré-condição):** execução durável independente da requisição/navegador (fila/outbox, cron/dispatcher, worker, claim/lease/heartbeat/fencing, continuidade após fechar a página, retomada automática e prova executável). Referência preservada em `D6.1-DURABLE-EXECUTION-INVESTIGATION.md`; será retomada quando houver **Vercel Pro**, mediante nova investigação, **sem presumir solução aprovada**.
>
> **Proibições:** não adiar segurança, instrumentação obrigatória ou testes fundamentais para reduzir planos; não prometer continuidade após desconexão nem retomada automática.
>
> **Reconciliação (2026-10-12; Plano 10 + checkpoint humano Task 3):** 39/39 itens conciliados com evidência. **Evidência:** `56.2.2-VERIFICATION.md` (§2.2/§2.3), `56.2.2-01..10-SUMMARY.md`, `56.2.2-09-EVIDENCE.md`, `56.2.2-UAT.md` (`approved`, 2026-10-12), `56.2.2-UI-SPEC.md`, `56.2.2-CONTEXT.md`. **7.4** (revisão humana) = **DONE**. **7.5** é um **GATE BLOQUEANTE da b2 (documentado), NÃO um passo operacional exercido pela b1b inativa — marcado N/A.** Esta reconciliação **não** executa lifecycle `sync`/`archive`; a change NOMEADA permanece ATIVA.

## 0. Pré-condições e UI-SPEC
- [x] 0.1 Confirmar por escrito que a b1a está fechada/verificada (gate APPROVED, stage `off`, flags `false`) e que os contratos RPC-only/identidade/idempotência serão reutilizados — `56.2.2-CONTEXT.md` + Plano 01; `56.2.2-VERIFICATION.md` §1.3/§2.4
- [x] 0.2 Criar **UI-SPEC** (`56.2.2-UI-SPEC.md`, conforme `openspec/design-system/MASTER.md`) dos controles conectados (seletores elegíveis, estados do fluxo, feedback de copy) **antes** do planejamento das tarefas de UI; pode ser preparada separadamente, sem liberar o núcleo — `56.2.2-UI-SPEC.md` (checker 6/6 + revisão humana); `56.2.2-VERIFICATION.md` §2.3

## 1. Formulário e roteamento
- [x] 1.1 Obter elegibilidade server-side; montar/exibir seletores apenas para flag aplicável + autorização — Plano 01; `56.2.2-01-SUMMARY.md`
- [x] 1.2 Em `off`, omitir seletores/campos e preservar payload legado — Plano 01; `56.2.2-01-SUMMARY.md`; `56.2.2-VERIFICATION.md` §2.2 (REQ-56.2.2-01)
- [x] 1.3 Revalidar no POST e recusar payload exclusivo após revogação/leitura inválida, antes de crédito — Plano 04; `56.2.2-04-SUMMARY.md`
- [x] 1.4 Integrar roteamento novo sem conceder autorização ou habilitar lojas — Plano 01; `56.2.2-01-SUMMARY.md`; `56.2.2-VERIFICATION.md` §1.3
- [x] 1.5 Validar seleções server-side, Original com exatamente uma imagem de produto e erros de campo — Plano 01; `56.2.2-01-SUMMARY.md`
- [x] 1.6 Testar elegibilidade, UI, transporte, revogação entre renderização/POST e não regressão do legado — Planos 01/04; `56.2.2-01-SUMMARY.md`, `56.2.2-04-SUMMARY.md`

## 2. Geração no ciclo da requisição, snapshot e histórico
- [x] 2.1 Persistir snapshot imutável antes de reserva/provider, congelando briefing, referências/seleções e versões de composição + par modelo/qualidade; bloquear se falhar — Plano 02; `56.2.2-02-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6
- [x] 2.2 Registrar cada tentativa append-only, preservando run/trace, sem sobrescrever; reconstruível por par/alvo — Plano 02; `56.2.2-02-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6
- [x] 2.3 Resolver configuração fail-closed e exigir pricing `complete` para principal (`sunburst/medium`) e fallback (`image-2/medium`) — Plano 02; `56.2.2-02-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6 (F1)
- [x] 2.4 Executar política 2+1 no ciclo da requisição, com limites explícitos (teto da função/rota, timeout próprio da chamada ao provider); rate_limit transitório, fallback conforme política e quota/billing sem fallback — Plano 04; `56.2.2-04-SUMMARY.md`
- [x] 2.5 Não invocar revisor automático; testar política sem provider real — Plano 02; `56.2.2-02-SUMMARY.md`

## 3. Reenvio (consulta), início de tentativa atômico, reserva, arte e download
- [x] 3.1 Implementar **início de tentativa atômico no Postgres** (CAS/`ON CONFLICT` ou lock por operação) sem fila/cron/worker: duas requisições simultâneas **não** chamam o provider duas vezes; quem perde a corrida consulta/aguarda e não dispara chamada — Plano 03; `56.2.2-03-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6 (concorrência ⇒ UMA chamada)
- [x] 3.2 Garantir que o reenvio do lojista seja **somente consulta** por `campaignId + operation_id`: recupera arte salva se existir; resultado desconhecido **não** chama o modelo novamente; não inicia tentativa/geração/cobrança; teto 2+1 contado por operação — Plano 04; `56.2.2-04-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6 (I1/F4)
- [x] 3.3 Integrar RPC atômica da b1a: reserva temporária após preflight, **um crédito por entrega** em `delivered`, devolução em `refunded` — Plano 04 (+03 RPC b1a); `56.2.2-04-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6 (C3/C4: uma dedução)
- [x] 3.4 Persistir arte 1024×1024 real em bucket privado, caminho imutável (`upsert: false`), dimensões corretas — Plano 05; `56.2.2-05-SUMMARY.md`
- [x] 3.5 Liberar novo download somente com objeto íntegro e estado `delivered` (upload sozinho não libera) — Plano 06; `56.2.2-06-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6 (I3)
- [x] 3.6 Preservar download de campanhas legadas e independência da F37 — Plano 05; `56.2.2-05-SUMMARY.md`
- [x] 3.7 Provar (com upload real no Storage local) que `art_uploaded` sem `delivered` não libera download — Plano 09; `56.2.2-09-EVIDENCE.md` §5 (54/54, 0 skipped)

## 4. Copy e instrumentação
- [x] 4.1 Persistir estado de falha da copy sem bloquear arte entregue e sem prolongar indefinidamente a entrega da imagem; separar cancelamentos — Plano 08; `56.2.2-08-SUMMARY.md`
- [x] 4.2 Exibir feedback seguro do estado da copy; não adicionar retry — Plano 08; `56.2.2-08-SUMMARY.md`
- [x] 4.3 Emitir envelope e custo interno por tentativa, preservando contabilidade legada e sem cobrança adicional — Plano 08; `56.2.2-08-SUMMARY.md`
- [x] 4.4 Produzir IMG-001 + referência opaca e diagnóstico durável sanitizado/correlacionável — Plano 08; `56.2.2-08-SUMMARY.md`
- [x] 4.5 Testar copy não bloqueante, estados persistidos, telemetria, custo, suporte e legado — Plano 09; `56.2.2-09-EVIDENCE.md` §5 (C1 copy-state)

## 5. Falha confirmada, resultado desconhecido e resolução de suporte
- [x] 5.1 Falha confirmada sem arte utilizável → `refunded` uma vez — Plano 04; `56.2.2-04-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6 (C1)
- [x] 5.2 Resultado desconhecido (ex.: timeout) → operação pendente/limitada; **sem** nova chamada cega, **sem retomada** (nem automática, nem por reenvio) e **sem** estorno baseado apenas em timeout — Plano 04; `56.2.2-04-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6 (F2/I2)
- [x] 5.3 UI: exibir “Não foi possível confirmar a conclusão desta geração” com referência de suporte; **não** oferecer “Gerar novamente” para essa operação — Plano 06; `56.2.2-06-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6 (I2)
- [x] 5.4 Implementar resolução por **administrador autorizado** com **motivo obrigatório** e **registro auditável das evidências e da transição** (sem dois aprovadores nesta versão): entregar arte existente ou estornar uma vez após confirmar ausência e encerramento; **fila de atendimento = lista de pendências, sem execução automática**; **sem re-queue**, nova geração administrativa ou chamada automática ao provider — Plano 07; `56.2.2-07-SUMMARY.md`; `56.2.2-09-EVIDENCE.md` §6 (C4/auditoria)
- [x] 5.5 Preservar a fronteira F56.3 (nenhuma aprovação/reprovação/aprovação automática) — Plano 07; `56.2.2-07-SUMMARY.md`

## 6. Testes isolados
- [x] 6.1 Definir harness isolado com provider simulado e Postgres/Storage locais reais (instância descartável b1a), sem chamada paga — Plano 09; `56.2.2-09-EVIDENCE.md` §1
- [x] 6.2 Garantir ausência de bypass operacional de autorização (estágios por fixtures + função pura; sem concessão via API/RPC) — Plano 09; `56.2.2-09-EVIDENCE.md` §1
- [x] 6.3 Cobrir geração, **concorrência (duas requisições → uma chamada)**, reenvio-consulta, reserva/entrega, download, copy, resultado desconhecido e resolução de suporte — Plano 09; `56.2.2-09-EVIDENCE.md` §1/§5 (54/54, 0 skipped)
- [x] 6.4 Testar comportamento quando a conexão cai (sem afirmar cancelamento garantido nem continuidade garantida) e persistência da campanha concluída — Plano 09; `56.2.2-09-EVIDENCE.md` §6 (§6.4 recuperação)

## 7. Validação e fechamento
- [x] 7.1 Typecheck, lint, build e testes (unit/contrato/integração) sem chamada paga — Plano 10 (Task 1); `56.2.2-VERIFICATION.md` §1 (typecheck/lint/build exit 0)
- [x] 7.2 Confirmar flags/autorização `off`, nenhuma loja habilitada e sem `db push`/deploy/migration remota — Plano 10; `56.2.2-VERIFICATION.md` §1.3/§1.4
- [x] 7.3 Validar `openspec validate --strict` e matriz de rastreabilidade — Plano 10 (Task 2); `56.2.2-VERIFICATION.md` §2 (`valid`, change NOMEADA)
- [x] 7.4 Revisão humana separada da b1b; não antecipar b2/F56.3; apresentar lacunas e estimativa final de planos — **DONE** — `56.2.2-UAT.md` (`approved`, 2026-10-12; 9/9 pass, 0 issues; escopo b1b INATIVA apenas)
- [x] 7.5 **GATE OBRIGATÓRIO (b2, BLOQUEANTE — não é sugestão futura):** o piloto e a habilitação de lojas na b2 permanecem bloqueados até comprovar uma **estratégia operacional segura de resolução de claims residuais**. A confirmação do **plano e dos limites** da plataforma (**Vercel Hobby / Supabase Free informados; limites não verificados**) pode **sustentar** a estratégia, mas, **isoladamente, NÃO satisfaz o gate**; **evidência simulada não substitui comprovação operacional**. A b1b **inativa** pode ser concluída mantendo a limitação documentada; o bloqueio recai sobre **piloto/habilitação**, sem impedir a **preparação documental da b2**. A b1b inativa mantém o risco **explicitamente aceito**: claim `in_progress` residual sem evidência permanece **bloqueado** (sem estorno, sem nova geração, sem retomada); recuperabilidade completa **não** é declarada. — **N/A — GATE da b2 (bloqueante), documentado; NÃO exercido na b1b inativa** (registrado em `56.2.2-VERIFICATION.md` §2.7/D13 e `56.2.2-UAT.md` §6/Gaps; `gate.satisfied = false`)
