# Loading States

> Synced from `fase-29-refinamento-visual-uat-launch-readiness` (ADDED).

## Purpose

12 rotas críticas do app autenticado devem exibir `loading.tsx` com skeletons dedicados durante carregamento SSR/SPA, eliminando telas em branco e layout shift.

## Requirements

### Requirement: loading.tsx em todas as 12 rotas críticas

O sistema SHALL criar arquivos `loading.tsx` nas 12 rotas especificadas, cada um com skeleton dedicado ao conteúdo da página.

#### Scenario: /dashboard exibe skeleton de cards + saldo

- **WHEN** um usuário navega para `/dashboard`
- **THEN** o loading.tsx exibe skeleton com cards de saldo e indicadores em grid
- **AND** as dimensões dos skeletons correspondem ao layout final (sem layout shift)

#### Scenario: /campanhas exibe skeleton de lista

- **WHEN** um usuário navega para `/campanhas`
- **THEN** o loading.tsx exibe skeleton com 6 cards de campanha em grid 3x2 (lg) / 2x3 (sm)
- **AND** cada card preserva aspect ratio quadrado para prévia

#### Scenario: /campanhas/nova exibe skeleton de formulário

- **WHEN** um usuário navega para `/campanhas/nova`
- **THEN** o loading.tsx exibe skeleton com campos de formulário (inputs, selects, botão)

#### Scenario: /campanhas/[id] exibe skeleton de preview + copy

- **WHEN** um usuário navega para `/campanhas/[id]`
- **THEN** o loading.tsx exibe skeleton com área de preview (aspect ratio 1:1) + painel de copy

#### Scenario: /conta exibe skeleton de perfil + extrato

- **WHEN** um usuário navega para `/conta`
- **THEN** o loading.tsx exibe skeleton de informações do perfil e tabela de extrato

#### Scenario: /loja exibe skeleton de identidade

- **WHEN** um usuário navega para `/loja`
- **THEN** o loading.tsx exibe skeleton do formulário de identidade da loja

#### Scenario: /admin exibe skeleton de admin dashboard

- **WHEN** um usuário admin navega para `/admin`
- **THEN** o loading.tsx exibe skeleton com cards e indicadores admin

#### Scenario: /admin/users exibe skeleton de tabela

- **WHEN** um usuário admin navega para `/admin/users`
- **THEN** o loading.tsx exibe skeleton de tabela com 5 linhas de altura consistente

#### Scenario: /admin/users/[id] exibe skeleton de detalhe

- **WHEN** um usuário admin navega para `/admin/users/[id]`
- **THEN** o loading.tsx exibe skeleton de detalhes do usuário (cards + informações)

#### Scenario: /admin/campaigns/errors exibe skeleton de erros

- **WHEN** um usuário admin navega para `/admin/campaigns/errors`
- **THEN** o loading.tsx exibe skeleton de lista de erros

#### Scenario: /admin/audit-log exibe skeleton de audit

- **WHEN** um usuário admin navega para `/admin/audit-log`
- **THEN** o loading.tsx exibe skeleton de tabela de audit log

#### Scenario: /admin/metrics exibe skeleton de cards

- **WHEN** um usuário admin navega para `/admin/metrics`
- **THEN** o loading.tsx exibe skeleton com cards de métricas + health banner

### Requirement: Componente Skeleton com variantes

O sistema SHALL estender o componente `Skeleton` existente com variantes tipadas: `card`, `table`, `form`, `preview`, `stats`.

#### Scenario: Variante card renderiza bloco com aspect ratio e linhas de texto

- **WHEN** `<Skeleton variant="card" />` é renderizado
- **THEN** exibe bloco `aspect-square` + 2 linhas de texto simuladas

#### Scenario: Variante table renderiza linhas de altura consistente

- **WHEN** `<Skeleton variant="table" rows={5} />` é renderizado
- **THEN** exibe 5 linhas com altura uniforme e largura variável simulando colunas

#### Scenario: Variante form renderiza campos de formulário

- **WHEN** `<Skeleton variant="form" />` é renderizado
- **THEN** exibe skeletons de label + input repetidos simulando formulário

#### Scenario: Variante preview renderiza bloco com aspecto quadrado

- **WHEN** `<Skeleton variant="preview" />` é renderizado
- **THEN** exibe bloco `aspect-square` com dimensões estáveis

#### Scenario: Variante stats renderiza cards de estatística

- **WHEN** `<Skeleton variant="stats" count={4} />` é renderizado
- **THEN** exibe 4 cards em grid com valor + label simulados

### Requirement: Shimmer adaptado ao dark mode

O componente Skeleton SHALL usar shimmer discreto adaptado ao dark mode — opacidade variável no dark (`animate-pulse` padrão no light, opacidade sutil no dark).

#### Scenario: Dark mode exibe shimmer com opacidade variável

- **WHEN** o tema está em dark mode e um Skeleton é renderizado
- **THEN** a animação usa opacidade variável (ex: 0.05 → 0.15) sem cores vibrantes ou animação colorida

#### Scenario: Light mode exibe animate-pulse padrão

- **WHEN** o tema está em light mode e um Skeleton é renderizado
- **THEN** a animação usa `animate-pulse` padrão do Tailwind

### Requirement: Sem layout shift durante transição loading → conteúdo

Os skeletons SHALL ter dimensões estáveis que correspondem ao layout final, eliminando Cumulative Layout Shift (CLS).

#### Scenario: Cards de campanha mantêm altura durante transição

- **WHEN** o conteúdo carrega e substitui o skeleton
- **THEN** a altura do container não muda (skeleton e conteúdo têm mesma altura)
