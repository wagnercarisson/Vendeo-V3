# 59-10 — Geração manual acompanhada (composição para Instagram, v9)

## Status

**PREPARADO PARA A SUBMISSÃO MANUAL.** A flag `product_9_16_enabled` permanece
ON; o seletor 1:1 / 9:16 está visível. Nenhuma geração paga foi executada nesta
preparação.

## Origem das entradas

Repetir exatamente a última geração manual com composição compacta:

- campanha de origem: `7d0035ad-0f6f-4861-8f7f-4bdf8d21222f`;
- operação: `57957d65-b06e-496e-8622-3cca7bf69d0c`;
- compositor da origem: `f59-vertical-9-16-composer-v8`.

Não usar dados atuais da loja como substituição. Criar uma **nova campanha**;
não alterar a campanha de origem.

## Caso de teste (repetição literal)

- Loja: **Padaria da Esquina**.
- Produto: **Bolo Naked Fruit**.
- Descrição: **“Massa de pão de ló\nRecheio e cobertura de frutas”**.
- Aviso obrigatório: **“Imagem meramente ilustrativa”**.
- Intenção: **Oferta**; fundo: **Estúdio**.
- Preço: **R$ 69,90**; selo: **Imperdível**; validade: **enquanto durarem os estoques**.
- Anexos: produto `9110f31a5528ead0…` + ativo `21e5e037f6605bb9…`.
- Paleta: principal `#3B2418`; apoio `#D59D5E`.

Não mova conteúdo entre descrição e aviso obrigatório. Use os mesmos arquivos de
referência.

## Versões esperadas

- compositor: `f59-vertical-9-16-composer-v9`;
- formato: `f59-9-16-v7`;
- política experimental: `safe-area-9-16-experimental-v1`;
- base: `48.2.6-produto-1-1-v1`.

Prompt de referência: 2.016 caracteres, 34 linhas.

`sha256 = 981309260bb6787f0add60183bc3cd8d673aa0e5623d6e25d7d8a44e717d3052`

## Pré-condições

1. Confirmar que a aplicação em execução carregou o compositor v9.
2. Confirmar `product_9_16_enabled` ON e o seletor visível.
3. Confirmar o ativo vigente:
   `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
   Se mudou, **parar e informar antes do teste**.
4. Confirmar crédito disponível: **9 créditos** (saldo atual; nenhuma concessão
   feita nesta preparação).
5. Confirmar margem do piloto: cap **US$ 1,30**, gasto **US$ 1,1579**,
   margem **US$ 0,1421**. A estimativa da imagem (US$ 0,11) + copy (US$ 0,0007)
   cabe na margem; uma fallback adicional (US$ 0,044) **não** cabe. Não elevar
   o teto autonomamente.
6. Nenhuma migration, flag, concessão de crédito, push ou deploy.

## Execução (manual, uma única vez)

1. Abrir `/campanhas/nova`.
2. Preencher o caso acima e selecionar **Vertical 9:16**.
3. Submeter **uma única vez**.
4. Não repetir, não fazer fallback manual e não alterar o prompt.
5. Enviar `campaignId` e `operationId` para registro.

## Evidências a capturar

- `campaignId`, `operationId`, tentativa e custo;
- `composer_version`, `policy_versions` e `base_version`;
- hashes dos anexos;
- arte JPEG 1080 × 1920 e path vertical;
- telemetria `format=9:16`, `requestedSize=1152x2048`.

## Avaliação pós-teste

Sobreposição de análise em 1080 × 1920, apenas nas faixas da nova política:

- faixa superior: `y=0..288`;
- faixa inferior: `y=1536..1920`;
- sem máscara lateral e sem recorte de canto.

Correspondência no canvas de geração `1152 × 2048`: `y=0..307` e
`y=1638..2048`.

A sobreposição é feita numa cópia de análise; a arte original não deve ser
alterada.

Avaliar separadamente:

- proteção dos textos, preço, condições comerciais e ativo;
- reconhecimento do produto e preservação das informações essenciais;
- aproveitamento do quadro, equilíbrio e legibilidade;
- aceitação visual pelo responsável.

Não reprovar apenas porque produto, embalagem ou complementos avançaram nas
faixas.

## Condições de parada

- `composer_version` diferente de v9 ⇒ a geração não testou a mudança; parar.
- Ativo vigente diferente do hash acima ⇒ parar antes do teste.
- Falha de crédito/teto ⇒ não conceder crédito nem elevar teto autonomamente;
  informar o responsável.
- Qualquer falha de geração ⇒ registrar e parar; sem repetição automática.
