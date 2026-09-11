# Admin Campaign Reports

> Synced from `fase-37-2-correcao-unica-por-nao-conformidade` (ADDED).

## Purpose

Fila administrativa simples dos relatos de não conformidade da arte (F37.2 realinhada — D37.2-R6). Listagem dos casos (campanha, loja, status do caso, **decisão corrente = derivada da tentativa de maior `attempt_number`**, data) com filtros básicos (status do caso, `analysis_state` da tentativa vigente, revisado×não revisado) e paginação; **detalhe** com v1 × v2 lado a lado (signed URLs server-side/service_role), o **histórico de tentativas** (`campaign_correction_submissions` ordenado por `attempt_number`: texto → `analysis_state` → categoria → instrução → timestamps), status/consumo, `operation_run_id` (linkável ao painel F38.2) e timestamps; **marcação ortogonal "revisado pelo suporte"**. A **situação de aprovação é derivada** de `campaigns.approved_version_id`/`approved_at` + versões — sem campos espelhados no relato. Acesso na navegação administrativa existente; páginas server-side (`requireAdmin`) usam os serviços internos diretamente (padrão atual, sem chamar a própria API).

## Requirements

### Requirement: Listagem admin de relatos de correção

O sistema SHALL prover uma página server-side `/admin/campaign-reports` (padrão das páginas admin atuais — `requireAdmin` + serviços internos/supabaseAdmin):

- Lista os casos (`campaign_correction_reports`) com: campanha, loja, status do caso, **decisão corrente derivada da tentativa de maior `attempt_number`** (`analysis_state` da tentativa vigente de `campaign_correction_submissions`), `reported_version_id`/`generated_version_id`, data de criação, estado de revisado pelo suporte.
- Filtros básicos: status do caso, `analysis_state` da tentativa vigente (maior `attempt_number`), revisado×não revisado.
- Paginação (padrão admin — links de página).
- Cada linha permite navegar ao detalhe do caso.

#### Scenario: Listagem exibe casos com decisão derivada da tentativa vigente

- **WHEN** um admin abre `/admin/campaign-reports`
- **THEN** vê os casos com status do caso e `analysis_state` da tentativa de maior `attempt_number` de cada um
- **AND** pode filtrar por status do caso / análise da tentativa vigente / revisado×não revisado e paginar

### Requirement: Detalhe do relato com v1 × v2 lado a lado e histórico de tentativas

O sistema SHALL prover a página server-side `/admin/campaign-reports/[reportId]`:

- **v1 × v2 lado a lado**: signed URLs geradas server-side (`service_role`/admin) para a v1 relatada e a v2 gerada (quando existir) — **sem duplicar arquivos** e respeitando a preservação de assets (`superseded` mantém path).
- **Histórico de tentativas** da filha (`campaign_correction_submissions`) ordenado por `attempt_number`: nº da tentativa, texto enviado → `analysis_state` → categoria → instrução normalizada → timestamps (`created_at`/`completed_at`).
- Status/consumo do caso: `status`, `rejection_count` (0/1), `generation_started_at`, `failed_no_v2`/`v2_generated`, `generated_version_id`.
- `operation_run_id` (rastro F38.2 — linkável ao painel de custos).
- **Situação de aprovação derivada**: `campaigns.approved_version_id`/`approved_at` + versões (sem campos espelhados no relato).
- Marcação ortogonal "revisado pelo suporte".

#### Scenario: Detalhe mostra v1 e v2 lado a lado com histórico

- **WHEN** um admin abre o detalhe de um caso com v2 gerada
- **THEN** vê v1 e v2 lado a lado (signed URLs server-side)
- **AND** o histórico completo de tentativas ordenado por `attempt_number` (nº → texto → estado → categoria → instrução → timestamps)
- **AND** o `operation_run_id` e a situação de aprovação derivada

#### Scenario: Histórico mostra as tentativas na ordem determinística

- **WHEN** um caso tem múltiplas tentativas (ex.: unclear → reformulação → eligible)
- **THEN** o detalhe lista cada tentativa com `attempt_number`, texto, `analysis_state`, categoria/instrução quando elegível e timestamps
- **AND** a decisão corrente é a de maior `attempt_number` (sem empate de `created_at`)

### Requirement: Marcação "revisado pelo suporte" (ortogonal)

O sistema SHALL permitir marcar um caso como **revisado pelo suporte** (`reviewed_by_support_at`/`reviewed_by_support_user`):

- Ação admin (via serviço interno/admin — padrão de mutação admin atual) atualiza apenas os campos ortogonais.
- **Não interfere** no fluxo do lojista nem na oportunidade (não muda `status` do caso, `rejection_count`, versões ou aprovação).

#### Scenario: Admin marca caso como revisado sem afetar o fluxo

- **WHEN** um admin marca um caso como revisado
- **THEN** `reviewed_by_support_at`/`reviewed_by_support_user` são preenchidos
- **AND** o fluxo do lojista (aprovar/reformular) e a oportunidade permanecem inalterados

### Requirement: Acesso na navegação administrativa

O sistema SHALL incluir o link para a fila na navegação administrativa existente (`src/app/(app)/admin/layout.tsx`), e as páginas SHALL ser server-side com `requireAdmin` chamando serviços internos diretamente (padrão atual — sem chamar a própria API).

#### Scenario: Link presente no layout admin

- **WHEN** um admin abre a navegação admin
- **THEN** há um link para a fila de relatos de correção (ex.: `/admin/campaign-reports`)
- **AND** a página exige `requireAdmin` (não-admin → acesso negado/redirect)
