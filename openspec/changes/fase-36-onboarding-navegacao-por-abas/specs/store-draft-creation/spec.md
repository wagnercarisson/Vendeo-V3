## ADDED Requirements

### Requirement: RPC create_store_draft — criação de loja sem CNPJ

O sistema SHALL prover a RPC `create_store_draft` (nova, via migration SQL) que cria a loja **sem CNPJ** em estado fiscal pendente (D15):

- Assinatura análoga à antiga `create_store_with_legal_acceptance` (removida na F32), **sem** parâmetros de CNPJ e **sem** grant:
  `create_store_draft(p_user_id UUID, p_name TEXT, p_segment TEXT, p_city TEXT, p_state TEXT, p_accepted_by_user_id UUID, p_terms_version TEXT, p_acceptable_use_version TEXT, p_ip_address TEXT, p_user_agent TEXT, p_brand_color TEXT, p_logo_url TEXT, p_subsegment TEXT, p_tone_of_voice TEXT, p_positioning TEXT, p_short_description TEXT, p_slogan TEXT) RETURNS JSONB`
- Insere em `stores` com `cnpj_normalized`, `cnpj_root_hash`, `razao_social` e `nome_fantasia` = NULL (colunas já nullable no schema)
- Registra os 2 aceites legais (`terms_of_service` e `acceptable_use`, `acceptance_source = 'onboarding'`) na mesma transação
- **NÃO** chama `try_grant_onboarding_entitlement` nem `grant_credits` — **não concede crédito freemium**
- Retorna `jsonb_build_object('store', ..., 'onboardingGranted', false)`
- `SECURITY DEFINER`, `SET search_path = ''`, executável apenas por `service_role` (mesmo padrão das RPCs atuais)
- Validações de entrada (nome, segmento, subsegmento, aceite) permanecem na rota (reuso das funções atuais de `src/app/api/store/route.ts`)

#### Scenario: RPC cria loja sem CNPJ e registra aceites

- **WHEN** `create_store_draft` é chamado com nome + segmento + aceite válidos
- **THEN** uma loja é inserida com `cnpj_normalized = NULL`
- **AND** dois aceites legais são registrados (`onboarding`)
- **AND** retorna `{ store, onboardingGranted: false }`

#### Scenario: RPC não concede crédito freemium

- **WHEN** `create_store_draft` é chamado
- **THEN** nenhum `grant_credits` é executado
- **AND** `onboardingGranted` é `false`

#### Scenario: RPC exige service_role

- **WHEN** `create_store_draft` é chamado por um cliente autenticado (não service_role)
- **THEN** a execução é negada (REVOKE/GRANT apenas service_role)

### Requirement: POST /api/store em dois modos de criação

O sistema SHALL modificar `POST /api/store` (`src/app/api/store/route.ts`) para suportar **dois modos** de criação (D15):

1. **Modo draft (sem CNPJ):**
   - Quando `cnpj` está ausente/vazio no body, usa `create_store_draft`
   - Exige `acceptedTerms: true`, `name` e `segment` válidos (validações existentes da rota)
   - Retorna 201 com `{ ...store, onboardingGranted: false }`
   - **NÃO concede crédito freemium**; readiness fiscal fica pendente
2. **Modo verified/fiscal (com CNPJ):**
   - Quando `cnpj` está presente, mantém o caminho atual: `create_store_with_cnpj` com validação BrasilAPI/CNPJá, root hash, avaliação freemium e grant condicionado (F32/F33)
   - CNPJ deixa de ser obrigatório no body (era 400 sem CNPJ)

**Regra do OpenSpec:** *Loja draft não é loja pronta. Ela existe para permitir onboarding, posicionamento e direção visual. Ela não libera campanha nem freemium até cadastro fiscal válido, exceto `is_test_store`.*

#### Scenario: POST sem CNPJ cria loja draft

- **WHEN** `POST /api/store` é chamado com nome + segmento + `acceptedTerms: true` e **sem** `cnpj`
- **THEN** retorna 201 com a loja criada (`onboardingGranted: false`)
- **AND** `cnpj_normalized` da loja é NULL
- **AND** nenhum crédito freemium é concedido

#### Scenario: POST com CNPJ usa o caminho verified/fiscal

- **WHEN** `POST /api/store` é chamado com nome + segmento + `acceptedTerms: true` + `cnpj` válido
- **THEN** usa `create_store_with_cnpj` com validação e avaliação freemium da F32/F33
- **AND** `onboardingGranted` reflete a elegibilidade da raiz

#### Scenario: POST sem aceite legal é bloqueado

- **WHEN** `POST /api/store` é chamado sem `acceptedTerms: true`
- **THEN** retorna 400 com erro de aceite legal (inalterado)

#### Scenario: POST com CNPJ já cadastrado retorna 409

- **WHEN** `POST /api/store` é chamado com CNPJ já existente em outra conta
- **THEN** retorna 409 (inalterado, mesmo no modo draft+CNPJ posterior)

### Requirement: Gates de geração e crédito preservados para loja draft

O sistema SHALL manter, para lojas criadas em modo draft (sem CNPJ), os gates da F32/F33/F34 intactos (D8/D15):

- **Não gera campanha** sem CNPJ fiscal válido (guard de `/campanhas/nova` + readiness RPC + guarda dupla da F34)
- **Não concede crédito freemium** para loja draft sem CNPJ válido (entitlement por raiz de CNPJ da F32/F33)
- **`is_test_store`** / loja experimental pode contornar o fiscal **apenas conforme regra administrativa (F33)** — nunca recebe grant freemium automático sem CNPJ; se gerar sem fiscal, é com crédito/entitlement de teste concedido por admin
- Sem brand profile syncado → não gera; sem aceite legal vigente → não gera (inalterado)
- `getStoreReadiness` (F34) SHALL tratar loja draft como `ready: false` com `missing: ["cadastro_fiscal", ...]` — sem mudança na lógica, o dado ausente já gera a pendência

#### Scenario: Loja draft não gera campanha

- **WHEN** um usuário com loja draft (sem CNPJ) tenta acessar `/campanhas/nova`
- **THEN** o guard redireciona para `/loja?tab=dados&fiscal=pending` (D12)
- **AND** nenhuma campanha é gerada

#### Scenario: Loja draft não recebe crédito freemium

- **WHEN** uma loja é criada em modo draft
- **THEN** o onboarding grant não é concedido
- **AND** a loja só recebe crédito após CNPJ válido anexado e elegível (fluxo `update-cnpj` ou recriação fiscal)

#### Scenario: is_test_store gera sem fiscal apenas com entitlement de teste

- **WHEN** uma loja é marcada como `is_test_store` (admin, F33)
- **THEN** pode gerar campanha sem CNPJ somente se tiver crédito/entitlement de teste concedido por admin
- **AND** NÃO recebe grant freemium automático sem CNPJ

### Requirement: Anexo de CNPJ posterior à loja draft

O sistema SHALL suportar a transição **loja draft → fiscal** reutilizando o fluxo existente `POST /api/store/update-cnpj` (`update_store_cnpj` RPC, F32/F33):

- Quando o lojista informa o CNPJ depois, a rota valida o CNPJ, calcula root hash, avalia elegibilidade freemium e anexa os dados fiscais (`cnpj_normalized`, `razao_social`, `nome_fantasia`) à loja existente
- O grant freemium pode ser concedido nesse momento se a raiz for elegível (comportamento existente do `update_store_cnpj`)
- Nenhuma mudança é necessária nesta rota para a F36 — apenas a cobertura de testes do encadeamento draft → fiscal

#### Scenario: CNPJ anexado a loja draft atualiza readiness

- **WHEN** `POST /api/store/update-cnpj` anexa CNPJ válido a uma loja criada em modo draft
- **THEN** `cnpj_normalized`/`razao_social`/`nome_fantasia` são persistidos
- **AND** `getStoreReadiness` deixa de reportar `cadastro_fiscal` pendente (se completo)
