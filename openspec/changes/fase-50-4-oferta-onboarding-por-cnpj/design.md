## Context

A F50.2 implementou a oferta de 28 dias com um enrollment por **raiz** de CNPJ:

- `trial_offer_enrollments` tem `UNIQUE (root_hash)` e `UNIQUE (store_id)`;
- `trial_offer_eligibility` retorna o enrollment da raiz ou da loja, sem distinguir estabelecimentos;
- `start_trial_offer_enrollment` insere com `ON CONFLICT DO NOTHING` e, em conflito, busca por `root_hash OR store_id`;
- `grant_demo_credits` e `grant_monthly_credits` usam `root_hash` como barreira de coexistência;
- a avaliação cadastral usa `rootEligible` por raiz e emite `root_already_used`.

A oferta está ativa em produção, com enrollment e parcelas em andamento. A F50.3 tornou o CNPJ canônico (14 caracteres `[A-Z0-9]{12}[0-9]{2}`) e manteve `cnpj_root_hash` inalterado. Não existe hoje identidade do CNPJ completo no enrollment.

A decisão comercial aprovada é: **cada CNPJ completo elegível pode receber sua própria oferta**, matriz e filiais independentemente, sem repetição para o mesmo CNPJ completo, preservando contas, benefícios e políticas anteriores. A ativação da F50.4 em **produção** é uma etapa separada e **não** será executada nesta mudança. A ativação controlada do marco em banco descartável é permitida exclusivamente para testes e UAT, nunca em ambiente compartilhado ou produtivo.

## Goals / Non-Goals

**Goals:**

- Separar a elegibilidade da oferta em duas coortes explícitas: legada/F50.2 por raiz e F50.4 por CNPJ completo.
- Introduzir um marco próprio da F50.4, sem alterar `launch_at` da F50.2.
- Registrar identidade imutável do CNPJ beneficiário e trocar a unicidade global por raiz por unicidade por CNPJ completo + `store_id`, com unicidade parcial de raiz para o legado.
- Garantir que matriz e filiais da mesma raiz recebam a oferta independentemente, e que nenhuma filial veja enrollment, saldo ou metadados de outra.
- Preservar contas, enrollments, datas, parcelas, saldos, `freemium_entitlements`, `credit_transactions` e o freemium desativado.
- Distinguir crédito manual operacional de exceção administrativa e de benefício anterior.
- Definir migration fail-closed, ordem de publicação e rollback/forward-fix sem reintroduzir `UNIQUE(root_hash)` global.

**Non-Goals:**

- Ativar o novo marco, aplicar migration, conceder créditos ou alterar ambientes.
- Alterar o valor (5 × 4), o calendário (0/7/14/21), o vencimento (28 dias), o limite de 20 ou a chave `trial_28d_v1`.
- Reativar o freemium, criar compensações, recuperar contas bloqueadas por raiz ou criar exceções para usuários conhecidos.
- Criar organizations, memberships, multi-loja, cobrança compartilhada, hierarquia matriz/filiais, agência ou nova arquitetura institucional.
- Corrigir follow-ups de UX da F50.3 sem necessidade direta.
- Implementar código, iniciar GSD, fazer merge, push ou deploy.

## Decisions

### D1 — Marco próprio e resolução de coorte

`trial_offer_settings` recebe `individual_launch_at TIMESTAMPTZ NULL`, separado de `launch_at`.

- `individual_launch_at = NULL`: a F50.4 está **inativa**; todas as contas seguem exatamente a política F50.2/legado. Nenhuma conta é movida para a nova coorte por presença de código novo.
- `individual_launch_at` preenchido: a coorte é resolvida por `auth.users.created_at`:
  - `created_at >= individual_launch_at` → `per_cnpj_f50_4`;
  - `created_at < individual_launch_at` → `root_legacy` (F50.2 quando `created_at >= launch_at`; demo/mensal legado quando anterior).
- A coorte **nunca** é resolvida por `onboarding_completed_at`, `enabled`, data de criação da loja ou data de atualização cadastral. Uma conta anterior ao marco que conclua onboarding depois permanece `root_legacy`; uma conta posterior que conclua onboarding muito depois permanece `per_cnpj_f50_4`.
- `launch_at` original não é alterado. `individual_launch_at` só pode ser gravado uma vez, por RPC administrativa auditada, com `enabled=true`, `launch_at` não nulo, motivo e `operation_id`, usando o instante da operação (`now()`), sem backdate e garantindo `individual_launch_at >= launch_at`. Não existe operação de limpeza ou troca do marco.
- `enabled` continua sendo a chave de **novas adesões** para as duas coortes. Desligar a oferta não muda a coorte, não converte conta nova em antiga, não devolve demo/mensal legado e não apaga enrollments. Não há fallback automático para o legado.

**Rationale:** separar o marco evita reescrever o passado e permite publicar código escuro antes da ativação. Usar `auth.users.created_at` mantém a regra já provada na F50.2 e cumpre “conta anterior mantém enquadramento mesmo com onboarding tardio”.

**Alternativas descartadas:** reutilizar `launch_at` (mudaria a coorte da F50.2 e contas já existentes); criar uma segunda chave `enabled` (permitiria estados contraditórios); decidir por `onboarding_completed_at` (permitiria promoção retroativa de conta antiga).

### D2 — Identidade do benefício: snapshot canônico do CNPJ completo

`trial_offer_enrollments` recebe `beneficiary_cnpj_normalized TEXT NOT NULL`, com `CHECK (beneficiary_cnpj_normalized ~ '^[A-Z0-9]{12}[0-9]{2}$')`, preenchido a partir de `stores.cnpj_normalized` no momento da inscrição. A coluna é imutável após o insert, assim como `policy_cohort`, `store_id`, `root_hash`, `user_id`, `started_at` e `expires_at`.

**Escolha:** snapshot canônico, não hash HMAC do CNPJ completo.

**Rationale:**

- O backfill pode ser feito inteiramente em SQL, com evidência direta `enrollment.store_id → stores.cnpj_normalized`, sem depender de `CNPJ_PEPPER` no processo de migration.
- A migration fica reproduzível no CLI Supabase e no PostgreSQL descartável, com pré-checagem e aborto transacional.
- O CNPJ completo já é armazenado em `stores.cnpj_normalized`; a duplicação fica em tabela com RLS e grants restritos a `service_role`, sem exposição nova em UI.
- A coluna permite auditoria legível do beneficiário sem consultar outra tabela, o que é importante para uma decisão comercial irreversível por CNPJ.

**Alternativas descartadas:** hash HMAC do CNPJ completo exigiria backfill app-side com o pepper e tornaria a migration dependente do runtime; um hash sem pepper seria reversível e daria falsa sensação de proteção. Se no futuro for necessário ocultar o CNPJ do banco, um hash derivado pode ser adicionado como coluna separada, sem trocar a chave de unicidade.

**Privacidade:** a coluna nunca é retornada ao cliente, nunca aparece em painel administrativo e não é usada em logs. Consultas administrativas continuam usando `maskCnpj`.

### D3 — Unicidade, coorte persistida e concorrência

`trial_offer_enrollments` recebe `policy_cohort TEXT NOT NULL DEFAULT 'root_legacy' CHECK (policy_cohort IN ('root_legacy','per_cnpj_f50_4'))`.

Constraints finais:

- `UNIQUE (beneficiary_cnpj_normalized)` — global; o mesmo CNPJ completo não repete o benefício em nenhuma conta, coorte ou política.
- `UNIQUE (store_id)` — preservado.
- Índice único parcial `(root_hash) WHERE policy_cohort = 'root_legacy'` — preserva a garantia de um enrollment legado por raiz.
- Remoção do `UNIQUE (root_hash)` global.

**Rationale:** o índice parcial mantém a proteção dura da F50.2 para o legado e, ao mesmo tempo, permite duas ou mais filiais `per_cnpj_f50_4` na mesma raiz. Ele também é a razão pela qual **não** se deve restaurar `UNIQUE(root_hash)` global no rollback: depois de existirem duas filiais, a restauração seria impossível sem apagar dados.

**Concorrência e ausência de assimetria por ordem de chegada:**

- `start_trial_offer_enrollment` adquire `SELECT ... FOR UPDATE` na loja e o advisory lock de raiz definido em D3.1 antes de avaliar a raiz.
- O insert usa `ON CONFLICT DO NOTHING` como backstop; após conflito, a resolução é sempre limitada ao **mesmo `store_id`**. Nunca se retorna enrollment de outra filial.
- Duas tentativas concorrentes do mesmo CNPJ: uma vence; a outra encontra o enrollment do mesmo `store_id` e retorna `existing`, sem segundo grant.
- Duas filiais novas da mesma raiz: ambas podem inserir, pois o índice parcial de raiz só cobre `root_legacy`.
- **Legado × nova coorte na mesma raiz:** um enrollment `per_cnpj_f50_4` de **outro CNPJ** NÃO, por si só, retira a elegibilidade da conta anterior. A conta `root_legacy` continua limitada pela sua própria política por raiz, considerando apenas enrollments `root_legacy`; a filial F50.4 apenas coexiste. O mesmo CNPJ completo continua impedido de repetir o benefício pelo `UNIQUE(beneficiary_cnpj_normalized)` e pelo `store_id`.
- A ordem de chegada não altera o direito: se a conta legada entrar antes ou depois da filial F50.4, o resultado é o mesmo — cada uma é avaliada pela sua coorte e o mesmo CNPJ nunca duplica. Não existe bloqueio recíproco por presença de outro CNPJ na raiz.

### D3.1 — Protocolo de concorrência entre programas de benefício

Além da inscrição, há decisões que leem ou escrevem estado de benefício por raiz: demo legada, mensal legado e exceção administrativa. Para evitar decisões baseadas em estado obsoleto, sem introduzir bloqueios recíprocos novos:

**Participantes e escopo:**

| Operação | Decide com base em | Locks |
|---|---|---|
| `start_trial_offer_enrollment` | enrollment `root_legacy`/mesmo CNPJ, benefícios anteriores, settings | loja `FOR UPDATE` → advisory de raiz → insert/constraint |
| `grant_demo_credits` | entitlement demo/onboarding/admin_exception, enrollment `root_legacy`, mesmo CNPJ | loja `FOR UPDATE` → advisory de raiz → insert/constraint → `credit_balances` |
| `grant_monthly_credits` | enrollment `root_legacy`, entitlement mensal, recipient legado | advisory de raiz (por raiz iterada) → `credit_balances` |
| `admin_grant_freemium_exception` | entitlement `admin_exception` da raiz/loja, decisão manual auditada | loja `FOR UPDATE` → advisory de raiz → `credit_balances` |

**Chave e ordem:**

- Chave única de raiz: `pg_advisory_xact_lock(hashtextextended('vendeo:benefit:' || root_hash, 0))`.
- Ordem global: **(1)** linha da loja `FOR UPDATE`, quando a operação é por loja; **(2)** advisory lock de raiz; **(3)** unicidade de enrollment/entitlement por constraint (`ON CONFLICT`); **(4)** linha de `credit_balances` `FOR UPDATE` por último.
- Nenhuma operação SHALL adquirir a linha da loja ou o advisory de raiz depois de já deter `credit_balances`. O mensal adquire o advisory da raiz antes de tocar no saldo do recipiente.
- `grant_trial_offer_installment`, `materialize_demo_expiration_at` e `refund_credit_at` NÃO participam do protocolo de raiz: eles atuam por enrollment/saldo e mantêm a ordem `enrollment → credit_balances`. Eles não decidem elegibilidade de raiz e não devem adquirir o advisory de raiz.
- O lock é apenas de serialização: ele NÃO cria bloqueio comercial novo. Uma filial `per_cnpj_f50_4` continua sem bloquear a conta legada; demo e mensal continuam considerando apenas enrollment `root_legacy` para a barreira legada; o mesmo CNPJ continua bloqueado pela unicidade do beneficiário.

**Rationale:** mapear os participantes e fixar uma ordem única elimina corridas entre trial × demo × mensal × exceção sem ampliar a política. Locks indiscriminados (por exemplo, em parcelas/estornos) seriam desnecessários e aumentariam o risco de deadlock.

**Alternativas descartadas:** advisory lock global único (serializaria raízes independentes e reduziria throughput); lock apenas em trial (deixaria demo/mensal/exceção decidindo com estado obsoleto); lock na linha de `stores` representante da raiz (não existe garantia de representante único e complicaria a matriz/filial).

### D4 — Elegibilidade separada por coorte

`trial_offer_eligibility(p_store_id, p_now)` passa a retornar também `policy_cohort` e `beneficiary_cnpj_normalized` **somente para uso interno**; a camada de aplicação não devolve o CNPJ ao cliente.

Ordem de avaliação:

1. loja existe;
2. `onboarding_completed_at` não nulo;
3. `p_now < onboarding_completed_at + 28 dias`;
4. oferta `enabled = true`;
5. `launch_at` não nulo;
6. conta existe em `auth.users`;
7. resolver coorte por `auth.users.created_at` × `individual_launch_at`;
8. `root_legacy`: exigir `created_at >= launch_at`; `per_cnpj_f50_4`: o marco próprio já é a condição;
9. `root_hash` e `beneficiary_cnpj_normalized` não vazios/canônicos;
10. `is_test_store = false`;
11. enrollment do **mesmo `store_id`** → `eligible=true` com `existing_enrollment_id` (comportamento idempotente);
12. `root_legacy` com enrollment **`root_legacy`** de outra filial na raiz → `eligible=false`, `reason='root_used_other_beneficiary'`, **sem** devolver o enrollment alheio; enrollment `per_cnpj_f50_4` de outro CNPJ não bloqueia a conta legada; `per_cnpj_f50_4` ignora outras filiais da raiz;
13. benefício anterior:
    - `root_legacy`: preservar as consultas atuais por raiz (`onboarding`, `demo`, `admin_exception`);
    - `per_cnpj_f50_4`: consultar somente o **mesmo CNPJ completo**, via `stores.cnpj_normalized`, em `freemium_entitlements` (`onboarding`, `demo`, `admin_exception`) e no histórico de créditos de onboarding/demo inicial;
14. elegível.

**Benefício anterior na nova coorte:** conta como benefício anterior, para o mesmo CNPJ completo:

- entitlement `onboarding`, `demo` ou `admin_exception` vinculado a uma loja com o mesmo `cnpj_normalized`;
- transação `bonus_onboarding` ou `demo` (demo inicial legada) vinculada a uma loja com o mesmo `cnpj_normalized`;
- enrollment com o mesmo `beneficiary_cnpj_normalized` (já coberto pelo passo 11/única global).

**Não conta como benefício anterior:** transação `admin_grant` (crédito manual operacional), `bonus_monthly`, compra, estorno, expiração, ou qualquer crédito sem vínculo estruturado de onboarding/demo.

**Entitlement órfão (`store_id IS NULL`):** quando existir entitlement `onboarding`, `demo` ou `admin_exception` com `store_id` nulo e `root_hash` igual ao da loja, não é possível provar a qual CNPJ completo ele pertence (o `ON DELETE SET NULL` apagou o vínculo). A F50.4 retorna `eligible=false`, `reason='prior_benefit_ambiguous'`, sem inscrever e sem inventar atribuição. A resposta é segura e não expõe o entitlement. O caso fica disponível para diagnóstico administrativo e resolução manual futura, sem compensação ou exceção automática.

**Rationale:** a nova coorte não pode ser bloqueada por benefício de outra filial, mas também não pode repetir benefício do mesmo CNPJ. O caso órfão é o único em que a evidência é insuficiente; fail-closed evita duplicidade e mantém a decisão auditável.

### D5 — Conclusão, inscrição e retry

`record_onboarding_completion` mantém a assinatura e a semântica: grava `onboarding_completed_at` uma vez, verifica readiness e retorna a elegibilidade. Ele **não** cria enrollment e não altera coorte. O helper `maybeCompleteOnboardingAndStartTrial` e o retry dedicado continuam chamando conclusão + inscrição, sem reenviar onboarding, sem logo/perfil/assinatura e sem provider.

`start_trial_offer_enrollment`:

- mantém `started_at = onboarding_completed_at` e `expires_at = started_at + 28 dias`;
- adquire lock da loja e advisory lock da raiz;
- usa a coorte resolvida;
- grava `beneficiary_cnpj_normalized` e `policy_cohort`;
- em conflito, resolve somente pelo mesmo `store_id`; se o conflito for de outra filial/beneficiário, retorna `not_eligible` com motivo próprio, sem metadados alheios;
- concede a parcela 0 com o mesmo `p_now`; falha na concessão aborta a transação inteira, sem enrollment órfão.

**Retry:** repetir a operação após falha usa o `onboarding_completed_at` original, encontra o mesmo enrollment (se já criado) e não duplica crédito. Se a falha ocorreu antes do insert, tenta novamente com a mesma coorte.

### D6 — Coexistência com demo legada

`grant_demo_credits` mantém 10 créditos, 168 horas, um benefício por raiz e as verificações de `onboarding`/`admin_exception`. Ajustes:

- a coorte continua decidida por `launch_at`, nunca por `enabled`; contas em/a partir de `launch_at` recebem `trial_offer_applies`, inclusive as que estão entre `launch_at` e `individual_launch_at`;
- `trial_offer_consumed` considera o enrollment do **mesmo CNPJ completo/store** em qualquer coorte. Para a coorte legada, a barreira por raiz considera **somente enrollments `root_legacy`**; um enrollment `per_cnpj_f50_4` de outro CNPJ NÃO, por si só, bloqueia a demo de uma conta anterior. O mesmo CNPJ completo continua impedido de repetir o benefício;
- nenhuma conta da nova coorte recebe demo legada, mesmo com a oferta desligada;
- nenhum entitlement ou transação demo é criado por engano.

**Rationale:** a demo é um programa legado por raiz; a F50.4 não a reativa, não a estende e não a usa como fallback.

### D7 — Coexistência com o mensal legado

`grant_monthly_credits` mantém o limite interno, o ciclo, o recipiente determinístico, o cap de bônus e a idempotência por raiz/ciclo. Ajustes de barreira:

- a raiz é pulada com `skipped_trial_offer_cohort` quando possui enrollment **`root_legacy`** (preserva o comportamento F50.2: raiz que entrou na oferta antiga não volta ao mensal);
- enrollment **`per_cnpj_f50_4`** de uma filial **não** exclui automaticamente a matriz legada da raiz; a matriz preserva seu enquadramento mensal anterior;
- o recipiente elegível é escolhido apenas entre lojas de conta **`root_legacy`** e sem enrollment próprio; loja da nova coorte nunca recebe `bonus_monthly` automático;
- se a raiz só tem lojas da nova coorte, o ciclo é pulado sem grant;
- contadores de detalhe existentes são preservados e recebem `skipped_new_policy_store` para a loja da nova coorte não recipiente.

**Rationale:** cumpre “uma filial nova pode seguir a F50.4 sem migrar a matriz legada” e “preservar o estado operacional do freemium/mensal legado”, sem flexibilizar o limite interno do legado. A alternativa de manter a exclusão por qualquer enrollment reduziria o direito mensal da matriz antiga por causa de uma filial nova.

### D8 — Avaliação cadastral, `root_already_used` e mensagens

A avaliação cadastral continua sendo o motor puro `evaluateFreemiumEligibility`, sem I/O. Os callers (`/api/store` e `/api/store/update-cnpj`) resolvem a coorte e passam um novo sinal:

- `rootEligible` permanece com o significado legado por raiz;
- `beneficiaryEligible` é calculado para a coorte `per_cnpj_f50_4` a partir do mesmo CNPJ completo; na coorte `root_legacy`, espelha `rootEligible`.

O motor:

- mantém `root_already_used` para a coorte `root_legacy`;
- na coorte `per_cnpj_f50_4`, usa `beneficiary_already_used` quando o mesmo CNPJ já tem benefício anterior, sem emitir `root_already_used` por causa de outra filial;
- mantém a ordem D10 e o restante dos motivos.

As mensagens de `/api/store` deixam de dizer que uma filial “já utilizou o benefício” quando ela é elegível à F50.4. Para a nova coorte, a mensagem fala da oferta de onboarding e não promete “créditos de boas-vindas”. O painel de revisão administrativa continua exibindo o histórico legado por raiz, mas não o apresenta como prova de inelegibilidade da F50.4.

**Rationale:** a restrição legada por raiz não pode rejeitar indevidamente a nova oferta nem produzir promessa comercial falsa. A separação de sinais evita alterar o comportamento do legado.

### D9 — Crédito manual operacional × exceção administrativa

- `admin_grant_credits` continua concedendo `admin_grant` ao bucket de bônus, com auditoria `grant_type='admin_grant'`, sem criar enrollment, sem criar entitlement de onboarding e sem tocar `granted_total`/`last_granted_seq`.
- Crédito manual **não** bloqueia elegibilidade da F50.4, **não** consome parcela, **não** aumenta `granted_total`, **não** reinicia a janela e **não** estende `expires_at`. A contabilização permanece separada: `credit_transactions.type='admin_grant'` e auditoria própria, contra `type='demo'` + metadata `credit_program='trial_28d'` das parcelas.
- `admin_exception` (RPC `admin_grant_freemium_exception`, entitlement `benefit_type='admin_exception'`) continua sendo benefício anterior e bloqueia a nova oferta para o mesmo CNPJ.
- Distinção histórica **fechada**: o schema distingue estruturalmente `admin_exception` de `admin_grant`; a classificação estruturada prevalece e texto livre (`reason`) NÃO muda a classificação. Um `admin_grant` antigo com texto “onboarding” continua sendo crédito manual operacional e NÃO bloqueia a F50.4. Nenhum registro é reclassificado ou convertido; não há exceção automática por texto.

### D10 — Migration, backfill e ordem de publicação

Estratégia aditiva, transacional e fail-closed, em migrations separadas:

1. **M1 — settings/marco:** adiciona `individual_launch_at` e a RPC administrativa de ativação futura, auditada e idempotente. Nenhum valor é gravado nesta etapa.
2. **M2 — identidade e unicidade dos enrollments:**
   - adiciona `beneficiary_cnpj_normalized` e `policy_cohort` (default `root_legacy`);
   - pré-checa todos os enrollments: loja existente, `stores.cnpj_normalized` canônico e `stores.cnpj_root_hash` igual ao `root_hash` do enrollment; qualquer divergência aborta com mensagem `F50_4_PRECHECK_*` sem alterar dados;
   - faz backfill somente por `store_id → stores.cnpj_normalized`;
   - define `NOT NULL`/CHECK, cria índice único do beneficiário, mantém `UNIQUE(store_id)`, cria índice único parcial de raiz legada e remove o `UNIQUE(root_hash)` global;
   - cria trigger de imutabilidade de identidade/janela, incluindo `policy_cohort`;
   - substitui `trial_offer_eligibility`, `start_trial_offer_enrollment` e `record_onboarding_completion` na mesma transação, para que código antigo que chama as RPCs já escreva a nova identidade.
3. **M3 — coexistência:** substitui `grant_demo_credits` e `grant_monthly_credits` com as barreiras de D6/D7.

**Ordem de publicação:** M1 → M2 → M3 → deploy do código escuro → validação → (etapa futura, fora desta mudança) ativação do marco em produção. Enquanto `individual_launch_at` for nulo, o comportamento efetivo é o legado. A ativação em produção não faz parte desta mudança; a ativação controlada em banco descartável é permitida apenas para testes/UAT, conforme D11.1.

**Validação pelo CLI real:** a migration deve ser validada com o Supabase CLI efetivamente usado no projeto (versão registrada, hoje 2.75.0), em PostgreSQL descartável, além da execução SQL direta. O incidente de parser da F50.3 (`chk_stores_cnpj_atomic`) é precedente obrigatório: validar `migration up`/`db push` no CLI real, conferir ledger, constraint convalidada e ausência de `42601`, sem depender de um banco isolado antigo. Não reutilizar `vendeo-f562a-isolated` sem revalidar saúde e identidade.

**Rollback/forward-fix:**

- Antes de existir enrollment `per_cnpj_f50_4`, o código antigo continua compatível com o schema novo (marco nulo, funções novas preservam o legado).
- Depois de existir mais de uma filial na mesma raiz, **não** restaurar `UNIQUE(root_hash)` global; isso pode ser impossível sem apagar dados.
- O rollback operacional é desligar a oferta (`enabled=false`), preservar parcelas prometidas e corrigir para frente. Não há retorno automático à demo/mensal legada.
- Revert estrutural (dropar colunas/índices) só é seguro antes da ativação e após confirmar que não há linhas `per_cnpj_f50_4`; o bloco `REVERT` deve trazer essa condição explícita.

### D11 — Painel administrativo e consultas

O painel “Teste gratuito de 28 dias” passa a exibir, além de `enabled` e `launch_at`, o `individual_launch_at` (nulo/ativo) e o estado da coorte. A ativação da F50.4 usa ação separada, com motivo, confirmação e auditoria; em produção, ela fica apenas especificada e **não** é executada nesta mudança. Em banco descartável, a ativação controlada é permitida para testes e UAT, nos termos de D11.1.

### D11.1 — Ativação produtiva × ativação controlada para testes

- **Produção:** a ativação do marco (`individual_launch_at`) é uma decisão operacional posterior, fora desta execução. Nenhuma fixture, teste, harness ou UAT pode gravar o marco em produção, homologação compartilhada ou qualquer ambiente com dados reais.
- **Banco descartável:** a ativação controlada do marco é permitida por fixture/RPC administrativa, somente em instância isolada, efêmera e identificada como descartável, criada para o teste e destruída ao final. O harness SHALL revalidar identidade, saúde e ausência de vínculo com produção antes de qualquer comando.
- **Isolamento:** nenhuma credencial, connection string, `--linked`, variável de ambiente ou fixture de teste pode apontar para ambiente compartilhado/produtivo. O teste SHALL falhar fechado se a identidade do banco não for a instância descartável esperada.
- **UAT:** o UAT da nova política (matriz + filiais, mesmo CNPJ, crédito manual, benefício anterior) ocorre no banco descartável com o marco ativado. O UAT de regressão pode ocorrer com o marco nulo.
- **Evidência:** o registro deve deixar explícito “ativação controlada em descartável” e “produção não ativada”.

Consultas que hoje assumem uma linha por raiz:

- `CreditService.getTrialOfferEnrollment(storeId)` continua por loja e permanece correta;
- não há consulta de enrollment por raiz no app além dessa; qualquer painel que exiba histórico de `freemium_entitlements` por raiz continua legado e não deve ser reinterpretado como disponibilidade da F50.4;
- respostas de RPC não podem expor `beneficiary_cnpj_normalized`, `root_hash` ou IDs de outra filial.

### D12 — Preparação institucional, sem nova arquitetura

- CNPJ é atributo do estabelecimento, não identidade do usuário; por isso a chave econômica do benefício é `beneficiary_cnpj_normalized`, não `user_id`.
- `store_id` permanece a referência operacional durável para saldo, parcelas e auditoria.
- `user_id` continua no enrollment apenas como registro histórico, nunca como chave de elegibilidade ou unicidade.
- A política fica centralizada em `trial_offer_eligibility` e nas RPCs; o app não replica regra de coorte em múltiplos pontos.
- Nenhuma tabela de organizations/memberships/hierarquia é criada.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Backfill atribuir CNPJ errado a enrollment histórico | Pré-checagem exige loja existente, CNPJ canônico e `root_hash` igual; qualquer ambiguidade aborta a migration. Nenhuma atribuição por usuário, nome ou suposição. |
| Duas filiais coexistirem e alguém tentar restaurar `UNIQUE(root_hash)` | Índice parcial documentado; rollback proíbe restauração global e exige forward-fix. |
| Enrollment de outra filial vazar em resposta | Toda resolução por conflito é escopada a `store_id`; consultas por raiz retornam apenas motivo, nunca o registro alheio. |
| Corrida entre filial nova e conta legada da mesma raiz | Cada coorte é avaliada pela própria regra; enrollment `per_cnpj_f50_4` de outro CNPJ não bloqueia a conta anterior. Advisory lock apenas serializa decisões; não há assimetria por ordem de chegada. |
| Corrida entre trial, demo, mensal e exceção administrativa | Protocolo de locks D3.1 com ordem única (loja → raiz → constraint → saldo) e provas cruzadas em PostgreSQL real. |
| Conta antiga perder mensal por causa de filial nova | Exclusão mensal passa a considerar apenas enrollment `root_legacy`; loja da nova coorte não é recipiente. |
| Crédito manual antigo ser confundido com onboarding | Elegibilidade ignora `admin_grant`; só `admin_exception`/entitlements/transações de onboarding-demo bloqueiam. Histórico ambíguo não é reclassificado. |
| Entitlement órfão (`store_id NULL`) impedir filial | Fail-closed `prior_benefit_ambiguous` com motivo seguro e diagnóstico administrativo; resolução manual futura, sem compensação automática. |
| Migration falhar no parser do CLI apesar de SQL válido | Validar com o CLI real em PostgreSQL descartável, conferir ledger e reproduzir o cenário do incidente F50.3; não usar banco isolado antigo sem revalidar. |
| Ativação acidental em produção durante deploy/teste | `individual_launch_at` só é gravado por RPC explícita; M1 não grava valor; teste/UAT só ativam em banco descartável com identidade revalidada; produção fica fora desta execução. |
| Vazamento do CNPJ completo em UI/log | Coluna restrita a `service_role`, nunca retornada ao cliente; exibições continuam com `maskCnpj`. |
| Remoção do `UNIQUE(root_hash)` reduzir proteção do legado | Índice único parcial `WHERE policy_cohort='root_legacy'` mantém a garantia para o legado. |

## Migration Plan

1. Autorar M1–M3 com `REVERT` comentado e pré-checagens fail-closed.
2. Validar SQL em PostgreSQL descartável e validar a aplicação pelo CLI Supabase real (versão em uso), incluindo ledger, constraints e parser.
3. Aplicar primeiro em ambiente isolado revalidado; nunca em produção nesta mudança.
4. Publicar código escuro; enquanto `individual_launch_at` for nulo, confirmar comportamento legado idêntico.
5. Executar UAT de regressão e, em banco descartável, ativar controladamente o marco para os cenários F50.4.
6. Parar para revisão humana. A ativação em produção (`individual_launch_at`) é uma operação posterior, fora desta mudança.

## Decisões fechadas e diferidas

**Fechadas nesta revisão:**

1. **Entitlement órfão (`store_id IS NULL`)**: mantém `prior_benefit_ambiguous` como bloqueio fail-closed, com motivo seguro e diagnóstico administrativo. A resolução é manual e futura; não há compensação, exceção ou atribuição automática.
2. **`admin_grant` com texto “onboarding”**: a classificação estruturada prevalece sobre texto livre. Continua crédito manual operacional, não bloqueia a F50.4 e não é reclassificado como `admin_exception` ou benefício anterior.

**Diferida (sem bloquear a base):**

3. **Data e procedimento da ativação em produção**: decisão operacional posterior. Este design apenas define que ela é única, auditada, posterior à publicação e separada da ativação controlada em banco descartável.
