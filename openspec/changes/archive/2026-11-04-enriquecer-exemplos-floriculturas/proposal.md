## Why

A página `/floriculturas` já demonstra a transformação de uma foto de orquídea
em campanha. Falta mostrar, no bloco “Crie posts para sua floricultura sem
começar do zero.”, o caso mais comercial do produto: uma oferta com produto,
preço e condição de estoque. A campanha aprovada da Flor Kalandiva (Donna Flor)
preenche essa lacuna sem exigir nova geração, novo fluxo ou novo bloco de página.

Ao mesmo tempo, o apoio do encerramento ainda descreve “comece com uma foto e as
informações”, enquanto o restante da comunicação já fala em campanha pronta. A
troca pontual alinha o fechamento ao que a página demonstra.

## What Changes

- Substituir o parágrafo introdutório do bloco “Crie posts para sua floricultura sem
  começar do zero.” por uma lista de três itens com marcadores simples: buquês e
  arranjos, flores disponíveis na semana e opções para presentear.
- Acrescentar **um único** exemplo complementar dentro desse bloco: título
  “Uma oferta da sua floricultura, pronta para divulgar.”, um único parágrafo de
  acompanhamento e a campanha aprovada da Flor Kalandiva.
- Compor texto à esquerda e campanha à direita no desktop, com o bloco textual
  centralizado verticalmente e linhas alinhadas à esquerda; no mobile, texto
  seguido da imagem. Sem galeria, carrossel, modal ou novo antes/depois.
- Entregar a campanha em duas variantes WebP responsivas (480w e 1024w), com
  `srcset`, `sizes`, dimensões explícitas e `loading="lazy"`, preservando
  integralmente preço, marca e condição de estoque.
- Manter o aviso demonstrativo **único**, reposicionado ao fim do bloco
  enriquecido para cobrir os dois exemplos.
- Substituir apenas o apoio do encerramento por “Suas flores, sua marca, uma
  campanha pronta para divulgar.”, mantendo título, card, CTAs e âncora.
- Atualizar a spec `floriculturas-demonstration-page` nos cinco requirements
  diretamente afetados.

**Fora desta change:** home e demais páginas, oferta, acesso, CTAs, card, flag,
metadata, canonical, sitemap, fontes, header/footer, dependências, backend,
autenticação, créditos, localização, geração de imagem, nova fase, commit, push
ou deploy.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `floriculturas-demonstration-page`: a página passa a exibir dois exemplos
  demonstrativos estáticos no bloco de criação de posts, com copy aprovada,
  terceira imagem responsiva e lazy, aviso único cobrindo o conjunto e apoio do
  encerramento atualizado. CTAs, card, metadata e indexação permanecem iguais.

## Impact

- Código: `src/app/(marketing)/floriculturas/page.tsx`,
  `src/components/landing/floriculturas/image-sources.ts` e novo
  `src/components/landing/floriculturas/offer-example.tsx`.
- Assets: duas variantes WebP novas em `public/floriculturas/`; o JPEG-fonte não
  vai para `public/`.
- Testes: `src/__tests__/app/floriculturas-page.test.ts` e
  `src/components/landing/floriculturas/__tests__/image-sources.test.ts`.
- Spec: `openspec/specs/floriculturas-demonstration-page/spec.md` (via delta).
- Sem banco, migration, API, env, dependência, autenticação, crédito ou provider.
