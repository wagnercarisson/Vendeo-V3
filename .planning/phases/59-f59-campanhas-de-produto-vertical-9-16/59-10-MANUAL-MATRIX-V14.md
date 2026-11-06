# 59-10 — Próximo teste manual (matriz v14)

## Estado após a submissão 1

- Campanha avaliada: `f5a0a1db-6cfa-4329-b25e-2d3c8e1a54df` / operação
  `4f7b21d7-9ef8-464f-a9d7-781d79c0c893` (v13).
- Composição aprovada; paleta coerente; topo de 5% mantido.
- Defeito confirmado: vírgula duplicada no preço.
- Detalhes em `59-10-HOMOLOG-RESULT-6.md`.

## Versão do próximo teste

- Compositor: `f59-vertical-9-16-composer-v14`.
- Formato: `f59-9-16-v12`.
- Safe area: `safe-area-9-16-experimental-v3` (5% topo + 20% base).
- O v13 permanece como referência; o v14 é derivado com diferença restrita à
  regra monetária.
- Prompt completo e hash em `261106-f59-price-format/SUMMARY.md`
  (2.785 caracteres; SHA-256 `d54f7a74…`).

## Submissão 2 — Pão Caseiro + Original

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

Usar a identidade vigente da loja (assinatura ativa e paleta atual), não a
identidade histórica da campanha de origem.

## Limites

- Créditos disponíveis: **4**.
- Teto do piloto: **US$ 2,20**; gasto **US$ 1,7114**; margem **US$ 0,4886**.
- Esta submissão consome **1 crédito**; sem concessão de crédito.
- Sem ampliação automática do teto. Retries/fallback internos contam na margem.
- Se a margem não cobrir a chamada, parar e pedir autorização.

## Procedimento

1. Confirmar o build v14 na aplicação.
2. Submeter **uma** campanha manualmente.
3. Registrar campanha/operação e avaliar.
4. Não repetir automaticamente e não ajustar o prompt no meio da rodada.

## Avaliação

Registrar separadamente: qualidade visual/aceitação; fidelidade produto/ativo;
nome, preço, condições e textos obrigatórios; legibilidade/hierarquia; faixas de
5% e 20%; adequação ao fundo; entrega, miniatura, download, crédito e custo.
