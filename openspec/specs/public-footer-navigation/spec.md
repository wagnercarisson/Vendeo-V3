# public-footer-navigation Specification

## Purpose
Define o rodapé público compartilhado das páginas `/`, `/floriculturas`,
`/padarias` e `/campanhas-para-sua-loja`: fonte central dos destinos de conteúdo,
grupos “Explore o Vendeo” e “Institucional”, identificação do destino atual com
`aria-current`, preservação dos links e comportamentos existentes e separação
explícita entre navegação e regras de sitemap/indexação.
## Requirements
### Requirement: Rodapé público compartilhado nas quatro páginas

O sistema SHALL renderizar o rodapé das páginas públicas `/`,
`/floriculturas`, `/padarias` e `/campanhas-para-sua-loja` por um único
componente compartilhado, em Server Component, preferencialmente em
`src/components/landing/public-footer.tsx`.

O componente SHALL preservar a identidade visual existente: logo Vendeo, fontes,
cores, borda superior, espaçamento, alturas de toque de no mínimo 44 px e foco
visível. O componente SHALL NOT alterar header, oferta, CTAs de aquisição,
autenticação ou conteúdo principal das páginas.

#### Scenario: Quatro páginas usam o mesmo componente

- **WHEN** as quatro páginas públicas são renderizadas
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
- `Campanhas sem complicação` → `/campanhas-para-sua-loja`

Adicionar um destino futuro SHALL exigir alteração somente dessa lista e dos
testes correspondentes. A lista SHALL NOT controlar automaticamente sitemap,
robots, canonical, metadata ou qualquer política de indexação.

#### Scenario: Lista contém exatamente os três destinos aprovados

- **WHEN** a lista de navegação é inspecionada
- **THEN** ela SHALL conter exatamente os três pares rótulo/destino aprovados
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

- **WHEN** `/floriculturas`, `/padarias` ou `/campanhas-para-sua-loja` é
  renderizada
- **THEN** o link correspondente em “Explore o Vendeo” SHALL receber
  `aria-current="page"`
- **AND** os demais links de conteúdo SHALL NOT receber `aria-current`

#### Scenario: Home sem item artificial

- **WHEN** `/` é renderizada
- **THEN** “Explore o Vendeo” SHALL exibir os três destinos aprovados
- **AND** nenhum deles SHALL receber `aria-current="page"`
- **AND** nenhum item “Início” SHALL ser adicionado sem aprovação

### Requirement: Preservação dos links e comportamentos existentes

O rodapé compartilhado SHALL preservar os destinos e comportamentos existentes:

- home: contato (`mailto:` com o mesmo fallback), acesso (`/login`), termos
  (`/termos`), privacidade (`/privacidade`), uso aceitável (`/uso-aceitavel`),
  Novidades e aviso legal demonstrativo;
- páginas internas: retorno à home (`/`), termos, privacidade, uso aceitável e
  acesso (`/login`).

As diferenças entre os contextos SHALL ser explícitas e mínimas, sem condicionais
espalhadas pelas páginas.

#### Scenario: Home preserva contato, novidades e aviso legal

- **WHEN** o rodapé da home é renderizado
- **THEN** SHALL existir “Contato”, “Novidades”, “Entrar” e o aviso legal
  demonstrativo com o texto atual
- **AND** SHALL NOT existir “Voltar ao Vendeo”

#### Scenario: Páginas internas preservam retorno e acesso

- **WHEN** o rodapé de uma página interna é renderizado
- **THEN** SHALL existir “Voltar ao Vendeo” apontando para `/`
- **AND** SHALL existir “Termos de Uso”, “Política de Privacidade”,
  “Uso Aceitável” e “Entrar”
- **AND** SHALL NOT existir “Contato”, “Novidades” ou o aviso legal da home

### Requirement: Responsividade e acessibilidade do rodapé

No desktop, o rodapé SHALL organizar logo e grupos de navegação sem compressão.
No mobile, os grupos SHALL se empilhar com quebra natural de linha, espaçamento
confortável e sem overflow horizontal. Os links SHALL manter alvo de toque de no
mínimo 44 px, foco visível e contraste conforme o restante da interface.

#### Scenario: Mobile sem overflow

- **WHEN** o rodapé é exibido em viewport mobile
- **THEN** os links SHALL quebrar naturalmente
- **AND** SHALL NOT haver overflow horizontal
- **AND** todos os links SHALL permanecer focáveis por teclado
