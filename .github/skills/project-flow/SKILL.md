---
name: project-flow
description: Vendeo project workflow guide — detects current state across the combined OpenSpec + GSD workflow and outputs the exact next action with ready-to-use commands.
license: MIT
compatibility: Requires openspec CLI and git.
metadata:
  author: vendeo
  version: "1.0"
---

Detect where we are in the Vendeo feature workflow and output the exact next step with ready-to-use commands.

This skill covers the full 11-step loop: branch → OpenSpec artifacts → commit → GSD plan → execute → test → verify → sync → git close → archive → mesa limpa.

**Input**: No input required. Invoke at any point to get the next step. Optionally pass a change name to override auto-detection.

---

## Steps

### 1. Detect active change

Run:
```bash
openspec list --json
```

Find the most recently modified **non-archived** change (not under `openspec/changes/archive/`).

- If multiple non-archived changes exist → use **AskUserQuestion** to select one.
- If no active change exists → skip to **Output: STEP 0**.

Store as `CHANGE_NAME` (e.g., `phase-4-1-campaign-visual-renderer-preview`).

---

### 2. Detect current git branch

Run:
```bash
git branch --show-current
```

Store as `CURRENT_BRANCH`. Feature branch pattern: `feat/phase-*`.

---

### 3. Check OpenSpec artifact state

Run:
```bash
openspec status --change "<CHANGE_NAME>" --json
```

Parse:
- `schemaName`: workflow schema (e.g., `spec-driven`)
- `artifacts`: array of `{ id, status }` — status is `done`, `ready`, or `blocked`
- `isComplete`: boolean

---

### 4. Check GSD plan state

Derive the GSD phase directory from the change name:
- Pattern: `phase-4-1-slug` → directory `4.1-slug`
- Rule: strip `phase-` prefix, replace first `-` after major version with `.`
- Example: `phase-4-1-campaign-visual-renderer-preview` → `.planning/phases/4.1-campaign-visual-renderer-preview/`

Check for files in that directory:
- Any `*PLAN.md` file present? → `GSD_PLAN_EXISTS = true`
- Any `*SUMMARY*.md` file present? → `GSD_EXECUTED = true`

If the directory doesn't exist → `GSD_PLAN_EXISTS = false`, `GSD_EXECUTED = false`.

---

### 5. Check implementation state

Read `openspec/changes/<CHANGE_NAME>/proposal.md`.
Find the `## Impact` section. List the `src/` files mentioned.
Check if those files exist on disk (use `file_search` if needed).

- ≥ 50% of listed files exist → `IMPL_EXISTS = true`
- Otherwise → `IMPL_EXISTS = false`

Also check for `openspec/changes/<CHANGE_NAME>/VERIFICATION.md` → `VERIFIED = true/false`.

---

### 6. Extract commit metadata

From `openspec/changes/<CHANGE_NAME>/proposal.md`:
- Extract the first `##` heading or the text after `# ` as `TITLE`
- Extract phase number from change name: `phase-4-1-*` → `4.1` as `PHASE_NUM`

If `proposal.md` doesn't exist, derive `TITLE` from change name (replace `-` with spaces, title-case).

---

### 7. Determine step and output exact action

Use this decision tree in order:

---

#### STEP 0 — Mesa limpa, nova fase

**Condition:** No active change found, OR `CURRENT_BRANCH` is `main` or `develop` or `master`.

**Output:**
```
📋 STEP 0 — Iniciar nova fase

1. Criar branch de feature:
   git checkout -b feat/phase-X-Y-slug

2. Criar change no OpenSpec:
   openspec new change "phase-X-Y-slug"

3. Invocar:
   /openspec-new-change

Substitua X-Y-slug pelo identificador da fase (ex: 4-2-review-export).
```

---

#### STEP 1 — Artefatos OpenSpec em andamento

**Condition:** Feature branch exists, active change found, `isComplete: false`.

Detect the next artifact (first with `status: "ready"`):
- If it is `proposal` → use `/openspec-new-change`
- Any other artifact → use `/openspec-continue-change`

Count complete vs total: `DONE_COUNT` / `TOTAL_COUNT`.

**Output:**
```
📝 STEP 1 — Criar próximo artefato: <artifact-id>

Invocar: /openspec-[new|continue]-change

⚠️  Após criar: revise com agente externo e ajuste se necessário.
    Quando o artefato estiver aprovado → chame /project-flow para continuar.

Progresso OpenSpec: <DONE_COUNT>/<TOTAL_COUNT> artefatos completos
```

---

#### STEP 2 — Artefatos completos → commit + GSD plan

**Condition:** `isComplete: true`, `GSD_PLAN_EXISTS = false`.

**Output:**
```
✅ STEP 2 — OpenSpec completo. Commitar artefatos e criar plano GSD.

── Parte 1: commit dos artefatos ──────────────────────────────────
git add openspec/changes/<CHANGE_NAME>/
git commit -m "chore(openspec): phase <PHASE_NUM> artifacts — <TITLE>"

── Parte 2: invocar GSD plan com contexto OpenSpec ────────────────
Invoque /gsd-plan-phase <PHASE_NUM> com o seguinte prompt:

> "O planejamento técnico da Fase <PHASE_NUM> foi consolidado via OpenSpec.
>  O design e as tarefas estão em openspec/changes/<CHANGE_NAME>/.
>  Use /gsd-plan-phase <PHASE_NUM> lendo diretamente
>  openspec/changes/<CHANGE_NAME>/tasks.md.
>  Bloqueie o openspec-apply automático.
>  Importe as tarefas, valide o plano e prepare o ambiente
>  para execução controlada passo a passo."
```

---

#### STEP 3 — GSD plan existe, não executado

**Condition:** `GSD_PLAN_EXISTS = true`, `GSD_EXECUTED = false`.

**Output:**
```
🔧 STEP 3 — Executar fase.

Invocar: /gsd-execute-phase

O GSD irá executar os planos em:
  .planning/phases/<gsd-phase-dir>/

Execução é automática baseada nos planos gerados no step anterior.
```

---

#### STEP 4 — Execução concluída → validar

**Condition:** `GSD_EXECUTED = true`, `VERIFIED = false`.

**Output:**
```
🧪 STEP 4 — Validar implementação.

1. Rodar validações:
   npm run typecheck && npm run lint && npm run build

2. Se tudo passar → invocar:
   /openspec-verify-change
```

---

#### STEP 5 — Verificado → sincronizar specs

**Condition:** `VERIFIED = true`, main specs not yet synced.

Heuristic for "not synced": check if `openspec/specs/<capability>/spec.md` differs from the delta specs in the change, OR simply present this step after verify completes.

**Output:**
```
🔄 STEP 5 — Sincronizar specs principais.

Invocar: /openspec-sync-specs

Isso atualiza openspec/specs/ com os delta specs desta fase.
```

---

#### STEP 6 — Sincronizado → fechar fase

**Condition:** Sync done (STEP 5 confirmed), change not yet archived.

**Output:**
```
🚀 STEP 6 — Fechar fase e limpar branch.

── Commitar implementação ─────────────────────────────────────────
git add .
git commit -m "feat(phase-<PHASE_NUM>): <TITLE>"
git push origin <CURRENT_BRANCH>

── Arquivar OpenSpec ──────────────────────────────────────────────
Invocar: /openspec-archive-change

── Merge e limpeza (após merge aprovado) ─────────────────────────
git checkout main
git pull origin main
git branch -d <CURRENT_BRANCH>
```

---

#### STEP 7 — Mesa limpa

**Condition:** Active change was moved to `openspec/changes/archive/` (archived).

**Output:**
```
🎉 STEP 7 — Mesa limpa!

Fase <CHANGE_NAME> arquivada com sucesso.

Para iniciar a próxima fase → /project-flow
(irá detectar STEP 0 e guiar o início)
```

---

## Handling Ambiguous States

**GSD plan exists but OpenSpec artifacts incomplete:**
Report both states, show which is ahead, and ask the user which step to prioritize before proceeding.

**`.planning/phases/` match not found:**
Skip GSD state checks. Report: "GSD phase directory não encontrado — pode ser necessário criar manualmente com `/gsd-plan-phase <PHASE_NUM>`".

**On `main` with an active non-archived change:**
Warn: "Existe uma change ativa (`<CHANGE_NAME>`) mas você está na branch `main`. Verifique se a branch de feature foi deletada prematuramente."

---

## Commit Message Conventions

| Moment | Format |
|--------|--------|
| OpenSpec artifacts done | `chore(openspec): phase X.Y artifacts — <title>` |
| Implementation done | `feat(phase-X.Y): <title>` |
| Post-archive cleanup | Only if changes remain uncommitted |

`<title>` = first `##` heading from `proposal.md`, or formatted change name.

---

## Branch Naming Convention

`feat/phase-X-Y-slug`

Examples:
- `feat/phase-4-1-campaign-visual-renderer-preview`
- `feat/phase-5-1-review-export`
