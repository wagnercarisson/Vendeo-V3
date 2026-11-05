# Quick 261105-f59-format-selector — seletor não desaparece com a flag OFF

## Causa raiz

O seletor 1:1 / 9:16 não foi removido do código. Ele era montado apenas quando
`eligible && (verticalEnabled || campaignFormatPaused)`. Como a flag
`product_9_16_enabled` foi desligada após a submissão 1 reprovada, o controle
deixou de ser renderizado para um rascunho novo.

## Correção

- O seletor passa a ser montado sempre que a loja é elegível ao fluxo novo.
- Com a flag OFF e sem rascunho vertical restaurado:
  - `1:1` permanece selecionado e submetível;
  - `9:16` fica visível, porém desabilitado;
  - um aviso explica que o formato vertical está temporariamente indisponível.
- Com a flag ON, os dois formatos ficam habilitados.
- Rascunho vertical restaurado com a flag OFF mantém o comportamento anterior:
  seleção visível, envio pausado, sem troca silenciosa para 1:1.

## Arquivos

- `src/components/flow/campaign-format-selector.tsx`.
- `src/components/flow/campaign-input-form.tsx`.
- `src/components/flow/__tests__/campaign-format-selector.test.tsx`.
- `src/components/flow/__tests__/campaign-input-form.test.tsx`.
- `openspec/changes/fase-59-campanhas-produto-vertical-9-16/specs/product-vertical-format-selection/spec.md`.

## Verificação

| Gate | Resultado |
|---|---|
| Componentes do seletor/formulário | **2 arquivos / 11 testes passando** |
| `npm run typecheck` | exit 0 |
| OpenSpec `--strict` | valid |
| `git diff --check` | limpo |

## Estado para o teste manual

- O seletor permanece visível para lojas elegíveis.
- `product_9_16_enabled` foi temporariamente ligada para a geração manual.
- Desligar a flag imediatamente após a geração única.
- O runbook está em `59-10-MANUAL-GENERATION-V5.md`.
- Nenhuma chamada paga, push ou deploy foi executado.
