# F48.2.1 — Aprovação da Matriz de Cenários e do Diagnóstico (Checkpoint 1)

> Artefato canônico do **Checkpoint humano 1** (D11): aprovação da matriz representativa
> de nove cenários e do diagnóstico das evidências da F37, **antes** de qualquer
> execução paga. O ato de registrar (este documento) é automatizado; a decisão é humana
> (Task 7) e o registro da decisão é a Task 8.
>
> Nenhuma execução paga ocorreu até aqui. Nenhum prompt oficial foi alterado.

## Versões sob aprovação

| Campo | Valor |
|---|---|
| `matrix_version` | `matrix-v1` — **aprovada quanto à composição e cobertura** |
| `diagnosticVersion` | `3` (versão corrente) |
| `contentHash` (v3) | `1e1c7945cdf8d11844045020962fd00ab1d01d19f2e524a2cc2243a13eebd3bf` |

Histórico imutável preservado byte a byte:
`f37-prompt-diagnostics.v1.json` (`diagnosticVersion: 1`; `contentHash`
`647d424a37b6f894430ac72831020911f750d5b4134be2a9e71692f37727fdab`) e
`f37-prompt-diagnostics.v2.json` (`diagnosticVersion: 2`; `contentHash`
`fb0b840a2d6720f4c863e91f7a0ad76a68b95b18caf8f3ff1181751b2b46b1ee`). A v3 vive em
`f37-prompt-diagnostics.v3.json` e é a versão corrente
(`getDiagnosticsVersionUsed()` retorna `diagnosticVersion: 3`).

### Ajuste da v2 (rastreabilidade por item) — parcial

A v2 introduziu, por item, `kind` (`observed_failure` | `hypothesis` | `taxonomy`) e
`source` (`ref` + `section`). **Correção desta rodada:** a v2 manteve **quatro** itens
como `observed_failure` — `invented_information`, `product_deformation`, `logo_cropped`
e `illegible_text` — **sem evidência concreta de execução/UAT**. A fonte citada
(D37.2-R2 / §4) é uma **taxonomia de relatos elegíveis com exemplos hipotéticos**, e o
próprio documento registra que a IA **não lê a imagem** (o relato é aceito pela
declaração). Portanto a afirmação anterior de que "todos os itens sem evidência já
haviam sido reclassificados" estava **incorreta**.

### Ajuste da v3 (reclassificação sem evidência observada)

A v3 reclassifica os quatro itens para `kind: "hypothesis"` — conjecturas derivadas da
taxonomia, a validar no ciclo de otimização — e passa a ter **zero** itens
`observed_failure`. As duas categorias de composição/renderer permanecem `taxonomy` com
`promptTreatable: false`. Nenhuma ocorrência observada é afirmada sem evidência concreta.
As fontes citadas são seções verificáveis de
`docs/alinhamento-fase-37-revisao-aprovacao-arte.md` (D37.2-R2 / §4).

## Matriz de nove cenários (`matrix-v1`)

Todos `format: 1:1`, `locale: pt-BR`, `fictitious: true` e exatamente uma imagem `primary`.

| # | slug | intent | atributos representativos |
|---|---|---|---|
| 1 | `produto-oferta-preco` | offer | segmento distinto; preço promocional com preço original; múltiplas imagens de produto |
| 2 | `produto-oferta-texto-obrigatorio` | offer | textos obrigatórios; aviso ilustrativo; validade |
| 3 | `produto-oferta-logo` | offer | identidade com logo controlado; segmento distinto |
| 4 | `destaque-preco-promocional` | spotlight | preço promocional com preço original; múltiplas imagens; embalagem com textos e detalhes; ilegibilidade |
| 5 | `destaque-sem-preco-ambiente` | spotlight | ausência obrigatória de preço; fotografia contextual; nome longo; ausência de CTA e hook; invenção |
| 6 | `destaque-textos-legais` | spotlight | textos obrigatórios; aviso ilustrativo; validade; identidade textual; tom comercial incorreto |
| 7 | `exclusivo-logo-preco-unico` | exclusive | identidade com logo; preço único; embalagem com detalhes; ilegibilidade |
| 8 | `exclusivo-produto-isolado` | exclusive | produto a ser isolado; múltiplas imagens; ausência de CTA e hook; deformação |
| 9 | `exclusivo-estresse-identidade` | exclusive | identidade textual; nome longo; invenção; perda de identidade; tom comercial incorreto |

A distribuição de atributos é travada por
`src/lib/lab/scenarios/__tests__/lab-scenarios-matrix.contract.test.ts`, que falha se
um atributo obrigatório ficar descoberto.

## Diagnóstico v3 — cadeia por item, com rastreabilidade e `kind`

Cada item registra **falha → evidência → causa provável → tratável por prompt? → hipótese mínima**,
declara `kind` (`observed_failure` | `hypothesis` | `taxonomy`) e traz `source`
(`ref` + `section`) rastreável a uma seção específica da F37. Itens com
`promptTreatable: false` registram o encaminhamento para outra mudança e não geram
candidata de prompt; `taxonomy` nunca é tratável por prompt. A v3 não contém nenhum
`observed_failure`: só há hipóteses (derivadas da taxonomia) e taxonomias de composição.

## Decisão registrada — 1ª apresentação do Checkpoint 1

- **Resultado:** `ajustes solicitados` (matriz `matrix-v1` aprovada quanto à composição
  e cobertura; diagnóstico v1 enviado para ajuste de rastreabilidade)
- **Autor:** humano (decisor do Checkpoint 1)
- **Timestamp:** `2026-09-25T17:03:00.000Z`
- **Programa liberado?** Não. Nenhuma execução paga ocorreu e nenhuma está liberada.

**Itens pendentes que motivaram o ajuste (implementados na v2):**

1. Rastreabilidade **por item** — associar cada evidência a uma fonte/seção específica.
2. Distinguir **falha observada** de **hipótese/taxonomia** (campo `kind`).
3. Itens sem evidência concreta **removidos ou explicitamente reclassificados**.

## Decisão registrada — 2ª apresentação do Checkpoint 1

- **Resultado:** `ajustes solicitados` (matriz `matrix-v1` **ainda aprovada**; diagnóstico
  v2 enviado para ajuste semântico — quatro itens marcados como `observed_failure` sem
  evidência concreta de execução/UAT)
- **Autor:** humano (decisor do Checkpoint 1)
- **Timestamp:** `2026-09-25T17:09:00.000Z`
- **Programa liberado?** Não. Nenhuma execução paga ocorreu e nenhuma está liberada.

**Itens pendentes que motivaram o ajuste (implementados na v3):**

1. Citar evidência concreta de execução/UAT **ou** reclassificar os quatro itens
   (`invented_information`, `product_deformation`, `logo_cropped`, `illegible_text`).
   Determinação: **não existe** evidência observada (a fonte é uma taxonomia de relatos
   elegíveis com exemplos hipotéticos; a IA não lê a imagem) → reclassificados para
   `hypothesis`.
2. Criar `diagnosticVersion: 3`, preservando v1 e v2 byte a byte.
3. Corrigir a afirmação incorreta de que todos os itens sem evidência já haviam sido
   reclassificados.

## Decisão registrada — reapresentação final do Checkpoint 1 (`aprovada`)

- **Resultado:** `aprovada` — matriz `matrix-v1` + diagnóstico `diagnosticVersion: 3`
  aprovados para prosseguir ao Checkpoint 2 (orçamento)
- **Autor:** humano (decisor do Checkpoint 1)
- **Timestamp:** `2026-09-25T17:12:00.000Z`
- **Ratificado:**
  - `matrix_version`: `matrix-v1`
  - `diagnosticVersion`: `3`
  - `contentHash`: `1e1c7945cdf8d11844045020962fd00ab1d01d19f2e524a2cc2243a13eebd3bf`
- **Programa liberado para execução paga?** Não nesta task. A aprovação do Checkpoint 1
  apenas habilita o **Checkpoint 2 (autorização de orçamento)**. Nenhuma execução paga
  ocorre antes da autorização de orçamento; nenhum prompt oficial foi alterado.
