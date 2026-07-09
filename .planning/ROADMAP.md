# Roadmap: Vendeo V3

## Milestones

- ✅ **v1.0 Core de Geração** — Phases 1-6 (shipped 2026-07-03)
- ✅ **v1.1 Motor de Campanhas** — Phases 2-6 (shipped 2026-07-03)
- ✅ **v1.2 Contas e Propriedade** — Phases 7-11 (shipped 2026-07-08)
- 🔷 **v1.3 Persistência e Entrega da Campanha** — Fases 12-13 executadas (2/5), 3 fases restantes

## Phases

<details>
<summary>🔷 v1.3 Persistência e Entrega da Campanha — Planejamento em andamento</summary>

**Critério de conclusão:** O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

**Escopo v1.3 (fases identificadas):**
- [x] Phase 12: Fundação DB/Storage (Complete) — tabela campaigns, bucket campaign-images, RLS e Storage policies, verify script
- [x] Phase 13: Serviço de Persistência (Complete) — persistence.ts, 7 helpers, signed URL, 25 testes
- [ ] Phase 14: Integração no Fluxo de Geração — salvar campanha pós-renderização
- [ ] Phase 15: Página de Campanha — `/campanha/[id]` com preview e download
- [ ] Phase 16: Lista de Campanhas — `/minhas-campanhas` com thumbnails e estado vazio

</details>

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

| 12. Fundação DB/Storage | v1.3 | 5/5 | ✅ Complete | 2026-07-08 |

---

| 13. Serviço de Persistência e Download | v1.3 | 3/3 | ✅ Complete | 2026-07-09 |

---

## Phase Details

### Phase 12 — Fundação DB/Storage
**Goal:** Criar a tabela `campaigns`, o bucket `campaign-images`, e as políticas de RLS e Storage — sem modificar o fluxo de geração existente.

**Depends on:** Phases 7-11 (multi-tenant RLS consolidated, stores with user_id, `requireOwnership` established)

**Requirement IDs:** REQ-CAMPAIGNS-DDL, REQ-ERROR-CHECK, REQ-TRIGGER-UPDATED-AT, REQ-RLS-CAMPAIGNS, REQ-INDEXES, REQ-BUCKET-CAMPAIGN-IMAGES, REQ-SELECT-POLICY, REQ-INSERT-POLICY, REQ-DELETE-POLICY, REQ-NO-UPDATE-POLICY, REQ-SMOKE-SQL, REQ-UAT-CHECKLIST

**Plans (0/5):** — *Pending creation*

**Non-Goals (deferred to later phases):**
- persistence.ts service — Phase 13
- GET /api/campaign/[id]/download — Phase 13  
- generate-image modification — Phase 14
- /campanha/[id] page — Phase 15
- /minhas-campanhas page — Phase 16
- Supabase gen types — optional in Phase 12

---

### Phase 13 — Serviço de Persistência e Download
**Goal:** Criar camada de persistência isolada para campanhas: tipos, serviço de 7 helpers, rota de download.

**Depends on:** Phase 12 (campaigns table, campaign-images bucket, RLS/Storage policies)

**Requirement IDs:** REQ-CAMPAIGN-TYPES, REQ-CREATE-CAMPAIGN, REQ-DATAURL-TO-IMAGE, REQ-UPLOAD-CAMPAIGN-IMAGE, REQ-UPDATE-READY, REQ-UPDATE-ERROR, REQ-GET-CAMPAIGN, REQ-DELETE-CAMPAIGN-IMAGE, REQ-DOWNLOAD-ROUTE, REQ-DOWNLOAD-GUARDS, REQ-TEST-PERSISTENCE, REQ-TEST-DOWNLOAD

**Plans (3/3):**
- [x] 13-01 — Types & Persistence Service: `types.ts` + `persistence.ts` (7 helpers)
- [x] 13-02 — Download Route: `GET /api/campaign/[id]/download` (guard pipeline)
- [x] 13-03 — Tests: 19 persistence + 6 download route scenarios

**Non-Goals (deferred to later phases):**
- Modificação do fluxo `generate-image` — Phase 14
- Página `/campanha/[id]` — Phase 15
- Página `/minhas-campanhas` — Phase 16
- Transcoddificação PNG/WEBP → JPEG — Phase 14

---

*Last updated: 2026-07-09 — Phase 13 complete, 3/3 plans executed*
