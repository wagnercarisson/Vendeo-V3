## Why

O Vendeo hoje opera um **freemium contínuo**: 10 créditos de onboarding (`bonus_onboarding`) + 5 créditos mensais automáticos (`bonus_monthly`), sem validade, por loja. Isso não comunica uma oferta limitada e mensurável, não prepara a monetização e impede que a F51 (landing + funil) anuncie uma demonstração verdadeira. A F50 substitui esse eixo por uma **demonstração gratuita limitada e transparente** — 10 créditos válidos por 7 dias, sem cartão e sem cobrança — preservando integralmente os saldos legados, encerrando as concessões mensais e instrumentando os eventos que a F51 consumirá no funil.

## What Changes

- **Bucket de demonstração com validade** — `credit_balances` ganha `demo_balance`, `demo_expires_at` (autoritativo), `demo_cycle_id`, `origin_demo_grant_tx_id` e `demo_contributing_tx_ids`. Créditos de demonstração expiram em 168h; bônus permanece não-expirável; comprado é bucket futuro (sem checkout nesta fase).
- **Tipo de transação `demo` (concessão) e `expiration` (expiração materializada)** — débito, estorno, extrato e auditoria preservam a origem de cada parcela; **no máximo uma** transação de expiração **por episódio** de graça (zero quando o episódio termina já esgotado).
- **Ordem de consumo autoritativa** — demonstração → bônus → comprado, atômica em `reserve_credit` (`SELECT ... FOR UPDATE`), com metadata de origem (`demo_amount`/`bonus_amount`/`purchased_amount`) e **janela de graça de 24h** no estorno de demonstração ocorrido após o vencimento.
- **Concessão automática da demonstração** — substitui o onboarding grant; irrepetível por raiz de CNPJ via novo `benefit_type = 'demo'` em `freemium_entitlements` (elegibilidade exige ausência de `onboarding` **e** `demo`); 10 créditos, `demo_expires_at = concessão + 168h`.
- **Encerramento do freemium mensal** — cron e botão `grant_monthly_credits` desativados; nenhuma nova concessão mensal; RPC mantida como legado/deprecada (rollback).
- **Transição sem expiração retroativa** — saldos existentes (`bonus_*`) preservados; entitlements e transações antigas permanecem como histórico; conta/raiz que já consumiu onboarding **não** recebe segunda demonstração; conta antiga sem benefício anterior pode recebê-la.
- **Expiração efetiva com autoridade híbrida** — `demo_expires_at` é a fonte de verdade; a **leitura calcula o saldo disponível sem escrever**; `reserve_credit` materializa quando necessário e um reconciliador (cron) materializa expirações de contas inativas.
- **Notificações in-app + email transacional** — mensagens na concessão, 24h antes do vencimento e no encerramento (expiração/esgotamento); email via Resend (flag `VENDEO_EMAIL_ENABLED`), assíncrono, idempotente, não-bloqueante; registra tentativas e **aceites pelo provedor** (com claim/lease anti-duplicidade e supressão de backlog/fora de janela).
- **Experiência de saldo e prazo** — data/hora local + texto relativo ("expira em X dias/horas"); estados distintos: demonstração ativa / próxima do vencimento / exaurida / expirada / saldo total insuficiente / bônus ou comprado após o encerramento.
- **Suporte honesto** — remoção do SLA "até 24h"; usuário sem saldo orientado a solicitar créditos ao suporte (canal `mailto` já existente), sem "Comprar"/"Adquirir créditos"; obrigações legais (Decreto 7.962/2013) registradas para revisão jurídica.
- **Telemetria de produto** — eventos `demo_granted`, `first_generation`, `demo_exhausted`, `demo_expired`, `support_credit_request` (F51 apenas consumidora).
- **Operação do beta** — landing pública só para solicitação de acesso; beta fechado, Brasil, ≤50 participantes; nenhum convite antes da PJ; `VENDEO_PUBLIC_SIGNUP_ENABLED=false`; gate de limite; maioridade/representação declarada no aceite (sem coleta de nascimento).
- **Solicitação pública de acesso** — WhatsApp opcional e rotulado (só contato sobre a solicitação, sem marketing), aviso de privacidade versionado e auditável, descarte do WhatsApp, anti-enumeração/idempotência preservadas.
- **Imagens, pessoas e menores** — permitidas com direitos/consentimentos e melhor interesse do menor; sem upload de autorizações; aviso curto no upload; proibições de conteúdo ilegal/abusivo/exploratório e dados sensíveis; sanções proporcionais.
- **Privacidade real dos arquivos** — tornar privados `store-brand-assets`/`visual-signatures`/`store-logos` e migrar consumidores de `getPublicUrl` para URL assinada (hardening do Supabase, sem R2).
- **Conta, retenção e direitos** — conta ativa sem saldo/atividade; encerramento com janela de 30 dias; direitos via suporte com protocolo; retenção/anonimização de `product_events`/`credit_notifications`/`support_credit_requests`.
- **Continuidade e backup** — Supabase mantido; backup externo restaurável (banco + buckets) como gate do primeiro convite; sem migração para R2.
- **Legal (três documentos)** — Termos de Uso v1.5 (remove promessa de bônus mensal; explica concessão, elegibilidade, validade, expiração, ordem de consumo, acesso pós-demo, suporte, ausência de cobrança automática e transição dos saldos), Política de Privacidade v1.4 (comunicações operacionais × marketing + eventos de produto) e Política de Uso Aceitável v1.2 (terminologia da demonstração) — cobrindo ainda maioridade/representação, beta por solicitação, WhatsApp, imagens/menores, papéis de tratamento, fornecedores/transferências, retenção, encerramento, direitos do titular, reconsideração e incidentes; reaceite no próximo acesso às capacidades de geração (sem bloquear histórico/campanhas/downloads); validação jurídica formal antes do go-live; identificação do fornecedor (PJ) definida com advogado (sem placeholder).

## Capabilities

### New Capabilities

- `demo-credit-grant`: concessão automática da demonstração (10 créditos, TTL 168h) irrepetível por raiz de CNPJ — RPC `grant_demo_credits`, entitlement `demo`, elegibilidade (ausência de `onboarding` e `demo` na raiz), idempotência e concorrência segura.
- `credit-expiration`: bucket de demonstração (`demo_balance`/`demo_expires_at` autoritativo, `demo_cycle_id`/`origin_demo_grant_tx_id`), tipo de transação `expiration`, materialização atômica/idempotente da expiração (reserve + reconcilador), regra autoritativa de saldo disponível e **episódios de graça** no estorno.
- `credit-notifications`: notificações in-app + email transacional (Resend) por outbox com dedup/idempotência, envio assíncrono e não-bloqueante, claim/lease anti-duplicidade, supressão de backlog/fora de janela e semântica `sent` ≠ `delivered`.
- `demo-status-ui`: estados da demonstração na UI (ativa/próxima/exaurida/expirada/saldo insuficiente/bônus pós-demo) com data/hora local + texto relativo, CTA de suporte sem SLA e ausência de linguagem de compra.
- `product-events`: telemetria de produto para o funil — `demo_granted`, `first_generation`, `demo_exhausted`, `demo_expired`, `support_credit_request` — com identidade e propriedades suficientes para a F51 consumir.
- `beta-access-request`: beta fechado por solicitação/aprovação; WhatsApp opcional/rotulado com finalidade clara; aviso de privacidade versionado e auditável; descarte do WhatsApp; anti-enumeração/idempotência preservadas.
- `storage-privacy`: tornar privados os buckets de ativos do usuário (`store-brand-assets`/`visual-signatures`/`store-logos`) e migrar consumidores de `getPublicUrl` para URL assinada **criada no read-time** (nunca persistida); sem migração de provider.
- `account-retention`: conta ativa, encerramento com janela de 30 dias, direitos via suporte com protocolo, retenção/anonimização de eventos, distinção de órfãos.
- `support-protocol`: protocolo legível + timestamps (`received_at`/`acknowledged_at`/`response_due_at`/`responded_at`/`closed_at`), confirmação durável no próprio canal, reconsideração manual, meta de 5 dias submetida ao advogado.
- `backup-continuity`: Supabase mantido; backup externo restaurável (banco + buckets) como gate do primeiro convite; segredos/backups fora do Git.

### Modified Capabilities

- `credit-tables`: novas colunas `demo_balance`/`demo_expires_at`/`demo_cycle_id`/`origin_demo_grant_tx_id`/`demo_contributing_tx_ids` e tipos `demo`/`expiration` no CHECK de `credit_transactions`.
- `credit-sql-functions`: `reserve_credit`/`refund_credit` com ordem demo→bônus→comprado, metadata de origem e **episódios de graça** (`origin_demo_grant_tx_id`); `grant_credits` com `p_type='demo'`; nova RPC `materialize_demo_expiration`; **leitura RLS do saldo disponível** (não service_role).
- `credit-service`: `getBalance`/`getBalanceBreakdown` passam a expor saldo disponível e o bucket demo.
- `freemium-entitlement`: novo `benefit_type='demo'` + `checkDemoEligibility` + `try_grant_demo_entitlement`.
- `onboarding-grant`: a concessão de onboarding é substituída pela demonstração (tipo `demo`, com validade); `update_store_cnpj` concede demo para loja draft elegível.
- `monthly-credits-engine`: `grant_monthly_credits` descontinuada no corte (deprecated, mantida para rollback estrutural).
- `monthly-credits-cron`: cron mensal desativado no corte; substituído pelo cron reconciliador da demonstração.
- `launch-config`: novas flags `demoCreditsEnabled`/`demoCreditsAmount`/`demoCreditsTtlHours`/`emailEnabled`; `monthlyCreditsEnabled` preservado `true` até o corte; `publicSignupEnabled` permanece `false` no beta.
- `legal-document-versions`: publicação de Termos v1.5, Privacidade v1.4 e Uso Aceitável v1.2 (efetivas no corte).
- `legal-documents`: conteúdo dos três documentos (Termos v1.5, Privacidade v1.4, Uso Aceitável v1.2) — minutas de alteração (delta) em `legal-drafts/`, consolidadas e comparadas com as versões anteriores na execução.
- `privacy-acknowledgement`: nova ciência de privacidade v1.4 por usuário via `PrivacyGate`/`privacy_acknowledgements` (não `legal_acceptances`).
- `credit-cta`: remoção do SLA "24h", solicitação durável/idempotente em `support_credit_requests` (fonte canônica) com auto-ack ao usuário + aviso ao suporte, e telemetria best-effort separada.
- `balance-card`: exibição do status da demonstração e prazo.
- `balance-display`: badge/card de saldo passa a refletir saldo disponível e status da demonstração.
- `conta-page`: seção de demonstração + notificações.
- `admin-credit-grant`: grant admin passa a ser bônus manual não-expirável (labels/semântica).
- `admin-user-directory`: resumo admin expõe demo (saldo/validade/status).

## Impact

- **Banco (migration):** `credit_balances` (+5 colunas), `credit_transactions` (CHECK com +2 tipos), `freemium_entitlements` (+1 `benefit_type`), novas tabelas `credit_notifications`, `product_events`, `support_credit_requests` e `data_subject_requests`; novas RPCs (`grant_demo_credits` com flag obrigatória, `materialize_demo_expiration`, `try_grant_demo_entitlement`) e reescrita de `reserve_credit`/`refund_credit`/`grant_credits`. Migration estrutural → remota verificada antes do deploy; migration de publicação legal **separada** no corte.
- **Código:** `src/lib/credit/**`, `src/lib/freemium/**`, `src/lib/launch-config/config.ts`, `src/lib/legal/**`, `src/lib/email/**` (novo), `src/lib/notifications/**` (novo), `src/lib/product-events/**` (novo), `src/lib/storage/**` (hardening), rotas `src/app/api/store/**`, `src/app/api/admin/**`, `src/app/api/cron/**`, `src/app/api/support/**` (novo), `src/app/api/access-requests`, `src/app/api/campaign/generate-image/route.ts`, `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts`, componentes `src/components/credit/**` e `src/components/landing/access-request-form.tsx`, páginas `conta`/`dashboard`/`campanhas/nova`, nav/bell de notificações.
- **Storage (hardening):** buckets `store-brand-assets`/`visual-signatures`/`store-logos` tornados privados; consumidores de `getPublicUrl` migrados para URL assinada; **sem** migração para R2.
- **Contrato externo:** rotas de geração mantêm contrato de erro (`402 saldo_insuficiente`); `requireLegalClearance` (reaceite) mantido; snapshot/domínio/prompts/gateway de IA **intactos**.
- **Dependência nova:** Resend (email transacional), gated por `VENDEO_EMAIL_ENABLED`; envio assíncrono via outbox + cron (cadência conforme o plano Vercel — Hobby diário, Pro horária).
- **Backup:** rotina externa temporária (banco + buckets) antes do primeiro convite, com teste de restauração; segredos fora do Git.
- **Telemetria:** nova tabela `product_events` (não `generation_events`, que segue focado em custo de IA).
- **Riscos notáveis:** regressão do ledger sob concorrência (mitigado por `SELECT ... FOR UPDATE` + testes); estorno pós-expiração (mitigado por episódios de graça com `origin_demo_grant_tx_id`); expiração não materializada inflando saldo (mitigado por saldo disponível autoritativo + reconciliador); email duplicado/tardio (mitigado por dedup + claim/lease + supressão + máquina de estados); buckets legados públicos (mitigado por hardening + URL assinada); cron Vercel (Hobby diário vs Pro horária); backup inexistente (gate de convite); ativação antes da validação jurídica (mitigado por ordem migration→deploy→validação das três minutas→migration legal→corte).
- **Verificação:** `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build`; migração estrutural/remota verificada; reconciliação financeira do ledger; privacidade dos buckets auditada; UAT manual dos estados da demonstração + smoke pós-corte; testes de protocolo/retry/lease/RLS/refund-pós-expiração/WhatsApp/aviso-upload/maioridade; confirmação de que nenhum fluxo promete compra/cobrança; validação jurídica formal das três minutas registrada; backup externo restaurável comprovado.
