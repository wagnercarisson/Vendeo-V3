## 1. Baseline e congelamento de decisões

- [ ] 1.1 Reconfirmar branch, `git status`, changes OpenSpec abertas e estado operacional; registrar que F50.2 está ativa e que a F50.4 **não será ativada em produção** nesta execução. Critério: baseline documentado em `CONTEXT`/summary, sem alterar produção.
- [ ] 1.2 Revisar `trial_offer_enrollments`, `trial_offer_settings`, `trial_offer_eligibility`, `start_trial_offer_enrollment`, `record_onboarding_completion`, `grant_demo_credits`, `grant_monthly_credits` e os chamadores reais; confirmar que o inventário cobre todos os pontos. Critério: nenhum arquivo/RPC do inventário sem disposição.
- [ ] 1.3 Congelar a matriz de coortes e histórico de benefício como referência de testes; confirmar que a coorte é por `auth.users.created_at` e que `launch_at` não será alterado. Critério: matriz revisada contra `matrix.md`, sem decisão nova.
- [ ] 1.4 Especificar a evidência aceitável para o backfill (`store_id → stores.cnpj_normalized` canônico e `root_hash` compatível) e os códigos de erro de pré-checagem. Critério: casos ambíguos abortam, sem atribuição por suposição.
- [ ] 1.5 Verificar a versão real do Supabase CLI em uso e o procedimento de PostgreSQL descartável; não reutilizar banco isolado antigo sem revalidar saúde/identidade. Critério: versão e comando registrados, sem aplicação remota.

## 2. Migration M1 — marco próprio da F50.4

- [ ] 2.1 Autorar migration aditiva com `individual_launch_at TIMESTAMPTZ NULL` em `trial_offer_settings`, comentário e bloco `REVERT` condicionado. Critério: `launch_at` e dados existentes intocados.
- [ ] 2.2 Criar RPC administrativa de ativação do marco, `SECURITY DEFINER`, `search_path=''`, restrita a `service_role`, com ator, motivo, `operation_id`, idempotência e auditoria em `admin_audit_log`. Critério: recusa marco já gravado, backdate, motivo vazio, `launch_at` nulo, `individual_launch_at < launch_at` e chamada sem `enabled=true`.
- [ ] 2.3 Garantir que `admin_set_trial_offer_enabled` continue sem tocar `individual_launch_at`. Critério: teste de regressão da RPC existente.
- [ ] 2.4 Escrever testes SQL de M1: primeira ativação grava uma vez; replay com mesmo `operation_id` é idempotente; chamada desligada não inaugura; desligar não altera marcos. Critério: todos passam em PostgreSQL real.
- [ ] 2.5 Provar que a ativação controlada só funciona em banco descartável identificado e que nenhuma fixture/credencial aponta para produção ou ambiente compartilhado. Critério: fail-closed ao detectar ambiente não descartável; produção sem marco.

## 3. Migration M2 — identidade, backfill e unicidade

- [ ] 3.1 Adicionar `beneficiary_cnpj_normalized` e `policy_cohort` (default `root_legacy`) com CHECKs, em migration transacional. Critério: colunas nullable apenas durante o backfill, dentro da mesma transação.
- [ ] 3.2 Implementar pré-checagens fail-closed: loja existente, `stores.cnpj_normalized` canônico, `stores.cnpj_root_hash` compatível e ausência de enrollment sem evidência. Critério: qualquer divergência aborta com código `F50_4_PRECHECK_*` e nenhuma linha alterada.
- [ ] 3.3 Fazer o backfill exclusivamente por `store_id → stores.cnpj_normalized`, sem usar `user_id`, nome, e-mail ou suposição. Critério: contagem de enrollments preenchidos = contagem elegível; zero atribuição ambígua.
- [ ] 3.4 Aplicar `NOT NULL`/CHECK do CNPJ completo, `UNIQUE(beneficiary_cnpj_normalized)`, manter `UNIQUE(store_id)`, criar índice único parcial `(root_hash) WHERE policy_cohort='root_legacy'` e remover `UNIQUE(root_hash)` global. Critério: duas filiais podem coexistir; dois legados da mesma raiz não.
- [ ] 3.5 Criar trigger de imutabilidade de `beneficiary_cnpj_normalized`, `policy_cohort`, `store_id`, `root_hash`, `user_id`, `started_at` e `expires_at`. Critério: updates nesses campos falham, inclusive tentativa de mover o enrollment para dentro/fora do índice parcial; updates de `granted_total`/`last_granted_seq` funcionam.
- [ ] 3.6 Substituir `trial_offer_eligibility` com resolução de coorte, identidade do beneficiário, `root_used_other_beneficiary` apenas para enrollment `root_legacy`, `prior_benefit_ambiguous`, benefício anterior por CNPJ completo e sigilo de outra filial. Critério: nenhuma resposta retorna enrollment, saldo ou CNPJ de outra loja; F50.4 de outro CNPJ não bloqueia a conta legada.
- [ ] 3.7 Substituir `record_onboarding_completion` preservando o relógio, readiness, gravação única e contrato de retorno; não criar enrollment. Critério: regressão F50.2 idêntica com marco nulo.
- [ ] 3.8 Substituir `start_trial_offer_enrollment` com lock da loja, advisory lock de raiz, insert de identidade/coorte, conflito escopado a `store_id` e parcela 0 no mesmo `p_now`. Critério: concorrência do mesmo CNPJ gera um enrollment e um grant; conflito de outra filial não retorna dados; `per_cnpj_f50_4` de outro CNPJ não bloqueia conta legada em nenhuma ordem de chegada.
- [ ] 3.9 Preservar `grant_trial_offer_installment` e `process_trial_offer_installments` sem mudança de valor/calendário; ajustar somente o necessário para múltiplos enrollments por raiz. Critério: suíte de parcelas e cron sem regressão.
- [ ] 3.10 Escrever testes SQL de M2: backfill seguro, aborto ambíguo, matriz com três CNPJs da mesma raiz, mesmo CNPJ concorrente, filial nunca vê outra, ordem de chegada legado × F50.4, imutabilidade de `policy_cohort`, legado intacto, CNPJ numérico e alfanumérico. Critério: todos em PostgreSQL real, sem mocks.

## 4. Migration M3 — coexistência e protocolo de concorrência

- [ ] 4.1 Substituir `grant_demo_credits` preservando 10/168, um por raiz, `trial_offer_applies` por `launch_at` e `trial_offer_consumed` para o legado; considerar apenas enrollment `root_legacy` na barreira de raiz e adicionar checagem por CNPJ completo na nova coorte. Critério: nenhuma conta em/a partir de `launch_at` recebe demo; filial F50.4 de outro CNPJ não bloqueia a conta anterior.
- [ ] 4.2 Substituir `grant_monthly_credits`: excluir raiz apenas por enrollment `root_legacy`; recipiente somente `root_legacy` sem enrollment; loja `per_cnpj_f50_4` nunca recipiente; preservar limite/ciclo/cap/idempotência. Critério: filial nova não reduz o mensal da matriz legada em nenhuma ordem de chegada.
- [ ] 4.3 Adicionar `details.skipped_new_policy_store` sem quebrar o shape canônico existente. Critério: contrato de retorno validado.
- [ ] 4.4 Escrever testes SQL de M3: raiz com enrollment legado pulada; raiz só com filial F50.4 mantém matriz legada; loja nova não recebe mensal; conta antiga preservada; configuração intacta; ordem de chegada não altera demo/mensal. Critério: todos passam em PostgreSQL real.
- [ ] 4.5 Implementar o advisory lock de raiz em `grant_demo_credits` na ordem `loja → raiz → constraint → credit_balances`. Critério: demo concorrente com trial não concede com base em estado obsoleto.
- [ ] 4.6 Implementar o advisory lock de raiz em `grant_monthly_credits` antes de tocar no saldo do recipiente; não adquirir raiz depois de `credit_balances`. Critério: trial × mensal concorrentes serializam sem deadlock.
- [ ] 4.7 Implementar o advisory lock de raiz em `admin_grant_freemium_exception` na mesma ordem, preservando a exceção como ato manual auditado. Critério: trial × exceção concorrentes observam o estado commitado.
- [ ] 4.8 Manter `grant_trial_offer_installment`, `materialize_demo_expiration_at` e `refund_credit_at` fora do advisory de raiz, com ordem `enrollment → credit_balances`. Critério: nenhuma ordem invertida introduzida.

## 5. Aplicação — coorte, helper e retry

- [ ] 5.1 Estender os tipos/mapeamentos de `completion.ts` para `policy_cohort`, motivos novos e `existing` por loja, sem expor CNPJ/`root_hash`. Critério: contrato de resposta seguro.
- [ ] 5.2 Ajustar `maybeCompleteOnboardingAndStartTrial` e `retryTrialOfferEnrollment` para preservar a coorte e o `onboarding_completed_at` original, sem reenviar onboarding nem chamar provider. Critério: retry idempotente.
- [ ] 5.3 Revisar `CreditService.getTrialOfferEnrollment(storeId)` e qualquer consulta de enrollment para garantir escopo por loja, sem agregação por raiz. Critério: nenhuma consulta assume uma linha por raiz.
- [ ] 5.4 Ajustar a chamada do helper nas rotas reais de cadastro, atualização de CNPJ, salvamento da loja e aprovação. Critério: todos os caminhos continuam acionando a oferta uma única vez.
- [ ] 5.5 Garantir que autosave, drift, imagem/logo, perfil e assinatura não reiniciem a oferta nem alterem `started_at`/`expires_at`. Critério: testes de regressão F50.3 verdes.

## 6. Aplicação — avaliação cadastral e mensagens

- [ ] 6.1 Estender `FreemiumEligibilityInput/Output` e `evaluateFreemiumEligibility` com `policyCohort`, `beneficiaryEligible` e o motivo `beneficiary_already_used`, preservando a ordem D10 e a pureza do motor. Critério: `root_already_used` só na coorte legada/ausente.
- [ ] 6.2 Resolver coorte e `beneficiaryEligible` server-side em `/api/store` e `/api/store/update-cnpj`, usando CNPJ completo para a nova coorte e raiz para o legado. Critério: filial nova não é rejeitada por benefício da matriz.
- [ ] 6.3 Ajustar mensagens de criação/atualização para não dizer que a filial “já utilizou o benefício” quando ela é elegível à F50.4, sem prometer créditos que o legado não concede. Critério: mensagens testadas por coorte.
- [ ] 6.4 Revisar o painel de revisão administrativa e exibições de histórico para não tratar `freemium_entitlements` por raiz como prova de inelegibilidade da F50.4. Critério: histórico legado permanece legível e mascarado.
- [ ] 6.5 Adicionar testes do motor e dos callers para: legado com `root_already_used`, nova coorte com raiz usada e CNPJ novo, mesmo CNPJ com benefício anterior, coorte ausente compatível. Critério: sem regressão dos cenários existentes.

## 7. Aplicação — painel, status e crédito manual

- [ ] 7.1 Estender a leitura do painel “Teste gratuito de 28 dias” com `individual_launch_at` e estado da coorte, sem exibir CNPJ completo. Critério: estado nulo/ativo e feedback de erro/sucesso.
- [ ] 7.2 Adicionar a ação separada de ativação da F50.4 no painel/rota, com motivo, confirmação, CSRF, `requireAdmin` e idempotência. Critério: em produção, a ação permanece não executada; em banco descartável, funciona para testes/UAT sob identidade revalidada.
- [ ] 7.3 Garantir que ligar/desligar a oferta e ativar o marco (controladamente, em descartável) não alterem a configuração mensal, saldos, entitlements ou parcelas. Critério: testes de não efeito colateral.
- [ ] 7.4 Confirmar que `admin_grant_credits` não cria/alterar enrollment, não consome parcela, não muda `granted_total` e não reinicia a janela. Critério: teste SQL e teste de serviço.
- [ ] 7.5 Confirmar que `admin_exception` continua bloqueando o mesmo CNPJ e que `admin_grant` histórico não é reclassificado; texto livre não altera a classificação estruturada. Critério: cenários fechados e documentados, sem alteração de dados.
- [ ] 7.6 Revisar textos de status/conta para não prometer “10 créditos de boas-vindas” a contas da nova coorte e não expor dados de outra filial. Critério: inspeção de copy e testes de UI.

## 8. Provas reais em PostgreSQL e CLI Supabase

- [ ] 8.1 Criar harness descartável com identidade/saúde revalidadas; registrar versão exata do Supabase CLI e do PostgreSQL; não usar produção nem banco isolado antigo sem revalidação. Critério: gate de identidade aprovado antes de qualquer comando DB.
- [ ] 8.2 Aplicar M1–M3 pelo CLI Supabase efetivamente usado, em PostgreSQL descartável, e conferir ledger, constraints convalidadas e ausência de erro de parser/`42601`. Critério: exit 0 e ledger com as versões.
- [ ] 8.3 Reproduzir o cenário do incidente de parser da F50.3 como regressão do CLI; confirmar que identificadores/constraints reais continuam válidos. Critério: nenhuma falha de parser.
- [ ] 8.4 Executar a matriz SQL: matriz + duas filiais; mesmo CNPJ concorrente; filial não vê outra; conta anterior com onboarding tardio; enrollment existente intacto; benefício anterior sem repetição; apenas crédito manual não bloqueia; crédito manual durante a oferta; retry sem duplicação; oferta desligada sem fallback; ordem de chegada legado × F50.4 sem assimetria; CNPJ numérico e alfanumérico. Critério: todos os cenários com evidência.
- [ ] 8.5 Executar provas cruzadas de concorrência: trial × demo, trial × mensal, trial × exceção administrativa, demo × exceção, mensal × trial e filial F50.4 × conta legada. Critério: ordem de locks consistente, sem duplicação por leitura obsoleta e sem deadlock.
- [ ] 8.6 Executar regressão SQL do legado: F50.2 com marco nulo, demo 10/168 para conta antiga, mensal por raiz, parcelas/cron, estorno/expiração e `admin_exception`. Critério: nenhuma alteração de valor/data/saldo.
- [ ] 8.7 Testar rollback/forward-fix: antes de existir `per_cnpj_f50_4`, reverter é seguro; depois de duas filiais, confirmar que `UNIQUE(root_hash)` global NÃO é restaurado e que desligar a oferta preserva dados. Critério: procedimento documentado e provado.

## 9. Gates automáticos e regressão de aplicação

- [ ] 9.1 Atualizar `trial-offer-sql.contract.test.ts` para a nova identidade, coortes, constraints parciais e ausência de `UNIQUE(root_hash)` global. Critério: contrato 100% verde.
- [ ] 9.2 Atualizar/criar testes de concorrência, idempotência e retry da oferta. Critério: nenhuma duplicação sob corrida simulada.
- [ ] 9.3 Atualizar testes de criação de loja, `update-cnpj`, aprovação, retry, painel admin e status/conta. Critério: suítes afetadas verdes.
- [ ] 9.4 Atualizar testes de `freemium-risk-service`, entitlement e mensagens. Critério: cenários legados e F50.4 verdes.
- [ ] 9.5 Executar `npm run typecheck`, `npm run lint` e `npm run build`. Critério: exit 0.
- [ ] 9.6 Executar `openspec validate "fase-50-4-oferta-onboarding-por-cnpj" --strict` e `git diff --check`. Critério: válido e diff limpo.
- [ ] 9.7 Revisar segurança: sigilo do CNPJ/`root_hash`, isolamento por loja, RLS/grants, CSRF/`requireAdmin`, ausência de vazamento em logs e respostas. Critério: achados High/Critical fechados ou bloqueio registrado.

## 10. UAT, checkpoints e encerramento documental

- [ ] 10.1 Preparar roteiro UAT com a matriz de coortes, mensagens, painel, locks e limites; distinguir explicitamente “ativação produtiva não executada” de “ativação controlada em banco descartável para UAT”. Critério: roteiro revisado.
- [ ] 10.2 Executar UAT de regressão F50.2/F50.3: conta existente, parcelas, demo/mensal, cadastro, autosave, drift, CNPJ numérico/alfanumérico, retry e oferta desligada. Critério: 0 falhas; limitações explicitadas.
- [ ] 10.3 Executar UAT da nova política em banco descartável com o marco ativado controladamente: matriz + duas filiais, mesmo CNPJ, crédito manual, benefício anterior, ordem de chegada e ausência de fallback. Critério: evidência anexada; ambiente efêmero e destruído; produção sem marco.
- [ ] 10.4 Realizar checkpoint humano A (pré-implementação) e checkpoint humano B (pré-publicação) com revisão de migrations, testes, locks e riscos. Critério: aprovação registrada; sem aprovação, parar.
- [ ] 10.5 Registrar as decisões fechadas (entitlement órfão com `prior_benefit_ambiguous` e resolução manual; `admin_grant` regido pela classificação estruturada) e a única decisão diferida (data/procedimento da ativação produtiva). Critério: nenhuma questão fechada reaberta; nenhuma compensação automática.
- [ ] 10.6 Preparar resumo de encerramento da base OpenSpec com matriz, inventário, evidências e próximo comando; **não** iniciar GSD, merge, push, deploy, ativação produtiva ou aplicação em produção. Critério: base pronta para revisão humana e `/gsd-plan-phase` posterior.
