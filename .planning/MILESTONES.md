# Milestones

## 1.0 MVP (Shipped: 2026-05-25)

**Phases completed:** 2 phases (Foundation, Campaign Input), 3 plans, 25 tasks

**Key accomplishments:**

- Store identity CRUD (name, segment, brand color, city/state) with Supabase persistence and localStorage
- Campaign input form with product name, BRL currency mask, description, badge selection, and image upload
- Route split: `/` for campaign input, `/store` for store identity, with bidirectional navigation
- Client-side validation on all fields with inline errors, BRL mask with raw-digit extraction, and local submit success state
- Read-only store identity card on campaign page using `resolveStoreIdentity` fallback colors

**Known deferred items at close:** 0

**Known gaps:**

- INPT-04 (logo upload): Intentionally deferred per Phase 1 specs. Name-based visual identity fallback works via `resolveStoreIdentity`.

---

## 1.1 Motor de Campanhas (Shipped: 2026-07-03)

**Fases concluídas:** 26 fases (Phases 1-5), 128 plans

**Principais entregas:**

- **AI Campaign Intelligence:** Dois provedores (OpenAI/Anthropic), structured outputs, validação Zod, camada de abstração com fallback
- **Visual Rendering:** Renderização programática com CampaignRenderer, ajustes de copy no preview, geração por IA como saída primária
- **Store Identity Completa:**
  - Upload de logo com análise BrandDirector (5 variantes, color probing, guardrails)
  - Assinatura visual gerada por IA com fluxo de aprovação
  - Fallback tipográfico e text-only inference
- **Identidade da Loja:** 3 estados de identidade (logo, visual_signature, text_only), detecção de drift, políticas por estado, ciclo de vida completo
- **Cores e Preferências:** Persistência de escolhas do usuário, inferência de paleta, realinhamento, validação de cores
- **Campaign Briefing:** Pipeline identity-aware com StoreIdentitySnapshot 2.0, 5 directives, integração com provider de geração
- **Qualidade:** 297 testes automatizados (27 suites), UAT por fase com verificação manual e automática

**Decisões de close-out (MC-01 a MC-05):**

| ID | Decisão | Impacto |
|----|---------|---------|
| MC-01 | Ajustes de arte removidos como requisito | Motor valida geração, não edição pós-geração |
| MC-02 | Regeneração redefinida como "novo briefing" | Evita complexidade de re-renderização |
| MC-03 | Export PNG/JPG movido para próxima milestone | Fará parte da infraestrutura SaaS |
| MC-04 | CSS Renderer marcado como legado | IA gera a imagem final; CSS é fallback de preview |
| MC-05 | v1.1 validou o motor, não versão pública | Próxima milestone constrói estrutura SaaS |

**Known deferred items at close:** 7 (see STATE.md Deferred Items — all metadata tracking, no functional gaps)

**Gaps conhecidos:**

- Export PNG/JPG: movido para próxima milestone
- Ajustes visuais (paleta, fonte, layout): removidos como requisito
- Regeneração: redefinida, aguardando implementação futura
- Agency-grade publishability: baseline funcional, qualidade premium não atingida
- Auth, dashboard, segurança: não implementados — escopo da próxima milestone

---
