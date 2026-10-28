## ADDED Requirements

### Requirement: Modelo persistido com proveniência por campo

O sistema SHALL persistir as configurações de mercado de cada loja em
`public.store_market_settings` (1:1 com `stores`), contendo `country_code`,
`country_source`, `default_campaign_market`, `default_content_locale`, `default_currency`,
`time_zone`, a fonte de cada campo padrão (`explicit` | `default` | `legacy_br`),
`context_version` e `settings_version`.

Os valores SHALL ser validados contra os contratos de `src/lib/market-context/**`; nenhum
valor fora de `BR`/`PY`, `pt-BR`/`es-PY`, `BRL`/`PYG` ou dos fusos suportados SHALL ser aceito.

`country_code` SHALL NOT ser derivado de `store_billing_info.billing_address_country`, de
endereço, cidade, IP, navegador ou idioma do aplicativo.

#### Scenario: Loja configurada devolve valores e fontes

- **WHEN** uma loja possui linha com mercado `BR`, locale `pt-BR`, moeda `BRL`, fuso
  `America/Sao_Paulo` e fontes explícitas
- **THEN** a leitura devolve esses valores, a fonte de cada campo e a versão do contrato
- **AND** nenhum campo fiscal, de billing ou identificador interno é exposto

#### Scenario: Loja sem linha é legado, não erro

- **WHEN** a loja não possui linha em `store_market_settings`
- **THEN** a leitura resolve `BR`/`BR`/`pt-BR`/`BRL`/`America/Sao_Paulo` com proveniência
  `legacy_br`
- **AND** a operação de leitura SHALL NOT criar ou alterar a linha

#### Scenario: Ausência de linha não é confundida com falha

- **WHEN** a consulta ao banco falha por indisponibilidade
- **THEN** a resposta é `503` com código `preferences_unavailable`
- **AND** o sistema SHALL NOT responder com padrões BR como se fossem legado

### Requirement: Leitura e escrita autorizadas por ownership

As rotas de configurações da loja SHALL exigir usuário autenticado e SHALL operar somente sobre
a loja pertencente a esse usuário. `GET /api/store/market-settings` SHALL ser somente leitura;
`PATCH` SHALL exigir a mesma origem (`requireSameOrigin`).

Escritas SHALL ocorrer por RPC `service_role`-only, precedidas de verificação de ownership no
caminho da aplicação. `country_code` SHALL NOT ser alterável por este PATCH.

#### Scenario: Dono lê e altera a própria loja

- **WHEN** o usuário autenticado é dono da loja e envia um PATCH válido
- **THEN** os campos informados são persistidos com fonte `explicit`
- **AND** a versão é incrementada

#### Scenario: Loja de outro usuário não é acessível

- **WHEN** o usuário A tenta ler ou alterar configurações da loja do usuário B
- **THEN** a resposta é `404` sem revelar dados ou a existência da loja
- **AND** nenhuma escrita ocorre

#### Scenario: Falha de banco não vira loja inexistente

- **WHEN** a consulta de loja falha por indisponibilidade do banco
- **THEN** a resposta é `503 preferences_unavailable`
- **AND** o sistema SHALL NOT responder `404` nem usar padrões BR como sucesso

#### Scenario: País não é alterável pela rota de preferências

- **WHEN** o PATCH inclui `country` ou `country_code`
- **THEN** a resposta é `400 country_not_mutable`
- **AND** nenhuma escrita ocorre

#### Scenario: Escrita sem origem válida é negada

- **WHEN** o PATCH chega sem `Origin` correspondente ao host
- **THEN** a resposta é `403`
- **AND** nenhuma escrita ocorre

### Requirement: Atualização parcial determinística

O PATCH SHALL distinguir campo omitido, `null` e valor inválido:

- omitido: valor e fonte permanecem inalterados;
- `null`: remove override explícito e recomputa o padrão com fonte `default`;
- inválido: `400` com `fieldErrors`, sem escrita;
- chave desconhecida: `400`, sem escrita.

A recomposição SHALL ocorrer na ordem mercado → idioma/moeda → fuso, e o contexto completo
SHALL ser resolvido e validado antes da persistência.

**Exceção explícita:** quando `defaultCampaignMarket` muda, `defaultContentLocale` e
`defaultCurrency` com fonte `default` **ou `legacy_br`** SHALL ser recomputados para o padrão do
novo mercado e passar a fonte `default`. Campos com fonte `explicit` SHALL NOT ser alterados por
essa mudança. `time_zone` só muda se enviado ou se o país cadastral mudar.

Loja legada sem escolha permanece BR/`pt-BR`/`BRL` enquanto o mercado não muda; ao escolher
outro mercado, os campos não explícitos acompanham o destino. Voltar ao mercado BR recomputa
`pt-BR`/`BRL`.

#### Scenario: Mudar somente o mercado recomputa apenas derivados

- **WHEN** uma loja BR com idioma/moeda em fonte `default` altera
  `defaultCampaignMarket` para `PY`
- **THEN** `defaultContentLocale` passa a `es-PY` e `defaultCurrency` a `PYG`
- **AND** `time_zone` permanece `America/Sao_Paulo`
- **AND** eventuais campos `explicit` permanecem intactos

#### Scenario: Loja legada sem linha escolhe outro mercado

- **WHEN** uma loja sem linha em `store_market_settings` (legado) define
  `defaultCampaignMarket = "PY"`
- **THEN** o idioma passa a `es-PY` e a moeda a `PYG`
- **AND** ambos passam a fonte `default`
- **AND** país continua BR `legacy_br` e fuso `America/Sao_Paulo`

#### Scenario: Legado materializado acompanha o novo mercado

- **WHEN** uma linha materializada a partir de legado (fontes `legacy_br`) muda o mercado para PY
- **THEN** idioma/moeda não explícitos passam a `es-PY`/`PYG` com fonte `default`
- **AND** mercado explícito PY e demais escolhas explícitas são preservados

#### Scenario: Retorno PY para BR recomputa padrões brasileiros

- **WHEN** a loja com mercado PY e idioma/moeda em fonte `default` volta o mercado para `BR`
- **THEN** idioma/moeda passam a `pt-BR`/`BRL` com fonte `default`
- **AND** escolhas explícitas previamente existentes não são recriadas nem apagadas

#### Scenario: Omitir campo preserva valor

- **WHEN** o PATCH envia apenas `defaultCurrency`
- **THEN** mercado, idioma e fuso permanecem com valores e fontes anteriores

#### Scenario: Null limpa override

- **WHEN** o PATCH envia `defaultContentLocale: null` em loja com override explícito
- **THEN** o idioma volta ao padrão do mercado padrão
- **AND** a fonte passa a `default`

#### Scenario: Valor inválido não escreve

- **WHEN** o PATCH envia `defaultCurrency: "USD"`
- **THEN** a resposta é `400` com erro no campo `defaultCurrency`
- **AND** a versão e todos os valores permanecem inalterados

### Requirement: Concorrência sem perda de escolhas independentes

Toda escrita SHALL exigir `expectedVersion` (0 quando a linha ainda não existe) e SHALL falhar
com `409 settings_version_conflict` quando a versão atual divergir, retornando a versão vigente.
O sistema SHALL NOT sobrescrever silenciosamente uma escrita concorrente.

#### Scenario: Duas escritas independentes concorrentes

- **WHEN** duas requisições atualizam moeda e fuso simultaneamente a partir da mesma versão
- **THEN** exatamente uma escrita é aceita
- **AND** a outra recebe `409` com a versão atual
- **AND** repetir a rejeitada com a nova versão preserva o campo aceito pela primeira

#### Scenario: País é imutável na escrita genérica

- **WHEN** uma RPC de escrita recebe `country_code` diferente do já persistido
- **THEN** o banco rejeita a operação
- **AND** nenhuma alteração de país ou versão ocorre

#### Scenario: Primeira escrita concorrente sem linha

- **WHEN** duas requisições tentam criar as configurações pela primeira vez com
  `expectedVersion = 0`
- **THEN** exatamente uma cria a linha com versão 1
- **AND** a outra observa a versão 1 e recebe `409 settings_version_conflict`
- **AND** nenhuma escrita parcial é aceita

### Requirement: Mercado não concede autorização

O sistema SHALL NOT usar `country_code`, mercado padrão ou idioma para conceder acesso a dados,
rotas ou operações. Duas lojas do mesmo país SHALL permanecer isoladas por ownership.

#### Scenario: Mesmo país, lojas diferentes

- **WHEN** duas lojas possuem `country_code = "BR"`
- **THEN** essa igualdade não permite leitura cruzada
- **AND** a verificação de ownership continua obrigatória
