---
quick_id: 261124-pmo
status: implementation-complete-pending-manual-review
date: 2026-11-24
branch: feat/entrega-campanha-quadrada
base: 4c795c17
commit: d1a1d2ab
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

## Correção do 500 na seleção e textos (2026-11-24)

- **Causa tratada:** a página executava `nineSixteenVerticalAccess` antes de
  resolver o formato solicitado e sem o transporte Node HTTP. Para
  `?format=1:1` já pago, o vertical era baixado/validado sem necessidade.
- **Correção:** o formato solicitado é resolvido primeiro; quadrado pago usa
  `readSquareReleasePreview` (transporte Node HTTP) e **não chama** o vertical.
  O caminho vertical/default injeta o mesmo transporte no probe existente.
  Falha de preview do quadrado não cai para o vertical como se fosse quadrado;
  a compra permanece e o download fica recuperável.
- **Textos:** UI passou a usar “Gerar formato quadrado”, “Você pode gerar o
  formato quadrado 1:1 para esta campanha.”, “Clique para gerar o formato
  quadrado. Custo: 1 crédito.”, “Gerar formato quadrado” e “Estamos preparando
  sua campanha no formato quadrado.” (pt-BR), com equivalente es-419. Removidas
  as referências a “já armazenado” e “liberar” na comunicação.
- **Evidência real:** campanha `b953eb33-...`, instância `http://localhost:3000`
  (porta 3000, processo 15880), sessão autenticada local. Página `?format=1:1`,
  `?format=9:16` e sem formato: 200; imagem quadrada 1024×1024 visível e vertical
  1080×1920 preservado; alternância por clique e carga direta; download 1:1
  221.094 B/SHA-256 `eeeb0a5c...`; vertical 392.707 B/SHA-256 `fd1f6afc...`;
  chips “Quadrado 1:1: Disponível” no detalhe/lista/dashboard; sem 5xx,
  exceções ou loads falhos no console/rede.
- **Financeiro:** antes e depois, 2 deduções (vertical + liberação), 0 refunds,
  soma -2; nenhuma nova cobrança/estorno.
- **Limitação:** o 500 relatado **não foi reproduzido** no build local antes da
  correção — a página respondeu 200. O caminho vertical desnecessário foi
  confirmado por código/teste (a regressão exige zero chamadas ao vertical no
  quadrado pago) e removido. Não foi feito POST de compra.

Evidências: `evidence/real-validation.json`, `evidence/01-real-9x16.png`,
`evidence/02-real-1x1.png`, `evidence/03-real-direct-1x1.png`.

## Aceite funcional declarado (instância 3001)

Em 2026-11-24 o responsável declarou **aceite funcional na instância local
3001**. Este registro é declarativo: o agente não reexecutou a validação nessa
instância nesta etapa. O ajuste posterior é apenas o rótulo visual do extrato
(“Geração 1:1” / “Generación 1:1”), sem mudança de metadados, classificação,
valor, idempotência ou histórico financeiro.

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
  - dedução com `metadata.kind='square_release'` rotulada **“Geração 1:1”**
    (pt-BR) / **“Generación 1:1”** (es-419);
  - metadados, classificação interna (`deduction`), valor, idempotência e
    histórico financeiro preservados;
  - `reason` permanece NULL porque `reserve_credit` não o recebe.

## Gates

| Gate | Resultado |
|---|---|
| Testes afetados amplos (45 arquivos) | 494/494 PASS |
| Testes novos/focados (9 arquivos) | 123/123 PASS |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (porta 3000 parada antes; reiniciada depois) |
| `git diff --check` | exit 0 |
| Suíte global | 875 arquivos PASS + 2 skipped; 10.860 testes PASS + 10 skipped; **exit 0** |
| Suíte global após o rótulo | 875 arquivos PASS + 2 skipped; 10.861 testes PASS + 10 skipped (1 teste novo es-419); **exit 0** |
| Guards de contrato F60.4/F60.7-10 | 13/13 PASS após o commit (antes falhavam só por `conta/page.tsx` não commitado) |
| Isolamento do teste instável `store-identity-form.direction-pending` | 16/16 PASS isolado; falha apenas sob carga da suíte completa em uma execução, sem relação com crédito/extrato |

> Nota: os guards F60.4/F60.7-10 inspecionam `git status` do working tree e
> sinalizaram a página de conta como UI alterada fora da allowlist. A alteração
> é a autorizada nesta tarefa (passar o locale ao extrato); nada foi
> enfraquecido nos guards. Com o commit, o working tree ficou limpo e ambos
> passaram.

> Nota: uma execução global intermediária falhou apenas em
> `store-identity-form.direction-pending` (`expected 1 to be greater than 1`,
> refetch de readiness sob carga). O arquivo passa 16/16 isolado e a execução
> global seguinte ficou verde; nenhum código foi alterado por causa disso.

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

1. Servidor local em `http://localhost:3000` (porta 3000, processo 15880;
   build de produção atual).
2. Abrir a campanha real **9:16 já entregue** com `square_original` armazenado.
3. Clicar no chip **Quadrado 1:1** → “Gerar formato quadrado”.
4. Confirmar o custo de 1 crédito e observar “Estamos preparando sua campanha no
   formato quadrado.” com spinner; Cancelar/Escape/clique fora bloqueados.
5. Conferir **um único débito de 1 crédito** no extrato, com o rótulo
   “Geração 1:1” (pt-BR) / “Generación 1:1” (es-419).
6. Alternar `?format=1:1` / `?format=9:16`, baixar ambos e reabrir a campanha:
   não deve haver nova cobrança.
7. Repetir o clique/refresh: deve recuperar a mesma dedução, sem novo débito.

## Limitações

- Teste manual completo ainda pendente.
- O 500 relatado não foi reproduzido no build local anterior; a remoção do
  caminho vertical desnecessário está coberta por teste e validada na página
  real após a correção.
- Nenhuma geração paga, provider, banco compartilhado, Storage compartilhado,
  migration, merge, push ou deploy.
- Os gates de integração PostgreSQL/homolog não foram executados pelo runner
  global; a prova de ledger em descartável permanece 46/46.
