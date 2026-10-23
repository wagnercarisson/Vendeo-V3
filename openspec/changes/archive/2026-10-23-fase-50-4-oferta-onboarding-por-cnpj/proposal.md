## Why

A oferta de onboarding da F50.2 é única por **raiz** de CNPJ (`trial_offer_enrollments.root_hash`). Isso impede que matriz e filiais da mesma raiz recebam individualmente a oferta atual, mesmo quando são estabelecimentos economicamente distintos e já possuem CNPJ completo próprio. A política comercial aprovada para a F50.4 é conceder a oferta **uma vez por CNPJ completo elegível**, preservando integralmente contas, enrollments, saldos, benefícios e políticas anteriores.

A mudança é necessária agora porque a oferta F50.2 está ativa, com parcelas em andamento, e a F50.3 já tornou o CNPJ canônico compatível com formato alfanumérico. A F50.4 precisa separar a nova elegibilidade da regra legada por raiz sem reescrever o passado, sem reabrir o freemium e sem transformar o desligamento da oferta em retorno automático ao legado.

## What Changes

- Introduzir um **marco próprio da F50.4** (`individual_launch_at`), distinto e sem alterar o `launch_at` original da F50.2. Contas criadas em/a partir desse marco seguem a nova política; contas anteriores mantêm o enquadramento atual, inclusive quando concluírem o onboarding depois.
- Registrar no enrollment a **identidade imutável do CNPJ beneficiário completo** (snapshot canônico de 14 caracteres), mantendo `root_hash`, `store_id` e `user_id` para auditoria e regras legadas.
- Substituir a unicidade global por raiz por **unicidade por CNPJ completo beneficiário + store_id**, com unicidade parcial de raiz apenas para enrollments legados. Duas filiais da mesma raiz passam a coexistir; o mesmo CNPJ completo não repete o benefício.
- Separar a elegibilidade em duas coortes explícitas: **legada/F50.2 por raiz** e **F50.4 por CNPJ completo**. A recuperação de conflito e o retry nunca podem devolver enrollment, saldo ou metadados de outra filial.
- Preservar a política legada de um benefício por raiz, o freemium desativado e a prevenção de acúmulo entre programas, explicitando o comportamento para contas de coortes diferentes da mesma raiz.
- Garantir que **crédito manual operacional** (`admin_grant`) não bloqueie elegibilidade, não consuma parcelas, não altere `granted_total` e não reinicie/estenda a oferta. Distinguir isso de `admin_exception`, que continua sendo benefício anterior; a classificação estruturada prevalece sobre texto livre e nenhum registro histórico é reclassificado automaticamente.
- Ajustar avaliação cadastral e mensagens `root_already_used` para que uma restrição comercial legada por raiz não rejeite indevidamente a nova oferta de uma filial.
- Avaliar e ajustar as barreiras de coexistência em `grant_demo_credits` e `grant_monthly_credits` sem flexibilizar o limite interno do legado.
- Criar migration **aditiva e fail-closed**, com backfill do CNPJ beneficiário somente quando houver evidência segura; atribuição ambígua aborta a migration. Definir ordem de migration, código e ativação, além de rollback/forward-fix compatível com a coexistência de filiais.
- **Não** ativar a F50.4 em produção, **não** aplicar migrations em produção, **não** conceder créditos, **não** alterar ambientes compartilhados e **não** iniciar GSD nesta etapa. A ativação controlada do marco em banco descartável é permitida exclusivamente para testes/UAT, com identidade revalidada e sem vínculo com produção.

## Capabilities

### New Capabilities

Nenhuma capability nova. A mudança evolui capabilities existentes.

### Modified Capabilities

- `trial-offer`: marco próprio da F50.4, coortes, identidade do CNPJ beneficiário, unicidade, elegibilidade, concorrência, conflito, retry, migration e preservação.
- `demo-credit-grant`: precedência demo legada × nova oferta por coorte e por CNPJ completo, sem reabrir a demo antiga.
- `monthly-credits-engine`: barreira de coexistência por raiz sem disqualificar indevidamente contas legadas nem conceder mensal a loja da nova coorte.
- `freemium-entitlement`: leitura de benefícios anteriores por CNPJ completo quando houver vínculo seguro, preservando a regra legada por raiz e os registros órfãos.
- `freemium-risk-service`: `root_already_used` restrito ao enquadramento legado; a nova oferta não pode ser rejeitada por uma restrição de raiz.
- `admin-credit-grant`: crédito manual operacional explicitamente separado do benefício de onboarding, da exceção administrativa e das parcelas da oferta.

## Impact

- **Banco**: `trial_offer_settings`, `trial_offer_enrollments`, `trial_offer_eligibility`, `start_trial_offer_enrollment`, `record_onboarding_completion`, `grant_demo_credits`, `grant_monthly_credits`, índices/constraints e RPC administrativa de ativação do novo marco.
- **Aplicação**: helper `src/lib/credit/trial-offer/completion.ts`, `credit-service.ts`, rotas de cadastro/atualização de CNPJ/aprovação/retry, avaliação cadastral (`src/lib/freemium/*`), mensagens de UI e painel administrativo da oferta.
- **Dados**: enrollments existentes, `freemium_entitlements`, `credit_transactions`, saldos e histórico. Nenhum dado financeiro é reescrito; o backfill é limitado ao snapshot do CNPJ beneficiário com evidência segura.
- **Compatibilidade**: CNPJ numérico e alfanumérico da F50.3; Supabase CLI e PostgreSQL reais; rollback sem reintroduzir `UNIQUE(root_hash)` global.
- **Fora de escopo**: organizations, memberships, multi-loja, cobrança compartilhada, hierarquia matriz/filiais, agência, alteração de valor/calendário da oferta, follow-ups de UX da F50.3, ativação, deploy e execução GSD.
