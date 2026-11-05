# 59-10 — Geração manual acompanhada (áreas reservadas em pixels, v7)

## Status

**PREPARADO PARA A SUBMISSÃO MANUAL.** A flag `product_9_16_enabled` permanece
ON; o seletor 1:1 / 9:16 está visível. Nenhuma geração paga foi executada nesta
preparação.

## Registro da rodada anterior (v6)

A execução `bc10ce42-d330-4332-a7e9-9045bd80b72b` / operação
`1b31c766-a1f6-4e2b-9fdf-ebdb33b8f15e` foi registrada como:

- **qualidade visual não aprovada pelo responsável**;
- **posicionamento fora das áreas protegidas**.

Essa é uma avaliação manual. Não se atribui causalidade à simplificação do
prompt, nem se registra falha do ativo como fato confirmado. A arte e a evidência
originais permanecem intactas.

## Objetivo

Comparar a nova geração com a anterior mantendo **exatamente** as mesmas
entradas e referências congeladas, alterando somente a orientação de áreas
reservadas (percentuais → pixels do canvas de geração).

## Caso de teste (repetição literal da campanha bc10ce42…)

- Loja: **Padaria da Esquina**.
- Produto: **Bolo Naked Fruit**.
- Descrição: **“Massa de pão de ló”**.
- Aviso obrigatório: **“Imagem meramente ilustrativa\nRecheio e cobertura de frutas”**.
- Intenção: **Oferta**; fundo: **Estúdio**.
- Preço: **R$ 69,90**; selo: **Imperdível**; validade: **enquanto durarem os estoques**.
- Anexos: produto `9110f31a5528ead0…` + ativo `21e5e037f6605bb9…`.
- Paleta: principal `#3B2418`; apoio `#D59D5E`.

Não mova conteúdo entre descrição e aviso obrigatório. Não altere os arquivos de
referência. Crie uma **nova campanha**; não altere `bc10ce42…`.

## Versões esperadas

- compositor: `f59-vertical-9-16-composer-v7`;
- formato: `f59-9-16-v5`;
- safe area técnica: `safe-area-9-16-v1`;
- base: `48.2.6-produto-1-1-v1`.

Prompt de referência: 1.798 caracteres, 34 linhas.

`sha256 = e8b68dee580ef332d008bcc949592addd85b945f8411905d85d25aeccf606133`

## Pré-condições

1. **Reiniciar o processo da aplicação** após o build v7 e confirmar que o build
   em execução contém `f59-vertical-9-16-composer-v7`.
2. Confirmar `product_9_16_enabled` ON e o seletor visível (já estão).
3. Confirmar o ativo vigente:
   `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
   Se mudou, **parar e informar antes do teste**.
4. Confirmar crédito disponível: **1 crédito** na loja.
5. Confirmar margem do piloto: cap **US$ 1,10**, gasto **US$ 0,9365**,
   margem **US$ 0,1635**. A estimativa da imagem é US$ 0,11 e a da copy
   US$ 0,0007; a margem cobre a chamada primária e uma eventual fallback
   estimada em US$ 0,044, mas **não** cobre retries adicionais.
6. Nenhuma migration, flag, concessão de crédito, push ou deploy.

## Execução (manual, uma única vez)

1. Abrir `/campanhas/nova`.
2. Preencher o caso acima e selecionar **Vertical 9:16**.
3. Submeter **uma única vez**.
4. Não repetir, não fazer fallback e não alterar o prompt.
5. Enviar `campaignId` e `operationId` para registro e comparação.

## Evidências a capturar

- `campaignId`, `operationId`, tentativa e custo;
- `composer_version`, `policy_versions` e `base_version` da evidência congelada;
- hashes dos anexos;
- arte JPEG 1080 × 1920 e path vertical;
- telemetria `format=9:16`, `requestedSize=1152x2048`.

## Comparação pós-teste (análise, nunca na arte original)

Sobreponha as regiões convertidas para a entrega 1080 × 1920:

- retângulo protegido: `x=65..1015`, `y=269..1248`;
- região inferior direita excluída: `x=756..1080`, `y=1152..1920`.

Use essas conversões apenas na cópia/evidência de análise. A arte original não
deve ser alterada.

## Avaliação separada

- [ ] Posicionamento geométrico dentro das áreas permitidas.
- [ ] Qualidade visual percebida pelo responsável (aprovada / não aprovada).
- [ ] Preservação e legibilidade do ativo (registrar separadamente, sem presumir falha).
- [ ] Legibilidade de preço e textos obrigatórios.

Uma única geração é evidência inicial, não garantia de consistência.

## Condições de parada

- `composer_version` diferente de v7 ⇒ a geração não testou a mudança; parar.
- Ativo vigente diferente do hash acima ⇒ parar antes do teste.
- Falha de crédito/teto ⇒ não conceder crédito nem elevar teto autonomamente;
  informar o responsável.
- Qualquer falha de geração ⇒ registrar e parar; sem repetição automática.
