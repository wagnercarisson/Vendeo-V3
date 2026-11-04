## 0. Revisão e aprovação

- [x] 0.1 Confirmar D1 (arquivo-fonte em evidência), D2 (aviso ao fim do bloco), D3 (480w/1024w) e D4 (alt sem valor).
- [x] 0.2 Aprovar a composição desktop/mobile e os três textos exatos.
- [x] 0.3 Confirmar que a implementação permanece na quick, sem nova fase.

## 1. Assets

- [x] 1.1 Copiar o JPEG-fonte para `evidence/source/` e registrar 1024×1024, 242.089 B e SHA-256.
- [x] 1.2 Gerar `campanha-kalandiva-donna-flor-480w.webp` e `campanha-kalandiva-donna-flor-1024w.webp` com `sharp`, sem crop e sem upscale.
- [x] 1.3 Registrar dimensões e pesos finais e conferir que nenhuma variante excede 242.089 B.

## 2. Contrato e componente

- [x] 2.1 Acrescentar `KALANDIVA_IMAGE` e `KALANDIVA_IMAGE_SIZES` em `image-sources.ts`.
- [x] 2.2 Criar `offer-example.tsx` com `h3`, parágrafo único e `<img>` responsivo, `loading="lazy"`, dimensões explícitas e alt aprovado.
- [x] 2.3 Não criar galeria, carrossel, modal, controles ou IDs novos.

## 3. Página

- [x] 3.1 Substituir o parágrafo do bloco “Crie posts para sua floricultura sem começar do zero.” pela lista aprovada de três itens.
- [x] 3.2 Inserir o exemplo complementar no mesmo bloco, após a lista, com subtítulo e parágrafo único.
- [x] 3.3 Mover o aviso demonstrativo único para o fim do bloco enriquecido, removendo-o do par da orquídea sem alterar mais nada nele.
- [x] 3.4 Substituir apenas o apoio do encerramento por “Suas flores, sua marca, uma campanha pronta para divulgar.”.
- [x] 3.5 Preservar título do bloco, título do encerramento, card único, âncora e CTAs.

## 4. Testes

- [x] 4.1 Atualizar `floriculturas-page.test.ts` para a copy nova e a ausência da antiga.
- [x] 4.2 Cobrir o exemplo único, o aviso único e a ausência de `R$` em HTML.
- [x] 4.3 Cobrir `srcset` de dois candidatos, `sizes`, dimensões explícitas e `loading="lazy"` do novo exemplo.
- [x] 4.4 Acrescentar o terceiro caso em `image-sources.test.ts` (existência, formato, dimensão, proporção, peso e ordem).
- [x] 4.5 Manter os testes de card único, âncora, `/#acesso`, `/signup`, “Conheça o Vendeo” e metadata.

## 5. Gates e aceite

- [x] 5.1 Executar testes focados, suíte local, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` e `npx openspec validate enriquecer-exemplos-floriculturas --strict`.
- [x] 5.2 Registrar as limitações de lint e de layout em jsdom.
- [x] 5.3 Capturar `/floriculturas` em 1440×900 e 390×844 com a imagem carregada; medir largura real, overflow e legibilidade.
- [x] 5.4 Reconciliar o `sizes` com a medição.
- [x] 5.5 Registrar evidências em `.planning/quick/261104-kal-.../evidence/` e obter aceite visual explícito.
- [x] 5.6 Não commitar, sincronizar, arquivar, mesclar, publicar ou fazer deploy sem autorização.
