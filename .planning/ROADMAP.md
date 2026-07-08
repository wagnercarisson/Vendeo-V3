# Roadmap: Vendeo V3

## Milestones

- ✅ **v1.0 Core de Geração** — Phases 1-6 (shipped 2026-07-03)
- ✅ **v1.1 Motor de Campanhas** — Phases 2-6 (shipped 2026-07-03)
- ✅ **v1.2 Contas e Propriedade** — Phases 7-11 (shipped 2026-07-08)
- 🔷 **v1.3 Persistência e Entrega da Campanha** — Escopo documentado, fases a definir via alinhamento

## Phases

<details>
<summary>✅ v1.2 Contas e Propriedade (Phases 7-11) — SHIPPED 2026-07-08</summary>

- [x] Phase 7: Sessão e Login Vertical (5 plans) — completed 2026-07-04
- [x] Phase 8: Ciclo de Conta (4 plans) — completed 2026-07-05
- [x] Phase 9: Cutover de Ownership e Onboarding (4 plans) — completed 2026-07-06
- [x] Phase 10: Perímetro Multi-tenant (6 plans) — completed 2026-07-07
- [x] Phase 11: Verificação e Hardening (1 plan) — completed 2026-07-08

</details>

<details>
<summary>✅ v1.1 Motor de Campanhas (Phases 2-6) — SHIPPED 2026-07-03</summary>

- [x] Phase 2: IA de Campanha — Estrutura e Provedores (completed 2026-06-15)
- [x] Phase 3: IA de Campanha — Geração (completed 2026-06-21)
- [x] Phase 4: Marca e Assinatura Visual (completed 2026-06-30)
- [x] Phase 5: Drift e Detecção (completed 2026-07-01)
- [x] Phase 6: App Router — Rotas e Componentes (completed 2026-07-03)

</details>

<details>
<summary>✅ v1.0 Core de Geração (Phases 1-6) — SHIPPED 2026-07-03</summary>

- [x] Phase 1: Projeto e Identidade Visual (completed 2026-06-08)
- [x] Phase 2: Formulário de Campanha (completed 2026-06-12)
- [x] Phase 3: API de Campanha (completed 2026-06-15)
- [x] Phase 4: IA + Renderização (completed 2026-06-30)
- [x] Phase 5: Preview de Campanha (completed 2026-07-01)
- [x] Phase 6: Polimento (completed 2026-07-03)

</details>

<details>
<summary>🔷 v1.3 Persistência e Entrega da Campanha — Escopo documentado, aguardando alinhamento</summary>

**Critério de conclusão:** O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

**Escopo inicial (intenções):**
- Campanha como artefato imutável (briefing + resultado final)
- Registro da campanha no banco
- Imagem final no Storage
- Estados mínimos do processo de geração (gerando, pronto, erro)
- Página de campanha persistida (rota protegida)
- Download do original
- Lista simples em rota autenticada `/minhas-campanhas`

> Fases serão definidas após alinhamento detalhado via opsx-explore.

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------|--------|-----------|
| 1. Projeto e Identidade Visual | v1.0 | — | Complete | 2026-06-08 |
| 2. Formulário de Campanha / IA Estrutura | v1.0 / v1.1 | — | Complete | 2026-06-15 |
| 3. API de Campanha / IA Geração | v1.0 / v1.1 | — | Complete | 2026-06-21 |
| 4. Marca e Assinatura Visual | v1.0 / v1.1 | — | Complete | 2026-06-30 |
| 5. Preview / Drift | v1.0 / v1.1 | — | Complete | 2026-07-01 |
| 6. Polimento / App Router | v1.0 / v1.1 | — | Complete | 2026-07-03 |
| 7. Sessão e Login Vertical | v1.2 | 5/5 | Complete | 2026-07-04 |
| 8. Ciclo de Conta | v1.2 | 4/4 | Complete | 2026-07-05 |
| 9. Cutover de Ownership | v1.2 | 4/4 | Complete | 2026-07-06 |
| 10. Perímetro Multi-tenant | v1.2 | 6/6 | Complete | 2026-07-07 |
| 11. Verificação e Hardening | v1.2 | 1/1 | Complete | 2026-07-08 |

---

| 12. v1.3 — Pendente | v1.3 | — | ○ Escopo documentado | — |

---

*Last updated: 2026-07-08 — v1.3 milestone scope documented*
