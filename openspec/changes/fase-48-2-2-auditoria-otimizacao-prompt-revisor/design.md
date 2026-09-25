# Design — F48.2.2: Auditoria e Otimização do Prompt do Revisor

## Context

A **F48.2.2** é a segunda fatia do guarda-chuva **F48.2 — Qualidade e otimização dos prompts** e tem **dependência explícita da F48.2.1** (Otimização dos Prompts do Diretor), concluída e verificada. Ela reaproveita a bancada da F48.1 e o programa de otimização introduzido pela F48.2.1.

Pontos de integração reais já existentes:

- `ImageReviewService.review(...)` monta o prompt por `campaign-image-reviewer` via `buildReviewPromptVariables` e invoca `campaign_image_review` pelo `AiInvoker` injetado (`src/lib/image-generation/services/image-review-service.ts:46`, `:68`).
- O prompt produtivo do Revisor declara expressamente que **não recebe a imagem de identidade** e verifica apenas o nome da loja (`prompts/campaign-image-reviewer.md:49`).
- Modelo produtivo do Revisor: `campaign_image_review` → `openai/gpt-4o/chat-completions` (`src/lib/ai/model-registry.ts:106`).
- `LabPromptLoader`/`LabModelResolver`/`createLabGateway` já servem override e alvo fixo (`src/lib/lab/gateway/*`).

Restrições: a produção permanece **byte a byte idêntica**; o contrato de entrada do Revisor produtivo **não** é alterado; a fase é **integralmente local/desenvolvimento** e nada é promovido. A promoção fica para a **F48.2.3 — Promoção, Canário e Prontidão da Aprovação**.

## Goals / Non-Goals

**Goals:**

- Modo `reviewer` no laboratório, com alvo fixo `gpt-4o/chat-completions`.
- Casos de revisão imutáveis ligados à imagem exata, com integridade de hash.
- Corpus de fixtures de campanhas finalizadas com defeitos conhecidos.
- `campaign_image_review` isolado e sem geração de arte.
- Avaliação cega separada da classificação, ambas append-only.
- Revelação do diagnóstico somente após a avaliação cega de todos os runs/repetições aplicáveis.
- Classificação independente de baseline e candidata e auditoria de FP/FN/motivo errado.
- Otimização do prompt do Revisor, relatório e recomendação.

**Non-Goals:**

- Alterar o Revisor produtivo, seu contrato de entrada ou seu comportamento.
- Promoção, canário, `db push` remoto, `campaign_approval_enabled` (F48.2.3).
- Escopo avançado da F48.3 (múltiplos avaliadores, concordância, automação geral de avaliação).
- Julgar fidelidade visual de logo no Revisor (fora do contrato de entrada).
- Novos tipos/formatos, i18n, migração de storage.

## Decisions

### D1 — Dependência e fronteira

A F48.2.2 assume a F48.2.1 implementada (matriz, programa, orçamento atômico, rubrica, relatório). Ela **estende** o programa de otimização ao Revisor sem tocar o Diretor nem a produção. A migration é aditiva e local-only; `db push` remoto é da F48.2.3.

### D2 — Modelo de dados: casos de revisão, modo e classificação

| Objeto | Evolução | Papel |
|---|---|---|
| `lab_experiments` | `+ kind TEXT CHECK ('director','reviewer') DEFAULT 'director'`; `primary_capability` aceita `campaign_image_review` | Modo do experimento |
| `lab_review_cases` (nova) | catálogo: `slug`, `name`, `description`, `campaign_intent`, `corpus_role` (`development`/`holdout`), `status`, `current_version`, autoria/timestamps | Casos de revisão |
| `lab_review_case_versions` (nova) | `review_case_id`, `version`, `scenario_version_id`, `image_origin` (`fixture`/`director_artifact`), `image_ref`, `image_hash`, `expected_diagnosis` (`adequate`/`defect`/`inconclusive`), `expected_defect_categories JSONB`, `content`, `content_hash`, `fixture_path`, `notes`; `UNIQUE(review_case_id, version)` | Caso imutável ligado à imagem |
| `lab_experiment_review_cases` (nova) | junção ordenada experimento × versão de caso | Conjunto de casos do Revisor |
| `lab_runs` | `+ run_kind`; `+ review_case_version_id`; `+ review_response`, `review_passed`, `review_issues`, `review_failure_type`, `review_parse_error` | Evidências de revisão |
| `lab_reviewer_blind_assessments` (nova, **append-only**) | `experiment_id`, `review_case_version_id`, `run_id`, `blind_assessment JSONB`, `observed_categories JSONB`, `evaluator_id`, `created_at`; sem UPDATE/DELETE; `UNIQUE(run_id, evaluator_id)` | Avaliação cega **antes** da revelação |
| `lab_reviewer_classifications` (nova, **append-only**) | `experiment_id`, `review_case_version_id`, `run_id`, `classification`, `observed_categories JSONB`, `evaluator_id`, `created_at`; sem UPDATE/DELETE; `UNIQUE(run_id, evaluator_id)` | Classificação **depois** da revelação |
| `lab_reviewer_holdout_reveals` (nova, **append-only**) | `program_id`, `experiment_id`, `review_case_version_id`, `evaluator_id`, `revealed_at`; sem UPDATE/DELETE; `UNIQUE(review_case_version_id, evaluator_id)` | Registra a revelação/consumo do holdout |

- **Separação cega/classificação**: a avaliação cega e a classificação são entidades distintas; a revelação é o evento que separa as duas.
- **`scenario_version_id` em `lab_runs`**: no modo `reviewer`, derivado do caso de revisão (fatos congelados).
- **Congelamento do experimento do Revisor após o primeiro run**: `kind` fica imutável; a associação de casos (`lab_experiment_review_cases`) não pode ser adicionada, removida ou substituída; e o `review_case_version_id` de qualquer run SHALL pertencer ao conjunto congelado do experimento. Sem isso, o significado histórico do experimento mudaria.
- **Unicidade append-only**: `lab_reviewer_blind_assessments` e `lab_reviewer_classifications` têm `UNIQUE(run_id, evaluator_id)` — uma avaliação cega e uma classificação por run/avaliador. A classificação exige a avaliação cega correspondente e a revelação autorizada.
- **Ciclo de vida do holdout**: o **lote** é o `experiment_id`. A revelação/consumo é registrada em `lab_reviewer_holdout_reveals` (`UNIQUE(review_case_version_id, evaluator_id)`), de forma **atômica** para o lote. Um holdout revelado **não** pode ser reutilizado pelo mesmo avaliador em **qualquer programa**. Depois do holdout, a decisão é **somente recomendar ou rejeitar**; novo refinamento volta ao corpus de **desenvolvimento**, e uma nova comparação exige um holdout **ainda não revelado**.
- **Alternativa rejeitada**: uma única classificação na avaliação — não representa as duas respostas nem preserva a ordem cega/classificação.

### D3 — Caso de revisão ligado à imagem exata, com papéis de corpus

Um caso de revisão liga `{ scenarioVersionId, imageOrigin, imageRef, imageHash, expectedDiagnosis, expectedDefectCategories }` e pertence a um **papel de corpus**: `development` ou `holdout`. O diagnóstico **não** fica no cenário.

- **Corpus de desenvolvimento (`development`)**: diagnóstico **conhecido**; serve para entender falhas e refinar as candidatas. **Nunca** é usado para uma avaliação comparativa "baseline-only".
- **Corpus holdout (`holdout`)**: diagnóstico **oculto**; consumido apenas na comparação final baseline × candidata, com revelação somente após **todas** as variantes e repetições daquele lote estarem avaliadas às cegas.
- **Benchmark**: fixtures de campanhas finalizadas (`fixtures/lab/review-cases/<slug>/`), cobrindo adequada, preço incorreto, preço proibido em exclusivo, texto obrigatório ausente, CTA inventado, nome de loja incorreto, produto deformado, baixa legibilidade e falso defeito tentador.
- **Exploratório**: arte do Diretor vira caso de revisão (`imageOrigin: "director_artifact"`) só após diagnóstico humano próprio.
- **Integridade**: `image_hash` do disco conferido; divergência → `review_case_hash_mismatch`.
- **Confinamento**: `realpath` descendente estrito do diretório do caso; symlink para fora → `invalid_review_case_path`.
- **Alternativa rejeitada**: usar o mesmo caso para refino aberto e para comparação cega — depois que o avaliador conhece o diagnóstico, o cegamento se perde.

### D4 — Execução isolada do Revisor, sem geração de arte

- Imagem do caso lida server-side e convertida em data URL (fixture via guard; artifact via storage/URL assinada).
- Prompt montado por `buildReviewPromptVariables` (mapper do laboratório a partir do brief/fatos congelados) e servido pelo `LabPromptLoader`.
- Invocação `campaign_image_review` direto no gateway laboratorial, alvo fixo `gpt-4o/chat-completions`, sem provider de imagem, sem `campaign_image_edit`, sem retry.
- Evidências persistidas em `lab_runs`; erro de parse/schema registrado e **nunca** tratado como aprovação.
- **Snapshot cego**: guarda apenas `reviewCaseVersionId` e `imageHash` — **sem** diagnóstico em texto nem em hash (o espaço de diagnósticos é pequeno; um hash público poderia ser quebrado por força bruta).

### D5 — Cegueira verdadeira e classificação por run

**Nunca** existe avaliação comparativa "baseline-only": o experimento do Revisor é sempre baseline × candidata, criado e executado por completo **antes** de qualquer revelação.

Fluxo do **holdout** (lote = `experiment_id`):

1. o avaliador examina as **duas respostas** (baseline e candidata) sem ver o diagnóstico;
2. registra a **avaliação cega de cada run** (`lab_reviewer_blind_assessments`);
3. confirma;
4. **só então** a revelação é liberada por `GET /experiments/[experimentId]/review-cases/[caseVersionId]/reference`, e somente após avaliações cegas de **todos os runs, variantes, repetições e casos holdout do experimento** para o avaliador; as revelações do lote são registradas **atomicamente** em `lab_reviewer_holdout_reveals`;
5. classifica **cada run** (`lab_reviewer_classifications`): `false_positive`, `false_negative`, `correct`, `correct_wrong_reason`, `inconclusive`.

`correct` exige decisão correta **e** categoria compatível; rejeitar pelo motivo errado é `correct_wrong_reason`. A classificação é independente para baseline e candidata. O corpus de **desenvolvimento** tem diagnóstico conhecido e serve ao refino; o **holdout** é o único usado na comparação cega final. Depois do holdout, só se **recomenda ou rejeita**.

### D6 — Regra de vitória do Revisor

**Ordem de dominância por tipo de caso** (menor é melhor), aplicada à classificação agregada por caso:

- caso esperado `adequate`: `correct` > `inconclusive` > `false_positive`;
- caso esperado `defect`: `correct` > `correct_wrong_reason` > `inconclusive` > `false_negative`.

Por caso, a classificação agregada é a **moda** das repetições; sem maioria → `inconclusive`. A candidata é recomendada sse: (a) **nenhum caso** tem a classificação agregada da baseline **estritamente melhor** (dominância acima) que a da candidata; (b) a candidata tem **mais** `correct` que a baseline; (c) a candidata **não aumenta** `false_positive` nem `false_negative`. `correct_wrong_reason` e `inconclusive` não contam como `correct`. Empates, regressões e inconclusivos permanecem registrados; sem promoção automática.

### D7 — Ciclo de otimização do Revisor

Sequência uniforme: diagnosticar evidências e o baseline do Revisor → hipótese → **refinar apenas com o corpus de desenvolvimento** → **congelar a candidata final** → criar o experimento completo baseline × candidata → executar os dois lados → **avaliar uma vez no holdout** → **depois do holdout, somente recomendar ou rejeitar**. Uma nova candidata exige um **novo holdout não revelado**; nunca se refina sobre o holdout. O ciclo do Revisor só começa após o Diretor estabilizado (garantido pela dependência da F48.2.1).

### D8 — API e UI

- `GET /review-cases` e `GET /review-cases/[id]`: **sem** diagnóstico/categorias (apenas identificação, imagem/hash, tipo, fatos não sensíveis).
- `GET /experiments/[experimentId]/review-cases/[caseVersionId]/reference`: revelação só após avaliações cegas de **todos os runs, variantes, repetições e casos holdout do experimento**; as revelações do lote são registradas atomicamente.
- `POST /experiments/[id]/reviewer-blind-assessments` e `POST /experiments/[id]/reviewer-classifications`: append-only, por run.
- `POST /experiments` aceita `kind: "reviewer"` e o conjunto de casos; `POST /runs` escolhe o caminho pelo `kind`.
- UI: fluxo do Revisor com revelação cega em etapas e classificação por run; segue `openspec/design-system/MASTER.md`.

### D9 — Isolamento, modelos fixos e fronteira local

- Modo `reviewer` não gera arte e não dispara pipeline produtivo.
- Modelos fixos: revisão `openai/gpt-4o/chat-completions`.
- Categorias de defeito esperadas limitadas ao contrato de entrada (sem fidelidade visual de logo).
- Orçamento atômico do programa (F48.2.1) aplica-se igualmente ao Revisor.
- Migration local-only; `db push` remoto e promoção na F48.2.3.

## Risks / Trade-offs

- **[Cegueira burlada]** → diagnóstico fora de listagem/payloads/snapshot; revelação só após avaliação cega de todos os runs; entidades separadas.
- **[Classificação única mascarar baseline/candidata]** → classificação append-only por run.
- **[Diagnóstico atrelado à imagem errada]** → caso imutável com `image_hash` verificado.
- **[Revisor julgando o que não vê]** → categorias limitadas ao contrato de entrada; fidelidade de logo é rubrica do Diretor.
- **[Contaminação da produção]** → composição; seams aditivos; contrato de entrada intacto; `git diff`.
- **[Chamada paga acidental]** → programa autorizado + orçamento atômico + confirmação + reserva; testes sem rede.
- **[Escopo inflado para F48.3]** → manter a avaliação cega mínima; múltiplos avaliadores/concordância/automação ficam na F48.3.

## Migration Plan

1. Migration aditiva **local** (tabelas novas + `kind` + evidências de revisão + triggers append-only) e REVERT.
2. `npx supabase db reset` + `db lint`; testes de contrato.
3. Implementação e testes locais (fakes; sem chamadas pagas).
4. UAT local (Docker) com chave/projeto de desenvolvimento e orçamento autorizado.
5. Auditoria do Revisor e ciclo de otimização; relatório final.
6. **Sem `db push` remoto e sem promoção** — F48.2.3.
