---
phase: 62-adicionar-vertical-campanha-quadrada
plan: 08
subsystem: release-readiness
tags: [f62, vertical-9-16, local-homolog, acceptance, performance, vellora, f60.4, release-pending]

requires:
  - phase: 62-adicionar-vertical-campanha-quadrada
    provides: 62-01 a 62-07 executados e aceitos local/offline
provides:
  - migration F62 aplicada e conferida somente na homologação local
  - provas PostgreSQL reais 12/12 e concorrência real com duas sessões
  - provas reais de Storage, probe, HTTP, detalhe e download
  - página vertical 9:16 funcional com transporte Node HTTP
  - aceite visual/funcional da jornada Vellora e desempenho aprovado
  - gate F60.4 fechado por correção test-only da allowlist
  - suíte global verde e OpenSpec 71/71

affects: []

key-files:
  created:
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-ACCEPTANCE.md
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-08-SUMMARY.md
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-08-ALLOWLIST-AUTHORIZATION.md
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-09-PERF-DIAGNOSIS.md
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-GSD-UAT.md
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-OPSX-VERIFY.md
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-CLOSURE-REPORT.md
  modified:
    - src/lib/campaign/square-base/__tests__/regression.contract.test.ts
    - openspec/changes/adicionar-vertical-campanha-quadrada/tasks.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - docs/operations/f62-release-checklist.md
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-MIGRATION-AUTHORIZATION.md

key-decisions:
  - "A jornada Vellora é a nova geração avaliada visualmente; o aceite anterior da Jarra permanece como evidência do artefato já entregue."
  - "O gate F60.4 foi fechado por correção test-only limitada aos cinco caminhos do transporte, sem alterar PHASE_BASE_SHA/PROTECTED_PATHS/CONTRACT_PATHS/controle positivo."
  - "A lentidão de 2–3,7 s no dev era serialização de Buffers raw do sharp pela instrumentação do React; em produção o documento cai para ~54 KB decodificados."
  - "P1–P3 são melhorias opcionais, não bloqueantes, e não foram implementadas."
  - "O aceite é local/homologação local; publicação, deploy, merge, push, sync/archive e migration remota permanecem não autorizados."

requirements-completed: [ADD-ELIG-01, ADD-OP-02, ADD-LINK-03, ADD-BRIDGE-04, ADD-ECON-05, ADD-ORCH-06, ADD-DELIV-07, ADD-FAIL-08, ADD-GATE-09, ADD-READ-10, ADD-SUPPORT-11, FMT-ADD-12, PAGE-ADD-13, LIST-ADD-14, DASH-ADD-15, DL-ADD-16, COMP-ADD-17, CREDIT-ADD-18, ORCH916-ADD-19, CTRL916-ADD-20, FLAG-ADD-21]

duration: ~2 dias (2026-11-23/24)
completed: 2026-11-24
---

# F62-08 — Consolidação, aceite local, Vellora e gates finais

**Status:** **CONCLUÍDA E ACEITA LOCALMENTE; SPECS SINCRONIZADAS; CHANGE
ARQUIVADA; PUBLICAÇÃO REMOTA PENDENTE.**
**Data:** 2026-11-24.
**Branch:** `feat/campaign-add-vertical` — HEAD de referência `783a5ce4`.
**Campanha da nova jornada:** Chaleira Elétrica Vellora —
`682dafa2-8b98-4ddf-aef8-88a9e37aefbc`.
**Campanha da evidência anterior:** Jarra Finesse 1l —
`c06b16f5-f126-429c-b5b0-9567fe4adb95`.

---

## 1. O que foi executado

| Frente | Evidência | Resultado |
|---|---|---|
| Migration F62 | `62-08-MIGRATION-APPLY.md` | aplicada **somente** na homologação local; ledger 157→158; hash inicial `61c72719…` |
| Correção de integração | `62-08-F62-INTEGRATION-FIX.md` | ponte reutiliza `provider_generation`; RPC aceita `delivered_campaign_reuse`; hash atual `56dc3423…`; RPC reaplicada seletivamente |
| Provas PostgreSQL | `62-08-DB-PROOFS.md` | **12/12 PASS**, incluindo concorrência real com duas sessões; cleanup bloqueado por guards |
| Provas Storage/download | `62-08-STORAGE-PROOFS.md` | persistência, integridade, probe, HTTP, detalhe e download **PASS** |
| Página vertical e transporte | `62-08-VERTICAL-TRANSPORT-UX.md` | 9:16 1080×1920 visível; 1:1 1024×1024; download 309.682 B / SHA `843cee99…`; sem stack overflow |
| UX da modal | `62-08-VERTICAL-TRANSPORT-UX.md` | spinner acessível; Cancelar/Escape/clique fora bloqueados em POST/processing; recuperação em falha/unknown |
| Diagnóstico de desempenho | `62-09-PERF-DIAGNOSIS.md` | causa dev-only comprovada; comparação dev x produção local |
| Gate F60.4 | `62-08-ALLOWLIST-AUTHORIZATION.md` | correção **test-only** da allowlist; guard **8/8 PASS**; suíte global verde |
| Nova jornada Vellora | `62-ACCEPTANCE.md` / `62-GSD-UAT.md` | geração 1:1 → download → 9:16 → modal → entrega → download → alternância; ambos publicáveis |
| OpenSpec verify | `62-OPSX-VERIFY.md` | **71/71 tasks**; 21 requisitos / 143 cenários; sem CRITICAL |

## 2. Nova jornada aprovada — Vellora

### 2.1 Declaração visual/funcional do responsável

O responsável validou em produção local a campanha **Chaleira Elétrica Vellora**
(`682dafa2-8b98-4ddf-aef8-88a9e37aefbc`) na jornada: geração **1:1** →
download → expansão **9:16** → modal com spinner e **Cancelar desabilitado** →
entrega → download → alternância. **Ambas as artes foram consideradas
publicáveis** e o **desempenho foi aprovado**. Não foram fornecidas medições
separadas da Vellora; nenhuma foi inventada.

### 2.2 Verificações técnicas do revisor

- operações **original e adicional `delivered`**;
- expansão com **uma única dedução de 1 crédito**, saldo **6→5**, **sem
  estorno**;
- **referência principal preservada no quadrado**;
- **bytes, dimensões e checksums dos três artefatos** conferem;
- **ponte byte-idêntica** ao quadrado entregue;
- **56 arquivos / 861 testes PASS**; typecheck, lint e OpenSpec válidos;
- migration final **SHA-256
  `56dc3423c9be5d7363bd663a694a7e20f9bb9faed3569eb3e1c9574a76b9272a`**.

### 2.3 Evidência anterior do executor

O aceite anterior da **Jarra** cobria o artefato vertical já entregue
(1080×1920, 309.682 B, SHA `843cee99…`, download e alternância). Naquele
momento **não havia uma nova geração por IA para avaliar**; a Vellora é a nova
geração posteriormente avaliada e considerada publicável. As duas afirmações
coexistem e o histórico não foi apagado.

## 3. Desempenho (produção local)

| Métrica | Resultado |
|---|---:|
| Primeira abertura 9:16 — navegação | **517 ms** |
| Primeira abertura 9:16 — imagem carregada | **400 ms** |
| Aquecido 1:1 → 9:16 — clique→imagem | mediana **214 ms**; máx **221 ms** (n=6) |
| Aquecido 9:16 → 1:1 — clique→imagem | mediana **116 ms**; máx **128 ms** (n=5) |
| Documento 1:1 | 13.908 B comprimidos / **54.056 B decodificados** |
| Documento 9:16 | 14.001 B comprimidos / **54.729 B decodificados** |
| `GET /format-additions` (delivered) | **48–71 ms** (mediana 55 ms), 67 B |

No dev os mesmos documentos tinham 11,5 MB/33,2 MB por serialização de Buffers
raw do `sharp` pela instrumentação do React (dev-only). O responsável aprovou o
desempenho; a Vellora não teve medições separadas registradas.

## 4. Gates finais desta rodada

| Gate | Resultado |
|---|---|
| Guard F60.4 (`regression.contract.test.ts`) | **8/8 PASS** |
| Testes dirigidos F62/composition-artifacts | **35 arquivos / 460 testes PASS** |
| `npm run typecheck` | **0** |
| `npm run lint` | **0** |
| Suíte global | **867 arquivos / 10.805 testes PASS + 2 arquivos/10 skipped; 0 falhas** |
| `npx openspec validate --changes --strict` | **1/0** |
| OpenSpec tasks | **71/71** |
| OpenSpec sync/archive | **11/11 capabilities strict**; change arquivada; **no active changes** |
| Build de produção | **0** (evidência anterior; não reexecutado com 3100 ativo) |
| `git diff --check` (worktree) | **0** |
| `git diff --check 241815fa..HEAD` (range F62) | **0** |
| `git diff --check 55276323..HEAD` (base F60.4) | **2 (preexistente)** — whitespace em artefatos antigos fora da F62; não alterado |

A falha intermitente `store-identity-form.direction-pending` **não reapareceu**
na suíte global final; ela havia passado em isolamento e foi classificada como
flake concorrente. A falha determinística do F60.4 foi corrigida pela allowlist
test-only e não reapareceu.

O runner global marca os gates de banco opt-in como **NÃO EXECUTADO**; as provas
PostgreSQL/Storage da F62 permanecem evidências separadas (`62-08-DB-PROOFS.md` e
`62-08-STORAGE-PROOFS.md`). Nenhuma migration corretiva foi criada e o ledger não
foi alterado nesta rodada.

## 5. Fechamento do gate F60.4

A correção autorizada adicionou **somente** os cinco caminhos do transporte a
`AUTHORIZED_CONTRACT_CHANGES`:

- `composition-artifacts/node-http-download.ts`
- `composition-artifacts/retrieve.ts`
- `composition-artifacts/storage.ts`
- `composition-artifacts/__tests__/node-http-download.contract.test.ts`
- `composition-artifacts/__tests__/retrieve.contract.test.ts`

`PHASE_BASE_SHA`, `PROTECTED_PATHS`, `CONTRACT_PATHS`, o controle positivo e as
demais asserções permaneceram intactos. Nenhum diretório inteiro foi liberado.
O guard passou 8/8 e a suíte global ficou verde.

## 6. P1–P3 — opcionais, não bloqueantes

Não implementados:

- **P1:** no 9:16, sondar a vertical primeiro e usar o quadrado só como fallback.
- **P2:** uma única transição após a entrega (`replace` ou `refresh`).
- **P3:** não revalidar a fonte no GET de adição já `delivered`.

## 7. Ressalvas preservadas

1. Migration aplicada **somente na homologação local**; produção/remoto não
   aplicados. O hash atual é `56dc3423…`; a aplicação local inicial usou
   `61c72719…` e somente a RPC foi reaplicada após a correção.
2. **4 conjuntos de fixtures F62 de Storage** permanecem identificados; cleanup
   bloqueado por guards intencionais.
3. A nova geração **Vellora** foi avaliada e considerada publicável; a Jarra
   permanece como evidência do artefato já entregue. Nenhuma nova chamada paga
   foi executada nesta rodada.
4. es-419, legado 1024, saldo zero, estorno/replay e rollback da flag não foram
   reexercitados manualmente nesta aceitação; permanecem cobertos por testes
   offline/DB quando aplicável.
5. Sync/archive, aplicação remota da migration, merge, push, deploy, ativação de
   flag e publicação dependem de **autorização separada**.
6. P1–P3 são opcionais e não bloqueantes.

## 8. Sequência de encerramento

**Sync/archive concluídos em 2026-11-24:** 11 delta specs sincronizadas e change
arquivada em `openspec/changes/archive/2026-11-24-adicionar-vertical-campanha-quadrada/`;
o sync não foi repetido no arquivamento.

1. Teste manual na instância `http://localhost:3100` (página em 9:16).
2. Encerrar a instância 3100 após o teste.
3. Autorização separada para o gate remoto da migration (preflight do alvo,
   confirmação de que a F62 ainda não foi aplicada, backup/restore-list e
   ledger).
4. Autorização separada para merge, push e deploy.
5. Decisão sobre P1–P3 (opcionais) somente após o encerramento acima.

Nenhuma geração paga foi repetida; nenhum banco, Storage, flag ou configuração
foi alterado nesta rodada.
