# Legal Acceptance Service

## ADDED Requirements

### Requirement: Re-aceite de Termos de Uso v1.4 (ADDED)

O sistema SHALL tratar `terms_of_service` versão `"v1.4"` como documento que exige reaceite contratual — D12.

- A v1.4 **remove** a limitação da cláusula 3.1 a "usuários convidados" e descreve:
  - acesso público gratuito com **elegibilidade** e critérios de liberação;
  - **autenticação por terceiros** (Google OAuth).
- Fluxo de reaceite da F30 reutilizado: migration publica v1.4 em `legal_document_versions` → lojistas sem aceite veem badge → pipeline guard exige reaceite → reaceite registra `legal_acceptances` com `document_version = 'v1.4'` (`acceptance_source = 'login_reacceptance'`).
- **Tolerância técnica (D12):** nenhuma loja antiga perde acesso/capacidade ao publicar a nova versão — o bloqueio só vale para funcionalidades protegidas pelo clearance legal (padrão F30/fail-closed), sem retroatividade destrutiva.
- `effective_at` futuro (configuração) habilita o reaceite **antes do go-live**.

#### Scenario: Re-aceite v1.4 registra acceptance

- **WHEN** lojista aceita a versão v1.4
- **THEN** `legal_acceptances` recebe `document_type = 'terms_of_service'`, `document_version = 'v1.4'`

#### Scenario: Loja sem v1.4 não gera campanha (clearance fail-closed)

- **WHEN** loja tenta gerar campanha
- **AND** não aceitou `terms_of_service` v1.4
- **THEN** `requireLegalClearance` retorna 403

#### Scenario: getAcceptanceStatus reconhece v1.4

- **WHEN** `getCurrentVersion("terms_of_service")` é chamado
- **THEN** retorna `"v1.4"`

#### Scenario: Loja antiga não perde acesso com a publicação da v1.4

- **WHEN** a v1.4 é publicada
- **AND** uma loja beta ativa ainda não reaceitou
- **THEN** a loja não perde acesso/capacidade automaticamente
- **AND** o reaceite é exigido apenas no próximo acesso (funcionalidades protegidas pelo clearance)

### Requirement: getAcceptanceStatus reconhece v1.4 (ADDED)

O sistema SHALL reconhecer `"v1.4"` como versão vigente de `terms_of_service` via `getCurrentVersion()` — D12.

#### Scenario: Versão v1.4 é vigente

- **WHEN** `getCurrentVersion("terms_of_service")` é chamado
- **THEN** retorna `"v1.4"`

### Requirement: Separar ciência de privacidade (user-level) de aceite contratual (store-level)

O sistema SHALL manter a separação existente dos dois momentos legais (inalterada na F42) — D12/D16:

- **Pós-auth (signup/OAuth → layout `(app)`):** ciência da **Política de Privacidade** + opt-in comercial opcional → `privacy_acknowledgements`/`consent_events` (user-level).
- **Onboarding/criação da loja (F36):** aceite dos **Termos de Uso + Uso Aceitável** → `legal_acceptances` com `acceptance_source = 'onboarding'` (store-level), vinculados ao draft da loja.

#### Scenario: Signup email/senha registra apenas ciência de privacidade

- **WHEN** um usuário cria conta pelo caminho email/senha
- **THEN** apenas a ciência de privacidade é registrada no pós-auth (user-level)
- **AND** os aceites de Termos/AUP continuam registrados na criação do draft da loja (store-level, F36)