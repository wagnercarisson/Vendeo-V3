## Purpose

Sincronizado de `openspec/changes/fase-57-4-base-traducao-interface-configuracoes` em 2026-10-30.

## Requirements

### Requirement: Textos fixos do shell traduzidos

Os componentes compartilhados da área do lojista SHALL obter do catálogo os textos fixos de:
sidebar desktop e drawer mobile, topbar, menu da conta, botão de saída, badge de novidades e sino
de notificações.

Os rótulos SHALL existir em `pt-BR` e `es-419`, preservando destinos, ícones, ordem de ações,
permissões e comportamento de navegação. A tradução SHALL cobrir também `aria-label`, `title`,
textos de estado e dicas diretamente ligados a esses componentes.

#### Scenario: Shell em espanhol LATAM

- **WHEN** o usuário tem `uiLocale = "es-419"`
- **THEN** sidebar, drawer, topbar, menu da conta, badge e sino exibem os textos em `es-419`
- **AND** os `href` e ações permanecem os mesmos

#### Scenario: Shell em português

- **WHEN** o usuário tem `uiLocale = "pt-BR"` ou preferência legada
- **THEN** o shell exibe os textos em `pt-BR`
- **AND** o comportamento de navegação permanece o mesmo

#### Scenario: Acessibilidade traduzida

- **WHEN** o shell é renderizado em `es-419`
- **THEN** `aria-label` de navegação, abertura/fechamento do menu, CTA, conta, badge e sino usam
  o catálogo espanhol
- **AND** os mesmos elementos continuam operáveis por teclado e leitor de tela

### Requirement: Conteúdo dinâmico permanece fora da tradução

O shell SHALL NOT traduzir nome de loja, identificador/e-mail do usuário, contagem de
notificações como conteúdo, payload de notificação, entradas de changelog ou qualquer conteúdo
escrito pelo lojista. Interpolação SHALL ser usada apenas para compor rótulos fixos.

#### Scenario: Nome da loja não é traduzido

- **WHEN** a loja se chama “Padaria da Esquina” e o idioma é `es-419`
- **THEN** o nome exibido na topbar permanece “Padaria da Esquina”

#### Scenario: Notificação dinâmica não é traduzida

- **WHEN** uma notificação possui título e mensagem persistidos
- **THEN** o conteúdo é exibido como está
- **AND** apenas o rótulo fixo do sino é traduzido

### Requirement: Admin preservado em português

Rotas sob `/admin` SHALL manter o shell em `pt-BR`, independentemente da preferência do usuário.
O admin SHALL NOT exibir link para `/configuracoes` nem seletor de idioma. O menu da conta no
admin SHALL preservar o comportamento atual: “Configurações” aponta para `/conta`, seguido de
“Novidades” e “Sair”.

#### Scenario: Admin de usuário em espanhol

- **WHEN** um usuário com `uiLocale = "es-419"` acessa `/admin`
- **THEN** o shell é renderizado em `pt-BR`
- **AND** nenhum link para `/configuracoes` é exibido no menu da conta

#### Scenario: Preferência não propaga ao admin

- **WHEN** o usuário altera o idioma da interface para `es-419`
- **THEN** a área `/admin` continua em português

### Requirement: Idioma declarado apenas nas regiões traduzidas

O documento SHALL permanecer em `pt-BR`. O sistema SHALL NOT alterar globalmente
`document.documentElement.lang` nem declarar `es-419` em páginas cujo conteúdo continua em
português.

Apenas as regiões efetivamente traduzidas SHALL declarar `lang="es-419"`: sidebar, drawer, CTA,
hamburger, sino, menu da conta e conteúdo traduzido de `/configuracoes`. Regiões com conteúdo
dinâmico não traduzido (nome da loja, e-mail, notificações) SHALL NOT receber `lang` de espanhol.
Em `/admin`, todas as regiões permanecem `pt-BR`.

#### Scenario: Página não traduzida não é marcada como espanhola

- **WHEN** dashboard, conta ou campanhas são renderizados para usuário em `es-419`
- **THEN** o documento permanece `lang="pt-BR"`
- **AND** o conteúdo português não é marcado como `es-419`

#### Scenario: Região traduzida declara espanhol

- **WHEN** o shell do lojista é renderizado em `es-419`
- **THEN** somente as regiões traduzidas declaram `lang="es-419"`
- **AND** o documento não é alterado globalmente

#### Scenario: Admin declara português

- **WHEN** uma rota `/admin` é renderizada
- **THEN** as regiões do shell permanecem em `pt-BR`

### Requirement: Rótulo do botão de saída por propriedade

O componente compartilhado `LogoutButton` SHALL aceitar um rótulo por propriedade, com padrão
“Sair” em português. O shell SHALL passar o rótulo do catálogo no idioma efetivo.

O componente SHALL NOT depender de provider de i18n, contexto obrigatório ou novo client. O
logout, a limpeza de rascunhos e os demais usos em `/conta` e admin SHALL permanecer inalterados.

#### Scenario: Shell traduz Sair

- **WHEN** o shell é renderizado em `es-419`
- **THEN** o botão de saída exibe o rótulo espanhol do catálogo
- **AND** o logout continua limpando os rascunhos e encerrando a sessão

#### Scenario: Consumidor não traduzido mantém português

- **WHEN** `LogoutButton` é usado sem a propriedade de rótulo em `/conta` ou admin
- **THEN** o texto permanece “Sair”
- **AND** nenhum provider é exigido
