## Context

O ledger atual já tem buckets (`demo_balance`, `bonus_balance`, `purchased_balance`), RPCs atômicas (`grant_credits`, `reserve_credit`, `refund_credit`, `materialize_demo_expiration`), cron diário de demonstração e UI de status. A demo legada é concedida na criação/aprovação da loja com **10 créditos e 168h fixos nas chamadas SQL**, não por env var.

A oferta nova é uma regra fixa: 5 créditos no dia 0, 7, 14 e 21; vencimento único em 28 dias; início na conclusão do onboarding; somente contas criadas a partir do marco. O design reduz a entrega ao mínimo: uma chave, um marco, um enrollment, quatro concessões, o cron existente e ajustes pontuais de UI. Não há motor de promoções.

O Produto 1:1 está aberto e monitorado; ativação, modelos, prompts e orçamento não são tocados. Não há fase ativa nem change OpenSpec ativa; a numeração será resolvida no GSD sem ampliar o escopo.

## Goals / Non-Goals

**Goals:**

- Persistir a chave de novas adesões e o marco `launch_at`.
- Registrar por beneficiário: início, vencimento e identificação da oferta.
- Conceder 4 × 5 créditos fixos, com máximo de 20, idempotência e proteção por raiz de CNPJ.
- Usar o cron existente para parcelas e vencimento.
- Reutilizar saldo, ledger, consumo, estorno, auditoria e notificações existentes.
- Preservar integralmente contas antigas, saldos, históricos, comprados, bônus e a configuração/chave mensal.

**Non-Goals:**

- Tabela configurável de parcelas, máquina de estados, auditoria paralela ou central de promoções.
- Cancelamento de parcelas futuras após a adesão.
- Novos tipos de notificação, e-mails semanais, checkout, planos ou assinatura.
- Backfill, conversão retroativa ou renovação de elegibilidade por nova conta/loja.
- Alterar ativação, modelos, prompts ou orçamento do Produto 1:1.

## Decisions

### D1 — Uma chave e um marco persistido

**Decisão:** criar `trial_offer_settings` singleton com `offer_key='trial_28d_v1'`, `enabled boolean` e `launch_at timestamptz`. A RPC administrativa `admin_set_trial_offer_enabled(p_enabled, p_actor_id, p_reason, p_operation_id)` atualiza a linha e grava `admin_audit_log` na mesma transação, reutilizando a auditoria existente. `launch_at` recebe valor **somente quando `p_enabled=true` e `launch_at` ainda é nulo**; uma chamada inicial com a oferta desligada não inaugura a coorte. Qualquer ligar/desligar posterior preserva o marco, os enrollments existentes e a política da coorte já criada. `enabled=true` com o mesmo `operation_id` é no-op.

**Rationale:** uma única oferta fixa não precisa de política versionada nem de estados `draft/active/paused/retired`. A chave booleana resolve novas adesões; o marco fica auditável.

**Alternativas:** `feature_flags` não guarda timestamp; uma tabela configurável de regras seria maior que a entrega.

### D2 — Enrollment por beneficiário, sem estado

**Decisão:** criar `trial_offer_enrollments` com `id`, `store_id`, `user_id`, `root_hash`, `offer_key`, `started_at`, `expires_at`, `granted_total`, `last_granted_seq`, `created_at`. `unique(root_hash)` e `unique(store_id)` protegem contra repetição por CNPJ e por loja. Não há coluna `status`: o vencimento é derivado de `p_now >= expires_at` na cadeia testada (ou `now()` em produção); as parcelas são derivadas de `started_at` e `last_granted_seq`.

**Rationale:** o registro necessário é início, vencimento e identificação da oferta. Evita máquina de estados e tabela de parcelas.

**Alternativas:** `freemium_entitlements` com novo `benefit_type` ampliaria uma tabela compartilhada e exigiria outra spec; uma tabela de parcelas seria redundante porque o ledger já registra cada concessão.

### D3 — Início na conclusão do onboarding por um helper central

**Decisão:** adicionar `stores.onboarding_completed_at` e implementar duas operações idempotentes atrás de um único helper, ambas com `p_now TIMESTAMPTZ DEFAULT now()` para testabilidade (em produção, default = horário do servidor):

1. `record_onboarding_completion(p_store_id, p_now)` — adquire lock na loja; se `onboarding_completed_at` for nulo, avalia `check_store_readiness(p_store_id)`; se `ready=false`, retorna `not_ready` sem gravar; se `ready=true`, grava `onboarding_completed_at = p_now` uma única vez e confirma a transação. Retorna `completed`, `eligible`, `expired_window` e o motivo de inelegibilidade, se houver.
2. `start_trial_offer_enrollment(p_store_id, p_now)` — exige `onboarding_completed_at` não nulo, usa esse valor como `started_at` (nunca `p_now`), valida a chave habilitada, `auth.users.created_at >= launch_at`, raiz não vazia, `is_test_store=false`, ausência de enrollment/benefício anterior e `p_now < onboarding_completed_at + 28 days`; cria o enrollment com `expires_at = started_at + 28 days` e concede a parcela 0 com o mesmo `p_now`. É idempotente e pode ser repetida. Se a janela já venceu, retorna `expired_window` sem criar enrollment.

O helper chama as duas operações depois do salvamento bem-sucedido do onboarding, nos caminhos existentes: cadastro/atualização da loja/CNPJ, aprovação administrativa e sincronização do brand profile (texto/logo/assinatura). Não há chamadas em dashboard/conta, diagnósticos ou reparadores.

**Falha ao concluir:** se o onboarding foi salvo, mas qualquer etapa da operação de início falhou, o helper não engole a falha. A resposta da operação inclui `trialOffer.status='retryable_failure'` (sem detalhe interno) e a UI permite repetir **somente a conclusão/inscrição**, por uma rota dedicada autenticada e com ownership. O retry **não** reenvia o onboarding e **não** reexecuta logo, perfil, assinatura ou provider. A repetição chama as duas RPCs; `record_onboarding_completion` é no-op se a conclusão já existir e `start_trial_offer_enrollment` usa o `onboarding_completed_at` original. Nenhum reparador ou infraestrutura nova é criado. Os estados seguros são `started`, `not_ready`, `offer_disabled`, `not_eligible`, `expired_window` e `retryable_failure`.

**Rationale:** centraliza a regra e evita espalhar lógica por telas. Separar conclusão e inscrição preserva o início original quando a concessão falha, sem tornar o salvamento do onboarding refém do crédito. O retry dedicado evita repetir chamadas pagas; `retryable_failure` e `expired_window` evitam que a falha fique invisível.

**Alternativas:** uma única RPC atômica (uma falha deslocaria o início para a repetição); trigger de banco (dificulta readiness e distingue transição); iniciar no cron (inicia na detecção, não na conclusão); botão “Concluir” novo (mais UI e um caminho que o usuário pode não acionar); retry reenviando a rota de onboarding (poderia repetir provider); esconder a falha e exigir novo save (não atende à regra de repetição).

**Limitação:** readiness depende de dados fiscais + brand profile; por isso o helper é chamado nos caminhos existentes que podem tornar a loja pronta. Os testes de integração devem cobrir as rotas reais de cadastro/aprovação e de sincronização do perfil, não apenas o helper.

### D4 — Quatro concessões fixas e episódio demo preservado

**Decisão:** as parcelas são constantes: `seq 0..3`, `amount=5`, `due_at = started_at + seq * 7 days`, `expires_at = started_at + 28 days`. A RPC `grant_trial_offer_installment(p_enrollment_id, p_seq, p_now TIMESTAMPTZ DEFAULT now())`:

- adquire lock no enrollment e, em seguida, lock na linha de `credit_balances` do beneficiário (`INSERT ... ON CONFLICT DO NOTHING` + `SELECT ... FOR UPDATE`), na mesma ordem em toda a cadeia;
- recusa sequência fora de 0..3, `p_now < due_at`, `p_now >= expires_at`, `seq != last_granted_seq + 1` e `granted_total + 5 > 20`;
- insere transação `demo` de 5 com `idempotency_key = 'trial28d:' || enrollment_id || ':' || seq` e metadata `credit_program='trial_28d'`, `offer_key`, `enrollment_id`, `installment_seq`, `due_at`, `expires_at`;
- incrementa `demo_balance` sob o lock da linha, de forma atômica com consumo/estorno/expiração;
- define `demo_expires_at = enrollment.expires_at` e, apenas na primeira parcela, `origin_demo_grant_tx_id = tx_id` e `demo_cycle_id = tx_id`;
- preserva origem/ciclo nas parcelas seguintes e anexa o `tx_id` a `demo_contributing_tx_ids`;
- atualiza `last_granted_seq` e `granted_total`.

**Rationale:** `grant_credits(p_type='demo')` redefine origem/ciclo a cada chamada e quebraria a graça de 24h. A RPC própria estende o mesmo episódio, sem novo bucket/tipo.

**Alternativas:** alterar `grant_credits` (risco para o legado); novo tipo `trial_28d` (muda CHECKs, labels e relatórios sem ganho).

### D5 — Cron existente, idempotência e recuperação

**Decisão:** estender `/api/cron/demo-credits` para chamar `process_trial_offer_installments(p_now default now())` antes da reconciliação atual. A RPC:

- percorre enrollments com `expires_at > p_now` e `last_granted_seq < 3` com `FOR UPDATE SKIP LOCKED`;
- concede, em ordem, todas as parcelas cujo `due_at <= p_now` (recuperação de atraso), passando **o mesmo `p_now`** para `grant_trial_offer_installment`;
- não estende `expires_at` e não concede em/depois de `expires_at`;
- isola falhas por enrollment e retorna contadores.

**Relógio único:** as provas usam um único instante `p_now`, propagado por `record_onboarding_completion`, `start_trial_offer_enrollment`, `grant_trial_offer_installment`, `process_trial_offer_installments`, `materialize_demo_expiration_at` e `refund_credit_at`. As funções legadas `materialize_demo_expiration` e `refund_credit` permanecem públicas e delegam para as variantes `_at` com `now()`; em produção, a aplicação **não envia** `p_now` e o default `now()` do servidor é o único relógio. As RPCs são restritas a `service_role`. Nenhum teste simula apenas o loop externo.

A expiração continua disponível em `materialize_demo_expiration` para o cron atual; a variante `materialize_demo_expiration_at(p_store_id, p_now)` é usada na cadeia testada e pelo processamento novo quando necessário. A deduplicação usa a `idempotency_key` única da transação, o lock do enrollment e o lock de `credit_balances`. O cron é independente de login; uma chamada oportunista no acesso do usuário não é necessária nesta entrega.

**Precisão de comunicação:** como o cron é diário, a parcela fica elegível no dia 7/14/21, mas só é creditada na execução diária seguinte (ou na primeira execução após o horário de elegibilidade). A UI e a documentação SHALL NOT prometer liberação no segundo exato. A recuperação de atraso não muda o `expires_at` original.

**Rationale:** um único cron diário já existe e a recuperação de atrasos cobre a precisão do plano Vercel. Menos infraestrutura e menos superfície.

**Alternativas:** nova rota/agenda (mais configuração); processar no login (não recupera sem login).

### D6 — Precedência por coorte, sem “mensal volta depois”

**Decisão:**

- **Contas antigas** (`auth.users.created_at < launch_at`): demo legada e bônus mensal permanecem exatamente como hoje.
- **Contas novas** (`>= launch_at`): a criação/aprovação da loja não concede demo legada (`grant_demo_credits` retorna `trial_offer_applies`), **independentemente de a chave estar habilitada ou desabilitada**. O teste começa no onboarding quando a chave está habilitada; com a chave desabilitada, a conta continua sem demo legada e sem teste até uma decisão posterior.
- **Chave desligada não restaura a política anterior**: a classificação da coorte é feita por `launch_at`, não por `enabled`. Nenhuma conta da nova coorte cai automaticamente na demo antiga por a chave estar desligada. Reabilitar não cria inscrições retroativas; uma admissão posterior exige operação explícita, sem backfill.
- **Raízes com enrollment**: `grant_demo_credits` retorna `trial_offer_consumed`; `grant_monthly_credits` pula a raiz com `skipped_trial_offer_cohort`, sem criar entitlement mensal e sem conceder crédito. Isso vale também após o vencimento do teste: não existe retorno automático ao mensal.
- **Direitos já concedidos** (demo, onboarding, admin_exception, mensal) permanecem utilizáveis; nenhum é cancelado ou convertido.
- Qualquer benefício posterior para a nova coorte exige uma política aprovada explicitamente em uma change futura.

**Rationale:** cumpre “preservar direitos anteriores” e “impedir benefícios extras involuntários” sem decidir automaticamente o que acontece depois do teste. A configuração e a chave mensal legadas não são alteradas.

**Alternativas:** pausar o mensal só durante o teste e retomar depois (decisão automática que o usuário pediu para retirar); desligar o mensal globalmente (afetaria contas antigas).

### D7 — Rollback simples e UI pontual

**Decisão:** o rollback é desabilitar a chave. Novas adesões param; enrollments existentes continuam recebendo as quatro parcelas e o vencimento original. Não há cancelamento de parcelas futuras, clawback ou migração retroativa. A UI:

- `getTrialOfferStatus` deriva `not_started | active | expiring_soon | exhausted | expired | legacy_demo` a partir do enrollment e do bucket demo;
- `BalanceCard`/`/conta` exibem status, saldo disponível, vencimento local e próxima parcela;
- quando a operação de onboarding retorna `retryable_failure`, a UI mostra um aviso seguro e uma ação “Tentar novamente” que chama a **rota dedicada de retry** (`POST /api/store/trial-offer/retry`), autenticada e com ownership; ela repete somente conclusão/inscrição, sem reenviar onboarding e sem reexecutar logo/perfil/assinatura/provider;
- quando o estado é `expired_window`, a UI informa que a janela de 28 dias foi encerrada e **não** oferece retry;
- a próxima parcela informa que fica elegível no dia 7/14/21 e pode ser creditada na execução diária seguinte, sem prometer o segundo exato;
- textos que prometem “10 créditos” não aparecem para contas novas;
- notificações existentes (`demo_granted`, `demo_expiring_24h`, `demo_expired`) continuam sendo usadas com dedup por transação/expiração; nenhum tipo novo é criado;
- a página existente **Controles operacionais** (`src/app/(app)/admin/feature-flags/page.tsx`) recebe o painel “Teste gratuito de 28 dias” com estado atual (`enabled`, `launch_at`), motivo obrigatório, feedback de erro/sucesso e ação de ligar/desligar. O painel chama uma rota administrativa autenticada (`requireAdmin`) e protegida contra CSRF (`requireSameOrigin`), que usa `admin_set_trial_offer_enabled`. Primeira ativação grava `launch_at`; desativação bloqueia novas adesões sem cancelar parcelas prometidas; reativação preserva o marco; o painel não altera nem aciona a política mensal legada.

**Rationale:** o benefício prometido é preservado; o rollback não reescreve histórico. A UI reutiliza as superfícies existentes e não esconde a falha de início.

## Matriz — comportamento atual → regra nova → arquivos/RPCs afetados

| # | Comportamento atual | Regra nova | Arquivos / RPCs |
|---|---|---|---|
| 1 | Demo 10/168 na criação/aprovação | Conta nova: sem demo legada, mesmo com chave desligada; teste começa no onboarding. Conta antiga: legado | `grant_demo_credits`, rotas de cadastro/aprovação |
| 2 | Elegibilidade no momento da criação | `auth.users.created_at >= launch_at` (marco imutável) + raiz sem enrollment/benefício | `trial_offer_settings`, `trial_offer_enrollments`, RPC de início |
| 3 | Sem timestamp de conclusão | `stores.onboarding_completed_at` + helper central com conclusão e inscrição separadas; falha retorna `retryable_failure`/`expired_window`; retry dedicado sem provider | `record_onboarding_completion`, `start_trial_offer_enrollment`, retry route, readiness, helper nas rotas de cadastro/aprovação/perfil |
| 4 | `grant_credits(demo)` redefine o episódio | Parcelas preservam origem/ciclo/vencimento e anexam contribuintes, com lock em `credit_balances` | `grant_trial_offer_installment` |
| 5 | Um grant demo com TTL | 4 × 5 fixos, máximo 20, vencimento único 28d, relógio `p_now` | `trial_offer_enrollments`; `grant_trial_offer_installment` |
| 6 | Cron demo só expira/reconcilia | Também processa parcelas e recupera atrasos; elegível no dia, creditada na execução diária seguinte; mesmo `p_now` na cadeia | `process_trial_offer_installments`; `/api/cron/demo-credits`; `materialize_demo_expiration_at` |
| 7 | Mensal por raiz para qualquer histórico | Raiz com enrollment do teste é pulada permanentemente; contas antigas inalteradas | `grant_monthly_credits` |
| 8 | UI “demonstração”/“ganhe 10 créditos” | Estados do teste, vencimento, próxima parcela, aviso de cron diário, retry dedicado e `expired_window` | `demo-status.ts`, `balance-card.tsx`, `conta/page.tsx`, `labels.ts` |
| 9 | Auditoria de flags existente | Reutilizada para habilitar/desabilitar a oferta; `launch_at` só quando `p_enabled=true` e nulo | `admin_set_trial_offer_enabled`, `admin_audit_log` |
| 10 | Produto 1:1 aberto | Nenhuma alteração | `src/lib/product-1-1/**`, `src/lib/ai/**`, prompts, `56.2.7` |
| 11 | Flags operacionais têm painel admin | Painel “Teste gratuito de 28 dias” em Controles operacionais | `src/app/(app)/admin/feature-flags/page.tsx`, `trial-offer-panel.tsx`, `src/app/api/admin/trial-offer/route.ts` |

## Risks / Trade-offs

- **Ponto de conclusão incompleto** → o helper cobre os caminhos que podem tornar a loja pronta: cadastro/aprovação da loja e sincronização do brand profile. Os testes devem exercitar as rotas reais, não apenas o helper. Não há chamadas em dashboard/conta nesta entrega.
- **Falha na operação de início** → o onboarding salvo e a conclusão permanecem; a resposta retorna `retryable_failure` (ou `expired_window`) e a UI oferece retry **somente** da conclusão/inscrição. A repetição usa o início original, é idempotente, não duplica crédito e não reexecuta provider.
- **Retry reexecutando geração** → a rota dedicada não reenvia onboarding e não chama logo/perfil/assinatura; testes verificam que nenhum provider é chamado.
- **Duplicação/concorrência** → `unique(root_hash)`, `unique(store_id)`, `last_granted_seq`, lock do enrollment, lock de `credit_balances` e `idempotency_key` única na transação; teste de parcela concorrente com dedução.
- **Relógio divergente nos testes** → um único `p_now` é propagado por conclusão, inscrição, parcelas, expiração (`_at`) e estorno (`_at`); em produção, defaults usam `now()`.
- **Parcela atrasada** → o cron concede todas as vencidas em ordem, mantendo `due_at`/`expires_at` originais.
- **Parcela no dia 28** → o loop para em `seq <= 3` (`last_granted_seq < 3`) e a expiração é materializada; nenhuma concessão reabre o teste.
- **Estorno após o vencimento** → `refund_credit` mantém a graça de 24h restrita ao valor estornado; o enrollment não tem estado para “voltar a ativo”.
- **Mensal da nova coorte** → a exclusão é permanente por enrollment; se o produto quiser benefício posterior, será uma decisão explícita futura.
- **Rollback** → desabilitar a chave não cancela parcelas já prometidas, não altera `launch_at` e não devolve a demo antiga à nova coorte.
- **Compatibilidade** → contas antigas e saldos históricos não são tocados; `VENDEO_*` e a chave mensal permanecem.
- **Cron diário** → elegibilidade no dia 7/14/21, crédito na execução diária seguinte; a recuperação cobre atrasos, sem estender o prazo. A UI não promete o segundo exato.
- **Painel administrativo** → rota com `requireAdmin` + `requireSameOrigin`, motivo obrigatório e feedback; testes cobrem 401/403, CSRF, idempotência, falha e ausência de efeito no mensal.

## Migration Plan

1. **Autoria (sem execução)**: migrations aditivas com `REVERT` comentado — `trial_offer_settings` + seed desabilitado, `stores.onboarding_completed_at`, `trial_offer_enrollments`, RPCs (com `p_now`), variantes internas `materialize_demo_expiration_at`/`refund_credit_at`, guards em `grant_demo_credits`/`grant_monthly_credits`.
2. **Provas locais**: Postgres isolado, um único `p_now` propagado por toda a cadeia, sem esperar 28 dias e sem provider pago; concorrência (parcela × dedução), replay, vencimento, preservação e cobertura das rotas reais.
3. **Pré-ativação**: aplicar migrations e publicar código com `enabled=false`; demo legada e mensal continuam para contas antigas; a nova coorte ainda não existe.
4. **Ativação**: a RPC grava `launch_at = now()` **somente quando `p_enabled=true` e `launch_at` é nulo**; chamadas com a oferta desligada não inauguram a coorte. Registrar ator/motivo/`operation_id` e deployment. Ligações/desligamentos posteriores preservam esse marco.
5. **Monitoramento**: contadores de enrollments, parcelas, atrasos, expirações e erros.
6. **Rollback**: desabilitar a chave; nenhuma migração retroativa; parcelas já prometidas continuam; a nova coorte não cai na demo antiga.

## Decisões confirmadas

1. **Mensal**: exclusão permanente das raízes inscritas no teste; contas antigas inalteradas; benefício posterior exige decisão própria.
2. **Reativação**: `launch_at` recebe valor somente quando `p_enabled=true` e ainda é nulo; ligar/desligar não altera a coorte.
3. **Conclusão**: cadastro/aprovação e sincronização do perfil são os caminhos adequados; testes devem cobrir as rotas reais.
4. **Lojas de teste**: exclusão automática mantida; validação com fixtures controladas no isolado.
5. **Chave desligada**: interrompe novas adesões, mas não devolve a demo antiga à nova coorte.
6. **Falha ao concluir**: `retryable_failure`/`expired_window` permitem repetir somente conclusão/inscrição, sem provider e sem reparador.
7. **Cron diário**: elegível no dia, creditada na execução diária seguinte; sem promessa de segundo exato.
8. **Relógio único**: `p_now` propagado por toda a cadeia testada; produção usa `now()`.
9. **Saldo compartilhado**: lock em `credit_balances` e teste de parcela concorrente com dedução.
