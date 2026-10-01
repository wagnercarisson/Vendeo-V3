# Roadmap: Vendeo V3

## Milestone v1.5 — Lançamento Externo Controlado ◆

**Estado:** F50 concluida; F48.2.1 (**Bancada Manual de Prompts do Diretor**) esta **concluida e arquivada** (`48-2-1-01` a `48-2-1-05`, `48-2-1-07`, `48-2-1-08` e `48-2-1-09` concluidos; `48-2-1-06` interrompido/suplantado; programa local `closed` e experimento `archived`; zero runs/custo; sem promocao; OpenSpec verificado, sincronizado e arquivado em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/`, commit `f55bed45`). **Realinhamento de tracking (2026-09-28):** a F48.2.2 antiga (Auditoria e Otimizacao do Prompt do Revisor) foi **descartada/substituida** (implementacao nao iniciada; sem artefatos mantidos; recuperavel pelo historico do Git); a nova sequencia e **F48.2.2 — Fundacao da bancada de geracao no Admin/Laboratorio** (**concluida**, 2026-09-28; 8/8 planos; **CP1, CP2 e CP3 aprovados**; UAT tecnico aprovado com **uma** geracao real controlada — run `f6148ea6-...`, `gpt-image-2.5-flare`; producao intocada; OpenSpec **verificado, sincronizado e arquivado** em `openspec/changes/archive/2026-09-28-fase-48-2-2-fundacao-bancada-geracao/`) -> **F48.2.3 — Fidelidade experimental da bancada** (**concluida, verificada, sincronizada e arquivada**, 2026-09-29; 8/8 planos; **CHECKPOINT A** e **CHECKPOINT B** aprovados; UAT manual **sem provider**, custo **US$ 0**; producao intocada; OpenSpec arquivado em `openspec/changes/archive/2026-09-29-fase-48-2-3-fidelidade-experimental-bancada/`) -> **F48.2.4 — Experimento deterministico Oferta 1:1** (**concluida, verificada, sincronizada e arquivada**, 2026-09-30; 10/10 planos; CHECKPOINT A e CHECKPOINT B aprovados; UAT manual — Flare low `requer ajuste`, Sunburst low `aprovado com follow-up`; geracoes reais manuais US$ 0,03 cada; producao intocada; pricing `2026-09-bench-2`; chave exclusiva da bancada validada; OpenSpec arquivado em `openspec/changes/archive/2026-09-30-fase-48-2-4-experimento-deterministico-oferta-1-1/`) -> **F48.2.5 — refinamento experimental Oferta 1:1** (proxima, nao iniciada). F50.1 permanece futura e nao ativa, aguardando a constituicao da PJ.

**Escopo do arquivo ativo:** índice operacional do milestone. O histórico integral anterior a esta compactação está em `.planning/ROADMAP-ARCHIVE.md`.

**Alinhamento F48.2.5 (2026-09-30):** denominação normativa e operacional: **Estabilização experimental Oferta 1:1** (`openspec/changes/fase-48-2-5-estabilizacao-experimental-oferta-1-1/`), planejada em `.planning/phases/48.2.5-estabilizacao-experimental-oferta-1-1/` com 8 planos e aguardando revisão humana. Esta atualização substitui, quanto ao status corrente da F48.2.5, as expressões “refinamento experimental”, “próxima” e “não iniciada” do resumo narrativo acima; eram rótulo provisório e snapshot de tracking anterior ao planejamento, não mudança de escopo nem reescrita de histórico concluído. As referências históricas não operacionais permanecem preservadas; a linha operacional abaixo usa nome e status atuais.

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
| 48.2.2 | ✅ Concluída e arquivada — Fundação da bancada de geração no Admin/Laboratório | 8/8 planos; CP1, CP2 e CP3 aprovados; UAT técnico aprovado com uma geração real controlada (`gpt-image-2.5-flare`); produção intocada; OpenSpec verificado, sincronizado e arquivado em `openspec/changes/archive/2026-09-28-fase-48-2-2-fundacao-bancada-geracao/`; nenhuma promoção |
| 48.2.3 | ✅ Concluída, verificada, sincronizada e arquivada — Fidelidade experimental da bancada | 8/8 planos; **CHECKPOINT A** e **CHECKPOINT B** aprovados; UAT manual **sem provider** com custo **US$ 0**; duas lojas de teste importadas localmente; produção intocada; OpenSpec arquivado em `openspec/changes/archive/2026-09-29-fase-48-2-3-fidelidade-experimental-bancada/` |
| 48.2.4 | ✅ Concluída, verificada, sincronizada e arquivada — Experimento determinístico Oferta 1:1 | 10/10 planos; **CHECKPOINT A** e **CHECKPOINT B** aprovados; UAT manual (Flare low `requer ajuste`; Sunburst low `aprovado com follow-up`); gerações reais **manuais** (US$ 0,03 cada); produção intocada (`base..HEAD` vazio); pricing `2026-09-bench-2`; chave exclusiva da bancada validada; OpenSpec arquivado em `openspec/changes/archive/2026-09-30-fase-48-2-4-experimento-deterministico-oferta-1-1/` |
| 48.2.5 | ◉ Em execução — Estabilização experimental Oferta 1:1 | Planos 01–05 concluídos/summarized (5/8); CHECKPOINT A/B pendentes; próxima ação: Plano 06 |
| 48.2.2-antiga | ⏸ Descartada — Auditoria e Otimização do Prompt do Revisor | Escopo descartado/substituído em 2026-09-28; sem artefatos mantidos; implementação não iniciada; recuperável pelo histórico do Git |
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
- **Execução atual F48.2.5:** Planos 01–05 concluídos/summarized (5/8); CHECKPOINT A/B ainda pendentes; nenhuma geração paga ou chamada de provider pelo executor.

- F48.2.1 (**Bancada Manual de Prompts do Diretor**) esta **concluida e arquivada**: `48-2-1-01` a `48-2-1-05`, `48-2-1-07`, `48-2-1-08` e `48-2-1-09` concluidos; `48-2-1-06` interrompido e suplantado (summary de supersessao). Programa local `860ca4fe-...` `closed` (recusa novas reservas) e experimento `c48e21b5-...` `archived` (recusa execucoes), com historico preservado. Zero runs e zero custo; sem promocao. OpenSpec `017b8799` verificado, sincronizado e arquivado em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/` (commit `f55bed45`). Local-only.

- **Realinhamento F48.2.2 (2026-09-28) [histórico/suplantado]:** a direcao da F48.2.2 mudou. A F48.2.2 antiga (**Auditoria e Otimizacao do Prompt do Revisor**) foi **descartada/substituida** — implementacao nao iniciada, sem artefatos mantidos, recuperavel pelo historico do Git. A sequencia definida entao (**F48.2.2 — Fundacao da bancada de geracao no Admin/Laboratorio** -> **F48.2.3 — Experimento deterministico Oferta 1:1**) foi **superada** pela execucao real: F48.2.2 (bancada) e **F48.2.3 (Fidelidade experimental da bancada)** foram **concluidas/arquivadas**; o escopo "Experimento deterministico Oferta 1:1" passou a ser a **F48.2.4**. `openspec list` nao mostrava changes ativas naquela data (todas arquivadas) — **[histórico/superado]**; a change **`fase-48-2-4-experimento-deterministico-oferta-1-1`** foi **verificada, sincronizada e arquivada** em 2026-09-30 (`openspec/changes/archive/2026-09-30-fase-48-2-4-experimento-deterministico-oferta-1-1/`).

## Dependencies

- F23 e F24 são pré-requisitos históricos de F25; F25 alimenta F26/F27 e a operação de F28.
- F28 e F29 sustentam launch controls, observabilidade e readiness; F30 sustenta os gates legais.
- A cadeia de produto segue F31.1 → F31.2 → F31.3 → F32 → F33 → F34 → F35 → F36 → F37 → F38 → F38.1/F38.2 → F38.2.1 → F39 → F40 → F41 → F42 → F43 → F45 → F46 → F47 → F48.1 → F48.2.1 → F49 → F50.
- **Trilha do laboratorio:** F48.2.1 (concluida/arquivada) → **F48.2.2 (Fundacao da bancada de geracao no Admin/Laboratorio)** (concluida/arquivada) → **F48.2.3 (Fidelidade experimental da bancada)** (concluida/arquivada) → **F48.2.4 (Experimento deterministico Oferta 1:1)** (**concluida, verificada, sincronizada e arquivada**, 2026-09-30) → **F48.2.5 — Estabilização experimental Oferta 1:1** (**em execução; Planos 01–05 concluídos/summarized, 5/8; checkpoints A/B pendentes**). “Refinamento experimental Oferta 1:1” era rótulo provisório de tracking, sem mudança de escopo. A F48.2.2 antiga (Revisor) foi descartada/substituida (sem artefatos mantidos).
- F50.1 depende externamente da constituição da PJ e dos dados legais reais; não bloqueia o estado concluído de F50.
- O índice operacional de requisitos está em `.planning/REQUIREMENTS.md`; o detalhamento histórico integral está em `.planning/REQUIREMENTS-ARCHIVE.md`, no archive deste roadmap e nos artefatos das fases.

## F48.2.1 - Bancada Manual de Prompts do Diretor

**Status:** **concluida** — 8/9 planos executados (`48-2-1-01` a `48-2-1-05`, `48-2-1-07`, `48-2-1-08` e `48-2-1-09`) e `48-2-1-06` **interrompido e suplantado** (summary de supersessao). Inventario: 8 concluidos + 1 suplantado/resolvido (`summary_count 9`). Programa `closed` e experimento `archived` com recusas fail-closed confirmadas e historico preservado. **Zero runs e zero custo.** OpenSpec verificado, sincronizado e arquivado em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/` (commit `f55bed45`). Proximo trabalho na epoca (apos o realinhamento de 2026-09-28) [histórico/suplantado]: planejar a F48.2.2 (bancada de geracao no Admin/Laboratorio) e depois a F48.2.3. **Superado:** F48.2.2 e F48.2.3 foram concluidas/arquivadas; a proxima fase e a **F48.2.4**. Sessoes manuais de teste dos prompts do Diretor seguem em paralelo, com novo programa e nova autorizacao humana antes de qualquer chamada paga.

**Fonte da verdade (arquivada):** `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/` (archive no commit `f55bed45`; base no commit `017b8799`) — proposal.md / design.md D1-D11 / 9 specs / tasks.md com tasks C1-C10 e D1-D4. Specs principais sincronizadas em `openspec/specs/lab-*`.

**Escopo realinhado:** a fase entrega exclusivamente uma **bancada funcional para testes manuais** dos prompts do Diretor (`offer`, `spotlight`, `exclusive`). A candidata e escrita/revisada **fora da execucao automatica** e inserida/colada **manualmente**; a bancada **nao** cria candidatas, **nao** inicia experimentos e **nao** aprova/promove automaticamente. Diagnostico versionado (v1/v2/v3) permanece como evidencia historica; a regra de vitoria e **consultiva**; o rascunho `offer/v1` e apenas exemplo. Integralmente local (migration nao aplicada no remoto) e sem promocao.

**Fora de escopo (a epoca):** Revisor (entao previsto como F48.2.2; hoje **descartado/substituido**); promocao, canario e `db push` remoto (entao F48.2.3); homologacao geral de modelos/providers (F48.6). **Nota de realinhamento (2026-09-28; atualizada 2026-09-29):** a sequencia foi redefinida para **F48.2.2 (Fundacao da bancada de geracao no Admin/Laboratorio)** -> **F48.2.3 (Fidelidade experimental da bancada)** -> **F48.2.4 (Experimento deterministico Oferta 1:1)**; a antiga F48.2.2 do Revisor nao sera executada. F48.2.2 e F48.2.3 ja foram **concluidas/arquivadas**.

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

**Primeira operacao real (registro histórico da F48.2.1):** seria posterior, em sessão conduzida pelo usuário, exigindo novo programa e nova autorização humana; nenhuma candidata automática, nenhuma geração paga como critério de conclusão e nenhuma promoção, canário ou `db push`. [atualizado 2026-09-30] F48.2.2 (bancada de geração) e F48.2.3 (Fidelidade experimental da bancada) foram concluídas e arquivadas; F48.2.4 (Experimento determinístico Oferta 1:1) foi concluída, verificada, sincronizada e arquivada (2026-09-30; 10/10 planos; CHECKPOINT A e B aprovados; UAT manual — Flare low `requer ajuste`, Sunburst low `aprovado com follow-up`; pricing `2026-09-bench-2`; chave exclusiva e projeto Vendeo Lab confirmados; produção intocada; OpenSpec arquivado em `openspec/changes/archive/2026-09-30-fase-48-2-4-experimento-deterministico-oferta-1-1/`). A F48.2.5 está **planejada** como **Estabilização experimental Oferta 1:1**, com 8 planos aguardando revisão/execução; “refinamento experimental Oferta 1:1” era rótulo provisório, não mudança de escopo. A antiga F48.2.2 do Revisor foi descartada/substituída.

**Restricoes transversais:** `prompts/` intocado byte a byte; migration local-only (sem `db push` remoto); exatamente uma chamada `campaign_image` por run; toda execucao paga exigiria programa `authorized` e reserva atomica (saldo = `budget_usd - consumed - reserved`).

**Excecao preexistente (externa a F48.2.1):** `src/lib/legal/__tests__/legal-document-versions.test.ts` falha com `ENOENT` (caminho antigo da F50, change arquivada). O gate fail-closed do Plano 09 aceita a suite completa somente com essa excecao exata (1 arquivo / 1 teste) e a registra como follow-up externo.
## F48.2.2 — Fundação da bancada de geração no Admin/Laboratório

**Status:** **Concluída, verificada, sincronizada e arquivada** (2026-09-28) — 8/8 planos concluídos (`48-2-2-01` a `48-2-2-08`), com **CHECKPOINT 1**, **CHECKPOINT 2** e **CHECKPOINT 3 aprovados**. UAT local aprovado com **uma** geração real controlada (run `f6148ea6-...`, `gpt-image-2.5-flare`, `images`, `low`, `1024x1024`, `succeeded`; custo **calculado** US$ 0,014592 — provider reportado `null`; UI US$ 0,01). Produção intocada (`base..HEAD` vazio). OpenSpec **verificado, sincronizado e arquivado** em `openspec/changes/archive/2026-09-28-fase-48-2-2-fundacao-bancada-geracao/`. A antiga F48.2.2 (**Auditoria e Otimização do Prompt do Revisor**) foi **descartada/substituída** (implementação não iniciada; sem artefatos mantidos; recuperável pelo histórico do Git).

**Plans:** 8 plans

Plans:
- [x] 48-2-2-01-PLAN.md — Bounded context `src/lib/lab/bench/**`, contratos de isolamento, registry de dimensões e **SPIKE BLOQUEANTE de modelos/presets (CHECKPOINT 1)**.
- [x] 48-2-2-02-PLAN.md — Persistência local-first: DDL fora de `supabase/migrations/`, bootstrap local com REVERT, guard de path `bench/{runId}/...` e serviços de run/artefato.
- [x] 48-2-2-03-PLAN.md — Lojas de teste via manifesto local, contrato completo de branding (inclui `typography_direction`) e snapshot de campanha produto/oferta com intenção resolvida.
- [x] 48-2-2-04-PLAN.md — Registry final de presets (somente confirmados) e **CHECKPOINT 2 — aprovação humana antes de qualquer geração paga**.
- [x] 48-2-2-05-PLAN.md — Invocação isolada: adapter `Images` dedicado, resolver capability+alvo do preset, single-shot e telemetria de custo read-only.
- [x] 48-2-2-06-PLAN.md — API administrativa sob `/api/admin/laboratorio/bancada` (guards, estimativa, stream NDJSON, detalhe e artefatos).
- [x] 48-2-2-07-PLAN.md — UI desktop `/admin/laboratorio/bancada` e entrada na navegação interna do laboratório.
- [x] 48-2-2-08-PLAN.md — Testes transversais, **UAT local com geração real controlada (CHECKPOINT 3)** e verificação/encerramento.

**Ondas e dependências:** cadeia sequencial `48-2-2-01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08` (uma onda por plano; o plano 04 depende também do 01). Checkpoints humanos: **1 aprovado** (spike, plano 01), **2 aprovado** (presets antes de geração paga, plano 04 — 4 presets `images` habilitados após correção do pricing) e **3 aprovado** (UAT local, plano 08 — **uma** geração real controlada autorizada e executada). Nenhuma task executou chamada paga autonomamente.

**Cross-cutting constraints:** (a) **isolamento** — nenhum acesso a `campaigns`/`campaign_art_versions`/`generation_events`/`ai_model_selection`/`admin_audit_log`/`credit_*`/`campaign-images`/`prompts/`/providers de produção; lojas/branding apenas leitura local; assets de branding apenas dos buckets locais `store-logos`/`store-brand-assets`/`visual-signatures`; (b) **produção intocada** — `ImagesAdapter` produtivo, registry padrão, `MODEL_ALLOWLIST`, `resolveAiCost`, `BrandProfileSnapshot`, `resolveStoreIdentity`, `art-director-briefing`, `prompts/` e pipeline de campanha inalterados; (c) **sem custo oculto** — exatamente uma chamada paga por geração, nenhuma chamada paga em testes/CI, custo distinto por qualidade (`per_image`/`token_based`), estimado nunca apresentado como faturado; (d) **sem secrets** — nenhum signer aceita bucket/path do cliente, erro sanitizado na origem; (e) **branding apenas exibido/registrado** — prompt manual, logo/assinatura não enviado automaticamente ao modelo; (f) **manifesto sempre** — `assertBenchTestStore` em toda entrada; (g) **slot na confirmação** — `draft` não bloqueia a bancada, `draft → pending` por compare-and-set.

**Objetivo:** construir uma bancada interna, desktop e restrita à área administrativa/laboratório, capaz de realizar gerações reais e mensuráveis, separadas do fluxo de produção.

**Escopo de alto nível:**
- operar dentro da área Admin/Laboratório, com acesso restrito;
- selecionar uma loja real e carregar integralmente o branding persistido (logo/assinatura, nome, paleta, tokens seguros, direção tipográfica, estilo visual, tom, personalidade, posicionamento e diretrizes);
- receber imagens reais do produto; permitir prompt manual nesta primeira fase; permitir seleção de modelo e qualidade;
- presets iniciais: `gpt-image-2 low`, `gpt-image-2 medium`, `gpt-image-2.5-flare low`, `gpt-image-2.5-flare medium`;
- enviar prompt e referências diretamente ao modelo de imagem; apresentar o resultado e permitir download;
- registrar, de forma isolada de produção: loja e referências utilizadas, prompt efetivamente enviado, modelo/qualidade/parâmetros, status e erros, latência, usage retornado e custo real ou estimado com indicação da origem do valor;
- não consumir créditos do lojista; não interferir nas campanhas ou execuções de produção; não exigir responsividade mobile.

**Resultado esperado:** ser possível selecionar uma loja e imagens reais, informar um prompt manual, escolher modelo/qualidade, gerar uma imagem e consultar toda a evidência técnica e financeira da execução.

**Regras:** a **identidade persistida da loja** é a fonte de verdade; a criatividade do modelo fica restrita à composição específica da campanha (sem novo "diretor criativo" que redefina tipografia, cores, expressão ou posicionamento da marca); não reutilizar o laboratório antigo para manter fixtures ou fluxos desconectados dos dados reais. A fonte da verdade OpenSpec será criada no planejamento (a change antiga foi descartada/substituída e não é fonte da nova fase).

## F48.2.3 — Fidelidade experimental da bancada

**Status:** **Concluída, verificada, sincronizada e arquivada** (2026-09-29) — 8/8 planos (`48-2-3-01` a `48-2-3-08`); **CHECKPOINT A** (importação/allowlist) e **CHECKPOINT B** (UAT manual **sem provider**) aprovados; custo de IA **US$ 0**; produção intocada (`base..HEAD` vazio). OpenSpec arquivado em `openspec/changes/archive/2026-09-29-fase-48-2-3-fidelidade-experimental-bancada/`.

**Objetivo:** permitir que a bancada experimente com a identidade **real** das lojas de teste, sem jamais consultar produção durante a operação normal.

**Escopo de alto nível:**
- **importação explícita e unidirecional** da identidade das lojas de teste do Supabase remoto para o ambiente local;
- comando **local** (não botão); **nenhuma** consulta remota durante a operação normal do laboratório;
- **não copiar** campanhas, produtos, ofertas, imagens de campanha, usuários, créditos, billing ou histórico operacional;
- copiar **somente** identidade da loja de teste, perfil de branding, logo, assinatura e assets de identidade autorizados;
- **paridade programática** com os campos/comportamentos do formulário produtivo, **sem** obrigação de reproduzir a mesma interface visual (UI própria e enxuta permitida).

**Nota:** [atualizado 2026-09-29] o OpenSpec detalhado da F48.2.3 foi criado, executado, **verificado, sincronizado e arquivado** em `openspec/changes/archive/2026-09-29-fase-48-2-3-fidelidade-experimental-bancada/`; não ampliou retroativamente o escopo da F48.2.2.

## F48.2.4 — Experimento determinístico Oferta 1:1

**Status:** **Concluída, verificada, sincronizada e arquivada** (2026-09-30) — 10/10 planos (`48-2-4-01` a `48-2-4-10`); **CHECKPOINT A** e **CHECKPOINT B** aprovados; UAT manual (Flare low `requer ajuste`; Sunburst low `aprovado com follow-up`); gerações reais **manuais** (US$ 0,03 cada); produção intocada (`base..HEAD` vazio); pricing `2026-09-bench-2`; chave exclusiva da bancada (`OPENAI_BENCH_API_KEY`) validada. OpenSpec arquivado em `openspec/changes/archive/2026-09-30-fase-48-2-4-experimento-deterministico-oferta-1-1/`.

**Objetivo:** usar a bancada validada para testar o novo pipeline de campanha Oferta 1:1.

**Escopo de alto nível:**
- dados reais da campanha;
- montagem determinística e orientada do prompt de Oferta 1:1;
- branding persistido como contrato obrigatório, sem reinterpretar ou recriar a direção da marca;
- hierarquia comercial orientada, sem posições fixas; composição livre para o modelo;
- visualização, edição e aprovação humana do prompt;
- armazenamento do prompt montado e do prompt efetivamente enviado;
- resultado, avaliação, ajuste do prompt e nova geração; histórico das tentativas.

**Nota histórica:** a numeração **F48.2.3** antes designava "Promoção, Canário e Prontidão da Aprovação" (promoção de prompts testados, canário do fluxo de aprovação e rollback). Esse escopo permanece **adiado/backlog**; a antiga descrição da F48.2.3 como "Experimento determinístico Oferta 1:1" foi **deslocada para F48.2.4** (preservada, sem perda).

**Backlog posterior (fora das duas fases):** Destaque; Exclusivo; outros formatos; temas recorrentes; carrossel; comparação cega ou lado a lado; avaliação automática; mobile; promoção de modelos ou pipelines para produção.

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
