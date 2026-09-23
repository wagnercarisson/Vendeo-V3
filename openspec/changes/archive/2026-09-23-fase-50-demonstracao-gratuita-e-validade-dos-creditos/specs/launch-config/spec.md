# Launch Config

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D9/D10/D15/D17). Novas flags de demonstração e email; `monthlyCreditsEnabled` **preservado `true` até o corte**; `publicSignupEnabled` permanece `false` durante o beta.

## F50 Closed-Beta Decision

Until the post-PJ quick is explicitly authorized, the operational posture remains
fail-closed: `VENDEO_DEMO_CREDITS_ENABLED=false`, `VENDEO_EMAIL_ENABLED` absent
or `false`, and `VENDEO_PUBLIC_SIGNUP_ENABLED=false`. The beta admits no new
users and no checkout, charge, or monetization is active. The cutover scenarios
below are deferred; this delta does not authorize changing flags.

## MODIFIED Requirements

### Requirement: LaunchConfig type (flags existentes + demonstração + email)

O sistema SHALL estender `LaunchConfig` com `demoCreditsEnabled: boolean`, `demoCreditsAmount: number`, `demoCreditsTtlHours: number`, `emailEnabled: boolean`. O default de `monthlyCreditsEnabled` **permanece `true` até o corte** (D9/D15): o deploy não desliga o mensal antes da demo estar ativa.

#### Scenario: Tipo inclui flags de demonstração e email

- **WHEN** `LaunchConfig` é importado
- **THEN** inclui `demoCreditsEnabled`, `demoCreditsAmount`, `demoCreditsTtlHours`, `emailEnabled`

### Requirement: getLaunchConfig() com defaults seguros expandido

O sistema SHALL prover defaults: `demoCreditsEnabled` default `false` (fail-closed), `demoCreditsAmount` default `10`, `demoCreditsTtlHours` default `168`, `emailEnabled` default `false`, e `monthlyCreditsEnabled` **default `true` (preservado até o corte)**.

#### Scenario: Defaults seguros

- **WHEN** `getLaunchConfig()` é chamado sem env vars
- **THEN** `demoCreditsEnabled=false`, `demoCreditsAmount=10`, `demoCreditsTtlHours=168`, `emailEnabled=false`, `monthlyCreditsEnabled=true`

#### Scenario: Ativação explícita da demo

- **WHEN** `VENDEO_DEMO_CREDITS_ENABLED=true`
- **THEN** `demoCreditsEnabled` é `true`

#### Scenario: Corte desliga o mensal explicitamente

- **WHEN** `VENDEO_MONTHLY_CREDITS_ENABLED=false` no corte
- **THEN** `monthlyCreditsEnabled` é `false` (desligado junto com a vigência da v1.5)
