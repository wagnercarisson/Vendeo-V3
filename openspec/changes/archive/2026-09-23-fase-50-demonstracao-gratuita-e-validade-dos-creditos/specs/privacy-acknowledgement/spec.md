# Privacy Acknowledgement

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D13). A Política de Privacidade v1.4 usa **ciência por usuário** via `privacy_acknowledgements`, distinta do reaceite contratual (Terms/AUP) via `legal_acceptances`.

## MODIFIED Requirements

### Requirement: Privacy acknowledgement per user

O sistema SHALL tratar a **ciência** da Política de Privacidade v1.4 por **usuário** (não por loja), via `privacy_acknowledgements` (`user_id`, `privacy_policy_version`, `acknowledged_at`, `ip_address`, `user_agent`) e `has_valid_privacy_acknowledgement`. Quando a versão vigente de `privacy_policy` sobe para v1.4, o `PrivacyGate` (montado em `(app)/layout.tsx`) SHALL solicitar nova ciência ao usuário. Terminologia: **"ciência"** (não "aceite"), salvo orientação jurídica diferente.

#### Scenario: Versão sobe → nova ciência solicitada

- **WHEN** a `privacy_policy` vigente passa a v1.4 e o usuário só registrou ciência da v1.3
- **THEN** `has_valid_privacy_acknowledgement` retorna falso
- **AND** o `PrivacyGate` exibe a ciência de privacidade v1.4

#### Scenario: Ciência registrada por usuário

- **WHEN** o usuário confirma a ciência da v1.4
- **THEN** `privacy_acknowledgements` é atualizada com `privacy_policy_version = v1.4` (upsert por `user_id`)

#### Scenario: Privacidade NÃO usa legal_acceptances

- **WHEN** a v1.4 vigora
- **THEN** nenhum registro de privacidade é gravado em `legal_acceptances` (a ciência de privacidade permanece em `privacy_acknowledgements`)

#### Scenario: Ciência de privacidade não bloqueia histórico/campanhas/downloads

- **WHEN** o usuário ainda não registrou a ciência da v1.4
- **THEN** o acesso a histórico, campanhas e downloads existentes não é bloqueado pelo gate de privacidade
