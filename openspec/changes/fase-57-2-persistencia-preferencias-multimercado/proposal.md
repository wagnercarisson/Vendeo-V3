## Why

A fundação multimercado já existe como biblioteca pura (`src/lib/market-context/**`), mas nada
é persistido: país da loja, mercado padrão, idioma do conteúdo, moeda anunciada, fuso e idioma
do aplicativo continuam implícitos no Brasil. Sem persistência autorizada, qualquer tela futura
recalcularia preferências ou as perderia, e lojas brasileiras não conseguirão preparar campanhas
para o Paraguai (nem o inverso) sem inventar estado local.

Esta fatia persiste **preferências** — não conecta escolhas a telas nem à geração de campanhas.

## What Changes

- Criar armazenamento por **usuário** para o idioma do aplicativo (`user_preferences`),
  independente do país da loja.
- Criar armazenamento por **loja** para país cadastral, mercado padrão das campanhas, idioma
  padrão do conteúdo, moeda anunciada e fuso (`store_market_settings`), com **proveniência por
  campo** (`explicit` / `default` / `legacy_br`) e versão de concorrência.
- Reutilizar `src/lib/market-context/**` para validar e resolver o contexto completo antes de
  persistir; nenhum resolvedor novo é inventado.
- Expor leitura/escrita autenticadas com ownership, CSRF, validação estrita e DTOs allowlisted:
  preferências do usuário e configurações da loja.
- Atualizações **parciais**: campo omitido não muda, `null` limpa o override explícito, valor
  inválido não escreve. Conflito de versão retorna erro explícito (sem sobrescrita silenciosa).
- Inicializar configurações de forma **idempotente** nos caminhos de criação de loja existentes
  (draft, fiscal, admin) e na confirmação fiscal de loja legada, **sem sobrescrever escolhas
  explícitas**.
- Tratar lojas/usuários legados como contexto `legacy_br` explícito, sem backfill amplo e sem
  escrita incidental em leitura.
- **BREAKING:** nenhuma. Tabelas, funções e rotas são aditivas; `stores`,
  `store_billing_info`, DTOs atuais, créditos, onboarding e campanhas permanecem compatíveis.
- Fora desta fatia: telas/seletores, tradução, catálogos, formatação monetária, integração com
  IA/geração/arte, snapshots de campanha, RUC, cobrança e habilitação operacional do Paraguai.

## Capabilities

### New Capabilities

- `store-market-settings`: modelo persistido das configurações de mercado da loja, proveniência,
  semântica de ausência/legado, leitura/escrita autorizada, atualização parcial e concorrência.
- `user-locale-preference`: preferência persistida de idioma do aplicativo por usuário, com
  ausência legada explícita e independência do país/mercado da loja.
- `market-settings-initialization`: inicialização idempotente nos caminhos de criação/confirmação
  fiscal, país cadastral vindo da confirmação fiscal (não de endereço/IP/navegador) e preservação
  de escolhas explícitas.

### Modified Capabilities

- `store-draft-creation`: a criação draft passa a inicializar as configurações de mercado da loja
  na mesma transação, sem alterar o comportamento fiscal/crédito existente.
- `legacy-store-cnpj-update`: a confirmação fiscal de loja legada/draft passa a estabelecer país
  cadastral e padrões iniciais, preservando escolhas explícitas, sem recriar loja e sem
  introduzir concessões adicionais ou alterar as concessões, condições e benefícios vigentes.
- `admin-store-create`: lojas criadas por administrador passam a receber as mesmas configurações
  iniciais, mantendo auditoria e o comportamento vigente de créditos.

## Impact

- **Banco:** 2 tabelas aditivas (`user_preferences`, `store_market_settings`), 1 função auxiliar
  de inicialização, 4 RPCs existentes recriadas com a inicialização (`create_store_draft`,
  `create_store_with_cnpj`, `create_store_with_initial_grant`, `update_store_cnpj`), triggers,
  RLS/grants. Sem backfill e sem alteração de tabelas existentes.
- **Código:** novo módulo `src/lib/market-preferences/` (serviços, DTOs, erros) e rotas
  `src/app/api/preferences/**`, `src/app/api/store/market-settings/**`; ajustes mínimos nas RPCs
  chamadas pelos caminhos de onboarding. Sem alternativa de caminho nesta fatia e sem alteração
  de `src/lib/market-context/*.ts` (contratos puros).
- **Contratos preservados:** `PublicStoreDTO`, `Store`, `store_billing_info`, créditos,
  readiness, geração e campanhas não mudam. `billing_address_country` continua sendo dado de
  cobrança, **não** país cadastral.
- **Operação:** sem nova variável de ambiente, dependência, flag ou configuração de deploy.
  Aplicar a migration antes do código. As rotas novas são API autenticada e ficam acessíveis
  mesmo sem UI — não são inertes. Rollback preferencial é só do código, preservando tabelas e
  dados; reversão do banco exige autorização e restauração prévia das RPCs anteriores.
- **Ambiente de validação (revisão 2026-10-28):** usa exclusivamente o homolog existente
  (`127.0.0.1:57782`, ledger 149, backup pré-F57.2). Nenhum stack/ambiente descartável é criado ou
  destruído; S0 e base×novo usam snapshots/evidências do mesmo homolog. As RPCs de onboarding são
  recriadas em **segunda migration aditiva**.
- **Benefícios:** nenhum grant, entitlement ou marcador de crédito é criado, removido ou alterado
  por esta fatia. O comportamento condicional vigente de `create_store_with_cnpj` e
  `update_store_cnpj` é preservado; a criação administrativa continua sem concessão.
- **Habilitação:** o modelo aceita `PY`, mas nenhum caminho cria loja PY, não há RUC e o Paraguai
  **não** fica operacional. A existência de perfis/valores PY não autoriza acesso nem cadastro.
