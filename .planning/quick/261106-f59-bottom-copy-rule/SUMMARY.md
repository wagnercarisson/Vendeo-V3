# Quick 261106-f59-bottom-copy-rule — restrição inferior para textos obrigatórios

## Escopo

Alteração isolada da primeira orientação do bloco `[COMPOSIÇÃO PARA INSTAGRAM]`.
Nenhuma mudança em identidade/aplicação do ativo, paleta, fundo, composição,
dados, descrição/aviso, referências, Copy Director, modelos, qualidade, pricing,
pipeline, flag, banco ou prompt 1:1.

## Alteração autorizada

- Compositor: `f59-vertical-9-16-composer-v11`.
- Formato: `f59-9-16-v9`.
- Política experimental: `safe-area-9-16-experimental-v2` (inalterada).
- Substituído apenas o primeiro parágrafo; os demais permanecem iguais.
- O novo texto proíbe qualquer texto na faixa inferior, incluindo obrigatórios,
  avisos legais e validade; preço, selo, CTA e ativo também ficam acima.

## Diff autorizado

```diff
 [COMPOSIÇÃO PARA INSTAGRAM]
-Os 20% inferiores da imagem são exclusivos para fundo, produto e seus complementos visuais. É PROIBIDO colocar nessa faixa qualquer texto, preço, selo, CTA ou ativo da loja, inclusive avisos obrigatórios e validade. Posicione esses elementos integralmente acima da faixa inferior, sem encostar no limite.
+Os 20% inferiores são exclusivos para fundo, produto e seus complementos visuais. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer integralmente acima dela. Os textos obrigatórios devem integrar a composição acima dessa faixa, não funcionar como rodapé da imagem.
```

## Prompt completo — entradas da campanha 3e7786ef…

Origem: campanha `3e7786ef-a186-4bb3-bf8c-a7cbc3b4ff94` / operação
`79dd4add-4c7f-4ad2-ae6b-50d4f0e6508e` (v10). Briefing: Bolo Naked Fruit /
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
Os 20% inferiores são exclusivos para fundo, produto e seus complementos visuais. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer integralmente acima dela. Os textos obrigatórios devem integrar a composição acima dessa faixa, não funcionar como rodapé da imagem.

Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.

Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.

Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.
```

- 2.255 caracteres, 34 linhas.
- SHA-256: `ea3c9f7e6fb3d9259d87e3ba99480b6ad7f6bbaadfb9e1b6b24b4031bbb30351`.

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

Testes: parágrafo novo uma vez; frases “É PROIBIDO…” e “Os textos obrigatórios…”
uma vez; ausência do texto anterior e de 15%; ausência de pixels/canvas; demais
blocos byte-idênticos; 1:1 byte-idêntico.

## Resultado anterior

A rodada v10 (`3e7786ef…`) mostrou avanço no preço, mas o ativo ainda aparece nos
15% superiores; não representa aprovação integral das áreas seguras. Registro em
`59-10-HOMOLOG-RESULT-5.md`. O novo texto não altera a política de topo; a
observação permanece em avaliação.

## Limitações

- Nenhuma geração paga executada.
- A submissão e a avaliação visual ficam com o responsável.
- Overlay apenas na faixa inferior, em cópia de análise.
