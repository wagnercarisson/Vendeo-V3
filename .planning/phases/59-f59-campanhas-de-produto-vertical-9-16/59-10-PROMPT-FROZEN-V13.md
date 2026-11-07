# 59-10 — Prompt vertical v13 congelado para a matriz

## Status

Esta é a versão preparada para a matriz manual aprovada. **Ainda não há campanha
gerada com v13**; a campanha de referência visual continua sendo `95d7f559…`
(v12), registrada em `59-10-PROMPT-FROZEN-V12.md`.

A alteração textual solicitada exigiu nova versão: o restante do prompt v12
permanece idêntico.

## Versões

| Campo | Valor |
|---|---|
| Compositor | `f59-vertical-9-16-composer-v13` |
| Formato | `f59-9-16-v11` |
| Prompt-base | `48.2.6-produto-1-1-v1` |
| Safe area | `safe-area-9-16-experimental-v3` |
| Commit do compositor | a registrar no commit desta rodada |
| Intenção | `48.2.6-oferta-v2` |
| TipoConteudo | `48.2.6-produto-v4` |
| Estrutura | `48.2.4-peca-unica-v1` |
| Tema | `48.2.4-tema-nenhum-v1` |
| Geral | `48.2.5-general-integrity-v1` |
| Fundo | `48.2.6-background-direction-v2` |
| Identidade | `48.2.6-identity-context-v1` |

## Política experimental v3

- Topo: **5%** da altura.
- Base: **20%** da altura.
- Geração `1152×2048`: topo 102 px; base 410 px; informações protegidas entre
  `y=102` e `y=1638`.
- Entrega `1080×1920`: topo 96 px; base 384 px; informações protegidas entre
  `y=96` e `y=1536`.
- Sem máscara lateral e sem recorte de canto.
- A faixa superior é apenas 5%; **não** é uma área segura superior de 15%.
  A pendência do ativo no topo pode persistir entre 5% e 15%.

## Prompt completo (v13)

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
Os 5% superiores e os 20% inferiores são exclusivos para fundo. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer fora dessas áreas. Textos obrigatórios não devem funcionar como rodapé da imagem.

Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.

Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.

Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.
```

- 2.674 caracteres, 36 linhas.
- SHA-256: `ba168555aab388aa008e8c1ef4c9d9ab1245fc07505afcb7b6872d0caa70aeb2`.
- O prompt abaixo não é captura literal: é reconstrução determinística do
  compositor v13 com as entradas congeladas. O prompt bruto do provider não é
  persistido.

## Observação de escopo

A primeira frase do bloco `[COMPOSIÇÃO PARA INSTAGRAM]` foi alterada para incluir
os 5% superiores. O parágrafo seguinte, que permite produto/embalagem/complementos
avançarem nas faixas, foi preservado conforme a instrução de não fazer outras
alterações. A avaliação deve considerar essa redação literal.
