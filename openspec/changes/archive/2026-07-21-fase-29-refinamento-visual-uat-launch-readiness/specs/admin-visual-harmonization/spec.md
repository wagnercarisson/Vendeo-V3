# Admin Visual Harmonization

> Synced from `fase-29-refinamento-visual-uat-launch-readiness` (ADDED).

## Purpose

Harmonizar a área `/admin/*` com o design system dark OLED do Vendeo, removendo resquícios de estilo claro (bg-white, bg-gray-*, text-gray-*, bg-red-50, bg-green-50, text-green-*) e avaliando o painel `campaign-adjustments-panel.tsx`.

## Requirements

### Requirement: Admin em dark OLED consistente

A área `/admin/*` SHALL usar os tokens do design system dark OLED: background `#020617`, texto `#F8FAFC`, accent `#22C55E`, seguindo o `MASTER.md`.

#### Scenario: bg-white substituído por bg-background

- **WHEN** qualquer página `/admin/*` é renderizada
- **THEN** não há usos de `bg-white` — todo fundo usa `bg-background` ou variante dark consistente

#### Scenario: text-gray-* substituído por text-muted-foreground

- **WHEN** qualquer página `/admin/*` é renderizada
- **THEN** não há usos de `text-gray-*` — textos secundários usam `text-muted-foreground`

#### Scenario: bg-red-50 e bg-green-50 substituídos por variantes dark

- **WHEN** indicadores de status (erro/sucesso) são renderizados em `/admin/*`
- **THEN** usam `bg-destructive/10` e `bg-success/10` ou variantes dark equivalentes, não `bg-red-50`/`bg-green-50`

#### Scenario: Texto verde usa text-success, não text-green-*

- **WHEN** texto de status positivo é renderizado em `/admin/*`
- **THEN** usa `text-success` ou variante dark, não `text-green-*`

### Requirement: Cobertura nas 6 superfícies admin

A harmonização SHALL ser aplicada nas 6 superfícies admin mínimas: `/admin`, `/admin/users`, `/admin/users/[id]`, `/admin/metrics`, `/admin/campaigns/errors`, `/admin/audit-log`.

#### Scenario: Grid admin harmonizado

- **WHEN** o dashboard `/admin` é renderizado
- **THEN** cards, cabeçalho e navegação usam tokens dark OLED

#### Scenario: Tabela de usuários harmonizada

- **WHEN** `/admin/users` e `/admin/users/[id]` são renderizados
- **THEN** tabela, cards de detalhe e ações usam tokens dark OLED

#### Scenario: Página de métricas harmonizada

- **WHEN** `/admin/metrics` é renderizada
- **THEN** cards de métricas e health banner usam tokens dark OLED

#### Scenario: Página de erros harmonizada

- **WHEN** `/admin/campaigns/errors` é renderizada
- **THEN** lista de erros e filtros usam tokens dark OLED

#### Scenario: Audit log harmonizado

- **WHEN** `/admin/audit-log` é renderizado
- **THEN** tabela e ações usam tokens dark OLED

### Requirement: campaign-adjustments-panel.tsx avaliado

O sistema SHALL verificar o componente `campaign-adjustments-panel.tsx` para determinar seu estado de uso e alinhamento visual.

#### Scenario: Componente em uso ativo → alinhar ao dark

- **WHEN** o componente `campaign-adjustments-panel.tsx` está em uso no fluxo atual (renderizado em alguma rota)
- **THEN** o sistema alinha seu estilo ao dark OLED (bg-background, text-foreground, tokens do design system)

#### Scenario: Componente inativo → Accept/Monitor

- **WHEN** o componente `campaign-adjustments-panel.tsx` não está em uso em nenhuma rota ativa
- **THEN** o sistema registra como Accept/Monitor, documenta o estado, e não modifica o componente na F29
