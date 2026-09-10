# Campaign Correction Reports

## Purpose

Modelo de dados e persistência do **caso de correção por não conformidade** (F37.2 realinhada — D37.2-R2/R3/R3.1/R5). Tabela **pai** `campaign_correction_reports` (1 caso por campanha, `UNIQUE(campaign_id)`, status `open → generation_started → v2_generated | failed_no_v2`, `reported_version_id` = v1 relatada, `generated_version_id` = v2 quando existir, `operation_run_id` = mesmo run da entrega, `reviewed_by_support_*` ortogonal) + tabela **filha** `campaign_correction_submissions` (1 linha por tentativa; **sem `campaign_id` repetido** — a campanha é alcançada via `report_id`; **`attempt_number` sequencial por relato com `UNIQUE(report_id, attempt_number)`** — ordenação determinística da submissão vigente). A **decisão corrente** do caso é **derivada da última tentativa por `attempt_number`** (sem colunas espelho no pai). Aprovação final **NÃO é espelhada** no relato (derivada de `campaigns`/versões). RLS service_role; escrita só server-side. A **RPC `begin_campaign_correction_submission`** serializa a criação do caso/tentativas com **locks na ordem candidata → campanha → relato** e valida **no banco** a pendência/candidata v1/ausência de v2 (fechando a corrida com a aprovação; defesa final: `UNIQUE(campaign_id)`), recusa tentativa `analyzing` ainda válida, finaliza `analyzing` expiradas como `analysis_failed` no próximo begin (recuperação sem cron), **atribui `attempt_number` sob o lock do relato** e aplica a **janela de no máximo 3 tentativas por campanha em 30 minutos** (contadas por `report_id` + `created_at`; teto absoluto após a 3ª). A **conclusão da análise** é feita pela RPC `complete_campaign_correction_analysis` com **validação semântica de estados** (estado final ∈ `eligible|blocked|unclear|analysis_failed`; `eligible` exige categoria permitida + instrução não vazia; demais estados **rejeitam** campos de geração) **+ condicionada a `analysis_state='analyzing'` + lease (`analysis_expires_at >= now()`) + submissão mais recente por `attempt_number`** — reforçada por CHECKs semânticos na tabela filha. As RPCs de **consumo** (`consume_campaign_correction_opportunity`, exige submissão elegível mais recente por `attempt_number`), **falha pós-provider** (`fail_campaign_correction_v2`, atômica), **recuperação preguiçosa pós-consumo** (`recover_campaign_correction_generation` — sem cron) e **conclusão da v2** (`complete_campaign_correction_v2`, contrato fechado com `brief_snapshot` copiado da v1 no banco) são especificadas aqui por tocarem o relato e a oportunidade única (locks e semântica R3/R5); a RPC F37.1 `approve_campaign_art_version` permanece **intacta** e a aprovação final segue fora desta capability.

## ADDED Requirements

### Requirement: Tabela campaign_correction_reports (pai, 1 caso por campanha)

O sistema SHALL prover a tabela `campaign_correction_reports` (pai — 1 caso por campanha; status + timestamps reconstroem o fluxo linear, **sem tabela genérica de eventos** e **sem colunas de decisão espelhadas**):

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`.
- `campaign_id` UUID NOT NULL REFERENCES `campaigns(id)` ON DELETE CASCADE + **UNIQUE (`campaign_id`)** (1 caso por campanha; defesa final contra criação dupla na 1ª submissão).
- `store_id` UUID NOT NULL REFERENCES `stores(id)` (filtro admin sem join).
- `reported_version_id` UUID NOT NULL REFERENCES `campaign_art_versions(id)` — a **v1 relatada**; no consumo deve ser **exatamente a candidata travada** (R3).
- `generated_version_id` UUID REFERENCES `campaign_art_versions(id)` — a **v2**, quando gerada (R5).
- `status` TEXT NOT NULL DEFAULT 'open' `CHECK (status IN ('open','generation_started','v2_generated','failed_no_v2'))`.
- `generation_started_at` TIMESTAMPTZ — marco do consumo (início da 1ª chamada ao provider).
- `operation_run_id` UUID — mesmo run da campanha (rastro F38.2).
- `reviewed_by_support_at` TIMESTAMPTZ / `reviewed_by_support_user` UUID — marcação ortogonal da fila admin (R6), sem interferir no fluxo.
- `created_at`/`updated_at` TIMESTAMPTZ.
- RLS habilitada com acesso somente `service_role` (padrão das tabelas de versão/flags); escrita só via API server-side (`supabaseAdmin`).

#### Scenario: Tabela criada com candidata única e RLS service_role

- **WHEN** a migration da fatia 37.2 é aplicada
- **THEN** a tabela `campaign_correction_reports` existe com os campos listados
- **AND** há `UNIQUE(campaign_id)` e RLS com acesso apenas `service_role`

#### Scenario: Segundo caso para a mesma campanha é rejeitado

- **WHEN** um insert cria um segundo relato para uma campanha que já tem um
- **THEN** o `UNIQUE(campaign_id)` rejeita a operação (defesa final)

#### Scenario: Aprovação não é espelhada no relato

- **WHEN** uma campanha com caso é aprovada (v1 ou v2)
- **THEN** o relato NÃO ganha colunas de aprovação
- **AND** a situação de aprovação é derivada de `campaigns.approved_version_id`/`approved_at` + versões

### Requirement: Tabela campaign_correction_submissions (filha, 1 linha por tentativa)

O sistema SHALL prover a tabela `campaign_correction_submissions` (filha — 1 linha por tentativa; histórico dos textos enviados; **não é tabela de eventos genérica**):

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`.
- `report_id` UUID NOT NULL REFERENCES `campaign_correction_reports(id)` ON DELETE CASCADE.
- **`attempt_number` SMALLINT NOT NULL** — número sequencial por relato (`1..n`), atribuído **sob o lock do relato** no begin (`COALESCE(MAX(attempt_number), 0) + 1`); **`UNIQUE (report_id, attempt_number)`** — ordenação determinística da submissão vigente (achado 3; `created_at` pode empatar, `attempt_number` não).
- `text` TEXT NOT NULL — texto enviado pelo lojista (cru).
- `analysis_state` TEXT NOT NULL DEFAULT 'analyzing' `CHECK (analysis_state IN ('analyzing','eligible','blocked','unclear','analysis_failed'))`.
- `category` TEXT — categoria do defeito (taxonomia §4 do alinhamento) quando elegível.
- `normalized_instruction` TEXT — instrução normalizada quando elegível.
- `analysis_expires_at` TIMESTAMPTZ NOT NULL — expiração da tentativa `analyzing` (lease da análise; recuperação de queda sem cron).
- `created_at` TIMESTAMPTZ DEFAULT now() — momento da tentativa (janela temporal do rate limit R3.1).
- `completed_at` TIMESTAMPTZ — preenchido ao sair de `analyzing`.

- A filha **NÃO guarda `campaign_id`**: a campanha é alcançada via `report_id` (evita divergência de dado duplicado). A janela temporal do rate limit (30 min) conta por `report_id` + `created_at`; a **decisão corrente/submissão vigente** usa `attempt_number` (ordem determinística, sem empate).
- **CHECKs semânticos da filha (defesa em profundidade — revisão 4, achado 2):** (a) `completed_at` só pode ser preenchido quando `analysis_state <> 'analyzing'` (tentativa finalizada nunca permanece `analyzing`); (b) `analysis_state = 'eligible'` exige `category IS NOT NULL` e `normalized_instruction IS NOT NULL` (com `trim(normalized_instruction) <> ''`); (c) `analysis_state IN ('blocked','unclear','analysis_failed')` exige `category IS NULL` e `normalized_instruction IS NULL` (estados não-elegíveis nunca carregam campos de geração).

#### Scenario: Tentativa nasce analyzing com attempt_number sequencial e conclui com estado final

- **WHEN** uma submissão textual válida cria uma tentativa
- **THEN** a linha nasce com `attempt_number` sequencial (`MAX+1` por `report_id`), `analysis_state='analyzing'` e `analysis_expires_at` preenchido
- **AND** ao concluir a análise, sai de `analyzing` para `eligible|blocked|unclear|analysis_failed` com `completed_at` preenchido

#### Scenario: Tentativa analyzing não pode ter completed_at

- **WHEN** uma linha `analyzing` tenta ser finalizada com `completed_at` sem mudar de estado
- **THEN** o CHECK rejeita (tentativa finalizada nunca permanece `analyzing`)

#### Scenario: Eligible exige categoria e instrução

- **WHEN** uma linha é marcada `analysis_state='eligible'` sem `category` ou com `normalized_instruction` vazia
- **THEN** o CHECK rejeita (eligible exige categoria + instrução normalizada não vazia)

#### Scenario: Não-elegível não pode carregar campos de geração

- **WHEN** uma linha `blocked`/`unclear`/`analysis_failed` é gravada com `category`/`normalized_instruction` preenchidos
- **THEN** o CHECK rejeita (estados não-elegíveis nunca carregam categoria/instrução)

#### Scenario: Filha não repete campaign_id e ordena por attempt_number

- **WHEN** a tabela filha é inspecionada
- **THEN** nenhuma coluna `campaign_id` existe (campanha via `report_id`)
- **AND** há `UNIQUE (report_id, attempt_number)`
- **AND** a janela do rate limit conta linhas por `report_id` + `created_at` (tempo), enquanto a submissão vigente é a de maior `attempt_number` (ordem)

#### Scenario: attempt_number duplicado é rejeitado

- **WHEN** um insert tenta criar uma segunda linha com o mesmo `attempt_number` para o mesmo `report_id`
- **THEN** o `UNIQUE (report_id, attempt_number)` rejeita a operação

### Requirement: RPC begin_campaign_correction_submission (lifecycle seguro da tentativa)

O sistema SHALL prover a RPC `begin_campaign_correction_submission(p_campaign_id uuid, p_text text) RETURNS jsonb` (`SECURITY DEFINER`, `SET search_path=''`, acesso `service_role`), que na **primeira submissão textual válida (antes da IA)** cria o **caso (pai) e a primeira tentativa (`analyzing`) juntos** na mesma transação, e em tentativas posteriores cria **uma nova linha na filha**. **Locks na ordem candidata → campanha → relato** (mesma ordem das demais RPCs do fluxo — anti-deadlock e **fechamento da corrida com a aprovação**, hardening de revisão):

1. Trava a **candidata v1** (`campaign_art_versions` da campanha com `version_number=1`, `status='pending'` e `asset_status='active'` — FOR UPDATE); ausente → `no_active_candidate` (409). A candidata existe sempre neste fluxo (flag on + campanha `pending`), portanto a trava serializa a criação do pai mesmo na 1ª submissão.
2. Trava a **campanha** (`campaigns` FOR UPDATE).
3. **Valida no banco** (fecha a corrida com a aprovação — se a aprovação venceu antes, o begin falha e **não cria caso nem chama IA**): `status='ready'` E `approval_status='pending_approval'` E `approved_version_id IS NULL` E `rejection_count=0` E **ausência de v2** (`campaign_art_versions.version_number=2` não existe) → senão `409` (`campaign_not_pending`/`already_consumed`).
4. **Cria (ou localiza) o relato pai** para a campanha com `reported_version_id` = id da candidata travada (v1) e `store_id` derivado da campanha; `UNIQUE(campaign_id)` permanece como **defesa final** contra criação dupla.
5. **Trava o relato** e abre a janela: finaliza tentativas `analyzing` **expiradas** (`analysis_expires_at < now()`) como `analysis_failed` (com `completed_at`) antes de criar a nova — **recuperação de queda de processo sem cron/reconciliador**.
6. **Recusa análise simultânea (hardening de revisão):** se existe tentativa `analyzing` **ainda válida** (não expirada) no relato → `409` (`analysis_in_progress`) — impede duas análises concorrentes e não "limpa" análise em voo.
7. Valida **caso sem consumo**: se o relato está `generation_started`/`v2_generated`/`failed_no_v2` (consumo ocorrido ou v2 gerada) → `409` — novas tentativas recusadas independentemente da janela (R3.1).
8. Aplica o **rate limit R3.1**: no máximo 3 tentativas por campanha em janela de 30 minutos, contadas pelas linhas da filha via `report_id` + `created_at >= now() - interval '30 minutes'`; se `>= 3` → `409` (`rate_limit_exceeded`). **Após a 3ª tentativa, uma 4ª é bloqueada mesmo que a anterior tenha terminado em `analysis_failed`** (limite absoluto prevalece sobre a reformulação imediata).
9. **Atribui `attempt_number`** sob o lock do relato: `COALESCE(MAX(attempt_number), 0) + 1` para o `report_id` (ordenamento determinístico — achado 3).
10. Insere a linha da tentativa na filha (`attempt_number`, `text`, `analysis_state='analyzing'`, `analysis_expires_at = now() + interval '2 minutes'`).
11. Retorna `{ report_id, submission_id, attempt_number, analysis_expires_at }` para a rota disparar a análise textual.

- Texto vazio ou somente pontuação **não chama a RPC** (validação local na rota — sem caso, sem IA, sem contar na janela).

#### Scenario: Caso e primeira tentativa nascem juntos na 1ª submissão

- **WHEN** um lojista envia o primeiro relato textual válido de uma campanha (antes da IA)
- **THEN** a RPC trava candidata v1 → campanha → cria/localiza o relato pai (`status='open'`, `reported_version_id` = candidata travada) → trava o relato e cria a primeira tentativa (`analyzing` com `analysis_expires_at`) na mesma transação
- **AND** retorna `report_id` e `submission_id`

#### Scenario: Begin fecha a corrida com a aprovação

- **WHEN** a campanha foi aprovada antes do begin (ou tem v2, ou `rejection_count>0`, ou não está `ready`/`pending_approval`)
- **THEN** a RPC valida no banco e responde `409` (`campaign_not_pending`/`already_consumed`/`no_active_candidate`)
- **AND** **nenhum caso é criado e nenhuma IA é chamada**

#### Scenario: Tentativas posteriores são novas linhas na filha

- **WHEN** o lojista reformula após `blocked`/`unclear`/`analysis_failed` (janela ainda aberta)
- **THEN** a RPC cria uma **nova linha** na filha (mesmo relato pai)
- **AND** `report_id` permanece o mesmo

#### Scenario: analyzing expirada é finalizada como analysis_failed no próximo begin

- **WHEN** o processo caiu após um begin (a conclusão da análise não rodou) e o lojista envia nova tentativa depois de `analysis_expires_at`
- **THEN** o próximo begin finaliza a tentativa `analyzing` expirada como `analysis_failed` (com `completed_at`) **antes** de criar a nova
- **AND** a tentativa presa nunca bloqueia reformulações indefinidamente

#### Scenario: Tentativa analyzing ainda válida impede nova análise simultânea

- **WHEN** existe uma tentativa `analyzing` **não expirada** no relato e o lojista envia outra submissão
- **THEN** a RPC responde `409` (`analysis_in_progress`)
- **AND** nenhuma linha nova é criada e nenhuma IA é chamada (impede duas análises concorrentes)

#### Scenario: Teto absoluto bloqueia a 4ª tentativa após a 3ª (inclusive analysis_failed)

- **WHEN** já existem 3 tentativas na janela de 30 minutos e a 3ª terminou em `analysis_failed`
- **THEN** uma nova submissão é recusada com `409` (`rate_limit_exceeded`)
- **AND** nenhuma linha nova é criada e nenhuma IA é chamada (o limite absoluto prevalece sobre a reformulação imediata)

#### Scenario: Caso já consumido recusa novas tentativas

- **WHEN** o relato da campanha está `generation_started`/`v2_generated`/`failed_no_v2` (RPC de consumo rodou ou v2 gerada)
- **THEN** uma nova submissão é recusada com `409` independentemente da janela

### Requirement: RPC complete_campaign_correction_analysis (conclusão da análise com guarda de estado e lease)

O sistema SHALL prover a RPC `complete_campaign_correction_analysis(p_report_id uuid, p_submission_id uuid, p_attempt_number smallint, p_analysis_state text, p_category text, p_normalized_instruction text) RETURNS jsonb` (`SECURITY DEFINER`, `SET search_path=''`, acesso `service_role`) que finaliza a análise **condicionada ao estado, à lease e à vigência** (hardening de revisão — achados 2/3):

- **Validação semântica do estado final (revisão 4, achado 2 + revisão 5, achado 3):** `p_analysis_state` SHALL ser um estado **final** — `eligible | blocked | unclear | analysis_failed` (**nunca `analyzing`**). Se `eligible`: `p_category` SHALL ser **categoria permitida da taxonomia §4** e `p_normalized_instruction` SHALL ser **não vazia** (após trim). Se `blocked`/`unclear`/`analysis_failed`: a RPC **REJEITA** qualquer `p_category`/`p_normalized_instruction` não-nulo com `non_eligible_must_not_have_generation_fields` (**regra única — evidencia erro do caller**). Violação → erro `invalid_analysis_state`/`eligible_requires_category_and_instruction`/`non_eligible_must_not_have_generation_fields`.
- Executa `UPDATE campaign_correction_submissions SET analysis_state=p_analysis_state, category=<segundo regra acima>, normalized_instruction=<segundo regra acima>, completed_at=now() WHERE id=p_submission_id AND report_id=p_report_id AND attempt_number=p_attempt_number AND analysis_state='analyzing' AND analysis_expires_at >= now() AND attempt_number = (SELECT MAX(attempt_number) FROM campaign_correction_submissions WHERE report_id=p_report_id)`.
- Se nenhuma linha é atualizada (`rowcount = 0`) → `409` com código distinto: `submission_not_analyzing` (já finalizada/concluída), `analysis_lease_expired` (`analysis_expires_at < now()` — resposta tardia) ou `submission_stale` (não é mais a mais recente por `attempt_number`). Em qualquer caso, **nada é sobrescrito** e não há conclusão dupla.
- A conclusão exige simultaneamente: (a) a tentativa ainda está `analyzing`; (b) a **lease está válida** (`analysis_expires_at >= now()`) — uma resposta tardia da IA **NÃO** vira `eligible` depois de expirada; (c) a submissão **continua sendo a mais recente do relato por `attempt_number`** — não concorre com uma reformulação já criada.
- A rota chama a RPC após a análise textual (R2): `p_analysis_state ∈ eligible|blocked|unclear` (+ `category`/`normalized_instruction` quando elegível). `analysis_failed` por timeout/transporte/vazio também é registrado via a mesma RPC com o estado final e `completed_at`.
- **Defesa em profundidade:** CHECKs de tabela (requisito "Tabela campaign_correction_submissions") garantem os mesmos invariantes mesmo em chamada direta (sem depender só da RPC).

#### Scenario: Conclusão normal finaliza a tentativa analyzing dentro da lease

- **WHEN** a análise terminou (`eligible`/`blocked`/`unclear`) dentro da lease, com a tentativa ainda `analyzing` e ainda a mais recente
- **THEN** a RPC atualiza a linha para o estado final com `category`/`normalized_instruction` (quando aplicável) e `completed_at`

#### Scenario: Estado analyzing é rejeitado como estado final

- **WHEN** a RPC de conclusão é chamada com `p_analysis_state='analyzing'`
- **THEN** responde erro (`invalid_analysis_state`) e nada é alterado (estado final nunca é `analyzing`)

#### Scenario: Eligible sem categoria ou instrução é rejeitado

- **WHEN** a RPC de conclusão é chamada com `p_analysis_state='eligible'` sem `p_category` permitida ou com `p_normalized_instruction` vazia
- **THEN** responde erro (`eligible_requires_category_and_instruction`) e nada é alterado

#### Scenario: Blocked/unclear/analysis_failed não carregam campos de geração

- **WHEN** a RPC de conclusão recebe `p_analysis_state='blocked'`/`'unclear'`/`'analysis_failed'` com `p_category`/`p_normalized_instruction` preenchidos
- **THEN** a RPC **rejeita** com `non_eligible_must_not_have_generation_fields` (regra única — evidencia erro do caller) e nada é alterado
- **AND** o CHECK de tabela mantém o invariante (defesa em profundidade)

#### Scenario: Resposta tardia após a lease não vira eligible

- **WHEN** a RPC de conclusão é chamada para uma tentativa com `analysis_expires_at < now()` (resposta tardia da IA)
- **THEN** a RPC responde `409` (`analysis_lease_expired`) e **nada é sobrescrito** — a tentativa não vira `eligible` depois de expirada

#### Scenario: Resposta de tentativa que não é mais a mais recente é recusada

- **WHEN** a conclusão chega para uma submissão cujo `attempt_number` não é o maior do relato (uma reformulação já foi criada)
- **THEN** a RPC responde `409` (`submission_stale`) e **nada é sobrescrito**

#### Scenario: Resposta atrasada não sobrescreve tentativa já finalizada

- **WHEN** a RPC de conclusão é chamada para uma tentativa que já saiu de `analyzing` (ex.: expirada e convertida em `analysis_failed` por um begin posterior, ou já concluída)
- **THEN** a RPC responde `409` (`submission_not_analyzing`) e **nada é sobrescrito**

### Requirement: RPC fail_campaign_correction_v2 (falha pós-provider atômica)

O sistema SHALL prover a RPC `fail_campaign_correction_v2(p_campaign_id uuid, p_report_id uuid) RETURNS jsonb` (`SECURITY DEFINER`, `SET search_path=''`, acesso `service_role`) para a **falha depois do início do provider** (hardening de revisão — operação atômica, sem atualizações TS separadas que possam falhar parcialmente e deixar a campanha presa em `regenerating`):

- Locks na ordem **candidata → campanha → relato** (mesma ordem das demais RPCs).
- Valida que o consumo ocorreu: relato da campanha com `status='generation_started'` e candidata com `correction_in_progress=true` (senão → `409` `report_not_generation_started`).
- Grava atomicamente: **`rejection_count` permanece 1** (já incrementado na RPC de consumo), `correction_in_progress=false` na candidata, `report.status='failed_no_v2'`.
- A **v1 continua aprovável**; não há nova tentativa de geração (sem v3).
- Em **upload concluído com falha no banco** (asset órfão da v2 já gravado no bucket), o caller remove o arquivo **best-effort** (try/catch) — a remoção é operacional, não transacional, e não bloqueia o fail.

#### Scenario: Falha pós-provider libera a candidata e marca failed_no_v2 atomicamente

- **WHEN** o provider falha após o consumo (RPC já rodou) e a v2 não é persistida
- **THEN** a RPC `fail_campaign_correction_v2` mantém `rejection_count=1`, libera `correction_in_progress` e grava `report.status='failed_no_v2'` na mesma transação
- **AND** a v1 continua aprovável e não há nova tentativa de geração

#### Scenario: Falha sem consumo é recusada

- **WHEN** a RPC `fail_campaign_correction_v2` é chamada para um relato que não está `generation_started` (consumo não ocorreu)
- **THEN** responde `409` e nada é alterado

### Requirement: RPC recover_campaign_correction_generation (recuperação preguiçosa pós-consumo)

O sistema SHALL prover a RPC `recover_campaign_correction_generation(p_campaign_id uuid, p_stale_before timestamptz DEFAULT NULL) RETURNS jsonb` (`SECURITY DEFINER`, `SET search_path=''`, acesso `service_role`) para evitar que uma **queda de processo/serverless após o consumo** deixe a campanha presa em `regenerating` (revisão 4, achado 1 — sem cron/reconciliador nesta fase):

- Locks na ordem **candidata → campanha → relato** (mesma ordem das demais RPCs).
- Valida se há consumo **em andamento**: relato da campanha com `status='generation_started'` e candidata com `correction_in_progress=true`.
- **Contrato executável do timeout (revisão 5, achado 2):** o SQL não lê env/TS — o teto é comparado com **`report.generation_started_at < COALESCE(p_stale_before, now() - interval '330 seconds')`**. `p_stale_before` é calculado pelo backend com a configuração vigente (`CORRECTION_GENERATION_STALE_AFTER_MS = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS (300s) + 30s`); quando NULL, o **default normativo fixo de 330 segundos** se aplica. Sem "ler env no SQL".
- Se o consumo excedeu o teto **sem** ter concluído (`v2_generated`) nem falhado (`failed_no_v2`) → **reverte o consumo atomicamente**: mantém `rejection_count=1` (oportunidade única já consumida — não libera nova geração), grava `report.status='failed_no_v2'`, libera `correction_in_progress=false` na candidata → **v1 volta a ser candidata/aprovável (deriva `pending`)**; retorna `{ recovered: true }`.
- **Download/copy permanecem bloqueados após a recuperação (revisão 5, achado 1):** a v1 recuperada continua `pending_approval` e o gate F37.1 (`isDeliveryReleased` false para `pending`) **não muda** — download/copy só são liberados depois que o lojista **aprova explicitamente** a v1 (`approve_campaign_candidate`). A recuperação apenas remove `correction_in_progress` (desbloqueia a possibilidade de aprovar); **não libera a entrega**.
- Se não há consumo em andamento, ou `generation_started_at` é recente (processo vivo/em andamento) → **no-op** `{ recovered: false }` (nada é alterado).
- **Acionamento lazy (best-effort):** (a) ao carregar uma campanha que deriva `regenerating` (página `/campanhas/[id]`/display) — **quando `recovered:true`, o caller RECARREGA campanha/versões do banco (nova leitura) antes de recalcular o estado** (re-derivar sobre os mesmos objetos continuaria vendo `correction_in_progress=true`; revisão 6, achado 1); (b) na rota `POST /api/campaign/[id]/approve` **antes** de chamar `approve_campaign_candidate` — se o consumo está preso, a recuperação libera e a aprovação prossegue; se o processo ainda está vivo, no-op e a aprovação segue o fluxo (409 por `correction_in_progress`).
- Falha da RPC de recuperação NÃO derruba a página/approve (best-effort; a aprovação continua bloqueada pelo estado até nova tentativa/suporte).
- **Nota:** a recuperação resolve o estado no banco; um asset órfão de upload de um processo que caiu é limpo pelo suporte (best-effort, sem rotina automática nesta fase).

#### Scenario: Consumo preso além do timeout é revertido no carregamento

- **WHEN** o relato está `generation_started` com `correction_in_progress=true` e `generation_started_at` excedeu o teto (`< p_stale_before` ou o default de 330s) (processo morreu antes de concluir/falhar)
- **THEN** a RPC de recuperação grava atomicamente `failed_no_v2` (mantendo `rejection_count=1`), libera `correction_in_progress` e retorna `{ recovered: true }`
- **AND** a v1 volta a ser candidata/aprovável (deriva `pending`) — mas **download/copy permanecem bloqueados** até a aprovação explícita

#### Scenario: Timeout executável sem env no SQL

- **WHEN** a RPC roda sem `p_stale_before`
- **THEN** o teto usa o **default normativo `now() - interval '330 seconds'`** (não lê env/TS no SQL)
- **WHEN** a RPC roda com `p_stale_before` fornecido pelo backend
- **THEN** o teto usa o parâmetro (configuração vigente)

#### Scenario: Consumo em andamento recente não é revertido

- **WHEN** o relato está `generation_started` com `correction_in_progress=true` e `generation_started_at` recente (geração ainda viva)
- **THEN** a RPC responde `{ recovered: false }` (no-op) e nada é alterado

#### Scenario: Sem consumo em andamento é no-op

- **WHEN** o relato está `open`/`failed_no_v2`/`v2_generated` (ou inexistente)
- **THEN** a RPC responde `{ recovered: false }` e nada é alterado

#### Scenario: Aprovação dispara a recuperação antes de aprovar

- **WHEN** um lojista tenta aprovar uma campanha cujo consumo está preso além do timeout
- **THEN** a rota `approve` chama a recuperação (best-effort) e, com a v1 candidata/aprovável, prossegue com `approve_campaign_candidate`
- **AND** se o consumo ainda está vivo (recente), a recuperação é no-op e a aprovação falha 409 (`correction_in_progress`)
- **AND** mesmo após recuperar, download/copy continuam bloqueados até a aprovação ser concluída

### Requirement: RPC consume_campaign_correction_opportunity (consumo atômico da oportunidade)

O sistema SHALL prover a RPC `consume_campaign_correction_opportunity(p_campaign_id uuid, p_report_id uuid, p_submission_id uuid) RETURNS jsonb` (`SECURITY DEFINER`, `SET search_path=''`, acesso `service_role`), chamada pelo hook `onBeforeImageProviderCall` do `ImageGenerationService` **imediatamente antes da 1ª chamada real ao provider**. Em uma transação, com **locks na ordem candidata → campanha → relato** (mesma ordem da RPC de aprovação protegida — anti-deadlock, R8):

1. Trava a **candidata** (`campaign_art_versions` da campanha com `status='pending'` e `asset_status='active'` — FOR UPDATE).
2. Trava a **campanha** (`campaigns` FOR UPDATE).
3. Trava o **relato** (`campaign_correction_reports` FOR UPDATE).
4. Valida: campanha `ready` e **pendente** (`approval_status='pending_approval'`, sem `approved_version_id`) e `rejection_count=0`; **o relato pertence à campanha** (`report.campaign_id = p_campaign_id`); **`report.reported_version_id` = id da candidata travada**; `report.status='open'`; e a **submissão vigente (`submission_id`) existe, pertence ao relato, está `analysis_state='eligible'` E é a mais recente do relato por `attempt_number`** (`attempt_number = (SELECT MAX(attempt_number) ...)` para o `report_id` — ordenação determinística, achado 3; impede consumir uma submissão que já não é a decisão corrente).
5. Grava atomicamente: `campaigns.rejection_count=1`, candidata `correction_in_progress=true`, `report.status='generation_started'` e `report.generation_started_at=now()`.

- **Falha anterior ao provider** (preflight, montagem, validação de prompt) → a RPC de consumo **não roda** (o hook está imediatamente antes do provider): nada é marcado, o caso permanece `open` e o lojista pode reenviar.
- **Falha depois do início do provider** (erro de provider, timeout, falha de persistência/upload da v2) → **consome** (a RPC já rodou) e a conclusão de falha é feita pela **RPC própria `fail_campaign_correction_v2`** (atômica — ver requisito próprio): `rejection_count` **permanece 1**, `correction_in_progress` é liberado, `report.status='failed_no_v2'` e a **v1 continua aprovável**; não há nova tentativa de geração.
- **Sucesso** → a conclusão da v2 **NÃO incrementa `rejection_count` de novo** (já é 1).

#### Scenario: Consumo valida pendência, relato e submissão elegível mais recente por attempt_number

- **WHEN** o hook chama a RPC de consumo para uma campanha pendente com relato `open` e submissão vigente `eligible` **de maior `attempt_number` do relato**
- **THEN** grava atomicamente `rejection_count=1`, `correction_in_progress=true`, `status='generation_started'` e `generation_started_at=now()`

#### Scenario: Submissão não é a mais recente do relato é recusada

- **WHEN** a submissão `eligible` informada NÃO é a de maior `attempt_number` da filha para o relato (decisão corrente é outra)
- **THEN** a RPC de consumo responde `409` (`submission_stale`) e nada é alterado

#### Scenario: Aprovação vence a corrida e o consumo falha na pendência

- **WHEN** a campanha já foi aprovada (`approved_version_id` preenchido) antes da RPC de consumo
- **THEN** a RPC falha na validação de pendência
- **AND** a geração é abortada **antes do provider** (sem consumo, sem custo)

#### Scenario: Consumo vence e aprovação protegida posterior falha (409)

- **WHEN** a RPC de consumo marcou `correction_in_progress=true`
- **THEN** a RPC de aprovação protegida subsequente falha com `409`
- **AND** nenhuma geração paga roda após a aprovação

#### Scenario: Falha pós-provider mantém rejection_count=1 e v1 aprovável (via RPC de fail)

- **WHEN** o provider falha após o consumo (RPC já rodou) e a v2 não é persistida
- **THEN** a RPC `fail_campaign_correction_v2` roda atomicamente (mantém `rejection_count=1`, libera `correction_in_progress`, grava `report.status='failed_no_v2'`)
- **AND** a v1 continua aprovável (sem nova tentativa de geração)

#### Scenario: reported_version_id deve ser a candidata travada

- **WHEN** o `report.reported_version_id` NÃO é o id da candidata travada
- **THEN** a RPC de consumo falha (`version_mismatch`)

### Requirement: RPC complete_campaign_correction_v2 (conclusão atômica da v2 — contrato fechado)

O sistema SHALL prover a RPC `complete_campaign_correction_v2(p_campaign_id uuid, p_report_id uuid, p_submission_id uuid, p_storage_path text, p_mime_type text, p_generation_metadata jsonb, p_render_snapshot jsonb) RETURNS jsonb` (`SECURITY DEFINER`, `SET search_path=''`, acesso `service_role`) que, atomicamente, ao persistir a v2 com sucesso (contrato fechado — achado 1):

1. Trava a **candidata** (`campaign_art_versions` da campanha — FOR UPDATE), depois a **campanha** (`campaigns` FOR UPDATE) e o **relato** (`campaign_correction_reports` FOR UPDATE) — **mesma ordem de locks das demais RPCs** (candidata → campanha → relato, anti-deadlock). Validações derivadas do banco: `report.status='generation_started'`, candidata com `correction_in_progress=true`, `rejection_count=1` (consumo já ocorreu), `submission_id` = submissão **mais recente do relato por `attempt_number`** referente ao consumo, v2 ainda não existe (`version_number=2` ausente — sem dupla conclusão), e `p_storage_path` distinto do `storage_path` da v1.
2. **Lê a v1 travada** no banco e usa o **`brief_snapshot` dela como `brief_snapshot` da v2** — o snapshot **NUNCA é aceito como parâmetro do cliente** (imutabilidade do briefing aprovado).
3. **Insere a v2** em `campaign_art_versions`: `version_number=2`, `status='pending'`, `asset_status='active'`, `storage_path = p_storage_path`, `mime_type = p_mime_type`, `brief_snapshot` = cópia da v1 no banco, `generation_metadata = p_generation_metadata` (com o `operation_run_id` e snapshots econômicos da correção), `render_snapshot = p_render_snapshot`, `correction_in_progress=false`.
4. **Demove a v1** para `asset_status='superseded'` (**path preservado** — NÃO passa pelo descarte da F37.1 `discarded`/`storage_path=NULL`) e `correction_in_progress=false`.
5. Grava no relato: `status='v2_generated'`, `generated_version_id = id da v2`.
6. **NÃO incrementa `rejection_count`** (já foi incrementado na RPC de consumo).

- Se qualquer passo falhar, nada é aplicado (ROLLBACK automático do bloco).

#### Scenario: Conclusão insere a v2 e demove a v1 com path preservado

- **WHEN** a v2 foi gerada com sucesso e a RPC de conclusão roda com a identidade do caso (`campaign_id`/`report_id`/`submission_id`) e os dados do asset gerado
- **THEN** uma nova linha em `campaign_art_versions` nasce com `version_number=2`, `status='pending'`, `asset_status='active'`, `storage_path`/`mime_type` do asset gerado e **`brief_snapshot` copiado da v1 no banco**
- **AND** a v1 vira `asset_status='superseded'` com `storage_path` **preservado**
- **AND** `rejection_count` NÃO é incrementado (permanece 1)
- **AND** o relato vira `status='v2_generated'` com `generated_version_id` preenchido

#### Scenario: Brief snapshot nunca vem do cliente

- **WHEN** a RPC de conclusão roda
- **THEN** o `brief_snapshot` da v2 é a cópia da v1 travada no banco
- **AND** nenhum parâmetro do cliente carrega o snapshot (brief aprovado permanece imutável)

#### Scenario: Demove a v1 sem descartar o asset

- **WHEN** a conclusão demove a v1
- **THEN** a v1 NÃO recebe `asset_status='discarded'` nem `storage_path=NULL` (só `superseded`)
- **AND** o asset permanece acessível para suporte/auditoria via signed URLs server-side

#### Scenario: Dupla conclusão é impedida

- **WHEN** a RPC de conclusão é chamada duas vezes para a mesma campanha
- **THEN** a segunda chamada falha (v2 já existe) e nada é alterado

### Requirement: Aprovação final não é espelhada no relato

O sistema SHALL **NÃO** espelhar a aprovação final no relato: a fila admin deriva a situação de aprovação de `campaigns.approved_version_id`/`campaigns.approved_at` e das versões — **sem duplicação e sem tocar** na RPC `approve_campaign_art_version`.

#### Scenario: Relato não guarda colunas de aprovação

- **WHEN** uma campanha com caso é aprovada (v1 ou v2)
- **THEN** `campaign_correction_reports` NÃO contém colunas de aprovação final
- **AND** a decisão corrente do caso é derivada da tentativa de maior `attempt_number` de `campaign_correction_submissions`
