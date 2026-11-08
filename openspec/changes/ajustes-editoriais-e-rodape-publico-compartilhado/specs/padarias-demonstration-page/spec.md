## MODIFIED Requirements

### Requirement: Preservação das páginas e superfícies existentes

A inclusão de `/padarias` SHALL NOT alterar `/floriculturas`, a política de
oferta, créditos, elegibilidade, onboarding, autenticação, APIs, banco, migrations,
flags ou configuração externa.

A home SHALL preservar H1, copy, blocos, imagens, CTAs, ordem e metadata. O
rodapé da home SHALL poder ser renderizado pelo componente público compartilhado,
com os links “Floriculturas”, “Padarias” e “Campanhas sem complicação” agrupados
sob “Explore o Vendeo”. Essa composição SHALL NOT alterar o conteúdo visível da
home além do rodapé nem os contratos de indexação. O `middleware.ts` SHALL NOT ser
alterado para esta rota.

#### Scenario: `/floriculturas` preservada

- **WHEN** a implementação é revisada
- **THEN** a página, os componentes, os assets, os CTAs, o card e a metadata de
  `/floriculturas` SHALL permanecer inalterados, exceto pelo rodapé compartilhado
  previsto nesta change

#### Scenario: Home preservada exceto pelo rodapé compartilhado

- **WHEN** a home é comparada ao estado anterior
- **THEN** H1, copy, blocos, imagens, CTAs, ordem e metadata SHALL permanecer
  inalterados
- **AND** o link “Padarias” SHALL permanecer apontando para `/padarias`
- **AND** a única área visível alterada SHALL ser o rodapé, com os destinos de
  conteúdo agrupados sob “Explore o Vendeo”
- **AND** Termos, Privacidade, Uso Aceitável, Novidades, Contato, Entrar e o aviso
  legal demonstrativo SHALL permanecer disponíveis

#### Scenario: Rotas privadas permanecem noindex

- **WHEN** a política de indexação é revisada após a mudança
- **THEN** `/login`, `/signup`, `/dashboard`, `/campanhas`, `/conta`, `/admin`,
  `/termos`, `/privacidade`, `/uso-aceitavel`, `/auth/**`, `/api/**` e `/docs/**`
  SHALL continuar `noindex`
- **AND** nenhuma delas SHALL entrar no sitemap
