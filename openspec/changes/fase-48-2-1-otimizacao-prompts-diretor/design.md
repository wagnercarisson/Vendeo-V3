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

- Diagnóstico objetivo e versionado das evidências da F37 na cadeia falha → evidência → causa provável → tratável por prompt? → hipótese mínima.
- Matriz de nove cenários (três por tipo de campanha), todos 1:1.
- Suporte aos três prompts do Diretor com baseline × candidata, modelo e parâmetros fixos.
- Rubrica humana estruturada e comparação cega.
- Regras de simplicidade das candidatas.
- Ciclos de otimização dos três prompts com regra de vitória e critério de parada.
- Orçamento atômico em USD do programa, isolamento local e relatório conclusivo.
- Preparar o terreno da F48.2.2 (Revisor) sem implementar nada dela.

**Non-Goals:**

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
- **Hash**: `contentHash` é o SHA-256 da **representação canônica do JSON excluindo o próprio campo `contentHash`** (não autorreferente); a versão usada é registrada no experimento.
- `promptTreatable` separa o que pode ser resolvido por prompt do que exige outra mudança (evita otimizar prompt para o que o prompt não resolve).
- A `minimalHypothesis` alimenta o ciclo de otimização (D6).
- **Alternativa rejeitada**: tabela dedicada — desnecessária para um artefato versionado pequeno e revisável em PR.

### D4 — Matriz de nove cenários e allowlist dos três prompts

- `SUPPORTED_SCENARIO_MODES.intents` passa de `["offer"]` para `["offer","spotlight","exclusive"]`; `formats` continua `["1:1"]`; `locales` continua `["pt-BR"]`. O cenário **não** carrega diagnóstico.
- `prompt-snapshot.ts` substitui a constante única por `DIRECTOR_PROMPTS = { offer, spotlight, exclusive }`; baseline lê o conteúdo oficial atual (`official`) e a candidata é o override (`override`).
- No experimento do Diretor, o prompt sob teste é `campaign-image-director-{campaign_intent}` e todos os cenários compartilham o mesmo `campaign_intent`.

### D5 — Execução do Diretor: inalterada na essência + autorização de orçamento

Reutiliza `prepareLabRun` → `runReservedLabRun` → `buildDirectorPrompt` → `runLabCampaignImage`. Exatamente uma chamada `campaign_image` por run, sem fallback e sem Revisor produtivo. **Novo**: antes de qualquer chamada paga, a reserva valida que o experimento pertence a um programa com orçamento autorizado e debita o orçamento de forma atômica (D2).

### D6 — Ciclo de otimização, simplicidade e critério de parada

1. **Diagnosticar** as evidências da F37 e o prompt baseline atual (D3).
2. **Formular** uma hipótese mínima (uma classe de falha).
3. **Redigir** a candidata com as regras de simplicidade.
4. **Criar o experimento completo baseline × candidata** (as duas variantes são congeladas juntas).
5. **Executar** os dois lados e **avaliar às cegas**.
6. **Refinar ou rejeitar** (novo experimento, nunca edição do congelado).

**Simplicidade**: atacar uma classe de falha; remover/reorganizar/esclarecer antes de adicionar; proibir nomes/exemplos/soluções das fixtures; não duplicar validações do código; registrar diferença de tamanho e justificativa; empate desempata pela variante mais simples e curta.

**Critério de parada** por prompt: candidata recomendada, ou três ciclos sem recomendação, ou dois ciclos consecutivos sem melhora — o que ocorrer primeiro.

### D7 — Avaliação humana: rubrica estruturada e comparação cega

- Rubrica por critério: `adequate`/`minor_defect`/`critical_defect`/`not_applicable` + observação opcional, em `lab_human_evaluations.rubric`. Critérios: fidelidade dos dados, do produto e da identidade (inclui logo), legibilidade, hierarquia visual, coerência com a intenção comercial, ausência de informação inventada, aparência profissional e confiança para publicação.
- Comparação cega com `blind_order` registrado apenas quando a escolha foi cega; avaliações append-only; formulário reinicia com a troca de par.
- Nenhum scoring automático.

### D8 — Regra de vitória determinística

Por cenário, a moda das repetições; sem maioria → `inconclusive` (não conta como vitória); qualquer repetição `none` torna o item crítico. A candidata é recomendada sse **todos** os cenários obrigatórios terminam em `candidate` ou `tie`, com **ao menos um** `candidate` e **nenhum** `baseline`/`none`/`inconclusive`. Empates, "nenhuma adequada" e regressões permanecem registrados. Nenhuma promoção automática.

### D9 — Orçamento atômico e estimativa por capability

- Estimativa do plano = **cenários × duas variantes × repetições**, calculada por componente de pricing da **capability do modo** (`campaign_image` nesta change).
- Escala do plano: **36 runs iniciais** (v1 × 3 prompts × 12 runs) e **108 runs no pior caso** (até 3 ciclos × 12 runs × 3 prompts).
- O teto em USD é calculado pela estimativa com margem explícita e autorizado em `lab_prompt_programs` no checkpoint imediatamente anterior às chamadas pagas. O teto **pode** ser autorizado para o pior caso (108 runs) **ou** por **reautorizações incrementais**.
- **Reautorização obrigatória por ciclo:** antes de iniciar qualquer ciclo adicional (v2/v3) de qualquer prompt, é exigida uma **nova autorização humana explícita** em `lab_prompt_programs` (mesmo contrato atômico de `budget_usd`/`budget_reserved_usd`/`budget_consumed_usd`); sem essa reautorização, **nenhuma chamada paga do ciclo adicional ocorre**.
- O consumo é debitado de forma **atômica**; sem saldo autorizado, a execução é recusada (`program_not_authorized`/`budget_exceeded`).

### D10 — API e UI

- `POST /experiments` aceita `campaignIntent` (obrigatório), `programId` (obrigatório) e `promptUnderTest` (validado por intent).
- `GET /experiments/[id]/estimate` calcula a estimativa por capability.
- `POST /experiments/[id]/runs` valida programa/orçamento antes da reserva.
- `POST /experiments/[id]/evaluations` aceita a rubrica estruturada.
- Endpoints de programa: `POST /programs` (matriz + autorização de orçamento) e `GET/PUT /programs/[id]`.
- UI: seleção de tipo de campanha que determina o prompt, vínculo ao programa, estimativa/confirmação e formulário de rubrica. Segue `openspec/design-system/MASTER.md`.

### D11 — Migration local-only, checkpoints e relatório

- Migration testada localmente (`supabase db reset` + `db lint`); **sem** `db push` remoto.
- **Checkpoints humanos ordenados**: (1) aprovacao da matriz -> (2) autorizacao de orcamento (36 runs iniciais / 108 no pior caso) -> (2b) reautorizacao humana antes de cada ciclo adicional (v2/v3) -> (3) execucao -> (4) avaliacao cega (antes da regra de vitoria) -> (5) decisao final por variante.
- Relatório final por prompt em **Markdown versionado** (canônico); o banco guarda referência, hash, checkpoints, decisão, autoria e recomendação.

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
4. UAT local (Docker) com chave/projeto de desenvolvimento e orçamento autorizado.
5. Ciclos de otimização dos três prompts e relatório final.
6. **Sem `db push` remoto e sem promoção** — F48.2.3.

## Dúvidas resolvidas

1. Matriz de nove cenários aprovada (D4), identidade restrita a `logo`/`text_only`.
2. Rubrica com estado estruturado por critério + observação; sem nota automática.
3. Relatório em Markdown canônico; banco guarda referência/hash.
4. Orçamento: estimativa = cenários × duas variantes × repetições, por capability, com margem explícita; USD aprovado antes das chamadas pagas.
5. Diagnóstico da F37 versionado na cadeia falha → evidência → causa → tratável por prompt? → hipótese mínima.
