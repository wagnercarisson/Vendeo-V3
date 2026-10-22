> Synced from `fase-32-freemium-anti-abuso-cnpj` (ADDED).
> Modified by `fase-34-store-readiness` (MODIFIED + ADDED). Legacy stores blocked from generation instead of just warned. Redirect with returnTo chaining. Context messages for redirect guard.

## Purpose

Atualização cadastral de lojas legadas sem CNPJ — banner, formulário, RPC `update_store_cnpj()` sem concessão de créditos, com entitlement `onboarding` legacy sem grant para marcar raiz consumida.
## Requirements
### Requirement: Lojas legadas sem CNPJ — bloqueio de geração (MODIFIED F34)
O sistema SHALL bloquear geração para lojas legacy sem cadastro fiscal completo. Quando uma loja legacy sem `cnpj_normalized`, `razao_social` ou `nome_fantasia` tenta acessar `/campanhas/nova` ou chamar a API de geração, o guard de readiness SHALL redirecionar para `/cadastro/cnpj?returnTo=/campanhas/nova`. O banner no dashboard continua sendo exibido.

#### Scenario: Loja legacy bloqueada ao gerar campanha

- **WHEN** loja legacy (sem cadastro fiscal) tenta acessar `/campanhas/nova`
- **THEN** o guard de readiness redireciona para `/cadastro/cnpj?returnTo=/campanhas/nova`
- **AND** banner no dashboard continua sendo exibido

#### Scenario: Banner exibido para loja sem CNPJ

- **WHEN** loja com `cnpj_normalized IS NULL` acessa o dashboard
- **THEN** o banner de atualização cadastral é exibido

> Modified by `fase-34-store-readiness`.

### Requirement: Formulário de atualização cadastral com returnTo (MODIFIED F34)
O formulário de atualização SHALL conter apenas CNPJ + razão social + nome fantasia. O sistema NÃO SHALL recriar loja, refazer onboarding ou conceder créditos.

Após atualização bem-sucedida, o sistema SHALL ler `returnTo` dos query params. Se store também não tem brand profile, SHALL redirecionar para `/loja?required=visual-direction&message=cnpj-updated`. Se store está pronta, SHALL redirecionar para `returnTo`, ou `/dashboard` se ausente.

#### Scenario: Atualização não concede créditos

- **WHEN** loja legacy informa CNPJ via formulário de atualização
- **THEN** `update_store_cnpj()` é chamado
- **AND** NENHUM crédito de onboarding é concedido
- **AND** saldo existente permanece intacto

#### Scenario: Atualização redireciona para brand profile se necessário

- **WHEN** loja legacy completa cadastro fiscal com sucesso
- **AND** store também não tem brand profile synced
- **THEN** redireciona para `/loja?required=visual-direction&message=cnpj-updated`

#### Scenario: Atualização redireciona para returnTo se pronta

- **WHEN** loja legacy completa cadastro fiscal com sucesso
- **AND** store já tem brand profile synced
- **AND** `returnTo` está presente nos query params
- **THEN** redireciona para o valor de `returnTo`

#### Scenario: Atualização sem returnTo vai para dashboard

- **WHEN** loja legacy completa cadastro fiscal com sucesso
- **AND** store já tem brand profile synced
- **AND** `returnTo` não está presente
- **THEN** redireciona para `/dashboard`

> Modified by `fase-34-store-readiness`.

### Requirement: Mensagens do redirect de guarda (ADDED F34)
O sistema SHALL exibir mensagens específicas no contexto de redirect de guarda:

| Contexto | Mensagem |
|----------|----------|
| Redirect do guard (cadastro fiscal ausente) | "Sua loja precisa do CNPJ, razão social e nome fantasia para gerar campanhas. Atualize seus dados cadastrais para continuar." |
| Redirect do guard (brand profile ausente) | "Sua loja precisa de uma direção visual para gerar campanhas. Configure agora." |
| Após atualizar cadastro + sem brand profile | "Dados atualizados! Agora configure a direção visual da sua loja." |

As mensagens SHALL ser passadas via query param `message` para o destino do redirect.

#### Scenario: Mensagem de redirect para cadastro fiscal

- **WHEN** usuário é redirecionado para `/cadastro/cnpj?returnTo=/campanhas/nova`
- **THEN** a página de cadastro exibe a mensagem "Sua loja precisa do CNPJ..."

#### Scenario: Mensagem de redirect para direção visual (brand ausente)

- **WHEN** usuário é redirecionado para `/loja?required=visual-direction&message=needs-visual-direction`
- **THEN** a página exibe "Sua loja precisa de uma direção visual para gerar campanhas. Configure agora."

#### Scenario: Mensagem após atualizar cadastro sem brand profile

- **WHEN** usuário completa cadastro fiscal e é redirecionado via `&message=cnpj-updated`
- **THEN** a página exibe "Dados atualizados! Agora configure a direção visual da sua loja."

> Added by `fase-34-store-readiness`.

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

### Requirement: Cron mensal ignora lojas sem CNPJ

O cron mensal (`grant_monthly_credits`) SHALL ignorar lojas com `cnpj_root_hash` vazio ou nulo. Lojas legacy sem CNPJ não recebem bônus mensal.

#### Scenario: Loja sem CNPJ não recebe bônus mensal

- **WHEN** o cron mensal executa
- **AND** loja tem `cnpj_root_hash = ''` ou `NULL`
- **THEN** a loja é pulada (não recebe grant mensal)

### Requirement: Admin pode conceder exceção "isenta de CNPJ"

O sistema SHALL permitir que um administrador marque uma loja legacy como "isenta de CNPJ", exigindo `reason` obrigatório e registro em `admin_audit_log`.

#### Scenario: Admin isenta loja de CNPJ

- **WHEN** admin marca loja como isenta de CNPJ
- **AND** reason é fornecido
- **THEN** a loja é marcada como exceção
- **AND** registro é criado em `admin_audit_log`

### Requirement: Formulário de atualização cadastral aceita CNPJ alfanumérico

O formulário de `/cadastro/cnpj` SHALL aceitar CNPJs numéricos e alfanuméricos, preservando letras durante digitação, colagem e edição. A validação local SHALL usar a mesma normalização e o mesmo algoritmo de DV da API. O formulário SHALL exibir mensagem de erro clara quando o formato ou os DVs forem inválidos, sem remover letras silenciosamente. Caracteres desconhecidos (acentos, emojis, símbolos) SHALL manter o último valor válido, exibir erro local e bloquear lookup e envio.

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

#### Scenario: Colagem com emoji não realiza consulta nem envio

- **WHEN** o lojista cola `12.ABC.345/01DE-35😀` no campo CNPJ de `/cadastro/cnpj`
- **THEN** o campo mantém visualmente o último valor válido
- **AND** a UI exibe erro local de CNPJ inválido
- **AND** nenhuma consulta de CNPJ é disparada
- **AND** nenhuma chamada de atualização é feita

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

