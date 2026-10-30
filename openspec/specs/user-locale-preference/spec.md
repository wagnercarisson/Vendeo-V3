> Synced from `fase-57-2-persistencia-preferencias-multimercado` (ADDED).

## Purpose

Define a preferência persistida de idioma do aplicativo por usuário, sua ausência legada, escrita CAS, isolamento por usuário e independência das configurações da loja.

## Requirements

### Requirement: Preferência de idioma do aplicativo por usuário

O sistema SHALL persistir o idioma do aplicativo em `public.user_preferences`, 1:1 com o usuário
autenticado, com `ui_locale` validado (`pt-BR` | `es-419`), `ui_locale_source`
(`explicit` | `legacy_br`), versão e timestamps.

O contrato do idioma da interface SHALL ser separado do contrato do idioma do conteúdo: conteúdo
e campanha continuam aceitando `pt-BR` | `es-PY`, e `es-419` NÃO SHALL ser aceito como idioma de
conteúdo. `es-PY` NÃO SHALL ser aceito como idioma da interface.

O idioma do aplicativo SHALL ser independente do país cadastral, do mercado padrão da loja e do
idioma do conteúdo das campanhas. Nenhuma leitura ou escrita SHALL recalcular o idioma do app a
partir do país da loja.

#### Scenario: Idioma do app independe do país da loja

- **WHEN** uma loja PY pertence a um usuário que prefere `pt-BR`
- **THEN** a preferência persistida e devolvida é `pt-BR`
- **AND** o contexto da loja permanece PY

#### Scenario: Loja BR com usuário em espanhol LATAM

- **WHEN** o usuário define `uiLocale = "es-419"` em loja BR
- **THEN** a preferência é persistida e devolvida como `es-419`
- **AND** mercado, idioma do conteúdo e moeda da loja não são alterados
- **AND** o idioma do conteúdo continua aceitando `es-PY`

#### Scenario: es-PY não é idioma da interface

- **WHEN** uma escrita tenta `uiLocale = "es-PY"`
- **THEN** a resposta é `400` com erro em `uiLocale`
- **AND** nenhuma preferência é alterada
- **AND** `es-PY` permanece válido apenas no contrato de conteúdo

### Requirement: Ausência legada explícita

Usuário sem linha persistida SHALL ser resolvido como `pt-BR` com fonte `legacy_br`. A leitura
SHALL NOT criar linha. A primeira escrita explícita SHALL materializar a linha.

Falha de leitura do banco SHALL retornar `503 preferences_unavailable`; valor persistido fora do
contrato SHALL retornar `500 stored_preferences_invalid`. Nenhum dos dois casos SHALL cair
silenciosamente em `pt-BR`.

#### Scenario: Usuário legado sem preferência

- **WHEN** o usuário não possui linha em `user_preferences`
- **THEN** a leitura devolve `pt-BR` com fonte `legacy_br`
- **AND** nenhuma linha é criada pela leitura

#### Scenario: Erro de infraestrutura não vira fallback

- **WHEN** a consulta falha por indisponibilidade do banco
- **THEN** a resposta é `503 preferences_unavailable`
- **AND** nenhum idioma padrão é devolvido como sucesso

### Requirement: Escrita parcial e limpeza explícita

O PATCH SHALL aceitar exatamente `uiLocale` (valor suportado, `null` ou omitido) e
`expectedVersion` (inteiro ≥ 0, **obrigatório**). A escrita SHALL ocorrer por uma operação
atômica autorizada (`write_user_locale_preference`, `service_role`-only) que compara a versão:

- `uiLocale` omitido: preferência e fonte permanecem inalteradas (a operação apenas valida a
  versão);
- valor suportado: persiste com fonte `explicit`;
- `null`: remove a escolha explícita e resolve `pt-BR` com fonte `legacy_br`;
- valor inválido: `400` com `fieldErrors`, sem escrita;
- chave desconhecida: `400`, sem escrita;
- `expectedVersion` divergente: `409 preferences_version_conflict`, sem escrita.

Alterar o idioma do aplicativo SHALL NOT exigir configurar a loja nem alterar suas
configurações. Nenhuma escrita direta na tabela é permitida ao cliente autenticado.

#### Scenario: Alteração de app não toca a loja

- **WHEN** o usuário altera apenas `uiLocale`
- **THEN** nenhuma linha de `store_market_settings` é criada ou alterada

#### Scenario: Limpar preferência

- **WHEN** o PATCH envia `uiLocale: null`
- **THEN** a preferência efetiva passa a `pt-BR` com fonte `legacy_br`
- **AND** a versão é incrementada

#### Scenario: Valor inválido não escreve

- **WHEN** o PATCH envia `uiLocale: "es-AR"`
- **THEN** a resposta é `400` com erro em `uiLocale`
- **AND** a versão permanece inalterada

### Requirement: Isolamento e proteção de escrita

A leitura e a escrita SHALL exigir usuário autenticado e operar somente sobre o próprio
`user_id`. `PATCH` SHALL exigir mesma origem (`requireSameOrigin`). A política RLS SHALL permitir
apenas `SELECT` das próprias preferências; `INSERT`/`UPDATE` diretos de `authenticated` SHALL ser
negados. Escritas SHALL ocorrer exclusivamente pela RPC autorizada (`service_role`), que recebe o
`user_id` do servidor — nunca do corpo da requisição.

#### Scenario: Cliente não escreve direto na tabela

- **WHEN** um cliente autenticado tenta `INSERT`/`UPDATE` direto em `user_preferences`
- **THEN** a operação é negada pela RLS/grants
- **AND** a única escrita possível é pela RPC autorizada

#### Scenario: Usuário não acessa preferência alheia

- **WHEN** o usuário A tenta ler ou alterar a preferência do usuário B
- **THEN** a operação é negada sem revelar o valor de B

#### Scenario: CSRF bloqueia escrita cruzada

- **WHEN** o PATCH chega com origem diferente do host
- **THEN** a resposta é `403`
- **AND** nenhuma escrita ocorre

### Requirement: Concorrência por versão

Toda escrita SHALL exigir `expectedVersion` (0 quando não há linha) e SHALL retornar
`409 preferences_version_conflict` com a versão vigente quando houver divergência.

#### Scenario: Escrita concorrente não perde valor aceito

- **WHEN** duas escritas concorrentes partem da mesma versão
- **THEN** exatamente uma é aceita
- **AND** a rejeitada recebe `409` e, repetida com a nova versão, preserva o valor aceito

#### Scenario: Primeira escrita concorrente sem linha

- **WHEN** duas requisições tentam criar a preferência pela primeira vez com `expectedVersion = 0`
- **THEN** exatamente uma cria a linha
- **AND** a outra recebe `409 preferences_version_conflict`
- **AND** nenhuma escrita direta contorna esse controle

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
erro conhecido (`preferences_unavailable`, `stored_preferences_invalid` ou
`preferences_read_timeout`), sem bloquear a página, sem criar/alterar preferência e sem expor
detalhes técnicos ao usuário. O timeout SHALL ser de 1000 ms, valor a validar em produção, e não
SHALL alterar o cliente Supabase global. O sistema SHALL registrar aviso operacional de falha de
leitura, sem dados pessoais.

O contrato de `/api/preferences` SHALL permanecer inalterado: indisponibilidade continua `503` e
valor persistido inválido continua `500 stored_preferences_invalid`, sem fallback silencioso na
API.

#### Scenario: Indisponibilidade na renderização

- **WHEN** a leitura da preferência falha por indisponibilidade
- **THEN** a página é renderizada em `pt-BR`
- **AND** a API continua respondendo `503 preferences_unavailable`

#### Scenario: Leitura lenta na renderização

- **WHEN** a leitura da preferência ultrapassa 1000 ms
- **THEN** a página é renderizada em `pt-BR`
- **AND** `preferences_read_timeout` é registrado
- **AND** a API não é alterada

#### Scenario: Valor inválido persistido

- **WHEN** a preferência persistida está fora do contrato
- **THEN** a página é renderizada em `pt-BR`
- **AND** a API continua respondendo `500 stored_preferences_invalid`
