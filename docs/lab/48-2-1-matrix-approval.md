# F48.2.1 — Aprovação da Matriz de Cenários e do Diagnóstico (Checkpoint 1)

> Artefato canônico do **Checkpoint humano 1** (D11): aprovação da matriz representativa
> de nove cenários e do diagnóstico v1 das evidências da F37, **antes** de qualquer
> execução paga. O ato de registrar (este documento) é automatizado; a decisão é humana
> (Task 7) e o registro da decisão é a Task 8.
>
> Nenhuma execução paga ocorreu até aqui. Nenhum prompt oficial foi alterado.

## Versões sob aprovação

| Campo | Valor |
|---|---|
| `matrix_version` | `matrix-v1` |
| `diagnosticVersion` | `1` |
| `contentHash` | `647d424a37b6f894430ac72831020911f750d5b4134be2a9e71692f37727fdab` |

O diagnóstico v1 vive em `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v1.json`
e referencia os três prompts do Diretor (`campaign-image-director-offer`,
`-spotlight`, `-exclusive`), com ao menos um item não tratável por prompt (encaminhado
para outra mudança).

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

## Diagnóstico v1 — cadeia por falha

Cada item registra **falha → evidência → causa provável → tratável por prompt? → hipótese mínima**
e referencia o prompt do Diretor correspondente. Itens com `promptTreatable: false`
registram o encaminhamento para outra mudança e não geram candidata de prompt.

## Decisão pendente

A decisão do Checkpoint 1 é humana e será registrada na Task 8 após a decisão da Task 7.
Resultado esperado: `aprovada`, `ajustes solicitados` ou `interrompida`, com autor e
timestamp; quando aprovada, os valores de `matrix_version`, `diagnosticVersion` e
`contentHash` acima ficam ratificados.

- **Resultado:** _(pendente — Checkpoint 1)_
- **Autor:** _(pendente)_
- **Timestamp:** _(pendente)_
