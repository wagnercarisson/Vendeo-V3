# Quick 261106-f59-instagram-bands — composição para Instagram

## Escopo

Alteração isolada da política de posicionamento vertical. Nenhuma mudança em
identidade/aplicação do ativo, paleta, fundo, composição, dados, descrição/aviso,
referências, Copy Director, modelos, qualidade, pricing, pipeline, flag, banco
ou prompt 1:1.

## Alteração autorizada

- Compositor: `f59-vertical-9-16-composer-v9`.
- Formato: `f59-9-16-v7`.
- Política experimental: `safe-area-9-16-experimental-v1`.
- O bloco `[ÁREA DE COMPOSIÇÃO]` (e qualquer orientação anterior de áreas) foi
  substituído por `[COMPOSIÇÃO PARA INSTAGRAM]`, emitido uma única vez.
- A política experimental usa somente 15% superiores e 20% inferiores. Não há
  máscara lateral nem recorte específico no canto inferior direito.
- O produto, a embalagem e os complementos podem avançar nas faixas, desde que
  reconhecíveis; as faixas restringem informações protegidas, não o contorno do
  produto.
- `safe-area-9-16-v1` permanece intacta e histórica. Os cálculos de geração
  (`1152×2048`) e entrega (`1080×1920`) ficam em `safe-area-experimental.ts`
  para validação/overlay e não aparecem no prompt.

## Prompt completo — entradas da campanha 7d0035ad…

Origem: campanha `7d0035ad-0f6f-4861-8f7f-4bdf8d21222f` / operação
`57957d65-b06e-496e-8622-3cca7bf69d0c` (v8). Briefing: Bolo Naked Fruit /
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
Mantenha os textos, preço, oferta, CTA quando houver, condições comerciais e ativo da loja fora dos 15% superiores e dos 20% inferiores da imagem.

Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.

Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.

Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.
```

- 2.016 caracteres, 34 linhas.
- SHA-256: `981309260bb6787f0add60183bc3cd8d673aa0e5623d6e25d7d8a44e717d3052`.

## Cálculos mantidos no código

- Geração `1152×2048`: topo 307 px; base 410 px; região entre y=307 e y=1638.
- Entrega `1080×1920`: topo 288 px; base 384 px; região entre y=288 e y=1536.
- Sem laterais e sem recorte de canto na nova política.
- A política é experimental do Vendeo, baseada em observação manual, não em
  garantia oficial do Instagram.

## Verificação

| Gate | Resultado |
|---|---|
| Verticais | **19 arquivos / 225 testes passando** |
| 1:1 | **49 arquivos / 943 testes passando** |
| IA | **39 arquivos + 1 skipped / 389 testes + 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

Testes: ocorrência única do bloco; ausência de 14/35/6/30/40, pixels e canvas;
presença única de 15% e 20%; demais blocos byte-idênticos; faixas experimentais
calculadas para geração/entrega; prompt 1:1 byte-idêntico.

## Limitações

- Nenhuma geração paga executada.
- A submissão e a avaliação visual ficam com o responsável.
- Overlay apenas nas faixas superior/inferior, em cópia de análise.
