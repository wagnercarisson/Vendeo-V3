## ADDED Requirements

### Requirement: Re-aceite de Termos de Uso v1.2

O sistema SHALL tratar `terms_of_service` versão `"v1.2"` como documento que exige reaceite contratual. O fluxo de reaceite da F30 é reutilizado:

1. Migration publica v1.2 em `legal_document_versions`
2. Lojistas sem aceite da v1.2 veem badge "Termos de Uso atualizados" no dashboard
3. Pipeline guard exige reaceite antes de gerar campanha
4. Reaceite registra `legal_acceptances` com versão `"v1.2"`
5. Lojas sem reaceite após 30 dias: geração bloqueada (padrão F30)

#### Scenario: Re-aceite v1.2 registra acceptance

- **WHEN** lojista aceita a versão v1.2
- **THEN** `legal_acceptances` recebe `document_type = 'terms_of_service'`, `document_version = 'v1.2'`

#### Scenario: Loja sem v1.2 não gera campanha

- **WHEN** loja tenta gerar campanha
- **AND** não aceitou `terms_of_service` v1.2
- **THEN** `requireLegalClearance` retorna 403

### Requirement: getAcceptanceStatus reconhece v1.2

O sistema SHALL reconhecer `"v1.2"` como versão vigente de `terms_of_service` via `getCurrentVersion()`.

#### Scenario: Versão v1.2 é vigente

- **WHEN** `getCurrentVersion("terms_of_service")` é chamado
- **THEN** retorna `"v1.2"`