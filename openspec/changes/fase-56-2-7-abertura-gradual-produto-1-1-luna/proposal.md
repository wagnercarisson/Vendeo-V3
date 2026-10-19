## Why

A fase 56.2.6 encerrou o Produto 1:1 apenas no escopo N=1. Hoje `all_stores` continua recusado na RPC, na rota admin e no gate de gasto; Luna existe no catálogo, mas não está selecionado nem precificado em produção para `campaign_copy`, `brand_profile_text` e `brand_profile_vision`; e os itens 5.3/5.7 seguem obrigatórios antes de qualquer abertura geral. O objetivo é concluir a adoção de Luna e permitir a abertura gradual — lojas de teste e depois todas as lojas — por uma única ação administrativa auditada, sem SQL manual, sem executor e sem novo deploy a cada mudança de estado.

## What Changes

- Definir três estados operacionais usando as chaves existentes: **OFF** (legado), **lojas de teste** (`product_1_1_test_stores_enabled=true`) e **todas as lojas** (`product_1_1_all_stores_enabled=true`).
- Ampliar minimamente a autorização para aceitar `all_stores` + `all_stores` no ambiente operacional, preservando instância, escopo exato, auditoria, revogação, idempotência e a regra de que a autorização não habilita sozinha.
- Alinhar o gate de gasto para armar com `test_stores` e `all_stores`, mantendo o teto, os limites de chamadas e a recusa fail-closed em incerteza.
- Criar uma **ação normal no admin** que executa, em uma única RPC transacional, auditada e idempotente, a concessão/revogação da autorização e a alteração das chaves existentes. O checkpoint humano registra a autorização operacional; a confirmação administrativa autenticada é o comando de ativação. A UI não exigirá operações manuais adicionais nem acesso SQL e não prometerá bloqueio automático por evidência documental.
- Desligar o novo fluxo apenas pelas chaves + revogação; **não** usar `VENDEO_GENERATION_PAUSED`. Campanhas persistidas e operações em andamento não são canceladas.
- Confirmar e documentar a configuração de Luna em produção: catálogo, protocolo, pricing, seleção e fallbacks. **Não** haverá código novo para Luna se catálogo/protocolo/pricing já estiverem corretos; as seleções são configuração administrativa e **afetam também o legado**, por serem compartilhadas por capacidade.
- Concluir, no destino hospedado e em operações de teste identificadas, as provas **5.3** (ausência comprovada + PF → estorno único) e **5.7** (replay idempotente de `deliver` após redeploy, sem regenerar arte).
- Registrar disposição explícita para D13/kill real na abertura geral: aceitar a limitação residual com controles compensatórios ou bloquear. O caminho feliz do N=1 não resolve D13.
- Estabelecer apenas três checkpoints humanos: publicação, janela paga e abertura geral. O orçamento da janela e o teto da abertura geral são aprovados antes de qualquer chamada paga.

## Capabilities

### New Capabilities

- `product-1-1-gradual-opening`: contrato da abertura gradual — provas hospedadas 5.3/5.7, validação de Luna nas três capacidades, disposição D13/kill real, orçamento, monitoramento, desligamento e consolidação documental.

### Modified Capabilities

- `product-1-1-flow-activation`: três estados operacionais, ativação de `all_stores`, ação administrativa coordenada e desligamento sem pausar o legado.
- `product-1-1-controlled-real-test-authorization`: autorização `all_stores` deixa de ser sempre recusada e passa a ser aceita apenas para a abertura geral aprovada, preservando os controles existentes.
- `product-1-1-hosted-pilot`: o piloto N=1 encerrado permanece preservado; 5.3/5.7 deixam de ser apenas adiados e passam a ser pré-requisitos obrigatórios da abertura geral, junto com a validação de Luna.

## Impact

- **Código/migration:** nova migration sucessora da RPC de concessão; `src/app/api/admin/product-flow-authorizations/route.ts`; `src/lib/product-1-1/pilot/resolve-pilot-spend-gate.ts`; nova rota de ativação administrativa e painel na página existente de Controles operacionais; testes de contrato/rota/gate/ativação; runbook e documentação operacional.
- **Banco:** `feature_flags`, `product_flow_stage_authorizations`, `admin_audit_log`, `ai_model_catalog`, `ai_model_pricing`, `ai_model_selection`, `product_1_1_pilot_spend_state` e ledger de operações do novo fluxo. Nenhuma mudança de schema além da RPC.
- **Configuração (sem deploy):** pricing de `openai/gpt-6-luna`, seleções de `campaign_copy`, `brand_profile_text` e `brand_profile_vision`, teto/orçamento. Par de imagem do novo fluxo permanece o já configurado.
- **Fora de escopo:** geração de assinatura visual, `campaign_spec`, `campaign_correction_analysis`, mudança do fluxo legado, remoção de salvaguardas, nova infraestrutura de ativação, novas fases/quicks e qualquer deploy/ativação/chamada paga nesta etapa.
- **Risco principal:** as seleções de modelo são globais por capacidade; ativar Luna para as três capacidades altera também o legado durante a janela. O rollback é a restauração da seleção anterior, não um deploy.
