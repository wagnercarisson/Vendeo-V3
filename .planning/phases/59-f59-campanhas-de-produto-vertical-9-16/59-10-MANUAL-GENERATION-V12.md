# 59-10 — Geração manual acompanhada (liberdade criativa e aviso, v12)

## Status

**PREPARADO PARA A SUBMISSÃO MANUAL.** A flag `product_9_16_enabled` permanece
ON; o seletor 1:1 / 9:16 está visível. Nenhuma geração paga foi executada nesta
preparação.

## Origem das entradas

Repetir exatamente a última geração manual:

- campanha de origem: `590ea2db-7483-48eb-983f-7d69dc0dd86a`;
- operação: `84b84c9a-e342-4329-9375-b433397bf514`;
- compositor da origem: `f59-vertical-9-16-composer-v11`.

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

## Versões esperadas

- compositor: `f59-vertical-9-16-composer-v12`;
- formato: `f59-9-16-v10`;
- política experimental: `safe-area-9-16-experimental-v2` (inalterada);
- base: `48.2.6-produto-1-1-v1`.

Prompt de referência: 2.743 caracteres, 36 linhas.

`sha256 = 6fcf6e4da4cb6267c6225a814e13c2adbec47757f9d9358ce087e9f003128b3e`

## Pré-condições

1. Confirmar que a aplicação em execução carregou o compositor v12.
2. Confirmar `product_9_16_enabled` ON e o seletor visível.
3. Confirmar o ativo vigente:
   `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
   Se mudou, **parar e informar antes do teste**.
4. Confirmar crédito disponível: **6 créditos** (saldo atual; nenhuma concessão
   feita nesta preparação).
5. Confirmar margem do piloto: cap **US$ 1,70**, gasto **US$ 1,4900**,
   margem **US$ 0,2100**. A imagem (US$ 0,11), a copy (US$ 0,0007) e uma eventual
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

Avaliar separadamente:

- expressão visual e liberdade criativa;
- legibilidade;
- preservação das informações comerciais e do ativo;
- cumprimento das áreas protegidas (faixa inferior de 20%; o topo não é
  protegido pela política atual).

O aviso permanecer horizontal **não** constitui falha: a rotação é opcional.
A instrução do aviso não deve aparecer como texto na arte.

## Condições de parada

- `composer_version` diferente de v12 ⇒ a geração não testou a mudança; parar.
- Ativo vigente diferente do hash acima ⇒ parar antes do teste.
- Falha de crédito/teto ⇒ não conceder crédito nem elevar teto autonomamente;
  informar o responsável.
- Qualquer falha de geração ⇒ registrar e parar; sem repetição automática.
