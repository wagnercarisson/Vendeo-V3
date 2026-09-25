# Tasks — F48.2.2: Auditoria e Otimização do Prompt do Revisor

> Segunda fatia do guarda-chuva **F48.2 — Qualidade e otimização dos prompts**. Depende da **F48.2.1** concluída e verificada. Dividida em **5 plans** (`48-2-2-01..48-2-2-05`). Specs: `specs/lab-review-cases`, `specs/lab-reviewer-audit`, `specs/lab-experiments`, `specs/lab-runs`, `specs/lab-human-evaluation`, `specs/lab-admin-api`, `specs/lab-admin-ui`, `specs/lab-isolation`, `specs/lab-gateway-harness`, `specs/lab-prompt-optimization`. Design: `design.md`.
>
> **Dependência explícita:** F48.2.1 concluída e verificada. Esta change não depende de artefatos não implementados dela; apenas estende o laboratório e o programa já existentes.
>
> **Fronteira:** sem alteração do Revisor produtivo, sem promoção, canário ou `db push` remoto (F48.2.3). Sem absorver o escopo avançado da F48.3 (múltiplos avaliadores, concordância, automação geral de avaliação). A F48.2.3 cobre apenas os prompts vencedores, o canário do fluxo de aprovação e o rollback desses prompts/flag; a homologação/promoção geral permanece na F48.6.
>
> **Regra de isolamento:** nada de `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `ai_model_catalog`, `admin_audit_log`, `prompts/` oficiais ou bucket `campaign-images`. Nenhum secret em banco/log/snapshot. Nenhuma chamada paga em testes/CI. Modelo fixo: `openai/gpt-4o/chat-completions`.
>
> **Método cego (obrigatório):** nunca executar avaliação comparativa "baseline-only". O experimento do Revisor é **sempre baseline × candidata**, criado e executado por completo antes de qualquer revelação; o holdout só é revelado após **todos os runs, variantes, repetições e casos holdout do experimento** estarem avaliados às cegas (lote = `experiment_id`, revelação registrada atomicamente). O corpus de desenvolvimento (diagnóstico conhecido) serve ao refino; o holdout (diagnóstico oculto) só é usado na comparação cega final, e um holdout revelado não é reutilizado pelo mesmo avaliador em qualquer programa.
>
> **Ordem dos checkpoints:** (1) aprovação dos casos de revisão → (2) autorização de orçamento → (3) execução (baseline × candidata) → (4) avaliação cega completa → (5) revelação e classificação → (6) decisão final por variante.
>
> **Dependências:** 48-2-2-01 ← 48-2-2-02; 48-2-2-02 ← 48-2-2-03; 48-2-2-03 ← 48-2-2-04; 48-2-2-04 ← 48-2-2-05.

## 1. Casos de revisão, fixtures e integridade (48-2-2-01)

- [ ] 1.1 Criar migration **local aditiva**: `lab_experiments.kind` (`director`/`reviewer`), tabelas `lab_review_cases` (com `corpus_role` `development`/`holdout`) e `lab_review_case_versions` (`scenario_version_id`, `image_origin`, `image_ref`, `image_hash`, `expected_diagnosis`, `expected_defect_categories`, `content`, `content_hash`, `fixture_path`; `UNIQUE(review_case_id, version)`) e junção `lab_experiment_review_cases` — design D2/D3
- [ ] 1.2 Criar o schema do caso de revisão (`src/lib/lab/review-cases/schema.ts`) e o serviço (carregar/listar versões; `realpath` confinado; `image_hash`; `corpus_role`; bootstrap idempotente) — design D3
- [ ] 1.3 Criar fixtures de campanhas finalizadas em `fixtures/lab/review-cases/<slug>/` (`case.json` + `campaign.(png|jpg)`) cobrindo: adequada, preço incorreto, preço proibido em exclusivo, texto obrigatório ausente, CTA inventado, nome de loja incorreto, produto deformado, baixa legibilidade e falso defeito tentador; separar os casos em corpus de **desenvolvimento** e **holdout** — design D3
- [ ] 1.4 Implementar o caminho de amostra exploratória (arte do Diretor vira caso de revisão somente após diagnóstico humano próprio) — design D3
- [ ] 1.5 Escrever bloco REVERT e testar a migration **localmente** (`npx supabase db reset` + `db lint`): reaplicação idempotente, imutabilidade de `lab_review_case_versions` — design D2
- [ ] 1.6 Testes: hash determinístico, `review_case_hash_mismatch`, `invalid_review_case_path` (path traversal/symlink), idempotência, papéis de corpus separados, categorias limitadas ao contrato do Revisor (sem logo) — design D3
- [ ] 1.7 **Checkpoint humano 1 — aprovação dos casos de revisão**: registrar o corpus aprovado (desenvolvimento e holdout) antes de qualquer execução paga — spec `lab-prompt-optimization`; design D9

## 2. Modo Revisor, execução isolada e congelamento (48-2-2-02)

- [ ] 2.1 Adicionar o modo `reviewer` ao domínio do experimento (`kind`, prompt `campaign-image-reviewer`, alvo `campaign_image_review`, casos vinculados) — design D2/D4
- [ ] 2.2 Adicionar a `lab_runs` as colunas de revisão (`run_kind`, `review_case_version_id`, `review_response`, `review_passed`, `review_issues`, `review_failure_type`, `review_parse_error`) — design D2/D4
- [ ] 2.3 Implementar o **congelamento** do experimento do Revisor após o primeiro run: `kind` imutável; `INSERT`/`UPDATE`/`DELETE` bloqueados em `lab_experiment_review_cases`; e o `review_case_version_id` do run pertencente ao conjunto congelado — design D2
- [ ] 2.4 Implementar a resolução da imagem do caso (fixture via guard; artifact via storage/URL assinada) com conferência de `image_hash` e conversão em data URL — design D4
- [ ] 2.5 Implementar o mapper do laboratório para `ImageReviewInput` a partir do brief/fatos congelados, reutilizando `buildReviewPromptVariables` sem alterar a produção — design D4
- [ ] 2.6 Implementar a execução do Revisor: `campaign_image_review` direto no gateway laboratorial com alvo fixo e `LabPromptLoader`, sem geração de arte; persistir as evidências — design D4
- [ ] 2.7 Garantir o snapshot cego (apenas referência ao caso e hash da imagem) e o erro de parse/schema como registro explícito (nunca aprovação) — design D4
- [ ] 2.8 Testes do Revisor: alvo fixo `gpt-4o/chat-completions`, nenhuma chamada de geração, nenhum artefato de arte, evidências persistidas, erro de parse registrado, snapshot cego, congelamento pós-run, `generation_events`/`ai_model_selection` intocados — design D2/D4

## 3. Avaliação cega, revelação e classificação por run (48-2-2-03)

- [ ] 3.1 Criar a tabela **append-only** `lab_reviewer_blind_assessments` (`experiment_id`, `review_case_version_id`, `run_id`, `blind_assessment`, `observed_categories`, `evaluator_id`, `created_at`; sem UPDATE/DELETE; `UNIQUE(run_id, evaluator_id)`) — design D2/D5
- [ ] 3.2 Criar a tabela **append-only** `lab_reviewer_classifications` (`experiment_id`, `review_case_version_id`, `run_id`, `classification`, `observed_categories`, `evaluator_id`, `created_at`; sem UPDATE/DELETE; `UNIQUE(run_id, evaluator_id)`) — design D2/D5
- [ ] 3.3 Criar a tabela **append-only** `lab_reviewer_holdout_reveals` (`program_id`, `experiment_id`, `review_case_version_id`, `evaluator_id`, `revealed_at`; sem UPDATE/DELETE; `UNIQUE(review_case_version_id, evaluator_id)`) — design D2
- [ ] 3.4 Implementar o gate de revelação **pelo experimento inteiro** (lote = `experiment_id`): liberar o diagnóstico somente após avaliações cegas de **todos os runs, variantes, repetições e casos holdout do experimento**; registrar as revelações do lote **atomicamente**; recusar reutilização de holdout revelado pelo mesmo avaliador em **qualquer programa**; garantir que nenhuma avaliação comparativa "baseline-only" exista — design D5
- [ ] 3.5 Implementar a classificação por run (`false_positive`/`false_negative`/`correct`/`correct_wrong_reason`/`inconclusive`), exigindo decisão **e** categoria compatíveis para `correct`, e exigindo avaliação cega correspondente + revelação autorizada — design D5
- [ ] 3.6 Implementar a **ordem de dominância por tipo de caso** (`adequate`: `correct` > `inconclusive` > `false_positive`; `defect`: `correct` > `correct_wrong_reason` > `inconclusive` > `false_negative`) e a regra de vitória do Revisor — design D6
- [ ] 3.7 Testes: cegueira (revelação bloqueada sem avaliação cega completa), ausência de baseline-only, unicidade por run/avaliador, classificação exigindo cega+revelação, ciclo de vida do holdout (revelado não é reutilizado), entidades separadas e append-only, motivo errado, dominância determinística, regra de vitória — design D5/D6

## 4. API, UI e isolamento (48-2-2-04)

- [ ] 4.1 Criar `GET /api/admin/laboratorio/review-cases` e `GET /review-cases/[id]` (somente leitura; **sem** diagnóstico) e `GET /experiments/[experimentId]/review-cases/[caseVersionId]/reference` (revelação protegida pelo experimento inteiro, com registro atômico do lote) — design D8
- [ ] 4.2 Criar `POST /experiments/[id]/reviewer-blind-assessments` e `POST /experiments/[id]/reviewer-classifications` (append-only, por run) — design D8
- [ ] 4.3 Estender `POST /experiments` (modo `reviewer` + casos) e a rota de execução (caminho `reviewer`, `review_case_hash_mismatch`, orçamento do programa, pertencimento ao conjunto congelado) — design D8
- [ ] 4.4 Estender `GET /runs/[id]` com as evidências de revisão e a imagem avaliada (URL assinada) **sem** o diagnóstico — design D8
- [ ] 4.5 Criar o fluxo de UI do Revisor (casos, fatos, aviso de que nenhuma arte é gerada, revelação cega do holdout em etapas por lote) e a classificação por run; conformidade com `openspec/design-system/MASTER.md` — design D8
- [ ] 4.6 Estender `architecture-guard` e os testes de isolamento do modo Revisor (sem geração de arte, sem pipeline produtivo, modelo fixo, sem chamadas reais) — design D9
- [ ] 4.7 Testes de rota e UI: 403/400/409/422, listagem sem diagnóstico, revelação bloqueada/liberada, classificação por run, execução sem confirmação, hash divergente — design D8

## 5. Auditoria, otimização, relatório e fechamento (48-2-2-05)

- [ ] 5.1 Preparar ambiente local e bootstrap do corpus de casos de revisão (desenvolvimento + holdout); confirmar a chave/projeto de desenvolvimento — design D9
- [ ] 5.2 Calcular o teto de orçamento pela estimativa (por capability, com margem explícita) e registrar — design D9
- [ ] 5.3 **Checkpoint humano 2 — autorização de orçamento**: registrar em `lab_prompt_programs` o valor em USD, autor e timestamp antes de qualquer chamada paga — spec `lab-prompt-optimization`; design D9
- [ ] 5.4 Usar o **corpus de desenvolvimento** (diagnóstico conhecido) para entender as falhas e redigir a candidata do Revisor (regras de simplicidade; tamanho + justificativa) — design D3/D7
- [ ] 5.5 Criar o **experimento completo baseline × candidata** do Revisor sobre o **corpus holdout** e executar **os dois lados** (3 casos por tipo de campanha, experimentos separados), sem geração de arte — design D4/D5
- [ ] 5.6 **Checkpoint humano 4 — avaliação cega completa do experimento**: registrar a avaliação cega de **todos os runs, variantes, repetições e casos holdout do experimento**, **sem** revelar nenhum diagnóstico — spec `lab-prompt-optimization`; design D5
- [ ] 5.7 **Checkpoint humano 5 — revelação e classificação**: revelar o diagnóstico do holdout e classificar **cada run** (falso positivo/falso negativo/acerto/acerto por motivo errado/inconclusivo) — spec `lab-prompt-optimization`; design D5
- [ ] 5.8 Aplicar a regra de vitória do Revisor (dominância por tipo de caso; mais `correct`; sem aumentar falsos positivos/negativos) e o critério de parada; **após o holdout, apenas recomendar ou rejeitar** — novo refinamento volta ao corpus de desenvolvimento e uma nova comparação exige holdout não revelado — design D6/D7
- [ ] 5.9 Confirmar que a produção permaneceu inalterada e que o Revisor produtivo não foi tocado — design D9
- [ ] 5.10 Produzir o **relatório final do Revisor** em Markdown versionado (falsos positivos, falsos negativos, acertos por motivo errado, variantes vencedoras/rejeitadas e recomendação) e registrar em `lab_prompt_programs` a referência, o hash, os checkpoints e a decisão — spec `lab-prompt-optimization`; design D9
- [ ] 5.11 **Checkpoint humano 6 — decisão final por variante**: registrar a recomendação do Revisor sem promoção automática — spec `lab-prompt-optimization`; design D9
- [ ] 5.12 Gerar `48-2-2-VERIFICATION.md` e `48.2.2-UAT.md`, confirmando a fronteira local, a não-alteração do Revisor produtivo e o método cego (desenvolvimento × holdout); atualizar registros e preparar arquivamento
