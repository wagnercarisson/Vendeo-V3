## MODIFIED Requirements

### Requirement: Rodapé público compartilhado nas quatro páginas

O sistema SHALL renderizar o rodapé das páginas públicas `/`,
`/floriculturas`, `/padarias`, `/ofertas-para-mercados` e
`/campanhas-para-sua-loja` por um único componente compartilhado, em Server
Component, preferencialmente em `src/components/landing/public-footer.tsx`.

O componente SHALL preservar a identidade visual existente: logo Vendeo, fontes,
cores, borda superior, espaçamento, alturas de toque de no mínimo 44 px e foco
visível. O componente SHALL NOT alterar header, oferta, CTAs de aquisição,
autenticação ou conteúdo principal das páginas.

#### Scenario: Cinco páginas usam o mesmo componente

- **WHEN** as cinco páginas públicas são renderizadas
- **THEN** cada uma SHALL exibir exatamente um `footer`
- **AND** o rodapé SHALL ser produzido pelo componente compartilhado
- **AND** a página SHALL fornecer apenas o caminho atual e o contexto necessário

#### Scenario: Server Component com links rastreáveis

- **WHEN** o HTML do rodapé é inspecionado
- **THEN** os links SHALL ser elementos HTML `a` com `href` real
- **AND** o rodapé SHALL NOT depender de JavaScript para renderizar a navegação

### Requirement: Fonte central dos destinos de conteúdo

O sistema SHALL centralizar os destinos e rótulos da navegação de conteúdo em uma
única lista tipada, preferencialmente
`src/components/landing/public-footer-nav.ts`, contendo exatamente:

- `Floriculturas` → `/floriculturas`
- `Padarias` → `/padarias`
- `Mercados e mercearias` → `/ofertas-para-mercados`
- `Campanhas sem complicação` → `/campanhas-para-sua-loja`

Adicionar um destino futuro SHALL exigir alteração somente dessa lista e dos
testes correspondentes. A lista SHALL NOT controlar automaticamente sitemap,
robots, canonical, metadata ou qualquer política de indexação.

#### Scenario: Lista contém exatamente os quatro destinos aprovados

- **WHEN** a lista de navegação é inspecionada
- **THEN** ela SHALL conter exatamente os quatro pares rótulo/destino aprovados,
  nesta ordem
- **AND** nenhuma rota privada ou não aprovada SHALL estar presente

#### Scenario: Navegação não controla indexação

- **WHEN** a implementação é revisada
- **THEN** a lista de navegação SHALL NOT ser importada por `src/app/sitemap.ts`,
  pela política de indexação, por metadata ou por `robots`
- **AND** os contratos de sitemap, robots, canonical e fail-closed SHALL
  permanecer inalterados

### Requirement: Grupos visualmente separados e destino atual

O rodapé SHALL agrupar os destinos de conteúdo sob o título “Explore o Vendeo” e
SHALL separar visualmente esse grupo dos links institucionais, legais e de
acesso, com um segundo grupo rotulado.

O rodapé SHALL identificar o destino atual com `aria-current="page"` quando o
`href` corresponder ao caminho atual. Na home, por não haver item de conteúdo
apontando para `/`, nenhum item de “Explore o Vendeo” SHALL receber
`aria-current`.

#### Scenario: Destino atual identificado

- **WHEN** `/floriculturas`, `/padarias`, `/ofertas-para-mercados` ou
  `/campanhas-para-sua-loja` é renderizada
- **THEN** o link correspondente em “Explore o Vendeo” SHALL receber
  `aria-current="page"`
- **AND** os demais links de conteúdo SHALL NOT receber `aria-current`

#### Scenario: Home sem item artificial

- **WHEN** `/` é renderizada
- **THEN** “Explore o Vendeo” SHALL exibir os quatro destinos aprovados
- **AND** nenhum deles SHALL receber `aria-current="page"`
- **AND** nenhum item “Início” SHALL ser adicionado sem aprovação
