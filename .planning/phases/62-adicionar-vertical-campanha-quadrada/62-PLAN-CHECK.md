# F62 — Plan Check (pré-execução, rodada 4)

**Veredito final:** `PASS WITH FINDINGS`

**Fase:** `62-adicionar-vertical-campanha-quadrada`
**Data da revisão:** 2026-11-22
**Fonte técnica:** `openspec/changes/adicionar-vertical-campanha-quadrada/`
**Artefatos revisados:** `62-CONTEXT.md`, `62-COVERAGE-MATRIX.md`, `62-01-PLAN.md` a `62-08-PLAN.md`.
**Escopo:** verificação estática de planos. Nenhum código, migration, banco, Storage, provider, flag, homolog ou produção foi acessado. Nenhuma suíte foi executada. Nenhum merge/push/deploy/sync/archive foi realizado. A única escrita desta revisão foi este relatório.

**Baseline verificado (somente leitura):**

- Branch `feat/campaign-add-vertical`; HEAD `241815fa831ceb6db85fbc8747a9599c83fb66bc`.
- `git status --porcelain`: `.planning/ROADMAP.md` e `.planning/STATE.md` modificados; `.planning/phases/62-adicionar-vertical-campanha-quadrada/` e `openspec/changes/adicionar-vertical-campanha-quadrada/` não rastreados — esperado e preexistente.
- `git diff --check` limpo.
- `npx openspec validate --changes --strict` → `1 passed, 0 failed`.
- Nenhum plano ou código foi editado.

---

## 1. Resumo executivo

**M-D fechado nos gates que decidem execução.** As tasks automáticas de 62-07 (`:77,87,97,107`) e todas as tasks de 62-08 (`:85,95,105,115,125,135,145,155`) deixaram de usar `rg`/`Select-String` como verificação principal e passaram a usar `Get-Content` + `if (...) { throw ... }`, que falha com exit code não-zero quando a seção/valor obrigatório está ausente. As ações de 62-08 Task 2 (`:103`) e Task 4 (`:133`) exigem falha explícita em divergência de ledger/hash/schema/contagem e de `providerCalls`/custo/artefato. Os checkpoints humanos antes da migration (`:89-97`) e da prova paga (`:119-127`) continuam presentes e agora também usam `if/throw` no verify.

**Resíduo LOW:** o verify auxiliar do checkpoint humano de 62-07 Task 5 (`:117`) ainda usa `Select-String` para o checklist de release; como o gate real é a revisão humana e o comando também executa `git status`/OpenSpec, o impacto é baixo.

**Estrutura:** 8 planos, 8 waves, **37 tasks** (34 `auto` + 3 `checkpoint:human-verify`), **9 Review Stops**, **21/21 IDs**. Nada regrediu nas correções anteriores.

**Contagem final:** 0 BLOCKER, 0 HIGH, 0 MEDIUM, 5 LOW, 3 INFO.

---

## 2. M-D — verificação completa de 62-07 e 62-08

### 2.1 62-07

| Task | Verify atual | Falha não-zero? | Observação |
|---|---|---|---|
| Task 1 — Runbook | `if ($t -notmatch ...) { throw }` em `:77` | **Sim** | Exige `não criar`, `idempot`, `unknown`, `refunded`, `delivered`, `source_origin`, `flag`. |
| Task 2 — Gates offline | `if ($t -notmatch ...) { throw }` em `:87` | **Sim** | Exige `typecheck`, `lint`, `build`, `vitest`, `openspec`, `diff --check`. |
| Task 3 — Pacote de migration | `if ($t -notmatch ...) { throw }` em `:97` | **Sim** | Exige `ledger`, `sha256`, `backup`, `restore`, `guards`, `não aplicar`, `autoriza`. |
| Task 4 — Checklist de release | `if ($t -notmatch ...) { throw }` em `:107` | **Sim** | Exige `versão`, `hash`, `ledger`, `schema`, `backup`, `declaração`, `conferência`, `rollback`. |
| Task 5 — Checkpoint humano | `git status --short; npx openspec ...; Get-Content ... | Select-String` em `:117` | **Parcial** | É `checkpoint:human-verify`; a revisão humana é o gate. O `Select-String` do checklist não falha non-zero — resíduo **L-E**. |

62-07 não executa migration, provider ou publicação. O Review Stop (`:155-157`) proíbe iniciar `62-08` sem autorização específica e revisão. Correto.

### 2.2 62-08

| Task | Verify atual | Falha não-zero? | Comparação exigida na ação? |
|---|---|---|---|
| Task 1 — Preflight | `if ($t -notmatch ...) { throw }` em `:85` | **Sim** | Sim, preflight compara com `62-MIGRATION-AUTHORIZATION.md` (`:83`). |
| Checkpoint — autorização da migration | `if ($t -notmatch 'AUTORIZADO') { throw }` + `ledger/sha256/backup` em `:95` | **Sim** | Sim; sem `AUTORIZADO`, não executa a Task 2 (`:93`). |
| Task 2 — Aplicação | `if ($t -notmatch ...) { throw }` em `:105` | **Sim** | Sim; `:103` exige falha se ledger/hash/schema/contagem divergirem. |
| Task 3 — DB proofs | `if ($t -notmatch ...) { throw }` em `:115` | **Sim** | Sim; `:113` exige antes/depois, IDs, hashes e parada em divergência. |
| Checkpoint — prova paga | `if ($t -notmatch 'PROVIDER_AUTORIZADO') { throw }` + `TETO/MAX_CALLS` em `:125` | **Sim** | Sim; sem autorização/teto, não executa a Task 4 (`:123`). |
| Task 4 — Provider proof | `if ($t -notmatch ...) { throw }` em `:135` | **Sim** | Sim; `:133` exige falha se `providerCalls`/custo/1080×1920/crédito/quadrado divergirem. |
| Task 5 — Visual | `if ($t -notmatch ...) { throw }` em `:145` | **Sim** | Sim; `:143` exige viewports, dispositivos e ressalvas humanas. |
| Task 6 — Release gate | `if ($t -notmatch ...) { throw }` em `:155` | **Sim** | Sim; `:153` confere versão/hash/ledger/schema e separa declaração×verificação. |

**Proibição de executar 62-08 agora:** confirmada em `62-08:53` (“Nenhuma etapa deste plano é executada no planejamento”), `:74` (“Sem autorização, parar antes da Task 1”), `:18-20` (`user_setup` com três autorizações separadas) e `:193-195` (Review Stop de release). O plano é `autonomous: false`.

**Nota sobre os `<verify>`:** os comandos agora falham non-zero quando a seção obrigatória falta. A comparação numérica de valores (hash/ledger/contagens/custo) é exigida pelas ações e pelos checkpoints, não por um valor esperado hardcoded no verify — o que é coerente, pois o hash/ledger só existe após a autoria/aplicação. O resíduo L-E é o único ponto em que o verify auxiliar de 62-07 ainda não falha non-zero.

---

## 3. Nada regrediu — findings anteriores

| Finding | Status atual | Evidência |
|---|---|---|
| **H-A** — GET resolve fonte e não persiste ponte | **RESOLVIDO** | `62-05:87` exige `resolveReusableSquareSource`/`validateDeliveredCampaignSource` com opt-in 1024, `deriveFormatAdditionEligibility` e proíbe ponte/reserva/geração no GET. |
| **H-B** — 62-03 justificado | **RESOLVIDO** | `62-03:62` mantém a “Nota de decomposição” para 5 tasks/14 arquivos. |
| **M-A** — chip + teste nas `<files>` | **RESOLVIDO** | `62-05:105` inclui `campaign-format-chips.tsx` e `campaign-format-chips.test.tsx`. |
| **M-B** — key link e `readFormatAddition` | **RESOLVIDO** | `62-05:39-42` e `62-05:97`. |
| **M-C** — `refunded`/`absent` e prioridade | **RESOLVIDO** | `62-03:141` prioriza `open`/`delivered`; `62-05:97` propaga/testa `refunded`; `62-CONTEXT:130` restringe `intent:"retry"` a `refunded`. |
| **M-D** — comparação/exit code | **RESOLVIDO (com L-E)** | Gates automáticos de 62-07/62-08 usam `if/throw`; ações de 62-08 exigem comparação; resíduo LOW no checkpoint humano de 62-07. |
| **M-E** — formas JSON canônicas | **RESOLVIDO** | `62-CONTEXT:100-103`. |
| **M-F** — DTO sem `operationId`/path/URL | **RESOLVIDO** | `62-05:87`; `62-CONTEXT:140`. |
| **H1** — `persist.ts` e opt-in 1024 | **RESOLVIDO** | `62-03:99-101`. |
| **H2** — chip em 62-05 | **RESOLVIDO** | `62-05:105`. |
| **H3** — checkpoints de migration/prova paga | **RESOLVIDO** | `62-08:89-97,119-127`. |
| **H4** — fonte/destino distintos | **RESOLVIDO** | `62-04:103`; chamada direta + regressão. |
| **H5/M1** — RPC/token/`request_id` | **RESOLVIDO** | `62-CONTEXT:88-140`; `62-05:87`. |
| **H6** — 62-04 4 tasks + Review Stop intermediário | **RESOLVIDO** | `62-04:66,119-121,176-178`. |
| **H7** — tracking | **RESOLVIDO (sem conclusão)** | `ROADMAP:1003-1005`; `STATE:41`. |
| **M2** — pilot gate | **RESOLVIDO** | `62-04:127`. |
| **M3** — prioridade de estado | **RESOLVIDO** | `62-03:141`. |
| **M4** — origem↔role | **RESOLVIDO** | `62-02:90`. |
| **M5** — verificação por texto | **RESOLVIDO nos gates, L-E no checkpoint** | Ver §2. |
| **M6** — `absent`/`refunded` | **RESOLVIDO** | `62-01:86`. |
| **M7** — caminho do teste de flags | **RESOLVIDO** | `62-02:12,122` usa `page.test.tsx`. |
| **M8** — frontmatter 07/08 | **RESOLVIDO** | `62-07:13`; `62-08:16`. |
| **L1–L5** | **RESOLVIDOS** | `62-01:96`; `62-06:78`; `62-07:75,95`; convenção de códigos em `62-07:75`. |

---

## 4. Estrutura, cobertura e Review Stops

| Plano | Tasks | Auto | Checkpoints | Wave | Depends | Review Stops |
|---|---:|---:|---:|---:|---|---:|
| 62-01 | 4 | 4 | 0 | 1 | — | 1 |
| 62-02 | 4 | 4 | 0 | 2 | 62-01 | 1 |
| 62-03 | 5 | 5 | 0 | 3 | 62-02 | 1 |
| 62-04 | 4 | 4 | 0 | 4 | 62-03 | 2 (intermediário + final) |
| 62-05 | 3 | 3 | 0 | 5 | 62-04 | 1 |
| 62-06 | 4 | 4 | 0 | 6 | 62-05 | 1 |
| 62-07 | 5 | 4 | 1 | 7 | 62-06 | 1 |
| 62-08 | 8 | 6 | 2 | 8 | 62-07 | 1 |

- **8 planos**, waves `1..8`, dependências acíclicas, sem referência futura.
- **37 tasks** (34 auto + 3 checkpoints), **9 Review Stops**.
- **21/21 IDs** no frontmatter e na matriz (`ADD-ELIG-01` … `FLAG-ADD-21`).
- **Review Stop intermediário do 62-04** presente em `62-04:119-121`, após abertura/financeiro.
- 62-03 e 62-04 mantêm notas de decomposição (`62-03:62`; `62-04:66`).

---

## 5. Confirmações de conteúdo

- **Economia congelada sem fallback:** `62-03:121` (leitores estáticos, retomadas sem reler o vigente, teste explícito de não fallback) e `62-04:113,127`; formas canônicas em `62-CONTEXT:100-103`.
- **Fonte/destino distintos:** `62-04:103` usa `source.operationId = source_registration_operation_id` e `preparedOperationId = operationId`; regressão de `runPreparationStep` preservada.
- **Legado 1024 sem crédito original:** `62-03:99-101`; `62-02:100` exige operação primária só para `new_flow_1_1` e não exige operação financeira no legado.
- **Saldo só na abertura:** `62-04:113`; `62-05:87`; `62-06:107`; `62-07:75`.
- **Replay/token:** `62-CONTEXT:114-130`; `62-05:87,97`; `intent:"retry"` só após `refunded`; replay antigo retorna terminal/falha fechada.
- **Flag dedicada:** `62-02:120` (`campaign_format_addition_enabled`, default false, `ALL_FEATURE_FLAG_KEYS`, painel existente); rollback restrito em `62-07:75`/`62-08`.
- **Suporte:** `62-07:75` (identificação read-only, reconciliação idempotente, sem crédito duplicado).
- **Separação offline / migration real / provas reais / visual:** 62-07 offline e pacote de autorização; 62-08 preflight, aplicação, DB proofs, provider, visual e release; checkpoints antes de migration e prova paga.
- **Release:** `62-07:105` e `62-08:153-155` conferem versão/hash/ledger/schema, flags, backup, evidências, rollback e separação declaração×verificação.
- **Tracking:** `ROADMAP:1003-1005` e `STATE:41` registram F62 planejada/em revisão, **sem conclusão**. O texto ainda referencia a rodada inicial `FAILED`; atualizar após este relatório é recomendável, sem declarar a fase concluída.
- **Escopo/execução:** nenhum arquivo de código/plano foi alterado; nenhum ambiente, banco, Storage, provider, flag ou migration foi tocado.

---

## 6. Findings remanescentes — todos LOW/INFO

### LOW

- **L-E — Verify auxiliar do checkpoint humano de 62-07 ainda usa `Select-String`.** `62-07:117` executa `Get-Content ... | Select-String` no checklist de release. O checkpoint é `human-verify` e a revisão humana é o gate; ainda assim, o trecho não falha non-zero se `hash`/`ledger`/`schema` faltarem. Trocar por `if ($t -notmatch ...) { throw }` alinharia o checkpoint ao restante da rodada.
- **L-A — `ArtifactOrigin` não nomeado na action de 62-03 Task 2.** `62-03:111` manda persistir `delivered_campaign_reuse`, mas não cita a extensão da união `ArtifactOrigin` (`src/lib/campaign/composition-artifacts/types.ts:13-16`). O arquivo está nas `<files>`; nomear evita erro de typecheck.
- **L-B — Checkpoint da prova paga aponta `<files>` e verify para arquivos diferentes.** `62-08:121` declara `62-08-PROVIDER-PROOF.md`, mas `:125` verifica `62-08-PREFLIGHT.md`. Alinhar o registro da autorização a um único arquivo (ou duplicar com o mesmo conteúdo).
- **L-C — Checklist de release não explicita a ordem migration → código.** `62-07:105` lista versão/hash/ledger/schema, mas não exige que a migration com o novo CHECK seja aplicada antes do deploy do código que grava `delivered_campaign_reuse` (risco em `openspec/.../design.md:240`).
- **L-D — 62-07 (5 tasks) e 62-08 (8 tasks) sem nota de decomposição.** São planos de documentação/gates; 62-08 é deliberadamente não executável agora. Uma nota curta como a de 62-03/62-04 evita a leitura de “plano grande demais”.

### INFO

- **INFO-1 — Verificação automatizada de valores.** Os `<verify>` de 62-08 agora falham non-zero na ausência das seções, mas a comparação numérica de hash/ledger/contagens/custo é exigida pelas ações/checkpoints, não por um valor hardcoded (que só existe após a autoria/aplicação). Isso é aceitável para gates reais desde que a evidência registre os valores e o checkpoint humano os confira.
- **INFO-2 — Verify da Task 3 de 62-05 não roda o teste do chip.** `62-05:109` executa dialog/format-addition/route; `campaign-format-chips.test.tsx` aparece na verificação do plano (`:133`), mas não na task que altera o componente. Incluir o teste na task reduz o risco local.
- **INFO-3 — Tracking desatualizado em relação às rodadas.** `ROADMAP:1005` e `STATE:41` ainda mencionam o plan-check inicial `FAILED`; a F62 está registrada sem conclusão, como exigido. Atualizar após este relatório é recomendável.

---

## 7. Recomendação final

**0 BLOCKER / 0 HIGH / 0 MEDIUM.** Os planos estão prontos para execução, com ressalvas LOW que não impedem `62-01`.

1. **Iniciar `62-01`** com o Review Stop previsto.
2. **Antes de `62-07`/`62-08`, opcionalmente:** corrigir L-E (checkpoint de 62-07), L-A (`ArtifactOrigin`), L-B (arquivo da autorização da prova paga), L-C (ordem migration → código) e L-D (notas de decomposição). Nenhum é bloqueante.
3. **Manter `62-08` não executável agora:** depende de autorização específica para migration, Storage/provider e validação visual; os checkpoints e o Review Stop já codificam essa proibição.
4. **Atualizar `ROADMAP.md`/`STATE.md`** após esta rodada para registrar o resultado e o próximo passo, sem declarar a fase concluída.

---

## 8. Evidência da revisão (somente leitura)

```text
git rev-parse --abbrev-ref HEAD  -> feat/campaign-add-vertical
git rev-parse HEAD               -> 241815fa831ceb6db85fbc8747a9599c83fb66bc
git status --porcelain           -> M .planning/ROADMAP.md
                                    M .planning/STATE.md
                                    ?? .planning/phases/62-adicionar-vertical-campanha-quadrada/
                                    ?? openspec/changes/adicionar-vertical-campanha-quadrada/
git diff --check                 -> limpo
npx openspec validate --changes --strict
                                 -> 1 passed, 0 failed
```

Contagem estática:

```text
62-01: 4 tasks (4 auto), 1 Review Stop, wave 1
62-02: 4 tasks (4 auto), 1 Review Stop, wave 2
62-03: 5 tasks (5 auto), 1 Review Stop, wave 3
62-04: 4 tasks (4 auto), 2 Review Stops, wave 4
62-05: 3 tasks (3 auto), 1 Review Stop, wave 5
62-06: 4 tasks (4 auto), 1 Review Stop, wave 6
62-07: 5 tasks (4 auto + 1 checkpoint), 1 Review Stop, wave 7
62-08: 8 tasks (6 auto + 2 checkpoints), 1 Review Stop, wave 8
Total: 37 tasks (34 auto + 3 checkpoints), 9 Review Stops, 21/21 IDs
```

Nenhuma migration foi criada ou aplicada; nenhum banco, Storage, provider, homolog ou produção foi acessado; nenhuma flag foi alterada; nenhum merge/push/deploy/sync/archive foi executado. Nenhuma suíte de testes foi executada; a análise é estática.
