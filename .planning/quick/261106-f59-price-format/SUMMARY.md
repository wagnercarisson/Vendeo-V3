# Quick 261106-f59-price-format — regra monetária única

## Escopo

Uma única regra de formatação monetária no bloco de composição. Nenhuma mudança
em áreas protegidas, liberdade criativa, ativo, paleta, fundos, referências,
dados, Copy Director, modelos, qualidade, pricing, pipeline, flag, banco ou 1:1.

## Alteração autorizada

- Compositor: `f59-vertical-9-16-composer-v14`.
- Formato: `f59-9-16-v12`.
- Safe area: `safe-area-9-16-experimental-v3` (inalterada).
- Nova linha, uma única vez, em `[COMPOSIÇÃO]`:

```text
Trate cada preço como uma única expressão monetária. Use exatamente uma vírgula entre a parte inteira e os centavos, quando houver centavos, mesmo quando tiverem tamanhos ou alinhamentos diferentes. Não repita a vírgula ao separar visualmente os centavos.
```

A regra vale para preço original e preço de venda; não reformata os dados e não
adiciona centavos a valores sem centavos.

## Diff

```diff
 [COMPOSIÇÃO]
 ...
 Destaque o preço de venda.
 Não invente informações comerciais.
+Trate cada preço como uma única expressão monetária. Use exatamente uma vírgula entre a parte inteira e os centavos, quando houver centavos, mesmo quando tiverem tamanhos ou alinhamentos diferentes. Não repita a vírgula ao separar visualmente os centavos.
 Use fundo de estúdio liso ou gradiente suave na paleta da loja, com bom contraste e sem objetos de apoio.
 ...
```

## Prompt completo — próximo caso da matriz

Pão Caseiro (kg) / Padaria da Esquina / Destaque / **Original** / R$ 16,99 /
Mais Vendido / aviso “Imagem meramente ilustrativa”. Produto
`cc990d04…` + ativo `21e5e037…`.

```text
Crie uma campanha de destaque, em peça única.

[REFERÊNCIAS]
Imagem 1: produto anunciado. Preserve sua aparência e use-o como protagonista.
Imagem 2: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.

[DADOS DA CAMPANHA]
Loja: "Padaria da Esquina"
Produto: "Pão Caseiro (kg)"
Preço: "R$ 16,99"
Selo: "Mais Vendido"
Aviso obrigatório: "Imagem meramente ilustrativa"
Paleta: principal #3B2418; apoio #D59D5E.

[COMPOSIÇÃO]
Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.
Exerça liberdade criativa na composição: explore enquadramento, iluminação, profundidade e hierarquia visual para criar uma campanha expressiva e comercialmente atraente, respeitando as informações fornecidas, o ativo da loja e as áreas protegidas.
Priorize a apresentação do produto; o preço informado é secundário.
Não invente informações comerciais.
Trate cada preço como uma única expressão monetária. Use exatamente uma vírgula entre a parte inteira e os centavos, quando houver centavos, mesmo quando tiverem tamanhos ou alinhamentos diferentes. Não repita a vírgula ao separar visualmente os centavos.
Mantenha o cenário da imagem enviada como base; não substitua o ambiente por outro.
Não altere o produto nem o cenário para resolver contraste; ajuste posição, escala ou a aplicação do ativo.
Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.
O aviso ‘Imagem meramente ilustrativa’ pode ser aplicado horizontalmente ou rotacionado em 90°, conforme favorecer a composição. Preserve a frase integral, legível, com contraste adequado e dentro da área protegida. Não empilhe as letras.
Use português correto e natural, sem caracteres ou pontuação duplicados, e não corrija silenciosamente os textos de entrada.

[COMPOSIÇÃO PARA INSTAGRAM]
Os 5% superiores e os 20% inferiores são exclusivos para fundo. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer fora dessas áreas. Textos obrigatórios não devem funcionar como rodapé da imagem.

Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.

Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.

Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.
```

- 2.785 caracteres, 34 linhas.
- SHA-256: `d54f7a74aed5828c2aa196cc64b868564099128f74e5ceaf670970a97cb7d892`.

## Verificação

| Gate | Resultado |
|---|---|
| Verticais | **19 arquivos / 238 testes passando** |
| 1:1 | **49 arquivos / 943 testes passando** |
| IA | **39 arquivos + 1 skipped / 389 testes + 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

Testes: regra uma vez; venda isolada; original + venda; valor sem centavos;
separador de milhar; dados monetários não reformatados; demais blocos
inalterados; 1:1 byte-idêntico.

## Limitações

- Nenhuma geração paga executada.
- A correção encerra o congelamento v13 para o próximo teste; o v14 é derivado
  com diferença restrita à regra monetária.
- O prompt bruto do provider continua não persistido.
