# Matriz — comportamento atual → regra nova → arquivos/RPCs afetados

> Artefato de apoio da proposta reduzida `oferta-teste-gratuito-28-dias`. Nenhuma linha foi implementada.

| # | Comportamento atual | Regra nova | Arquivos / RPCs | Risco |
|---|---|---|---|---|
| 1 | Demo 10/168 na criação/aprovação | Conta nova (coorte por `launch_at`): sem demo legada, mesmo com chave desligada; teste começa no onboarding. Conta antiga: legado | `grant_demo_credits`, rotas de cadastro/aprovação | Gate no SQL cobre todos os chamadores; não alterar env |
| 2 | Elegibilidade no momento da criação | `auth.users.created_at >= launch_at` (marco imutável) + raiz sem enrollment/benefício | `trial_offer_settings`, `trial_offer_enrollments`, RPC de início | Conta antiga com onboarding posterior não recebe; reativação não muda a coorte |
| 3 | Sem timestamp de conclusão | `stores.onboarding_completed_at` + helper central com conclusão e inscrição separadas; falha retorna `retryable_failure` | `record_onboarding_completion`, `start_trial_offer_enrollment`, readiness, helper nas rotas reais de cadastro/aprovação/perfil | Testar as rotas reais, não apenas o helper; repetição usa o início original |
| 4 | `grant_credits(demo)` redefine o episódio | Parcelas preservam origem/ciclo/vencimento e anexam contribuintes | `grant_trial_offer_installment` | Não reutilizar `grant_credits(demo)` para parcelas 1..3 |
| 5 | Um grant demo com TTL | 4 × 5 fixos, máximo 20, vencimento único 28d | `trial_offer_enrollments`; `grant_trial_offer_installment` | Regras fixas, sem tabela configurável |
| 6 | Cron demo só expira/reconcilia | Também processa parcelas e recupera atrasos; elegível no dia, creditada na execução diária seguinte | `process_trial_offer_installments`; `/api/cron/demo-credits` | Recuperação não estende prazo; sem rota nova; sem promessa de segundo exato |
| 7 | Mensal por raiz para qualquer histórico | Raiz com enrollment do teste é pulada permanentemente; contas antigas inalteradas | `grant_monthly_credits` | Sem “mensal volta após o teste”; config/chave intactas; não depende de `enabled` |
| 8 | UI “demonstração”/“ganhe 10 créditos” | Estados do teste, vencimento, próxima parcela, aviso de cron diário e retry seguro | `demo-status.ts`, `balance-card.tsx`, `conta/page.tsx`, `labels.ts` | Sem novos tipos de notificação/e-mails |
| 9 | Auditoria de flags existente | Reutilizada para habilitar/desabilitar a oferta; `launch_at` só na primeira ativação | `admin_set_trial_offer_enabled`, `admin_audit_log` | Sem auditoria paralela |
| 10 | Produto 1:1 aberto | Nenhuma alteração | `src/lib/product-1-1/**`, `src/lib/ai/**`, prompts, `56.2.7` | Fora de escopo por contrato |
