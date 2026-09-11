# Campaign Problem Report

> Synced from `fase-37-2-correcao-unica-por-nao-conformidade` (ADDED).

## Purpose

Fluxo de **relato de problema** da arte candidata (F37.2 realinhada — D37.2-R1/R2/R3). No estado `pending` (flag `campaign_approval_enabled` ligada, candidata v1 ativa), a tela de revisão oferece **[Informar problema]** que abre um **modal de uma etapa** (`campaign-problem-modal.tsx`) com preview da candidata, orientação do que é corrigível (defeito objetivo — §4) e campo de texto **obrigatório**. O envio válido chama **`POST /api/campaign/[id]/problem-report`**: a rota cria o caso + primeira tentativa (`begin_campaign_correction_submission`, antes da IA), roda a análise textual e responde com orientação (`unclear`/`blocked`) ou com um **NDJSON stream** quando elegível (geração da v2 com `input_validation` `skipped`). Texto vazio/pontuação → 400 **sem caso e sem IA**. Cancelar/X/ESC/backdrop fecham sem efeito. A v2, quando gerada, vira a candidata (sem galeria, sem voltar à v1, sem v3). **Se o processo morrer durante o NDJSON pós-consumo, a recuperação é preguiçosa** (RPC `recover_campaign_correction_generation` ao carregar/aprovar — ver `campaign-correction-reports`); o cliente, ao reabrir a campanha em `regenerating` após o teto, vê a v1 liberada para aprovar.

## Requirements

### Requirement: Botão [Informar problema] e modal de uma etapa

O sistema SHALL exibir, na tela de revisão da candidata (estado `pending`, v1), o botão secundário **[Informar problema]** ao lado do primário **[Aprovar arte]** (R1):

- **[Informar problema]** abre o modal **sem sair da página**; **[Aprovar arte]** dispara `POST /api/campaign/[id]/approve` (fluxo R8).
- **Modal** (uma etapa): preview da candidata ativa (fonte oficial: `asset_status='active'` em `campaign_art_versions`), orientação curta do que é corrigível (defeito objetivo: cortado, ilegível, dado divergente do brief, inventado, duplicado, deformado, composição impeditiva) e do que NÃO é (preferência estética, mudança de dados, rebriefing), label "Descreva o problema na arte" + campo textarea **obrigatório**, botões **[Enviar para análise]** e **[Cancelar]**.
- **[Cancelar]**, X, ESC e clique no backdrop fecham o modal **sem efeito** (não aprova, não envia, não cria caso).
- Texto validado **no clique**: vazio ou somente pontuação → erro amigável pedindo descrição; **não cria caso e não chama IA** (R2).

#### Scenario: Revisão pendente oferece os dois botões

- **WHEN** uma campanha está `pending` (v1, flag on)
- **THEN** a revisão exibe **[Aprovar arte]** (primário) e **[Informar problema]** (secundário)

#### Scenario: Informar problema abre o modal sem sair da página

- **WHEN** o lojista clica em [Informar problema]
- **THEN** o modal abre com preview da candidata ativa, orientação de corrigibilidade e campo obrigatório

#### Scenario: Cancelar/X/ESC/backdrop fecham sem efeito

- **WHEN** o lojista cancela (botão, X, ESC ou backdrop)
- **THEN** o modal fecha **sem** aprovar, **sem** enviar e **sem** criar caso

#### Scenario: Texto vazio/pontuação não cria caso e não chama IA

- **WHEN** o lojista envia texto vazio ou somente pontuação
- **THEN** exibe erro amigável pedindo descrição
- **AND** nenhum caso é criado e nenhuma IA é chamada (não conta na janela)

### Requirement: Rota POST /api/campaign/[id]/problem-report

O sistema SHALL prover a rota `POST /api/campaign/[id]/problem-report` (NOVA — fluxo corretivo), com guards e contrato:

- Guards: `requireSameOrigin` (CSRF) → `requireApiUser` → UUID v4 → `getCampaign` (404) → `requireOwnership` (404) → `isCampaignApprovalEnabled()` (flag off → 403) → `campaign.status === 'ready'` (senão 409) → **caso sem consumo** (relato inexistente ou `open`; se `generation_started`/`v2_generated`/`failed_no_v2` → 409) → **rate limit R3.1** (≤ 3 tentativas/30min; após a 3ª, a 4ª é bloqueada mesmo que a anterior tenha terminado em `analysis_failed`).
- Body `{ text: string }` (zod strict): texto vazio ou somente pontuação → **400** (sem caso, sem IA).
- Validação local ok → `rpc("begin_campaign_correction_submission", { campaignId, text })` (cria caso + tentativa `analyzing` na MESMA transação; retorna `submission_id`/`report_id`).
- Análise textual via `CorrectionIntentService` (R2) — **a conclusão é persistida pela RPC `complete_campaign_correction_analysis` condicionada a `analysis_state='analyzing'`** (resposta atrasada não sobrescreve; `409` se já finalizada):
  - `eligible` → inicia a **geração corretiva (v2)** respondendo como **NDJSON stream**: `input_validation` `skipped` → `image_generation` → `done/error`.
  - `blocked`/`unclear` → `200` JSON `{ analysisState, guidance }` (tentativa finalizada; **sem gerar/consumir**); o lojista pode reformular (janela aberta) ou voltar e aprovar.
  - timeout/transporte/vazio → `analysis_failed` (registrada; pode reformular enquanto houver tentativas).
- **Consumo:** `rpc("consume_campaign_correction_opportunity", { campaign_id, report_id, submission_id })` disparada pelo hook `onBeforeImageProviderCall` **imediatamente antes da 1ª chamada ao provider** (R3/R4).
- **Sem reserva de crédito**; eventos (análise + v2) sob `campaign.operation_run_id`.
- **Falha pós-provider** → `rpc("fail_campaign_correction_v2", ...)` atômica (mantém `rejection_count=1`, libera a candidata, `failed_no_v2`; v1 aprovável) + remoção **best-effort** de asset órfão se o upload já tiver ocorrido.
- Sucesso da v2 → RPC `complete_campaign_correction_v2` (persistência + demover v1) → `router.refresh()` na página (v2 vira candidata).
- **Erros legíveis (fix 01a7021b):** as respostas de erro do fluxo (400/403/409/500) usam **`{ code, message }`** — o `code` técnico fica no cliente e a `message` em PT-BR é o que o modal apresenta (nunca exibir `rate_limit_exceeded` etc.). Mapeamentos mínimos: `rate_limit_exceeded` → "Você atingiu o limite de análises deste relato. Aguarde alguns minutos para tentar novamente."; `analysis_in_progress` → "Seu relato anterior ainda está sendo analisado."; `already_consumed` → "A correção incluída nesta campanha já foi utilizada."; `campaign_not_pending`/`no_active_candidate` → "Esta arte não está mais disponível para correção. Atualize a página."; `correction_in_progress` → "A correção da arte já está em andamento."; `submission_not_analyzing`/`analysis_lease_expired`/`submission_stale` → mensagens PT-BR equivalentes; desconhecido → mensagem genérica amigável + detalhe apenas no log do servidor.
- **Análise fora do contrato (fix 01a7021b):** JSON inválido/fora do schema → `analysis_failed` com telemetria (`json_parse_failed`/`schema_validation_failed`), **não** `unclear`.

#### Scenario: Erro 409 é apresentado de forma legível

- **WHEN** a rota responde 409 (ex.: `rate_limit_exceeded`, `analysis_in_progress`, `already_consumed`)
- **THEN** o corpo é `{ code: "<codigo>", message: "<mensagem PT-BR>" }`
- **AND** o modal exibe a `message`, nunca o código técnico
- **AND** para erro desconhecido, exibe uma mensagem genérica amigável (o detalhe fica no servidor)

#### Scenario: Relato válido cria caso e primeira tentativa antes da IA

- **WHEN** o lojista envia um relato textual válido
- **THEN** a rota chama `begin_campaign_correction_submission` (caso + tentativa `analyzing` nascidos juntos)
- **AND** a análise textual roda sobre o texto (nenhuma imagem é lida)

#### Scenario: Elegível inicia NDJSON stream de geração da v2

- **WHEN** a análise classifica o relato como `eligible`
- **THEN** a resposta é um NDJSON stream com `input_validation` (`skipped`) → `image_generation` → `done`/`error`
- **AND** o consumo da oportunidade ocorre via hook imediatamente antes da 1ª chamada ao provider

#### Scenario: Falha pós-provider encerra o stream com failed_no_v2

- **WHEN** a geração da v2 falha depois do início do provider
- **THEN** o stream emite `error` e a RPC `fail_campaign_correction_v2` roda (mantém `rejection_count=1`, libera a candidata, `failed_no_v2`; v1 aprovável)
- **AND** um asset órfão de upload, se existir, é removido best-effort

#### Scenario: Análise simultânea (tentativa analyzing válida) é recusada

- **WHEN** já existe uma tentativa `analyzing` não expirada no relato e o lojista envia novo relato
- **THEN** a rota responde 409 (`analysis_in_progress`) e nenhuma IA é chamada

#### Scenario: Resposta atrasada da análise não sobrescreve a tentativa

- **WHEN** a conclusão da análise chega para uma tentativa que já saiu de `analyzing` (expirada/finalizada por um begin posterior)
- **THEN** a RPC de conclusão responde 409 (`submission_not_analyzing`) e nada é sobrescrito

#### Scenario: Bloqueado/não-claro respondem 200 com orientação sem gerar

- **WHEN** a análise classifica o relato como `blocked` ou `unclear`
- **THEN** a rota responde `200 { analysisState, guidance }`
- **AND** nada é gerado nem consumido
- **AND** o lojista pode reformular (janela aberta) ou voltar e aprovar

#### Scenario: Flag desligada bloqueia o relato

- **WHEN** a flag `campaign_approval_enabled` está desligada
- **THEN** a rota responde 403

#### Scenario: Campanha não ready recusa o relato

- **WHEN** a campanha está `generating`/`error`
- **THEN** a rota responde 409 (sem candidata para relatar)

#### Scenario: Relato após consumo é recusado

- **WHEN** o caso já está `generation_started`/`v2_generated`/`failed_no_v2`
- **THEN** a rota responde 409 (oportunidade consumida) independentemente da janela

#### Scenario: Quarta tentativa na janela é bloqueada

- **WHEN** já houve 3 tentativas em 30 minutos (a última inclusive `analysis_failed`)
- **THEN** a rota responde 409 `rate_limit_exceeded` (limite absoluto prevalece sobre reformulação imediata)

### Requirement: A geração da v2 não expõe a v1 e não retorna à v1

O sistema SHALL garantir que o fluxo corretivo **não** use a v1 como referência visual nem permita voltar à v1:

- `candidateArtDataUrl` **não** é passado ao diretor nem ao provider (R4).
- A v2 usa o mesmo snapshot `campaign_brief_v1`, imagens F41 e identidade vigente; **não** re-monta nem edita o briefing.
- Após a v2 persistida, a UI/API **nunca** oferece a v1 (candidata única); sem galeria; sem v3.
- A v1 permanece preservada (`superseded`) para suporte/auditoria, acessível apenas por signed URLs server-side.

#### Scenario: Fluxo corretivo sem referência da v1

- **WHEN** a geração da v2 roda
- **THEN** nenhum `candidateArtDataUrl` da v1 é enviado ao diretor/provider
- **AND** apenas briefing + imagens do produto + identidade + bloco de não conformidade compõem o prompt

#### Scenario: Sem galeria e sem retorno à v1

- **WHEN** a v2 é persistida e vira candidata
- **THEN** a página exibe apenas a v2 (botão [Aprovar arte] aprova a v2)
- **AND** a UX/API não oferece a v1 nem uma nova correção
