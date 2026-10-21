## MODIFIED Requirements

### Requirement: RPC update_store_cnpj()

O sistema SHALL prover `update_store_cnpj(p_store_id, p_cnpj_normalized, p_cnpj_root_hash, p_razao_social?, p_nome_fantasia?)` que:

- Valida que a loja existe (`store_not_found`)
- Valida que CNPJ não foi sobrescrito (`cnpj_already_set`)
- Recebe `cnpj_root_hash` já calculado pela rota Next.js (nunca recebe do caller)
- Atualiza `stores.cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`
- Aceita `p_cnpj_normalized` numérico ou alfanumérico canônico de 14 caracteres, sem transformar o valor
- NÃO concede créditos, MAS insere entitlement `onboarding` sem grant para marcar a raiz como já consumida
- Retorna dados atualizados com CNPJ mascarado

**Entitlement para lojas legacy:** A RPC insere em `freemium_entitlements`:
- `benefit_type = 'onboarding'`
- `grant_transaction_id = NULL`
- `reason = 'legacy_pre_f32_onboarding_consumed'`
- Usa `ON CONFLICT DO NOTHING` — se a raiz já tiver entitlement, o INSERT é ignorado

#### Scenario: Atualização numérica bem-sucedida

- **WHEN** `update_store_cnpj` é chamado com `p_cnpj_normalized = "12345678000195"` e dados válidos
- **THEN** CNPJ é salvo na loja
- **AND** saldo permanece intacto
- **AND** entitlement `onboarding` com `grant_transaction_id = NULL` e `reason = 'legacy_pre_f32_onboarding_consumed'` é inserido (ou ignorado via ON CONFLICT se raiz já registrada)
- **AND** retorna dados com CNPJ mascarado

#### Scenario: Atualização alfanumérica bem-sucedida

- **WHEN** `update_store_cnpj` é chamado com `p_cnpj_normalized = "12ABC34501DE35"` e dados válidos
- **THEN** o valor exato `"12ABC34501DE35"` é salvo em `stores.cnpj_normalized`
- **AND** `cnpj_root_hash` corresponde ao hash da raiz `"12ABC345"`
- **AND** nenhum crédito é concedido
- **AND** retorna dados com CNPJ mascarado no formato `**.***.***/01DE-**`

#### Scenario: Mesma raiz em lojas legacy diferentes

- **WHEN** duas lojas legacy da mesma raiz atualizam CNPJ
- **THEN** a primeira inserção do entitlement `onboarding` vence (ON CONFLICT não bloqueia)
- **AND** a segunda é ignorada pelo ON CONFLICT DO NOTHING
- **AND** nenhuma das duas recebe créditos

#### Scenario: Raiz alfanumérica compartilhada por matriz e filial

- **WHEN** duas lojas informam CNPJs com a mesma raiz alfanumérica de 8 caracteres
- **THEN** ambas usam o mesmo `cnpj_root_hash`
- **AND** o bloqueio por raiz existente permanece aplicável
- **AND** nenhuma regra nova de matriz/filial é introduzida

#### Scenario: Tentativa de sobrescrever CNPJ existente

- **WHEN** `update_store_cnpj` é chamado para loja que já tem CNPJ
- **THEN** retorna erro `cnpj_already_set`

#### Scenario: Atomicidade preservada em falha

- **WHEN** a atualização falha antes da RPC (validação, duplicidade ou consulta indisponível)
- **THEN** `cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia` e status de verificação permanecem inalterados
- **AND** nenhum dado fiscal parcial é persistido

## ADDED Requirements

### Requirement: Formulário de atualização cadastral aceita CNPJ alfanumérico

O formulário de `/cadastro/cnpj` SHALL aceitar CNPJs numéricos e alfanuméricos, preservando letras durante digitação, colagem e edição. A validação local SHALL usar a mesma normalização e o mesmo algoritmo de DV da API. O formulário SHALL exibir mensagem de erro clara quando o formato ou os DVs forem inválidos, sem remover letras silenciosamente.

#### Scenario: Colagem de CNPJ alfanumérico é preservada

- **WHEN** o lojista cola `12.abc.345/01de-35` no campo CNPJ
- **THEN** o campo exibe `12.ABC.345/01DE-35`
- **AND** o envio usa `cnpjNormalized = "12ABC34501DE35"`

#### Scenario: CNPJ alfanumérico válido é salvo

- **WHEN** o lojista submete um CNPJ alfanumérico válido
- **THEN** o formulário chama a rota de atualização com o valor canônico
- **AND** o redirecionamento e as mensagens existentes são preservados

#### Scenario: CNPJ alfanumérico inválido não é enviado

- **WHEN** o lojista submete `12.ABC.345/01DE-34`
- **THEN** o formulário exibe erro de CNPJ inválido
- **AND** nenhuma chamada de atualização é feita

#### Scenario: Caractere desconhecido não é descartado pelo domínio

- **WHEN** a API de atualização recebe `cnpjNormalized` contendo emoji, acento ou símbolo
- **THEN** responde `400` com erro de CNPJ inválido
- **AND** nenhum dado fiscal é persistido

#### Scenario: Consulta ainda não suporta o formato

- **WHEN** o CNPJ alfanumérico é localmente válido
- **AND** todos os provedores rejeitam explicitamente o formato (`unsupported_format`)
- **THEN** o formulário exibe aviso de indisponibilidade temporária
- **AND** não persiste dados fiscais parciais
- **AND** mantém a política atual de bloqueio até a consulta ser possível

#### Scenario: Formato não suportado misturado com indisponibilidade

- **WHEN** um provedor rejeita o formato e outro está indisponível
- **THEN** o resultado é tratado como indisponibilidade (`unavailable`)
- **AND** não é exibido como CNPJ inexistente
