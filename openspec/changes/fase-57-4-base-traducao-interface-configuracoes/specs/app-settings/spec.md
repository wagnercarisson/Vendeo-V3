## ADDED Requirements

### Requirement: Rota autenticada de configurações

O sistema SHALL prover a rota `/configuracoes`, acessível apenas por usuário autenticado,
disponível também para usuário sem loja. A rota SHALL depender somente da conta e da preferência
de idioma; não SHALL exigir loja, campanha, cobrança ou onboarding concluído.

A rota SHALL ser acessível pela navegação somente no menu do usuário da topbar. A sidebar SHALL
NOT receber um novo item.

#### Scenario: Usuário sem loja acessa configurações

- **WHEN** um usuário autenticado sem loja acessa `/configuracoes`
- **THEN** a página é renderizada com a seção de idioma
- **AND** nenhuma tela de loja é exigida

#### Scenario: Usuário não autenticado

- **WHEN** um visitante sem sessão acessa `/configuracoes`
- **THEN** o acesso é negado/redirecionado conforme o guard existente
- **AND** nenhuma preferência é lida ou escrita

#### Scenario: Sidebar não ganha novo item

- **WHEN** a sidebar desktop ou o drawer mobile é renderizado
- **THEN** os cinco itens existentes permanecem
- **AND** `/configuracoes` não aparece na sidebar

### Requirement: Conteúdo da página de configurações

A página SHALL conter título e breadcrumb traduzidos e uma seção “Idioma do aplicativo” com as
opções:
- Português (Brasil) → `pt-BR`;
- Español (Latinoamérica) → `es-419`.

As opções SHALL ser controles nativos acessíveis (grupo de rádio com `fieldset`/`legend`) e
exibir a preferência persistida. A página SHALL NOT mover conteúdo de `/conta`.

#### Scenario: Página exibe as duas opções

- **WHEN** a página é renderizada
- **THEN** “Português (Brasil)” e “Español (Latinoamérica)” são exibidos
- **AND** a opção correspondente à preferência persistida está marcada

#### Scenario: Conteúdo de conta permanece em /conta

- **WHEN** a página de configurações é renderizada
- **THEN** notificações, créditos, segurança e dados da conta não são movidos para ela

### Requirement: Leitura inicial sem escrita

A página SHALL ler a preferência e a versão existentes no servidor para renderizar o formulário.
Visitar a página SHALL NOT criar linha em `user_preferences`, chamar a RPC de escrita ou disparar
PATCH automaticamente.

#### Scenario: Primeiro acesso legado

- **WHEN** um usuário sem linha de preferência acessa `/configuracoes`
- **THEN** a opção `pt-BR` é exibida como preferência efetiva
- **AND** nenhuma linha é criada e nenhum PATCH é enviado

#### Scenario: Falha de leitura

- **WHEN** a leitura da preferência falha
- **THEN** a página exibe estado de erro traduzido com ação de tentar novamente
- **AND** o formulário de escrita não é exibido

### Requirement: Salvamento com controle de versão

Ao salvar, a página SHALL enviar `PATCH /api/preferences` com `uiLocale` selecionado e
`expectedVersion` vigente, usando a API existente, mesma origem/CSRF e sem nova rota.

O salvamento SHALL ocorrer apenas por ação explícita do usuário. `null` e `uiLocale` omitido NÃO
SHALL ser expostos na interface; seus significados na API permanecem inalterados.

#### Scenario: Salvamento explícito de es-419

- **WHEN** o usuário seleciona “Español (Latinoamérica)” e aciona salvar
- **THEN** o PATCH envia `{ uiLocale: "es-419", expectedVersion: <versão atual> }`
- **AND** a resposta 200 atualiza a versão local

#### Scenario: Nenhuma escrita automática

- **WHEN** a página é aberta e o usuário não altera a seleção
- **THEN** nenhum PATCH é enviado
- **AND** nenhuma linha de preferência é criada

#### Scenario: Sem exposição de null/omitido

- **WHEN** o formulário é renderizado
- **THEN** não existe controle para limpar a preferência
- **AND** o PATCH sempre inclui um `uiLocale` suportado e `expectedVersion`

### Requirement: Conflito, indisponibilidade e sessão

A página SHALL tratar respostas e falhas sem perder a seleção atual:
- `409`: informar conflito de versão e oferecer recarregar o valor vigente, sem regravar
  automaticamente;
- `403`: informar falha de origem/CSRF e orientar recarregar a página;
- falha de rede/interrupção: informar falha de conexão e permitir nova tentativa;
- `503`/`500`: informar indisponibilidade e permitir nova tentativa;
- `400`: informar validação inválida;
- `401`: informar sessão expirada e orientar novo login, sem escrita.

Em qualquer erro, o estado de salvamento SHALL ser encerrado, os controles SHALL ser
reabilitados e a seleção SHALL permanecer. A página SHALL NOT ficar presa em “salvando”.

#### Scenario: Conflito de versão

- **WHEN** o PATCH retorna `409 preferences_version_conflict`
- **THEN** a página exibe a mensagem de conflito
- **AND** não reenvia o PATCH automaticamente
- **AND** oferece recarregar o valor e a versão atuais

#### Scenario: Origem/CSRF inválida

- **WHEN** o PATCH retorna `403`
- **THEN** a página exibe a mensagem de origem inválida
- **AND** mantém a seleção e permite recarregar/tentar novamente

#### Scenario: Falha de rede

- **WHEN** a requisição é interrompida ou falha antes de uma resposta
- **THEN** a página exibe mensagem de conexão
- **AND** o estado de salvamento é encerrado
- **AND** a seleção permanece e pode ser reenviada

#### Scenario: Preferências indisponíveis

- **WHEN** o PATCH retorna `503 preferences_unavailable`
- **THEN** a seleção do usuário é preservada
- **AND** a página permite tentar novamente

### Requirement: Aplicação do idioma após salvar

Após um salvamento 200, a interface SHALL atualizar o layout compartilhado e a página juntos por
`router.refresh()`, sem reload completo da aplicação, sem perda de campos preenchidos e sem
navegação destrutiva. A confirmação SHALL ser baseada no sucesso real do PATCH, não na presença de
query string, e SHALL permanecer visível após o refresh.

O formulário SHALL sincronizar seleção e versão com o DTO retornado e com as novas props do
servidor após o refresh. Trocas repetidas `pt-BR → es-419 → pt-BR` SHALL funcionar com o mesmo
fluxo. Após recarregar um conflito, seleção e versão SHALL voltar a corresponder ao valor vigente.

A troca de idioma SHALL NOT alterar país da loja, mercado, moeda, conteúdo de campanha ou
quaisquer outros dados.

#### Scenario: Shell muda para espanhol após salvar

- **WHEN** o PATCH de `es-419` retorna 200
- **THEN** `router.refresh()` atualiza shell e configurações para espanhol
- **AND** a confirmação é exibida por ter havido salvamento real
- **AND** não ocorre reload completo do navegador

#### Scenario: Trocas repetidas

- **WHEN** o usuário salva `es-419` e depois volta a salvar `pt-BR`
- **THEN** shell e página são atualizados nas duas direções
- **AND** seleção e versão permanecem sincronizadas após cada salvamento

#### Scenario: Confirmação não vem de query string

- **WHEN** a URL contém `?saved=1` sem um PATCH bem-sucedido nesta sessão
- **THEN** nenhuma confirmação de salvamento é exibida

#### Scenario: Conflito recarregado sincroniza o formulário

- **WHEN** o usuário aciona recarregar após `409`
- **THEN** a página busca o valor/versão vigentes
- **AND** a seleção e a versão do formulário passam a corresponder a eles

#### Scenario: Loja e campanhas não mudam

- **WHEN** o idioma da interface é alterado
- **THEN** `store_market_settings`, campanhas e conteúdo permanecem inalterados

#### Scenario: Preferência preservada no próximo acesso

- **WHEN** o usuário retorna em uma nova sessão após salvar `es-419`
- **THEN** a interface inicia em espanhol
- **AND** não há flash de português antes do espanhol
