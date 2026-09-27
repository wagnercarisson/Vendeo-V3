# Tasks — F48.2.1: Otimização dos Prompts do Diretor (escopo realinhado)

> Primeira fatia do guarda-chuva **F48.2 — Qualidade e otimização dos prompts**.
>
> **Escopo realinhado (decisão humana aprovada):** a F48.2.1 entrega exclusivamente uma **bancada funcional para testes manuais** dos prompts do Diretor (`offer`, `spotlight`, `exclusive`). A criação, revisão, execução, avaliação e aprovação de candidatas reais ocorrem posteriormente, em sessões conduzidas pelo usuário e pelo assistente diretamente no laboratório. Os **ciclos pagos obrigatórios** dos três prompts deixam de ser requisito de conclusão. Nenhuma candidata é aprovada, promovida ou incorporada automaticamente.
>
> Specs: `specs/lab-prompt-diagnostics`, `specs/lab-prompt-optimization`, `specs/lab-experiments`, `specs/lab-scenarios`, `specs/lab-runs`, `specs/lab-human-evaluation`, `specs/lab-admin-api`, `specs/lab-admin-ui`, `specs/lab-isolation`. Design: `design.md`.
>
> **Regra de isolamento:** nada de `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `ai_model_catalog`, `admin_audit_log`, `prompts/` oficiais ou bucket `campaign-images`. Nenhum secret em banco/log/snapshot. Nenhuma chamada paga em testes/CI. Modelo fixo: `openai/gpt-5.5/responses`.
>
> **Fronteira local:** migration criada e testada **somente localmente**; sem `db push` remoto.
>
> **Marcação:** `[x]` = concluído e confirmado pela auditoria read-only; `[ ]` = pendente. A correspondência com os nove planos GSD não é 1:1 — o GSD será realinhado em etapa posterior.

## A. Infraestrutura implementada e confirmada (Planos GSD 48-2-1-01..05)

### A1. Domínio, migration local e programa

- [x] A1.1 Migration local aditiva: `lab_prompt_programs`; `campaign_intent` com backfill `'offer'` + `NOT NULL` + `CHECK`; FK `program_id`; `lab_human_evaluations.rubric` — design D2
- [x] A1.2 Congelamento de `campaign_intent` e `program_id` após o primeiro run (trigger de imutabilidade estendido) — design D2
- [x] A1.3 Contrato de orçamento: reserva idempotente por `operation_id`, `program_not_authorized`/`budget_exceeded`, conversão reserva→consumo com custo efetivo, liberação em falha antes da chamada — design D2
- [x] A1.4 Bloco REVERT + teste local da migration (`db reset`/`db lint`) — design D2/D11
- [x] A1.5 `DIRECTOR_PROMPTS` (offer/spotlight/exclusive); baseline `official` e candidata `override`; recusa `unsupported_prompt_under_test` — design D4
- [x] A1.6 `campaignIntent`/`programId` obrigatórios; prompt derivado do intent; cenários de intents mistos recusados — design D4
- [x] A1.7 `program_id` no snapshot do run — design D5
- [x] A1.8 Testes de domínio (allowlist, prompt×intent, congelamento, snapshot com programa, orçamento) — design D2/D4

### A2. Diagnóstico da F37 e matriz de nove cenários

- [x] A2.1 Schema e carregador do diagnóstico versionado em JSON — design D3
- [x] A2.2 Diagnóstico v1 e versões v2/v3 (ajustes do Checkpoint 1) preservadas como evidência histórica/técnica — design D3
- [x] A2.3 Regra de versão (nova versão preserva a anterior; carrega a maior) + `contentHash` não autorreferente + confinamento de path — design D3
- [x] A2.4 Allowlist de cenários `offer`/`spotlight`/`exclusive` (`1:1`, `pt-BR`), sem diagnóstico no cenário — design D4
- [x] A2.5 Nove fixtures de cenário (três por tipo) — design D4
- [x] A2.6 Cobertura de atributos travada por teste + bootstrap idempotente das nove versões — design D4
- [x] A2.7 Testes de diagnóstico versionado e de cenários — design D3/D4
- [x] A2.8 Checkpoint humano 1 — matriz e diagnóstico aprovados (`matrix-v1` + `diagnosticVersion 3`) — design D11

### A3. Execução do Diretor por tipo de campanha e orçamento

- [x] A3.1 Execução exige coerência entre o `campaignIntent` do experimento e o intent dos cenários; monta `campaign-image-director-{intent}` pelo caminho real — design D5
- [x] A3.2 Exatamente uma chamada `campaign_image` por run, sem fallback e sem Revisor produtivo — design D5
- [x] A3.3 Reserva de orçamento integrada à reserva do run (trava o programa, valida saldo) antes da chamada paga — design D2/D5
- [x] A3.4 Testes por tipo de campanha, envelope único e settle/release — design D5

### A4. Avaliação humana, rubrica e comparação cega

- [x] A4.1 Rubrica de nove critérios (estado + observação), sem score automático — design D7
- [x] A4.2 Persistência `rubric` append-only + reinício do formulário por par — design D7
- [x] A4.3 Comparação cega com `blind_order` registrado apenas quando cega — design D7
- [x] A4.4 Testes de avaliação — design D7

### A5. API, UI, orçamento e isolamento

- [x] A5.1 Schemas de admin/domínio (`campaignIntent`, `programId`, `promptUnderTest`, rubrica) — design D10
- [x] A5.2 `POST /experiments` (tipo/programa/prompt) + `GET /experiments/[id]/estimate` — design D10
- [x] A5.3 Rota de execução valida programa/orçamento (validação **já implementada**; o reforço de `status='authorized'`/`closed` é pendente em C1–C3); `POST /evaluations` aceita rubrica — design D10
- [x] A5.4 Endpoints de programa (`POST /programs`, `GET/PUT /programs/[id]`) — design D10
- [x] A5.5 UI: seleção de tipo→prompt, vínculo ao programa, estimativa/confirmação e formulário de rubrica — design D10
- [x] A5.6 Guardas de isolamento e segurança financeira **existentes** (o reforço de encerramento/revogação efetiva é pendente em C1–C4) — design D11
- [x] A5.7 Testes de rota e UI — design D10
- [x] A5.8 Roteiro de UAT local com guarda fail-closed e sem `db push` — design D11
- [x] A5.9 Cálculo do teto pela estimativa com margem explícita (`LAB_BUDGET_MARGIN_RATIO`) — design D9
- [x] A5.10 Checkpoint humano 2 — orçamento autorizado (autorizar-inicial: US$ 2,808) — design D9/D11

## B. Ciclo experimental interrompido (Plano GSD 48-2-1-06, antes de runs)

- [x] B1 Ferramenta consultiva da regra de vitória (`victory-rule.ts`) — design D8
- [x] B2 Hipótese e rascunho de exemplo `fixtures/lab/prompts/offer/v1-candidate.md` — **não aprovado, não vencedor, não carregado/executado automaticamente, não promovido**; preservado para revisão/ajuste/inserção manual posterior — design D6
- [x] B3 Experimento local `offer` preparado e estimado (12 runs, `totalEstimatedUsd 0.78`, sem chamada paga) — design D6
- [x] B4 Interrupção humana registrada no Checkpoint 3 **antes de qualquer run pago**; `lab_runs = 0`; orçamento reservado/consumido = 0; nenhuma candidata aprovada e nenhuma variante vencedora — design D6

### Itens diferidos — não fazem parte da conclusão da F48.2.1

Os itens abaixo foram **removidos do escopo ativo** por decisão humana. **Não são tarefas** e **não impedem a conclusão nem o arquivamento da change**. Serão conduzidos posteriormente como **sessões manuais** pelo usuário (com nova autorização humana quando houver operação paga).

- **Diferido — Execução paga dos 12 runs e avaliação cega do `offer`** (antes B5): passa a ser sessão manual posterior conduzida pelo usuário.
- **Diferido — Ciclos v2/v3 e critério de parada do `offer`** (antes B6): fora do escopo ativo.
- **Diferido — Ciclos `spotlight` e `exclusive` e relatório final de ciclo** (antes B7): fora do escopo ativo.

## C. Correções técnicas pendentes

> **Contrato de autorização (a reforçar):** não há status `revoked`. `status='closed'` representa o programa encerrado com a autorização revogada. Somente `status='authorized'` permite reservar novos runs. `closed` é **terminal** e não retorna a `authorized`; uma nova sessão operacional exige criar e autorizar um **novo** programa. Encerrar preserva `budget_usd`, `budget_reserved_usd`, `budget_consumed_usd`, autor e timestamp como **histórico auditável** (sem apagar ou zerar valores). A efetividade vem do **bloqueio server-side/RPC**: qualquer status diferente de `authorized` recusa a reserva antes da chamada paga.

- [x] C1 Reforçar a reserva para exigir `status='authorized'` no RPC/serviço (qualquer status diferente de `authorized` recusa antes da chamada paga) — design D9
- [x] C2 Programa `closed` (autorização revogada) recusa qualquer nova reserva antes da chamada paga — design D9
- [x] C3 Implementar e testar a capacidade de **encerramento/revogação efetiva** no RPC, serviço e API: `closed` terminal, sem retorno a `authorized`, e recusa de reautorização de programa `closed` — design D9
- [x] C4 Implementar e testar o **controle administrativo/UI** de encerrar programa, com ação explícita "Encerrar programa / revogar autorização" e confirmação humana — design D9/D10
- [x] C5 Exibição correta de orçamento autorizado, reservado, consumido e saldo restante — design D9
- [x] C6 Integração efetiva do painel de orçamento na tela relevante (hoje órfão; saldo não propagado) — design D9/D10
- [x] C7 Implementar/verificar o **caminho administrativo seguro de arquivamento** do experimento: recusa de novas execuções e preservação do histórico — design D6/D11
- [ ] C8 Validação automática (typecheck/lint/build/testes) e UAT da bancada **sem exigir execução paga** — design D11
- [ ] C9 Confirmação de que `prompts/` e estruturas produtivas permanecem isolados — design D11
- [ ] C10 Registro de que a primeira operação real do laboratório ocorrerá posteriormente, com nova autorização humana — design D9/D11

## D. Encerramento da fase (aplicação operacional)

> D1/D2 **usam** as capacidades implementadas em C3/C4/C7 — não reimplementam nada.

- [ ] D1 **Usar** a capacidade de encerramento para fechar o programa local atual `860ca4fe-dc8b-4354-b94e-02f9e7b202c6` (preservando seu histórico) e confirmar que novas reservas são recusadas — design D9
- [ ] D2 **Usar** o caminho administrativo seguro para arquivar o experimento atual `c48e21b5-c7a8-4456-a0d6-a2b4040fc1e3`, preservando o histórico — design D6/D11
- [ ] D3 Produzir `48-2-1-VERIFICATION.md` e `48.2.1-UAT.md` (fronteira local; ausência de escopo do Revisor; fronteira F48.2.3 × F48.6) — design D11
- [ ] D4 Preparar o arquivamento da change (sem promoção) — design D11
