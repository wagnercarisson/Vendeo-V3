# 59-10 — Geração manual acompanhada (safe-area wording v6)

## Status

**PREPARADO PARA A SUBMISSÃO MANUAL.** A flag `product_9_16_enabled` está ON; o
seletor 1:1 / 9:16 está visível. Nenhuma geração paga foi executada nesta
preparação. Desativar a flag imediatamente após a geração única.

## Objetivo

Comparar a geração anterior com uma nova geração em que **somente** a orientação
de formato/área segura mudou. O restante do prompt e o briefing são os mesmos da
geração 2.

Versões esperadas na evidência:

- compositor: `f59-vertical-9-16-composer-v6`;
- formato: `f59-9-16-v4`;
- safe area técnica: `safe-area-9-16-v1`.

## Caso de teste (repetição da geração 2)

- Loja: **Padaria da Esquina**.
- Produto: **Bolo Naked Fruit**.
- Descrição: **“Massa de pão de ló”**.
- Aviso obrigatório: **“Imagem meramente ilustrativa\nRecheio e cobertura de frutas”**.
- Intenção: **Oferta**; fundo: **Estúdio**.
- Preço: **R$ 69,90**; selo: **Imperdível**; validade: **enquanto durarem os estoques**.
- Anexos: produto `9110f31a5528ead0…` + ativo `21e5e037f6605bb9…`.
- Paleta: principal `#3B2418`; apoio `#D59D5E`.

Prompt de referência: 1.737 caracteres, 30 linhas.

`sha256 = 181703e8d6474811e2785c99b93b780a3727c86250f2a494f33af401709ff34a`

## Pré-condições

1. **Reiniciar o processo da aplicação** para carregar o compositor v6. A
   geração 2 registrou `composer_version = f59-vertical-9-16-composer-v1`;
   sem reiniciar, o teste pode repetir a versão antiga.
2. Confirmar `product_9_16_enabled` ON e o seletor 1:1 / 9:16 visível.
3. Confirmar que o ativo vigente da loja ainda é
   `21e5e037f6605bb9c6fb3365959b4cc9c162bd9cb9121165f395e8872b7ea759`
   (arquivo `5ced8af3-…png`). Se mudou, **parar e informar antes do teste**.
4. Confirmar o mesmo produto/briefing e os mesmos arquivos de referência acima.
5. Confirmar saldo de crédito e ausência de operação em andamento.

## Execução (manual, uma única vez)

1. Submeter a campanha do caso acima.
2. Não repetir em caso de falha; registrar e parar.
3. Desativar a flag imediatamente após o término.
4. Não alterar o prompt, não rodar a matriz restante e não avançar para produção.

## Evidências a capturar

- `campaignId`, `operationId`, tentativa e custo interno;
- `composer_version`, `policy_versions` e `base_version` da evidência congelada;
- hashes dos anexos enviados (produto e ativo);
- arte JPEG 1080 × 1920 e path vertical;
- sobreposição da área protegida (6–94% da largura, 14–65% da altura e
  retângulo inferior direito de 30% × 40%);
- telemetria `format=9:16` e `requestedSize=1152x2048`.

## Avaliação separada

- [ ] Cumprimento geométrico das margens.
- [ ] Preservação e legibilidade do ativo da loja.
- [ ] Legibilidade do preço e dos textos obrigatórios.
- [ ] Qualidade comercial e visual percebida pelo responsável.

Uma única geração é evidência inicial, não garantia de consistência.

## Condições de parada

- `composer_version` diferente de v6 ⇒ a geração não testou a mudança; registrar
  e parar.
- Ativo vigente diferente do hash acima ⇒ parar antes do teste.
- Violação de área protegida, ativo descaracterizado, texto ilegível ou
  informação inventada ⇒ **FAIL**, flag OFF e nenhuma nova submissão.
- Custo acima do orçamento aprovado ⇒ parar.
