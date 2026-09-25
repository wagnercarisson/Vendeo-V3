# Tasks — F48.2.1: Otimização dos Prompts do Diretor

> Primeira fatia do guarda-chuva **F48.2 — Qualidade e otimização dos prompts**. Reaproveita a base da F48.1 e é dividida em **9 plans** (`48-2-1-01..48-2-1-09`). Specs: `specs/lab-prompt-diagnostics`, `specs/lab-prompt-optimization`, `specs/lab-experiments`, `specs/lab-scenarios`, `specs/lab-runs`, `specs/lab-human-evaluation`, `specs/lab-admin-api`, `specs/lab-admin-ui`, `specs/lab-isolation`. Design: `design.md`.
>
> **Escopo estrito do Diretor:** nenhuma estrutura ou execução do Revisor. Modo `reviewer`, casos de revisão e `campaign_image_review` pertencem à **F48.2.2**. Promoção, `db push` remoto e canário pertencem à **F48.2.3** (apenas os prompts vencedores desta fase, o canário do fluxo de aprovação e o rollback desses prompts/flag); a homologação/promoção **geral** de modelos/providers/capabilities permanece na **F48.6**.
>
> **Regra de isolamento:** nada de `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `ai_model_catalog`, `admin_audit_log`, `prompts/` oficiais ou bucket `campaign-images`. Nenhum secret em banco/log/snapshot. Nenhuma chamada paga em testes/CI. Modelo fixo: `openai/gpt-5.5/responses`.
>
> **Fronteira local:** migration criada e testada **somente localmente**; sem `db push` remoto.
>
> **Ordem dos checkpoints:** (1) aprovação da matriz → (2) autorização de orçamento → (3) execução → (4) avaliação cega (antes da regra de vitória) → (5) decisão final por variante.
>
> **Dependências:** 48-2-1-01 ← 48-2-1-02; 48-2-1-02 ← 48-2-1-03; 48-2-1-03 ← 48-2-1-04; 48-2-1-04 ← 48-2-1-05; 48-2-1-05 ← 48-2-1-06; 48-2-1-06 ← 48-2-1-07; 48-2-1-07 ← 48-2-1-08; 48-2-1-08 ← 48-2-1-09.

## 1. Domínio, migration e programa (48-2-1-01)

- [ ] 1.1 Criar migration **local aditiva**, nesta ordem: criar `lab_prompt_programs` (`budget_usd`, `budget_reserved_usd`, `budget_consumed_usd`); adicionar `lab_experiments.campaign_intent` com **backfill `'offer'`** dos registros F48.1; aplicar `NOT NULL`; adicionar a FK `lab_experiments.program_id`; adicionar `lab_human_evaluations.rubric` — design D2
- [ ] 1.2 Estender os triggers de imutabilidade para congelar `campaign_intent` e `program_id` após o primeiro run (além das colunas já congeladas) — design D2
- [ ] 1.3 Implementar o contrato mínimo de orçamento: reserva idempotente por `operation_id`, recusa por `program_not_authorized`/`budget_exceeded`, conversão reserva→consumo com custo efetivo e liberação em falha antes da chamada — design D2
- [ ] 1.4 Escrever bloco REVERT (drop FK/colunas → drop `lab_prompt_programs`) e testar a migration **localmente** (`npx supabase db reset` + `db lint`), incluindo o backfill e a reaplicação idempotente — design D2/D11
- [ ] 1.5 Evoluir `src/lib/lab/domain/prompt-snapshot.ts`: allowlist `DIRECTOR_PROMPTS = { offer, spotlight, exclusive }`; baseline `official` e candidata `override`; recusa `unsupported_prompt_under_test` — design D4
- [ ] 1.6 Evoluir o domínio do experimento: `campaignIntent` obrigatório, `programId` obrigatório, prompt derivado do intent, cenários de intents mistos recusados — design D4
- [ ] 1.7 Registrar o `program_id` no snapshot do run (`LabRunSnapshot`) — design D5
- [ ] 1.8 Testes de domínio: allowlist, prompt×intent, intent/programa obrigatórios, congelamento pós-run, snapshot com programa, orçamento (reserva idempotente, saldo, conversão), rejeição de `model`/`configuration` — design D2/D4

## 2. Diagnóstico da F37 e matriz de cenários (48-2-1-02)

- [ ] 2.1 Criar o schema e o carregador do diagnóstico versionado em JSON (`fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v{N}.json`) com `schemaVersion`, `diagnosticVersion`, `generatedAt`, `sourceRefs`, `contentHash` e `items` — design D3
- [ ] 2.2 **Materializar o diagnóstico inicial da F37**: analisar os relatórios disponíveis e gravar a versão 1 com a cadeia falha → evidência → causa provável → tratável por prompt? → hipótese mínima — design D3
- [ ] 2.3 Implementar a regra de versão (nova versão = novo arquivo; preserva a anterior; carrega a maior) e a verificação de `contentHash` — design D3
- [ ] 2.4 Ampliar `src/lib/lab/scenarios/schema.ts`: `SUPPORTED_SCENARIO_MODES.intents = ["offer","spotlight","exclusive"]` (formato `1:1`, locale `pt-BR`), sem diagnóstico no cenário — design D4
- [ ] 2.5 Preservar os três slugs de oferta da F48.1 (nova versão se necessário) e criar seis fixtures de `spotlight`/`exclusive` em `fixtures/lab/scenarios/<slug>/` com imagens controladas — design D4
- [ ] 2.6 Garantir a distribuição dos atributos da matriz e adicionar teste de conteúdo que falha se um atributo obrigatório não estiver coberto; ajustar o bootstrap idempotente das nove versões — design D4
- [ ] 2.7 Testes: diagnóstico versionado (hash, nova versão preserva a anterior), `promptTreatable`, intenções suportadas/não suportadas, path traversal/symlink recusado — design D3/D4
- [ ] 2.8 **Checkpoint humano 1 — aprovação da matriz e do diagnóstico**: registrar a matriz (nove cenários) e o diagnóstico inicial antes de qualquer execução paga — spec `lab-prompt-optimization`; design D11

## 3. Execução do Diretor e harness (48-2-1-03)

- [ ] 3.1 Ajustar a execução do Diretor para exigir que o `campaignIntent` do experimento coincida com o intent dos cenários e montar `campaign-image-director-{intent}` pelo caminho real (`buildDirectorPrompt`) — design D5
- [ ] 3.2 Garantir **exatamente uma** chamada `campaign_image` por run, sem fallback e sem Revisor produtivo — design D5
- [ ] 3.3 Integrar a reserva de orçamento à reserva do run (trava o programa, valida saldo, reserva idempotente) **antes** da chamada paga — design D2/D5
- [ ] 3.4 Testes do Diretor por tipo de campanha: `offer`/`spotlight`/`exclusive` selecionam o prompt correto; um único envelope; programa autorizado exigido; prompt oficial intocado — design D5

## 4. Avaliação humana, rubrica e cega (48-2-1-04)

- [ ] 4.1 Implementar a rubrica humana estruturada (nove critérios; estado `adequate`/`minor_defect`/`critical_defect`/`not_applicable`; observação opcional), sem score automático — design D7
- [ ] 4.2 Persistir `rubric` em `lab_human_evaluations`, mantendo append-only, validação de runs e reinício do formulário por par — design D7
- [ ] 4.3 Ajustar a comparação lado a lado (modo cego, ordem registrada, custo/latência/repetições) e o formulário de rubrica — design D7
- [ ] 4.4 Testes de avaliação: rubrica registrada, reavaliação preserva histórico, update/delete bloqueados, ordem cega só quando cega, formulário reinicia com o par — design D7

## 5. API, UI, orçamento e isolamento (48-2-1-05)

- [ ] 5.1 Estender schemas de admin/domínio para `campaignIntent`, `programId`, `promptUnderTest` e rubrica — design D10
- [ ] 5.2 Estender `POST /experiments` (tipo/programa/prompt) e `GET /experiments/[id]/estimate` (cenários × duas variantes × repetições, por capability) — design D10
- [ ] 5.3 Estender a rota de execução para validar programa/orçamento antes da reserva (`program_not_authorized`) e estender `POST /evaluations` para a rubrica — design D10
- [ ] 5.4 Criar endpoints de programa (`POST /programs`, `GET/PUT /programs/[id]`) para matriz, orçamento (autorizado/reservado/consumido), relatório e recomendação — design D10
- [ ] 5.5 Criar/estender a UI: seleção de tipo de campanha que determina o prompt, vínculo ao programa, estimativa/confirmação, saldo restante e formulário de rubrica; conformidade com `openspec/design-system/MASTER.md` — design D10
- [ ] 5.6 Estender `architecture-guard` e os testes de isolamento/segurança financeira (programa autorizado, reserva idempotente, saldo consistente, sem `generation_events`/`ai_model_selection`, sem chamadas reais) — design D11
- [ ] 5.7 Testes de rota e UI: 403/400/409/422, tipo/programa obrigatórios, estimativa, `program_not_authorized`, rubrica, estado desabilitado — design D10
- [ ] 5.8 Preparar ambiente local (Next.js + Supabase Docker + bucket + bootstrap da matriz e do diagnóstico) com chave/projeto de desenvolvimento — design D11
- [ ] 5.9 Calcular o teto de orçamento pela estimativa (com margem explícita) e registrar: **36 runs iniciais** (v1 × 3 prompts × 12) e **108 runs no pior caso** (até 3 ciclos × 12 × 3); o teto pode cobrir o pior caso ou ser reautorizado incrementalmente — design D9
- [ ] 5.10 **Checkpoint humano 2 — autorização de orçamento**: registrar em `lab_prompt_programs` o valor em USD, autor e timestamp antes de qualquer chamada paga; **cada ciclo adicional (v2/v3) exige nova autorização humana** antes de suas chamadas pagas — spec `lab-prompt-optimization`; design D9/D11

## 6. Ciclo do Diretor `offer` (48-2-1-06)

- [ ] 6.1 Formular a hipótese do `offer` a partir do diagnóstico (uma classe de falha observada) — design D6
- [ ] 6.2 Redigir a candidata do `offer` com as regras de simplicidade (remover/reorganizar antes de adicionar; sem nomes/exemplos das fixtures; sem duplicar validações do código; registrar diferença de tamanho e justificativa) — design D6
- [ ] 6.3 Criar o experimento completo baseline × candidata do `offer` (3 cenários × 2 variantes × 2 repetições = 12 runs) e executar os dois lados — design D6
- [ ] 6.4 Registrar a avaliação cega do `offer` após os runs e antes de qualquer consolidação — spec `lab-prompt-optimization`; design D11
- [ ] 6.5 Aplicar a regra de vitória do `offer` e decidir refinar/rejeitar/recomendar; em empate, desempatar pela variante mais simples/curta — design D6/D8
- [ ] 6.6 [condicional] Se o `offer` for marcado `refinar`, criar novo experimento congelado com a candidata v2 e repetir (avaliar às cegas + regra de vitória), com **reautorização humana** antes de qualquer chamada paga — design D6/D9
- [ ] 6.7 [condicional] Se v2 for marcado `refinar`, criar novo experimento congelado com a candidata v3 e repetir — design D6/D9
- [ ] 6.8 Encerrar o ciclo do `offer` aplicando o critério de parada (candidata recomendada, três ciclos sem recomendação, ou dois ciclos consecutivos sem melhora) e registrar a decisão e o motivo — design D6/D8

## 7. Ciclo do Diretor `spotlight` (48-2-1-07)

- [ ] 7.1 Formular a hipótese do `spotlight` a partir do diagnóstico — design D6
- [ ] 7.2 Redigir a candidata do `spotlight` com as regras de simplicidade (tamanho + justificativa) — design D6
- [ ] 7.3 Criar o experimento completo baseline × candidata do `spotlight` e executar os dois lados — design D6
- [ ] 7.4 Registrar a avaliação cega do `spotlight` e aplicar a regra de vitória — design D6/D8
- [ ] 7.5 [condicional] Se o `spotlight` for marcado `refinar`, criar novo experimento congelado com a candidata v2 e repetir (avaliar às cegas + regra de vitória), com **reautorização humana** antes de qualquer chamada paga — design D6/D9
- [ ] 7.6 [condicional] Se v2 for marcado `refinar`, criar novo experimento congelado com a candidata v3 e repetir — design D6/D9
- [ ] 7.7 Encerrar o ciclo do `spotlight` aplicando o critério de parada e registrar a decisão e o motivo — design D6/D8

## 8. Ciclo do Diretor `exclusive` (48-2-1-08)

- [ ] 8.1 Formular a hipótese do `exclusive` a partir do diagnóstico — design D6
- [ ] 8.2 Redigir a candidata do `exclusive` com as regras de simplicidade (tamanho + justificativa) — design D6
- [ ] 8.3 Criar o experimento completo baseline × candidata do `exclusive` e executar os dois lados — design D6
- [ ] 8.4 Registrar a avaliação cega do `exclusive` e aplicar a regra de vitória — design D6/D8
- [ ] 8.5 [condicional] Se o `exclusive` for marcado `refinar`, criar novo experimento congelado com a candidata v2 e repetir (avaliar às cegas + regra de vitória), com **reautorização humana** antes de qualquer chamada paga — design D6/D9
- [ ] 8.6 [condicional] Se v2 for marcado `refinar`, criar novo experimento congelado com a candidata v3 e repetir — design D6/D9
- [ ] 8.7 Aplicar o critério de parada aos três prompts e confirmar que a produção permaneceu inalterada (nenhuma campanha/crédito/seleção/catálogo/prompt/`generation_events`/`campaign-images` alterados) — design D8/D11

## 9. Consolidação, relatório e fechamento (48-2-1-09)

- [ ] 9.1 Consolidar as avaliações cegas e os resultados dos três prompts; registrar empates, "nenhuma adequada", inconclusivos e regressões — design D8
- [ ] 9.2 Produzir o **relatório final por prompt** em Markdown versionado (documento canônico) com variantes vencedoras/rejeitadas, evidências e recomendação — spec `lab-prompt-optimization`; design D11
- [ ] 9.3 Registrar em `lab_prompt_programs` a referência e o hash do relatório, os checkpoints, a decisão, a autoria e a recomendação — design D11
- [ ] 9.4 **Checkpoint humano 5 — decisão final por variante**: registrar a recomendação (vencedora/rejeitada) sem promoção automática — spec `lab-prompt-optimization`; design D11
- [ ] 9.5 Gerar `48-2-1-VERIFICATION.md` e `48.2.1-UAT.md`, confirmando a fronteira local, a ausência de escopo do Revisor e a fronteira F48.2.3 × F48.6; atualizar registros e preparar arquivamento
