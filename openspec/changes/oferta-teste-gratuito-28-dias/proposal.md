## Why

A demonstração legada do Vendeo (10 créditos / 168 horas) é concedida na criação/aprovação da loja e não acompanha o momento atual do produto. A nova oferta de teste gratuito precisa ser simples: **28 dias, 4 concessões fixas de 5 créditos**, início na conclusão do onboarding e elegibilidade apenas para contas criadas a partir da entrada em produção.

A versão anterior desta proposta criou um motor genérico de ofertas (política configurável, máquina de estados, auditoria paralela, notificações novas, reparadores). Isso não é necessário para entregar uma única oferta fixa. Esta revisão reduz a mesma change ao mínimo que protege o saldo e cumpre o contrato comercial.

## What Changes

- **Chave própria para novas adesões + marco persistido**: uma linha de configuração (`trial_offer_settings`) com `enabled` e `launch_at`. `launch_at` recebe valor **somente quando `p_enabled=true` e ainda é nulo**; uma chamada inicial para manter a oferta desligada não inaugura a coorte. Ligações/desligamentos posteriores preservam o marco. A elegibilidade usa `auth.users.created_at >= launch_at`.
- **Chave desligada não restaura a política anterior**: contas criadas a partir do marco continuam sem a demo legada, mesmo com a chave desabilitada. Restaurar a demo antiga para a nova coorte exige uma decisão separada, não uma queda automática no ramo legado.
- **Registro por beneficiário**: `trial_offer_enrollments` com `store_id`, `user_id`, `root_hash`, `offer_key`, `started_at`, `expires_at`, `granted_total` e `last_granted_seq`. Unicidade por `root_hash` e por `store_id` preserva a proteção contra repetição por CNPJ.
- **Quatro concessões fixas**: 5 créditos no dia 0, 7, 14 e 21; máximo de 20 concedidos. As regras são **constantes desta versão** (`offer_key='trial_28d_v1'`), sem tabela configurável de parcelas.
- **Início na conclusão do onboarding**: um único helper central registra a conclusão (`record_onboarding_completion`) e, em seguida, cria o enrollment + parcela 0 (`start_trial_offer_enrollment`), ambos idempotentes. Se a inscrição falhar, a conclusão permanece e a repetição usa o início original. Onboarding incompleto não inicia. Edições posteriores não reiniciam.
- **Relógio único nas provas**: as operações de teste recebem `p_now` e o propagam por toda a cadeia (conclusão, inscrição, parcelas, expiração e estorno), inclusive nas variantes internas `materialize_demo_expiration_at`/`refund_credit_at`. Em produção, o default é sempre `now()` do servidor.
- **Falha de início visível e repetível**: se o onboarding foi salvo, mas o teste não começou, a resposta da operação retorna um estado seguro `retryable_failure` (ou `expired_window`) e a UI permite repetir **somente a conclusão/inscrição**, por uma rota autenticada e com ownership, sem reenviar onboarding e sem repetir chamadas de logo/perfil/assinatura/provider. Sem reparador ou infraestrutura nova.
- **Concessão protege o saldo compartilhado**: além do lock no enrollment, a parcela adquire lock em `credit_balances` e escreve de forma atômica, compatível com consumo, estorno e expiração. Testes cobrem parcela concorrente com uma dedução, não apenas dois processadores de parcelas.
- **Cron existente**: `/api/cron/demo-credits` passa a processar as parcelas devidas e a recuperar atrasos, sem estender o prazo; a expiração continua em `materialize_demo_expiration`. Sem rota nova e sem agenda nova.
- **Comunicação do cron diário**: a parcela fica elegível no dia 7/14/21, mas pode ser creditada na execução diária seguinte. A UI e a documentação não prometem liberação no segundo exato.
- **Ledger e estorno existentes**: as parcelas usam o bucket `demo` e preservam `origin_demo_grant_tx_id`, `demo_cycle_id` e `demo_expires_at`; a graça de 24h do estorno continua restrita ao valor estornado e não reabre o teste. Nenhum tipo novo de transação, bucket ou tabela de extrato.
- **Precedência simples**: contas antigas mantêm a demo legada (10/168) e o bônus mensal como hoje; contas novas (coorte definida por `launch_at`, não por `enabled`) recebem a oferta de 28 dias e **não** entram automaticamente no bônus mensal. A exclusão mensal é permanente para raízes inscritas no teste; qualquer benefício posterior para a nova coorte exige uma decisão própria.
- **Auditoria existente**: a alteração da chave usa `admin_audit_log`, com motivo e `operation_id`, sem tabela de auditoria paralela.
- **UI pontual**: exibir teste ativo/encerrado, vencimento e próxima parcela; ajustar textos que hoje prometem “10 créditos” para contas novas. Incluir na página existente **Controles operacionais** um painel “Teste gratuito de 28 dias” com estado atual, marco de lançamento, motivo obrigatório e feedback de erro/sucesso, usando `admin_set_trial_offer_enabled` por rota administrativa autenticada e protegida contra CSRF. O painel não altera nem aciona automaticamente o mensal legado. Sem novos tipos de notificação, sem e-mails semanais, sem checkout/planos/assinatura.

## O que foi retirado desta proposta

- Tabela configurável de regras de parcelas (0/7/14/21 e 5 créditos são fixos).
- Máquina de estados `draft/active/paused/retired`; basta `enabled`.
- Auditoria paralela; reutiliza-se `admin_audit_log`.
- Cancelamento opcional de parcelas futuras; o benefício prometido é preservado.
- Novos tipos de notificação e e-mails semanais.
- Diagnósticos, reparadores e chamadas espalhadas por várias telas.
- Novo milestone obrigatório; a numeração será organizada no GSD sem ampliar a entrega.
- Extensão de `freemium_entitlements`; a proteção por raiz fica no próprio enrollment.

## Capabilities

### New Capabilities

- `trial-offer`: chave/marco de lançamento, enrollment por beneficiário, quatro concessões fixas, idempotência, concorrência, vencimento em 28 dias, recuperação pelo cron existente e precedência por coorte.

### Modified Capabilities

- `demo-credit-grant`: contas novas (criadas a partir do marco) e raízes já inscritas não recebem a demo legada; contas antigas permanecem intactas.
- `monthly-credits-engine`: raízes com enrollment do teste não recebem bônus mensal automático; contas antigas e configuração/chave legadas permanecem inalteradas.
- `demo-status-ui`: estados e textos do teste de 28 dias, vencimento e próxima parcela; distinção do teste encerrado e do saldo utilizável.

## Recorte de implementação (3 planos, a detalhar no GSD após aprovação)

1. **Banco e concessões** — `trial_offer_settings`, `stores.onboarding_completed_at`, `trial_offer_enrollments`, RPCs de início/parcela/processamento, expiração e compatibilidade.
2. **Integração** — chamada central na conclusão do onboarding, cron existente, leitura de saldo/status e ajustes pontuais de texto.
3. **Testes e lançamento** — banco isolado com tempo simulado, testes de duplicação/concorrência/vencimento/preservação, gates e publicação autorizada.

## Impact

- **Banco**: uma tabela de configuração singleton, uma coluna em `stores`, uma tabela de enrollment e RPCs. Sem tabela de parcelas, sem tabela de auditoria nova, sem mudança em `freemium_entitlements`.
- **Cron**: extensão do `/api/cron/demo-credits`; `vercel.json` inalterado.
- **Serviços/rotas**: helper server-side chamado pelos caminhos existentes que concluem o onboarding (cadastro/aprovação da loja/CNPJ e brand profile); `CreditService`/status do teste para leitura.
- **UI**: `BalanceCard`, `/conta`, extrato e textos de notificação existentes. Sem novas superfícies de billing.
- **Legado preservado**: `grant_demo_credits`, `grant_credits`, `reserve_credit`, `refund_credit`, `materialize_demo_expiration`, `VENDEO_DEMO_CREDITS_*`, `VENDEO_MONTHLY_CREDITS_*` e a chave mensal permanecem com os valores atuais. Nenhum backfill/conversão retroativa.
- **Produto 1:1 intocado**: ativação, modelos, prompts, orçamento, `56.2.7` e monitoramento beta não são alterados.
- **Numeração**: nenhum milestone novo é aberto por esta proposta; o token da fase será resolvido no GSD e não altera o escopo.

## Fora de escopo

- Implementação, migrations executáveis, aplicação de migrations, alteração de dados/env/flags, deploy ou chamadas pagas.
- Checkout, planos, assinatura ou pagamento.
- Cancelamento de parcelas futuras ou clawback de créditos concedidos.
- Novos tipos de notificação, e-mails semanais ou central de promoções.
- Backfill, conversão retroativa ou renovação de elegibilidade por nova conta/loja.
- Alteração de ativação, modelos, prompts ou orçamento do Produto 1:1.

## Decisões confirmadas

1. **Mensal**: exclusão permanente das raízes inscritas no teste novo. Beneficiários antigos continuam como hoje; benefício posterior para a nova coorte exige decisão própria.
2. **Reativação**: `launch_at` recebe valor somente quando `p_enabled=true` e ainda é nulo. Ligar/desligar a chave não transforma contas da nova coorte em antigas nem muda sua política; uma chamada inicial com a oferta desligada não inaugura a coorte.
3. **Conclusão**: os dois grupos de caminhos são adequados — cadastro/aprovação da loja e sincronização do perfil —, desde que os testes comprovem as rotas reais. Não há chamadas em outras telas.
4. **Lojas de teste**: exclusão automática mantida; a oferta é validada com fixtures controladas no isolado, sem conceder benefícios às lojas de teste existentes.
5. **Chave desligada**: interrompe novas adesões, mas não faz a nova coorte receber automaticamente a demo antiga. Restaurar a política anterior é uma decisão separada.
6. **Falha ao concluir**: o onboarding salvo e o teste não iniciado retornam `retryable_failure` (ou `expired_window`). O retry repete **somente** a conclusão/inscrição, por rota autenticada e com ownership, sem reenviar onboarding e sem repetir logo/perfil/assinatura/provider.
7. **Cron diário**: a parcela fica elegível no dia 7/14/21 e pode ser creditada na execução diária seguinte; não há promessa de liberação no segundo exato.
8. **Relógio único**: as provas usam um único `p_now` propagado por conclusão, inscrição, parcelas, expiração e estorno; em produção, o default é `now()` do servidor.
9. **Saldo compartilhado**: a concessão adquire lock no enrollment e em `credit_balances`, com escrita atômica compatível com consumo, estorno e expiração; o teste inclui parcela concorrente com dedução.
10. **Painel administrativo**: “Teste gratuito de 28 dias” em Controles operacionais, com estado atual, `launch_at`, motivo obrigatório, feedback e CSRF; usa `admin_set_trial_offer_enabled` e não altera nem aciona o mensal legado.

## Riscos residuais de implementação

1. **Cobertura das rotas reais**: os testes precisam exercitar cadastro, aprovação e sincronização do perfil, não apenas o helper. Uma rota não coberta pode atrasar o início até a próxima operação.
2. **Falha entre salvamento e concessão**: o estado `retryable_failure` precisa ser retornado sem mascarar o erro e sem quebrar o salvamento; a repetição deve ser idempotente e não duplicar crédito.
3. **Atraso do cron**: a parcela pode aparecer até a execução diária seguinte; a UI deve comunicar isso sem prometer o segundo exato.
