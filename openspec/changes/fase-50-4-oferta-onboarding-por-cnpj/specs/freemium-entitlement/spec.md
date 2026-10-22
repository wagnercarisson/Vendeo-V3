## MODIFIED Requirements

### Requirement: store_id usa ON DELETE SET NULL — antifraude

O sistema SHALL manter `ON DELETE SET NULL` em `freemium_entitlements.store_id`. Se uma loja for deletada, o entitlement permanece como registro histórico — a raiz não pode reivindicar novo onboarding simplesmente por deletar a loja original. A F50.4 SHALL NOT reescrever esses registros nem inventar a qual CNPJ completo um entitlement órfão pertence.

Quando um entitlement `onboarding`, `demo` ou `admin_exception` tiver `store_id IS NULL`, o vínculo com o CNPJ completo é considerado **ambíguo**. A elegibilidade da coorte `per_cnpj_f50_4` SHALL falhar de forma fechada com `prior_benefit_ambiguous`, sem inscrever a loja e sem retornar dados de outra filial. O motivo SHALL ser seguro e disponível para diagnóstico administrativo; a resolução é manual e futura, sem compensação, exceção ou atribuição automática.

#### Scenario: Loja deletada — entitlement permanece

- **WHEN** uma loja que recebeu onboarding é deletada
- **THEN** `freemium_entitlements.store_id` fica NULL
- **AND** o entitlement `onboarding` com `root_hash` correspondente permanece
- **AND** uma nova loja com mesma raiz não recebe onboarding grant

#### Scenario: Entitlement órfão na nova coorte

- **WHEN** existe entitlement `onboarding`, `demo` ou `admin_exception` com `store_id` nulo e mesmo `root_hash`
- **THEN** a coorte `per_cnpj_f50_4` retorna `prior_benefit_ambiguous`
- **AND** nenhum enrollment é criado
- **AND** a decisão não é convertida automaticamente em autorização nem em exceção

#### Scenario: Registro legado preservado

- **WHEN** a F50.4 é publicada
- **THEN** o entitlement órfão permanece com os mesmos campos
- **AND** nenhum `UPDATE` de `store_id`, `root_hash`, `benefit_type` ou `grant_transaction_id` é executado

### Requirement: checkOnboardingEligibility(rootHash)

O sistema SHALL manter `checkOnboardingEligibility(rootHash: string): boolean` para a política **legada** por raiz, retornando `true` somente se a raiz não tem entitlement `onboarding`. A F50.4 SHALL NOT redefinir essa função para elegibilidade por CNPJ completo; a nova leitura SHALL ser uma operação separada e explicitamente identificada.

A elegibilidade da oferta F50.4 SHALL consultar benefícios anteriores pelo CNPJ completo canônico quando houver vínculo seguro (`store_id → stores.cnpj_normalized`) e SHALL tratar entitlement órfão conforme a regra de ambiguidade acima.

#### Scenario: Raiz nova — elegível no legado

- **WHEN** `checkOnboardingEligibility("hash_nova")` é chamado
- **THEN** retorna true

#### Scenario: Raiz já usou onboarding — inelegível no legado

- **WHEN** `checkOnboardingEligibility("hash_existente")` é chamado
- **AND** existe entitlement `onboarding` para esta raiz
- **THEN** retorna false

#### Scenario: Nova leitura por CNPJ não altera a assinatura legada

- **WHEN** a F50.4 consulta benefícios do mesmo CNPJ completo
- **THEN** usa uma leitura própria por CNPJ/store
- **AND** `checkOnboardingEligibility(rootHash)` continua com o mesmo contrato e resultado por raiz

## ADDED Requirements

### Requirement: Leitura de benefício anterior por CNPJ completo

O sistema SHALL prover uma leitura server-side que, para a coorte `per_cnpj_f50_4`, determine se o **mesmo CNPJ completo** já consumiu benefício inicial. A leitura SHALL considerar:

- entitlement `onboarding`, `demo` ou `admin_exception` vinculado a uma loja com o mesmo `cnpj_normalized`;
- transação `bonus_onboarding` ou `demo` inicial vinculada a uma loja com o mesmo `cnpj_normalized`;
- enrollment com o mesmo `beneficiary_cnpj_normalized`.

A leitura SHALL NOT bloquear por benefício de outra filial da mesma raiz quando o vínculo for comprovadamente de outro CNPJ completo. A leitura SHALL NOT considerar `admin_grant`, `bonus_monthly`, compra, estorno ou expiração como benefício inicial.

#### Scenario: Benefício de outra filial não bloqueia

- **WHEN** a matriz tem entitlement `onboarding` e a filial tem CNPJ completo novo
- **THEN** a filial não é bloqueada por esse entitlement
- **AND** a leitura registra o beneficiário da filial, não a raiz

#### Scenario: Benefício do mesmo CNPJ bloqueia

- **WHEN** o mesmo CNPJ completo já tem entitlement `onboarding`, `demo` ou `admin_exception`
- **THEN** a nova oferta é recusada como benefício anterior
- **AND** nenhum novo enrollment é criado

#### Scenario: Histórico de crédito de onboarding bloqueia

- **WHEN** o mesmo CNPJ completo já recebeu `bonus_onboarding` ou `demo` inicial, mesmo sem entitlement
- **THEN** a nova oferta é recusada como benefício anterior
- **AND** nenhum crédito é concedido

#### Scenario: Crédito manual não bloqueia

- **WHEN** o mesmo CNPJ completo tem apenas créditos `admin_grant`
- **THEN** a leitura não o considera benefício inicial
- **AND** a oferta permanece elegível
- **AND** texto livre em `reason` não altera a classificação estruturada

### Requirement: Preservação da regra legada por raiz

A F50.4 SHALL preservar o freemium legado como um programa por raiz, sem reativá-lo, sem migrar contas antigas e sem alterar seus entitlements. A nova leitura por CNPJ completo SHALL ser usada apenas pela coorte `per_cnpj_f50_4`; a coorte `root_legacy` SHALL continuar usando as regras por raiz existentes.

`create_store_with_cnpj` e `update_store_cnpj` SHALL continuar concedendo o onboarding legado somente quando a raiz for elegível e a política legada permitir. Uma filial pode receber 0 créditos de onboarding legado e ainda assim ser elegível à oferta F50.4.

#### Scenario: Filial sem onboarding legado segue elegível à F50.4

- **WHEN** a raiz já usou o onboarding legado e a filial tem CNPJ completo novo
- **THEN** a filial não recebe 10 créditos de onboarding legado
- **AND** a filial pode receber a oferta F50.4 se os demais critérios forem satisfeitos

#### Scenario: Freemium não é reativado

- **WHEN** a F50.4 é ativada
- **THEN** a chave e a política do freemium legado permanecem como estavam
- **AND** nenhuma conta antiga é migrada para a nova coorte

#### Scenario: Entitlement legado preservado

- **WHEN** uma conta antiga possui entitlements `onboarding`, `demo`, `monthly` ou `admin_exception`
- **THEN** todos permanecem com os mesmos valores
- **AND** nenhuma concessão é cancelada ou convertida
