# 59-10 — Gates técnicos restantes da F59

Data: 2026-11-06. Escopo: consolidar os aceites manuais já registrados e validar os
gates técnicos restantes da F59 — flag OFF, recuperação/resolução, idempotência e
concorrência — **sem chamada paga, sem alteração de flag, saldo, banco ou Storage**.
Prompt, políticas, ativo, modelos, qualidades e pipeline permanecem congelados.

Regra aplicada em toda a matriz: **teste com mock não aprova gate de integração**.
Cada linha declara a natureza da evidência (mock, cliente falso estrito, banco real
isolado, leitura real em homolog ou teste manual).

## 1. Aceites manuais consolidados

Registrados em `59-10-FINAL-ACCEPTANCE.md` e mantidos sem alteração:

| Item | Resultado |
|---|---|
| Bolo Naked Fruit v14 | Composição aprovada; preço correto; aviso ilustrativo adequado. Exceção aceita: validade na faixa inferior. |
| Pão de Queijo Mineiro 500gr v14 | Composição aprovada; separador decimal único; informações legíveis. |
| Pão Francês “Fresquinho” v14 | Composição aprovada; “garanti” é erro de entrada confirmado. |
| Pão Francês 1:1 | Evidência manual positiva do fluxo quadrado. |
| **Saldo insuficiente** | **Confirmado pelo responsável:** a falha retorna à tela de dados com os campos e o formato preservados. |

O aceite é específico das artes apresentadas; não representa cumprimento integral das
margens. A proteção da validade no prompt permanece. O erro “garanti” não é falha de
geração e a arte não está pronta para publicação com ele.

### Suporte de código ao teste manual de saldo insuficiente

- `src/components/flow/use-campaign-form.ts` mantém `campaignFormat` no estado e no
  rascunho de `sessionStorage` (`scopedDraftKey`), inclusive restauração 9:16.
- `src/__tests__/concurrency.test.ts` prova a resposta 402 com “Saldo insuficiente”
  (mock de reserva), sem chamada de provider vencedora dupla.
- O teste manual do responsável confirma o comportamento observado na UI; ele é
  evidência de fluxo, não de integração real de banco.

## 2. Suítes executadas nesta etapa (ambiente local, sem escrita externa)

| Grupo | Arquivos | Testes | Natureza | Resultado |
|---|---|---|---|---|
| Flag, restauração e formato | 6 | 144 | Mock de flag/Supabase; estado React | **PASS** |
| Recuperação/resolução (simulada) | 7 | 74 | Cliente falso estrito / RPC simulada | **PASS** |
| Download vertical e 1:1 | 1 | 27 | Supabase/Storage mockados | **PASS** |
| Concorrência de rota (saldo) | 1 | 2 | `reserve_credit` mockado | **PASS** |
| Pasta vertical completa | 19 | 238 | Contratos + recuperação com cliente falso | **PASS** |
| Pasta Produto 1:1 local | 50 | 958 | Contratos/rotas; 13 suítes de integração excluídas | **PASS** |
| `typecheck` | — | — | `tsc --noEmit` | **exit 0** |
| `lint` | — | — | `eslint .` | **exit 0** |
| `build` | — | — | `next build` | **exit 0 — 96 páginas** |
| OpenSpec `--strict` | — | — | change F59 | **valid** |
| `git diff --check` | — | — | working tree | **limpo** |

Observação operacional: o `next build` inicial ficou bloqueado porque o `next start`
(porta 3000) mantinha arquivos de `.next` abertos no Windows. O servidor foi parado,
o build concluiu com `exit 0` em 96 páginas e o `next start` foi reiniciado e
verificado escutando em `127.0.0.1:3000`.

Arquivos do grupo “flag”: `feature-flag-service.test.ts`, `nova-format-paused.test.tsx`,
`generate-image/route.test.ts`, `use-campaign-form-restore-format.test.ts`,
`restore-fidelity.test.ts`, `campaign-list-format.test.ts`.

Arquivos do grupo “recuperação”: `recovery.integration.test.ts` (vertical),
`artifact-recovery.contract.test.ts`, `image-recovery-format.test.ts`,
`refunded-recovery.test.tsx`, `copy-recovery-driving.test.tsx`,
`campaign-detail-page.test.tsx`, `campaign-detail-format.test.tsx`.

> O nome `recovery.integration.test.ts` não implica banco real: ele usa cliente falso
> e projeção mockada. O mesmo vale para `artifact-recovery.contract.test.ts`
> (cliente estrito real + RPC simulada).

## 3. Suítes de integração real — não executadas

O runner recusa executar sem ambiente e imprime **GATE NÃO EXECUTADO — NÃO APROVADO**:

| Categoria | Arquivos | Pré-requisito ausente | Situação |
|---|---|---|---|
| Produto 1:1 isolado | 15 | `F562A_ISOLATED_*` (API `127.0.0.1:56321`, DB `56322`) | não executado |
| PostgreSQL/local-disposable | 5 | `TEST_DATABASE_URL` loopback + `POSTGRES_LOCAL_ALLOW_WRITES=1` | não executado |
| PostgreSQL/homolog F57.2 | 3 | alvo `57782` + fingerprint do ledger | não executado (não pertence à F59) |
| PostgreSQL/f50-4 | 1 (2 arquivos na categoria) | `F50_4_DB_URL` + opt-in | não executado |

Verificado por `npm run test:gates` e por `Get-NetTCPConnection`: não há instância
isolada escutando em `56321/56322`. Existe apenas o homolog em `57782` e o app em
`3000`.

Arquivos reais de maior interesse para a F59 (todos em
`integration.product-1-1`): `atomic-attempt.integration.test.ts`,
`concurrent-route-submission.integration.test.ts`,
`pending-resolution.integration.test.ts`, `copy-recovery.integration.test.ts`,
`local-pilot-recovery.integration.test.ts`, `failure-closure.integration.test.ts`,
`credit-delivery.integration.test.ts`, `publication-fence.integration.test.ts`,
`persisted-campaign.integration.test.ts`, `recovery-seams.integration.test.ts`.

Idempotência/concorrência SQL de crédito (`credit-idempotency.test.ts`,
`credit-concurrency.test.ts`) também são **PostgreSQL real** e não rodaram.

## 4. Evidência real de leitura no homolog

Somente leitura, sobre o ambiente `vendeo-homolog` (`127.0.0.1:57782`), loja de teste
`48b212f8-2b0f-4679-b553-122a601bacac` (`is_test_store = t`).

| Verificação | Evidência real |
|---|---|
| Flag global | `product_9_16_enabled = true`, atualizada em 2026-11-05 21:53:59 UTC. |
| Seed da flag | `20261105162052_f59_product_9_16_flag.sql`: somente `INSERT ... ON CONFLICT DO NOTHING`, `enabled = false`; nenhum schema/RPC/grant. |
| Campanhas v14 | Bolo, Pão de Queijo e Pão Francês com `status = ready` e path `product-9-16/.../art-1080x1920.jpg`. |
| Snapshot 9:16 | `campaignFormat = "9:16"` + `formatContractVersion = "f59-vertical-9-16-v1"` nas três. |
| Snapshot 1:1 | Pão Francês 1:1 **sem** as duas chaves (snapshot byte-compatível). |
| Arte (bytes reais) | Três JPEG `1080x1920`, `srgb`; Pão Francês 1:1 JPEG `1024x1024`. |
| Miniatura (bytes reais) | Três WebP `162x288`; 1:1 WebP `288x288`. |
| Metadados de artefato | Linhas com `width=1080`, `height=1920`, `mime_type=image/jpeg`; 1:1 com `1024x1024`. |
| Crédito | Quatro operações `amount = 1`, `status = delivered`. |
| Custo | Copy + imagem registrados por campanha (US$ 0,000175–0,031704). |
| Claims | Quatro operações com tentativa `primary` `status = done`. |
| Telemetria | `generation_events` com `format=9:16`, `requestedSize=1152x2048`, `returnedSize=1152x2048`, `outcome=success`. |
| Falha com estorno | Duas operações antigas (2026-11-05) com campanha `error`, `product_1_1_generation_outcomes.outcome = failed` e crédito `refunded` com `refund_tx_id`. |
| Operações pendentes | **Nenhuma** pendente/unknown no homolog; não há estado existente para recuperar sem fabricar dados. |
| Saldo/orçamento | Saldo **0** créditos; teto US$ 2,20; gasto US$ 2,0882; margem US$ 0,1118. |

As duas falhas com estorno são evidência histórica real de fechamento confirmado com
estorno único, mas **não** substituem a execução do gate de recuperação/resolução.

## 5. Matriz final por requisito

Legenda: **PASS** = evidência suficiente para o recorte declarado; **PARCIAL** = há
prova simulada ou de leitura, mas falta a execução real; **PENDENTE** = não executado;
**N/A** = fora do recorte.

| # | Requisito / cenário | Evidência | Resultado | Pendência |
|---|---|---|---|---|
| 1 | Flag OFF bloqueia nova geração 9:16 antes de reserva/provider | `route.test.ts` (flag mockada): 503 `format_unavailable`, sem campanha/reserva/provider; erro de leitura falha fechado | **PASS (simulado)** | Execução real com flag OFF |
| 2 | Flag OFF não bloqueia consulta/download/recuperação/detalhe/listagem de campanha existente | Download não consulta a flag (teste estrutural + código); detalhe/lista não consultam a flag; reenvio 9:16 com flag OFF segue no motor vertical sem criar campanha | **PARCIAL** | Ciclo real OFF em homolog |
| 3 | Geração em andamento não é abortada pela flag | — | **PENDENTE** | Exige geração em voo + mudança de flag |
| 4 | Rascunho vertical restaurado não troca silenciosamente para 1:1 com flag OFF | `nova-format-paused.test.tsx` e `use-campaign-form-restore-format.test.ts` | **PASS (simulado)** | Verificação manual da UI |
| 5 | Flag única, global, fail-closed | `feature-flag-service.test.ts`; leitura real `true`; migration data-only | **PASS** | — |
| 6 | Administração da flag auditada por RPC com motivo | Código/painel existentes; migration não altera RPC | **PASS (estrutural)** | Ciclo real de mudança |
| 7 | Reenvio idempotente: mesma identidade não cria campanha/reserva/provider | `route.test.ts`: reenvio 9:16 retorna 200, sem `createCampaign`; reenvio 1:1 idem | **PASS (simulado)** | `atomic-attempt` real isolado |
| 8 | Conteúdo/formato divergente para a mesma identidade ⇒ 409 | `route.test.ts`: 409 `operation_identity_conflict` nos dois sentidos | **PASS (simulado)** | Integração real |
| 9 | Duas submissões concorrentes não cobram duas vezes | `concurrency.test.ts` (mock): 200 + 402; suíte real de crédito/concorrência não executada | **PARCIAL** | `concurrent-route-submission` + `credit-concurrency` reais |
| 10 | Recuperação usa sonda vertical e rejeita 1024×1024 em path vertical | `recovery.integration.test.ts` e `artifact-recovery.contract.test.ts` (cliente falso) | **PASS (simulado)** | `pending-resolution` real isolado |
| 11 | Recuperação/resolução projeta vertical em detalhe/listagem sem nova geração | `recovery.integration.test.ts` (projeção mockada) | **PASS (simulado)** | Integração real até detalhe/lista |
| 12 | Operação estornada permanece fechada; resultado tardio não reabre | Teste de contrato + duas linhas reais `refunded` no homolog | **PARCIAL** | Execução real de resolução |
| 13 | 1 crédito por entrega; estorno único; unknown não estorna | Quatro entregas reais com 1 crédito; duas falhas reais estornadas | **PASS (entrega)** | Cenário `unknown` real |
| 14 | Download vertical 1080×1920 e bloqueio de arte inválida | `campaign-download.test.ts` (mock) + bytes reais 1080×1920 no Storage | **PARCIAL** | Download HTTP manual autenticado |
| 15 | Miniatura vertical 162×288 reconhecida por lista/dashboard | Bytes reais WebP 162×288; `campaign-list-format.test.ts` | **PASS (dados + simulado)** | UI manual da lista |
| 16 | Detalhe/listagem exibem campanha vertical sem path 1:1 | `campaign-detail-format.test.tsx`; linhas reais `ready` com path vertical | **PARCIAL** | UI manual de detalhe/lista |
| 17 | Regressão 1:1 (payload, arte, path, crédito, download, miniatura) | 958 testes locais 1:1 verdes; entrega real 1024×1024, `art-1024.jpg`, miniatura 288×288 | **PASS (local + real)** | Download HTTP manual |
| 18 | Telemetria identifica formato/dimensões sem dados sensíveis | `generation_events` reais com 9:16 e 1152×2048; contratos de telemetria verdes | **PASS** | — |
| 19 | Aceite em homolog, loja de teste, sem produção | `is_test_store = t`; docker `vendeo-homolog`; nenhuma escrita nesta etapa | **PASS** | — |
| 20 | Produção é gate separado, não executado | — | **N/A (por desenho)** | Documento de produção futuro |

## 6. Procedimento mínimo para autorização

Nenhuma das ações abaixo foi executada. Todas alteram estado e exigem autorização
específica. Nenhuma usa crédito, provider ou produção.

### A. Gate real de idempotência/concorrência/recuperação (recomendado)

1. Subir a instância isolada descartável já suportada pelo repositório
   (`scripts/run-f56-2b1b-isolated-integration.ps1`, API `56321` / DB `56322`).
   Efeito: cria um stack Docker isolado, aplica o schema e o destrói ao final; não
   toca homolog nem produção.
2. Executar `npm.cmd run test:integration:product-1-1` (15 arquivos).
3. Registrar o resultado por arquivo, incluindo `atomic-attempt`,
   `concurrent-route-submission`, `pending-resolution`, `copy-recovery`,
   `failure-closure`, `credit-delivery` e `publication-fence`.
4. Critério de aprovação: 15/15 arquivos verdes, sem skip, e nenhum resíduo no
   ambiente isolado.

### B. Gate SQL de crédito (idempotência/concorrência)

1. Subir um PostgreSQL descartável em loopback (porta diferente de `57782`).
2. Aplicar as migrations e definir `TEST_DATABASE_URL` + `POSTGRES_LOCAL_ALLOW_WRITES=1`.
3. Executar `npm.cmd run test:integration:postgres:local` (5 arquivos).
4. Critério: 5/5 verdes e cleanup sem fixtures (`f50-*`, `f572test-*`).

### C. Ciclo de flag OFF em homolog

1. Registrar o estado atual (`product_9_16_enabled = true`) e o motivo.
2. Desligar via `admin_update_feature_flag` com motivo auditado.
3. Sem gerar nada: abrir detalhe, listagem, miniatura e download das campanhas v14;
   abrir restauração de um rascunho vertical; tentar uma submissão 9:16 e confirmar
   503 antes de reserva/provider.
4. Religar a flag com motivo auditado e confirmar o estado anterior.
5. Critério: nenhuma campanha existente perde acesso; nenhuma cobrança; log de
   auditoria com as duas mudanças.

Risco: a flag é global; durante a janela, novas gerações verticais ficam bloqueadas.
Com saldo 0 e nenhuma geração em voo, não há risco de abortar operação em andamento.

### D. Recuperação/resolução real

Não existe operação pendente/unknown no homolog. Para exercitar o caminho real sem
fabricar estado, usar o ambiente isolado da opção A. No homolog, a única alternativa
seria provocar uma falha paga — **não autorizada e não recomendada**.

## 7. Parecer

- **Aceite visual:** aprovado com ressalvas específicas, já registrado.
- **Gates técnicos:** flag OFF, recuperação/resolução, idempotência e concorrência
  têm **cobertura simulada verde**, mas **não estão aprovados como integração real**.
- **Fase F59:** permanece **PENDENTE**.
- **Próximo gate recomendado:** opção A (isolado) para idempotência/concorrência/
  recuperação; em seguida, com autorização, opção C (ciclo real de flag OFF).
- **Sem** geração paga, crédito, migration, alteração de flag, push, deploy ou
  produção nesta etapa. Ajustes de identificação de formato na listagem e direção de
  fundo na revisão ficam para quick posterior.
