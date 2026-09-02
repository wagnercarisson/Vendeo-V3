# Feature Flag Control

## Purpose

Esta fatia adiciona a flag **`campaign_approval_enabled`** à infraestrutura de `feature_flags` existente (F43/QCW): nova `key` (default `false`, **fail-closed**), inclusão em `ALL_FEATURE_FLAG_KEYS` (tela admin "Controles operacionais" passa a exibi-la sem novo RPC/CHECK), método `isCampaignApprovalEnabled()` no `FeatureFlagService`. **Sem env/launch-config** para o flag principal (decisão 1). A estratégia de correção (text_only × text_plus_reference) **não** entra nesta fatia (37.2).

## ADDED Requirements

### Requirement: Flag campaign_approval_enabled

O sistema SHALL adicionar a flag **`campaign_approval_enabled`** à infraestrutura `feature_flags` (F37 D1, padrão F43/QCW):

- Constante `CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled"` em `feature-flag-service.ts`.
- Inclusão em `ALL_FEATURE_FLAG_KEYS` — a tela admin "Controles operacionais" (`admin/feature-flags`) e o `GET /api/admin/feature-flags` passam a listá-la automaticamente.
- Método `isCampaignApprovalEnabled(): Promise<boolean>` → `readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false)` — **fail-closed**: falha de leitura/not-found → `false` (comportamento atual, entrega livre); **sem `envOverride`** para esta flag (a decisão principal é a tabela, não env var).
- Seed na migration da fatia: `campaign_approval_enabled = false` (padrão recomendado — Desligada), descrição administrativa clara; `ON CONFLICT (key) DO NOTHING`.
- **Sem novo RPC e sem novo CHECK:** `admin_update_feature_flag` é genérico por `key` e os CHECKs `feature_flag_update`/`feature_flag` já existem (F43) — a mutação com motivo obrigatório + auditoria funciona para a nova flag sem mudança.

#### Scenario: Flag seed desligada

- **WHEN** a migration da fatia 37.1 é aplicada
- **THEN** existe uma linha `campaign_approval_enabled` com `enabled = false` (padrão recomendado) e a descrição administrativa

#### Scenario: Leitura fail-closed (flag desligada / falha)

- **WHEN** a flag `campaign_approval_enabled` está desligada (ou a leitura falha) durante um fluxo de campanha
- **THEN** `isCampaignApprovalEnabled()` retorna `false`
- **AND** o comportamento atual é preservado (entrega imediata, download livre, copy visível) — a flag nunca derruba o fluxo

#### Scenario: Flag ligada habilita o fluxo de aprovação

- **WHEN** a flag `campaign_approval_enabled` está `enabled = true` na tabela
- **THEN** `isCampaignApprovalEnabled()` retorna `true`
- **AND** campanhas novas entram no fluxo de revisão/aprovação

#### Scenario: Tela Controles operacionais exibe a nova flag

- **WHEN** um admin abre "Controles operacionais"
- **THEN** a flag `campaign_approval_enabled` é exibida com descrição e estado atual
- **AND** a alteração com **motivo obrigatório** é persistida e auditada (`feature_flag_update`) — sem nova action/target_type
