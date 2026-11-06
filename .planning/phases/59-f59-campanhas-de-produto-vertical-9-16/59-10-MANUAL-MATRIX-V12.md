# 59-10 — Matriz manual curta (prompt v12 congelado)

## Estado antes da matriz

- Prompt congelado: `59-10-PROMPT-FROZEN-V12.md`.
- Compositor: `f59-vertical-9-16-composer-v12`.
- Commit congelado: `80137b2d7648c83c4960d4df0d6c0255e29eb205`.
- Créditos da loja: **5**.
- Teto do piloto: **US$ 2,20**; gasto **US$ 1,6007**; margem **US$ 0,5993**.
- O teto foi ampliado de US$ 1,70 para US$ 2,20 via RPC
  `product_1_1_pilot_set_cap` (operação `8cdc1754-05bb-4c85-b55d-44ec5dbe7c1e`),
  porque a margem anterior (US$ 0,0993) não cobria a matriz. Não houve concessão
  de crédito.
- Máximo de submissões pagas: **2**. Sem retries ou repetição automática.

## Estimativa

- Observado por geração: imagem ~US$ 0,0306 + copy ~US$ 0,00018 ≈ **US$ 0,0308**.
- Duas gerações observadas: ≈ **US$ 0,0616**.
- Pior caso interno por geração (imagem 0,11 + copy 0,0007 + fallback 0,044):
  US$ 0,1547; duas gerações: **US$ 0,3094**, dentro da margem de US$ 0,5993.

## Matriz proposta

### Submissão 1 — Produto embalado + fundo ambientado

| Campo | Valor |
|---|---|
| Loja | Padaria da Esquina (`48b212f8-2b0f-4679-b553-122a601bacac`) |
| Produto | **Pão de Queijo Mineiro 500gr** |
| Descrição | “Feito com o inconfundível queijo de minas! Reforce esse diferencial na imagem e nos comentários.” |
| Intenção | Oferta |
| Fundo | **Ambientado** |
| Preço original / venda | R$ 18,99 / R$ 14,99 |
| Selo | Oferta |
| Validade | não informada |
| Aviso obrigatório | “Imagem meramente ilustrativa” |
| Origem dos dados | campanha `5bfe8cc1-e516-416e-9814-20f32ef054c4` |
| Arquivo de produto | upload `9ffd4412-1a5b-4963-8432-82811f430659` da campanha de origem |

Objetivo: avaliar fidelidade de produto embalado, informações identificadoras e
adequação ao fundo ambientado. Reutilizar o arquivo existente; confirmar o hash
do produto antes da submissão.

### Submissão 2 — Forma/proporção diferente + cenário original

| Campo | Valor |
|---|---|
| Loja | Padaria da Esquina (`48b212f8-2b0f-4679-b553-122a601bacac`) |
| Produto | **Pão Caseiro (kg)** |
| Descrição | não informada |
| Intenção | Destaque |
| Fundo | **Original** |
| Preço | R$ 16,99 |
| Selo | Mais Vendido |
| Validade | não informada |
| Aviso obrigatório | “Imagem meramente ilustrativa” |
| Origem dos dados | campanha `22d4c990-91c8-4ea5-a4db-a59c7e559499` |
| Referência de produto | `cc990d04bd7492f9dcaec98d00863a157884c2bd56aff2a88fcd8b34db25e238` |

Objetivo: avaliar enquadramento de produto com forma/proporção diferente e
preservação do cenário original. Usar exatamente uma imagem de produto, como o
fluxo exige para `original`.

## Regras da matriz

- Usar a **identidade vigente da loja** (assinatura ativa e paleta atual), não a
  identidade histórica congelada da campanha de origem.
- Não criar produtos, lojas, créditos ou dados.
- Não alterar código, prompt, modelos, qualidades, pricing ou pipeline durante a
  matriz.
- Se o arquivo de produto de origem não estiver acessível ou o hash divergir,
  **parar e informar** antes da submissão.
- Se houver falha técnica ou visual, registrar e parar; não repetir sem
  autorização.
- O topo de 15% não é protegido pela política atual; a presença do ativo nessa
  faixa é pendência conhecida. O produto pode avançar na faixa inferior de 20%
  sem reprovação automática.

## Avaliação por campanha

Registrar separadamente:

- qualidade visual e aceitação do responsável;
- fidelidade do produto e do ativo;
- nome, preço, condições e textos obrigatórios;
- legibilidade e hierarquia;
- respeito às faixas superior e inferior;
- adequação ao fundo escolhido;
- entrega, miniatura, download, crédito e custo observado.

O parecer consolidado deve separar qualidade estética de cumprimento técnico.
