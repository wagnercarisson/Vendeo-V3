> Synced from `fase-32-freemium-anti-abuso-cnpj` (ADDED).

## Purpose

Termos de Uso v1.2 (CNPJ obrigatório, freemium por raiz, sanções, compra permitida) + Política de Privacidade v1.1 (finalidades do CNPJ) + reaceite contratual obrigatório.

## Requirements

### Requirement: Termos de Uso v1.2 — CNPJ obrigatório, freemium por raiz, sanções

O sistema SHALL publicar `public/docs/legal/terms-of-service-v1-2.md` com novas cláusulas:

- **Cadastro (2.4+):** CNPJ obrigatório, verdadeiro, atual e de titularidade
- **Freemium (seção nova):** Benefícios gratuitos limitados a uma concessão por raiz de CNPJ
- **Sanções (seção nova):** Negar/reverter/suspender benefícios em caso de CNPJ de terceiro, multiplicação fraudulenta, dados falsos
- **Compra de créditos (seção nova):** Permitida independentemente de benefícios gratuitos

#### Scenario: Documento v1.2 existe e está publicado

- **WHEN** a migration é executada
- **THEN** `terms-of-service-v1-2.md` existe em `public/docs/legal/`
- **AND** `legal_document_versions` contém `terms_of_service` versão `"v1.2"`

### Requirement: Política de Privacidade v1.1 — finalidades do CNPJ

O sistema SHALL publicar `public/docs/legal/privacy-policy-v1-1.md` com finalidades documentadas do CNPJ: identificar loja, habilitar freemium, prevenir abuso, processar cobranças/NF, cumprir obrigações legais, suporte/auditoria/segurança.

Base legal: Contrato (execução de termos) + legítimo interesse (antifraude).

#### Scenario: Documento v1.1 existe e está publicado

- **WHEN** a migration é executada
- **THEN** `privacy-policy-v1-1.md` existe em `public/docs/legal/`
- **AND** `legal_document_versions` contém `privacy_policy` versão `"v1.1"`

### Requirement: document-content.ts atualizado

O sistema SHALL atualizar `document-content.ts` com:
- `privacy_policy` → `"v1.1"`
- `terms_of_service` → `"v1.2"`

#### Scenario: Catálogo reflete novas versões

- **WHEN** `document-content.ts` é inspecionado
- **THEN** `privacy_policy` mapeia para `"v1.1"`
- **AND** `terms_of_service` mapeia para `"v1.2"`

### Requirement: Reaceite de Termos de Uso v1.2 (via F30)

A alteração contratual exige reaceite. O fluxo de reaceite da F30 é reutilizado: migration publica v1.2, badge no dashboard, pipeline guard exige reaceite antes de gerar campanha.

#### Scenario: Loja sem reaceite v1.2 é bloqueada na geração

- **WHEN** loja tenta gerar campanha
- **AND** não aceitou terms_of_service v1.2
- **THEN** o guard retorna 403 com mensagem de reaceite necessário

### Requirement: AUP v1.0 cobre novos cenários

A Política de Uso Aceitável v1.0 NÃO requer nova versão. As cláusulas 3.2 (burlar controle de créditos) e 3.5 (múltiplas contas para contornar limites) já capturam os novos cenários.

#### Scenario: AUP não tem nova versão

- **WHEN** `legal_document_versions` é consultado
- **THEN** `acceptable_use` permanece em `"v1.0"`
