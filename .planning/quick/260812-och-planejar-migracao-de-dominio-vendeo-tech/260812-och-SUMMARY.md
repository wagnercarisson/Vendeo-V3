---
phase: quick-260812-och
plan: 01
subsystem: infra
tags: [domain-migration, runbook, vercel, dns, supabase-auth, pwa, plan-only]
requires:
  - phase: quick-260808-rqw
    provides: landing pública / com CTA "Solicitar acesso free", signup beta fechado no Supabase Auth, doc SUPABASE-CLOSED-BETA.md (Opção A: "Allow new users to sign up" desabilitado)
  - phase: quick-260808-udc
    provides: PWA básico (manifest start_url /dashboard, ícones relativos, sem service worker) e a origem de instalação por domínio
provides:
  - Runbook operacional completo da migração de domínio beta.vendeo.tech → vendeo.tech (canônico), 100% plan-only
affects: [execução futura da migração de domínio, docs/operations, SUPABASE-CLOSED-BETA.md, env NEXT_PUBLIC_SITE_URL]
tech-stack:
  added: []
  patterns:
    - "Runbook de migração com COLLECT FIRST, decisões pendentes com recomendação, ordem justificada (Supabase → Vercel → DNS → Env/Deploy → Validação → Monitoramento), rollback RB-01..RB-08 e UAT U-01..U-13"
key-files:
  created:
    - .planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-SUMMARY.md
  modified: []
key-decisions:
  - "Quick é plan-only: nenhum passo executa mudança em Vercel, DNS, Supabase Auth, env vars ou código — o runbook é o entregável"
  - "Nenhuma mudança no PLAN.md foi necessária: as 3 tasks apenas verificaram âncoras das seções A, B e C, todas já presentes (0 commits criados)"
requirements-completed: [DOM-01, DOM-02, DOM-03, DOM-04, DOM-05]
duration: 4min
completed: 2026-08-12
---

# Quick 260812-och: Planejar migração de domínio vendeo.tech — Summary

**Runbook operacional completo (plan-only) para tornar vendeo.tech o domínio canônico do Vendeo V3 com beta fechado preservado, callbacks Supabase Auth protegidos e PWA por origem documentado — entregue como blueprint documental; nenhuma mudança em infra executada nem planejada como passo executável**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-12T18:35:00Z
- **Completed:** 2026-08-12T18:39:00Z
- **Tasks:** 3/3 (documentação/verificação)
- **Files modified:** 0 (nenhuma mudança no PLAN.md necessária)

## Accomplishments
- **Task 1 (Seção A)** verificada: inventário de domínios (tabela COLLECT FIRST), mapeamento Vercel (projeto `vendeo-v3`, id `prj_Z001CZf0ChbczzwV7JEgAIlZVbGe`, org `team_2mDUcf5S4z27nZP7IUfEqIXg`), mapeamento Supabase Auth (Redirect URLs permitidas com `/auth/confirm` canônico + wildcards complementares condicionais), mapeamento PWA (origem de instalação), decisões pendentes D-1..D-7 com recomendação e checklist COLLECT FIRST C-01..C-10.
- **Task 2 (Seção B)** verificada: pré-checks P-01..P-08, ordem recomendada justificada (Supabase → Vercel → DNS → Env/Deploy → Validação → Monitoramento), checklist operacional R-01..R-08 (janela de corte com troca coordenada Site URL + env + redeploy obrigatório), checklist de rollback RB-01..RB-08 cobrindo Vercel/DNS/Supabase/env/login/V1.
- **Task 3 (Seção C)** verificada: UAT U-01..U-13 (landing, signup fechado, login, forgot-password, callbacks, dashboard protegido, admin, PWA, links legais), monitoramento M-01..M-05 (48h), quem/quando executa com checkpoints humanos entre fases, regras de ouro declarando o caráter plan-only e as proibições (nunca remover beta antes da janela D-2, nunca tocar signup aberto, V1 intocável).
- Garantia plan-only confirmada: âncoras "Fora de escopo", "plan-only", "não toca produção" presentes; nenhuma task contém passo executável contra infra/código/env.

## Task Commits

Cada task era de verificação documental sobre o próprio PLAN.md (o runbook é o entregável). **Nenhuma mudança foi necessária — 0 commits criados.**

1. **Task 1: Seção A do runbook — inventário, baseline e decisões pendentes (COLLECT FIRST)** — sem mudanças (âncoras já presentes: `COLLECT FIRST`, `Decisões pendentes`, `Redirect URLs permitidas`, `Projeto V1`, `Mapeamento PWA`)
2. **Task 2: Seção B do runbook — sequência operacional numerada + ordem + rollback** — sem mudanças (`Checklist Operacional`, `RB-01`, `R-01`, `Ordem recomendada`, `Rollback`)
3. **Task 3: Seção C do runbook — UAT pós-migração, monitoramento e responsabilidade** — sem mudanças (`UAT`, `U-01`, `M-01`, `Quem / quando executa`, `Regras de ouro`)

**Plan metadata:** o orchestrator lida com o commit de docs (SUMMARY.md, STATE.md, PLAN.md) — não foi criado commit neste quick.

## Files Created/Modified
- `.planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-SUMMARY.md` — Este resumo (único arquivo criado; docs commit é do orchestrator)
- `.planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-PLAN.md` — Verificado, **sem alterações**

## Decisions Made
- **Quick plan-only confirmado:** as 3 tasks não executam nada contra Vercel/DNS/Supabase/env/código — apenas documentam e verificam o runbook (DOM-05).
- **Sem alterações no PLAN.md:** todas as âncoras exigidas pelos `<verify>` das tasks e pela `<verification>` global estavam presentes — o blueprint já estava íntegro desde o planejamento.
- **0 commits de task:** o critério "commit each task atomically if changes were needed" não disparou (nada a commitar); o commit de docs fica com o orchestrator, conforme as constraints desta execução.

## Deviations from Plan

None - plan executed exactly as written (tasks eram de verificação e nenhuma mudança foi necessária).

## Issues Encountered
- **Ferramenta `rg` indisponível** no ambiente (Windows/PowerShell): as verificações automatizadas dos `<verify>`/`<verification>` foram executadas com a ferramenta de grep do agente sobre o arquivo PLAN.md — todas as âncoras encontradas (Task 1: 18 matches; Task 2: 13 matches; Task 3: 22 matches; âncoras complementares Mapeamento Vercel/Supabase Auth/Pré-checks/Checklist de UAT/Monitoramento curto/Fora de escopo/plan-only presentes).
- **Check de worktree HEAD:** o diretório é o checkout principal (`main`), não um worktree (`git worktree list` mostra apenas `C:/Projetos/Vendeo V3` em `main` @ `1b20c78`, base esperada) — o guard de branch per-agent não se aplica; nenhum commit foi criado de qualquer forma.

## User Setup Required
None - nenhuma configuração de serviço externo; a execução da migração (Vercel/DNS/Supabase) é uma fase futura manual guiada pelo runbook, fora deste quick.

## Next Phase Readiness
- O runbook está pronto para ser executado por humano quando decidido: COLLECT FIRST C-01..C-10, decisões D-1..D-7, pré-checks P-01..P-08, ordem R-01..R-08, rollback RB-01..RB-08 e UAT U-01..U-13 — todos numerados e com responsável/quando.
- Próximos passos fora do runbook (adiados de propósito): desvinculação do projeto V1, 301 definitivo beta → vendeo.tech e limpeza final — fases futuras dedicadas, apenas inventariadas aqui.
- Bloqueadores: nenhum. A execução real exige humano (dashboards Vercel/Supabase e registrar DNS) e a coleta manual prévia (COLLECT FIRST).

## Self-Check: PASSED

- [x] SUMMARY file exists: `.planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-SUMMARY.md`
- [x] No task commits created (critério "if changes were needed" não disparou — 0 mudanças no PLAN.md)
- [x] HEAD inalterado em `1b20c78` (base esperada); nenhum commit novo no histórico
- [x] Arquivo protegido `docs/alinhamento-fase-37-revisao-aprovacao-arte.md` intacto e intocado
- [x] ROADMAP.md não foi atualizado (quick task — fora de escopo)
- [x] Commit de docs (SUMMARY/STATE/PLAN) delegado ao orchestrator conforme constraints

---
*Phase: quick-260812-och*
*Completed: 2026-08-12*
