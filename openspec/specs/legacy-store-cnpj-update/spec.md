> Synced from `fase-32-freemium-anti-abuso-cnpj` (ADDED).
> Modified by `fase-34-store-readiness` (MODIFIED + ADDED). Legacy stores blocked from generation instead of just warned. Redirect with returnTo chaining. Context messages for redirect guard.
> Extended by `fase-57-2-persistencia-preferencias-multimercado`: credit branches reconciled to F50 (legacy marker when prior benefit; conditional demo subject to flag/eligibility/cohorts otherwise) and market settings initialization/versioning added.

## Purpose

Atualização cadastral de lojas legadas sem CNPJ — banner, formulário, RPC `update_store_cnpj()` que preserva os ramos de benefício vigentes da F50 (marcador legado quando há benefício anterior; demo condicional sujeita a flag, elegibilidade e coortes quando não há) e inicializa/atualiza as configurações de mercado sem alterar créditos por causa das preferências.
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
O formulário de atualização SHALL conter apenas CNPJ + razão social + nome fantasia. O sistema NÃO SHALL recriar loja, refazer onboarding ou conceder créditos por ação do formulário. A RPC pode executar os ramos de benefício vigentes (marcador legado ou demo condicional), sem criar concessão por causa de preferências.

Após atualização bem-sucedida, o sistema SHALL ler `returnTo` dos query params. Se store também não tem brand profile, SHALL redirecionar para `/loja?required=visual-direction&message=cnpj-updated`. Se store está pronta, SHALL redirecionar para `returnTo`, ou `/dashboard` se ausente.

#### Scenario: Atualização não concede crédito de onboarding

- **WHEN** loja legacy informa CNPJ via formulário de atualização
- **THEN** `update_store_cnpj()` é chamado
- **AND** NENHUM crédito de onboarding é concedido
- **AND** eventual demo condicional segue as regras vigentes de flag, elegibilidade e coortes

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

O sistema SHALL prover `update_store_cnpj(p_store_id, p_cnpj_normalized, p_cnpj_root_hash, p_razao_social?, p_nome_fantasia?, p_cnpj_official_data?, p_verification_status?, p_verification_data?, p_cnpj_validation_score?, p_verification_reasons?, p_demo_grant_enabled?)` que:

- Valida que a loja existe (`store_not_found`)
- Valida que CNPJ não foi sobrescrito (`cnpj_already_set`)
- Recebe `cnpj_root_hash` já calculado pela rota Next.js (nunca recebe do caller)
- Atualiza `stores.cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`
- Aceita `p_cnpj_normalized` numérico ou alfanumérico canônico de 14 caracteres, sem transformar o valor
- Preserva os ramos de crédito vigentes: benefício anterior registra marcador legado sem novo grant; ausência de benefício anterior segue a concessão demo condicional da F50 (flag, elegibilidade e coortes vigentes) — não é garantia incondicional
- Inicializa/atualiza `store_market_settings` na mesma transação, preservando escolhas explícitas
- Retorna dados atualizados com CNPJ mascarado

**Tratamento de benefício vigente (F50, preservado pela F57.2):** quando já existe benefício anterior
(`bonus_onboarding` ou entitlement de onboarding na raiz), a RPC insere o marcador legado em
`freemium_entitlements`:
- `benefit_type = 'onboarding'`
- `grant_transaction_id = NULL`
- `reason = 'legacy_pre_f32_onboarding_consumed'`
- Usa `ON CONFLICT DO NOTHING` — se a raiz já tiver entitlement, o INSERT é ignorado

Sem benefício anterior e com `verification_status = 'approved'`, a RPC mantém a concessão demo
condicional existente via `grant_demo_credits`, sujeita à flag, elegibilidade e coortes vigentes.
Preferências de mercado não criam, removem ou modificam benefícios.

#### Scenario: Atualização numérica bem-sucedida

- **WHEN** `update_store_cnpj` é chamado com `p_cnpj_normalized = "12345678000195"` e dados válidos
- **THEN** CNPJ é salvo na loja
- **AND** o tratamento de benefício segue os ramos vigentes (marcador legado ou demo condicional), sem garantia incondicional
- **AND** retorna dados com CNPJ mascarado

#### Scenario: Atualização alfanumérica bem-sucedida

- **WHEN** `update_store_cnpj` é chamado com `p_cnpj_normalized = "12ABC34501DE35"` e dados válidos
- **THEN** o valor exato `"12ABC34501DE35"` é salvo em `stores.cnpj_normalized`
- **AND** `cnpj_root_hash` corresponde ao hash da raiz `"12ABC345"`
- **AND** o tratamento de crédito segue as condições vigentes, sem alteração por preferências
- **AND** retorna dados com CNPJ mascarado no formato `**.***.***/01DE-**`

#### Scenario: Mesma raiz em lojas legacy diferentes

- **WHEN** duas lojas legacy da mesma raiz com benefício anterior atualizam CNPJ
- **THEN** a primeira inserção do marcador legado vence (ON CONFLICT não bloqueia)
- **AND** a segunda é ignorada pelo ON CONFLICT DO NOTHING
- **AND** nenhuma das duas recebe novo grant pela confirmação

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

### Requirement: Confirmação fiscal inicializa ou atualiza configurações de mercado

A RPC `update_store_cnpj` SHALL estabelecer o país cadastral na confirmação fiscal e
inicializar/atualizar `store_market_settings` na mesma transação:

- loja sem linha: cria com país do país fiscal confirmado e fonte `fiscal_confirmation`,
  aplicando os padrões do perfil;
- loja com linha: atualiza `country_code`/`country_source` para o país fiscal e recomputa
  **somente** campos com fonte `default` ou `legacy_br`.

Campos com fonte `explicit` SHALL ser preservados. A RPC SHALL NOT recriar a loja, refazer
onboarding ou sobrescrever dados fiscais já registrados.

#### Scenario: Loja draft com escolha explícita confirma CNPJ

- **WHEN** uma loja draft possui `defaultCurrency = "PYG"` explícita e confirma CNPJ
- **THEN** a moeda explícita é preservada
- **AND** país e demais campos não explícitos são atualizados para o padrão fiscal

#### Scenario: Mercado explícito mantém idioma e moeda derivados

- **WHEN** uma loja BR tem `defaultCampaignMarket = "PY"` explícito, idioma/moeda com fonte
  `default` e confirma CNPJ
- **THEN** o mercado padrão continua PY
- **AND** idioma/moeda continuam `es-PY`/`PYG` (derivados do mercado, não do país)
- **AND** `time_zone` continua `America/Sao_Paulo` e `country_code` passa a BR com fonte
  `fiscal_confirmation`

#### Scenario: Loja legada sem configurações confirma CNPJ

- **WHEN** uma loja legada sem linha confirma CNPJ
- **THEN** a linha é criada com fonte `fiscal_confirmation`
- **AND** os padrões BR são aplicados

#### Scenario: País divergente falha explicitamente

- **WHEN** a confirmação fiscal tenta aplicar país diferente do já registrado como fiscal
- **THEN** a operação falha com erro tipado
- **AND** nenhum campo é sobrescrito

### Requirement: Benefícios existentes permanecem exatamente como estão

A confirmação fiscal SHALL preservar o comportamento vigente de créditos:

- loja com benefício anterior (`bonus_onboarding` ou entitlement `onboarding` na raiz) SHALL
  registrar o marcador legado `legacy_pre_f32_onboarding_consumed`, sem grant;
- loja sem benefício anterior e com `verification_status = 'approved'` SHALL manter a concessão
  demo condicional existente (`grant_demo_credits` com a flag vigente), sujeita a elegibilidade
  e coortes — não é garantia incondicional;
- nenhuma preferência de mercado SHALL criar, remover ou modificar benefícios.

#### Scenario: Loja com benefício anterior mantém marcador sem grant

- **WHEN** a loja/raiz já consumiu benefício de onboarding e confirma CNPJ
- **THEN** o marcador legado é registrado
- **AND** nenhum novo crédito é concedido pela confirmação

#### Scenario: Loja aprovada mantém a concessão condicional vigente

- **WHEN** a loja não tem benefício anterior, a verificação resulta `approved` e as regras vigentes de flag/elegibilidade/coorte permitem a demonstração
- **THEN** a concessão demo ocorre exatamente como hoje
- **AND** a inicialização de preferências não altera o resultado do grant

#### Scenario: Preferências não criam nem removem benefícios

- **WHEN** a confirmação fiscal inicializa/atualiza configurações
- **THEN** transações de crédito e entitlements permanecem idênticos ao comportamento vigente
- **AND** nenhum benefício é criado, removido ou reinterpretado por causa das preferências

### Requirement: Confirmação fiscal participa do controle de versão

A confirmação fiscal SHALL travar a linha de `store_market_settings` (`FOR UPDATE`), aplicar a
recomposição e incrementar `settings_version` na mesma transação.

#### Scenario: PATCH concorrente não sobrescreve a confirmação

- **WHEN** um PATCH de preferências parte de uma versão anterior enquanto a confirmação fiscal
  incrementa a versão
- **THEN** o PATCH recebe `409 settings_version_conflict`
- **AND** a confirmação e as escolhas explícitas permanecem íntegras

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

