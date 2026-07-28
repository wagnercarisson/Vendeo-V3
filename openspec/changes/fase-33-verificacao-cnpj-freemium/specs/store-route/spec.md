## MODIFIED Requirements

### Requirement: POST /api/store — verificação server-side

O sistema SHALL modificar `POST /api/store` para executar verificação de CNPJ server-side antes de criar a loja e condicionar o grant de onboarding à decisão de elegibilidade.

#### Scenario: Submit APPROVE → loja criada + grant de 10 créditos

- **WHEN** `POST /api/store` é chamado com CNPJ válido
- **AND** lookup resolve com dados oficiais
- **AND** `evaluateFreemiumEligibility` retorna `decision = 'approve'`
- **THEN** loja é criada com `verification_status = 'approved'`
- **AND** grant de 10 créditos é concedido
- **AND** response: `{ onboardingGranted: true, verificationStatus: 'approved' }`
- **AND** mensagem: "Loja criada com sucesso! Seus créditos de boas-vindas foram liberados."

#### Scenario: Submit REVIEW → loja criada sem grant

- **WHEN** `POST /api/store` é chamado com CNPJ válido
- **AND** `evaluateFreemiumEligibility` retorna `decision = 'review'`
- **THEN** loja é criada com `verification_status = 'review'`
- **AND** grant de onboarding NÃO é concedido
- **AND** response: `{ onboardingGranted: false, verificationStatus: 'review' }`
- **AND** mensagem: "Loja criada. Seus créditos de boas-vindas serão liberados após verificação cadastral."

#### Scenario: Submit REJECT (CNPJ inexistente) → bloqueia criação

- **WHEN** `POST /api/store` é chamado
- **AND** lookup retorna `not_found`
- **THEN** loja NÃO é criada
- **AND** response: 400 com mensagem "Não foi possível criar a loja. O CNPJ informado não foi encontrado na Receita Federal. Verifique o número e tente novamente."

#### Scenario: Submit REJECT (CNPJ baixado/nulo) → loja criada sem grant

- **WHEN** `POST /api/store` é chamado com CNPJ baixado ou nulo
- **AND** `evaluateFreemiumEligibility` retorna `decision = 'reject'` por situação cadastral
- **THEN** loja é criada com `verification_status = 'rejected'`
- **AND** grant de onboarding NÃO é concedido
- **AND** mensagem: "Loja criada. Este CNPJ está com situação cadastral inativa."

#### Scenario: Submit REJECT (raiz já usou) → loja criada sem grant

- **WHEN** `POST /api/store` é chamado com CNPJ de raiz já consumida
- **AND** `evaluateFreemiumEligibility` retorna `decision = 'reject'` por root_eligible
- **THEN** loja é criada com `verification_status = 'rejected'`
- **AND** grant de onboarding NÃO é concedido
- **AND** mensagem: "Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas."

#### Scenario: Submit DEFER → loja criada sem grant

- **WHEN** `POST /api/store` é chamado
- **AND** lookup retorna `unavailable` (ambos provedores indisponíveis)
- **THEN** loja é criada com `verification_status = 'defer'`
- **AND** grant de onboarding NÃO é concedido
- **AND** mensagem: "Loja criada. Não foi possível verificar os dados cadastrais agora. Você pode tentar novamente em 'Dados da Loja'."

### Requirement: Backend não confia no estado do client

O sistema SHALL garantir que o backend não confia no estado de verificação vindo do client. Se o `verification_service` não encontrar dados em cache ou resolvidos no momento do submit, ele tenta resolver server-side. A política de resolução é controlada no servidor, não no cliente.

#### Scenario: Cliente envia CNPJ sem dados resolvidos

- **WHEN** `POST /api/store` recebe CNPJ sem dados oficiais resolvidos no client
- **THEN** backend tenta resolver server-side via `CnpjVerificationService.resolve()`
- **AND** a decisão é baseada no resultado server-side, não no estado do client
