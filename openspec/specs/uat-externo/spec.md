# UAT Externo

> Synced from `fase-29-refinamento-visual-uat-launch-readiness` (ADDED).

## Purpose

Execução de UAT externo com lojistas reais, registro de evidências, correção de problemas bloqueantes e decisão final de go/no-go para lançamento controlado.

## Requirements

### Requirement: 8 cenários mínimos de UAT

O sistema SHALL ser testado com 8 cenários mínimos cobrindo onboarding, créditos, geração, estorno, saldo, extrato, admin de erros e audit log.

#### Scenario: Cadastro/onboarding completo

- **WHEN** um lojista convidado completa o cadastro
- **THEN** a loja é criada e 5 créditos são concedidos (saldo = 5)
- **AND** o extrato mostra transação `grant` de 5 créditos

#### Scenario: Admin concede créditos com atualização de saldo

- **WHEN** um admin concede créditos a um lojista via admin
- **THEN** o saldo do lojista reflete o grant
- **AND** o extrato mostra a transação

#### Scenario: Geração bem-sucedida deduz crédito

- **WHEN** um lojista gera uma campanha com sucesso
- **THEN** o saldo decrementa em 1
- **AND** o extrato mostra transação `deduction`

#### Scenario: Geração com erro estorna crédito

- **WHEN** uma geração falha
- **THEN** o saldo é restaurado ao valor anterior
- **AND** o extrato mostra transação `refund`

#### Scenario: Saldo consistente em 3 locais

- **WHEN** um lojista verifica seu saldo
- **THEN** o saldo exibido na topbar, dashboard e /conta é o mesmo

#### Scenario: Extrato com transações corretas

- **WHEN** um lojista acessa o extrato em /conta
- **THEN** tipos, valores, datas e saldo before/after estão corretos

#### Scenario: Admin visualiza erro de campanha

- **WHEN** um admin acessa /admin/campaigns/errors
- **THEN** consegue visualizar campanhas com erro e identificar a causa

#### Scenario: Admin visualiza audit log

- **WHEN** um admin acessa /admin/audit-log
- **THEN** consegue visualizar o histórico completo de ações e reconciliar eventos

### Requirement: Evidências registradas por sessão

Cada sessão de UAT SHALL ter evidências registradas em `docs/launch-readiness/uat-results/` com data, usuário, cenário, resultado, bugs encontrados, severidade e decisão.

#### Scenario: Sessão registrada com campos obrigatórios

- **WHEN** uma sessão de UAT é concluída
- **THEN** as evidências incluem: data, identificação do usuário/loja, cenário executado, resultado (sucesso/falha/parcial), bugs encontrados com severidade, e decisão sobre cada bug

### Requirement: Correção de bugs bloqueantes

Bugs bloqueantes encontrados no UAT SHALL ser corrigidos ou formalmente aceitos pelo time antes do go/no-go.

#### Scenario: Bug bloqueante corrigido ou aceito

- **WHEN** um bug bloqueante é identificado no UAT
- **THEN** ele é corrigido e o cenário afetado é reexecutado
- **OR** o time documenta a aceitação formal do risco

### Requirement: Decisão final registrada

O time SHALL realizar reunião de revisão final e registrar decisão explícita.

#### Scenario: Revisão final com decisão registrada

- **WHEN** o UAT é concluído e os bloqueantes são tratados
- **THEN** o time realiza reunião de revisão analisando métricas, feedback qualitativo, bugs pendentes e riscos aceitos
- **AND** registra decisão explícita: expandir / pausar / manter controlado
