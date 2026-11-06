# 59-10 — Congelamento do prompt vertical 9:16 (v12)

## Execução de referência

| Campo | Valor |
|---|---|
| Campanha | `95d7f559-76c3-46f1-b793-45a3d8b22622` |
| Operação | `daeed4fd-a65c-4f03-b062-bf64ab907619` |
| Status | `ready` / delivered |
| Criada / entregue | 2026-11-06 16:42:38 / 16:43:01 UTC |
| Arte | `.../product-9-16/daeed4fd-a65c-4f03-b062-bf64ab907619/art-1080x1920.jpg` |
| Custo copy / imagem | US$ 0,000176 / US$ 0,030614 |
| Modelo / qualidade | `gpt-image-2.5-sunburst` / `medium` |
| Fallback do snapshot | `gpt-image-2` / `low` |

## Versões congeladas

| Campo | Valor |
|---|---|
| Commit HEAD | `80137b2d7648c83c4960d4df0d6c0255e29eb205` |
| Commit do compositor | `9ced84cb` |
| `composer_version` | `f59-vertical-9-16-composer-v12` |
| `base_version` | `48.2.6-produto-1-1-v1` |
| intenção | `48.2.6-oferta-v2` |
| formato | `f59-9-16-v10` |
| tipoConteudo | `48.2.6-produto-v4` |
| estrutura | `48.2.4-peca-unica-v1` |
| tema | `48.2.4-tema-nenhum-v1` |
| geral | `48.2.5-general-integrity-v1` |
| fundo | `48.2.6-background-direction-v2` |
| identidade | `48.2.6-identity-context-v1` |
| safeArea | `safe-area-9-16-experimental-v2` |

## Referências congeladas

- Produto: `9110f31a5528ead0201e1ef35e6f1431e6a4a7437f5067ff2253df62eec7a304`.
- Ativo da loja: `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
- Paleta: principal `#3B2418`; apoio `#D59D5E`.
- Diretiva de identidade:

```text
Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo.
Paleta da loja "Padaria da Esquina": cor principal #3B2418; cor de apoio #D59D5E.
```

Briefing congelado:

```json
{"backgroundDirection":"studio","product":{"name":"Bolo Naked Fruit","description":"Massa de pão de ló\nRecheio e cobertura de frutas"},"commercial":{"intent":"offer","originalPriceText":null,"discountedPriceText":"R$ 69,90","badge":"Imperdível","validity":"enquanto durarem os estoques"},"constraints":{"mandatoryArtworkText":"Imagem meramente ilustrativa"},"identity":{"storeName":"Padaria da Esquina","palettePrimary":"#3B2418","paletteAccent":"#D59D5E"}}
```

## Prompt reconstruído completo

O prompt bruto enviado ao provider **não é persistido**. A reconstrução abaixo é
determinística a partir do briefing, das referências e da diretiva congelados,
usando o compositor v12 no commit `80137b2d`. Não há log bruto do provider.

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
- Esse hash coincide com o prompt preparado antes da submissão v12.

## Resultado de referência

- Direção estética aprovada pelo responsável: composição **mais expressiva, leve e natural**.
- Preço, validade e aviso **fora dos 20% inferiores**.
- Produto e complementos **avançando na faixa inferior** conforme permitido.
- Ativo da loja **ainda dentro dos 15% superiores**: pendência conhecida, não resolvida.
- Aviso **horizontal válido**, pois a rotação é opcional.

Isso **não** representa aprovação integral das áreas seguras, conclusão da
homologação ou autorização de produção.

## Regra de congelamento

Durante a matriz manual, permanecem congelados o código e as regras do compositor,
o tratamento do ativo, a configuração compartilhada de modelos/qualidades, o
pricing e o pipeline. Nenhuma alteração editorial, funcional ou de política deve
ser feita nesta rodada.
