# Alinhamento Fase 37 — Revisão e Aprovação da Arte

> **Estado desta revisão (2026-09-09): realinhamento da F37.** A **F37.1 (Approval Gate + Candidata Única) está CONCLUÍDA e validada** (arquivada em `openspec/changes/archive/2026-09-02-fase-37-1-approval-gate-candidata-unica`). A antiga fatia **37.2 ("Correção Visual Com Referência") foi abandonada** e **não existe no código desta branch** (`feature/fase-37-realignment-simplificado`); o código antigo está preservado apenas na branch `backup/fase-37-antes-realignment`. A **F37.3 deixa de existir** como fatia independente. O fluxo de correção da arte passa a ser tratado como **uma única F37.2 realinhada — Correção Única por Não Conformidade**, conforme este documento.
>
> **Renumeração (vigente):** F37 = **Revisão e Aprovação da Arte** (v1.5, experimento beta controlado por feature flag). F38 = Tabela de Custos por Operação (✓), F39 = Brief Estruturado (✓), F40 = Campos Comerciais/Avisos (✓), F41 = Mídia de Campanha Mobile (✓), F42 = Signup Controlado (✓), F43 = Revisão do Brief Pré-Geração (✓), F45 = Briefing Contextual do Diretor (✓). **F44 (Temas) e Stripe/Monetização Pública permanecem fora da numeração** (iniciativas separadas/diferidas).

## Contexto

```
v1.5 — Lançamento Externo Controlado                EM ANDAMENTO
  ├── F30…F36 (fundação legal, modelo comercial, CNPJ, prontidão,
  │           onboarding, revisor, brief)           ✓
  ├── F38 / F39 / F40 / F41 / F42 / F43 / F45       ✓
  └── F37 — Revisão e Aprovação da Arte             ← esta fase
        37.1 Approval Gate + Candidata Única        ✓  (base concluída)
        37.2 Correção Única por Não Conformidade    ← fatia realinhada
```

O Vendeo entrega a campanha no momento em que ela fica `ready`, sem passo de aprovação da arte. A **F37.1 já implementou o ciclo de aprovação**: com a flag `campaign_approval_enabled` ligada, a campanha nova entra em revisão (download e copy bloqueados), o lojista aprova a candidata e só então a entrega é liberada. A **F37.2 realinhada** acrescenta o segundo pilar do experimento: **quando a geração tem um defeito objetivo, o lojista relata o problema e o sistema produz no máximo uma nova arte (v2) orientada a eliminar aquele defeito** — sem abrir rebriefing, sem galeria de variações e sem novo custo/crédito ao lojista.

O objetivo continua o mesmo: transformar a primeira entrega em um **ciclo de revisão guiado** que gera confiança e **mede aprovação × margem** no beta, sem virar "buffet de geração".

---

## 1. Escopo da F37.1 (base concluída — permanece intacta)

A F37.2 realinhada **parte do código atual da F37.1 e não o altera** nos seguintes pontos (confirmados no código):

- **Flag `campaign_approval_enabled`** na tabela `feature_flags` (padrão F43/QCW): leitura via `FeatureFlagService.isCampaignApprovalEnabled()` (`src/lib/feature-flags/feature-flag-service.ts`), incluída em `ALL_FEATURE_FLAG_KEYS` → admin "Controles operacionais"; fallback **fail-closed** (`false` = comportamento atual).
- **Tabela `campaign_art_versions`** (migration `20260901000001_f37_1_create_campaign_art_versions.sql`): 1 candidata por vez; `version_number 1..3`, `status pending|approved|rejected`, `asset_status active|discarded`, `correction_in_progress`, `storage_path`, `brief_snapshot` (campaign_brief_v1, F39), `render_snapshot`, `generation_metadata`, `rejection_reason`; índice único parcial **1 `approved` por campanha**; RLS service_role.
- **Colunas em `campaigns`**: `approval_status`, `rejection_count` (0..2), `approved_version_id`, `approved_at` (+ CHECK aprovação exige versão). **Nada escreve em `rejection_count` ainda**.
- **`generate-image` insere a v1** (`createArtVersion`) quando a flag está ligada; o `operation_run_id` da campanha já é persistido na criação (F38.1).
- **Estados de aprovação derivados** em `src/lib/campaign/display.ts`: `ApprovalDisplayState = not_enabled | legacy | pending | approved | regenerating`, `computeApprovalState`, `isDeliveryReleased`, `getActiveCandidateArtVersion`. `regenerating` deriva do marcador `correction_in_progress` da candidata ativa (hoje **inalcançável** — nenhum fluxo o ativa).
- **Gates**: `GET /api/campaign/[id]/download` e `PATCH /api/campaign/[id]/publication-copy` → 403 enquanto `pending`/`regenerating`; liberados para `not_enabled`/`legacy`/`approved`. Copy/Kit de Publicação ocultos na revisão.
- **Tela de revisão** (`CampaignApprovalView` em `/campanhas/[id]` quando `pending`): exibe a candidata ativa (sem download/copy), botão primário **"Aprovar e liberar campanha"**, **sem botão secundário de correção**.
- **Aprovação transacional** via RPC `approve_campaign_art_version(campaign_id, version_id)` (migration `20260901000002_f37_1_approve_campaign_art_version_rpc.sql`): aprova a candidata, defensivo descarta outras linhas `active`, reponta `campaigns` (`storage_path`/`approved_version_id`/`approved_at`/`approval_status`).
- **Legacy explícito**: flag ligada + zero linhas em `campaign_art_versions` → entregue como hoje, sem gate.

A F37.2 realinhada **preserva 100% desse contrato** e usa os mesmos mecanismos (flag, tabela, estados, gates). A **RPC F37.1 `approve_campaign_art_version` permanece intacta e continua sendo a transação atômica de aprovação** — mas a rota `approve` passa a chamar uma **RPC aditiva de aprovação protegida** (D37.2-R8) que serializa aprovar × consumir no banco. Tudo que ela adiciona está descrito abaixo.

---

## 2. Nova F37.2 — Objetivo e escopo

A nova F37.2 acrescenta **somente**:

1. Na tela de revisão (estado `pending`), os botões **[Aprovar arte]** (primário) e **[Informar problema]** (secundário);
2. Um **modal** com preview da candidata, orientação do que é corrigível, campo de texto **obrigatório** e botões **[Enviar para análise]** e **[Cancelar]**;
3. Uma **análise textual do relato** (IA textual) que decide **elegibilidade** — sem ler a imagem;
4. **Uma única oportunidade de geração corretiva**, produzindo **no máximo uma v2** — sem v3 e sem correções adicionais;
5. **Persistência simples** do relato e das versões (v1 preservada; v2 quando existir), preservando os assets para suporte/auditoria;
6. Uma **fila administrativa simples** de relatos de não conformidade (listagem, filtros, detalhe v1×v2 e marcação "revisado pelo suporte").

### 2.1 Fluxo alvo

```
REVISÃO (candidata v1)                     flag on · campanha nova
┌────────────────────────────────────────────────────────────┐
│  [ arte candidata (ativa) ]                                 │
│  [ Aprovar arte ]   [ Informar problema ]                   │
│  ⚠ sem download · sem copy                                 │
└────────────────────────────────────────────────────────────┘
        │ [Informar problema]
        ▼
MODAL "Informar problema"
┌────────────────────────────────────────────────────────────┐
│  [ preview da candidata ]                                   │
│  orientação: corrigível = defeito objetivo (cortado,        │
│  ilegível, dado divergente do brief, inventado, duplicado,  │
│  deformado, composição impeditiva)                          │
│  "Descreva o problema na arte:"  (obrigatório)              │
│  [ Enviar para análise ]   [ Cancelar ]                     │
└────────────────────────────────────────────────────────────┘
        │ Enviar (validação local: vazio/pontuação não cria caso)
        ▼
CASO (reports) + SUBMISSÃO (child) criados na 1ª tentativa válida, ANTES da IA
        1 caso por campanha · 1 linha por tentativa em `campaign_correction_submissions`
        (estado inicial `analyzing`; janela ≤ 3 tentativas/30min)
        ▼
ANÁLISE (IA textual — só o texto; saída estruturada JSON + Zod)
   ├─ unclear/blocked/analysis_failed → orientação; NÃO gera; NÃO consome; pode reformular
   └─ eligible → inicia geração corretiva (v2)
                       │  CONSUMO (RPC própria, imediatamente antes da 1ª chamada ao
                       │  provider): locks na ordem candidata → campanha → relato;
                       │  valida campanha pendente + rejection_count=0 + relato da
                       │  campanha + reported_version_id = candidata + submissão
                       │  vigente eligible; grava rejection_count=1 + generation_started_at
                       │  + status 'generation_started'  (serializa com a aprovação — R8)
                       ├─ falha ANTES do provider → RPC de consumo NÃO roda; não consome;
                       │     pode reenviar
                       ├─ falha DEPOIS do provider → consome (rejection_count permanece 1);
                       │     libera correction_in_progress; v1 continua aprovável
                       └─ sucesso → conclusão insere a v2 e demove a v1 (NÃO incrementa
                                     rejection_count de novo); v2 vira a candidata (única);
                                     v1 preservada (asset) mas fora da candidatura
        ▼
REVISÃO (candidata v2)  →  [Aprovar arte] libera a entrega (RPC de aprovação protegida — R8)
        └─ nenhuma v3 · nenhuma correção adicional · UX não retorna à v1
```

### 2.2 Regras de execução

- F37.1 (concluída) **não é reexecutada nem alterada** por esta fatia — a F37.2 entra sobre a base validada.
- F37.3 **não existe** como fatia; conceitos que foram da 37.3 (correção factual de briefing via `briefPatch`, snapshot corrigido por versão) **foram removidos do escopo** (ver §11).
- O planejamento OpenSpec da fatia seguirá o padrão de subfase: **`openspec/changes/fase-37-2-correcao-unica-por-nao-conformidade/`** (gerado em etapa posterior, fora deste alinhamento).

---

## 3. Decisões da F37.2 realinhada

### D37.2-R1 — Botões e modal de "Informar problema"

`DECIDIDO`

A tela de revisão (estado `pending`) passa a oferecer dois caminhos:

- **[Aprovar arte]** (primário): dispara `POST /api/campaign/[id]/approve` com o `versionId` da candidata ativa. A rota passa a chamar a **RPC aditiva de aprovação protegida** (`approve_campaign_candidate`), que serializa com o consumo no banco (D37.2-R8); aprovar libera a entrega.
- **[Informar problema]** (secundário): abre o modal sem sair da página.

**Modal "Informar problema"** (uma etapa — decisão de simplificação vs. o antigo modal em 2 etapas da 37.2 abandonada):

- **Preview** da candidata ativa (fonte oficial: `asset_status='active'` em `campaign_art_versions`).
- **Orientação curta** do que é corrigível (defeito objetivo — §4) e do que não é (preferência estética, mudança de dados, rebriefing).
- **Campo de texto obrigatório** ("Descreva o problema na arte"), aceitando linguagem simples e com erros de escrita.
- Botões **[Enviar para análise]** e **[Cancelar]**.
- **[Cancelar]**, X, ESC e backdrop fecham o modal **sem efeito** (não aprova, não envia, não cria caso).
- O texto é validado **no clique**: vazio ou somente pontuação → erro amigável pedindo descrição; **não cria caso e não chama IA** (D37.2-R2).

### D37.2-R2 — Elegibilidade e análise do relato

`DECIDIDO`

A análise do relato é feita por **IA textual** (via abstração de texto existente — `createTextProvider`), que:

- **entende o relato** e **tolera erros de escrita** (digitação, concordância, abreviação);
- **NÃO lê a imagem** — não decide se o lojista "está dizendo a verdade"; decide apenas a intenção da declaração;
- classifica em **elegível | bloqueado | não-claro** e, quando elegível, produz uma **instrução normalizada** (objetiva, sem ruído de digitação) que orientará o diretor;
- **nunca altera dados do briefing** — o relato é só texto; a v2 não muda nenhum dado aprovado (D37.2-R4).

Saída da análise — **contrato estruturado**: `analysis_state ∈ { eligible, blocked, unclear }` (estados finais), `category` (taxonomia do defeito, quando elegível) e `normalizedInstruction` (objetiva, sem ruído de digitação, quando elegível), gravados na **linha da tentativa** (`campaign_correction_submissions` — D37.2-R5). Cada tentativa começa como `analyzing` (antes da IA) e termina em um estado final; falha de transporte/timeout do provider → `analysis_failed` (registrada, conta como tentativa, não consome).

**Contrato de saída (sem depender de `jsonMode`):** a abstração de texto atual (`TextProvider.generateText`) retorna conteúdo livre e **não expõe `jsonMode`/`response_format` portável entre providers**. A F37.2 define a saída por **system prompt pedindo JSON estrito → `JSON.parse` defensivo → validação Zod** (o schema de saída é o contrato; os providers podem usar `response_format` quando disponível, mas nada depende disso). **Resposta recebida com JSON inválido/fora do schema → tratada como `unclear`** (sem gerar, sem consumir); **falha de transporte/timeout/vazio → `analysis_failed`**.

**Conteúdo não confiável:** o **texto do lojista** e a **`normalizedInstruction`** são conteúdo não confiável. Ao compor o bloco do diretor, ambos são **delimitados e saneados** (padrão `sanitizePromptText`/delimitadores já usados no pipeline) e **nunca podem sobrescrever o briefing**: o bloco apenas declara o defeito a evitar — não altera produto/preço/validade/aviso/identidade nem reabre decisões aprovadas (anti-invenção).

**Relatos elegíveis** (não conformidade **objetiva** da geração — fecham a política):

| Categoria | Exemplo de declaração |
|---|---|
| Elemento obrigatório cortado | "o preço está cortado na borda" |
| Logo, produto ou texto gravemente cortado | "a logo foi cortada", "o nome do produto saiu cortado" |
| Texto ilegível ou corrompido | "o texto está borrado/ilegível", "saiu letra estranha" |
| Dado divergente do briefing aprovado | nome, preço, validade, aviso ou outro dado diferente do aprovado na revisão pré-geração |
| Informação inventada | "colocou um selo que não existe", "inventou um número de parcelas" |
| Texto, badge ou elemento duplicado | "o preço aparece duas vezes" |
| Produto deformado | "o produto saiu esticado/torto" |
| Falha grave de composição que impeça a publicação | recorte que inviabiliza, sobreposição crítica |

**NÃO é elegível (blocked)** — o sistema explica e não gera:

- alterar qualquer dado aprovado na revisão pré-geração (o relato de defeito **não** é canal de edição);
- mudar preço, validade, produto, badge, fundo ou identidade **por preferência**;
- reposicionar/reestilizar elementos **sem existir defeito**;
- "não gostei", "faz outra opção", "quero outro visual" → nova campanha;
- **rebriefing** ou mudança estética.

**`unclear`** → orientação com exemplo ("pode ser algo como: o preço saiu cortado / o texto está ilegível / o nome do produto está errado"); **não gera e não consome**. **`blocked`** → orientação específica do motivo; **não gera e não consome**. Em ambos, o lojista pode **reformular imediatamente** (D37.2-R3) ou voltar e aprovar a candidata.

**Tentativa registrada:** o caso (1 por campanha) e a **primeira linha de tentativa** nascem juntos na **primeira submissão textual válida (antes da IA)**; cada tentativa posterior é **uma nova linha** em `campaign_correction_submissions` (texto, `analysis_state`, categoria, instrução normalizada, timestamps — D37.2-R5), inclusive `blocked`/`unclear`/`analysis_failed`. Um relato elegível é aceito **com base na declaração do lojista** — é o que permite ao suporte auditar depois.

### D37.2-R3 — Oportunidade única, consumo e rate limit

`DECIDIDO`

- **Uma única oportunidade de geração corretiva por campanha**, produzindo **no máximo uma v2**; depois disso não há nova geração (independentemente de sucesso ou falha pós-provider).
- **Consumo atômico via RPC própria** (nome novo, ex.: `consume_campaign_correction_opportunity(campaign_id, report_id, submission_id)`), chamada pelo hook **imediatamente antes da primeira chamada ao provider** (o instante em que `imageProvider.generateImage` seria invocado em `generateWithRetry`). Em uma transação, com **locks na ordem candidata → campanha → relato** (mesma ordem da RPC de aprovação protegida — D37.2-R8; anti-deadlock):
  1. trava a **candidata** (`campaign_art_versions` da campanha, `pending`/`active` — FOR UPDATE);
  2. trava a **campanha** (`campaigns` FOR UPDATE);
  3. trava o **relato** (`campaign_correction_reports` FOR UPDATE);
  4. valida: campanha `ready` e **pendente** (`approval_status='pending_approval'`, sem `approved_version_id`) e `rejection_count=0`; **o relato pertence à campanha** (`report.campaign_id = p_campaign_id`); **`report.reported_version_id` = id da candidata travada**; `report.status='open'`; e a **submissão vigente (`submission_id`) existe, pertence ao relato e está `eligible`**;
  5. grava atomicamente `rejection_count=1`, `correction_in_progress=true`, `report.status='generation_started'` e `report.generation_started_at=now()`.
- **Falha anterior ao provider** (preflight, montagem de contexto, validação de prompt) → a RPC de consumo **não roda**: nada é marcado, o caso permanece `open` e o lojista pode reenviar.
- **Falha depois do início do provider** (erro de provider, timeout, falha de persistência/upload da v2) → **consome** (a RPC já rodou): `rejection_count` **permanece 1**, `correction_in_progress` é liberado, `report.status='failed_no_v2'` e a **v1 continua aprovável**; não há nova tentativa de geração.
- **Sucesso** → a **conclusão da v2 NÃO incrementa `rejection_count` de novo** (já é 1): ela insere a v2 e demove a v1 (v1 preservada — D37.2-R5). A v2 vira a **única candidata**.
- **Corrida aprovar × consumir fechada no banco (D37.2-R8):** a RPC de consumo e a RPC de aprovação protegida disputam o mesmo lock da candidata na **mesma ordem**. Se a aprovação vencer, a campanha fica `approved` e o consumo subsequente falha na validação de pendência — a geração é abortada **antes** do provider (sem consumo, sem custo). Se o consumo vencer (`correction_in_progress=true`), a aprovação protegida subsequente falha em `correction_in_progress` (`409`) — **nenhuma geração paga roda após a aprovação**. A guarda de UX (cliente desabilita [Aprovar arte] com caso em processamento) é só reforço; a garantia é o banco.
- `rejection_count` passa a ser o **contador de consumo** da oportunidade (0 → 1 no consumo; nunca chega a 2 nesta fatia; o CHECK 0..2 da F37.1 permanece sem mudança).
- Enquanto a geração corretiva está em andamento, a candidata carrega `correction_in_progress=true` → UI/estado `regenerating` (gates de download/copy mantidos — D37.2-R7).

**Rate limit da análise (R3.1):** o custo de IA da análise é por tentativa, então há um guard anti-abuso **por campanha**, mas que **nunca bloqueia uma reformulação imediata após `unclear` nem pune erro legítimo de escrita**:

- **Serialização da criação (begin):** `begin_campaign_correction_submission` trava **primeiro a linha da campanha** (`campaigns` FOR UPDATE), **cria ou localiza o relato** (pai) e então trava o relato para abrir a janela — na primeira submissão o pai ainda não existe e não há linha para `FOR UPDATE` antes disso; a **`UNIQUE(campaign_id)`** do pai permanece como **defesa final** contra criação dupla.
- O caso (1 por campanha) e a **primeira tentativa** são criados juntos na **primeira submissão textual válida (antes da IA)**; cada tentativa posterior é uma nova linha em `campaign_correction_submissions` com `analysis_state='analyzing'` e **`analysis_expires_at`** (ex.: `now() + 2 min`, cobre o tempo da chamada de IA) — serializando tentativas simultâneas e fechando a janela, sem entrada incompleta nem > 3 análises concorrentes.
- **Recuperação de tentativa presa em `analyzing`:** se o processo cair após o begin (o bloco de conclusão não roda), o **próximo `begin` finaliza a tentativa `analyzing` expirada como `analysis_failed`** (com `completed_at`) **antes** de criar a nova — sem cron/reconciliador nesta fase.
- **No máximo 3 tentativas por campanha em janela de 30 minutos**, contadas pelas linhas da tabela filha via **`report_id` + `created_at`** (a filha **não** repete `campaign_id` — D37.2-R5, evita divergência). Texto vazio ou somente pontuação **não cria caso, não chama IA e não conta** na janela.
- `unclear`/`blocked`/`analysis_failed` não consomem a oportunidade → a 1ª reformulação imediata é sempre possível (tentativa 1 + reformulação = 2 ≤ 3); a 3ª dá folga para um segundo ajuste antes de orientar o suporte. `analysis_failed` (inclusive por expiração) conta como tentativa — e nunca bloqueia a reformulação imediata.
- Após consumo (RPC rodada) ou v2 gerada, novas tentativas são recusadas (`409`) independentemente da janela.

### D37.2-R4 — Geração da v2

`DECIDIDO`

A v2 é uma **nova composição orientada a evitar o defeito informado**, produzida pelo mesmo pipeline de geração de imagem (diretor + revisor automático), com as seguintes regras:

- **Briefing aprovado permanece totalmente imutável** — a v2 usa o mesmo snapshot `campaign_brief_v1` (F39) e a mesma identidade da campanha (nada é re-montado nem editado).
- **Imagens originais F41** (inputs persistidos em `campaign-images/{storeId}/{campaignId}/inputs/`, `media.images[].storagePath`) e **identidade vigente** são reutilizadas exatamente como na geração inicial.
- **NÃO enviar a v1 ao diretor como referência visual** — o diretor recebe apenas o briefing + imagens do produto + identidade + o bloco de não conformidade (sem `candidateArtDataUrl`).
- **Reuso do diretor atual por intent** (`campaign-image-director-{offer|spotlight|exclusive}` — F31.2/F45), selecionado por `commercial.intent` do snapshot, **+ um bloco pequeno e único de não conformidade** (instrução normalizada + preâmbulo fixo anti-invenção e de fidelidade ao briefing). **Solução preferencial:** acrescentar o bloco em tempo de montagem (mesmo padrão dos blocos condicionais já usados pelo `ImageGenerationService.assemblePrompt`), **sem duplicar três prompts completos e sem editar os arquivos `.md` atuais**.
- **Revisor automático atual permanece completamente intocado** (código e prompt de `campaign-image-reviewer`); a v2 passa pela mesma revisão de qualidade do fluxo normal (rede de segurança existente).
- **Sem revalidação de input/visão**: a v2 não re-avalia o produto contra o nome (brief já aprovado); o mecanismo de skip já existente (override `brief_review_confirmed`, F43) é usado para emitir a fase como `skipped`.
- **Sem copy director**: a v2 regenera somente a arte; copy não é reprocessado (F17 permanece).
- **Mesmo `operation_run_id` da campanha** (F38.1): os eventos call-level da v2 entram no mesmo run da entrega — custo aparece como mais eventos do mesmo run no painel F38.2, **sem operação financeira nova**.
- **Sem nova reserva de crédito, sem nova `credit_transactions`, sem nova `operation_key`** — a v2 é parte da mesma entrega (1 crédito = 1 campanha aprovada).
- **Sem refinamento financeiro nesta fase** (sem tipos novos de operação; contabilidade F38/F38.2 intacta).

#### Nota (R3/R4) — ponto de consumo no serviço

O `ImageGenerationService.generateImage` executa validação, montagem de prompt e o loop de geração/revisão internamente; a primeira chamada real ao provider acontece dentro de `generateWithRetry`. Para disparar a **RPC de consumo** no instante exato em que **a chamada ao provider começa**, a F37.2 adiciona um **hook opcional e aditivo** no serviço (callback assíncrono, ex.: `onBeforeImageProviderCall`, informado apenas pelo fluxo corretivo; ausência = comportamento atual inalterado). O hook roda **imediatamente antes da 1ª tentativa ao provider** e é o ponto que invoca a RPC de consumo; falhas que ocorrem **antes** desse hook não consomem (caso permanece `open`).

### D37.2-R5 — Persistência e suporte

`DECIDIDO`

**Registro das versões (`campaign_art_versions` reutilizada):**

- A **v1** continua sendo a linha criada pela F37.1 no `generate-image`.
- A **v2**, quando existir, é **uma nova linha** (`version_number=2`, `status='pending'`, `asset_status='active'`, `storage_path` próprio, `brief_snapshot` = mesmo snapshot aprovado, `generation_metadata` com o `operation_run_id` e snapshots econômicos da correção).
- **Assets de v1 e v2 são preservados** para suporte/auditoria: os arquivos permanecem no bucket **privado** `campaign-images`; a **UX/API do app nunca expõe a v1** depois que ela sai da candidatura (somente a candidata vigente é servida — mesmo existindo a policy `owner_select_campaign_images`, que dá SELECT ao dono no próprio prefixo por design da F41, nada na aplicação entrega a v1); o suporte acessa v1/v2 por **signed URLs geradas server-side** (`service_role`/admin), sem duplicar arquivos.
- Ao persistir a v2 com sucesso, a **v1 deixa de ser candidata** (fora da candidatura e **não aprovável pela UX nem pela API**), mas **sem descartar o asset nem perder o `storage_path`** da linha.

> **Confronto com o código (limitação da F37.1):** o modelo atual da F37.1 foi desenhado para "substituir → descartar a versão anterior" (`asset_status='discarded'` apaga o path; o RPC `approve_campaign_art_version` marca como `discarded` e zera `storage_path` de qualquer outra linha `active`). Esse lifecycle **não serve** ao requisito de preservar a v1 com path para suporte. A F37.2 resolve com **evolução de schema controlada** (RPCs existentes intocados — §6): (1) um novo valor de `asset_status` — `'superseded'` ("não é mais candidata, asset preservado") — que exige **trocar o CHECK atual de forma transacional e idempotente** (bloco `DO`, preservando `active|discarded` — ver §6); (2) **duas RPCs próprias** (nomes novos, nunca as dormentes): **consumo** (`consume_campaign_correction_opportunity`) que marca o início do provider (D37.2-R3) e **conclusão** (`complete_campaign_correction_v2`) que, atomicamente, insere a v2 (`pending`/`active`) → demove a v1 (`superseded`, path preservado, `correction_in_progress=false`) → grava `report.status='v2_generated'`/`generated_version_id` e os snapshots/metadata — **sem incrementar `rejection_count`** (já foi incrementado na RPC de consumo). O RPC `approve_campaign_art_version` da F37.1 **permanece como está** e aprova a candidata vigente (v1 se não houve v2; v2 se houve), sem conflito.

**Registro do relato e das tentativas (pai 1:campanha + filha 1:N tentativas):**

Tabela **`campaign_correction_reports`** (pai — 1 caso por campanha, **sem colunas de decisão espelhadas**); status + timestamps reconstroem o fluxo linear, **sem tabela genérica de eventos**:

| Campo | Conteúdo |
|---|---|
| `id` | uuid PK |
| `campaign_id` | FK `campaigns(id)` ON DELETE CASCADE; **UNIQUE** (1 caso por campanha) |
| `store_id` | FK `stores(id)` (filtro admin sem join) |
| `reported_version_id` | uuid FK `campaign_art_versions` — a v1 relatada (no consumo deve ser **exatamente** a candidata travada) |
| `generated_version_id` | uuid FK `campaign_art_versions` nullable — a v2, quando gerada |
| `status` | `open` → `generation_started` (consumida) → `v2_generated` \| `failed_no_v2` |
| `generation_started_at` | marco do consumo (início da 1ª chamada ao provider) |
| `operation_run_id` | mesmo run da campanha (rastro F38.2) |
| `created_at` / `updated_at` | timestamps |
| `reviewed_by_support_at` / `reviewed_by_support_user` | marcação ortogonal da fila admin |

Tabela filha **`campaign_correction_submissions`** (1 linha por tentativa — o histórico dos textos enviados; não é uma tabela de eventos genérica):

| Campo | Conteúdo |
|---|---|
| `id` | uuid PK |
| `report_id` | FK `campaign_correction_reports(id)` ON DELETE CASCADE |
| `text` | texto enviado pelo lojista (cru) |
| `analysis_state` | `analyzing` (nascimento, antes da IA) → `eligible \| blocked \| unclear \| analysis_failed` |
| `category` | categoria do defeito (taxonomia §4) quando elegível |
| `normalized_instruction` | instrução normalizada quando elegível |
| `analysis_expires_at` | expiração da tentativa `analyzing` (recuperação de queda sem cron — D37.2-R3.1) |
| `created_at` | momento da tentativa (janela do rate limit R3.1 — via `report_id` + `created_at`) |
| `completed_at` | preenchido ao sair de `analyzing` |

- **A filha NÃO guarda `campaign_id`**: a campanha é alcançada via `report_id` (evita divergência de dado duplicado); a janela do rate limit conta por `report_id` + `created_at`.
- **Nascimento com lifecycle seguro:** o caso (pai) e a **primeira tentativa** (`analyzing`) são criados juntos na primeira submissão textual válida, **antes da chamada à IA**, numa transação que **trava primeiro a linha da campanha, cria/localiza o relato e então trava o relato** — serializa a criação do pai e as tentativas simultâneas, fecha a janela do rate limit e evita entrada incompleta ou mais de 3 análises concorrentes. Tentativas posteriores = novas linhas na filha (mesma transação de trava).
- **Conclusão da análise:** a linha sai de `analyzing` para `eligible`/`blocked`/`unclear` (JSON + Zod ok) ou `analysis_failed` (timeout/transporte/vazio), com `completed_at`. **Decisão corrente do caso = última linha da filha** (derivada; sem colunas espelho no pai).
- **Recuperação (sem cron):** `analysis_expires_at` é definido no nascimento; se a conclusão não rodar (queda de processo após o begin), o **próximo `begin` finaliza tentativas `analyzing` expiradas como `analysis_failed`** antes de abrir a janela/criar a nova — a tentativa presa nunca bloqueia reformulações indefinidamente.
- **Aprovação final NÃO é espelhada no relato** (colunas duplicadas removidas): a fila admin a deriva de `campaigns.approved_version_id`/`campaigns.approved_at` e das versões — sem duplicação e **sem tocar** na RPC `approve_campaign_art_version`.

RLS service_role nas duas tabelas (padrão das tabelas de versão/flags); escrita só via API server-side (`supabaseAdmin`). **Sem** `support-evidence`, sem rotina de retenção e sem cópia duplicada de arquivos: o bucket `campaign-images` é privado, owners têm SELECT no próprio prefixo (`owner_select_campaign_images`, F41) e escrita/deleção são `service_role` — o suporte (admin/`service_role`) gera signed URLs das duas versões diretamente das linhas **sem duplicar nada**, e a aplicação simplesmente **nunca expõe a v1** após ela sair da candidatura (nenhum storage separado é necessário).

### D37.2-R6 — Fila administrativa simples (suporte)

`DECIDIDO`

- **Listagem** dos casos (campanha, loja, status do caso, **decisão corrente = derivada da última tentativa**, data) com **filtros básicos** (status do caso, `analysis_state` da última tentativa, revisado×não revisado) e paginação — padrão das páginas admin atuais.
- **Detalhe** com **v1 × v2 lado a lado** (signed URLs geradas server-side pelo admin/service_role), o **histórico de tentativas** (`campaign_correction_submissions`: texto → `analysis_state` → categoria → instrução → timestamps), status/consumo, `operation_run_id` (linkável ao painel F38.2) e timestamps. A **situação de aprovação é derivada** de `campaigns.approved_version_id`/`approved_at` + versões — não há campos espelhados no relato.
- **Marcação ortogonal "revisado pelo suporte"** (`reviewed_by_support_*`) — não interfere no fluxo do lojista nem na oportunidade.
- Acesso na **navegação administrativa existente** (`src/app/(app)/admin/layout.tsx`).
- **Páginas server-side** (`requireAdmin`) usam os **serviços internos diretamente** (padrão atual), sem chamar a própria API.

### D37.2-R7 — Gates, legado e flag desligada preservados

`DECIDIDO`

- **Flag off** e **legado** (sem linhas em `campaign_art_versions`): comportamento atual intacto — entrega imediata, sem revisão, sem novos botões.
- **Download e copy** seguem gated (F37.1): `pending`/`regenerating` → 403; `approved`/`legacy`/`not_enabled` → liberados. Nada muda nas rotas de download/publication-copy.
- **Apenas a candidata atual aparece** ao lojista (v1 enquanto não há v2; v2 após sucesso). **Sem galeria, sem voltar à v1 pela UX**, e a API rejeita aprovar a v1 após a v2 existir (a v1 fica fora da candidatura).
- `rejection_count` vira o **contador de consumo** da oportunidade: **0 → 1 na RPC de consumo** (início da 1ª chamada ao provider); a conclusão da v2 **não incrementa de novo** e a falha pós-provider **mantém 1**. A coluna preserva o CHECK 0..2 da F37.1 (nesta fatia nunca chega a 2). O guard de oportunidade única usa `rejection_count=0` + estado do caso + presença de v2 — não "cap 2".

### D37.2-R8 — Serialização aprovar × consumir no banco (RPC aditiva de aprovação protegida)

`DECIDIDO`

A RPC F37.1 `approve_campaign_art_version` é **intocada** e permanece a transação atômica de aprovação — mas ela **não lê `correction_in_progress`**, então **não pode ser o ponto de entrada da rota**: na corrida, a rota leria `correction_in_progress=false`, o consumo marcaria a oportunidade e a RPC antiga aprovaria a v1 em seguida, deixando **geração paga após a aprovação**. A F37.2 adiciona uma **RPC aditiva de aprovação protegida** (ex.: `approve_campaign_candidate(campaign_id, version_id)`), usada pela rota `POST /api/campaign/[id]/approve`:

1. Trava **primeiro a candidata** (`campaign_art_versions` FOR UPDATE);
2. Valida: pertence à campanha, `status='pending'`, `asset_status='active'` e **`correction_in_progress=false`** (senão → `409`);
3. Chama a RPC F37.1 `approve_campaign_art_version` **intacta** na mesma transação (a RPC antiga re-trava a mesma linha — lock já mantido, sem deadlock — e executa o descarte defensivo/repontagem como hoje).

**Ordem de locks consistente (anti-deadlock):** a RPC de aprovação protegida e a RPC de consumo travam na ordem **candidata → campanha** (a de consumo segue **candidata → campanha → relato**; a de aprovação nunca toca o relato). Quem obtiver o lock da candidata primeiro vence de forma consistente:

- **consumo vence** → `correction_in_progress=true`; a aprovação protegida subsequente falha em `correction_in_progress` (`409`) — **nenhuma geração paga roda após a aprovação**;
- **aprovação vence** → campanha `approved`; a RPC de consumo subsequente falha na validação de pendência e a geração é abortada **antes** do provider (sem consumo, sem custo).

A guarda de UX (desabilitar [Aprovar arte] com caso em processamento) é **reforço**, não a garantia — a garantia é a RPC aditiva no banco.

---

## 4. Política da correção (resumo normativo)

| O lojista pode relatar (elegível) | O lojista NÃO pode obter (blocked) |
|---|---|
| Elemento obrigatório cortado | Alterar qualquer dado aprovado na revisão pré-geração |
| Logo/produto/texto gravemente cortados | Mudar preço/validade/produto/badge/fundo/identidade por preferência |
| Texto ilegível ou corrompido | Reposicionar elementos sem defeito |
| Nome/preço/validade/aviso/dado divergente do briefing | "Outra opção" porque não gostou |
| Informação inventada | Rebriefing / mudança estética |
| Texto/badge/elemento duplicado | |
| Produto deformado | |
| Falha grave de composição que impeça a publicação | |

- A IA textual interpreta a declaração (tolera erros) e classifica `eligible | blocked | unclear` (JSON estrito + Zod); **não lê a imagem** para confirmar a veracidade. Resposta com JSON inválido/fora do schema → `unclear`; timeout/transporte/vazio → `analysis_failed`.
- Toda submissão textual válida **cria/atualiza o caso** (pai 1/campanha) com uma **tentativa** (`campaign_correction_submissions`, `analyzing` → estado final) — inclusive `blocked`/`unclear`/`analysis_failed`; relato elegível é aceito pela declaração. `blocked`/`unclear`/`analysis_failed` não geram e não consomem; texto vazio/pontuação não cria caso e não chama IA.
- Texto do lojista e `normalizedInstruction` são **conteúdo não confiável**: delimitados/saneados e **incapazes de sobrescrever o briefing** (anti-invenção).
- No máximo **1 geração corretiva** → no máximo **uma v2**, consumida no início do provider (RPC própria grava `rejection_count=1`; conclusão não incrementa de novo; serialização com a aprovação via RPC aditiva protegida — D37.2-R8). Sem v3. Sem correção factual de briefing (isso morreu com a antiga 37.3).

---

## 5. Estados resultantes na UX (após a F37.2)

| Estado derivado | Quando | UX |
|---|---|---|
| `not_enabled` | flag off | Entrega imediata como hoje |
| `legacy` | flag on, sem versões | Entrega imediata como hoje |
| `pending` (só v1) | revisão, sem relato consumido | [Aprovar arte] + [Informar problema] (modal) |
| `regenerating` | correção em andamento (`correction_in_progress=true` na candidata) | Bloqueia approve/download/copy; progresso da v2 |
| `pending` (v2 candidata) | v2 persistida | [Aprovar arte] (aprova a v2) · sem voltar à v1 |
| `approved` | aprovada | Entrega liberada (arte aprovada + copys + download) |

---

## 6. Cuidados arquiteturais e rollout

`DECIDIDO`

1. **Não reutilizar** o parser heurístico, os modos `visual_adjustment`/`creative_remake`, `candidateArtDataUrl`, o cap de 2 correções ou a semântica da antiga F37.2.
2. **Não reutilizar nem alterar** as assinaturas das RPCs dormentes `begin_campaign_correction`/`cancel_campaign_correction`/`complete_campaign_regeneration` (migration `20260905000001_f37_2_correction_rpcs.sql`, já aplicada no remoto, mantida localmente **exclusivamente como histórico**). Elas permanecem dormentes; contratos novos ganham **nomes próprios**.
3. **Migrations evolutivas e idempotentes**, em ordem **banco → código**, retrocompatíveis: primeiro os objetos novos (`campaign_correction_reports`, `campaign_correction_submissions`, RPCs próprias — begin da tentativa, consumo, conclusão e aprovação protegida `approve_campaign_candidate`) e a **troca transacional e idempotente do CHECK de `asset_status`** (acrescentar `'superseded'` **preservando** `active|discarded` — bloco `DO` idempotente no padrão do CHECK `campaigns_approved_requires_version` da F37.1). Não é uma adição pura de coluna: é uma **evolução de constraint declarada explicitamente** na migration (troca do CHECK, nunca `CREATE OR REPLACE` de RPC existente); nenhuma mudança destrutiva em `campaign_art_versions`/`campaigns`.
4. **Não alterar**: revisor (`image-review-service`/prompt), F45 (diretores/briefing), brief (F39), créditos (F24/F25) ou contabilidade (F38/F38.2).
5. **Não alterar** as rotas de geração inicial, download e publication-copy (apenas reutilização de gates).
6. **Preservar** comportamento legacy e flag desligada (fail-closed).
7. Artefato normativo **menor**: decisões superadas foram **removidas**, não acumuladas como exceções históricas (ver §11).
8. **Ordem de locks consistente (anti-deadlock):** a aprovação protegida e o consumo travam **candidata → campanha** (o consumo segue candidata → campanha → relato); nenhuma RPC nova altera a ordem da F37.1 nem toca o relato antes da campanha — quem obtém o lock da candidata primeiro vence (D37.2-R8).

---

## 7. Contratos mínimos esperados (definidos em detalhe no OpenSpec)

```
POST /api/campaign/[id]/problem-report        (NOVA — fluxo corretivo)
  body: { text: string }
  → texto vazio/pontuação → 400 (sem caso, sem IA)
  → validação local ok → begin (RPC própria, ex.: begin_campaign_correction_submission):
        na MESMA transação: trava a linha da campanha → cria/localiza o relato (pai) →
        trava o relato → finaliza tentativas `analyzing` expiradas como `analysis_failed`
        → cria a linha da tentativa (child, analysis_state='analyzing', analysis_expires_at)
        (serializa a criação do pai e as tentativas simultâneas; valida caso sem consumo
         e ≤ 3 tentativas/30min por report_id+created_at — retorna submission_id)
  → análise textual (JSON estrito + parse defensivo + Zod):
        200 JSON { analysis_state: "unclear" | "blocked", guidance }   (tentativa finalizada; sem gerar/consumir)
        200 NDJSON stream quando analysis_state='eligible'
              (análise aceita → image_generation (skip input_validation) → done/error)
        timeout/transporte/vazio → analysis_state='analysis_failed' (registrada; pode reformular)
  guards: CSRF → auth → ownership → flag on → status ready → caso sem consumo
          → rate limit R3.1 (≤ 3 tentativas/30min via tabela filha)
  consumo: rpc("consume_campaign_correction_opportunity", { campaign_id, report_id, submission_id })
           imediatamente antes da 1ª chamada ao provider (hook no serviço)
           locks candidata → campanha → relato; valida pendência + rejection_count=0 +
           relato da campanha + reported_version_id = candidata + submissão eligible;
           grava rejection_count=1 + generation_started_at + status 'generation_started'
  sem reserva de crédito; eventos sob campaign.operation_run_id

// Aprovação protegida (RPC F37.1 INTACTA, chamada dentro da nova):
POST /api/campaign/[id]/approve
  body: { versionId } → aprova a candidata vigente (v1 ou v2)
  → rota chama rpc("approve_campaign_candidate", { campaign_id, version_id })
       (trava a candidata 1º; valida pending/active + correction_in_progress=false → 409;
        depois invoca approve_campaign_art_version intacta na mesma transação)
  → NÃO espelha aprovação no relato (derivada de campaigns p/ a fila admin)

// Persistência nova (nomes próprios — NUNCA as RPCs dormentes da 37.2 antiga):
rpc("begin_campaign_correction_submission", { campaignId, text })  // cria caso+child analyzing (rate limit)
rpc("consume_campaign_correction_opportunity", { campaignId, reportId, submissionId })
rpc("complete_campaign_correction_v2", { ... })   // insere v2 + demove v1 (superseded) + fecha caso
rpc("approve_campaign_candidate", { campaignId, versionId })  // wrapper protegido (D37.2-R8)
// (nomes exemplificativos — definidos no OpenSpec)

// Admin:
GET /admin/campaign-reports (server page) → listagem/filtros
   (decisão corrente = última linha de campaign_correction_submissions)
GET /admin/campaign-reports/[reportId] (server page) → detalhe v1×v2 lado a lado
   (histórico de tentativas da tabela filha; aprovação por DERIVAÇÃO de campaigns + versões)
PATCH .../reviewed (via serviço interno/admin, marcação ortogonal)
```

**Novos arquivos esperados (indicativos — refinados no planejamento OpenSpec):**

- `src/lib/campaign/correction-reports.ts` (tipos + persistência do caso e das tentativas; begin/consumo/conclusão)
- `src/lib/campaign/correction-intent-service.ts` (IA textual → JSON estrito + Zod → `eligible|blocked|unclear` + categoria + `normalizedInstruction`, delimitada como conteúdo não confiável)
- Rota `src/app/api/campaign/[id]/problem-report/route.ts` + RPCs próprias (begin da tentativa, consumo, conclusão)
- Rota `approve` passando a chamar a RPC aditiva `approve_campaign_candidate`
- `src/components/campaign/campaign-problem-modal.tsx` + ajuste de copy/estado em `campaign-approval-view.tsx`
- Hook/bloco único de não conformidade na montagem do diretor (sem `.md` novo por intent)
- Páginas admin `campaign-reports` (+ link no layout admin)
- Migrations evolutivas (`campaign_correction_reports` + `campaign_correction_submissions` + troca idempotente do CHECK de `asset_status` com `superseded` + RPCs próprias: begin/consumo/conclusão/aprovação protegida)

---

## 8. Testes esperados (resumo por política)

1. **Análise/classificação** (serviço de IA mockado): vazio/pontuação → 400 sem caso e sem chamada; caso + **primeira tentativa (`analyzing`) nascem juntos antes da IA**; cada tentativa posterior é nova linha da filha; cada categoria elegível; exemplos blocked; unclear; reformulação imediata após unclear não consome; **JSON inválido/fora do schema → `unclear`**; **timeout/transporte/vazio → `analysis_failed`** (registrada, não consome); conteúdo não confiável não sobrescreve o briefing.
2. **Lifecycle da tentativa (begin RPC)**: begin trava **primeiro a linha da campanha** (serializa a criação do pai na 1ª submissão; `UNIQUE(campaign_id)` como defesa final) e depois o relato — serializando tentativas simultâneas (sem perder atualização e sem > 3 análises); **tentativa `analyzing` expirada é finalizada como `analysis_failed` no próximo begin** (recuperação de queda sem cron); linha sempre conclui com estado final + `completed_at`; janela ≤ 3 tentativas/30min contadas por `report_id` + `created_at`.
3. **Consumo (RPC própria)**: falha pré-provider **não chama a RPC** (caso `open`, pode reenviar); a RPC valida **pendência + `rejection_count=0` + relato pertence à campanha + `reported_version_id` = candidata travada + submissão vigente `eligible`** e grava atomicamente `rejection_count=1` + `generation_started_at` + status `generation_started`; falha pós-provider **mantém `rejection_count=1`**, libera `correction_in_progress` e grava `failed_no_v2` (v1 aprovável); sucesso **não incrementa de novo**; segunda tentativa após consumo → 409.
4. **Serialização aprovar × consumir no banco (R8)**: `approve_campaign_candidate` trava a candidata 1º e falha `409` se `correction_in_progress=true`; **consumo vence → aprovação protegida falha; aprovação vence → consumo falha na pendência e a geração é abortada antes do provider (sem custo)**; RPC F37.1 chamada intacta dentro do wrapper; testes de **ordem de locks** (candidata → campanha → relato) sem deadlock.
5. **Única v2**: sem v3; UI sem galeria/retorno à v1; **aprovar a v1 durante a análise** nunca deixa geração paga rodando após a aprovação.
6. **Geração v2**: brief idêntico (snapshot imutável); imagens F41 + identidade; **sem** v1 como referência; diretor por intent + bloco único; prompts `.md` atuais com diff vazio; revisor intocado; `input_validation` skipped; eventos no mesmo `operation_run_id`; sem `credit_transactions`/`operation_key` novas.
7. **Persistência**: v1 preservada com path após sucesso (`superseded` via troca do CHECK preservando `active|discarded`); v2 candidata única; v1 não aprovável pela API depois da v2; relato **sem colunas de aprovação espelhadas** (fila deriva de `campaigns`); decisão corrente derivada da última linha da filha.
8. **Gates/legado e Admin**: flag off e legacy intactos; download/copy `regenerating` → 403; UI dos novos botões só em `pending`; admin com listagem/filtros (decisão da última tentativa), detalhe v1×v2 lado a lado com **histórico de tentativas**, marcação revisado (ortogonal), aprovação por derivação.
9. **Regressão**: suites F37.1, generate-image, download, publication-copy, admin feature-flags verdes; `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Relato abre porta a rebriefing/variações | Elegibilidade restrita a defeito objetivo; IA textual classifica; blocked/unclear não geram; 1 geração máx; tentativas registradas p/ auditoria |
| Abuso da análise (custo de IA textual) | Rate limit por campanha (R3.1): ≤ 3 tentativas/30min via tabela filha; begin transacional serializa; vazio não chama IA |
| Saída da IA fora do contrato (JSON inválido/fora do schema) | Parse defensivo + Zod → `unclear`; timeout/transporte/vazio → `analysis_failed` (ambos sem gerar, sem consumir) |
| Custo da v2 aumenta o custo por entrega | Mesmo `operation_run_id` (F38.2 mostra o custo real); sem cobrança ao lojista; métrica = aprovação × margem |
| Falso claro/unclear com erro legítimo de escrita | IA tolerante a erros; reformulação imediata permitida; sem punição no rate limit |
| Corrida aprovar × consumir (geração paga após aprovação) | Serialização **no banco** com ordem consistente candidata → campanha → relato; `approve_campaign_candidate` valida `correction_in_progress=false`; consumo valida pendência (D37.2-R8) |
| Deadlock entre aprovar e consumir | Ordem de locks consistente (R8 / §6.8) — aprovação nunca toca o relato; consumo só trava o relato depois da campanha |
| Criação simultânea do caso na 1ª submissão (pai ainda inexistente) | `begin` trava **a linha da campanha primeiro** → cria/localiza o relato → trava o relato; `UNIQUE(campaign_id)` como defesa final |
| Tentativa presa em `analyzing` (queda de processo após o begin) | `analysis_expires_at` no nascimento; o **próximo `begin` finaliza `analyzing` expirada como `analysis_failed`** (com `completed_at`) antes de criar a nova — sem cron/reconciliador nesta fase |
| Divergência de `campaign_id` na tabela filha (dado duplicado) | Filha **não** repete `campaign_id` (campanha via `report_id`); janela conta por `report_id` + `created_at` |
| Guardas da F37.1 descartarem a v1 (path perdido) | Novo estado `superseded` preserva path; RPC própria de conclusão não passa pelo descarte da F37.1 |
| RPC dormente ser confundida com a nova | Nomes próprios novos; seção §11 deixa explícito o que está dormente |
| v2 não elimina o defeito | Revisor automático intocado como rede de segurança; sem v3; orientação ao suporte/nova campanha |

---

## 10. Fora do escopo

| Item | Motivo |
|---|---|
| Correção factual de briefing (`briefPatch`/snapshot corrigido) | Removida (era 37.3) — relato não edita dados aprovados |
| Referência visual da v1 / `candidateArtDataUrl` / estratégia A-B de referência | Abandonado (antiga 37.2) |
| Parser heurístico / `visual_adjustment` / `creative_remake` | Abandonado |
| Cap de 2 correções e v3 | Substituído por oportunidade única (máx v2) |
| Prompts `prompts/regen/*` (surgical/remake por intent) | Abandonado — diretor atual + bloco único |
| Galeria de versões / retorno à v1 pela UX | Candidata única |
| Nova reserva de crédito / `operation_key` / refinamento financeiro | Correção é parte da entrega |
| Alteração do revisor, dos diretores (F45), do brief (F39), de créditos ou contabilidade | Fora da fase |
| Alteração das RPCs dormentes ou de `approve_campaign_art_version` | Contratos congelados |
| Rebriefing estratégico de campanha existente | Nova campanha |
| Reembolso/estorno automático | Suporte avalia com contexto registrado |
| Notificações push/email, multi-approver, i18n, Stripe/F44 | Outros fluxos/escopos |

---

## 11. O que foi abandonado e por quê (registro curto)

| Item abandonado | Onde está preservado | Motivo do abandono |
|---|---|---|
| **F37.2 antiga "Correção Visual Com Referência"** (parser heurístico, `visual_adjustment`/`creative_remake`, arte candidata como referência principal, instrução anti pixel-perfect, modal em 2 etapas, `prompts/regen/*` surgical+remake, descarte da anterior, cap 2, `correction-parser.ts`, rota `/regenerate`) | Branch `backup/fase-37-antes-realignment` (também `openspec/changes/archive/2026-09-07-fase-37-2-correcao-visual-com-referencia` e `.planning/phases/37.2-correcao-visual-com-referencia`) | Modelo de "correção criativa guiada por texto livre" abria espaço para rebriefing/variações e custo alto de referência; substituído por correção **estrita a defeito objetivo**, oportunidade única e **sem referência da v1** |
| **F37.3 "Correção Única por Não Conformidade" como fatia independente** (nunca executada; 23 planos em `37-3-*`) | Branch `backup/fase-37-antes-realignment` (`.planning/phases/37.3-correcao-unica-por-nao-conformidade`, `openspec/changes/fase-37-3-correcao-unica-por-nao-conformidade`) | Escopo correto em substância, mas o fatiamento em 37.2+37.3 não se justifica; o fluxo vira **uma única F37.2 realinhada** (base técnica reaproveitada no planejamento, sem copiar decisões da antiga 37.2) |
| **RPCs `begin_campaign_correction` / `cancel_campaign_correction` / `complete_campaign_regeneration`** (migration `20260905000001_f37_2_correction_rpcs.sql`) | Migration mantida localmente como **histórico** (já aplicada no Supabase remoto); zero referências no código | Assinaturas/semântica da antiga 37.2 (descarte da anterior, cap 2); devem **permanecer dormentes** — não editar, apagar, reverter ou reutilizar |
| Correção factual de briefing (`briefPatch`), snapshot corrigido por versão, reabertura de hipótese "v4 paga"/meia cobrança | Decisões superadas neste documento (removidas, não acumuladas) | Brief aprovado é imutável; relato de defeito não é canal de edição |

**O que a F37.2 realinhada carrega do espírito original (mantido):** revisão com gate (F37.1), human-in-the-loop, 1 crédito = 1 campanha aprovada, correção incluída sem cobrança, telemetria por `operation_run_id`, candidata única, suporte com contexto registrado.

---

## 12. Checklist de revisão

**Base (F37.1 — intacta):**
- [ ] Flag `campaign_approval_enabled`; estados `not_enabled|legacy|pending|approved|regenerating`; `isDeliveryReleased`; gates download/copy; aprovação via RPC F37.1; legado entregue; v1 no `generate-image`.

**F37.2 realinhada:**
- [ ] Revisão em `pending` oferece [Aprovar arte] e [Informar problema] (apenas sob a flag)
- [ ] Modal com preview, orientação, campo obrigatório, [Enviar para análise]/[Cancelar]; Cancelar/X/ESC sem efeito
- [ ] Texto vazio/pontuação → 400, **sem caso e sem IA**
- [ ] **Caso (pai 1/campanha) + primeira tentativa nascem juntos na 1ª submissão textual válida (antes da IA)**; tentativas posteriores = linhas de `campaign_correction_submissions` (sem `campaign_id` duplicado — campanha via `report_id`); decisão corrente = última tentativa (sem colunas espelho)
- [ ] **Lifecycle da tentativa**: begin RPC **trava a linha da campanha → cria/localiza o relato → trava o relato** (serializa a criação do pai e a concorrência, fechando a janela; `UNIQUE(campaign_id)` como defesa final); tentativa nasce `analyzing` com `analysis_expires_at` e conclui em `eligible|blocked|unclear` (JSON + Zod) ou `analysis_failed` com `completed_at`
- [ ] **Recuperação sem cron**: no próximo begin, tentativa `analyzing` **expirada** é finalizada como `analysis_failed` antes de criar a nova (queda de processo após o begin não bloqueia reformulações)
- [ ] Análise textual (só texto) → saída **JSON estrito + Zod** + categoria + instrução normalizada; resposta inválida → `unclear`; texto/instrução delimitados e incapazes de sobrescrever o briefing
- [ ] Elegível segue a taxonomia objetiva; preferência/mudança de dados/rebriefing → blocked
- [ ] unclear/blocked/analysis_failed não geram, não consomem; reformulação imediata permitida (≤ 3 tentativas/30min por campanha via `report_id` + `created_at`)
- [ ] **Consumo atômico via RPC própria** (`campaign_id`+`report_id`+`submission_id`) imediatamente antes da 1ª chamada ao provider; locks **candidata → campanha → relato**; valida pendência + `rejection_count=0` + relato da campanha + `reported_version_id`=candidata + submissão vigente `eligible`; grava `rejection_count=1` + `generation_started_at` + status `generation_started`
- [ ] Falha pré-provider não chama a RPC (não consome); falha pós-provider mantém `rejection_count=1`, libera `correction_in_progress`, `failed_no_v2`, v1 aprovável; sucesso não incrementa de novo
- [ ] **Serialização aprovar × consumir no banco (R8)**: rota `approve` chama `approve_campaign_candidate` (trava candidata 1º, valida `correction_in_progress=false`, chama RPC F37.1 intacta); mesma ordem de locks; sem geração paga após aprovação
- [ ] v2 usa snapshot imutável + imagens F41 + identidade; SEM v1 como referência; diretor por intent + bloco único; `.md` atuais com diff vazio; revisor intocado; `input_validation` skipped
- [ ] Eventos v2 no mesmo `operation_run_id`; sem reserva de crédito/`operation_key`; sem refinamento financeiro
- [ ] v2 persistida (nova linha); v1 preservada (asset+path, `superseded`); candidata única; sem galeria/retorno à v1; v1 não aprovável após v2; **aprovação NÃO espelhada no relato** (derivada de `campaigns`)
- [ ] Fila admin (listagem/filtros com decisão da última tentativa; detalhe v1×v2 lado a lado com **histórico de tentativas**; marcação revisado) na navegação admin; server pages via serviços internos
- [ ] Flag off/legado/gates inalterados; `rejection_count` 0→1 **no consumo** (não no sucesso)
- [ ] RPCs dormentes intocadas; migrations evolutivas banco→código retrocompatíveis (pai+filha + troca idempotente do CHECK de `asset_status` preservando `active|discarded` + RPCs próprias); sem `CREATE OR REPLACE` sobre RPCs existentes
- [ ] Gates: `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros; UAT local com flag ligada

---

*Documento criado: 2026-08-06 · Revisado em 2026-09-09 — **realinhamento da F37**: F37.1 concluída como base; antiga 37.2 abandonada (backup `backup/fase-37-antes-realignment`); F37.3 eliminada; fluxo consolidado em **F37.2 realinhada (Correção Única por Não Conformidade)** com os princípios: correção só para defeito objetivo, IA textual que não lê a imagem, oportunidade única (máx v2), sem referência da v1, diretor atual por intent + bloco único, revisor/prompts/créditos/contabilidade intocados, migrations aditivas com contratos próprios e RPCs dormentes preservadas como histórico.*
