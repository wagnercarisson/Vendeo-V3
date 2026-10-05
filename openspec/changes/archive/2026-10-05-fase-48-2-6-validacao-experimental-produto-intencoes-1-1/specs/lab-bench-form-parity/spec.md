## MODIFIED Requirements

### Requirement: Validade da oferta fiel

A bancada SHALL reproduzir os modos de validade e validações de data existentes, permitindo validade exclusivamente na intenção Oferta. Destaque e Exclusivo SHALL rejeitar validade no formulário e backend. Se houver validade informada ao trocar para intenção incompatível, SHALL bloquear composição e execução até remoção/regularização explícita; SHALL NOT descartar o valor silenciosamente. Formatos e validações existentes de validade permanecem inalterados. Produção permanece intocada.

#### Scenario: Modos de validade disponíveis em Oferta
- **WHEN** intenção é Oferta
- **THEN** modos atuais do produtivo estão disponíveis
- **AND** validações de data atuais são aplicadas

#### Scenario: Validade não é aceita em Destaque ou Exclusivo
- **WHEN** intenção é Destaque ou Exclusivo e payload contém validade
- **THEN** UI/backend recusam composição e execução
- **AND** backend recusa antes de persistir execução ou chamar provider

#### Scenario: Troca de intenção preserva validade até regularização
- **WHEN** existe validade e usuário escolhe Destaque ou Exclusivo
- **THEN** composição e execução ficam bloqueadas
- **AND** valor não é descartado silenciosamente
- **AND** usuário deve remover/regularizar explicitamente a validade
