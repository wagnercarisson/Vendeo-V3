---
quick_id: 261124-pmo
status: implementation-complete-pending-manual-review
date: 2026-11-24
branch: feat/entrega-campanha-quadrada
base: 4c795c17
commit: 2f205590
scope: square-release-ledger
---

# Quick 261124-pmo — Summary

## Correções pós-revisão (2026-11-24)

- **Pré-condição:** cobrança nova agora exige `nineSixteenVerticalAccess`
  (origem `two_stage_9_16`, crédito vertical `delivered`, vertical integral)
  antes do débito; falha/indeterminação não cobra. Liberação já paga retorna
  antes do probe e continua recuperável.
- **Chip:** o formato da ação é definido pela origem (campanha 9:16 ⇒ 1:1),
  independentemente do estado; `unknown/incompatible` abrem consulta/explicação
  e nunca oferecem confirmação de compra.
- **GET recuperando `delivered`:** conclui a jornada uma única vez por sessão,
  respeitando sessão/descarte de resposta obsoleta; POST continua concluindo
  uma única vez.
- **Releitura financeira:** `read_failed` após `saldo_insuficiente` permanece
  `unknown`; somente ausência comprovada (`none`) vira insuficiência.
- **Validador F62:** corrigido separadamente, removendo o shebang do módulo
  importado pelo Vitest (commit `af00a814`), sem excluir ou enfraquecer testes.

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
| Testes afetados amplos (44 arquivos) | 491/491 PASS |
| Testes novos/focados (7 arquivos) | 109/109 PASS |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (porta 3100 parada antes; reiniciada depois) |
| `git diff --check` | exit 0 |
| Suíte global | 874 arquivos PASS + 2 skipped; 10.857 testes PASS + 10 skipped; **exit 0** |

### Validador F62

A falha preexistente `f62-authorization.test.mjs` foi corrigida separadamente
pelo commit `af00a814`, removendo apenas o shebang do módulo importado
(`scripts/verify/f62-authorization.mjs`). A suíte e as verificações foram
preservadas: **9/9 PASS**.


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
