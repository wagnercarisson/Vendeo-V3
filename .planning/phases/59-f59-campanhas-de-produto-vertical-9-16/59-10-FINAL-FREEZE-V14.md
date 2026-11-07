# 59-10 — Congelamento final do prompt vertical (v14)

## Campanha e operação

| Campo | Valor |
|---|---|
| Campanha | `3e7562ea-8fca-42ae-8e59-e75ac513db0f` |
| Operação | `c717a472-ad8d-40ee-9f9a-bad34baa364f` |
| Status | `ready` / delivered |
| Produto | Pão Francês "Fresquinho" |
| Fundo | Original |
| Criada / entregue | 2026-11-06 17:40:37 / 17:40:59 UTC |
| Arte | `.../product-9-16/c717a472-ad8d-40ee-9f9a-bad34baa364f/art-1080x1920.jpg` |
| Modelo / qualidade | `gpt-image-2.5-sunburst` / `medium` |
| Custo copy / imagem | US$ 0,000076 / US$ 0,030304 |

## Versões congeladas

| Campo | Valor |
|---|---|
| Commit do compositor | `69a50617` |
| Estado de preparação/docs | `eec0433a` |
| `composer_version` | `f59-vertical-9-16-composer-v14` |
| `base_version` | `48.2.6-produto-1-1-v1` |
| intenção | `48.2.6-destaque-v2` |
| formato | `f59-9-16-v12` |
| tipoConteudo | `48.2.6-produto-v4` |
| estrutura | `48.2.4-peca-unica-v1` |
| tema | `48.2.4-tema-nenhum-v1` |
| geral | `48.2.5-general-integrity-v1` |
| fundo | `48.2.6-background-direction-v2` |
| identidade | `48.2.6-identity-context-v1` |
| safeArea | `safe-area-9-16-experimental-v3` |

## Referências e dados congelados

- Produto: `9f04b2a7ea3e505c47008123cb4e38e963fdf552dc3a9b93db7d2f49d433e3ed`.
- Ativo: `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
- Paleta: `#3B2418` / `#D59D5E`.
- Sem preço, sem selo e sem validade.
- Aviso obrigatório: “Saiu uma fornada... corre para garanti o seu!” — erro de
  entrada confirmado pelo responsável, **não falha de geração**.

## Prompt reconstruído completo

O prompt bruto enviado ao provider **não é persistido**. Esta é uma reconstrução
determinística do compositor v14 com as entradas congeladas. Não há log bruto.

```text
Crie uma campanha de destaque, em peça única.

[REFERÊNCIAS]
Imagem 1: produto anunciado. Preserve sua aparência e use-o como protagonista.
Imagem 2: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.

[DADOS DA CAMPANHA]
Loja: "Padaria da Esquina"
Produto: "Pão Francês \"Fresquinho\""
Aviso obrigatório: "Saiu uma fornada... corre para garanti o seu!"
Paleta: principal #3B2418; apoio #D59D5E.

[COMPOSIÇÃO]
Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.
Exerça liberdade criativa na composição: explore enquadramento, iluminação, profundidade e hierarquia visual para criar uma campanha expressiva e comercialmente atraente, respeitando as informações fornecidas, o ativo da loja e as áreas protegidas.
Priorize a apresentação do produto.
Não invente informações comerciais.
Trate cada preço como uma única expressão monetária. Use exatamente uma vírgula entre a parte inteira e os centavos, quando houver centavos, mesmo quando tiverem tamanhos ou alinhamentos diferentes. Não repita a vírgula ao separar visualmente os centavos.
Mantenha o cenário da imagem enviada como base; não substitua o ambiente por outro.
Não altere o produto nem o cenário para resolver contraste; ajuste posição, escala ou a aplicação do ativo.
Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.
Use português correto e natural, sem caracteres ou pontuação duplicados, e não corrija silenciosamente os textos de entrada.

[COMPOSIÇÃO PARA INSTAGRAM]
Os 5% superiores e os 20% inferiores são exclusivos para fundo. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer fora dessas áreas. Textos obrigatórios não devem funcionar como rodapé da imagem.

Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.

Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.

Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.
```

- 2.502 caracteres, 31 linhas.
- SHA-256: `0682fd7c4d51c48fa5be2d92d97b153852fa0d072e3bde14808f74059c5325f5`.

## Regra de congelamento final

Nenhuma alteração de texto, política, ativo, modelo, qualidade ou pipeline deve
ocorrer durante os testes finais. Este é o congelamento de referência da F59.
