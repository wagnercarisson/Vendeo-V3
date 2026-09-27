# Design — F48.2.1: Otimização dos Prompts do Diretor

## Context

A **F48.2.1** é a primeira fatia do guarda-chuva **F48.2 — Qualidade e otimização dos prompts**. Ela reaproveita a base técnica da bancada mínima entregue pela F48.1 (`openspec/changes/archive/2026-09-17-fase-48-1-laboratorio-ia-minimo/`): tabelas `lab_*`, bucket `lab-artifacts`, guarda de ambiente fail-closed, cenários versionados, experimentos prompt-only, harness de gateway isolado com alvo fixo, execução single-shot de `campaign_image`, validação técnica objetiva, comparação lado a lado e avaliação humana append-only.

Pontos de integração reais já existentes:

- `ImageGenerationService.buildDirectorPrompt(brief, context)` monta o prompt por `campaign-image-director-{intent}` via `assemblePrompt` (`src/lib/image-generation/services/image-generation-service.ts:129`, `:874`).
- `LabPromptLoader` serve override em memória; `LabModelResolver` devolve alvo fixo; `createLabGateway` compõe instância paralela (`src/lib/lab/gateway/*`).
- Modelo produtivo do Diretor: `campaign_image` → `openai/gpt-5.5/responses` (`src/lib/ai/model-registry.ts:121`).
- Evidências de produção da F37 (aprovação/correção única) são a fonte do diagnóstico inicial.

Restrições: a produção permanece **byte a byte idêntica**; qualquer seam compartilhado é aditivo, testado e neutro; a fase é **integralmente local/desenvolvimento** e nada é promovido. A F48.2.1 **não** contém estruturas nem execução do Revisor.

## Goals / Non-Goals

**Goals:**

- Entregar uma **bancada funcional para testes manuais** dos prompts do Diretor (`offer`, `spotlight`, `exclusive`), em que o usuário insere ou cola manualmente a candidata.
- Diagnóstico objetivo e versionado das evidências da F37 na cadeia falha → evidência → causa provável → tratável por prompt? → hipótese mínima (preservado como evidência histórica/técnica).
- Matriz de nove cenários (três por tipo de campanha), todos 1:1, aprovada.
- Suporte aos três prompts do Diretor com baseline × candidata, modelo e parâmetros fixos.
- Rubrica humana estruturada, comparação cega e regra de vitória **consultiva**.
- Orçamento atômico em USD do programa com **autorização, revogação efetiva e exibição correta** (autorizado/reservado/consumido/saldo).
- Preparar o terreno da F48.2.2 (Revisor) sem implementar nada dela.

**Non-Goals:**

- **Ciclos pagos obrigatórios** de otimização como requisito de conclusão da fase; **criação/revisão/aprovação automática de candidatas**; início automático de experimentos; promoção/incorporação automática.
- Relatório final de ciclo obrigatório (a fase pode concluir sem ciclos pagos e sem relatório de variantes).
- Modo `reviewer`, casos de revisão, `campaign_image_review`, classificação de falsos positivos/negativos (F48.2.2).
- Promoção, canário, deploy, `db push` remoto, `campaign_approval_enabled` (F48.2.3).
- Comparação de modelos, troca de provider, pricing versionado, scraping, alertas de lifecycle.
- Novos tipos/formatos (9:16, carrossel, serviços, informativos), assinatura visual, i18n, migração de storage.

## Decisions

### D1 — Fronteira: só o Diretor, só local

Toda a evolução vive em `src/lib/lab/**` e nas superfícies `/admin/laboratorio` + `/api/admin/laboratorio`. Nenhum prompt oficial, tabela produtiva, seleção de modelo, gateway ou pipeline de produção é alterado. A migration é criada e testada **somente localmente** e **não** é aplicada no remoto (isso pertence à F48.2.3). Nenhuma estrutura do Revisor entra nesta change.

### D2 — Modelo de dados: migration aditiva com ordem e backfill corretos

Migration **aditiva, local-first**. Sem alterar `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_catalog`, `ai_model_selection`, `admin_audit_log`.

| Objeto | Evolução | Papel |
|---|---|---|
| `lab_prompt_programs` (nova, **criada primeiro**) | `id`, `matrix_version`, `budget_authorized_by`, `budget_authorized_at`, `budget_usd`, `budget_reserved_usd`, `budget_consumed_usd`, `status`, `final_report_ref`, `final_report_hash`, `recommendation JSONB`, `created_by`, timestamps | Programa, checkpoints e orçamento |
| `lab_experiments` | `+ campaign_intent TEXT NOT NULL CHECK ('offer','spotlight','exclusive')` com **backfill `'offer'`** para registros da F48.1; `+ program_id UUID REFERENCES lab_prompt_programs(id)`; congelamento de `campaign_intent`/`program_id` após o primeiro run | Tipo de campanha e vínculo ao programa |
| `lab_human_evaluations` | `+ rubric JSONB` | Rubrica estruturada do Diretor |

- **Ordem obrigatória da migration**: criar `lab_prompt_programs` **antes** de adicionar a FK `lab_experiments.program_id`.
- **Backfill**: `UPDATE lab_experiments SET campaign_intent = 'offer' WHERE campaign_intent IS NULL` antes de aplicar `NOT NULL` (registros da F48.1 eram todos de oferta).
- **Congelamento pós-run**: o trigger existente de imutabilidade passa a cobrir também `campaign_intent` e `program_id` (não só `kind`), impedindo alteração depois do primeiro run.
- **Orçamento atômico (contrato mínimo)**: `lab_prompt_programs` representa `budget_usd` (autorizado), `budget_reserved_usd` (reservado) e `budget_consumed_usd` (consumido). Na mesma transação da reserva do run, o sistema trava o programa, calcula o valor estimado do run, recusa se `consumed + reserved + estimado > budget_usd` (`budget_exceeded`) e soma o estimado a `reserved`. A reserva é **idempotente pelo `operation_id`** (já único em `lab_runs`), impedindo débito duplicado. Ao finalizar: reserva é liberada e o **custo efetivo** (`estimated_cost_usd` do sink) vai para `consumed`; se o custo efetivo não existir, consome o estimado reservado. Falha **antes** de qualquer chamada paga libera a reserva sem consumir; falha **depois** consome o efetivo (ou o estimado). Saldo restante = `budget_usd - budget_consumed_usd - budget_reserved_usd`, usado de forma consistente na estimativa, na autorização e na execução. Não é um sistema de pricing — apenas reserva idempotente e saldo consumido.
- **Alternativa rejeitada**: deixar `program_id` nulo — permitiria execução sem orçamento autorizado.

### D3 — Diagnóstico das evidências da F37 (JSON versionado no repositório)

Nova capability `lab-prompt-diagnostics`. Para manter a simplicidade, **não** há tabela nova: o diagnóstico canônico é um **JSON versionado no repositório**, em `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v{N}.json`:

```
{ schemaVersion, diagnosticVersion, generatedAt, sourceRefs: [...], contentHash,
  items: [ { failureCode, evidence, probableCause, promptTreatable,
             minimalHypothesis, promptName } ] }
```

- **Versão**: cada versão é um arquivo imutável próprio; uma nova versão cria um novo arquivo e **preserva** o anterior; o carregador usa a maior `diagnosticVersion`.
- **Hash**: `contentHash` é o SHA-256 da **representação canônica do JSON excluindo o próprio campo `contentHash`** (não autorreferente); a `diagnosticVersion` e o `contentHash` usados são registrados no artefato versionado de aprovação do Checkpoint 1 (`docs/lab/48-2-1-matrix-approval.md`), não na linha do experimento.
- `promptTreatable` separa o que pode ser resolvido por prompt do que exige outra mudança (evita otimizar prompt para o que o prompt não resolve).
- A `minimalHypothesis` alimenta o ciclo de otimização (D6).
- **Alternativa rejeitada**: tabela dedicada — desnecessária para um artefato versionado pequeno e revisável em PR.

### D4 — Matriz de nove cenários e allowlist dos três prompts

- `SUPPORTED_SCENARIO_MODES.intents` passa de `["offer"]` para `["offer","spotlight","exclusive"]`; `formats` continua `["1:1"]`; `locales` continua `["pt-BR"]`. O cenário **não** carrega diagnóstico.
- `prompt-snapshot.ts` substitui a constante única por `DIRECTOR_PROMPTS = { offer, spotlight, exclusive }`; baseline lê o conteúdo oficial atual (`official`) e a candidata é o override (`override`).
- No experimento do Diretor, o prompt sob teste é `campaign-image-director-{campaign_intent}` e todos os cenários compartilham o mesmo `campaign_intent`.

### D5 — Execução do Diretor: inalterada na essência + autorização de orçamento

Reutiliza `prepareLabRun` → `runReservedLabRun` → `buildDirectorPrompt` → `runLabCampaignImage`. Exatamente uma chamada `campaign_image` por run, sem fallback e sem Revisor produtivo. **Novo**: antes de qualquer chamada paga, a reserva valida que o experimento pertence a um programa com orçamento autorizado e debita o orçamento de forma atômica (D2).

### D6 — Bancada de testes manuais (sem ciclos pagos obrigatórios)

A F48.2.1 entrega uma **bancada funcional**; a condução de candidatas é manual:

1. **Diagnosticar** as evidências da F37 e o prompt baseline atual (D3) — evidência histórica/técnica.
2. **Escrever/revisar a candidata fora da execução automática** — o laboratório **não** cria candidatas.
3. **Inserir ou colar manualmente** a candidata no laboratório e montar o experimento baseline × candidata.
4. **Executar sob confirmação explícita**, com orçamento autorizado (D9) — nunca automaticamente.
5. **Avaliar às cegas** com rubrica humana (D7) e aplicar a regra de vitória como apoio consultivo (D8).
6. **Decidir humanamente** aprovar, refinar ou rejeitar — nenhuma decisão automática; nenhuma promoção.

**Sem requisito de ciclos pagos**: nenhum ciclo pago de otimização é requisito para concluir a fase. A primeira operação real paga ocorrerá posteriormente, em sessão conduzida pelo usuário, com nova autorização humana.

**Simplicidade (orientação não bloqueante)**: atacar uma classe de falha; remover/reorganizar/esclarecer antes de adicionar; proibir nomes/exemplos/soluções das fixtures; não duplicar validações do código; registrar diferença de tamanho e justificativa; em empate, preferir a variante mais simples e curta.

**Rascunho de exemplo**: `fixtures/lab/prompts/offer/v1-candidate.md` permanece como **rascunho de exemplo** para revisão posterior — não aprovado, não vencedor, não carregado nem executado automaticamente e não promovido.

### D7 — Avaliação humana: rubrica estruturada e comparação cega

- Rubrica por critério: `adequate`/`minor_defect`/`critical_defect`/`not_applicable` + observação opcional, em `lab_human_evaluations.rubric`. Critérios: fidelidade dos dados, do produto e da identidade (inclui logo), legibilidade, hierarquia visual, coerência com a intenção comercial, ausência de informação inventada, aparência profissional e confiança para publicação.
- Comparação cega com `blind_order` registrado apenas quando a escolha foi cega; avaliações append-only; formulário reinicia com a troca de par.
- Nenhum scoring automático.

### D8 — Regra de vitória consultiva

A regra determinística permanece disponível como **ferramenta consultiva** de apoio à revisão humana: por cenário, a moda das repetições; sem maioria → `inconclusive` (não conta como vitória); qualquer repetição `none` torna o item crítico. A recomendação (todos os cenários em `candidate`/`tie`, com ao menos um `candidate` e nenhum `baseline`/`none`/`inconclusive`) é apenas **indicativa**. A regra SHALL NOT decidir aprovação, SHALL NOT disparar novos ciclos, SHALL NOT promover variantes e SHALL NOT substituir a decisão humana. Empates, "nenhuma adequada" e regressões permanecem registrados.

### D9 — Orçamento atômico, autorização e revogação

- Estimativa do plano = **cenários × duas variantes × repetições**, calculada por componente de pricing da **capability do modo** (`campaign_image` nesta change).
- O teto em USD é calculado pela estimativa com margem explícita e autorizado em `lab_prompt_programs` antes de qualquer chamada paga. A autorização é **explícita e revogável**.
- **Reserva somente com `status='authorized'`:** a reserva do run só pode ocorrer quando o programa está explicitamente com `status='authorized'`.
- **`status='closed'` = encerrado com autorização revogada:** não existe status `revoked`. Encerrar o programa leva a `status='closed'`, que é **terminal** (não retorna a `authorized`) e recusa **qualquer nova reserva** antes de qualquer chamada paga, independentemente de `budget_usd`/`budget_authorized_at` residuais.
- **Nova sessão exige novo programa:** como `closed` é terminal, uma nova sessão operacional exige **criar e autorizar um novo programa**.
- **Histórico preservado:** encerrar preserva `budget_usd`, `budget_reserved_usd`, `budget_consumed_usd`, autor e timestamp como **histórico auditável**; não é necessário apagar nem zerar valores para tornar a revogação efetiva.
- **Efetividade server-side:** a revogação é efetiva porque o RPC/serviço recusa qualquer status diferente de `authorized` antes da chamada paga.
- **Controle administrativo:** a UI oferece a ação explícita "Encerrar programa / revogar autorização" com confirmação humana; a API recusa reautorizar um programa `closed`.
- **Exibição correta:** o sistema SHALL exibir `budget_usd` (autorizado), `budget_reserved_usd` (reservado), `budget_consumed_usd` (consumido) e o saldo restante (`budget_usd - budget_consumed_usd - budget_reserved_usd`), com o painel de orçamento **integrado à tela relevante**.
- **Contrato atômico:** o consumo é debitado de forma **atômica**; a reserva é idempotente por `operation_id`; sem saldo autorizado, a execução é recusada (`program_not_authorized`/`budget_exceeded`).
- **Sem ciclos pagos obrigatórios:** não há escala obrigatória de ciclos para concluir a fase; o orçamento atualmente autorizado será posteriormente **revogado** (encerrando o programa) antes do realinhamento da operação.

### D10 — API e UI

- `POST /experiments` aceita `campaignIntent` (obrigatório), `programId` (obrigatório) e `promptUnderTest` (validado por intent).
- `GET /experiments/[id]/estimate` calcula a estimativa por capability.
- `POST /experiments/[id]/runs` valida programa/orçamento antes da reserva.
- `POST /experiments/[id]/evaluations` aceita a rubrica estruturada.
- Endpoints de programa: `POST /programs` (matriz + autorização de orçamento) e `GET/PUT /programs/[id]`.
- UI: seleção de tipo de campanha que determina o prompt, vínculo ao programa, estimativa/confirmação e formulário de rubrica. Segue `openspec/design-system/MASTER.md`.

### D11 — Migration local-only, autorização humana e encerramento

- Migration testada localmente (`supabase db reset` + `db lint`); **sem** `db push` remoto.
- **Autorização humana para operações pagas**: qualquer operação real paga exige nova autorização humana explícita registrada em `lab_prompt_programs` antes da chamada. A matriz já aprovada permanece válida; **não** há checkpoints ordenados de ciclos de otimização como requisito de conclusão da fase.
- **Encerramento da fase**: a F48.2.1 conclui com a bancada validada (typecheck/lint/build, testes, UAT local **sem execução paga**) e com o isolamento de `prompts/` e das estruturas produtivas confirmado. O experimento interrompido será **arquivado com segurança** e o programa **encerrado** (`status='closed'`, autorização revogada) em etapa posterior.
- **Sem relatório de ciclo obrigatório**: a fase pode concluir sem variantes vencedoras; o relatório final por prompt permanece disponível para sessões posteriores, mas não é requisito de conclusão.

## Risks / Trade-offs

- **[Contaminação da produção]** → composição em vez de edição; seams aditivos; `git diff`; guardas arquiteturais.
- **[Orçamento estourado por concorrência]** → controle atômico do orçamento em USD + reserva atômica antes da chamada paga.
- **[Migration arrastada por outra fase]** → registrada; o `db push` remoto pertence à F48.2.3.
- **[Prompt inchado]** → regras de simplicidade; empate desempata pela variante mais simples/curta.
- **[Otimizar o que o prompt não resolve]** → `promptTreatable` no diagnóstico.
- **[Vitória subjetiva]** → regra determinística antes dos experimentos.
- **[Chamada paga acidental]** → guarda fail-closed + confirmação + estimativa + programa autorizado + limites; testes sem rede.

## Migration Plan

1. Migration aditiva **local**: `lab_prompt_programs` → backfill `campaign_intent='offer'` → `NOT NULL` → FK `program_id` → `lab_human_evaluations.rubric` → triggers de congelamento → REVERT.
2. `npx supabase db reset` + `db lint`; testes de contrato.
3. Implementação e testes locais (fakes; sem chamadas pagas).
4. UAT local (Docker) com chave/projeto de desenvolvimento e orçamento autorizado — **sem execução paga obrigatória**.
5. Validação e UAT da bancada **sem execução paga**; arquivamento seguro do experimento interrompido e encerramento do programa (`status='closed'`, autorização revogada) em etapa posterior. A primeira operação real paga ocorrerá depois, em sessão conduzida pelo usuário, com nova autorização humana.
6. **Sem `db push` remoto e sem promoção** — F48.2.3.

## Dúvidas resolvidas

1. Matriz de nove cenários aprovada (D4), identidade restrita a `logo`/`text_only`.
2. Rubrica com estado estruturado por critério + observação; sem nota automática.
3. Relatório em Markdown canônico; banco guarda referência/hash.
4. Orçamento: estimativa = cenários × duas variantes × repetições, por capability, com margem explícita; USD aprovado antes das chamadas pagas.
5. Diagnóstico da F37 versionado na cadeia falha → evidência → causa → tratável por prompt? → hipótese mínima.
6. **Escopo realinhado (decisão humana):** a F48.2.1 entrega exclusivamente a bancada funcional para testes manuais; os ciclos pagos obrigatórios e o relatório de variantes deixam de ser requisito de conclusão; candidatas são criadas/revisadas/inseridas manualmente e decididas humanamente.
