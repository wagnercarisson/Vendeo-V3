---
quick_id: 261124-pmo
status: implementation-complete-pending-manual-review
date: 2026-11-24
branch: feat/entrega-campanha-quadrada
base: 4c795c17
commit: 89ea46a3
scope: square-release-ledger
---

# Quick 261124-pmo — Summary

## Resultado

Implementada a liberação paga do **quadrado 1:1 já armazenado** de uma campanha
entregue em 9:16, usando **exatamente 1 crédito** no ledger existente como
comprovante durável.

- Sem migration, tabela, RPC, flag ou segredo novo.
- Sem geração, transformação, cópia ou upload de imagem.
- Vertical, copy, snapshot, `campaigns.storage_path` e operação primária
  intactos.
- `9:16` permanece o formato padrão; o quadrado fica selecionável por
  `?format=1:1` após a liberação.

## Implementação

- `src/lib/campaign/square-release/`
  - identidade canônica, chave `square_release:v1:<sha256>` e metadados;
  - validação fechada da dedução (`-1`, campanha, chave e metadados);
  - leitura unitária e em lote (4 consultas constantes, sem Storage por card);
  - `releaseSquare` com pré-voo de arte, dedução única e releitura após
    `NULL`/`23505`/transporte incerto, sem segunda reserva;
  - preview validado por `retrieveCompositionArtifact`.
- `src/app/api/campaign/[id]/square-release/route.ts`
  - GET read-only e POST com `requireSameOrigin` + auth + ownership +
    revalidação server-side; sem token/segredo novo.
- `src/components/campaign/release-square-dialog.tsx`
  - consulta (“Verificando disponibilidade…”), confirmação com custo 1,
    processamento (“Estamos disponibilizando o formato quadrado.”), spinner,
    bloqueio de fechamento durante o POST e estados refunded/unknown/
    unavailable/incompatible.
- Chips:
  - `actionFormat` permite a ação no chip `1:1`;
  - apresentação recebe o estado da liberação sem inventar entrega.
- Download:
  - `?format=1:1` em campanha 9:16 exige dedução válida, ausência de estorno e
    arte `square_original` integral; serve os bytes existentes;
  - `?format=9:16` e ausência preservam o vertical.
- Detalhe:
  - lê o estado da liberação; seleciona o quadrado em `?format=1:1`; mantém o
    vertical por padrão; oferece links para alternar após a liberação.
- Lista/dashboard:
  - leitura em lote do estado; sem N+1, sem Storage e sem binário por card.
- Extrato:
  - dedução com `metadata.kind='square_release'` rotulada “Liberação do formato
    1:1”; `reason` permanece NULL porque `reserve_credit` não o recebe.

## Gates

| Gate | Resultado |
|---|---|
| Testes afetados amplos (44 arquivos) | 485/485 PASS |
| Testes novos/focados (9 arquivos) | 112/112 PASS |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (porta 3100 parada antes; reiniciada depois) |
| `git diff --check` | exit 0 |
| Suíte global | 873 arquivos PASS + 2 skipped + **1 suíte preexistente falhando**; 10.842 testes PASS + 10 skipped |

### Falha preexistente da suíte global

`scripts/verify/__tests__/f62-authorization.test.mjs` falha com `SyntaxError`
porque o módulo importado `scripts/verify/f62-authorization.mjs` começa com
shebang (`#!/usr/bin/env node`) e o Vitest 4 não o remove no transform. O arquivo
**não foi modificado por esta quick** (`git diff` vazio). Prova de controle:
removendo temporariamente apenas a primeira linha, o arquivo passa **9/9**; a
linha foi restaurada. Não tratei isso como alteração de escopo.

Os gates de integração PostgreSQL/homolog/local-disposable não foram executados
por este runner global (mensagem padrão de gate não executado); a prova de
concorrência/recuperação do ledger já foi feita nesta quick em stack descartável
e está em `evidence/ledger-proof-results.json` (46/46).

## Teste manual local

1. Servidor local em `http://127.0.0.1:3100` (reiniciado após o build).
2. Abrir uma campanha **9:16 já entregue** com `square_original` armazenado.
3. Clicar no chip **Quadrado 1:1** → “Liberar quadrado 1:1”.
4. Confirmar o custo de 1 crédito e observar “Estamos disponibilizando o formato
   quadrado.” com spinner; Cancelar/Escape/clique fora bloqueados.
5. Conferir **um único débito de 1 crédito** no extrato, com o rótulo
   “Liberação do formato 1:1”.
6. Alternar `?format=1:1` / `?format=9:16`, baixar ambos e reabrir a campanha:
   não deve haver nova cobrança.
7. Repetir o clique/refresh: deve recuperar a mesma dedução, sem novo débito.

## Limitações

- Teste manual completo ainda pendente.
- Nenhuma geração paga, provider, banco compartilhado, Storage compartilhado,
  migration, merge, push ou deploy.
- A falha da suíte global é preexistente e documentada acima.
