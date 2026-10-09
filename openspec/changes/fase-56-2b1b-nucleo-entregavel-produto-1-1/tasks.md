# Tasks — F56.2b1b Núcleo entregável

> Dependência obrigatória: b1a fechada/verificada separadamente, inclusive gate de isolamento/schema aprovado. Flags e autorização continuam `off`; nenhuma loja habilitada.
>
> **Fronteiras:** b1b salva a campanha concluída, persistida e recuperável ao retornar ao aplicativo, mas **não** implementa aprovação humana nem aprovação automática (F56.3). Retry de copy, E2E completo, piloto pago e autorização habilitadora pertencem à b2.
>
> **DIFERIDO (não é requisito nem pré-condição):** execução durável independente da requisição/navegador (fila/outbox, cron/dispatcher, worker, claim/lease/heartbeat/fencing, continuidade após fechar a página, retomada automática e prova executável). Referência preservada em `D6.1-DURABLE-EXECUTION-INVESTIGATION.md`; será retomada quando houver **Vercel Pro**, mediante nova investigação, **sem presumir solução aprovada**.
>
> **Proibições:** não adiar segurança, instrumentação obrigatória ou testes fundamentais para reduzir planos; não prometer continuidade após desconexão nem retomada automática.

## 0. Pré-condições e UI-SPEC
- [ ] 0.1 Confirmar por escrito que a b1a está fechada/verificada (gate APPROVED, stage `off`, flags `false`) e que os contratos RPC-only/identidade/idempotência serão reutilizados
- [ ] 0.2 Criar **UI-SPEC** (`56.2.2-UI-SPEC.md`, conforme `openspec/design-system/MASTER.md`) dos controles conectados (seletores elegíveis, estados do fluxo, feedback de copy) **antes** do planejamento das tarefas de UI; pode ser preparada separadamente, sem liberar o núcleo

## 1. Formulário e roteamento
- [ ] 1.1 Obter elegibilidade server-side; montar/exibir seletores apenas para flag aplicável + autorização
- [ ] 1.2 Em `off`, omitir seletores/campos e preservar payload legado
- [ ] 1.3 Revalidar no POST e recusar payload exclusivo após revogação/leitura inválida, antes de crédito
- [ ] 1.4 Integrar roteamento novo sem conceder autorização ou habilitar lojas
- [ ] 1.5 Validar seleções server-side, Original com exatamente uma imagem de produto e erros de campo
- [ ] 1.6 Testar elegibilidade, UI, transporte, revogação entre renderização/POST e não regressão do legado

## 2. Geração no ciclo da requisição, snapshot e histórico
- [ ] 2.1 Persistir snapshot imutável antes de reserva/provider, congelando briefing, referências/seleções e versões de composição + par modelo/qualidade; bloquear se falhar
- [ ] 2.2 Registrar cada tentativa append-only, preservando run/trace, sem sobrescrever; reconstruível por par/alvo
- [ ] 2.3 Resolver configuração fail-closed e exigir pricing `complete` para principal (`sunburst/medium`) e fallback (`image-2/medium`)
- [ ] 2.4 Executar política 2+1 no ciclo da requisição, com limites explícitos (teto da função/rota, timeout próprio da chamada ao provider); rate_limit transitório, fallback conforme política e quota/billing sem fallback
- [ ] 2.5 Não invocar revisor automático; testar política sem provider real

## 3. Reenvio (consulta), início de tentativa atômico, reserva, arte e download
- [ ] 3.1 Implementar **início de tentativa atômico no Postgres** (CAS/`ON CONFLICT` ou lock por operação) sem fila/cron/worker: duas requisições simultâneas **não** chamam o provider duas vezes; quem perde a corrida consulta/aguarda e não dispara chamada
- [ ] 3.2 Garantir que o reenvio do lojista seja **somente consulta** por `campaignId + operation_id`: recupera arte salva se existir; resultado desconhecido **não** chama o modelo novamente; não inicia tentativa/geração/cobrança; teto 2+1 contado por operação
- [ ] 3.3 Integrar RPC atômica da b1a: reserva temporária após preflight, **um crédito por entrega** em `delivered`, devolução em `refunded`
- [ ] 3.4 Persistir arte 1024×1024 real em bucket privado, caminho imutável (`upsert: false`), dimensões corretas
- [ ] 3.5 Liberar novo download somente com objeto íntegro e estado `delivered` (upload sozinho não libera)
- [ ] 3.6 Preservar download de campanhas legadas e independência da F37
- [ ] 3.7 Provar (com upload real no Storage local) que `art_uploaded` sem `delivered` não libera download

## 4. Copy e instrumentação
- [ ] 4.1 Persistir estado de falha da copy sem bloquear arte entregue e sem prolongar indefinidamente a entrega da imagem; separar cancelamentos
- [ ] 4.2 Exibir feedback seguro do estado da copy; não adicionar retry
- [ ] 4.3 Emitir envelope e custo interno por tentativa, preservando contabilidade legada e sem cobrança adicional
- [ ] 4.4 Produzir IMG-001 + referência opaca e diagnóstico durável sanitizado/correlacionável
- [ ] 4.5 Testar copy não bloqueante, estados persistidos, telemetria, custo, suporte e legado

## 5. Falha confirmada, resultado desconhecido e resolução de suporte
- [ ] 5.1 Falha confirmada sem arte utilizável → `refunded` uma vez
- [ ] 5.2 Resultado desconhecido (ex.: timeout) → operação pendente/limitada; **sem** nova chamada cega, **sem retomada** (nem automática, nem por reenvio) e **sem** estorno baseado apenas em timeout
- [ ] 5.3 UI: exibir “Não foi possível confirmar a conclusão desta geração” com referência de suporte; **não** oferecer “Gerar novamente” para essa operação
- [ ] 5.4 Implementar resolução por **administrador autorizado** com **motivo obrigatório** e **registro auditável das evidências e da transição** (sem dois aprovadores nesta versão): entregar arte existente ou estornar uma vez após confirmar ausência e encerramento; **fila de atendimento = lista de pendências, sem execução automática**; **sem re-queue**, nova geração administrativa ou chamada automática ao provider
- [ ] 5.5 Preservar a fronteira F56.3 (nenhuma aprovação/reprovação/aprovação automática)

## 6. Testes isolados
- [ ] 6.1 Definir harness isolado com provider simulado e Postgres/Storage locais reais (instância descartável b1a), sem chamada paga
- [ ] 6.2 Garantir ausência de bypass operacional de autorização (estágios por fixtures + função pura; sem concessão via API/RPC)
- [ ] 6.3 Cobrir geração, **concorrência (duas requisições → uma chamada)**, reenvio-consulta, reserva/entrega, download, copy, resultado desconhecido e resolução de suporte
- [ ] 6.4 Testar comportamento quando a conexão cai (sem afirmar cancelamento garantido nem continuidade garantida) e persistência da campanha concluída

## 7. Validação e fechamento
- [ ] 7.1 Typecheck, lint, build e testes (unit/contrato/integração) sem chamada paga
- [ ] 7.2 Confirmar flags/autorização `off`, nenhuma loja habilitada e sem `db push`/deploy/migration remota
- [ ] 7.3 Validar `openspec validate --strict` e matriz de rastreabilidade
- [ ] 7.4 Revisão humana separada da b1b; não antecipar b2/F56.3; apresentar lacunas e estimativa final de planos
- [ ] 7.5 **GATE OBRIGATÓRIO (b2, BLOQUEANTE — não é sugestão futura):** antes do piloto/habilitação da b2, comprovar **fonte operacional** de evidência de encerramento (ou substrato durável) **e/ou** confirmar/ajustar **plano e limites efetivos** (Vercel Hobby / Supabase Free informados; limites **não verificados**). Enquanto não satisfeito, a b2 permanece bloqueada. A b1b inativa mantém o risco **explicitamente aceito**: claim `in_progress` residual sem evidência permanece **bloqueado** (sem estorno, sem nova geração, sem retomada); evidência simulada **não** conta como fonte operacional; recuperabilidade completa **não** é declarada.
