# Legal Document Versions

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D13). Publicação das **três** versões legais (Termos v1.5, Privacidade v1.4, Uso Aceitável v1.2) em migration separada.

## MODIFIED Requirements

### Requirement: getCurrentVersion()

O sistema SHALL resolver, após a publicação em **migration separada** (somente após a validação jurídica formal), `terms_of_service` para **v1.5**, `privacy_policy` para **v1.4** e `acceptable_use` para **v1.2**, com `effective_at` coordenado com o corte. O reaceite SHALL ser acionado via `requireLegalClearance` (status `outdated` → gate 403), sem bloquear histórico/campanhas/downloads.

#### Scenario: Três versões publicadas em migration separada

- **WHEN** a migration de publicação executa `terms_of_service v1.5`, `privacy_policy v1.4` e `acceptable_use v1.2`
- **THEN** `getCurrentVersion(...)` retorna as novas versões quando `effective_at <= now()`
- **AND** a migration estrutural NÃO publica versões legais

#### Scenario: Reaceite forçado

- **WHEN** um usuário aceitou a versão anterior e as novas vigem
- **THEN** `getAcceptanceStatus` retorna `outdated` e a geração é gated até o reaceite
