# Onboarding Grant

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D3). A concessão de onboarding (freemium contínuo) é substituída pela demonstração gratuita com validade.

## MODIFIED Requirements

### Requirement: Onboarding grant condicionado à raiz do CNPJ (MODIFICADO F32)

O sistema SHALL substituir a concessão `bonus_onboarding` pela **demonstração** (`type='demo'`, TTL 168h) nos pontos de onboarding aprovado (`create_store_with_cnpj`, `admin_approve_store_verification` e — para lojas draft que informam CNPJ depois — `update_store_cnpj`). A irrepetibilidade por raiz passa a considerar ausência de `onboarding` **e** `demo` (e `admin_exception`). **`admin_exception_store_verification` permanece bônus `admin_grant` não-expirável** (não é convertido para demo).

> **Delta F50 (D3/D8):** a concessão deixa de ser bônus não-expirável e passa a ser demonstração (10 créditos, `demo_expires_at = now() + 168h`), gated por `p_demo_grant_enabled`. A resposta `onboardingGranted` continua refletindo se houve concessão. `update_store_cnpj` **concede a demo** quando a verificação resulta em `approved`, a flag está ativa e a raiz não tem benefício anterior.

#### Scenario: Store criada com raiz nova → 10 créditos de demonstração

- **WHEN** loja `approved` é criada com raiz sem `onboarding`/`demo` e flag ativa
- **THEN** concede demo (10, TTL 168h) e `onboardingGranted` é `true`

#### Scenario: Store criada com raiz já usada → sem demonstração

- **WHEN** loja é criada com raiz que já tem `onboarding` ou `demo`
- **THEN** nenhum crédito de demonstração é concedido
- **AND** `onboardingGranted` é `false`

#### Scenario: Loja draft que informa CNPJ depois recebe a demo se aprovada e elegível

- **WHEN** `update_store_cnpj` processa loja draft cuja verificação resulta em `approved`, flag ativa e raiz sem benefício anterior
- **THEN** concede a demonstração via `grant_demo_credits`
- **AND** a raiz NÃO é bloqueada definitivamente

#### Scenario: Marcador legado só com evidência de benefício anterior

- **WHEN** `update_store_cnpj` processa loja cuja raiz já possui transação `bonus_onboarding` ou entitlement `onboarding`
- **THEN** cria o marcador `legacy_pre_f32_onboarding_consumed` **sem** grant (bloqueia demo futura)
- **AND** nenhuma transação `demo` é criada
