## MODIFIED Requirements

### Requirement: Acessibilidade e preservação de links e estados existentes

A landing SHALL preservar a estrutura semântica e a acessibilidade (hierarquia de headings, landmarks, foco visível, alvos de toque de ao menos 44px) e os links legais existentes (`/termos`, `/privacidade`, `/uso-aceitavel` e Contato). O formulário de solicitação de acesso SHALL seguir o modo da chave: com a chave fechada, o formulário SHALL estar presente com os estados preservados; com a chave aberta, o formulário SHALL estar oculto e os caminhos de cadastro existentes SHALL estar disponíveis.

O rodapé legal da landing SHALL ser renderizado pelo componente público compartilhado, com os destinos de conteúdo agrupados sob “Explore o Vendeo” e separados dos links institucionais, legais e de acesso. A seção “Novidades” SHALL permanecer acessível pelo rodapé quando aplicável.

#### Scenario: Chave fechada — formulário presente e estados preservados

- **WHEN** `publicSignupEnabled` é `false`
- **THEN** o formulário de solicitação está presente
- **AND** os estados de envio/sucesso/erro do formulário continuam disponíveis
- **AND** os links legais existentes permanecem funcionais

#### Scenario: Chave aberta — formulário oculto e cadastro disponível

- **WHEN** `publicSignupEnabled` é `true`
- **THEN** o formulário de solicitação não é exibido
- **AND** os caminhos de cadastro existentes (Google e email) estão disponíveis
- **AND** os links legais existentes permanecem funcionais

#### Scenario: Estrutura semântica preservada

- **WHEN** a landing é renderizada
- **THEN** a hierarquia de headings e os landmarks acessíveis são mantidos

#### Scenario: Rodapé compartilhado preserva links e Novidades

- **WHEN** o rodapé da landing é renderizado
- **THEN** Termos, Privacidade, Uso Aceitável e Contato permanecem com os destinos atuais
- **AND** “Novidades” permanece disponível no rodapé
- **AND** “Explore o Vendeo” exibe Floriculturas, Padarias e Campanhas sem complicação
- **AND** o aviso legal demonstrativo permanece visível
