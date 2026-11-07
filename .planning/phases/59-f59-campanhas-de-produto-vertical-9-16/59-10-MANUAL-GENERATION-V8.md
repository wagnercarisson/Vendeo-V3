# 59-10 — Geração manual acompanhada (composição compacta, v8)

## Status

**PREPARADO PARA A SUBMISSÃO MANUAL.** A flag `product_9_16_enabled` permanece
ON; o seletor 1:1 / 9:16 está visível. Nenhuma geração paga foi executada nesta
preparação.

## Registro da rodada anterior (v7)

Campanha `eb317eb8-52cc-40cc-b264-2180f7593ed5` / operação
`654427aa-969f-4246-8bb0-faf0aaa110d8`:

- a imagem apresentada continuou com **ativo no topo**;
- **preço, validade e aviso** permaneceram na faixa inferior reservada;
- não foi registrada falha do ativo.

Detalhes em `59-10-HOMOLOG-RESULT-4.md`.

## Caso de teste (repetição literal da campanha eb317eb8…)

- Loja: **Padaria da Esquina**.
- Produto: **Bolo Naked Fruit**.
- Descrição: **“Massa de pão de ló\nRecheio e cobertura de frutas”**.
- Aviso obrigatório: **“Imagem meramente ilustrativa”**.
- Intenção: **Oferta**; fundo: **Estúdio**.
- Preço: **R$ 69,90**; selo: **Imperdível**; validade: **enquanto durarem os estoques**.
- Anexos: produto `9110f31a5528ead0…` + ativo `21e5e037f6605bb9…`.
- Paleta: principal `#3B2418`; apoio `#D59D5E`.

Não mova conteúdo entre descrição e aviso obrigatório. Use os mesmos arquivos de
referência. Crie uma **nova campanha**; não altere `eb317eb8…`.

## Versões esperadas

- compositor: `f59-vertical-9-16-composer-v8`;
- formato: `f59-9-16-v6`;
- safe area técnica: `safe-area-9-16-v1`;
- base: `48.2.6-produto-1-1-v1`.

Prompt de referência: 1.832 caracteres, 32 linhas.

`sha256 = 7bde0569c14a0bf60f7b425f240746bb0e8808395543fa693e8d0658d5fa8b9b`

## Pré-condições

1. Confirmar que o processo em execução carregou o compositor v8.
2. Confirmar `product_9_16_enabled` ON e o seletor visível.
3. Confirmar o ativo vigente:
   `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`.
   Se mudou, **parar e informar antes do teste**.
4. Confirmar crédito disponível: **10 créditos** (saldo atual; nenhuma concessão
   feita nesta preparação).
5. Confirmar margem do piloto: cap **US$ 1,30**, gasto **US$ 1,0472**,
   margem **US$ 0,2528**. Estimativas: imagem US$ 0,11; copy US$ 0,0007;
   fallback US$ 0,044. A margem cobre a chamada primária e uma eventual fallback,
   mas não retries adicionais.
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

## Comparação pós-teste (análise, nunca na arte original)

Os cálculos de safe area continuam no código. Para a sobreposição de análise em
1080 × 1920:

- retângulo protegido: `x=65..1015`, `y=269..1248`;
- região inferior direita excluída: `x=756..1080`, `y=1152..1920`.

Use uma cópia para a sobreposição; a arte original não deve ser alterada.

## Avaliação separada

- [ ] Cumprimento da região segura.
- [ ] Legibilidade e qualidade comercial.
- [ ] Avaliação visual do responsável.
- [ ] Preservação do ativo (sem presumir falha).

Uma única geração é evidência inicial, não garantia de consistência.

## Condições de parada

- `composer_version` diferente de v8 ⇒ a geração não testou a mudança; parar.
- Ativo vigente diferente do hash acima ⇒ parar antes do teste.
- Falha de crédito/teto ⇒ não conceder crédito nem alterar teto autonomamente;
  informar o responsável.
- Qualquer falha de geração ⇒ registrar e parar; sem repetição automática.
