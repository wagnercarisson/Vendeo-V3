## MODIFIED Requirements

### Requirement: Generate visual signature via AI image generation (Abordagem B — main approach)

O sistema SHALL gerar imagens de assinatura visual usando Abordagem B (IA gera imagem diretamente): prompt com dados da loja, modelo de imagem (Responses API `image_generation` tool) gera PNG, e a imagem resultante é validada antes de persistir.

> **Delta F38.1 (D1/D7/D11):** A rota `generate-without-logo` passa a usar `tracker.startRun("visual_signature")` no início do request. Cada request de geração é **um run** (uma geração debitável). **Falha técnica/erro grotesco de sistema → estorno e a nova tentativa é OUTRO run** (novo debit) — NÃO usa a semântica "até aprovação" da campanha. `visual_signature_id`, custo e tokens passam a ser preenchidos nos eventos (furo 5 sanado). `trace_id` passa a ser gerado/propagado na VS.

#### Scenario: Generate 3 variations for user choice (Criar Agora) — MUST produce 3 cards

- **WHEN** o lojista clica "Gerar 3 opções para eu escolher" no modal
- **THEN** o sistema SHALL tentar produzir exatamente 3 variações de assinatura visual
- **AND** o sistema SHALL tentar geração de imagem IA para todas as 3 com tonalidades diferentes (profissional, moderno, elegante)
- **AND** para cada posição que falha na primeira tentativa (não-timeout), o sistema SHALL tentar novamente com prompt simplificado
- **AND** se uma posição der timeout, o sistema SHALL NÃO tentar novamente essa posição
- **AND** se menos de 3 variações tiverem sucesso, o sistema SHALL retornar erro: "Não foi possível gerar 3 opções. Tente novamente."
- **AND** o fallback tipográfico NÃO é usado para preencher lacunas (contingência técnica apenas)

### Requirement: Generate 1 variation for automatic mode (Deixar o Vendeo Criar)

O sistema SHALL gerar 1 assinatura visual via IA em modo automático com timeout de 120s, persistindo como `active` com tipo `automatic_generated`; falha de validação → retry com prompt simplificado; timeout → NÃO retry, retorno de erro controlado.

> **Delta F38.1 (D1):** Semântica de run da VS aplicada — nova tentativa após falha técnica = novo `operation_run_id`. Cada geração debitável é um run separado.

#### Scenario: Nova tentativa pós-falha técnica = novo operation_run_id

- **WHEN** a geração da VS falha por erro técnico e o usuário tenta novamente
- **THEN** a nova tentativa usa um **novo** `operation_run_id` (novo debit — D1)
- **AND** cada request de geração é um run separado (uma geração debitável)

### Requirement: Metadata includes generation_tier

Cada registro `store_visual_signatures` persistido SHALL incluir `generation_tier` no metadata JSONB para rastrear o método que produziu o asset.

> **Delta F38.1 (D2/D7):** Os eventos `visual_signature_image`/`visual_signature_validation` passam a ser gravados com `visual_signature_id` preenchido (vínculo com `store_visual_signatures.id`) e com custo/tokens (furo 5 sanado).

#### Scenario: visual_signature_id preenchido nos eventos

- **WHEN** eventos `visual_signature_image`/`visual_signature_validation` são gravados
- **THEN** `visual_signature_id` aponta para o registro da assinatura visual (D2)

### Requirement: Visual signature quality criteria

A assinatura visual gerada por IA SHALL parecer uma marca simples e publicável; se falhar na validação visual, NÃO é persistida e o sistema tenta retry ou fallback tipográfico.

> **Delta F38.1 (D5/D11):** A validação semântica da VS (vision, Responses API) gera o evento `visual_signature_validation` com custo/tokens (furo 5 sanado). Typographic fallback (sem IA) NÃO gera evento call-level — não inventar chamada.

#### Scenario: visual_signature_image e visual_signature_validation registrados

- **WHEN** a VS é gerada via IA (imagem + validação semântica)
- **THEN** eventos `visual_signature_image` e `visual_signature_validation` são gravados com custo e tokens (furo 5 sanado)

#### Scenario: VS delivery com custo/tokens NULL

- **WHEN** o delivery `visual_signature` é gravado
- **THEN** `estimated_cost_usd`/`provider_reported_cost_usd` e tokens são NULL
- **AND** o custo da VS = soma de `visual_signature_image` + `visual_signature_validation` (anti-dupla-contagem D1/D6)

#### Scenario: Typographic fallback sem evento call-level

- **WHEN** a VS cai em fallback tipográfico (zero IA)
- **THEN** NENHUM evento call-level é gravado (não inventar chamada — D5)

### Requirement: generate-without-logo resolve custo dinâmico

A rota `POST /api/store/[id]/visual-signature/generate-without-logo` SHALL resolver o custo de `visual_signature_generation` dinamicamente uma única vez por request (após auth/ownership/readiness/rate guards, antes do saldo/reserva/IA paga) e usar `cost.costCredits` no balance check e na reserva.

> **Delta F38.1 (D11):** A rota `generate-without-logo` passa a instrumentar os eventos via `AiCostTracker` (via delegação do helper `insertGenerationEvent` ou tracker direto), preenchendo `visual_signature_id`, custo e tokens. `insertGenerationEvent` delega ao tracker mantendo sua API externa (compat de testes).

#### Scenario: generate-without-logo usa custo resolvido no balance check

- **WHEN** a rota `generate-without-logo` valida saldo
- **THEN** compara `balance < cost.costCredits` (substitui o literal `1`)

#### Scenario: insertGenerationEvent VS delega ao tracker

- **WHEN** a rota grava o evento de VS
- **THEN** `insertGenerationEvent` delega ao `AiCostTracker` (retorno compatível com approved/rejected p/ F37 — D11)
- **AND** os eventos contêm custo, tokens e `visual_signature_id` (furo 5 sanado)
