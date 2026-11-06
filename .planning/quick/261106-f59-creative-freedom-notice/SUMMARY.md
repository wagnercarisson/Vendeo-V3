# Quick 261106-f59-creative-freedom-notice — liberdade criativa e aviso opcional

## Escopo

Somente duas orientações no prompt vertical. Nenhuma mudança em pipeline,
dimensões, composição em canvas menor, identidade/aplicação do ativo, paleta,
fundo, dados, referências, Copy Director, modelos, qualidade, pricing, flag,
banco ou prompt 1:1.

## Alterações autorizadas

- Compositor: `f59-vertical-9-16-composer-v12`.
- Formato: `f59-9-16-v10`.
- Política experimental: `safe-area-9-16-experimental-v2` (inalterada).
- Liberdade criativa: uma única linha no bloco `[COMPOSIÇÃO]`.
- Aviso opcional: uma única instrução, emitida somente quando
  `mandatoryArtworkText` contém exatamente “Imagem meramente ilustrativa”.
- A instrução não se estende aos demais textos obrigatórios e não é emitida
  quando a frase não foi informada.

## Diff de orientação

```diff
 [COMPOSIÇÃO]
 Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.
+Exerça liberdade criativa na composição: explore enquadramento, iluminação, profundidade e hierarquia visual para criar uma campanha expressiva e comercialmente atraente, respeitando as informações fornecidas, o ativo da loja e as áreas protegidas.
 Destaque o preço de venda.
 ...
 Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.
+O aviso ‘Imagem meramente ilustrativa’ pode ser aplicado horizontalmente ou rotacionado em 90°, conforme favorecer a composição. Preserve a frase integral, legível, com contraste adequado e dentro da área protegida. Não empilhe as letras.
 Use português correto e natural, sem caracteres ou pontuação duplicados, e não corrija silenciosamente os textos de entrada.
```

## Prompt completo — entradas da campanha 590ea2db…

Origem: campanha `590ea2db-7483-48eb-983f-7d69dc0dd86a` / operação
`84b84c9a-e342-4329-9375-b433397bf514` (v11). Briefing: Bolo Naked Fruit /
descrição multilinha / aviso “Imagem meramente ilustrativa” / Oferta / Estúdio /
produto `9110f31a…` + ativo `21e5e037…`.

```text
Crie uma campanha de oferta, em peça única.

[REFERÊNCIAS]
Imagem 1: produto anunciado. Preserve sua aparência e use-o como protagonista.
Imagem 2: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.

[DADOS DA CAMPANHA]
Loja: "Padaria da Esquina"
Produto: "Bolo Naked Fruit"
Descrição: "Massa de pão de ló\nRecheio e cobertura de frutas"
Preço: "R$ 69,90"
Selo: "Imperdível"
Validade: "enquanto durarem os estoques"
Aviso obrigatório: "Imagem meramente ilustrativa"
Paleta: principal #3B2418; apoio #D59D5E.

[COMPOSIÇÃO]
Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.
Exerça liberdade criativa na composição: explore enquadramento, iluminação, profundidade e hierarquia visual para criar uma campanha expressiva e comercialmente atraente, respeitando as informações fornecidas, o ativo da loja e as áreas protegidas.
Destaque o preço de venda.
Não invente informações comerciais.
Use fundo de estúdio liso ou gradiente suave na paleta da loja, com bom contraste e sem objetos de apoio.
Antes de alterar as cores do ativo, ajuste posicionamento e fundo para obter contraste.
A descrição é opcional e pode ser adaptada ou omitida, preservando seu significado.
Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.
O aviso ‘Imagem meramente ilustrativa’ pode ser aplicado horizontalmente ou rotacionado em 90°, conforme favorecer a composição. Preserve a frase integral, legível, com contraste adequado e dentro da área protegida. Não empilhe as letras.
Use português correto e natural, sem caracteres ou pontuação duplicados, e não corrija silenciosamente os textos de entrada.

[COMPOSIÇÃO PARA INSTAGRAM]
Os 20% inferiores são exclusivos para fundo, produto e seus complementos visuais. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer integralmente acima dela. Os textos obrigatórios devem integrar a composição acima dessa faixa, não funcionar como rodapé da imagem.

Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.

Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.

Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.
```

- 2.743 caracteres, 36 linhas.
- SHA-256: `6fcf6e4da4cb6267c6225a814e13c2adbec47757f9d9358ce087e9f003128b3e`.

## Verificação

| Gate | Resultado |
|---|---|
| Verticais | **19 arquivos / 232 testes passando** |
| 1:1 | **49 arquivos / 943 testes passando** |
| IA | **39 arquivos + 1 skipped / 389 testes + 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

Testes: liberdade criativa uma vez; aviso presente uma vez; ausente quando a
frase não existe; com outros textos obrigatórios, só o aviso recebe a permissão;
demais blocos não alterados; 1:1 byte-idêntico.

## Limitações

- Nenhuma geração paga executada.
- A submissão e a avaliação visual ficam com o responsável.
- O aviso permanecer horizontal não é falha: a rotação é opcional.
