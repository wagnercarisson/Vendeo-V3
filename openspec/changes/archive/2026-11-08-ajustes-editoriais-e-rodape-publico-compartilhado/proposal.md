## Why

As quatro páginas públicas (`/`, `/floriculturas`, `/padarias` e
`/campanhas-para-sua-loja`) mantêm cópias manuais do mesmo rodapé. Os destinos de
conteúdo já existem na home, mas não permitem navegação entre as páginas
demonstrativas, e adicionar uma página futura exige editar quatro arquivos. Ao
mesmo tempo, dois trechos do bloco de rotina de `/campanhas-para-sua-loja`
precisam de ajuste editorial aprovado: o H2 deve concordar com “rotina” e a
abertura do parágrafo deve descrever a rotina real do lojista, preservando a
continuação existente.

## What Changes

- Ajustar em `/campanhas-para-sua-loja` exatamente dois trechos:
  - H2: “Feita para a rotina de quem atende, repõe e ainda divulga.” →
    “Feito para a rotina de quem atende, repõe e ainda divulga.”
  - Início do parágrafo: “Quem toca uma loja pequena acumula funções.” →
    “Quem administra uma loja precisa conciliar atendimento, estoque,
    fornecedores e divulgação.”
  - Preservar a continuação “O Vendeo encurta o caminho entre o produto que está
    na vitrine e a publicação que precisa sair.”
  - Não alterar nenhum outro texto.
- Criar uma fonte central e tipada dos destinos de conteúdo
  (`src/components/landing/public-footer-nav.ts`) com exatamente:
  - Floriculturas → `/floriculturas`
  - Padarias → `/padarias`
  - Campanhas sem complicação → `/campanhas-para-sua-loja`
- Criar um rodapé público compartilhado
  (`src/components/landing/public-footer.tsx`), Server Component, usado pelas
  quatro páginas.
- Agrupar os três destinos sob “Explore o Vendeo” e separar visualmente esse
  grupo dos links institucionais, legais e de acesso.
- Marcar o destino atual com `aria-current="page"` quando houver correspondência
  na lista de conteúdo.
- Preservar os destinos e comportamentos existentes:
  - home: logo, Termos, Privacidade, Uso Aceitável, Novidades, Contato, Entrar e
    aviso legal demonstrativo;
  - páginas internas: logo, “Voltar ao Vendeo”, Termos, Privacidade, Uso
    Aceitável e Entrar.
- Manter renderização HTML rastreável, com `href` real, em Server Component.
- **Fora desta change:** sitemap, robots, canonical, `INDEXABLE_CANONICAL_PATHS`,
  política fail-closed, metadata, header, oferta compartilhada, CTAs de
  aquisição, autenticação, flags, campanhas, créditos, onboarding, APIs, banco,
  migrations, dependências, analytics, conteúdo comercial e refatoração de
  componentes alheios ao rodapé.

## Capabilities

### New Capabilities

- `public-footer-navigation`: contrato do rodapé público compartilhado das quatro
  páginas, fonte central de destinos, grupos, `aria-current`, preservação de
  links e comportamento responsivo.

### Modified Capabilities

- `campanhas-para-sua-loja-demonstration-page`: copy do bloco de rotina e
  composição do rodapé da página; requisito de link na home passa a admitir a
  navegação agrupada.
- `padarias-demonstration-page`: preservação da home passa a admitir o rodapé
  compartilhado, sem alterar o restante da página.
- `seo-discovery-foundation`: conteúdo visível da home passa a admitir o
  reposicionamento dos links no rodapé; nenhum contrato de indexação muda.
- `landing-conversion-experience`: o rodapé legal da landing passa a ser o
  componente compartilhado, preservando links, Novidades e Contato.

## Impact

- **Código:** novo `public-footer.tsx` e `public-footer-nav.ts`; alteração dos
  quatro `page.tsx` para consumir o componente.
- **Specs:** nova `public-footer-navigation`; deltas em
  `campanhas-para-sua-loja-demonstration-page`, `padarias-demonstration-page`,
  `seo-discovery-foundation` e `landing-conversion-experience`.
- **Testes:** novo teste do rodapé; atualização de `home-footer-links`,
  `floriculturas-page`, `padarias-page` e `campanhas-para-sua-loja-page`;
  asserções editoriais dos dois trechos; regressão de sitemap/robots sem mudança
  de contrato.
- **Banco/API/dependências:** nenhum.
- **Operação:** validação local apenas. Publicação e validação em produção são
  gates separados e não fazem parte desta change.
