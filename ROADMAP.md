# Vendeo - Roadmap Executivo

## Propósito

Este arquivo apresenta uma visão executiva curta do produto. O roadmap operacional, as fases e o tracking de status estão em `.planning/ROADMAP.md`, que é a única fonte operacional.

## Milestones

- **v1.0 Core de Geração:** fundação para transformar uma oferta em campanha visual publicável.
- **v1.1 Motor de Campanhas:** evolução do motor, copy comercial e geração de peças.
- **v1.2 Contas e Propriedade:** autenticação, propriedade de loja e isolamento multi-tenant.
- **v1.3 Persistência e Entrega da Campanha:** armazenamento, histórico e download das campanhas.
- **v1.4 Experiência SaaS:** shell do produto, onboarding, dashboard, busca e experiência mobile.
- **v1.5 Lançamento Externo Controlado:** ciclo de implementação concluído até a F50, mas não declarado como lançamento público.

Em conjunto, esses milestones levaram o Vendeo de um gerador de campanhas a um produto SaaS com contas, propriedade, persistência, operação assistida e uma base preparada para ativação externa controlada. A disponibilidade pública continua sendo uma decisão posterior ao ciclo de implementação, não uma consequência automática da conclusão técnica.

## Estado Atual

O ciclo de implementação está concluído até a **F50**. O beta permanece fechado, não há fase em execução (a change OpenSpec da F48.2.4 está **verificada, sincronizada e arquivada**) e a ativação externa ainda depende da futura **F50.1**. A trilha interna do laboratório segue realinhada (2026-09-28): a **F48.2.2 — Fundação da bancada de geração no Admin/Laboratório** foi **concluída** (8/8 planos; **CP1/CP2/CP3 aprovados**; UAT técnico com uma geração real controlada; produção intocada; OpenSpec **verificado, sincronizado e arquivado**) e a **F48.2.3 — Fidelidade experimental da bancada** foi **concluída, verificada, sincronizada e arquivada** (2026-09-29; 8/8 planos; **CHECKPOINT A** e **CHECKPOINT B** aprovados; UAT manual **sem provider**, custo **US$ 0**; produção intocada). A **F48.2.4 — Experimento determinístico Oferta 1:1** foi **concluída, verificada, sincronizada e arquivada** (2026-09-30; 10/10 planos; **CHECKPOINT A** e **CHECKPOINT B** aprovados; UAT manual — Flare low `requer ajuste`, Sunburst low `aprovado com follow-up`; pricing `2026-09-bench-2`; chave exclusiva da bancada e projeto Vendeo Lab confirmados; produção intocada; OpenSpec arquivado em `openspec/changes/archive/2026-09-30-fase-48-2-4-experimento-deterministico-oferta-1-1/`). A antiga F48.2.2, de auditoria do prompt do Revisor, foi descartada/substituída. A próxima etapa é a **F48.2.5 — refinamento experimental Oferta 1:1** (ainda não iniciada).

O estado operacional detalhado, inclusive decisões de sequência, dependências e eventuais novas fases, deve ser consultado exclusivamente no roadmap de `.planning`. Este arquivo não substitui o tracking de execução nem deve ser usado para acompanhar planos individuais.

**F50.1 - Formalização Legal e Ativação da Demonstração** é futura, não planejada e condicionada à constituição da PJ. Ela não é pendência da F50.

Stripe e a monetização pública estão deliberadamente diferidos para **v1.7+** e não constituem fase ativa deste ciclo.

## Fontes

- Fonte operacional única: `.planning/ROADMAP.md`.
- Histórico integral do roadmap anterior: `ROADMAP-ARCHIVE.md`.
