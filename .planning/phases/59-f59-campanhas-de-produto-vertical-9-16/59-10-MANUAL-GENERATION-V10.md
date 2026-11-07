# 59-10 — Geração manual acompanhada (faixa inferior de 20%, v10)

## Status

**PREPARADO PARA A SUBMISSÃO MANUAL.** A flag `product_9_16_enabled` permanece
ON; o seletor 1:1 / 9:16 está visível. Nenhuma geração paga foi executada nesta
preparação.

## Origem das entradas

Repetir exatamente a última geração manual:

- campanha de origem: `d6ae75d9-d3b1-42c6-bf90-dca3591d2564`;
- operação: `7b7a4afa-f80b-457e-8a31-1c73380052c2`;
- compositor da origem: `f59-vertical-9-16-composer-v9`.

Criar uma **nova campanha**; não alterar a campanha de origem.

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

- compositor: `f59-vertical-9-16-composer-v10`;
- formato: `f59-9-16-v8`;
- política experimental: `safe-area-9-16-experimental-v2`;
- base: `48.2.6-produto-1-1-v1`.

Prompt de referência: 2.174 caracteres, 34 linhas.

`sha256 = a209fd0573d1f6fbe17b1ed0892a96c6ed012b2247876b44269174392dea0b4e`

## Pré-condições

1. Confirmar que a aplicação em execução carregou o compositor v10.
2. Confirmar `product_9_16_enabled` ON e o seletor visível.
3. Confirmar o ativo vigente:
   `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
   Se mudou, **parar e informar antes do teste**.
4. Confirmar crédito disponível: **8 créditos** (saldo atual; nenhuma concessão
   feita nesta preparação).
5. Confirmar margem do piloto: cap **US$ 1,50**, gasto **US$ 1,2686**,
   margem **US$ 0,2314**. A imagem (US$ 0,11) + copy (US$ 0,0007) + eventual
   fallback (US$ 0,044) cabem na margem; retries adicionais não.
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

Sobreposição de análise em 1080 × 1920, apenas na faixa inferior:

- faixa inferior: `y=1536..1920`;
- sem faixa superior, máscara lateral ou recorte de canto.

Correspondência no canvas de geração `1152 × 2048`: `y=1638..2048`.

A sobreposição é feita numa cópia de análise; a arte original não deve ser
alterada.

Avaliar separadamente:

- proteção dos textos, preço, condições comerciais e ativo;
- reconhecimento do produto e preservação das informações essenciais;
- aproveitamento do quadro, equilíbrio e legibilidade;
- aceitação visual pelo responsável.

Não reprovar apenas porque produto, embalagem ou complementos avançaram na
faixa inferior.

## Condições de parada

- `composer_version` diferente de v10 ⇒ a geração não testou a mudança; parar.
- Ativo vigente diferente do hash acima ⇒ parar antes do teste.
- Falha de crédito/teto ⇒ não conceder crédito nem elevar teto autonomamente;
  informar o responsável.
- Qualquer falha de geração ⇒ registrar e parar; sem repetição automática.
