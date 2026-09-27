# Roadmap: Vendeo V3

## Milestone v1.5 — Lançamento Externo Controlado ◆

**Estado:** F50 concluida; F48.2.1 (**Bancada Manual de Prompts do Diretor**) esta **concluida e arquivada** (`48-2-1-01` a `48-2-1-05`, `48-2-1-07`, `48-2-1-08` e `48-2-1-09` concluidos; `48-2-1-06` interrompido/suplantado; programa local `closed` e experimento `archived`; zero runs/custo; sem promocao; OpenSpec verificado, sincronizado e arquivado em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/`, commit `f55bed45`). F50.1 permanece futura e nao ativa, aguardando a constituicao da PJ.

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
| 48.2.1 | ✅ Concluída e arquivada — bancada manual (8/9 + 06 suplantado) | Bancada manual de prompts do Diretor; `48-2-1-01` a `48-2-1-05`, `48-2-1-07`, `48-2-1-08` e `48-2-1-09` concluidos; `48-2-1-06` interrompido/suplantado; programa `closed` e experimento `archived`; local-only, sem promocao; OpenSpec arquivado (commit `f55bed45`) |
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

- F48.2.1 (**Bancada Manual de Prompts do Diretor**) esta **concluida e arquivada**: `48-2-1-01` a `48-2-1-05`, `48-2-1-07`, `48-2-1-08` e `48-2-1-09` concluidos; `48-2-1-06` interrompido e suplantado (summary de supersessao). Programa local `860ca4fe-...` `closed` (recusa novas reservas) e experimento `c48e21b5-...` `archived` (recusa execucoes), com historico preservado. Zero runs e zero custo; sem promocao. OpenSpec `017b8799` verificado, sincronizado e arquivado em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/` (commit `f55bed45`). Local-only.

## Dependencies

- F23 e F24 são pré-requisitos históricos de F25; F25 alimenta F26/F27 e a operação de F28.
- F28 e F29 sustentam launch controls, observabilidade e readiness; F30 sustenta os gates legais.
- A cadeia de produto segue F31.1 → F31.2 → F31.3 → F32 → F33 → F34 → F35 → F36 → F37 → F38 → F38.1/F38.2 → F38.2.1 → F39 → F40 → F41 → F42 → F43 → F45 → F46 → F47 → F48.1 → F48.2.1→ F49 → F50.
- F50.1 depende externamente da constituição da PJ e dos dados legais reais; não bloqueia o estado concluído de F50.
- O índice operacional de requisitos está em `.planning/REQUIREMENTS.md`; o detalhamento histórico integral está em `.planning/REQUIREMENTS-ARCHIVE.md`, no archive deste roadmap e nos artefatos das fases.

## F48.2.1 - Bancada Manual de Prompts do Diretor

**Status:** **concluida** — 8/9 planos executados (`48-2-1-01` a `48-2-1-05`, `48-2-1-07`, `48-2-1-08` e `48-2-1-09`) e `48-2-1-06` **interrompido e suplantado** (summary de supersessao). Inventario: 8 concluidos + 1 suplantado/resolvido (`summary_count 9`). Programa `closed` e experimento `archived` com recusas fail-closed confirmadas e historico preservado. **Zero runs e zero custo.** OpenSpec verificado, sincronizado e arquivado em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/` (commit `f55bed45`). Proximo trabalho: sessoes manuais de teste dos prompts do Diretor (novo programa e nova autorizacao humana antes de qualquer chamada paga); F48.2.2 separada e nao iniciada; F48.2.3 bloqueada ate existirem prompts testados e aprovados.

**Fonte da verdade (arquivada):** `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/` (archive no commit `f55bed45`; base no commit `017b8799`) — proposal.md / design.md D1-D11 / 9 specs / tasks.md com tasks C1-C10 e D1-D4. Specs principais sincronizadas em `openspec/specs/lab-*`.

**Escopo realinhado:** a fase entrega exclusivamente uma **bancada funcional para testes manuais** dos prompts do Diretor (`offer`, `spotlight`, `exclusive`). A candidata e escrita/revisada **fora da execucao automatica** e inserida/colada **manualmente**; a bancada **nao** cria candidatas, **nao** inicia experimentos e **nao** aprova/promove automaticamente. Diagnostico versionado (v1/v2/v3) permanece como evidencia historica; a regra de vitoria e **consultiva**; o rascunho `offer/v1` e apenas exemplo. Integralmente local (migration nao aplicada no remoto) e sem promocao.

**Fora de escopo:** Revisor (F48.2.2); promocao, canario e `db push` remoto (F48.2.3); homologacao geral de modelos/providers (F48.6).

**Planos:** diretorio `.planning/phases/48.2.1-otimizacao-prompts-diretor/`.

Plans:
- [x] 48-2-1-01-PLAN.md — Dominio, migration local e programa (`lab_prompt_programs`, `campaign_intent`/`program_id`/`rubric`, orcamento atomico, `DIRECTOR_PROMPTS`).
- [x] 48-2-1-02-PLAN.md — Diagnostico versionado da F37 e matriz de nove cenarios (Checkpoint humano 1; aprovado com diagnosticVersion 3).
- [x] 48-2-1-03-PLAN.md — Execucao do Diretor por tipo de campanha e harness (uma chamada `campaign_image`; settle/release de orcamento).
- [x] 48-2-1-04-PLAN.md — Avaliacao humana, rubrica de nove criterios e comparacao cega.
- [x] 48-2-1-05-PLAN.md — API, UI, orcamento e isolamento (Checkpoint humano 2; aprovado em autorizar-inicial, US$ 2.808).
- [~] 48-2-1-06-PLAN.md — **Interrompido e suplantado** por decisao humana na Task 4 (Checkpoint 3), antes de qualquer run pago; Tasks 1–3 executadas; resolucao em `48-2-1-06-SUMMARY.md` (supersessao). **Nao pertence mais a cadeia executavel.**
- [x] 48-2-1-07-PLAN.md — **Seguranca financeira e revogacao fail-closed** (reserva exige `status='authorized'`; `closed` terminal; reautorizacao recusada; historico preservado; controle de encerramento + UI com confirmacao).
- [x] 48-2-1-08-PLAN.md — **Orcamento visivel e arquivamento seguro** (autorizado/reservado/consumido/saldo; integracao do painel; arquivamento administrativo com recusa de execucao e historico preservado).
- [x] 48-2-1-09-PLAN.md — **Verificacao, UAT e encerramento operacional** (validacao automatica sem execucao paga; encerrar o programa e arquivar o experimento apos checkpoint; `48-2-1-VERIFICATION.md` e `48.2.1-UAT.md`).

**Ondas e dependencias:** cadeia executavel **concluida** `48-2-1-05 -> 48-2-1-07 -> 48-2-1-08 -> 48-2-1-09` (uma onda por plano). O Plano 06 **nao** faz parte da cadeia executavel (suplantado). **Nao ha proximo plano executavel** — a fase esta concluida. OpenSpec verificado, sincronizado e arquivado (commit `f55bed45`); proximo trabalho sao sessoes manuais de teste dos prompts do Diretor.

**Estado local (final):** programa `860ca4fe-dc8b-4354-b94e-02f9e7b202c6` em `status='closed'` (novas reservas recusadas com `program_not_authorized`; `budget_usd 2.808`, reservado 0, consumido 0, historico preservado) e experimento `c48e21b5-c7a8-4456-a0d6-a2b4040fc1e3` em `status='archived'` (execucoes recusadas com `experiment_not_ready`; 2 variantes, 3 cenarios, 0 runs, 0 avaliacoes). **Zero runs e zero custo.**

**Primeira operacao real:** sera **posterior**, em sessao conduzida pelo usuario, exigindo **novo programa** e **nova autorizacao humana**. Nenhuma candidata automatica; nenhuma execucao paga exigida para concluir a fase; nenhuma promocao, canario ou `db push`. A F48.2.2 permanece separada e nao iniciada (revisao/realinhamento humano antes de planejamento/execucao); a F48.2.3 permanece bloqueada ate existirem prompts testados e aprovados.

**Restricoes transversais:** `prompts/` intocado byte a byte; migration local-only (sem `db push` remoto); exatamente uma chamada `campaign_image` por run; toda execucao paga exigiria programa `authorized` e reserva atomica (saldo = `budget_usd - consumed - reserved`).

**Excecao preexistente (externa a F48.2.1):** `src/lib/legal/__tests__/legal-document-versions.test.ts` falha com `ENOENT` (caminho antigo da F50, change arquivada). O gate fail-closed do Plano 09 aceita a suite completa somente com essa excecao exata (1 arquivo / 1 teste) e a registra como follow-up externo.
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
