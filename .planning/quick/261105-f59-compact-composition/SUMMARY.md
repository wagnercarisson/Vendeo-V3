# Quick 261105-f59-compact-composition — orientação visual compacta

## Escopo

Alteração isolada do bloco de áreas reservadas do prompt vertical 9:16:
percentuais/pixels → orientação visual compacta. Nenhuma mudança em identidade,
aplicação do ativo, cores, paleta, fundo, composição, dados, descrição/aviso,
referências, Copy Director, modelos, qualidade, pricing, pipeline, flag, banco
ou prompt 1:1.

## Alteração autorizada

- Compositor: `f59-vertical-9-16-composer-v8`.
- Formato: `f59-9-16-v6`.
- Safe area técnica: `safe-area-9-16-v1` (geometria/proveniência intactas).
- O bloco `[ÁREAS RESERVADAS]` foi substituído por `[ÁREA DE COMPOSIÇÃO]`, com
  o texto visual compacto solicitado, emitido uma única vez.
- Cálculos de geração (1152×2048) e entrega (1080×1920) permanecem no módulo de
  safe area para validação/overlay; não aparecem no prompt.

## Prompt completo — mesmas entradas da campanha eb317eb8…

Briefing congelado: Bolo Naked Fruit / descrição multilinha / aviso “Imagem
meramente ilustrativa” / Oferta / Estúdio / produto `9110f31a…` + ativo
`21e5e037…`.

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

[ÁREA DE COMPOSIÇÃO]
Crie uma composição publicitária compacta na região central superior da imagem. Concentre nela o ativo da loja, textos, preço, selo e partes essenciais do produto.

Reserve os 14% superiores, os 35% inferiores e 6% de cada lateral exclusivamente para a continuação do fundo. Mantenha também os últimos 30% da largura e 40% da altura, no canto inferior direito, livres de elementos importantes.

Organize a campanha para caber nessa área, sem cortar informações. Complete o restante do quadro com o fundo, sem desenhar guias ou faixas.
```

- 1.832 caracteres, 32 linhas.
- SHA-256: `7bde0569c14a0bf60f7b425f240746bb0e8808395543fa693e8d0658d5fa8b9b`.

## Verificação

| Gate | Resultado |
|---|---|
| Verticais | **18 arquivos / 220 testes passando** |
| 1:1 | **49 arquivos / 943 testes passando** |
| IA | **39 arquivos + 1 skipped / 389 testes + 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

Testes: ocorrência única do bloco; ausência de coordenadas/pixels/canvas no
prompt; percentuais do bloco presentes uma vez; demais blocos byte-idênticos;
cálculos de safe area preservados fora do prompt; 1:1 byte-idêntico.

## Limitações

- Nenhuma geração paga executada.
- A avaliação visual e a submissão ficam com o responsável.
- Overlay de análise em 1080×1920 feito fora da arte original.
