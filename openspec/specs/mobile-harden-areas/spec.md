# Mobile Harden — Áreas Pós-F22

> Synced from `fase-29-refinamento-visual-uat-launch-readiness` (ADDED).

## Purpose

Verificação mobile (320-768px) das superfícies adicionadas após F22 (F23-F28), sem novo ciclo amplo de mobile hardening: /conta, topbar, /campanhas/nova, /admin/*, /admin/metrics.

## Requirements

### Requirement: /conta responsivo em 320-768px

A página `/conta` SHALL ser verificada e ajustada para viewports 320-768px, mantendo saldo visível, extrato legível, paginação funcional e CTA de créditos acessível.

#### Scenario: Saldo visível sem overflow em mobile

- **WHEN** a página `/conta` é renderizada em viewport 320-768px
- **THEN** o card de saldo é completamente visível sem overflow horizontal

#### Scenario: Extrato com linhas legíveis em mobile

- **WHEN** a tabela de extrato é renderizada em viewport 320-768px
- **THEN** cada linha é legível (texto não cortado) e touch target >= 44px

#### Scenario: Paginação do extrato utilizável

- **WHEN** o extrato tem múltiplas páginas em viewport 320-768px
- **THEN** os botões de paginação são visíveis e têm touch target >= 44px

#### Scenario: CTA "Solicitar créditos" com touch target adequado

- **WHEN** o CTA de créditos é renderizado em viewport 320-768px
- **THEN** o botão tem touch target >= 44px e não está sobreposto a outros elementos

### Requirement: Topbar/app shell — saldo e menu em mobile

A topbar SHALL ser verificada para exibir saldo e menu do usuário sem overflow em viewport estreito.

#### Scenario: Saldo na topbar visível sem quebra

- **WHEN** a topbar é renderizada em viewport 320-768px
- **THEN** o saldo é exibido sem overflow e sem texto cortado

#### Scenario: Menu do usuário acessível em mobile

- **WHEN** o usuário toca no menu da topbar em viewport 320-768px
- **THEN** o menu dropdown é utilizável (opções com touch target >= 44px)

### Requirement: /campanhas/nova responsivo

A página `/campanhas/nova` SHALL ser verificada para estado de saldo insuficiente, botão desabilitado, tooltips e CTAs em viewport 320-768px.

#### Scenario: Estado de saldo insuficiente legível em mobile

- **WHEN** o estado de saldo insuficiente é exibido em /campanhas/nova em viewport 320-768px
- **THEN** a mensagem e CTA são legíveis sem overflow

#### Scenario: Botão de geração desabilitado com tooltip acessível

- **WHEN** o botão de geração está desabilitado (sem créditos) em viewport 320-768px
- **THEN** o tooltip explicativo é acionável e legível em mobile

### Requirement: Campos monetários com teclado mobile adequado

Os campos de preço e valor de oferta em `/campanhas/nova` SHALL usar `inputMode` apropriado para exibir teclado numérico/decimal no mobile.

#### Scenario: Preço usa inputMode="decimal"

- **WHEN** o campo de preço é focado em dispositivo mobile
- **THEN** o teclado exibido é numérico com ponto decimal (`inputMode="decimal"`)

#### Scenario: Valores de oferta usam inputMode="numeric"

- **WHEN** o campo de valor promocional ou desconto é focado em dispositivo mobile
- **THEN** o teclado exibido é numérico (`inputMode="numeric"`)

#### Scenario: Labels e validação em PT-BR claro

- **WHEN** campos monetários são renderizados
- **THEN** os labels são claros ("Preço do produto", "Valor promocional") e mensagens de validação são em PT-BR sem jargão técnico

### Requirement: /campanhas e [id] regressão mobile

As páginas `/campanhas` e `/campanhas/[id]` SHALL ser verificadas com os novos estados (loading, empty, error) e copy gerada em viewport 320-768px.

#### Scenario: Cards de campanha adaptados em mobile

- **WHEN** a lista de campanhas é renderizada em viewport 320-768px
- **THEN** os cards ocupam largura total ou grid de 1 coluna, sem overflow

#### Scenario: Preview adaptado em mobile

- **WHEN** o preview de campanha é renderizado em viewport 320-768px
- **THEN** a prévia é redimensionada proporcionalmente sem corte

### Requirement: Admin triagem mínima em mobile

As páginas `/admin/*` SHALL ter triagem mínima em mobile: tabelas adaptadas para cards, sem exigir experiência mobile-first.

#### Scenario: Tabela admin adaptada para cards em mobile

- **WHEN** uma tabela admin é renderizada em viewport <= 640px
- **THEN** as linhas da tabela são exibidas como cards empilhados (cabeçalho oculto)

### Requirement: /admin/metrics cards adaptados

A página `/admin/metrics` SHALL ter cards e health banner legíveis em viewport estreito.

#### Scenario: Cards de métricas empilhados em mobile

- **WHEN** `/admin/metrics` é renderizada em viewport 320-768px
- **THEN** os cards de métricas são empilhados verticalmente (grid de 1 coluna)

#### Scenario: Health banner legível em viewport estreito

- **WHEN** o health banner é renderizado em viewport 320-768px
- **THEN** o texto não é cortado e o indicador de status é visível

### Requirement: Modal de crédito utilizável em mobile

O modal de crédito/confirmação SHALL ser utilizável em viewport 320-768px, com botões não sobrepostos e touch targets >= 44px.

#### Scenario: Modal de crédito com botões acessíveis

- **WHEN** o modal de crédito é aberto em viewport 320-768px
- **THEN** os botões não estão sobrepostos e cada um tem touch target >= 44px
