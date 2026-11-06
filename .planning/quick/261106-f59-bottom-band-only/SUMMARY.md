# Quick 261106-f59-bottom-band-only — faixa inferior de 20%

## Escopo

Alteração isolada da política de posicionamento vertical. Nenhuma mudança em
identidade/aplicação do ativo, paleta, fundo, composição, dados, descrição/aviso,
referências, Copy Director, modelos, qualidade, pricing, pipeline, flag, banco
ou prompt 1:1.

## Alteração autorizada

- Compositor: `f59-vertical-9-16-composer-v10`.
- Formato: `f59-9-16-v8`.
- Política experimental: `safe-area-9-16-experimental-v2`.
- Substituída apenas a primeira orientação do bloco
  `[COMPOSIÇÃO PARA INSTAGRAM]`. A faixa superior de 15% deixa de existir como
  restrição; permanece somente a faixa inferior de 20%.
- `safe-area-9-16-experimental-v1` (15% + 20%) permanece histórica.
- Cálculos no código: geração `1152×2048` → faixa inferior 410 px, protegida até
  `y=1638`; entrega `1080×1920` → faixa inferior 384 px, protegida até `y=1536`.
  Sem faixa superior, máscara lateral ou recorte de canto no prompt.

## Diff autorizado

```diff
 [COMPOSIÇÃO PARA INSTAGRAM]
-Mantenha os textos, preço, oferta, CTA quando houver, condições comerciais e ativo da loja fora dos 15% superiores e dos 20% inferiores da imagem.
+Os 20% inferiores da imagem são exclusivos para fundo, produto e seus complementos visuais. É PROIBIDO colocar nessa faixa qualquer texto, preço, selo, CTA ou ativo da loja, inclusive avisos obrigatórios e validade. Posicione esses elementos integralmente acima da faixa inferior, sem encostar no limite.
```

## Prompt completo — entradas da campanha d6ae75d9…

Origem: campanha `d6ae75d9-d3b1-42c6-bf90-dca3591d2564` / operação
`7b7a4afa-f80b-457e-8a31-1c73380052c2` (v9). Briefing: Bolo Naked Fruit /
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
Destaque o preço de venda.
Não invente informações comerciais.
Use fundo de estúdio liso ou gradiente suave na paleta da loja, com bom contraste e sem objetos de apoio.
Antes de alterar as cores do ativo, ajuste posicionamento e fundo para obter contraste.
A descrição é opcional e pode ser adaptada ou omitida, preservando seu significado.
Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.
Use português correto e natural, sem caracteres ou pontuação duplicados, e não corrija silenciosamente os textos de entrada.

[COMPOSIÇÃO PARA INSTAGRAM]
Os 20% inferiores da imagem são exclusivos para fundo, produto e seus complementos visuais. É PROIBIDO colocar nessa faixa qualquer texto, preço, selo, CTA ou ativo da loja, inclusive avisos obrigatórios e validade. Posicione esses elementos integralmente acima da faixa inferior, sem encostar no limite.

Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.

Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.

Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.
```

- 2.174 caracteres, 34 linhas.
- SHA-256: `a209fd0573d1f6fbe17b1ed0892a96c6ed012b2247876b44269174392dea0b4e`.

## Verificação

| Gate | Resultado |
|---|---|
| Verticais | **19 arquivos / 230 testes passando** |
| 1:1 | **49 arquivos / 943 testes passando** |
| IA | **39 arquivos + 1 skipped / 389 testes + 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

Testes: ocorrência única do bloco; ausência de 15% e da geometria antiga;
presença única de 20%; ausência de pixels/canvas; demais blocos byte-idênticos;
faixa inferior calculada para geração/entrega; prompt 1:1 byte-idêntico.

## Limitações

- Nenhuma geração paga executada.
- A submissão e a avaliação visual ficam com o responsável.
- Overlay apenas na faixa inferior, em cópia de análise.
