## ADDED Requirements

### Requirement: Banner de prontidão no dashboard

O sistema SHALL exibir um banner de prontidão no dashboard quando `getStoreReadiness()` retorna `ready: false`. O banner SHALL:

- Ser exibido APENAS quando a loja existe e `ready === false`
- Conter um checklist com os itens de readiness mais indicadores de contexto:
  - ❌ CNPJ cadastral (se cadastro_fiscal ausente no readiness)
  - ❌ Direção visual (se brand_profile ausente no readiness)
  - Itens fora da readiness (legal clearance e saldo) são verificados nos guards de geração, não no banner de prontidão
- Cada item pendente é link direto para a configuração correspondente:
  - "CNPJ cadastral" → `/cadastro/cnpj?returnTo=/dashboard`
  - "Direção visual" → `/loja?required=visual-direction`
- Botão "Configurar agora" que aponta para a primeira pendência
- Estilo visual consistente com o design system (dark mode, cards com borda)

#### Scenario: Banner exibido para loja sem cadastro fiscal

- **WHEN** dashboard é carregado
- **AND** `getStoreReadiness(store.id)` retorna `missing: ["cadastro_fiscal"]`
- **THEN** banner de prontidão é exibido
- **AND** o checklist mostra "CNPJ cadastral" como pendente
- **AND** link "CNPJ cadastral" aponta para `/cadastro/cnpj?returnTo=/dashboard`

#### Scenario: Banner exibido para loja sem brand profile

- **WHEN** dashboard é carregado
- **AND** `getStoreReadiness(store.id)` retorna `missing: ["brand_profile"]`
- **THEN** banner de prontidão é exibido
- **AND** o checklist mostra "Direção visual" como pendente
- **AND** link "Direção visual" aponta para `/loja?required=visual-direction`

#### Scenario: Banner não exibido para loja pronta

- **WHEN** dashboard é carregado
- **AND** `getStoreReadiness(store.id)` retorna `ready: true`
- **THEN** banner de prontidão NÃO é exibido
- **AND** o conteúdo normal do dashboard é renderizado

#### Scenario: Banner não exibido quando loja não existe

- **WHEN** dashboard é carregado
- **AND** usuário não tem loja (`no_store`)
- **THEN** banner de prontidão NÃO é exibido
- **AND** o empty state "Configure sua loja" é renderizado

#### Scenario: Banner tem prioridade correta nas pendências

- **WHEN** `getStoreReadiness()` retorna `missing: ["cadastro_fiscal", "brand_profile"]`
- **THEN** o botão "Configurar agora" aponta para `/cadastro/cnpj?returnTo=/dashboard`
- **AND** ambos os itens aparecem como pendentes no checklist
