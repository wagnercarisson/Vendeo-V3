# Quick 261105-f59-safe-area-wording — bloco único de saída/área protegida

## Escopo

Alteração isolada da orientação de formato/área segura do prompt vertical 9:16.
Nenhuma mudança em identidade, permissões do ativo, referências, produto,
descrição, condições comerciais, Copy Director, modelos, pricing, dimensões,
pipeline, prompt 1:1, campanhas, banco, migrations ou flag.

## Alteração autorizada

- Versões: compositor `f59-vertical-9-16-composer-v6`; formato `f59-9-16-v4`;
  safe area técnica permanece `safe-area-9-16-v1`.
- O objetivo deixa de repetir “imagem estática vertical 9:16” e mantém apenas
  “em peça única”.
- O bloco `[ÁREAS RESERVADAS]` passa a conter, uma única vez, exatamente:

```text
Saída: arte estática para Instagram, vertical 9:16, com fundo preenchendo todo o quadro.

Área protegida: mantenha textos, preço, ativo da loja e partes essenciais do produto entre 6% e 94% da largura e entre 14% e 65% da altura. Dentro dessa região, preserve também o canto inferior direito reservado — últimos 30% da largura e 40% da altura. Fora da área protegida, use apenas fundo e elementos não essenciais. Não desenhe guias ou faixas.
```

- Os percentuais são derivados de `SAFE_AREA_PERCENT` (6/94 de largura,
  14/65 de altura, 30×40 no canto); a geometria e a proveniência não mudaram.
- O bloco antigo (“Deixe sem textos…”, “O fundo deve preencher…”) foi removido.
  Não há pixels, explicações adicionais ou repetição das regras.

## Diff de prompt (antes → depois)

```diff
-Crie uma campanha de oferta em imagem estática vertical 9:16, em peça única.
+Crie uma campanha de oferta, em peça única.
 
 [ÁREAS RESERVADAS]
-Deixe sem textos, ativo da loja ou partes essenciais do produto: 14% do topo, 35% da base, 6% de cada lateral e o retângulo inferior direito de 30% da largura por 40% da altura.
-O fundo deve preencher também essas regiões. Não desenhe guias, demarcações ou faixas vazias.
+Saída: arte estática para Instagram, vertical 9:16, com fundo preenchendo todo o quadro.
+
+Área protegida: mantenha textos, preço, ativo da loja e partes essenciais do produto entre 6% e 94% da largura e entre 14% e 65% da altura. Dentro dessa região, preserve também o canto inferior direito reservado — últimos 30% da largura e 40% da altura. Fora da área protegida, use apenas fundo e elementos não essenciais. Não desenhe guias ou faixas.
```

## Prompt completo — repetição do briefing da geração 2

Briefing: Bolo Naked Fruit / descrição “Massa de pão de ló” / aviso
“Imagem meramente ilustrativa\nRecheio e cobertura de frutas” / Oferta /
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
Saída: arte estática para Instagram, vertical 9:16, com fundo preenchendo todo o quadro.

Área protegida: mantenha textos, preço, ativo da loja e partes essenciais do produto entre 6% e 94% da largura e entre 14% e 65% da altura. Dentro dessa região, preserve também o canto inferior direito reservado — últimos 30% da largura e 40% da altura. Fora da área protegida, use apenas fundo e elementos não essenciais. Não desenhe guias ou faixas.
```

Métricas: 1.737 caracteres, 30 linhas.
SHA-256: `181703e8d6474811e2785c99b93b780a3727c86250f2a494f33af401709ff34a`.

## Verificação

| Gate | Resultado |
|---|---|
| Verticais | **18 arquivos / 218 testes passando** |
| 1:1 | **49 arquivos / 943 testes passando** |
| IA | **39 arquivos + 1 skipped / 389 testes + 7 skipped** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 — 96 páginas |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

Testes adicionados/atualizados:

- o bloco novo aparece exatamente uma vez;
- `Saída` e `Área protegida` ocorrem uma vez cada;
- `vertical 9:16` ocorre uma vez (não é repetido no objetivo);
- percentuais 6/94, 14/65, 30/40 aparecem uma vez cada;
- o bloco antigo não aparece;
- nenhum pixel/downscale/nota interna;
- demais blocos verticais e o prompt 1:1 permanecem byte-idênticos ao baseline.

## Limitações

- Nenhuma geração paga foi executada nesta alteração.
- A geração 2 registrou composer v1; portanto as versões v2–v6 ainda não foram
  exercidas por uma campanha real. É necessário reiniciar o processo da
  aplicação antes do próximo teste e conferir `composer_version` na evidência.
- Uma única geração será evidência inicial, não garantia de consistência.
