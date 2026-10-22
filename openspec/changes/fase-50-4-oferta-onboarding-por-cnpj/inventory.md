# Inventário de impacto — F50.4

## Banco de dados

| Objeto | Mudança | Motivo |
|---|---|---|
| `public.trial_offer_settings` | nova coluna `individual_launch_at TIMESTAMPTZ NULL`; RPC administrativa de ativação futura | marco próprio da F50.4, sem alterar `launch_at` |
| `public.trial_offer_enrollments` | `beneficiary_cnpj_normalized TEXT NOT NULL` + CHECK canônico; `policy_cohort TEXT NOT NULL DEFAULT 'root_legacy'` + CHECK | identidade do benefício e coorte persistida |
| `uq_trial_offer_enrollments_root` | removido | impedia duas filiais na mesma raiz |
| `uq_trial_offer_enrollments_store` | preservado | uma oferta por loja |
| índice único de beneficiário | criado global | um benefício por CNPJ completo |
| índice único parcial de raiz | criado `(root_hash) WHERE policy_cohort='root_legacy'` | preserva a unicidade legada sem bloquear filiais |
| trigger de imutabilidade | criado | impede reescrita de identidade, `policy_cohort`, raiz, loja, usuário, início e vencimento |
| protocolo de locks de benefício | definido em `start_trial_offer_enrollment`, `grant_demo_credits`, `grant_monthly_credits` e `admin_grant_freemium_exception` | ordem loja → raiz → constraint → saldo; parcelas/estornos fora do protocolo |
| `trial_offer_eligibility` | substituída | coortes, identidade, benefício anterior por CNPJ, motivo `root_used_other_beneficiary`/`prior_benefit_ambiguous` |
| `record_onboarding_completion` | substituída/ajustada | retorna coorte/elegibilidade sem expor CNPJ e sem criar enrollment |
| `start_trial_offer_enrollment` | substituída | advisory lock por raiz, insert com beneficiário/coorte, conflito escopado a `store_id` |
| `grant_trial_offer_installment` | sem mudança de regra; validação de que continua por enrollment | parcelas independentes por filial |
| `process_trial_offer_installments` | sem mudança de regra; regressão | recupera parcelas de múltiplos enrollments |
| `grant_demo_credits` | substituída | demo legada por coorte; `trial_offer_consumed` por CNPJ/raiz legada |
| `grant_monthly_credits` | substituída | exclusão apenas por enrollment `root_legacy`; recipiente legado; loja nova não recebe |
| `admin_set_trial_offer_enabled` | preservada | não altera `individual_launch_at` |
| nova RPC de ativação do marco | criada (não executada) | grava `individual_launch_at` uma vez, com motivo/`operation_id`, auditada |
| `public.stores` | sem alteração estrutural | `cnpj_normalized`/`cnpj_root_hash` continuam fonte de evidência |
| `public.freemium_entitlements` | sem alteração estrutural | leitura por raiz (legado) e por loja/CNPJ (nova coorte) |
| `public.credit_transactions` | sem alteração estrutural | histórico de onboarding/demo; `admin_grant` ignorado pela elegibilidade |

## Aplicação

| Arquivo | Papel |
|---|---|
| `src/lib/credit/trial-offer/completion.ts` | helper conclusão/inscrição/retry; mapear coorte e motivos sem expor CNPJ |
| `src/lib/credit/trial-offer/constants.ts` | constantes da oferta; nenhuma mudança de valor/calendário |
| `src/lib/credit/trial-offer/status.ts` | status por enrollment da loja; nenhuma mudança de regra |
| `src/lib/credit/credit-service.ts` | `getTrialOfferEnrollment(storeId)` continua por loja |
| `src/lib/cnpj/hash.ts` / `normalize.ts` / `validate.ts` | `root_hash` inalterado; CNPJ completo canônico já disponível |
| `src/app/api/store/route.ts` | resolver coorte, sinal de beneficiário, mensagem sem promessa indevida, chamada do helper |
| `src/app/api/store/update-cnpj/route.ts` | mesma resolução de coorte e mensagens; preservar F50.3 (autosave/drift) |
| `src/app/api/store/[id]/route.ts` | helper após salvamento; sem mudança de contrato |
| `src/app/api/admin/reviews/[id]/approve/route.ts` | helper após aprovação; sem mudança de contrato |
| `src/app/api/store/trial-offer/retry/route.ts` | retry dedicado; idempotente e sem provider |
| `src/app/api/cron/demo-credits/route.ts` | inalterado; processa parcelas de todos os enrollments |
| `src/app/api/cron/monthly-credits/route.ts` | inalterado; RPC mensal ajustada no banco |
| `src/app/api/admin/trial-offer/route.ts` | leitura/painel; exibir `individual_launch_at` e ação separada |
| `src/app/(app)/admin/feature-flags/page.tsx` | painel “Teste gratuito de 28 dias”; estado do marco |
| `src/app/(app)/conta/page.tsx` | status por loja; sem mudança de valor |
| `src/components/credit/balance-card.tsx` | textos/status; não expor CNPJ |
| `src/components/credit/trial-offer-retry.tsx` | retry; mensagens seguras |
| `src/lib/freemium/freemium-risk-service.ts` | `root_already_used` legado; `beneficiary_already_used` na nova coorte |
| `src/lib/freemium/entitlement-service.ts` | leitura de histórico; sem nova chave econômica |
| `src/lib/freemium/types.ts` | novos sinais/motivos do motor |
| `src/app/(app)/admin/reviews/page.tsx` | histórico legado por raiz; não reinterpretar como F50.4 |
| `src/app/(app)/admin/users/[id]/page.tsx` / `users/page.tsx` | exibição mascarada; sem CNPJ completo |

## Testes e evidências

| Arquivo/área | Cobertura |
|---|---|
| `src/lib/credit/__tests__/trial-offer-sql.contract.test.ts` | contrato SQL atualizado (constraints, RPCs, ausência de `UNIQUE(root_hash)` global) |
| `src/lib/credit/__tests__/credit-*.test.ts` | regressão de crédito, idempotência e concorrência |
| `src/__tests__/api/store-creation-matrix.test.ts` | criação, coortes e mensagens |
| `src/app/api/store/**/__tests__` | cadastro, update-cnpj, retry e F50.3 |
| `src/lib/freemium/__tests__` | motor de risco e entitlements |
| `src/app/api/admin/trial-offer/__tests__` | painel/rota administrativa |
| PostgreSQL real (descartável) | backfill, pré-checagens, constraints, concorrência cruzada trial × demo × mensal × exceção, coortes, migração via CLI, ativação controlada para UAT |
| UAT | matriz, telas, mensagens, regressão, ordem de chegada, limites e distinção produção × descartável |

## Fora de escopo / não tocar

- `src/lib/ai/**`, prompts, providers, pricing e geração.
- `src/lib/product-1-1/**` e fluxo Produto 1:1.
- Valor, calendário, limite, chave e painel de ativação existente da F50.2 além do necessário para exibir o novo marco.
- Freemium: reativação, alteração de `VENDEO_DEMO_CREDITS_*`, `VENDEO_MONTHLY_CREDITS_*` ou limites internos.
- Organizations, memberships, multi-loja, hierarquia, cobrança compartilhada e agência.
