## MODIFIED Requirements

### Requirement: Prompt-base padrão versionado e resolvido por configuração

A bancada SHALL disponibilizar prompt-base padrão, versionado e resolvido por configuração multidimensional, inicialmente carregado e editável pelo operador. Nesta fase, o conteúdo complementar proposto SHALL ser: “Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.” O padrão conterá somente instruções complementares, sem regras específicas de intenção e sem repetir orientações pertencentes às políticas. Versão e conteúdo efetivamente usados SHALL ser registrados na evidência.

#### Scenario: Prompt-base padrão é carregado e editável
- **WHEN** operador abre a bancada
- **THEN** prompt-base padrão versionado do recorte é carregado inicialmente
- **AND** operador pode editá-lo

#### Scenario: Padrão contém somente instruções complementares
- **WHEN** o padrão é inspecionado
- **THEN** não repete hierarquia comercial ou orientação 1:1 das políticas
- **AND** não contém regra específica de Oferta, Destaque ou Exclusivo

#### Scenario: Padrão é resolvido por configuração
- **WHEN** o recorte multidimensional é resolvido
- **THEN** o padrão correspondente é selecionado por configuração
- **AND** recortes futuros podem ter padrão próprio sem reescrever o módulo

#### Scenario: Versão e conteúdo usados são registrados
- **WHEN** uma geração é persistida
- **THEN** versão do padrão e conteúdo efetivamente usado integram a evidência

### Requirement: Preservação integral e determinismo do prompt-base

O compositor SHALL preservar integralmente o prompt-base padrão ou editado, sem reescrita, resumo ou filtragem lexical, e SHALL manter determinismo quando o operador edita o prompt-base.

#### Scenario: Prompt-base editado é preservado
- **WHEN** operador edita prompt-base e recompõe
- **THEN** conteúdo editado é incluído integralmente no prompt compilado
- **AND** nenhuma reescrita ou filtragem é aplicada

#### Scenario: Uso do prompt-base editado é determinístico
- **WHEN** prompt-base editado é reutilizado
- **THEN** mesma entrada produz exatamente a mesma saída
