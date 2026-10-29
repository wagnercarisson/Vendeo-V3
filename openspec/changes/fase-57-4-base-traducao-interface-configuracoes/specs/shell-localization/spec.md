## ADDED Requirements

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

### Requirement: Idioma declarado no documento

O shell autenticado SHALL declarar o idioma efetivo no elemento raiz do shell (`lang`). Após a
hidratação, o sistema SHALL ajustar `document.documentElement.lang` para o idioma efetivo, sem
alterar o texto já renderizado. Em `/admin`, o idioma efetivo SHALL ser `pt-BR`.

#### Scenario: Atributo lang em espanhol

- **WHEN** o shell do lojista é renderizado em `es-419`
- **THEN** o contêiner do shell declara `lang="es-419"`
- **AND** o documento é ajustado para `es-419` após a hidratação

#### Scenario: Admin declara português

- **WHEN** uma rota `/admin` é renderizada
- **THEN** o contêiner do shell declara `lang="pt-BR"`
