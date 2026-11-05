# Quick 261105-f59-safe-area-pixels — áreas reservadas em pixels do canvas de geração

## Escopo

Alteração isolada da orientação de áreas reservadas do prompt vertical 9:16.
Nenhuma mudança em identidade/aplicação do ativo, referências, produto,
descrição, aviso, condições comerciais, composição, Copy Director, modelos,
qualidade, pricing, pipeline, flag, banco ou prompt 1:1.

## Alteração autorizada

- Compositor: `f59-vertical-9-16-composer-v7`.
- Formato: `f59-9-16-v5`.
- Safe area técnica: `safe-area-9-16-v1` (geometria e proveniência preservadas).
- O bloco `[ÁREAS RESERVADAS]` passa a usar o canvas de GERAÇÃO `1152×2048` e
  coordenadas em pixels, emitido uma única vez.
- As coordenadas são derivadas de `safeAreaForCanvas(1152, 2048)`, alimentado por
  `PROVIDER_SIZE`; não há cálculo delegado ao modelo.
- Nenhum percentual e nenhuma coordenada de `1080×1920` entram no prompt.
  A redução para entrega continua exclusivamente no pipeline.

## Prompt completo — mesmas entradas da campanha bc10ce42…

Briefing idêntico ao congelado em `bc10ce42-d330-4332-a7e9-9045bd80b72b`:
Bolo Naked Fruit / “Massa de pão de ló” / aviso com duas linhas / Oferta /
Estúdio / produto `9110f31a…` + ativo `21e5e037…`.

```text
Crie uma campanha de oferta, em peça única.

[REFERÊNCIAS]
Imagem 1: produto anunciado. Preserve sua aparência e use-o como protagonista.
Imagem 2: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.

[DADOS DA CAMPANHA]
Loja: "Padaria da Esquina"
Produto: "Bolo Naked Fruit"
Descrição: "Massa de pão de ló"
Preço: "R$ 69,90"
Selo: "Imperdível"
Validade: "enquanto durarem os estoques"
Aviso obrigatório: "Imagem meramente ilustrativa\nRecheio e cobertura de frutas"
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

[ÁREAS RESERVADAS]
Canvas: 1152×2048 pixels, vertical 9:16. A origem das coordenadas é o canto superior esquerdo; x cresce para a direita e y para baixo. Preencha todo o canvas com o fundo.

Mantenha textos, preço, ativo da loja e partes essenciais do produto integralmente dentro do retângulo x=69 a 1083, y=287 a 1331.

Exclua também a região inferior direita x=806 a 1152, y=1229 a 2048.

Fora da área permitida, use apenas fundo e elementos não essenciais. Não desenhe guias, faixas ou marcações das áreas reservadas.
```

- 1.798 caracteres, 34 linhas.
- SHA-256: `e8b68dee580ef332d008bcc949592addd85b945f8411905d85d25aeccf606133`.

## Derivação dos pixels

Para `1152 × 2048`:

- laterais 6% → 69 px; `xMin=69`, `xMax=1083`;
- topo 14% → 287 px; base 35% → 717 px; `yMin=287`, `yMax=1331`;
- canto inferior direito 30% × 40% → 346 × 819 px; `xMin=806`, `yMin=1229`.

A proveniência da política (`pending`/`conservative`) permanece inalterada; os
limites não são apresentados como garantia oficial do Instagram.

## Verificação

| Gate | Resultado |
|---|---|
| Verticais | **18 arquivos / 219 testes passando** |
| 1:1 | **49 arquivos / 943 testes passando** |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

Testes:

- valores emitidos `69/1083/287/1331/806/1229/1152/2048`;
- ausência de percentuais no bloco reservado;
- ausência de `1080×1920` e `0,9375` no prompt;
- ocorrência única do bloco e do canvas;
- demais blocos byte-idênticos para as mesmas entradas;
- prompt 1:1 byte-idêntico ao baseline.

## Limitações

- Nenhuma geração paga executada nesta alteração.
- A submissão manual e a avaliação visual ficam com o responsável.
- O overlay de análise em 1080×1920 é feito fora da arte original.
