---
phase: 62-adicionar-vertical-campanha-quadrada
plan: 07
subsystem: release-readiness
tags: [support, runbook, offline-gates, migration-authorization, release-checklist, awaiting-review]

requires:
  - phase: 62-adicionar-vertical-campanha-quadrada
    provides: 62-06 aceito (lista/dashboard/download/pendência)
provides:
  - runbook de suporte da adição
  - evidência de gates offline sequenciais
  - pacote de autorização da migration (não aplicado)
  - checklist de release com separação declaração×conferência
affects: [62-07, 62-08]

key-files:
  created:
    - docs/operations/f62-addition-support-runbook.md
    - docs/operations/f62-release-checklist.md
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-OFFLINE-GATES.md
    - .planning/phases/62-adicionar-vertical-campanha-quadrada/62-MIGRATION-AUTHORIZATION.md

key-decisions:
  - "O runbook é read-only no diagnóstico e usa somente RPCs idempotentes da adição no encerramento."
  - "Gates offline reais foram executados sequencialmente; evidência não é prova de produção."
  - "O pacote de migration prepara autorização, mas NÃO a concede; migration permanece não aplicada."
  - "O checklist separa declaração de produção histórica da conferência técnica de versão/hash/ledger/schema."
  - "62-08 não foi iniciado."

requirements-completed: [ADD-ELIG-01, ADD-OP-02, ADD-LINK-03, ADD-BRIDGE-04, ADD-ECON-05, ADD-ORCH-06, ADD-DELIV-07, ADD-FAIL-08, ADD-GATE-09, ADD-READ-10, ADD-SUPPORT-11, FMT-ADD-12, PAGE-ADD-13, LIST-ADD-14, DASH-ADD-15, DL-ADD-16, COMP-ADD-17, CREDIT-ADD-18, ORCH916-ADD-19, CTRL916-ADD-20, FLAG-ADD-21]

duration: ~35 min
completed: 2026-11-23
---

# Phase 62 Plan 07 — suporte, gates offline e pacote de release

**Runbook seguro, evidência offline real, autorização de migration preparada (não concedida) e checklist com declaração separada**

> **Status: ACEITO TECNICAMENTE EM 2026-11-23 — LOCAL/OFFLINE.** O plano 62-07
> está concluído. O 62-08 **não foi iniciado**; somente um preflight read-only
> poderá ser autorizado após a escolha do ambiente. Migration, prova paga e
> produção continuam **não autorizadas**.

## Aceite final do revisor (2026-11-23)

- **Veredito:** `62-07` **aprovado tecnicamente, local/offline**; validador R1
  aprovado.
- **Reexecução do revisor:** **13 arquivos / 168 testes dirigidos PASS** e, na
  rodada final do R1, **9 testes do validador PASS**; OpenSpec strict, árvore e
  diff-check limpos.
- **Gates do executor (separados):** typecheck **0**, lint **0**, build
  **0 (102/102)**, global **864 arquivos + 2 skipped / 10.765 testes + 10
  skipped**, OpenSpec **1/0** e diff-check limpo.
- **Correção mecânica final:** `$host` substituído por `$f62ExpectedHost` nos
  dois verifies do 62-08, incluindo `--expected-host`.
- **Limitações preservadas:** tudo offline; sem PostgreSQL/Storage/provider,
  restore, validação visual ou autorização de aplicação/publicação.

## Performance

- **Tasks:** 4/4 documentais executadas; Task 5 é o Review Stop humano.
- **Files created:** 4 documentos.

## Commit

| Commit | Conteúdo |
|---|---|
| `546f3be8` | runbook, gates offline, pacote de migration e checklist de release |
| `9e519073` | reconciliação R3/R5/R6 e autorização estruturada do 62-08 |
| `4e4a959f` | ordem de release, segredo de confirmação e aceite 10/110 do 62-06 |
| `846d28e6` | plano: validação estruturada da autorização |
| `df55f040` | validador JSON offline + testes de recusa |
| `1bc8ae8d` | plano: janela atual + alvo esperado explícito |
| `be8684ce` | validador: janela e comparação por campo do ambiente |
| `263a0cac` | verify: `$f62ExpectedHost` no lugar de `$host` |

## Entregas

- **Runbook:** identifica adição por campanha/operação/request/artefato; distingue `open`, `processing`, `unknown`, `refunded`, `delivered` e falha definitiva; exige leitura e RPC idempotente; veda crédito manual, exclusão de vínculo, projeção em `campaigns.storage_path` e uso da flag compartilhada como rollback.
- **Gates offline:** typecheck 0; lint 0; build 0 (102/102); **13 arquivos / 168 testes dirigidos**; global **863 arquivos + 2 skipped / 10.756 testes + 10 skipped**; OpenSpec 1/0; diff-check limpo; baseline `5572378b`.
- **Revalidação R1:** validador offline **1 arquivo / 9 testes**; global atualizada **864 arquivos + 2 skipped / 10.765 testes + 10 skipped**; typecheck/lint 0; OpenSpec 1/0; diff-check limpo.
- **Pacote de migration:** caminho `20261123130252_campaign_format_addition.sql`, SHA-256 `61c727…f5b878`, ledger esperado baseline+1, backup/restore-list, schema pré/pós, RLS/grants, guards, cenários, critérios de parada e rollback. **Não aplicada.**
- **Checklist de release:** versão/hash/ledger/schema/backup, flags, provas PostgreSQL/Storage/provider/visual pendentes, rollback, monitoramento e autorização de publicação; separa a declaração F60.7 da conferência técnica.

## Ajustes documentais da revisão (2026-11-23)

- **R3:** checklist fixa backup → migration autorizada → conferência de
  ledger/hash/schema → deploy compatível → smoke → ativação separada. Código que
  grava o novo CHECK não pode ir antes da migration verificada.
- **Segredo:** `FORMAT_ADDITION_CONFIRMATION_SECRET` documentado como configuração
  server-side no ambiente autorizado, com verificação de disponibilidade e sem
  expor o valor; ausente ⇒ funcionalidade indisponível. Flags sozinhas não bastam.
- **R5/R6:** verify do checkpoint sem `Select-String`, com falha explícita por
  item; nota de decomposição adicionada.
- **R1/R2:** `62-08-PLAN.md` passou a exigir autorização estruturada e arquivo
  único `62-08-PROVIDER-AUTHORIZATION.md`; sentinelas de texto foram removidos.
- **R1 — validador:** `scripts/verify/f62-authorization.mjs` extrai um único bloco
  JSON e valida status/valores/datas/expiração/janela atual/identidade/hash/
  booleanos e cada campo do ambiente esperado. Testes offline: **1 arquivo / 9
  testes PASS**. Revalidação global: **864 arquivos + 2 skipped / 10.765 testes
  + 10 skipped**.
- **R1 — janela/alvo:** janela exige `start <= agora < end`; CLI recebe
  host/porta/banco/container esperados explicitamente (variáveis do checkpoint),
  nunca do bloco validado.
- **62-06:** reexecução final do revisor corrigida para **10/110**; **8/92**
  permanece histórica.

## Separação de evidências

| Camada | O que cobre | O que NÃO cobre |
|---|---|---|
| Offline (este plano) | código, testes, build, documentação | banco/Storage/provider/visual reais |
| Autorização de migration | preparação do gate | aplicação ou aprovação |
| `62-08` | provas reais e validação | ativação/publicação automáticas |

## Limitações

- Nenhum banco, Storage, provider, migration, ambiente, segredo/flag, merge, push ou deploy foi acionado.
- Gates offline não provam RLS, locks, concorrência real, restore, provider ou legibilidade visual.
- A autorização da migration não foi concedida; o pacote apenas a prepara.
- `62-08` não iniciado.

## Next

`62-07` aceito. Próximo passo: escolher o ambiente do primeiro preflight
**read-only** (identificação, ledger e schema). Migration, prova paga e produção
continuam não autorizadas; o `62-08` não foi iniciado.

---

*Phase: 62-adicionar-vertical-campanha-quadrada*
*Completed: 62-07 aceito local/offline, 2026-11-23*
