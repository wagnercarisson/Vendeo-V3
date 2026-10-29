## ADDED Requirements

### Requirement: Resolução do idioma da interface na renderização

O layout autenticado SHALL resolver o idioma da interface a partir da preferência persistida do
usuário, usando o contrato `pt-BR` | `es-419` da F57.3. A resolução SHALL ocorrer no servidor,
antes da renderização dos componentes do shell, e SHALL NOT depender de loja, mercado, país,
moeda, navegador ou IP.

Preferência ausente/legada SHALL resolver `pt-BR`. Preferência explícita `es-419` SHALL resolver
`es-419`. A resolução SHALL ser isolada por usuário/requisição, sem cache compartilhado entre
usuários.

#### Scenario: Preferência explícita em espanhol

- **WHEN** o usuário possui `ui_locale = "es-419"` e `ui_locale_source = "explicit"`
- **THEN** a interface é renderizada em `es-419`

#### Scenario: Ausência legada

- **WHEN** o usuário não possui preferência explícita
- **THEN** a interface é renderizada em `pt-BR`
- **AND** nenhuma linha é criada pela renderização

### Requirement: Fallback de renderização em falha de leitura

O sistema SHALL resolver a renderização para `pt-BR` quando a leitura da preferência falhar com
erro conhecido (`preferences_unavailable` ou `stored_preferences_invalid`), sem bloquear a página,
sem criar/alterar preferência e sem expor detalhes técnicos ao usuário. O sistema SHALL registrar
aviso operacional de falha de leitura, sem dados pessoais.

O contrato de `/api/preferences` SHALL permanecer inalterado: indisponibilidade continua `503` e
valor persistido inválido continua `500 stored_preferences_invalid`, sem fallback silencioso na
API.

#### Scenario: Indisponibilidade na renderização

- **WHEN** a leitura da preferência falha por indisponibilidade
- **THEN** a página é renderizada em `pt-BR`
- **AND** a API continua respondendo `503 preferences_unavailable`

#### Scenario: Valor inválido persistido

- **WHEN** a preferência persistida está fora do contrato
- **THEN** a página é renderizada em `pt-BR`
- **AND** a API continua respondendo `500 stored_preferences_invalid`
