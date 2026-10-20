# Tasks — Oferta de teste gratuito de 28 dias

> **Estado:** proposta reduzida para revisão. Nenhuma tarefa foi executada. Nenhuma migration foi aplicada, nenhum dado/env/flag foi alterado, nenhum deploy ou chamada paga ocorreu. A implementação depende de aprovação explícita posterior.

> **Estado final (2026-10-20):** implementação, publicação e UAT de produção concluídas; 42/42 tasks reconciliadas. A primeira parcela permanece acompanhamento operacional aberto em `MONITORING.md` e NÃO está comprovada antecipadamente.

## 1. Banco e concessões

- [x] 1.1 Criar migration aditiva de `trial_offer_settings` (singleton `offer_key='trial_28d_v1'`, `enabled=false`, `launch_at` nulo) com bloco `REVERT` comentado.
- [x] 1.2 Adicionar `stores.onboarding_completed_at TIMESTAMPTZ` nulo, sem backfill.
- [x] 1.3 Criar `trial_offer_enrollments` com `store_id`, `user_id`, `root_hash`, `offer_key`, `started_at`, `expires_at`, `granted_total`, `last_granted_seq`, `created_at`; `unique(root_hash)` e `unique(store_id)`.
- [x] 1.4 Implementar `admin_set_trial_offer_enabled(p_enabled, p_actor_id, p_reason, p_operation_id)` com auditoria em `admin_audit_log`, idempotência por `operation_id` e `launch_at = now()` **somente quando `p_enabled=true` e `launch_at` é nulo**; chamada desligada não inaugura a coorte; ligar/desligar depois preserva o marco.
- [x] 1.5 Implementar `record_onboarding_completion(p_store_id, p_now default now())` idempotente: readiness, grava `onboarding_completed_at = p_now` uma vez e confirma a transação; não cria enrollment/crédito.
- [x] 1.6 Implementar `start_trial_offer_enrollment(p_store_id, p_now default now())` idempotente: usa `onboarding_completed_at` como `started_at`, valida chave/marco/raiz/loja de teste/benefício anterior/janela de 28 dias com `p_now`, cria enrollment + parcela 0 ou retorna `expired_window`.
- [x] 1.7 Implementar `grant_trial_offer_installment(p_enrollment_id, p_seq, p_now default now())` com parcelas fixas de 5, `due_at = started_at + seq*7d`, limite 20, idempotency key única, lock no enrollment e em `credit_balances`, e preservação de origem/ciclo/vencimento do episódio.
- [x] 1.8 Implementar `process_trial_offer_installments(p_now default now())` com lock por enrollment, recuperação de atrasos em ordem, mesmo `p_now` na concessão, parada em `seq<=3` e nenhuma concessão em/depois de `expires_at`.
- [x] 1.9 Adicionar gate em `grant_demo_credits`: `trial_offer_applies` para conta `>= launch_at` **independentemente de `enabled`**; `trial_offer_consumed` para raiz com enrollment; legado apenas para conta anterior ao marco.
- [x] 1.10 Adicionar guard em `grant_monthly_credits`: raiz com enrollment é pulada com `skipped_trial_offer_cohort`; configuração/chave e contas antigas inalteradas; a exclusão não depende de `enabled`.
- [x] 1.11 Extrair `materialize_demo_expiration_at`/`refund_credit_at` com `p_now`, mantendo as funções públicas legadas delegando com `now()`.
- [x] 1.12 Revisar privilégios (`SECURITY DEFINER`, `search_path=''`, `REVOKE`/`GRANT` para `service_role`) e `REVERT`; não aplicar migrations.

## 2. Integração

- [x] 2.1 Criar módulo puro `trial-offer` com constantes fixas (5, dias 0/7/14/21, 28 dias, máximo 20), tipos e `getTrialOfferStatus`.
- [x] 2.2 Criar helper server-side central `maybeCompleteOnboardingAndStartTrial(storeId)` que retorna um estado seguro (`started`, `not_ready`, `offer_disabled`, `not_eligible`, `expired_window`, `retryable_failure`) e nunca quebra o salvamento do onboarding; criar `retryTrialOfferEnrollment(storeId)` que chama somente as RPCs de conclusão/inscrição.
- [x] 2.3 Conectar o helper nos caminhos existentes que podem concluir o onboarding: cadastro/atualização da loja/CNPJ, aprovação administrativa e sincronização do brand profile. Sem chamadas em dashboard/conta.
- [x] 2.4 Estender `/api/cron/demo-credits` para chamar `process_trial_offer_installments` antes da reconciliação atual; manter `CRON_SECRET`, expiração e notificações existentes; documentar que a parcela elegível no dia pode ser creditada na execução diária seguinte.
- [x] 2.5 Estender `CreditService` (ou leitura server-side equivalente) com enrollment, vencimento, `granted_total` e próxima parcela.
- [x] 2.6 Criar `POST /api/store/trial-offer/retry` autenticada e com ownership, chamando somente `retryTrialOfferEnrollment`, sem reenviar onboarding e sem logo/perfil/assinatura/provider; `expired_window` não é retryable.
- [x] 2.7 Atualizar `BalanceCard` e `/conta` para status do teste, vencimento, próxima parcela, aviso de execução diária e ação “Tentar novamente” em `retryable_failure` chamando a rota dedicada; em `expired_window`, informar janela encerrada sem retry; remover “ganhe 10 créditos” para contas novas.
- [x] 2.8 Ajustar textos do extrato/labels e da notificação existente com base em `metadata.credit_program='trial_28d'`, sem criar tipos novos.
- [x] 2.9 Garantir que nenhum tipo novo de notificação, e-mail semanal, checkout, plano ou assinatura foi introduzido.
- [x] 2.10 Criar `GET/PUT /api/admin/trial-offer` com `requireAdmin`, `requireSameOrigin`, Zod (`enabled`, `reason`, `operationId`), chamada `admin_set_trial_offer_enabled` e erros sanitizados; GET devolve `enabled`/`launch_at`.
- [x] 2.11 Adicionar `TrialOfferPanel` à página existente `src/app/(app)/admin/feature-flags/page.tsx` com estado atual, marco, motivo obrigatório, feedback de erro/sucesso e ação de ligar/desligar.
- [x] 2.12 Testar painel/rota: primeira ativação grava `launch_at`, desativação bloqueia novas adesões sem cancelar parcelas, reativação preserva o marco, motivo/CSRF/admin negados, idempotência/falha e ausência de efeito no mensal.

## 3. Testes e lançamento

- [x] 3.1 Testes puros de elegibilidade: antes/depois do marco, conta antiga com onboarding posterior, raiz repetida, loja de teste/sem raiz e chave desligada sem fallback para demo antiga.
- [x] 3.2 Testes de conclusão: onboarding incompleto, primeira conclusão, repetição idempotente, edição posterior sem reinício, janela de 28 dias vencida antes da inscrição e cobertura das rotas reais de cadastro/aprovação e sincronização do perfil.
- [x] 3.3 Testes de falha de início: onboarding salvo + falha em `record_onboarding_completion` ou `start_trial_offer_enrollment` retorna `retryable_failure`; repetir somente pela rota dedicada cria o enrollment; nenhum crédito é apresentado como concedido. Separar falha **antes** da conclusão (timestamp nulo; não descrever como preservado) de falha **depois** (timestamp preservado; retry usa o início original).
- [x] 3.4 Testes de retry dedicado: autenticação/ownership, chamada somente de conclusão/inscrição, ausência de onboarding/logo/perfil/assinatura/provider, idempotência e `expired_window` sem retry.
- [x] 3.5 Testes de parcelas com **um único `v_clock`/`p_now`**: dias 0/7/14/21, `due_at - 1s`, `due_at` exato, `expires_at` exato, máximo 20, nenhuma concessão no dia 28 e crédito na execução diária seguinte.
- [x] 3.6 Testes de cron/recuperação: ausência de login, atraso de vários dias, múltiplas parcelas na mesma execução e prazos originais preservados.
- [x] 3.7 Testes de duplicação e concorrência: replay da mesma parcela, dois workers, **parcela concorrente com uma dedução (`reserve_credit`)**, transação única, lock de `credit_balances` e `granted_total` incrementado uma vez.
- [x] 3.8 Testes de saldo/estorno: saldo zerado antes da próxima parcela, consumo por bucket, expiração e estorno com o mesmo `p_now` (`materialize_demo_expiration_at`/`refund_credit_at`), comprados/bônus preservados e graça de 24h restrita ao valor estornado.
- [x] 3.9 Testes de preservação: demo legada para contas antigas, mensal antigo inalterado, nova coorte excluída do mensal, chamada `p_enabled=false` não grava `launch_at`, primeira `p_enabled=true` grava e reativação preserva, ausência de backfill.
- [x] 3.10 Testes de lojas de teste: fixtures controladas no isolado comprovam a exclusão automática e a ausência de benefícios para lojas de teste existentes.
- [x] 3.11 Testes de UI: estados ativo/expira em breve/esgotado/encerrado/legado, vencimento, próxima parcela, aviso de cron diário, retry dedicado, `expired_window` sem retry, pós-teste e acesso a campanhas/downloads.
- [x] 3.12 Executar provas em Postgres local isolado com um único relógio controlado (`v_clock`/`p_now`); não esperar 28 dias e não usar provider pago.
- [x] 3.13 Executar `npm run typecheck`, `npm run lint`, `npm run build`, as suítes afetadas e `openspec validate oferta-teste-gratuito-28-dias --strict`; confirmar que o código de produção não envia `p_now`.
- [x] 3.14 Confirmar que ativação, modelos, prompts, orçamento, `56.2.7` e monitoramento beta do Produto 1:1 não foram alterados.
- [x] 3.15 Regressão do legado: `reserve_credit` e `refund_credit` continuam com assinaturas, comportamento, consumo por bucket, graça de 24h e idempotência; `materialize_demo_expiration`/`refund_credit` wrappers delegam para `_at` com `now()`.
- [x] 3.16 Verificar que nenhuma rota pública aceita `p_now`; o parâmetro só é usado por testes/backend privilegiado e o default de produção é `now()`.
- [x] 3.17 Testar a integração do painel administrativo: estado/marco, motivo, CSRF, permissão, idempotência, falha e ausência de efeito no mensal.
- [x] 3.18 Checkpoint humano de lançamento: revisar diff, aprovar publicação com `enabled=false`, habilitar a chave com `p_enabled=true` e `launch_at` nulo e executar smoke test; rollback = desabilitar a chave, preservando `launch_at` e as parcelas prometidas. **Não executar nesta proposta.**
