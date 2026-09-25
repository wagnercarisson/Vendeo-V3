## Why

Com os prompts do Diretor otimizados na **F48.2.1**, falta auditar e otimizar o **prompt do Revisor de imagem**. A **F48.2.2** é a segunda fatia do guarda-chuva **F48.2 — Qualidade e otimização dos prompts** e entrega o modo `reviewer` do laboratório: execução isolada de `campaign_image_review` sobre imagens de campanha previamente materializadas, com avaliação humana verdadeiramente cega, classificação por run e auditoria de falsos positivos, falsos negativos e acertos por motivo errado. Não altera o Revisor produtivo e não promove nada.

## What Changes

- **Modo `reviewer` no laboratório**: o experimento passa a declarar um modo (`director`/`reviewer`); no modo `reviewer`, o prompt sob teste é `campaign-image-reviewer` e o alvo fixo é `openai / gpt-4o / chat-completions`.
- **Casos de revisão ligados à imagem exata**: entidade imutável e versionada que liga a versão do cenário (fatos congelados), a imagem exata (ou o seu hash), a origem da imagem (`fixture` ou `director_artifact`), o diagnóstico esperado e as categorias de defeito esperadas. O diagnóstico pertence ao caso — não ao cenário — porque imagens distintas do mesmo cenário têm defeitos distintos.
- **Fixtures de campanhas finalizadas**: corpus com campanha adequada, preço incorreto, preço proibido em exclusivo, texto obrigatório ausente, CTA inventado, nome de loja incorreto, produto deformado, baixa legibilidade e um falso defeito tentador (mede falso positivo). Arte do Diretor entra apenas como amostra exploratória, após receber diagnóstico humano próprio.
- **Corpus de desenvolvimento × holdout**: o corpus de **desenvolvimento** tem diagnóstico conhecido e serve ao refino; o **holdout** tem diagnóstico oculto e é consumido apenas na comparação final baseline × candidata. Nunca há avaliação comparativa "baseline-only": o experimento é sempre baseline × candidata, criado e executado por completo antes de qualquer revelação, e o holdout só é revelado após **todos os runs, variantes, repetições e casos holdout do experimento** estarem avaliados às cegas. O **lote** é o `experiment_id`; a revelação/consumo é registrada (atomicamente para o lote) e um holdout revelado **não** é reutilizado pelo mesmo avaliador em **qualquer programa**. Depois do holdout, a decisão é somente **recomendar ou rejeitar**; novo refinamento volta ao corpus de desenvolvimento e uma nova comparação exige holdout ainda não revelado.
- **Congelamento do experimento do Revisor**: após o primeiro run, `kind` fica imutável, os casos associados não podem ser adicionados/removidos/substituídos e o `review_case_version_id` do run pertence ao conjunto congelado.
- **`campaign_image_review` isolado e sem geração de arte**: o experimento do Revisor não gera, corrige ou regenera arte e não dispara o pipeline produtivo de revisão.
- **Avaliação cega separada da classificação**: `lab_reviewer_blind_assessments` (append-only) registra a leitura própria do avaliador **antes** da revelação; `lab_reviewer_classifications` (append-only) registra a classificação **depois** da revelação. Ambas têm no máximo um registro por run/avaliador (`UNIQUE(run_id, evaluator_id)`), e a classificação exige a avaliação cega correspondente e a revelação autorizada. A revelação do diagnóstico só ocorre após a avaliação cega de **todos os runs, variantes, repetições e casos holdout do experimento** para o avaliador.
- **Classificação independente de baseline e candidata**: cada caso produz duas respostas; baseline e candidata são classificadas separadamente, permitindo comparar acertos, falsos positivos e falsos negativos.
- **Auditoria de falsos positivos, falsos negativos e motivo errado**: `correct` exige decisão correta **e** categoria compatível; rejeitar pelo motivo errado é `correct_wrong_reason` e não conta como acerto pleno.
- **Otimização do prompt do Revisor**: sequência uniforme — diagnosticar → hipótese → **refinar apenas com o corpus de desenvolvimento** → **congelar a candidata final** → experimento completo baseline × candidata → executar os dois lados → **avaliar uma vez no holdout** → **depois do holdout, somente recomendar ou rejeitar** (nova candidata exige novo holdout não revelado) —, com regra de vitória do Revisor e critério de parada.
- **Relatório e recomendação**: relatório final por prompt em Markdown canônico, com a recomendação do Revisor pronta para a promoção posterior.
- **Fora de escopo**: alteração do Revisor produtivo, promoção, canário, `db push` remoto e `campaign_approval_enabled` (F48.2.3); escopo avançado de avaliação da F48.3 (múltiplos avaliadores, concordância, automação geral). **Fronteira com F48.6:** a F48.2.3 cobre apenas a promoção dos **prompts vencedores**, o canário do fluxo de aprovação e o rollback desses prompts/flag; a homologação e a promoção **geral** de modelos, providers e capabilities permanecem na **F48.6 — Homologação e promoção controlada**.

## Capabilities

### New Capabilities

- `lab-review-cases`: casos de revisão imutáveis e versionados ligados à imagem exata, com integridade de hash, confinamento de caminho e corpus de fixtures de campanhas finalizadas com defeitos conhecidos.
- `lab-reviewer-audit`: modo `reviewer` do laboratório, avaliação cega separada da classificação (append-only), revelação protegida, classificação por run e auditoria de falsos positivos, falsos negativos e motivo errado, com regra de vitória e otimização do prompt do Revisor.

### Modified Capabilities

- `lab-experiments`: introduz o modo (`kind`) `director`/`reviewer` e o conjunto de casos de revisão vinculado ao experimento do Revisor, mantendo `campaign_intent` obrigatório.
- `lab-runs`: adiciona a execução isolada do Revisor sobre o caso de revisão (sem geração de arte) e a persistência das evidências de revisão, sem diagnóstico exposto.
- `lab-human-evaluation`: adiciona a avaliação verdadeiramente cega e a classificação por run do Revisor, em estruturas append-only.
- `lab-admin-api`: expõe casos de revisão (sem diagnóstico), revelação protegida, classificação por run e execução do experimento do Revisor.
- `lab-admin-ui`: oferece o fluxo do Revisor com revelação cega em etapas e classificação por run.
- `lab-isolation`: ajusta os invariantes para o modo Revisor (sem geração de arte) e reafirma os modelos fixos e a fronteira local.
- `lab-gateway-harness`: invoca `campaign_image_review` com alvo fixo e override do prompt do Revisor, sem provider de imagem.
- `lab-prompt-optimization`: estende o programa de otimização ao Revisor (ciclo, regra de vitória e critério de parada do Revisor).

## Impact

- **Dependência**: **F48.2.1 — Otimização dos Prompts do Diretor** concluída e verificada. A F48.2.2 não depende de artefatos não implementados dela; apenas estende o laboratório já existente.
- **Banco (migration aditiva, local-first, NÃO aplicada no remoto)**: novas tabelas `lab_review_cases`, `lab_review_case_versions`, `lab_experiment_review_cases`, `lab_reviewer_blind_assessments` e `lab_reviewer_classifications`; `lab_experiments` ganha `kind`; `lab_runs` ganha `run_kind`, `review_case_version_id` e evidências de revisão. Triggers de imutabilidade/append-only. Nenhuma alteração em tabelas produtivas.
- **Código do laboratório**: evolução de `src/lib/lab/**` (casos de revisão, domínio, harness, execução, avaliação) e das superfícies `src/app/(app)/admin/laboratorio/**` e `src/app/api/admin/laboratorio/**`; novas fixtures em `fixtures/lab/review-cases/**`.
- **Seams compartilhados**: reutilização do `ImageReviewService`/`buildReviewPromptVariables` por composição, sem alterar o contrato de entrada do Revisor produtivo. `prompts/` permanece intocado byte a byte.
- **Testes**: casos de revisão, integridade de hash, modo reviewer sem geração de arte, cegueira (revelação bloqueada), classificação por run, isolamento e regressão; nenhuma chamada paga em testes/CI.
- **Operação/UAT**: auditoria do Revisor sobre o corpus, com checkpoints humanos (matriz/casos → orçamento → execução → avaliação cega → revelação → classificação → decisão final) e relatório final.
- **Referência de design**: `openspec/design-system/MASTER.md` (dark OLED `#020617`/`#F8FAFC`/`#22C55E`, Poppins/Open Sans, `lucide-react`, sem emojis, sem light mode).
