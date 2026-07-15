# Requirements: Vendeo V3 — v1.4 Experiência SaaS

**Defined:** 2026-07-10
**Core Value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.
**Status:** ✅ Completo — 21/21 requisitos implementados (F18–F22)

## v1.4 Requirements

Requisitos de alto nível para a milestone v1.4. Cada categoria será desdobrada em requisitos atômicos, testáveis e com critérios de aceitação durante o ciclo de especificação via OpenSpec.

### Dashboard

- [x] **DASH-01**: Dashboard principal com visão geral do estado da loja
- [x] **DASH-02**: Métricas básicas (campanhas geradas, taxa de sucesso)
- [x] **DASH-03**: Acesso rápido à última campanha e à ação de criar nova

### App Shell & Navegação

- [x] **SHELL-01**: App shell com sidebar e/ou topbar como estrutura de navegação definitiva
- [x] **SHELL-02**: Menus consistentes entre todas as páginas
- [x] **SHELL-03**: Navegação clara entre seções principais (Dashboard, Campanhas, Loja, Conta)

### Onboarding

- [x] **ONBRD-01**: Fluxo de onboarding pós-signup para novos usuários
- [x] **ONBRD-02**: Orientação para criar a primeira campanha
- [x] **ONBRD-03**: Configuração inicial da identidade da loja guiada

### Histórico de Campanhas

- [x] **HIST-01**: Lista de campanhas melhor organizada (ordenação, paginação)
- [x] **HIST-02**: Visualização de campanhas antigas com metadados claros
- [x] **HIST-03**: Transição suave entre listar, visualizar e criar nova campanha

### Estados Vazios

- [x] **UX-01**: Estados vazios consistentes em todas as listas e seções
- [x] **UX-02**: Mensagens claras com call-to-action em cada estado vazio

### Busca & Filtros

- [x] **SEARCH-01**: Campo de busca textual na lista de campanhas
- [x] **SEARCH-02**: Filtros essenciais (por data, status, produto)
- [x] **SEARCH-03**: Integração entre busca, filtros e url state

### Mobile

- [x] **MOBILE-01**: Fluxo completo de campanha funcional em mobile
- [x] **MOBILE-02**: App shell adaptado para telas pequenas
- [x] **MOBILE-03**: Onboarding, histórico e busca utilizáveis em mobile
- [x] **MOBILE-04**: Estados vazios responsivos

## v2 / Futuro

Funcionalidades reconhecidas como desejáveis mas fora do escopo da v1.4.

- **Métricas e analytics avançados**: Dashboard v1.4 terá apenas métricas básicas
- **Export programado / agendado**: Fora do escopo da experiência SaaS
- **Múltiplas lojas**: Relação 1:1 mantida
- **Planos e cobrança**: Uso livre durante validação do SaaS
- **Plano semanal e calendário inteligente**: Fase futura
- **Regeneração**: Redefinida como "novo briefing" (MC-02)

## Out of Scope

Exclusões explícitas para prevenir scope creep.

| Feature | Reason |
|---------|--------|
| Billing / planos | Uso livre durante validação |
| Múltiplas lojas | Relação 1:1 user→store mantida |
| Analytics avançado | Métricas básicas apenas |
| Export agendado | Fora do escopo v1.4 |
| Editor visual livre (Canva-like) | Geração guiada, não livre |
| Geração por IA de imagem (DALL-E) | Reduz previsibilidade |
| Múltiplos tipos de campanha | Motor de campanha único |
| Equipe / permissões | Single-user |
| OAuth social / Magic link | Exclusão deliberada v1.2 |
| Plano semanal / calendário | Fase futura |

## Traceability

Relacionamento entre requisitos e fases do roadmap. Preenchido durante a criação do roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | Phase 18 | ✅ Complete via OpenSpec |
| SHELL-02 | Phase 18 | ✅ Complete via OpenSpec |
| SHELL-03 | Phase 18 | ✅ Complete via OpenSpec |
| ONBRD-01 | Phase 19 | ✅ Complete via OpenSpec |
| ONBRD-02 | Phase 19 | ✅ Complete via OpenSpec |
| ONBRD-03 | Phase 19 | ✅ Complete via OpenSpec |
| UX-01 | Phase 19 | ✅ Complete via OpenSpec |
| UX-02 | Phase 19 | ✅ Complete via OpenSpec |
| DASH-01 | Phase 20 | ✅ Complete via OpenSpec |
| DASH-02 | Phase 20 | ✅ Complete via OpenSpec |
| DASH-03 | Phase 20 | ✅ Complete via OpenSpec |
| HIST-01 | Phase 21 | ✅ Complete via OpenSpec |
| HIST-02 | Phase 21 | ✅ Complete via OpenSpec |
| HIST-03 | Phase 21 | ✅ Complete via OpenSpec |
| SEARCH-01 | Phase 21 | ✅ Complete via OpenSpec |
| SEARCH-02 | Phase 21 | ✅ Complete via OpenSpec |
| SEARCH-03 | Phase 21 | ✅ Complete via OpenSpec |
| MOBILE-01 | Phase 22 | ✅ Complete via OpenSpec (22-01, 22-02, 22-03) |
| MOBILE-02 | Phase 22 | ✅ Complete via OpenSpec (22-01, 22-03) |
| MOBILE-03 | Phase 22 | ✅ Complete via OpenSpec (22-02, 22-03) |
| MOBILE-04 | Phase 22 | ✅ Complete via OpenSpec (22-03) |

**Coverage:**
- v1.4 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-10*
*Last updated: 2026-07-15 after F18–F22 implementation completed*
