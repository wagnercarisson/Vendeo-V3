# Empty States

> Synced from `fase-29-refinamento-visual-uat-launch-readiness` (ADDED).

## Purpose

7 estados de empty padronizados usando o componente `EmptyState` existente, com ilustração, mensagem e CTA quando aplicável, em todas as listas, tabelas e painéis do produto.

## Requirements

### Requirement: Componente EmptyState mantido como padrão

O sistema SHALL manter o componente `EmptyState` existente como padrão, com interface `{ icon?: React.ReactNode; title: string; description: string; action?: { label: string; href?: string; onClick?: () => void } }`.

#### Scenario: EmptyState com action renderiza título, descrição e botão

- **WHEN** `<EmptyState title="..." description="..." action={{ label: "Criar", href: "/" }} />` é renderizado
- **THEN** exibe ícone (se fornecido), título, descrição e link/botão de ação

#### Scenario: EmptyState sem action renderiza apenas título e descrição

- **WHEN** `<EmptyState title="..." description="..." />` é renderizado (sem action)
- **THEN** exibe ícone (se fornecido), título e descrição — sem CTA

### Requirement: Empty state "Sem campanhas"

O sistema SHALL exibir empty state na página `/campanhas` quando o usuário não tem nenhuma campanha.

#### Scenario: Lista vazia mostra empty state com CTA "Criar primeira campanha"

- **WHEN** um usuário sem campanhas acessa `/campanhas`
- **THEN** exibe `<EmptyState icon={<MegaphoneIcon />} title="Nenhuma campanha ainda" description="Crie sua primeira campanha e comece a divulgar seus produtos." action={{ label: "Criar campanha", href: "/campanhas/nova" }} />`

### Requirement: Empty state "Busca sem resultados"

O sistema SHALL exibir empty state na página `/campanhas` quando a busca não retorna resultados.

#### Scenario: Busca vazia mostra empty state com opção de limpar filtros

- **WHEN** um usuário busca por campanhas e nenhum resultado é encontrado
- **THEN** exibe `<EmptyState title="Nenhuma campanha encontrada" description="Tente ajustar sua busca ou limpar os filtros." action={{ label: "Limpar filtros", onClick: () => setSearch("") }} />`

### Requirement: Empty state "Sem transações"

O sistema SHALL exibir empty state informativo na página `/conta` quando o extrato está vazio.

#### Scenario: Extrato vazio mostra empty state informativo

- **WHEN** um usuário sem transações acessa `/conta`
- **THEN** exibe `<EmptyState title="Nenhuma transação ainda" description="Seu extrato será preenchido conforme você usar seus créditos." />` (sem action)

### Requirement: Empty state "Admin sem lojas"

O sistema SHALL exibir empty state na página `/admin/users` quando não há lojistas cadastrados.

#### Scenario: Tabela de usuários vazia mostra empty state

- **WHEN** um admin acessa `/admin/users` e não há lojistas cadastrados
- **THEN** exibe `<EmptyState title="Nenhum lojista cadastrado" description="Aguardando o primeiro cadastro." />`

### Requirement: Empty state "Admin sem métricas"

O sistema SHALL exibir empty state na página `/admin/metrics` quando não há dados de geração disponíveis.

#### Scenario: Métricas sem dados mostram "Aguardando dados de geração"

- **WHEN** um admin acessa `/admin/metrics` e não há dados de geração
- **THEN** exibe `<EmptyState title="Aguardando dados de geração" description="As métricas serão exibidas conforme campanhas forem geradas." />`

### Requirement: Empty state "Admin sem erros"

O sistema SHALL exibir empty state na página `/admin/campaigns/errors` quando não há erros registrados.

#### Scenario: Página de erros vazia mostra "Nenhum erro registrado"

- **WHEN** um admin acessa `/admin/campaigns/errors` e não há erros
- **THEN** exibe `<EmptyState title="Nenhum erro registrado" description="Tudo funcionando sem problemas." />`

### Requirement: Empty state "Saldo zero"

O sistema SHALL exibir empty state distinto quando o saldo do usuário está zerado, com CTA para solicitar créditos.

#### Scenario: Saldo zero mostra "Créditos insuficientes" + CTA

- **WHEN** um usuário com saldo zero tenta gerar uma campanha ou acessa área de saldo
- **THEN** exibe `<EmptyState title="Créditos insuficientes" description="Você precisa de créditos para gerar uma campanha." action={{ label: "Solicitar créditos", href: "/conta#creditos" }} />`

### Requirement: Empty states de `/campanhas` seguem o idioma da interface

Os empty states de `/campanhas` (sem loja, sem campanhas e busca sem resultados) SHALL usar o namespace de textos da listagem no idioma da interface. O `pt-BR` SHALL permanecer o padrão e preservar exatamente títulos, descrições e CTAs atuais; `es-419` SHALL apresentar textos equivalentes em espanhol neutro LATAM.

A localização NÃO SHALL alterar a condição que escolhe cada estado, a existência ou ausência de ação, o destino dos CTAs (`/loja`, `/campanhas/nova`) nem os ícones.

#### Scenario: Empty state sem campanhas em pt-BR permanece igual

- **WHEN** um usuário com `uiLocale = "pt-BR"` sem campanhas acessa `/campanhas`
- **THEN** os textos SHALL permanecer "Nenhuma campanha ainda", "Crie sua primeira campanha e comece a divulgar seus produtos." e "Criar campanha"
- **AND** o CTA SHALL apontar para `/campanhas/nova`

#### Scenario: Empty state sem campanhas em es-419

- **WHEN** um usuário com `uiLocale = "es-419"` sem campanhas acessa `/campanhas`
- **THEN** os textos SHALL vir do catálogo `es-419` do namespace da listagem
- **AND** o CTA SHALL continuar apontando para `/campanhas/nova`

#### Scenario: Busca sem resultados em es-419

- **WHEN** um usuário com `uiLocale = "es-419"` busca e nenhum resultado é encontrado
- **THEN** o estado "sem resultados" SHALL ser exibido em espanhol
- **AND** a condição de exibição SHALL continuar sendo a presença de filtros ativos com lista vazia
