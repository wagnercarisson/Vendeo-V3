# 59-10 — Geração manual acompanhada (restrição inferior para textos, v11)

## Status

**PREPARADO PARA A SUBMISSÃO MANUAL.** A flag `product_9_16_enabled` permanece
ON; o seletor 1:1 / 9:16 está visível. Nenhuma geração paga foi executada nesta
preparação.

## Origem das entradas

Repetir exatamente a última geração manual:

- campanha de origem: `3e7786ef-a186-4bb3-bf8c-a7cbc3b4ff94`;
- operação: `79dd4add-4c7f-4ad2-ae6b-50d4f0e6508e`;
- compositor da origem: `f59-vertical-9-16-composer-v10`.

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

- compositor: `f59-vertical-9-16-composer-v11`;
- formato: `f59-9-16-v9`;
- política experimental: `safe-area-9-16-experimental-v2` (inalterada);
- base: `48.2.6-produto-1-1-v1`.

Prompt de referência: 2.255 caracteres, 34 linhas.

`sha256 = ea3c9f7e6fb3d9259d87e3ba99480b6ad7f6bbaadfb9e1b6b24b4031bbb30351`

## Pré-condições

1. Confirmar que a aplicação em execução carregou o compositor v11.
2. Confirmar `product_9_16_enabled` ON e o seletor visível.
3. Confirmar o ativo vigente:
   `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
   Se mudou, **parar e informar antes do teste**.
4. Confirmar crédito disponível: **7 créditos** (saldo atual; nenhuma concessão
   feita nesta preparação).
5. Confirmar margem do piloto: cap **US$ 1,70**, gasto **US$ 1,3793**,
   margem **US$ 0,3207**. A imagem (US$ 0,11), a copy (US$ 0,0007) e uma eventual
   fallback (US$ 0,044) cabem na margem.
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

- proteção dos textos, preço, condições comerciais e ativo na faixa inferior;
- se textos obrigatórios, avisos legais e validade integram a composição acima
  da faixa, sem funcionar como rodapé;
- reconhecimento do produto e preservação das informações essenciais;
- aproveitamento do quadro, equilíbrio e legibilidade;
- aceitação visual pelo responsável.

Observação da rodada anterior: o ativo ainda apareceu nos 15% superiores; esta
mudança não altera a política de topo. Não reprovar apenas porque produto,
embalagem ou complementos avançaram na faixa inferior.

## Condições de parada

- `composer_version` diferente de v11 ⇒ a geração não testou a mudança; parar.
- Ativo vigente diferente do hash acima ⇒ parar antes do teste.
- Falha de crédito/teto ⇒ não conceder crédito nem elevar teto autonomamente;
  informar o responsável.
- Qualquer falha de geração ⇒ registrar e parar; sem repetição automática.
