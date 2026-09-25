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
| `diagnosticVersion` | `2` (substitui a v1 na próxima apresentação) |
| `contentHash` (v2) | `fb0b840a2d6720f4c863e91f7a0ad76a68b95b18caf8f3ff1181751b2b46b1ee` |

O diagnóstico v1 (`diagnosticVersion: 1`; `contentHash`
`647d424a37b6f894430ac72831020911f750d5b4134be2a9e71692f37727fdab`) permanece
**preservado byte a byte** em `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v1.json`
e continua carregável; a v2 vive em `f37-prompt-diagnostics.v2.json` e é a versão
corrente (`getDiagnosticsVersionUsed()` retorna `diagnosticVersion: 2`).

### Ajuste da v2 (rastreabilidade por item)

A v2 adiciona, por item: `kind` (`observed_failure` | `hypothesis` | `taxonomy`) e
`source` (`ref` + `section`). Itens sem evidência concreta foram **explicitamente
reclassificados** (hipótese/taxonomia) em vez de apresentados como falha observada.
`taxonomy` não é tratável por prompt. As fontes citadas são seções verificáveis de
`docs/alinhamento-fase-37-revisao-aprovacao-arte.md` (ex.: D37.2-R2 — Relatos
elegíveis).

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

## Diagnóstico v2 — cadeia por item, com rastreabilidade e `kind`

Cada item registra **falha → evidência → causa provável → tratável por prompt? → hipótese mínima**,
declara `kind` (`observed_failure` | `hypothesis` | `taxonomy`) e traz `source`
(`ref` + `section`) rastreável a uma seção específica da F37. Itens com
`promptTreatable: false` registram o encaminhamento para outra mudança e não geram
candidata de prompt; `taxonomy` nunca é tratável por prompt.

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

## Decisão pendente — reapresentação (matrix-v1 + diagnostic v2)

O par atualizado (`matrix_version: matrix-v1` + `diagnosticVersion: 2`) é reapresentado
para decisão humana. Nenhuma execução paga ocorre antes desta nova aprovação.

- **Resultado:** _(pendente — reapresentação do Checkpoint 1)_
- **Autor:** _(pendente)_
- **Timestamp:** _(pendente)_
