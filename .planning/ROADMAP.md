# Roadmap: Vendeo V3

## Milestone v1.5 — Lançamento Externo Controlado ◆

**Estado:** F50 concluida; F48.2.1 (**Bancada Manual de Prompts do Diretor**) esta **concluida e arquivada** (`48-2-1-01` a `48-2-1-05`, `48-2-1-07`, `48-2-1-08` e `48-2-1-09` concluidos; `48-2-1-06` interrompido/suplantado; programa local `closed` e experimento `archived`; zero runs/custo; sem promocao; OpenSpec verificado, sincronizado e arquivado em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/`, commit `f55bed45`). **Realinhamento de tracking (2026-09-28):** a F48.2.2 antiga (Auditoria e Otimizacao do Prompt do Revisor) foi **descartada/substituida** (implementacao nao iniciada; sem artefatos mantidos; recuperavel pelo historico do Git); a nova sequencia e **F48.2.2 — Fundacao da bancada de geracao no Admin/Laboratorio** (**concluida**, 2026-09-28; 8/8 planos; **CP1, CP2 e CP3 aprovados**; UAT tecnico aprovado com **uma** geracao real controlada — run `f6148ea6-...`, `gpt-image-2.5-flare`; producao intocada; OpenSpec **verificado, sincronizado e arquivado** em `openspec/changes/archive/2026-09-28-fase-48-2-2-fundacao-bancada-geracao/`) -> **F48.2.3 — Fidelidade experimental da bancada** (**concluida, verificada, sincronizada e arquivada**, 2026-09-29; 8/8 planos; **CHECKPOINT A** e **CHECKPOINT B** aprovados; UAT manual **sem provider**, custo **US$ 0**; producao intocada; OpenSpec arquivado em `openspec/changes/archive/2026-09-29-fase-48-2-3-fidelidade-experimental-bancada/`) -> **F48.2.4 — Experimento deterministico Oferta 1:1** (**concluida, verificada, sincronizada e arquivada**, 2026-09-30; 10/10 planos; CHECKPOINT A e CHECKPOINT B aprovados; UAT manual — Flare low `requer ajuste`, Sunburst low `aprovado com follow-up`; geracoes reais manuais US$ 0,03 cada; producao intocada; pricing `2026-09-bench-2`; chave exclusiva da bancada validada; OpenSpec arquivado em `openspec/changes/archive/2026-09-30-fase-48-2-4-experimento-deterministico-oferta-1-1/`) -> **F48.2.5 — Estabilização experimental Oferta 1:1** (**concluida, verificada, sincronizada e arquivada**, 2026-10-01; 8/8 planos; CHECKPOINT B aprovado com limitações; OpenSpec arquivado em `openspec/changes/archive/2026-10-01-fase-48-2-5-estabilizacao-experimental-oferta-1-1/`) -> **F48.2.6 — Validação experimental Produto — intenções 1:1** (**concluida, verificada, sincronizada e arquivada**, 2026-10-05; 10/10 planos; GSD UAT 5/5; CHECKPOINT B `approved_with_limitations`; 8 specs principais sincronizados; OpenSpec arquivado em `openspec/changes/archive/2026-10-05-fase-48-2-6-validacao-experimental-produto-intencoes-1-1/`; limitações UAT `pending`; sem promoção produtiva). F50.1 permanece futura e nao ativa, aguardando a constituicao da PJ.

**Escopo do arquivo ativo:** índice operacional do milestone. O histórico integral anterior a esta compactação está em `.planning/ROADMAP-ARCHIVE.md`.

**Reconciliação F48.2.5 (2026-10-02):** denominação normativa: **Estabilização experimental Oferta 1:1**. A fase tem 8/8 planos/summaries e 37/37 tasks OpenSpec; change verificada, sincronizada e arquivada em `openspec/changes/archive/2026-10-01-fase-48-2-5-estabilizacao-experimental-oferta-1-1/`. `/gsd-verify-work 48.2.5` foi concluído em `48.2.5-GSD-UAT.md`: 5/5 checkpoints PASS, sem issues. A security review retroativa está verificada em `48-2-5-SECURITY.md` (7 ameaças fechadas, 0 abertas), satisfazendo o gate `workflow.security_enforcement=true`. Os 65 critérios do UAT experimental permanecem `pending`, reconhecidos pelo usuário como limitação e sem inferência ou promoção.

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
| 48.2.5 | ✅ UAT GSD e security review concluídos | 8/8 planos/summaries; 37/37 tasks; 5/5 checkpoints GSD PASS; CHECKPOINT B aprovado com limitações; security review retroativa 7/7 fechados, 0 abertos (`48-2-5-SECURITY.md`); 65 critérios `pending` reconhecidos; OpenSpec verificado/sincronizado/arquivado |
| 48.2.6 | ✅ Concluída, verificada, sincronizada e arquivada — Validação experimental Produto — intenções 1:1 | 10/10 planos/summaries; 42/42 tasks; GSD UAT 5/5 pass, 0 issues; CHECKPOINT B `approved_with_limitations`; security 6/6 fechada, 0 abertas; revalidação final 329 testes focados em 7 arquivos; OpenSpec arquivado em `openspec/changes/archive/2026-10-05-fase-48-2-6-validacao-experimental-produto-intencoes-1-1/` com **8 specs principais sincronizados** (6 atualizados + 2 criados); limitações UAT `pending` preservadas; sem geração/provider do executor ou promoção. |
| 48.2.2-antiga | ⏸ Descartada — Auditoria e Otimização do Prompt do Revisor | Escopo descartado/substituído em 2026-09-28; sem artefatos mantidos; implementação não iniciada; recuperável pelo histórico do Git |
| 49 | ✅ Ativação e Orientação Contextual de Campos | Concluída |
| 50 | ✅ Demonstração Gratuita e Validade dos Créditos | Concluída; 17/17 planos, beta fechado preservado |
| 50.1 | Futura — Formalização Legal e Ativação da Demonstração | Aguardando constituição da PJ; não planejada, não ativa e não bloqueante para o estado concluído |
| 56.1 | ✓ Contrato produtivo, modelos e fallback | **Concluída, verificada, sincronizada e arquivada em 2026-10-06; 11/11 planos; UAT humano local aprovado; GSD 10/10; OpenSpec 55/55; archive `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/` (motivo vazio bloqueado; salvamento pela tela OK; teste Flare/medium → versão `f314d801-87be-479c-9c01-4d574b9d892f` com exatamente 1 auditoria; par inicial restaurado → versão `b3fa7b83-a0aa-48db-8f02-9bcbdd32bbe8`; histórico preservado; troca de teste NÃO é promoção de Flare); OpenSpec 55/55 tasks (9.4 concluída); GSD verify-work 10/10 PASS; lifecycle /opsx-verify → /opsx-sync → /opsx-archive executado e arquivado; 3 specs principais atualizadas + 5 criadas.** Plano 11: guard de isolamento/não-regressão + teste REAL da RPC + gates/UAT sem provider + VERIFICATION. Plano 10: tela admin única do par (page server `force-dynamic` + form cliente) com aviso permanente de não-ativa em produção (não-dismissível, presente no estado vazio e no sucesso), catálogo elegível somente leitura (3 modelos × `low`/`medium`), par vigente/origem/versão, cobertura de pricing `partial`/`missing` warn-not-block (não desabilita salvar) e formulário auditável restrito ao catálogo com `operationId` estável por fingerprint; link aditivo em `layout.tsx` (`Par de modelos (novo fluxo)`) e 10 testes de UI com API mockada (typecheck/lint verdes; nenhum controle destrutivo; fluxo legado intocado). Plano 08: serviço server-only de leitura/cache fail-closed do par (TTL + dedupe in-flight + invalidação explícita) + view admin (catálogo elegível/par vigente/origem/versão/cobertura de pricing por par) + schema Zod strict restrito ao catálogo elegível + rota admin GET/PUT auditada por RPC `admin_set_image_model_pair_config` com invalidação de cache (38 testes; typecheck/lint verdes; `git diff` vazio em `ai-model-selection-service.ts`; fluxo legado intocado). Plano 07: resposta pública IMG-001 + referência opaca UUID v4 + tabela durável imutável `image_generation_failure_diagnoses` + repositório server-only `recordDiagnosis`/`findByReference` com client injetável + rota admin de correlação read-only; `db reset`/`db lint` isolados EXIT 0; durabilidade cross-instance provada por nova instância (2 linhas persistidas); 26 testes; infraestrutura preparatória do novo fluxo Produto 1:1 — configuração de par principal/fallback, snapshot, política de falhas, resposta ao lojista e instrumentação; fluxo legado intocado. Plano 04: pricing ciente de qualidade — leitura aditiva por `quality` em `getModelPricing` (omitido = query legada byte a byte; informado = `.eq("quality")` sem bootstrap), cobertura `complete`/`partial`/`missing` por par `modelo+qualidade` com fail-closed `image_pair_pricing_incomplete` e custo por tentativa com versão/origem (`image-pair-pricing.ts`; 25 testes; typecheck/lint verdes; `cost-estimator.ts` sem diff). Plano 02: migration local-only aditiva (tabela `image_model_pair_config` + RPC auditada idempotente `admin_set_image_model_pair_config` + registro idempotente dos tres modelos elegiveis sob `campaign_product_image`, linha legada `campaign_image_edit`/`gpt-image-2` preservada; `db reset`/`db lint` EXIT 0 na instancia isolada `vendeo-f561-isolated`; commits `3b463a60`/`b5b18450`). Plano 01: contratos de par/capacidade `campaign_product_image`/taxonomia quota-billing/envelope/barreira fail-closed (95 testes, typecheck e lint verdes). Plano 05: componente puro de snapshot imutavel por operacao (`image-generation-config-snapshot.ts`) - builder tipado, resolucao nova-campanha x correcao, correlacao run/trace e tolerancia ao legado (16 testes; typecheck/lint verdes). Plano 06: classificador puro de elegibilidade ao fallback + maquina de tentativas com teto de 3 chamadas (2 principal + 1 fallback) e nao cobranca simulada de falha tecnica (`image-generation-failure-policy.ts`; 35 testes; typecheck/lint verdes). Plano 09: adapter de imagem do novo fluxo que propaga a qualidade ao wire + runtime isolado de registro do adapter + envelope por tentativa enriquecido de forma aditiva com `quality`/`target`/`attemptNumber` (`upstream-images.ts`, `upstream-images-runtime.ts`; 14 testes; typecheck/lint verdes). Plano 03: migration local-only aditiva do snapshot imutavel por campanha (colunas tipadas, origem fechada sem `default`, trigger de imutabilidade) + dimensao de qualidade no pricing (quality nullable + dois indices parciais de vigencia) + RPC `admin_set_ai_model_price` estendida com `p_quality` opcional ao final (12 parametros); coexistencia de vigencias provada na instancia isolada; `db reset`/`db lint` EXIT 0; commits `a854e54e`/`7e03f10a`/`c5af7c6f` |
| 56.2a | ◆ Preparação não operacional do Produto 1:1 | **Planejada** — contratos/componentes/estruturas **inativos** do novo fluxo Produto 1:1 (chaves `product_1_1_test_stores_enabled`/`product_1_1_all_stores_enabled` desligadas, sem rota/provider/crédito/entrega/download); fonte `openspec/changes/fase-56-2a-preparacao-nao-operacional-produto-1-1/`; depende da F56.1; pré-requisito da F56.2b1 |
| — | Monetização pública / Stripe | Diferida para v1.7+, fora da numeração |

## Current State

- F50 permanece encerrada: 17/17 planos e 17/17 summaries, em 10 waves; OpenSpec arquivado.
- F48.2.6 concluída, verificada, sincronizada e arquivada em 2026-10-05 (10/10 planos, UAT 5/5, CHECKPOINT B `approved_with_limitations`, 42/42 tasks). `/opsx-verify`, `/opsx-sync` e `/opsx-archive` executados; **8 specs principais sincronizados** (6 atualizados + 2 criados). Limitações e critérios UAT sem evidência permanecem `pending`; sem promoção produtiva.
- Demonstração pública, e-mail e signup público permanecem desativados; o beta fechado está preservado.
- F50.1 só deve ser constituída após a PJ: identidade legal, revisão/publicação dos documentos, migration efetiva, ativação ordenada e smoke test pós-corte.
- Monetização pública / Stripe permanece iniciativa diferida e não é fase numerada.
- **F48.2.5 — fechamento e verificação:** Planos 01–08 executados/summarized; 37/37 tasks; CHECKPOINT A aprovado; CHECKPOINT B aprovado com limitações/follow-ups. Sete gerações manuais (nenhuma chamada do executor). Candidato documental Sunburst medium somente para o caso Adega, sem promoção. Total confirmado na plataforma US$0,29; cálculo local US$0,288978; `reportedCostUsd` nulo nos runs e confirmação individual separada (medium US$0,06). Os 65 critérios permanecem `pending`, reconhecidos sem inferência. OpenSpec verificado/sincronizado/arquivado e GSD UAT concluído 5/5 PASS. Security review concluída em `48-2-5-SECURITY.md` (7 ameaças fechadas, 0 abertas), satisfazendo `workflow.security_enforcement`.

- F48.2.1 (**Bancada Manual de Prompts do Diretor**) esta **concluida e arquivada**: `48-2-1-01` a `48-2-1-05`, `48-2-1-07`, `48-2-1-08` e `48-2-1-09` concluidos; `48-2-1-06` interrompido e suplantado (summary de supersessao). Programa local `860ca4fe-...` `closed` (recusa novas reservas) e experimento `c48e21b5-...` `archived` (recusa execucoes), com historico preservado. Zero runs e zero custo; sem promocao. OpenSpec `017b8799` verificado, sincronizado e arquivado em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/` (commit `f55bed45`). Local-only.

- **Realinhamento F48.2.2 (2026-09-28) [histórico/suplantado]:** a direcao da F48.2.2 mudou. A F48.2.2 antiga (**Auditoria e Otimizacao do Prompt do Revisor**) foi **descartada/substituida** — implementacao nao iniciada, sem artefatos mantidos, recuperavel pelo historico do Git. A sequencia definida entao (**F48.2.2 — Fundacao da bancada de geracao no Admin/Laboratorio** -> **F48.2.3 — Experimento deterministico Oferta 1:1**) foi **superada** pela execucao real: F48.2.2 (bancada) e **F48.2.3 (Fidelidade experimental da bancada)** foram **concluidas/arquivadas**; o escopo "Experimento deterministico Oferta 1:1" passou a ser a **F48.2.4**. `openspec list` nao mostrava changes ativas naquela data (todas arquivadas) — **[histórico/superado]**; a change **`fase-48-2-4-experimento-deterministico-oferta-1-1`** foi **verificada, sincronizada e arquivada** em 2026-09-30 (`openspec/changes/archive/2026-09-30-fase-48-2-4-experimento-deterministico-oferta-1-1/`).

## Dependencies

- F23 e F24 são pré-requisitos históricos de F25; F25 alimenta F26/F27 e a operação de F28.
- F28 e F29 sustentam launch controls, observabilidade e readiness; F30 sustenta os gates legais.
- A cadeia de produto segue F31.1 → F31.2 → F31.3 → F32 → F33 → F34 → F35 → F36 → F37 → F38 → F38.1/F38.2 → F38.2.1 → F39 → F40 → F41 → F42 → F43 → F45 → F46 → F47 → F48.1 → F48.2.1 → F49 → F50.
- **Trilha do novo fluxo Produto 1:1:** F56.1 (infraestrutura preparatória, concluída/arquivada em 2026-10-06) → **F56.2a** (preparação não operacional, planejada) → F56.2b1 (núcleo ponta a ponta, chaves desligadas) → F56.2b2 (copy recuperável e piloto). A F56.2 original foi reconciliada nas três fatias (`RECONCILIATION.md` na change arquivada). Aprovação/correção permanecem na F56.3.
- **Trilha do laboratório:** F48.2.1 a F48.2.4 concluídas/arquivadas; F48.2.5 com 8/8 planos/summaries, 37/37 tasks, OpenSpec arquivado, GSD UAT 5/5 PASS e security review 7/7 fechada em `48-2-5-SECURITY.md`. CHECKPOINT B aprovado com limitações; 65 critérios `pending` reconhecidos; sete gerações encerradas; candidata documental Sunburst medium restrita à Adega, sem promoção. F48.2.6 (**Validação experimental Produto — intenções 1:1**) também **concluída, verificada, sincronizada e arquivada** em 2026-10-05 (10/10 planos, 42/42 tasks, UAT 5/5, CHECKPOINT B `approved_with_limitations`, 8 specs principais sincronizados, limitações UAT `pending`, sem promoção produtiva). “Refinamento experimental” era rótulo provisório. A antiga F48.2.2 (Revisor) foi descartada/substituída.
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

## Phase 48.2.6: Validacao experimental Produto intencoes 1:1

**Goal:** habilitar e validar manualmente as políticas de Oferta, Destaque e Exclusivo somente para Produto 1:1, com matriz preço × intenção e validade aplicadas no cliente/servidor, preflight revalidado e evidência documental sem promoção produtiva.

**Nome:** Validação experimental Produto — intenções 1:1

**Status:** **CONCLUÍDA, VERIFICADA, SINCRONIZADA e ARQUIVADA** em 2026-10-05 — 10/10 planos/summaries, 42/42 tasks, GSD UAT 5/5 pass e CHECKPOINT B `approved_with_limitations`; limitações aceitas e critérios sem evidência permanecem `pending`. `/opsx-verify`, `/opsx-sync` e `/opsx-archive` executados; **8 specs principais sincronizados** (6 atualizados + 2 criados). Sem novas chamadas do executor, promoção ou push remoto.

**Planejamento:** 10 planos, no limite superior orientativo do guia; a sequência mantém os gates de segurança, CHECKPOINT A, preparação documental e CHECKPOINT B como barreiras distintas, sem ampliar a change.

**Fonte normativa:** `openspec/changes/archive/2026-10-05-fase-48-2-6-validacao-experimental-produto-intencoes-1-1/` (proposal, design, tasks e specs arquivados); specs principais sincronizados em `openspec/specs/`.

**Gates operacionais:** `workflow.security_enforcement=true`, ASVS L1 e bloqueio em ameaças high; cada plano deve conter threat model e gates de segurança. CHECKPOINT A precede qualquer teste pago. CHECKPOINT B é UAT manual conduzido pelo usuário, com confirmação financeira individual por geração; nenhuma chamada autônoma, batch ou promoção.

## F50.1 — Formalização Legal e Ativação da Demonstração

**Status:** Futura — aguardando constituição da PJ; não planejada e não ativa.

**Escopo futuro:** definir razão social, CNPJ, endereço e fornecedor responsável; substituir placeholders e datas; validar juridicamente Termos, Privacidade e AUP; revisar autoack de suporte; sincronizar documentos; criar/aplicar migration efetiva de publicação; ativar flags na ordem aprovada; validar e-mail, credenciais e requisitos operacionais; executar smoke test pós-corte; manter rollback documentado.

## Phase 56.1: Contrato produtivo, modelos e fallback

**Goal:** preparar a infraestrutura produtiva do novo fluxo de imagem Produto 1:1 — configuração administrativa auditável de um par principal e um par fallback (modelo + qualidade) restrita a um catálogo elegível fechado, contrato de snapshot imutável por operação, política explícita de falhas e fallback, resposta pública identificável sem vazar motivo interno, e instrumentação de qualidade/telemetria/custo — como componentes e testes simulados, sem ativar geração, sem debitar crédito e sem alterar o fluxo legado.

**Nome:** Contrato produtivo, modelos e fallback

**Status:** ✓ **CONCLUÍDA, VERIFICADA, SINCRONIZADA e ARQUIVADA em 2026-10-06 — 11/11 planos GSD; UAT humano APROVADO no escopo preparatório/local; OpenSpec 55/55 tasks (9.4 concluída); GSD verify-work 10/10 PASS (`56.1-GSD-UAT.md`); `/opsx-verify` → `/opsx-sync` → `/opsx-archive` executados e arquivados (3 specs principais atualizadas + 5 criadas).** (Plano 11: guard de isolamento/não-regressão do legado + teste REAL da RPC auditada na instância isolada (gravação/auditoria/idempotência) + gates/UAT sem provider + VERIFICATION; Plano 07: resposta pública IMG-001 + referência opaca UUID v4 + tabela durável imutável + repositório server-only com client injetável + rota admin de correlação read-only; `db reset`/`db lint` isolados EXIT 0; durabilidade cross-instance provada; 26 testes; Plano 01: contratos de par/capacidade/taxonomia/envelope/barreira fail-closed; 95 testes; Plano 02: migration local-only da tabela do par + RPC auditada; Plano 03: migration local-only do snapshot imutável + dimensão de qualidade no pricing + RPC de preço estendida; Plano 04: pricing ciente de qualidade (leitura aditiva por `quality`, cobertura fail-closed por par, custo por tentativa); Plano 05: componente puro de snapshot por operação; Plano 06: política pura de falhas/fallback; Plano 09: adapter/runtime isolado do novo fluxo + envelope por tentativa; typecheck/lint verdes; OpenSpec 55/55 tasks; lifecycle executado). Sem `db push`, sem chamada paga e sem ativação; fluxo legado intocado; validação de migrations em instância Supabase descartável comprovadamente isolada.

**Depends on:** F46 (gateway único) e F47 (catálogo/seleção de modelos); F48.2.1–F48.2.6 (evidência experimental, insumo — não autorização de promoção). Não depende de F50.1–F55; a numeração F56 não obriga executá-las antes.

**Requirements:** REQ-56.1-01, REQ-56.1-02, REQ-56.1-03, REQ-56.1-04, REQ-56.1-05, REQ-56.1-06, REQ-56.1-07, REQ-56.1-08, REQ-56.1-09, REQ-56.1-10, REQ-56.1-11, REQ-56.1-12, REQ-56.1-13, REQ-56.1-14, REQ-56.1-15, REQ-56.1-16, REQ-56.1-17, REQ-56.1-18, REQ-56.1-19, REQ-56.1-20, REQ-56.1-21, REQ-56.1-22, REQ-56.1-23, REQ-56.1-24, REQ-56.1-25, REQ-56.1-26, REQ-56.1-27

**Fonte normativa (arquivada):** `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/` — `proposal.md`, `design.md` (D1–D12), `tasks.md` (55 tasks em 10 seções) e 8 specs (`image-generation-model-pair-config`, `image-generation-config-snapshot`, `image-generation-failure-policy`, `image-generation-support-reference`, `image-generation-instrumentation`, `ai-model-catalog`, `ai-model-pricing`, `ai-invocation-gateway`). `openspec validate --strict` válido.

**Escopo de alto nível:**
- configuração global auditável (RPC `SECURITY DEFINER`, motivo obrigatório, `operation_id`) de par principal/fallback `modelo + qualidade`, isolada de `ai_model_selection`;
- catálogo elegível fechado: `gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` em `low`/`medium`, registrados no `ai_model_catalog` sob capacidade própria `campaign_product_image` (sem vazar para capacidades legadas nem ativar geração);
- escolha inicial registrada como decisão humana: principal `gpt-image-2.5-sunburst / medium`, fallback `gpt-image-2 / medium` — **não ativa em produção**;
- snapshot imutável por campanha (par principal/fallback, versão UUID, origem), com nova campanha usando a versão vigente e correção reutilizando o snapshot original;
- política de falhas: até 2 tentativas no principal + 1 no fallback, máximo 3 chamadas; `rate_limit` transitório; quota/faturamento/autenticação/conteúdo/entrada **sem** fallback; falha técnica não cobrada;
- resposta pública `IMG-001` + referência opaca UUID v4, uma categoria genérica de falha de geração, com correlação interna segura no admin/suporte;
- instrumentação: qualidade até o adapter, um envelope de telemetria por tentativa (modelo–qualidade–alvo–`attempt_number`), custo por par modelo–qualidade;
- pricing fail-closed no novo fluxo (cobertura `complete` exigida na execução), cadeia do legado (`fallback_static`/`not_available`) intacta.

**Fora de escopo da F56.1 (fatias posteriores):** formulário do lojista, seletor de intenção (Oferta/Destaque/Exclusivo), direção de fundo, formato 1:1, chaves de ativação por loja, geração produtiva pelo novo fluxo, aprovação/reprovação humana, cobrança por correção, revisão automática e regeneração F37. A gravação do snapshot numa campanha real, o não-débito transacional e a aplicação da política sobre geração real são integração da **F56.2**.

**Fronteira de verificação F56.1 × F56.2:** os critérios que descrevem operações reais (snapshot no início de campanha, não-cobrança de falha técnica e aplicação da política de tentativas sobre geração) são entregues e verificados na F56.1 como **contrato/componente testado por simulação** (sem campanha, sem provider, sem crédito real). Os demais critérios (configuração, catálogo, fail-closed, pricing, referência, isolamento) são verificáveis integralmente na F56.1.

**Checkpoint humano:** a implementação só começa após aprovação explícita do responsável sobre a escolha do par principal/fallback e as decisões técnicas — já fechadas no planejamento (capacidade `campaign_product_image`; código `IMG-001` + referência UUID v4 opaca; uma categoria pública genérica; snapshot em colunas dedicadas tipadas; gravação com pricing incompleto permitida no admin, execução exige cobertura `complete` para principal e fallback). A integração real é F56.2.

**Gates operacionais:** `workflow.security_enforcement=true`, ASVS L1 e bloqueio em ameaças high; cada plano deve conter threat model. Sem `db push` remoto antes da aprovação; sem chamada paga; sem promoção. `openspec validate --strict` e `gsd-plan-checker` obrigatórios.

**Planos:** diretório `.planning/phases/56.1-contrato-produtivo-modelos-e-fallback/`.

**Canonical refs:** `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/` (proposal/design/tasks/specs), `docs/alinhamento-roadmap-pos-f48-1.md` §F56, `openspec/design-system/MASTER.md`, `src/lib/ai/*`, `src/lib/ai-cost/*`, `src/app/api/admin/*`.

## Phase 56.2a: Preparação não operacional do Produto 1:1

**Goal:** Entregar contratos, componentes e estruturas **inativos** do novo fluxo Produto 1:1 — seletores de intenção e fundo (domínio puro + componentes apresentacionais, sem wiring), composição produtiva versionada dos prompts aprovados na F48.2.6, estruturas de snapshot e histórico append-only por operação/tentativa, e o registro das duas chaves desligadas por padrão em `feature_flags` — com testes de equivalência e de decisão server-side, **sem** expor ao lojista e **sem** permitir ativação de um caminho incompleto.

**Nome:** Preparação não operacional do Produto 1:1

**Status:** ◆ **Planejada (6 planos criados)** — aguardando aprovação do responsável antes da execução. Nenhuma implementação, migration remota, `db push`, chamada paga, commit de código ou deploy antes da aprovação do responsável. A chave **não** encaminha campanhas reais nesta fatia.

**Depends on:** F56.1 (contrato produtivo, modelos e fallback — infraestrutura preparatória); F46 (gateway único) e F47 (catálogo); evidência experimental F48.2.1–F48.2.6 como insumo (não é autorização de promoção). É pré-requisito declarado da F56.2b1. Não depende de F50.1–F55.

**Requirements:** REQ-56.2a-01, REQ-56.2a-02, REQ-56.2a-03, REQ-56.2a-04, REQ-56.2a-05, REQ-56.2a-06, REQ-56.2a-07, REQ-56.2a-08, REQ-56.2a-09, REQ-56.2a-10, REQ-56.2a-11, REQ-56.2a-12, REQ-56.2a-13, REQ-56.2a-14, REQ-56.2a-15, REQ-56.2a-16, REQ-56.2a-17, REQ-56.2a-18, REQ-56.2a-19

**Fonte normativa (ativa):** `openspec/changes/fase-56-2a-preparacao-nao-operacional-produto-1-1/` — `proposal.md`, `design.md` (A-D1…A-D7), `tasks.md` (31 tasks em 6 seções; o design.md citava "27", mas o tasks.md real tem 31 checkboxes) e 5 specs (`product-1-1-flow-activation`, `product-1-1-intent-background-selection`, `product-1-1-prompt-composition` [novas]; `image-generation-config-snapshot`, `feature-flag-control` [deltas aditivos]).

**Reconciliação:** substitui parte da change `fase-56-2-novo-fluxo-geracao-produto-1-1` (relocada para `openspec/changes/archive/2026-10-06-fase-56-2-novo-fluxo-geracao-produto-1-1/`; ver `RECONCILIATION.md`). A change original é preservada e marcada como substituída; não é descartada silenciosamente.

**Decisões fechadas pelo responsável (2026-10-06):**
- Nomes literais das chaves: `product_1_1_test_stores_enabled` (lojas com `is_test_store=true`) e `product_1_1_all_stores_enabled` (todas as lojas); ambas desligadas por padrão e alteráveis pela RPC auditada existente `admin_update_feature_flag`. Precedência: a chave **geral prevalece**.
- Seleção: **domínio puro + componentes React apresentacionais, sem wiring**, não montados no fluxo do lojista; a regra "Original exige exatamente uma imagem de produto (identidade não conta)" vive no domínio como **erro de campo** (nunca `IMG-001`).
- UI-SPEC: **pular nesta fatia** (`--skip-ui`) — os componentes não serão montados; seguir `openspec/design-system/MASTER.md`; criar UI-SPEC na F56.2b1, quando a interface for conectada e visível.

**Escopo de alto nível:**
- registro das duas chaves em `feature_flags` (default desligado) + função pura/server-side de decisão fail-closed com precedência da chave geral;
- domínio de seleção explícita de intenção (Oferta/Destaque/Exclusivo) e direção de fundo (Estúdio/Ambientado/Original) + componentes apresentacionais inativos; regra de Original e erro de campo; teste de não-exposição ao lojista;
- módulo produtivo versionado e congelado (Produto v4/compositor v5/três intenções/fundo escolhido), sem leitura de configuração mutável da bancada em runtime; testes de **equivalência** com a bancada F48.2.6 aprovada;
- relação **append-only** de operações/tentativas vinculada à campanha e ao snapshot original + contrato de reuso do snapshot original (`resolveConfigForCorrection`), sem sobrescrever `run_id`/`trace_id`;
- **barreira de não-ativação**: nenhuma rota de geração, chamada ao provider, reserva de crédito, entrega ou download pelo novo fluxo nesta fatia.

**Fora de escopo (fatias posteriores):** roteamento/ativação efetiva, controles administrativos auditados, formulário conectado, orquestração/preflight/crédito transacional, arte 1024×1024/download — **F56.2b1**; botão "Tentar gerar copy novamente", testes integrados/E2E e piloto controlado — **F56.2b2**; aprovação/reprovação/correção — **F56.3**.

**Gates operacionais:** `workflow.security_enforcement=true` (ASVS L1, bloqueio em ameaças high) — cada plano contém threat model; prova de não-regressão do legado (fronteira produtiva vazia nos caminhos legados); migrations/`db reset`/`db lint` validados **apenas** em instância Supabase descartável comprovadamente isolada, **sem** `db push` remoto; `openspec validate --strict` e `gsd-plan-checker` obrigatórios; nenhuma chamada paga.

**Checkpoint humano:** a implementação só começa após aprovação explícita do responsável sobre os planos. Nesta fatia a chave permanece ineficaz.

**Planos:** diretório `.planning/phases/56.2-preparacao-nao-operacional-produto-1-1/` (token GSD `56.2`; rótulo funcional **F56.2a**). **Tokens reservados para as fatias seguintes (não reutilizar `56.2`):** F56.2b1 = `56.3`, F56.2b2 = `56.4` (a reservar/registrar quando cada fatia for formalmente planejada).

**Plans:** 6 plans

Plans:
- [ ] 56-2-01-PLAN.md — Chaves de ativação em `feature_flags` (desligadas) + decisão server-side fail-closed com precedência + migration local do seed.
- [ ] 56-2-02-PLAN.md — Domínio puro e componentes apresentacionais inativos de seleção de intenção/fundo (regra de Original, erro de campo, não-exposição).
- [ ] 56-2-03-PLAN.md — Módulo produtivo de composição versionada e congelada (Produto v4/compositor v5) com testes de equivalência à bancada F48.2.6.
- [ ] 56-2-04-PLAN.md — Migration local append-only de operações/tentativas + repositório server-only + contrato de reuso do snapshot original.
- [ ] 56-2-05-PLAN.md — Testes transversais de não-ativação/não-exposição + não-regressão do legado + gates e `openspec validate --strict`.
- [ ] 56-2-06-PLAN.md — Validação [BLOCKING] das migrations em instância isolada + UAT sem provider + checkpoint humano + tracking.

**Ondas:** Onda 1 paralela — `56-2-01`, `56-2-02`; Onda 2 — `56-2-03` (depende de `56-2-02`; importa a fonte única de direção de fundo) e `56-2-04` (depende de `56-2-01`; migrations serializadas); Onda 3 — `56-2-05` (depende de `56-2-01`..`56-2-04`); Onda 4 — `56-2-06` (depende de `56-2-05`; verificação final, `autonomous: false` por checkpoint).

**Canonical refs:** `openspec/changes/fase-56-2a-preparacao-nao-operacional-produto-1-1/` (proposal/design/tasks/specs), `openspec/changes/archive/2026-10-06-fase-56-2-novo-fluxo-geracao-produto-1-1/RECONCILIATION.md`, `openspec/changes/archive/2026-10-06-fase-56-1-contrato-produtivo-modelos-fallback/`, `openspec/design-system/MASTER.md`, `src/lib/feature-flags/*`, `src/lib/lab/bench/domain/*`, `src/lib/ai/image-generation-config-snapshot.ts`, `supabase/migrations/*`.

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
