# 59-10 — Matriz manual aprovada (prompt v13)

## Base congelada

- Prompt da matriz: `59-10-PROMPT-FROZEN-V13.md`.
- Compositor: `f59-vertical-9-16-composer-v13`.
- Formato: `f59-9-16-v11`.
- Safe area: `safe-area-9-16-experimental-v3` (topo 5% + base 20%).
- Referência visual anterior: campanha `95d7f559…` (v12).
- O restante das regras do v12 permanece congelado; não há refatoração nem
  alteração de pipeline.

## Aprovação e limites

A matriz de **duas submissões manuais, uma por vez**, está aprovada.

- Créditos disponíveis: **5**.
- Créditos autorizados para a matriz: **2**.
- Teto do piloto: **US$ 2,20**.
- Gasto acumulado: **US$ 1,6007**.
- Margem: **US$ 0,5993**.
- Gasto adicional autorizado: **até US$ 0,5993**.
- **Sem ampliação automática do teto.** Se a margem não cobrir uma chamada,
  parar e pedir autorização.
- Retries e fallback internos consomem a mesma margem e contam no limite.
- Custo observado por geração: ~US$ 0,0308; duas: ~US$ 0,0616.
- Pior caso interno com fallback: ~US$ 0,3094.

## Ressalvas registradas

- **Retries internos:** qualquer retry/fallback do pipeline conta contra a margem
  de US$ 0,5993 e não será coberto por ampliação automática.
- **Restrição superior:** o v13 tem apenas **5% superiores**. A faixa entre 5% e
  15% não é protegida; a pendência do ativo no topo pode persistir.
- A redação do v13 diz que as faixas são “exclusivas para fundo”, mas o parágrafo
  seguinte permite produto/embalagem/complementos avançarem nas faixas. A matriz
  avaliará a redação literal; não haverá ajuste no meio da rodada.

## Submissão 1 — Produto embalado + fundo ambientado

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
| Arquivo de produto | upload `9ffd4412-1a5b-4963-8432-82811f430659` |

## Submissão 2 — Forma/proporção diferente + cenário original

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

## Procedimento

1. Confirmar o build v13 na aplicação.
2. Submeter **uma** campanha por vez, manualmente.
3. Registrar a campanha/operação e avaliar antes de autorizar a segunda.
4. Não repetir automaticamente, não ajustar o prompt no meio da matriz e não
   ampliar o teto.
5. Usar a identidade vigente da loja; confirmar o arquivo/hash do produto antes
   da submissão.
6. Se o produto de origem não estiver acessível ou o hash divergir, parar.

## Avaliação por campanha

Registrar separadamente:

- qualidade visual e aceitação do responsável;
- fidelidade do produto e do ativo;
- nome, preço, condições e textos obrigatórios;
- legibilidade e hierarquia;
- faixa superior de 5% e faixa inferior de 20%;
- adequação ao fundo escolhido;
- entrega, miniatura, download, crédito e custo observado.

O parecer consolidado deve separar qualidade estética de cumprimento técnico.
