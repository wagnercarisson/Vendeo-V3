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

O ciclo de implementação está concluído até a **F50**. O beta permanece fechado; a ativação externa ainda depende da futura **F50.1**. A trilha interna do laboratório segue realinhada: F48.2.2 (bancada) e F48.2.3 (fidelidade) foram concluídas e arquivadas; F48.2.4 foi concluída, verificada, sincronizada e arquivada (2026-09-30; 10/10 planos; CHECKPOINT A/B aprovados; UAT Flare low `requer ajuste`, Sunburst low `aprovado com follow-up`; produção intocada). A **F48.2.5 — Estabilização experimental Oferta 1:1** foi executada (8/8 planos/summaries; 37/37 tasks OpenSpec) e passou pelo GSD verify-work conversacional (**5/5 checkpoints PASS, 0 issues**). CHECKPOINT B foi aprovado com limitações e rubrica parcial; os 65 critérios sem evidência permanecem `pending`. OpenSpec foi verificado, sincronizado e arquivado em `openspec/changes/archive/2026-10-01-fase-48-2-5-estabilizacao-experimental-oferta-1-1/`; não há promoção produtiva. O gate de segurança está habilitado; `/gsd-secure-phase 48.2.5` é necessário antes de avançar. A F48.2.2 antiga, de auditoria do prompt do Revisor, foi descartada/substituída.

O estado operacional detalhado, inclusive decisões de sequência, dependências e eventuais novas fases, deve ser consultado exclusivamente no roadmap de `.planning`. Este arquivo não substitui o tracking de execução nem deve ser usado para acompanhar planos individuais.

**F50.1 - Formalização Legal e Ativação da Demonstração** é futura, não planejada e condicionada à constituição da PJ. Ela não é pendência da F50.

Stripe e a monetização pública estão deliberadamente diferidos para **v1.7+** e não constituem fase ativa deste ciclo.

## Fontes

- Fonte operacional única: `.planning/ROADMAP.md`.
- Histórico integral do roadmap anterior: `ROADMAP-ARCHIVE.md`.
