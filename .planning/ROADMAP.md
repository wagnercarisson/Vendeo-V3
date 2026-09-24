# Roadmap: Vendeo V3

## Milestone v1.5 — Lançamento Externo Controlado ◆

**Estado:** F50 concluída; não há fase ativa. A próxima iniciativa é F50.1, futura e não ativa, aguardando a constituição da PJ.

**Escopo do arquivo ativo:** índice operacional do milestone. O histórico integral anterior a esta compactação está em `.planning/ROADMAP-ARCHIVE.md`.

## Overview

| # | Phase | Goal / status |
|---|---|---|
| 23 | ✅ TextProvider + Copy Director | Concluída; fundação de IA de texto e Copy Director intercambiável |
| 24 | ✅ Credit Tables + CreditService | Concluída; créditos concedidos, consumidos e auditáveis |
| 25 | ✅ Pipeline de Geração v1.5 | Concluída; copy e créditos integrados ao pipeline |
| 26 | ✅ Admin Operacional + Convites + Créditos Manuais | Concluída |
| 27 | ✅ Conta + Saldo Visível + Extrato | Concluída |
| 28 | ✅ Observabilidade + Operação + Launch Controls | Concluída; launch controls, observabilidade e readiness operacional |
| 29 | ✅ Refinamento + UAT + Launch Readiness | Concluída |
| 29.1.1 | ✅ Créditos na Assinatura Visual | Concluída |
| 29.1.2 | ✅ Histórico Curto + Assinatura Visual | Concluída |
| 29.3 | ✅ Créditos Mensais Automáticos | Concluída |
| 30 | ✅ Fundação Legal | Concluída |
| 31.1 | ✅ Modelo Comercial — Formulário | Concluída |
| 31.2 | ✅ Diretores por Intenção | Concluída |
| 31.3 | ✅ Quality Gate por Intenção Comercial | Concluída |
| 32 | ✅ Freemium Anti-Abuso CNPJ | Concluída |
| 33 | ✅ Verificação CNPJ Freemium | Concluída |
| 34 | ✅ Store Readiness | Concluída |
| 35 | ✅ Changelog/Novidades | Concluída |
| 36 | ✅ Onboarding — Navegação por Abas | Concluída |
| 37 | ✅ Revisão e Aprovação da Arte | Concluída nas fatias 37.1/37.2; 37.3 eliminada e consolidada |
| 37.1 | ✅ Approval Gate + Candidata Única | Concluída |
| 37.2 | ✅ Correção Única por Não Conformidade | Concluída; 19/19 planos, 8 waves, UAT 9/9 |
| 38 | ✅ Tabela de Custos por Operação | Concluída |
| 38.1 | ✅ Apuração de Custos de IA por Entrega | Concluída |
| 38.2 | ✅ Admin de Custos Operacionais + Configurações Econômicas | Concluída |
| 38.2.1 | ✅ Snapshot Econômico | Concluída |
| 39 | ✅ Brief Estruturado de Campanha | Concluída |
| 40 | ✅ Campos Comerciais e Avisos do Brief | Concluída |
| 41 | ✅ Mídia de Campanha Mobile | Concluída |
| 42 | ✅ Signup Controlado e Elegibilidade Freemium | Concluída |
| 43 | ✅ Revisão do Brief Pré-Geração | Concluída |
| 45 | ✅ Briefing Contextual do Diretor de Arte | Concluída |
| 46 | ✅ Gateway Único de IA e Registry de Modelos | Concluída; Change A |
| 47 | ✅ Catálogo e Seleção de Modelos Admin | Concluída; Change B |
| 48.1 | ✅ Laboratório Mínimo de IA | Concluída; primeira fatia do programa F48.x |
| 49 | ✅ Ativação e Orientação Contextual de Campos | Concluída |
| 50 | ✅ Demonstração Gratuita e Validade dos Créditos | Concluída; 17/17 planos, beta fechado preservado |
| 50.1 | Futura — Formalização Legal e Ativação da Demonstração | Aguardando constituição da PJ; não planejada, não ativa e não bloqueante para o estado concluído |
| — | Monetização pública / Stripe | Diferida para v1.7+, fora da numeração |

## Current State

- F50 é a fase atual encerrada: 17/17 planos e 17/17 summaries, em 10 waves.
- O OpenSpec da F50 está arquivado; não há execução ativa nem mudança de código decorrente deste tracking.
- Demonstração pública, e-mail e signup público permanecem desativados; o beta fechado está preservado.
- F50.1 só deve ser constituída após a PJ: identidade legal, revisão/publicação dos documentos, migration efetiva, ativação ordenada e smoke test pós-corte.
- Monetização pública / Stripe permanece iniciativa diferida e não é fase numerada.

## Dependencies

- F23 e F24 são pré-requisitos históricos de F25; F25 alimenta F26/F27 e a operação de F28.
- F28 e F29 sustentam launch controls, observabilidade e readiness; F30 sustenta os gates legais.
- A cadeia de produto segue F31.1 → F31.2 → F31.3 → F32 → F33 → F34 → F35 → F36 → F37 → F38 → F38.1/F38.2 → F38.2.1 → F39 → F40 → F41 → F42 → F43 → F45 → F46 → F47 → F48.1 → F49 → F50.
- F50.1 depende externamente da constituição da PJ e dos dados legais reais; não bloqueia o estado concluído de F50.
- O detalhamento de requisitos e dependências históricas permanece em `.planning/REQUIREMENTS.md`, no archive deste arquivo e nos artefatos das fases.

## F50.1 — Formalização Legal e Ativação da Demonstração

**Status:** Futura — aguardando constituição da PJ; não planejada e não ativa.

**Escopo futuro:** definir razão social, CNPJ, endereço e fornecedor responsável; substituir placeholders e datas; validar juridicamente Termos, Privacidade e AUP; revisar autoack de suporte; sincronizar documentos; criar/aplicar migration efetiva de publicação; ativar flags na ordem aprovada; validar e-mail, credenciais e requisitos operacionais; executar smoke test pós-corte; manter rollback documentado.

## Historical References

- Cópia integral exata do roadmap anterior: `.planning/ROADMAP-ARCHIVE.md`.
- Estado e continuidade do GSD: `.planning/STATE.md` e `.planning/STATE-ARCHIVE.md`.
- Planos, summaries, contexto e verificação por fase: `.planning/phases/`.
- Quick tasks e seus planos/summaries: `.planning/quick/`.
- Decisões e alinhamentos: `.planning/milestones/`, `docs/` e `docs/archived-alignments/`.
- Propostas, specs, tasks e mudanças arquivadas: `openspec/changes/`.
- Requisitos e auditorias: `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md` e os documentos de auditoria em `.planning/`.
- F44 permanece fora da numeração ativa e está documentada em `docs/alinhamento-fase-44-temas-de-campanhas/`.
- O programa incremental pós-F48.1 está registrado em `docs/alinhamento-roadmap-pos-f48-1.md`; não transforma F50.1 em fase ativa.

## GSD Tracking Contract

- Este arquivo é o tracking compacto ativo; não contém planos, métricas históricas, listas transitórias ou grafos duplicados.
- Ao iniciar nova fase, consultar o índice acima, `.planning/STATE.md`, os artefatos históricos e os requisitos antes de atualizar o milestone.
- Ao concluir uma fase, registrar apenas status e referência curta no índice; preservar detalhes no diretório da fase, summary/verificação e archive apropriado.
