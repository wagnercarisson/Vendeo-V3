# F48.2.1 Verification — Otimização dos Prompts do Diretor (bancada manual)

**Status:** **PASSED (FASE ENCERRADA)** — gates verdes (typecheck, lint, build, testes direcionados do laboratório/Planos 07/08); suíte completa com **exclusivamente** a exceção preexistente e comprovada da F50; isolamento de `prompts/` e das estruturas produtivas confirmado; UAT: **10 passos visuais confirmados pelo humano + passo 11 (regra de vitória consultiva) validado automaticamente** por contratos/testes; programa `860ca4fe-…` **`closed`** e experimento `c48e21b5-…` **`archived`**, com recusas confirmadas e histórico preservado; **nenhuma execução paga**.

**Fase:** 48.2.1 (otimizacao-prompts-diretor) — v1.5
**Plano:** `48-2-1-09` (onda 9) — **Tasks 1–5 concluídas** (verificação/UAT; decisão humana; encerramento operacional).
**Fonte da verdade:** `openspec/changes/fase-48-2-1-otimizacao-prompts-diretor/` (tasks C8–C10 / D1–D4; specs `lab-isolation`, `lab-prompt-optimization`).
**Escopo realinhado:** commit `017b8799` — bancada manual, **sem** execução paga, sem promoção, sem `db push` remoto, `prompts/` intocado.

---

## 1. Validação automática (C8)

Executada em 2026-09-27 (host local, Supabase Docker). Comandos invocados como `npm.cmd` (equivalente ao `npm` no PowerShell; o shim `npm` não é invocável em pipeline neste host).

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | ✅ **exit 0** |
| Lint | `npm.cmd run lint` | ✅ **exit 0** |
| Build (inclui `check:cnae`) | `npm.cmd run build` | ✅ **exit 0** — `check:cnae OK`; `Compiled successfully`; 68/68 páginas estáticas geradas |
| Testes direcionados F48.2.1/lab + Planos 07/08 | `npm.cmd test -- --run src/lib/lab "src/app/(app)/admin/laboratorio" src/app/api/admin/laboratorio src/lib/admin` | ✅ **exit 0** — `Test Files 52 passed (52)`; `Tests 1014 passed | 1 skipped (1015)` |
| Suíte completa | `npm.cmd test -- --run` | ⚠️ **exit 1** — exclusivamente a exceção preexistente da F50 (ver §2) |

### 1.1 Escopo dos testes direcionados

Os testes direcionados cobrem `src/lib/lab/**`, `src/app/(app)/admin/laboratorio/**`, `src/app/api/admin/laboratorio/**` e `src/lib/admin/**` — incluindo os arquivos modificados pelos Planos 07 (segurança financeira/revogação fail-closed) e 08 (orçamento visível/arquivamento seguro). Nenhuma falha; nenhuma rede a provider.

---

## 2. Suíte completa — exceção preexistente da F50 (fail-closed)

A suíte completa **não** retornou exit 0; retornou **exclusivamente** a exceção preexistente e comprovada da F50. Todas as condições mecânicas foram verificadas:

| # | Condição mecânica | Resultado |
|---|---|---|
| i | Exit code da suíte ≠ 0 | ✅ `exit 1` |
| ii | `Test Files  1 failed` (tolerante a espaços) | ✅ `Test Files 1 failed | 370 passed (371)` |
| iii | `Tests  1 failed` (tolerante a espaços) | ✅ `Tests 1 failed | 3964 passed | 1 skipped (3966)` |
| iv | Arquivo é `legal-document-versions.test.ts` | ✅ `FAIL src/lib/legal/__tests__/legal-document-versions.test.ts > F50 legal publication contract > keeps pending…` |
| v | Mensagem é `ENOENT` | ✅ `Error: ENOENT: no such file or directory, open '…'` |
| vi | Caminho ausente = antigo caminho ativo da F50 | ✅ `openspec\changes\fase-50-demonstracao-gratuita-e-validade-dos-creditos\legal-consolidated-pending\terms-of-service-v1-5.md` |
| vii | Nenhum teste da F48.2.1/laboratório falhou | ✅ nenhuma linha `FAIL` em `src/lib/lab`/`admin/laboratorio` |

**Conclusão:** o gate fail-closed passa com a exceção exata da F50 (1 arquivo / 1 teste), sem nenhuma falha do laboratório/F48.2.1.

### 2.1 Follow-up externo à F48.2.1 — teste F50 (não corrigido nesta fase)

- **Arquivo:** `src/lib/legal/__tests__/legal-document-versions.test.ts` — teste `"keeps pending consolidated documents outside public and the catalog"`.
- **Falha:** `ENOENT` ao abrir `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/terms-of-service-v1-5.md` (o diretório não existe; a change F50 foi arquivada).
- **Atribuição:** **não** causada pela F48.2.1; pertence à linha da F50.
- **Ação nesta fase:** **não corrigido** (fora de escopo). Registrado em `deferred-items.md` como follow-up externo.

> **Nota de robustez de data (test-only, autorizada):** durante a validação, um segundo conjunto de falhas preexistentes e **não relacionadas** foi detectado em `src/components/flow/__tests__/use-campaign-form-validity.test.ts` (3 testes que usavam `2026-09-25` como data futura, agora passada). Por autorização humana explícita, foi aplicado um ajuste **exclusivamente de teste** (congelamento de relógio no bloco `D2/D5`, espelhando o bloco `Q-P3U`) — **sem** alterar código produtivo. Detalhes em `deferred-items.md`; commit `test(48-2-1-09): freeze clock in D2/D5 validity block (date-robust, authorized)`. Com o ajuste, a suíte completa volta a conter **apenas** a exceção da F50.

---

## 3. Isolamento (C9)

### 3.1 `prompts/` intocado

- `git status --porcelain prompts/` → **vazio** (nenhum prompt produtivo alterado byte a byte).

### 3.2 Fronteira local (sem `db push` remoto)

- Nenhum `db push` remoto foi executado nesta fase; a migration dos Planos 07/08 foi aplicada apenas localmente (`npx supabase migration up`), preservando os registros locais.
- A migration da F48.2.1 **não** é aplicada no remoto nesta fase (F48.2.3 é a fatia de promoção/`db push`).

### 3.3 Allowlist das referências históricas do Revisor

Enumerados mecanicamente os arquivos que contêm `reviewer`/`campaign_image_review` em `src/lib/lab/**` e nas superfícies do laboratório. Resultado — **exatamente** os três arquivos preexistentes:

| Arquivo (allowlist) |
|---|
| `src/lib/lab/gateway/__tests__/lab-model-resolver.test.ts` |
| `src/lib/lab/gateway/__tests__/lab-gateway-harness.contract.test.ts` |
| `src/lib/lab/gateway/__tests__/lab-prompt-loader.test.ts` |

- **Arquivos adicionais:** nenhum (`extra` vazio).
- **Novas estruturas do Revisor:** nenhuma (sem modo `reviewer`, sem casos de revisão, sem API/UI do Revisor, sem `campaign_image_review` novo). As três referências históricas **não** são escopo implementado pela F48.2.1 (pertencem à F48.2.2).

### 3.4 Estruturas produtivas

- Nenhuma escrita do laboratório em `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `admin_audit_log` ou bucket `campaign-images`.
- As únicas referências do laboratório a `ai_model_catalog` são **leitura** (allowlist read-only): `src/lib/lab/domain/model-target.ts` e `src/lib/lab/api/experiment-queries.ts`.

---

## 4. Execução paga

- **Nenhuma chamada paga** foi executada para produzir esta verificação (gates usam fakes; nenhuma rede a provider).
- **Nenhum run**, nenhuma reserva/consumo de orçamento, nenhuma promoção.

---

## 5. Fronteiras (D3)

### 5.1 Fronteira local (F48.2.1)

- A migration da F48.2.1 é criada e testada **somente localmente** (`npx supabase migration up`; `npx supabase db lint` → exit 0, apenas warnings preexistentes). `db reset`/`db lint` conforme aplicável.
- **Nenhum `db push` remoto** nesta fase. A migration **não** é aplicada no remoto aqui.

### 5.2 Ausência de escopo do Revisor (F48.2.2)

- A F48.2.1 **não** introduz modo `reviewer`, casos de revisão, `campaign_image_review`, nem tabelas/API/UI do Revisor. As três referências históricas do Revisor são apenas allowlist preexistente (§3.3). Tudo o que é do Revisor pertence à **F48.2.2**.

### 5.3 Fronteira F48.2.3 × F48.6

- **F48.2.3 — Promoção, Canário e Prontidão da Aprovação:** promoção de prompts, canário e `db push` remoto ficam para essa mudança. **Nada disso ocorre na F48.2.1.**
- **F48.6 — homologação geral:** fora do escopo desta fase.
- **Nenhum prompt produtivo é alterado nesta fase** (`prompts/` intocado — §3.1).

---

## 6. Registro C10 — a primeira operação real paga é FUTURA

- A **primeira operação real paga** do laboratório ocorrerá **posteriormente**, em uma **sessão conduzida pelo usuário**, com um **novo programa** e **nova autorização humana explícita** registrada em `lab_prompt_programs` antes de qualquer chamada paga.
- O programa local atual (`860ca4fe-dc8b-4354-b94e-02f9e7b202c6`) **foi encerrado** (`status='closed'`), revogando a autorização vigente; e o experimento `c48e21b5-c7a8-4456-a0d6-a2b4040fc1e3` **foi arquivado** (`status='archived'`). `closed`/`archived` são **terminais** e não retornam; uma nova sessão exige criar e autorizar um **novo** programa.
- **Nenhum ciclo pago** de otimização é requisito de conclusão da F48.2.1.
- A **regra de vitória permanece consultiva** (`victory-rule.ts`): apenas indicativa; **não** decide aprovação, **não** dispara ciclos, **não** promove variantes e **não** substitui a decisão humana. O relatório consultivo por prompt é **opcional**.

---

## 7. UAT

O roteiro e o registro da UAT local da bancada (sem execução paga) estão em `48.2.1-UAT.md`.

---

## 8. Encerramento operacional (D1/D2) — evidências

**Autorização:** a Task 3 decidiu **`aprovar-encerramento`** (autor: humano; 2026-09-27T14:36:11Z), após a confirmação humana de **10 passos visuais** e a validação **automatizada** do passo 11 (regra de vitória consultiva) (`48.2.1-UAT.md`).

Executado localmente em 2026-09-27 usando as **capacidades dos Planos 07/08** — `closeProgram` (`src/lib/lab/domain/program-service.ts`) e `archiveExperiment` (`src/lib/lab/domain/experiment-service.ts`) — com um cliente admin local. **Sem** arquivo novo commitado; nenhuma chamada paga; nenhum `db push`.

### 8.1 Encerrar o programa `860ca4fe-dc8b-4354-b94e-02f9e7b202c6` (D1)

`closeProgram({ programId, actorId, client })` → `{ status: 'closed' }`.

| Campo | Antes | Depois | Preservado? |
|---|---|---|---|
| `status` | `authorized` | **`closed`** | transição terminal |
| `budget_usd` | `2.808` | `2.808` | ✅ inalterado |
| `budget_reserved_usd` | `0` | `0` | ✅ inalterado |
| `budget_consumed_usd` | `0` | `0` | ✅ inalterado |
| `budget_authorized_by` | `31edcaa1-4461-41da-af15-d3f3d1e2c9b6` | `31edcaa1-4461-41da-af15-d3f3d1e2c9b6` | ✅ inalterado |
| `budget_authorized_at` | `2026-09-25T22:10:57.741+00:00` | `2026-09-25T22:10:57.741+00:00` | ✅ inalterado |

**Recusa de novas reservas (antes de qualquer chamada paga):** probe da guarda server-side `lab_reserve_run` (o mesmo RPC usado pela rota de execução) com o experimento ainda `ready`:

- `rpc('lab_reserve_run', { … })` → `{ data: null, error: "program_not_authorized" }`.
- Nenhum run criado; nenhum orçamento reservado; nenhuma chamada paga. A recusa ocorre **antes** do `UPDATE budget_reserved_usd` e do `INSERT lab_runs`.

### 8.2 Arquivar o experimento `c48e21b5-c7a8-4456-a0d6-a2b4040fc1e3` (D2)

`archiveExperiment(experimentId, { actorId, client })` → `{ status: 'archived' }`.

| Campo | Antes | Depois | Preservado? |
|---|---|---|---|
| `status` | `ready` | **`archived`** | transição terminal |
| `campaign_intent` | `offer` | `offer` | ✅ inalterado |
| variantes | `2` | `2` | ✅ inalterado |
| cenários | `3` | `3` | ✅ inalterado |
| `lab_runs` | `0` | `0` | ✅ inalterado |
| avaliações (`lab_human_evaluations`) | `0` | `0` | ✅ inalterado |

**Recusa de novas execuções:** probe da guarda `lab_reserve_run` com o experimento `archived`:

- `rpc('lab_reserve_run', { … })` → `{ data: null, error: "experiment_not_ready" }`.
- Nenhum run criado; nenhuma chamada paga.

### 8.3 Resumo da evidência

- Programa `closed` (terminal) com histórico financeiro **preservado** (nenhum valor apagado ou zerado).
- Experimento `archived` (terminal) com histórico **preservado** (zero deletes; `lab_runs = 0`).
- Recusas confirmadas: `program_not_authorized` (programa encerrado) e `experiment_not_ready` (experimento arquivado) — ambas **antes** de qualquer chamada paga.
- **Nenhuma chamada paga; nenhum `db push`; `prompts/` intocado.**

---

## 9. Resumo do encerramento e fronteiras

- **Encerramento:** programa `860ca4fe-dc8b-4354-b94e-02f9e7b202c6` `status='closed'` (terminal; novas reservas recusadas com `program_not_authorized`) e experimento `c48e21b5-c7a8-4456-a0d6-a2b4040fc1e3` `status='archived'` (terminal; novas execuções recusadas com `experiment_not_ready`). Histórico financeiro e histórico do experimento **preservados**.
- **Fronteira F48.2.2 (Revisor):** fora de escopo — nenhuma estrutura do Revisor foi criada (§3.3).
- **Fronteira F48.2.3 (Promoção, Canário e Prontidão da Aprovação):** a promoção, o canário e o `db push` remoto pertencem à F48.2.3; **nada** disso ocorreu aqui.
- **Fronteira F48.6 (homologação geral):** fora do escopo desta fase.
- **Primeira operação real paga:** FUTURA, em sessão conduzida pelo usuário, com **novo programa** e **nova autorização humana** (§6).

---

## 10. Para o orquestrador aplicar (tracking)

> **Somente leitura/registro.** Esta task **não** editou `.planning/ROADMAP.md` nem `.planning/STATE.md` — a escrita de tracking é responsabilidade do **orquestrador**.

**Texto pretendido de status/posição:**

- **Fase `48.2.1` (Bancada Manual de Prompts do Diretor):** **CONCLUÍDA** (9 planos).
- **Planos `48-2-1-01` .. `48-2-1-09`:** todos concluídos.
  - `48-2-1-01` .. `48-2-1-05` — bancada (domínio/migration/API/UI/orçamento/isolamento).
  - `48-2-1-06` — **suplantado** (não concluído funcionalmente; resolução registrada em `48-2-1-06-SUMMARY.md`).
  - `48-2-1-07` — segurança financeira / revogação fail-closed.
  - `48-2-1-08` — orçamento visível / arquivamento seguro.
  - `48-2-1-09` — verificação / UAT / encerramento operacional.
- **Posição/continuidade:** a F48.2.1 encerra aqui. **Próxima ação imediata:** verificar, sincronizar e arquivar a change OpenSpec da F48.2.1 (`openspec-verify-change` → `openspec-sync-specs` → `openspec-archive-change`), pendente de confirmação humana. **Depois disso**, as experiências reais com prompts serão **sessões manuais** conduzidas pelo usuário e pelo assistente. A **F48.2.2** permanece uma change **separada** e deve ser revisada/realinhada humanamente antes de planejamento ou execução. A **F48.2.3** permanece **bloqueada** até existirem prompts efetivamente testados e aprovados para promoção. **Não** retomar o Plano `48-2-1-06`.

**Nota de realinhamento do ROADMAP (já aplicado):** o bloco **F48.2.1** do `.planning/ROADMAP.md` **já foi realinhado** ao novo escopo pelo orquestrador (confirmado — não há follow-up pendente). Descrição correta dos planos 07–09 preservada:

- **07** = segurança financeira / revogação fail-closed (`closed` terminal; reserva só com `status='authorized'`).
- **08** = orçamento visível / arquivamento seguro (`BudgetPanel` integrado; `archiveExperiment` + `PATCH` + UI).
- **09** = verificação / encerramento operacional.
- **07 e 08 são autônomos**; **09** contém o `checkpoint:decision` (encerramento operacional).

---

## 11. Preparação do arquivamento OpenSpec (D4) — **não executado**

> **Preparação apenas.** O arquivamento **NÃO** é executado automaticamente nesta fase; requer confirmação do usuário. **Não** houve verificação/sync/arquivamento da change nesta task.

Roteiro sugerido (executar manualmente, na ordem, quando autorizado):

1. **Verificar:** `/opsx-verify` — validar que a implementação corresponde aos artefatos da change (`openspec/changes/fase-48-2-1-otimizacao-prompts-diretor/`: specs `lab-isolation`, `lab-prompt-optimization`; tasks C8–C10/D1–D4).
2. **Sincronizar:** `/opsx-sync` — sincronizar os delta specs da change com as specs principais.
3. **Arquivar:** `/opsx-archive` — mover a change para o arquivo após a verificação e a sincronização.

**Explicitude:** sem promoção, sem canário e **sem `db push` remoto**; nenhum prompt produtivo é alterado; `prompts/` permanece intocado.

---

*Fase: 48.2.1-otimizacao-prompts-diretor — CONCLUÍDA. Plano 48-2-1-09 Tasks 1–5 executadas; programa `closed` e experimento `archived` com recusas confirmadas e histórico preservado; sem chamadas pagas, sem runs, sem promoção, sem `db push`.*
