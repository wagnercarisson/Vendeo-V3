# Milestone v1.2 — Contas e Propriedade

**Versão:** Requisitos normativos — decisões D1–D11 consolidadas em `docs/alinhamento-milestone-v1.2.md`
**Status:** Alinhamento concluído. 5 fases (7–11) definidas.
**Data:** 2026-07-03

---

## Objetivo da Milestone

Preparar o terreno para a estrutura SaaS do Vendeo. O core de geração de campanhas está validado (v1.1), mas o produto ainda não é uma versão pública utilizável — falta identificar o usuário, proteger os dados e garantir que cada lojista acesse apenas sua própria loja.

Esta milestone estabelece a camada fundacional de contas e propriedade para que as milestones seguintes construam sobre ela.

## Escopo (Requisitos Normativos)

> Requisitos normativos. Decisões de implementação detalhadas em `docs/alinhamento-milestone-v1.2.md`.

1. **Autenticação**: Supabase Auth, email + senha. Sessão SSR via `@supabase/ssr`.
2. **Vínculo user → store**: `stores.user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id)`. Relação 1:1.
3. **Isolamento de propriedade**: RLS habilitado em 5 tabelas (`stores`, `store_brand_assets`, `store_brand_profiles`, `store_visual_signatures`, `generation_events`). Owner SELECT em 4; `generation_events` default-deny.
4. **Proteção de rotas**: Middleware (auth) + server component (store) + handler (ownership) + serviço (contexto autorizado).
5. **Fluxo de entrada**: `/login`, `/signup`, `/check-email` (se confirm), `/auth/confirm`.
6. **Onboarding**: Usuário autenticado sem loja é estado válido. `/store` em modo create. Loja criada após preenchimento do formulário.
7. **Ownership**: `claims.sub` resolve `stores.user_id`. `localStorage("store_id")` removido. Cliente de sessão + RLS é padrão; service role é excepcional com ownership verificado antes.
8. **Critério de aceite**: Cenários binários de segurança, testados na pirâmide unit→HTTP→RLS real→E2E→UAT. Milestone fecha com todos VERDES.

## Exclusões Explícitas

| Item | Motivo |
|------|--------|
| Campanhas persistidas | Escopo é auth + ownership |
| Export PNG/JPG | Decisão MC-03 da v1.1, adiado |
| Dashboard completo | Exige mais definição de produto |
| Planos e cobrança | Uso livre durante validação |
| Histórico de campanhas | Depende de persistência |
| Regeneração | Redefinida como "novo briefing" (MC-02) |
| Múltiplas lojas | Relação 1:1 nesta milestone |
| Ajustes de arte | Motor valida geração, não edição (MC-01) |
| OAuth social / Magic link | Exclusão deliberada para v1.2 |

## Alinhamento Consolidado

Todas as decisões D1–D11 estão registradas em:

> **[`docs/alinhamento-milestone-v1.2.md`](../docs/alinhamento-milestone-v1.2.md)**

Esse documento contém:
- Ledger completo D1–D11 com justificativas e confirmações
- Invariantes de segurança (11 regras absolutas)
- Máquina de estados do usuário com mapa de rotas
- Arquitetura-alvo com fronteiras session client / service role
- Matriz de RLS por tabela e Storage
- Categorias de cenários de aceite
- Pendências classificadas (design, release gates, legado, futuro)
- 5 fases da milestone (7–11) com entregas e dependências

## Riscos (Atualizado)

| Risco | Impacto | Notas |
|-------|---------|-------|
| Reset de dados existentes | Alto | Reset autorizado. Requer dump de segurança, verificação de dependências, rollback plan |
| Dados legado (stores sem dono) | Médio | Reset confirmado |
| Testes existentes assumem ausência de auth | Alto | 297 testes precisam ser revisados para autenticação |
| Service role pode escapar sem ownership check | Alto | D5 e D7 estabelecem que ownership é verificado antes de qualquer operação admin |
| Bucket `store-logos` legado não inventariado | Baixo | Inventário entra na v1.2; remoção/migração condicionada ao resultado |

## Decisões Complementares (D9–D11)

As pendências "antes do roadmap" foram resolvidas durante a exploração. Decisões registradas em `docs/alinhamento-milestone-v1.2.md`:

- **D9 — CSRF/Origin:** POST/PATCH/PUT/DELETE em Route Handlers exigem mesma origem. Server Actions usam proteção nativa do Next.js.
- **D10 — Recuperação de senha:** Fluxo mínimo incluso na v1.2 (`/forgot-password`, `/update-password`). Gate para beta externo.
- **D11 — Server Actions:** 3 serviços internos (`resolveStoreIdentity`, `validateIdentityReference`, `buildCampaignBrief`). 4 entrypoints autenticados (demais).

---

*Documento atualizado: 2026-07-03*
*Alinhamento consolidado em: `docs/alinhamento-milestone-v1.2.md`*
*Próximo passo: iniciar alinhamento técnico da Phase 7 (Sessão e Login Vertical) via OpenSpec Explore.*
