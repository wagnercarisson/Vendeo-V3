## ADDED Requirements

### Requirement: Catálogos versionados e namespaces

O sistema SHALL manter os textos da interface em catálogos TypeScript versionados no repositório,
com um catálogo `pt-BR` e um catálogo `es-419`. Os catálogos SHALL ser organizados em namespaces
separados: `common` (ações reutilizáveis), `shell` (navegação e componentes compartilhados) e
`settings` (página de configurações).

Os catálogos SHALL ser a única fonte de texto fixo traduzido da interface. O sistema SHALL NOT
persistir traduções em tabelas, consultar serviços externos em tempo de renderização ou traduzir
conteúdo dinâmico.

#### Scenario: Catálogos existem para os dois idiomas

- **WHEN** a aplicação é construída
- **THEN** existem catálogos `pt-BR` e `es-419` com os namespaces `common`, `shell` e `settings`
- **AND** nenhum texto fixo traduzido é lido de tabela ou serviço externo

#### Scenario: Conteúdo dinâmico não é traduzido

- **WHEN** a interface exibe nome de loja, e-mail, notificação, changelog ou conteúdo de campanha
- **THEN** o valor é exibido como recebido
- **AND** não passa pelo catálogo de tradução

### Requirement: Paridade, interpolação e cobertura dos catálogos

Os catálogos SHALL ter exatamente as mesmas chaves e a mesma estrutura de namespaces. Cada valor
SHALL ser uma string não vazia. Placeholders de interpolação no formato `{nome}` SHALL existir no
mesmo conjunto em ambos os idiomas para a mesma chave.

A validação SHALL ocorrer em teste automatizado de cobertura, comparando recursivamente as chaves
e os placeholders. Chave faltante, namespace divergente ou placeholder divergente SHALL falhar no
typecheck ou no teste de catálogos.

#### Scenario: Catálogo espanhol sem chave portuguesa falha

- **WHEN** uma chave existe em `pt-BR` e não existe em `es-419`
- **THEN** o typecheck ou o teste de cobertura SHALL falhar
- **AND** a lacuna não pode chegar silenciosamente à interface

#### Scenario: Placeholders coincidem

- **WHEN** a chave contém `{count}` em `pt-BR`
- **THEN** a mesma chave SHALL conter `{count}` em `es-419`
- **AND** o teste de cobertura SHALL comparar o conjunto de placeholders

### Requirement: Interpolação segura e chave ausente em runtime

O sistema SHALL prover uma função de interpolação que substitui placeholders `{nome}` por valores
fornecidos, sem interpretar HTML e sem avaliação dinâmica. A função SHALL retornar string simples.

Em runtime, se uma chave estiver ausente no catálogo do locale, o sistema SHALL usar a chave
equivalente de `pt-BR`. Se também estiver ausente em `pt-BR`, SHALL retornar a própria chave e
registrar aviso apenas em desenvolvimento, sem lançar erro para o usuário.

#### Scenario: Interpolação de contagem

- **WHEN** a mensagem é `Notificações não lidas: {count}` e `count = 3`
- **THEN** o texto renderizado é `Notificações não lidas: 3`
- **AND** nenhum HTML é interpretado

#### Scenario: Chave ausente cai para pt-BR

- **WHEN** uma chave existe em `pt-BR` mas não no catálogo carregado
- **THEN** o texto de `pt-BR` é usado
- **AND** a interface não exibe chave crua nem quebra

### Requirement: Resolução server-first e cache por requisição

O layout autenticado SHALL resolver o idioma da interface no servidor a partir da preferência
persistida do usuário, usando a leitura existente de `user_preferences`. O idioma resolvido e as
mensagens necessárias SHALL acompanhar a renderização inicial, sem requisição de rede exclusiva
para buscar traduções.

A leitura SHALL ser cacheada por requisição e por usuário, sem estado mutável de módulo. Usuários
diferentes na mesma instância SHALL receber idiomas e mensagens independentes.

A leitura adicional no layout SHALL ter limite de espera de **200 ms**, implementado sem alterar
o cliente Supabase global. Ao estourar o limite, a renderização SHALL usar `pt-BR`, registrar
`preferences_read_timeout` sem PII e prosseguir; a promise original SHALL ser isolada para não
gerar unhandled rejection.

#### Scenario: Espanhol já vem no HTML inicial

- **WHEN** um usuário com `uiLocale = "es-419"` acessa uma rota autenticada
- **THEN** o HTML inicial contém os textos de shell em espanhol
- **AND** não há requisição de tradução após a hidratação para trocar o texto

#### Scenario: Dois usuários não compartilham idioma

- **WHEN** dois usuários com preferências diferentes são renderizados em sequência
- **THEN** cada resposta usa o idioma do respectivo usuário
- **AND** nenhum cache de módulo reutiliza o idioma do primeiro

#### Scenario: Leitura lenta não bloqueia a página

- **WHEN** a leitura da preferência ultrapassa 200 ms
- **THEN** a página prossegue em `pt-BR`
- **AND** o evento `preferences_read_timeout` é registrado
- **AND** o cliente Supabase global não é alterado

### Requirement: Fallback de renderização sem alterar a API

O sistema SHALL resolver a interface para `pt-BR` quando a leitura da preferência falhar durante a
renderização com erro conhecido (`preferences_unavailable` ou `stored_preferences_invalid`), sem
bloquear a página e sem criar ou alterar preferência. O sistema SHALL registrar aviso sem dados
pessoais.
O contrato de `/api/preferences` SHALL permanecer inalterado: leitura indisponível continua `503`
e valor persistido inválido continua `500`, sem fallback silencioso na API.

#### Scenario: Falha de leitura não bloqueia a navegação

- **WHEN** a leitura da preferência falha por indisponibilidade
- **THEN** a página autenticada é renderizada em `pt-BR`
- **AND** nenhuma linha de preferência é criada ou alterada
- **AND** a API continua retornando `503`

#### Scenario: Valor persistido inválido

- **WHEN** a preferência persistida está fora do contrato
- **THEN** a renderização usa `pt-BR`
- **AND** a API continua retornando `500 stored_preferences_invalid`

### Requirement: Payload proporcional e sem catálogo completo

O shell autenticado SHALL receber apenas os namespaces necessários (`common` e `shell`). A página
de configurações SHALL receber apenas `settings` e as ações comuns. Nenhum catálogo completo SHALL
ser enviado ao navegador.

O shell SHALL sempre receber o catálogo `pt-BR` (necessário para a exceção do admin) e SHALL
receber o catálogo `es-419` somente quando o locale do usuário for `es-419`. Usuários em `pt-BR`
NÃO SHALL receber o catálogo espanhol do shell.

Os catálogos SHALL ser módulos estáticos; não SHALL haver endpoint, fetch ou arquivo JSON remoto
para carregar traduções. O custo em bytes e JavaScript adicional SHALL ser medido antes da
publicação.

#### Scenario: Catálogo de configurações não acompanha o shell

- **WHEN** uma rota comum do lojista é carregada
- **THEN** o payload do shell não contém o namespace `settings`

#### Scenario: Usuário português não recebe espanhol

- **WHEN** o usuário está em `pt-BR`
- **THEN** o payload do shell contém apenas o catálogo português
- **AND** não contém o catálogo `es-419` do shell

#### Scenario: Sem requisição de tradução

- **WHEN** a página é carregada em rede limitada
- **THEN** não há requisição adicional exclusiva para baixar o catálogo do idioma
