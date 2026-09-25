# Roadmap: Vendeo V3

## Milestone v1.5 — Lançamento Externo Controlado ◆

**Estado:** F50 concluida; F48.2.1 (Otimizacao dos Prompts do Diretor) esta **em execucao** (2/9 planos; `48-2-1-01` e `48-2-1-02` concluidos, Checkpoint 1 aprovado; proximo `48-2-1-03`). F50.1 permanece futura e nao ativa, aguardando a constituicao da PJ.

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
| 48.2.1 | Em andamento - 2/9 planos | Em execucao; `48-2-1-01` e `48-2-1-02` concluidos (Checkpoint 1 aprovado); primeira fatia do guarda-chuva F48.2 (local-only, sem promocao) |
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

- F48.2.1 (Otimizacao dos Prompts do Diretor) esta **em execucao** (2/9 planos): `48-2-1-01` (dominio/migration/programa) e `48-2-1-02` (diagnostico versionado v1/v2/v3 + matriz de nove cenarios + Checkpoint 1 aprovado) concluidos; proximo `48-2-1-03`. Local-only e sem promocao.

## Dependencies

- F23 e F24 são pré-requisitos históricos de F25; F25 alimenta F26/F27 e a operação de F28.
- F28 e F29 sustentam launch controls, observabilidade e readiness; F30 sustenta os gates legais.
- A cadeia de produto segue F31.1 → F31.2 → F31.3 → F32 → F33 → F34 → F35 → F36 → F37 → F38 → F38.1/F38.2 → F38.2.1 → F39 → F40 → F41 → F42 → F43 → F45 → F46 → F47 → F48.1 → F48.2.1→ F49 → F50.
- F50.1 depende externamente da constituição da PJ e dos dados legais reais; não bloqueia o estado concluído de F50.
- O índice operacional de requisitos está em `.planning/REQUIREMENTS.md`; o detalhamento histórico integral está em `.planning/REQUIREMENTS-ARCHIVE.md`, no archive deste roadmap e nos artefatos das fases.

## F48.2.1 - Otimizacao dos Prompts do Diretor

**Status:** **Em andamento** — 2/9 planos concluidos (`48-2-1-01`, `48-2-1-02`); Checkpoint humano 1 aprovado (`matrix-v1` + `diagnosticVersion 3`). Proximo: `48-2-1-03`.

**Fonte da verdade:** `openspec/changes/fase-48-2-1-otimizacao-prompts-diretor/` (proposal.md / design.md D1-D11 / 9 specs / tasks.md 48-2-1-01..48-2-1-09).

**Escopo:** primeira fatia do guarda-chuva F48.2 (Qualidade e otimizacao dos prompts). Diagnostico versionado das evidencias da F37, matriz de nove cenarios (offer/spotlight/exclusive, 1:1), suporte aos tres prompts do Diretor, rubrica humana e comparacao cega, regras de simplicidade, ciclos de otimizacao, orcamento atomico em USD do programa, relatorio e recomendacao. Integralmente local (migration nao aplicada no remoto) e sem promocao.

**Fora de escopo:** Revisor (F48.2.2); promocao, canario e db push remoto (F48.2.3); homologacao geral de modelos/providers (F48.6).

**Planos:** 9 planos (sequenciais). Diretorio: `.planning/phases/48.2.1-otimizacao-prompts-diretor/`.

Plans:
- [x] 48-2-1-01-PLAN.md — Dominio, migration local e programa (`lab_prompt_programs`, `campaign_intent`/`program_id`/`rubric`, orcamento atomico, `DIRECTOR_PROMPTS`).
- [x] 48-2-1-02-PLAN.md — Diagnostico versionado da F37 e matriz de nove cenarios (inclui Checkpoint humano 1; aprovado com diagnosticVersion 3).
- [x] 48-2-1-03-PLAN.md — Execucao do Diretor por tipo de campanha e harness (uma chamada `campaign_image`; settle/release de orcamento).
- [x] 48-2-1-04-PLAN.md — Avaliacao humana, rubrica de nove criterios e comparacao cega.
- [ ] 48-2-1-05-PLAN.md — API, UI, orcamento e isolamento (inclui Checkpoint humano 2).
- [ ] 48-2-1-06-PLAN.md — Ciclo do Diretor `offer` (12 runs, avaliacao cega, regra de vitoria).
- [ ] 48-2-1-07-PLAN.md — Ciclo do Diretor `spotlight` (12 runs, avaliacao cega, regra de vitoria).
- [ ] 48-2-1-08-PLAN.md — Ciclo do Diretor `exclusive` (12 runs, criterio de parada e prova de producao inalterada).
- [ ] 48-2-1-09-PLAN.md — Consolidacao, relatorio por prompt e fechamento (Checkpoints 3/4/5; `48-2-1-VERIFICATION.md` e `48.2.1-UAT.md`).
**Ondas e dependencias:** sequenciais `01 -> 02 -> ... -> 09` (uma onda por plano; `48-2-1-NN` depende de `48-2-1-(NN-1)`). Planos com checkpoint humano ou execucao paga sao `autonomous: false` (02, 05, 06, 07, 08, 09).

**Restricoes transversais:** toda execucao paga exige programa com orcamento autorizado e reserva atomica (saldo = budget_usd - consumed - reserved); exatamente uma chamada `campaign_image` por run; `prompts/` intocado byte a byte; migration local-only (sem `db push` remoto).
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
- Requisitos históricos e auditorias: `.planning/REQUIREMENTS-ARCHIVE.md`, `.planning/MILESTONES.md` e os documentos de auditoria em `.planning/`; o índice operacional atual está em `.planning/REQUIREMENTS.md`.
- F44 permanece fora da numeração ativa e está documentada em `docs/alinhamento-fase-44-temas-de-campanhas/`.
- O programa incremental pós-F48.1 está registrado em `docs/alinhamento-roadmap-pos-f48-1.md`; não transforma F50.1 em fase ativa.

## GSD Tracking Contract

- Este arquivo é o tracking compacto ativo; não contém planos, métricas históricas, listas transitórias ou grafos duplicados.
- Ao iniciar nova fase, consultar o índice acima, `.planning/STATE.md`, os artefatos históricos e os requisitos antes de atualizar o milestone.
- Ao concluir uma fase, registrar apenas status e referência curta no índice; preservar detalhes no diretório da fase, summary/verificação e archive apropriado.
