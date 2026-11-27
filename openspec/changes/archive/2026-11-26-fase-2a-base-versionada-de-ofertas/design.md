## Context

A oferta de teste atual é operada por `trial_offer_settings` (chave `enabled`, marcos de lançamento) e `trial_offer_enrollments` (concessão por loja/beneficiário). As condições, porém, estão fixas em código: `interval '28 days'`, parcelas `seq 0..3`, intervalo de 7 dias, `+5` créditos e teto 20. O TypeScript repete os mesmos números em `constants.ts`, `status.ts` e na copy pública.

O alinhamento de produto (`docs/alinhamento-onboarding-responsavel-cnpj-opcional.md`) definiu que a oferta deve ser versionada e que a concessão deve preservar as condições adquiridas. A decisão final desta conversa refinou o desenho:

- a oferta vigente é resolvida **no momento da concessão**;
- a concessão registra uma **referência à versão imutável**;
- **não** há reserva antecipada de parcelas;
- **não** há duplicação integral das condições na concessão;
- a 2A entrega catálogo, oferta inicial, referência vigente e contratos de leitura, **sem** atualizar concessões existentes.

Esta change é a base da subfatia 2A. A integração dos consumidores e o vínculo das concessões pertencem à fatia 4; a transição real dos dados pertence ao roteiro final.

## Goals / Non-Goals

**Goals:**

- Representar condições de oferta como uma versão publicada e imutável.
- Representar frequência (`once`, `daily`, `weekly`, `monthly`) e créditos por liberação, sem tabela filha de parcelas.
- Derivar calendário a partir dos parâmetros e do início da concessão, com primeira liberação imediata e última limitada ao restante.
- Manter `current_version_id` em `trial_offer_settings`, aceitando apenas versão publicada do mesmo programa.
- Garantir no banco imutabilidade, validação de publicação e consistência sob concorrência.
- Oferecer leitura centralizada interna e projeção pública sem identificadores internos nem dados pessoais.
- Semear a versão inicial 28 dias / 20 créditos / semanal / 5 por liberação.
- Preservar integralmente consumidores, concessões, créditos, entitlements e páginas atuais.

**Non-Goals:**

- Não alterar `trial_offer_enrollments` nem preencher `offer_version_id` em concessões existentes.
- Não alterar RPCs de elegibilidade, início, parcelas ou processamento em lote.
- Não religar `constants.ts`, `status.ts`, `completion.ts`, copy pública, landing ou Admin.
- Não construir painel de edição/publicação do Admin.
- Não reservar parcelas futuras nem criar transações de crédito.
- Não aplicar migrations em produção nem em qualquer banco remoto; o homolog local existente é o único alvo de aplicação e validação desta subfatia.
- Não migrar usuários existentes nem ativar novas regras de concessão.
- Não criar tabela de ofertas separada; `offer_key` de `trial_offer_settings` é a identidade estável.

## Decisions

### 1. Identidade da oferta reutiliza `trial_offer_settings.offer_key`

`trial_offer_versions.offer_key` referencia `trial_offer_settings(offer_key)`. Não criamos `trial_offers` nesta entrega: a tabela de configuração já é singleton por programa e `offer_key` é a identidade estável. Isso evita uma tabela redundante e um ciclo de FKs.

- **Alternativa descartada:** criar `trial_offers` apenas para guardar a identidade. Não agrega valor enquanto houver um único programa.

### 2. Condições na versão: frequência e créditos por liberação

```text
trial_offer_versions
  id uuid pk
  offer_key text not null -> trial_offer_settings(offer_key)
  version_label text not null
  public_name text not null
  duration_days integer not null check (> 0)
  max_total_credits integer not null check (> 0)
  release_frequency text not null check in ('once','daily','weekly','monthly')
  credits_per_release integer
  published_at timestamptz
  published_by uuid -> auth.users(id) on delete set null
  publication_reason text
  created_by uuid -> auth.users(id) on delete set null
  created_at timestamptz not null default now()
  unique (offer_key, version_label)
  unique (id, offer_key)
```

Regras de consistência:

- `release_frequency = 'once'` ⇒ `credits_per_release IS NULL`; a única liberação usa `max_total_credits`.
- frequências recorrentes ⇒ `credits_per_release IS NOT NULL`, positivo e `<= max_total_credits`.
- `duration_days` e `max_total_credits` positivos.
- Nenhuma tabela filha ou JSON de parcelas: o calendário é derivado.

- **Alternativa descartada:** `trial_offer_version_installments(day_offset, amount)`. Representa bem a oferta semanal, mas não a mensal, porque a distância entre meses varia. Também antecipa uma estrutura que o Admin não precisa preencher.
- **Alternativa descartada:** JSON de parcelas. Mesmo problema de representação e menor integridade.

### 3. Derivação do calendário

A derivação é uma leitura pura, sem reserva e sem escrita. Toda versão publicada MUST alcançar `max_total_credits` dentro de `duration_days` para qualquer data de início válida; configurações que não alcançam o total são rejeitadas na publicação (decisão 4).

- `once`: uma liberação em `started_at`, valor `max_total_credits`.
- recorrente:
  - `seq = 0` em `started_at`;
  - `seq = n` em `started_at + n dias` (`daily`), `+ 7n dias` (`weekly`) ou `+ n meses de calendário` (`monthly`);
  - valor da liberação = `LEAST(credits_per_release, max_total_credits - já liberado)`;
  - o calendário termina ao atingir `max_total_credits`;
  - todas as liberações devem ocorrer antes de `started_at + duration_days`.
- O total efetivamente concedido dentro da janela é `max_total_credits`; não há truncamento tolerado. A última liberação pode ser menor que `credits_per_release` (ex.: total 20, 7 por liberação ⇒ 7, 7, 6), mas o total é sempre alcançado.
- A validação de publicação calcula a quantidade necessária de liberações (`ceil(max_total_credits / credits_per_release)`; `1` em `once`) e exige que a última liberação caia estritamente antes de `duration_days`. Para `monthly`, usa o intervalo máximo conservador de 31 dias entre liberações, garantindo que nenhuma data de início provoque truncamento.
- A versão inicial `weekly/5/20/28` produz exatamente 5 nos dias 0, 7, 14 e 21, total 20.
- `monthly` usa mês de calendário (`make_interval(months => n)`), não 30 dias fixos.
- A função de calendário fixa `TimeZone = 'UTC'` na própria definição (`SET TimeZone = 'UTC'`), de modo que `make_interval(months => n)`, a aritmética de dias e a serialização de `timestamptz` não dependam do TimeZone da sessão. O mesmo `started_at` produz `expires_at`/`due_at` idênticos sob `UTC`, `America/Sao_Paulo` e `Asia/Tokyo`.

O calendário é exposto por função SQL de leitura (`trial_offer_release_schedule(version_id, started_at)`), `STABLE SECURITY DEFINER`, `search_path = ''` e `TimeZone = 'UTC'`, e usado nos testes. Nenhum consumidor é religado nesta subfatia.

### 4. Publicação e imutabilidade

`published_at IS NOT NULL` é o único marcador de versão publicada. Não há coluna `status` paralela.

Triggers `BEFORE INSERT OR UPDATE` em `trial_offer_versions` cobrem tanto a inserção direta de versão já publicada (como no seed) quanto a publicação posterior de um rascunho:

- **inserção como rascunho (`NEW.published_at IS NULL`)**:
  - valida a consistência básica dos campos;
  - exige `published_by IS NULL` (autoria só existe com publicação);
  - mantém a versão editável e não referenciável como vigente.
- **inserção já publicada (`NEW.published_at IS NOT NULL`)**:
  - exige `publication_reason` não vazio;
  - valida a consistência dos campos, incluindo frequência × créditos por liberação;
  - valida que o calendário derivado alcança `max_total_credits` dentro de `duration_days`;
  - aceita `published_by` NULL ou UUID (sem rejeição de autoria no insert);
  - grava a versão já congelada.
- **atualização de rascunho (`OLD.published_at IS NULL`)**:
  - permite editar condições;
  - exige `published_by IS NULL` enquanto rascunho (definir/alterar levanta `trial_offer_publisher_requires_publication`);
  - permite a transição única `published_at NULL → NOT NULL` (publicação), aplicando as mesmas validações da inserção publicada e permitindo `published_by` NULL → UUID (ou permanecer NULL);
  - nunca permite alterar `offer_key`, `version_label` ou `id`.
- **atualização de versão publicada (`OLD.published_at IS NOT NULL`)**:
  - congela `id`, `offer_key`, `version_label`, `public_name`, `duration_days`, `max_total_credits`, `release_frequency`, `credits_per_release`, `published_at`, `publication_reason`, `created_at`;
  - rejeita qualquer alteração de condições ou “despublicação”;
  - permite `published_by` apenas transicionar de UUID → NULL (ação referencial); UUID → outro UUID é rejeitado.

A Migration A já aplicada (`20261126223854`) não pode ser editada nem reaplicada. O defeito conhecido do guard nela (não permitir `published_by` na primeira publicação) é corrigido por uma Migration C forward-only, que apenas substitui `public.trial_offer_versions_guard()`, com REVOKE/GRANT e REVERT comentado.

Trigger `BEFORE DELETE`:

- versão publicada não pode ser excluída;
- rascunho pode ser excluído;
- versão referenciada por `current_version_id` é protegida também pela FK `ON DELETE RESTRICT`.

### 5. Metadados de autoria versus imutabilidade

`created_by` e `published_by` usam `ON DELETE SET NULL`. A exclusão de um usuário autenticado dispara um `UPDATE` na versão; bloquear **qualquer** update tornaria a exclusão impossível.

Política explícita, sem enfraquecer as condições:

- o trigger de imutabilidade compara todo o conjunto de condições e o estado de publicação;
- `created_by` pode mudar **somente** para `NULL` por ação referencial em qualquer estágio;
- `published_by` é NULL em rascunho; na primeira publicação (INSERT já publicado ou UPDATE rascunho→publicado) pode ser NULL ou UUID; depois de publicado, só pode transicionar UUID → NULL por ação referencial;
- a Migration C forward-only implementa explicitamente essas transições, sem editar a Migration A já aplicada;
- qualquer outra diferença é rejeitada;
- a alteração de autoria para `NULL` não modifica condições, calendário, publicação ou motivo.

- **Alternativa descartada:** remover a FK e guardar o UUID sem integridade referencial. Perde a ligação com `auth.users` e dificulta a leitura administrativa.
- **Alternativa descartada:** detectar cascata por `pg_trigger_depth()`. Frágil e dependente de detalhe de implementação.

### 6. Vigência garantida no banco

`trial_offer_settings.current_version_id` é `NULL` apenas durante a criação da estrutura; após o seed é `NOT NULL`.

Duas garantias complementares:

1. **Mesmo programa:** FK composta `(current_version_id, offer_key) → trial_offer_versions(id, offer_key)`.
2. **Versão publicada:** trigger `BEFORE INSERT/UPDATE` em `trial_offer_settings` verifica `published_at IS NOT NULL` da versão apontada. A FK sozinha não garante publicação.

Como versões publicadas não podem ser despublicadas nem excluídas, a verificação não tem corrida com o ciclo de vida da versão.

`enabled` permanece independente: desligar novas adesões não limpa `current_version_id`, não cancela concessões e não altera versões. Divulgação lê a vigente independentemente de `enabled`.

### 7. Publicação concorrente

A publicação por atualização incide sobre a própria linha da versão, portanto a linha é travada pelo `UPDATE`. O trigger de validação roda na mesma instrução, sobre o estado já travado. A inserção direta de versão publicada é validada na própria instrução de `INSERT`.

Cenários:

- **edição concorrente com publicação:** se a edição commitar primeiro, a publicação valida e congela o estado novo; se a publicação commitar primeiro, a edição seguinte encontra `OLD.published_at IS NOT NULL` e é rejeitada.
- **duas publicações simultâneas:** apenas uma consegue a transição `NULL → NOT NULL`; a segunda encontra a versão já publicada e falha.
- **troca de vigência concorrente:** a linha de `trial_offer_settings` é o ponto de serialização. Uma futura RPC administrativa deve travar essa linha (`FOR UPDATE`) e publicar/apontar na mesma transação. Duas trocas simultâneas resultam em uma vencedora; ambas as versões permanecem publicadas e imutáveis.
- **seed:** é uma transação única de migration, com validação fail-closed.

Nesta subfatia não há RPC de publicação nem painel; as garantias ficam no esquema e nos triggers, prontas para a integração.

### 8. Sem backfill e sem alteração de concessões na 2A

`trial_offer_enrollments` **não é alterada** nesta subfatia. Nenhuma concessão existente recebe `offer_version_id`. O caminho atual continua criando inscrições sem referência, como hoje.

O contrato futuro (fatia 4) será:

- adicionar `offer_version_id` nullable + FK composta com `offer_key`;
- no ato da concessão, resolver `current_version_id` e gravar a referência na mesma transação;
- exigir versão publicada por trigger;
- manter `started_at` como marco de aquisição e `expires_at` como borda da janela adquirida;
- não copiar duração, total, frequência ou calendário para a concessão;
- desenhar o vínculo e ensaiar em homologação; a aplicação real em dados existentes segue o roteiro final de transição.

- **Alternativa descartada:** backfill imediato. Anteciparia a transição, alteraria dados da base atual e não encerraria o assunto, porque o caminho antigo continuaria inserindo sem referência.

### 9. Contratos de leitura

Contratos de função explícitos: o helper interno `trial_offer_calendar_reaches_total(...)` é `LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = ''`; as três funções de leitura são `STABLE SECURITY DEFINER SET search_path = ''`; `trial_offer_release_schedule` acrescenta `SET TimeZone = 'UTC'`. Todas são executáveis apenas por `service_role` (o helper inclusive, porque o trigger de versão o chama sob `service_role`).

0. `trial_offer_calendar_reaches_total(p_release_frequency text, p_credits_per_release integer, p_max_total_credits integer, p_duration_days integer) returns boolean`
   - `LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = ''`; sem `SECURITY DEFINER`;
   - valida se o calendário alcança `max_total_credits` dentro de `duration_days` para qualquer início;
   - EXECUTE revogado de PUBLIC/anon/authenticated e concedido apenas a `service_role`.

1. `trial_offer_conditions(p_version_id uuid default null) returns jsonb` — `STABLE SECURITY DEFINER SET search_path = ''`
   - `null` resolve a versão vigente;
   - retorna `offer_key`, `version_id`, `version_label`, `public_name`, `duration_days`, `max_total_credits`, `release_frequency`, `credits_per_release`, `published_at`;
   - falha fechada se a versão não existir, não estiver publicada ou não houver vigente.
2. `trial_offer_public_offer() returns jsonb` — `STABLE SECURITY DEFINER SET search_path = ''`
   - projeção pública da vigente: `version_label`, `public_name`, `duration_days`, `max_total_credits`, `release_frequency`, `credits_per_release`;
   - sem contagem efetiva de liberações: a quantidade concreta depende de `started_at` (especialmente em `monthly`) e pertence apenas à leitura de calendário;
   - sem UUIDs, sem auditoria, sem `offer_key` interno, sem dados de concessão ou pessoais;
   - independente de `enabled`.
3. `trial_offer_release_schedule(p_version_id uuid, p_started_at timestamptz) returns jsonb` — `STABLE SECURITY DEFINER SET search_path = '' SET TimeZone = 'UTC'`
   - aplica as regras da decisão 3;
   - retorna `expires_at`, `releases[{seq, due_at, amount}]` e `total`;
   - é leitura pura: não reserva, não grava, não cria transações;
   - o TimeZone fixo na função garante resultados idênticos sob qualquer TimeZone de sessão.

Módulo TypeScript `src/lib/credit/trial-offer/offer.ts` (`server-only`):

- tipos das condições e das liberações;
- `readCurrentTrialOffer()`, `readTrialOfferConditions(versionId)`, `readTrialOfferSchedule(versionId, startedAt)`;
- `readTrialOfferSchedule` resolve o cliente uma única vez (injetado ou lazy) e reutiliza o mesmo cliente nas RPCs de condições e calendário, inclusive no caminho sem cliente informado;
- mapeamento defensivo e falha fechada;
- nenhuma alteração em módulos existentes.

### 10. Seed inicial

Uma migration de dados publica a versão v1:

- `offer_key = 'trial_28d_v1'`;
- `version_label = 'v1'`;
- `public_name = 'Teste gratuito de 28 dias'`;
- `duration_days = 28`;
- `max_total_credits = 20`;
- `release_frequency = 'weekly'`;
- `credits_per_release = 5`;
- `published_at = now()`, `publication_reason = 'publicação inicial da oferta vigente'`;
- `current_version_id = v1` em `trial_offer_settings`.

Validação fail-closed do seed:

- calendário derivado = 5 nos dias 0, 7, 14 e 21;
- total = 20, igual a `max_total_credits`;
- `current_version_id` aponta para versão publicada do mesmo programa;
- nenhuma linha de `trial_offer_enrollments`, crédito ou entitlement é tocada.

### 11. Consumidores permanecem inalterados

Nesta subfatia não mudam:

- `src/lib/credit/trial-offer/constants.ts`, `status.ts`, `completion.ts`;
- `src/components/landing/public-offer-copy.ts` e páginas públicas;
- painel `admin/feature-flags`;
- `trial_offer_eligibility`, `start_trial_offer_enrollment`, `grant_trial_offer_installment`, `process_trial_offer_installments`;
- `credit_balances`, `credit_transactions`, `freemium_entitlements`.

A integração e a troca de fonte dos números pertencem à fatia 4 (concessão/parcelas) e à fatia 6 (divulgação/onboarding), conforme o alinhamento.

### 12. Reconciliação com o documento de alinhamento

O documento registra “Concessão: conta, referência protegida do CPF, versão e cópia das condições adquiridas”. A decisão final desta conversa substitui “cópia das condições adquiridas” por **referência à versão imutável**, sem reserva antecipada e sem duplicação integral. O design e a spec desta change registram essa reconciliação; a atualização editorial do documento fica para a etapa de documentação da implementação, sem alterar o escopo técnico.

## Risks / Trade-offs

- **Oferta mensal × duração:** exigir que o calendário alcance o total pode rejeitar combinações mensais que pareçam válidas em uma data específica. → A validação é conservadora e explícita (intervalo máximo de 31 dias por mês), garantindo o total para qualquer início; o Admin futuro ajusta duração, total ou frequência em vez de publicar oferta que nunca entrega o total.
- **Rascunho publicado por engano:** a transição é única e auditada por motivo/autor; versões publicadas não podem ser editadas nem excluídas. → Correção é publicar uma nova versão e repontar a vigente.
- **Exclusão de usuário × imutabilidade:** o `SET NULL` em autoria é a única exceção permitida. → O trigger compara todo o conjunto de condições; `created_by` aceita apenas →NULL; `published_by` é definido na primeira publicação e depois aceita apenas →NULL; a Migration C corrige forward-only o guard da A.
- **Duas fontes temporárias (constantes legadas × catálogo):** enquanto os consumidores não migram, os números podem divergir se alguém editar só um lado. → Teste de contrato compara o seed v1 com as constantes atuais; a integração é explicitamente da fatia 4.
- **Leitura pública sem vigente publicada:** falha fechada. → Nenhuma página é religada na 2A; quando for, o erro é tratado na camada de apresentação.
- **FK composta e `NOT NULL` após o seed:** a ordem das migrations importa. → Estrutura primeiro (coluna nullable), seed/backfill de configuração depois, `NOT NULL` só quando a linha vigente existe.

## Migration Plan

1. **Migration A — estrutura** (`20261126223854_offer_catalog_versions.sql`, já aplicada; NÃO editar/reaplicar):
   - cria `trial_offer_versions`, checks, unicidades, triggers de imutabilidade/publicação;
   - adiciona `trial_offer_settings.current_version_id` nullable, FK composta e trigger de versão publicada;
   - cria o helper `trial_offer_calendar_reaches_total` (`IMMUTABLE SECURITY INVOKER`, `search_path=''`) e as três funções de leitura (`STABLE SECURITY DEFINER`, `search_path=''`; schedule com `TimeZone='UTC'`), habilita RLS em `trial_offer_versions` com políticas explícitas (sem leitura pública direta) e revoga grants amplos, mantendo a execução de todas restrita a `service_role`;
   - inclui bloco `-- REVERT` comentado.
2. **Migration B — seed e vigência** (`YYYYMMDDHHmmss_offer_catalog_seed_v1.sql`):
   - insere a versão v1 publicada;
   - valida o calendário derivado e o total;
   - define `current_version_id` e torna a coluna `NOT NULL`;
   - confirma que nenhuma concessão/crédito/entitlement foi tocado;
   - inclui bloco `-- REVERT` comentado.
3. **Migration C — correção forward-only do publisher** (`YYYYMMDDHHmmss_offer_catalog_published_by_fix.sql`, depois de B):
   - apenas `CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()`, reaplicando REVOKE/GRANT service_role-only e REVERT comentado;
   - corrige a primeira publicação: rascunho exige `published_by IS NULL`; INSERT publicado aceita NULL/UUID; UPDATE rascunho→publicado aceita NULL→UUID; publicado só permite `published_by`→NULL; `created_by` só→NULL;
   - não altera tabela, dados, constraints, outras funções ou grants de tabela;
   - a Migration A `20261126223854` permanece intacta; o defeito é corrigido apenas por C.

Cada migration é aplicada em transação própria e com stage explícito: A `post-a`, B `post-b`, C `post-c`. O aplicador exige `--stage <post-a|post-b|post-c>` no apply real, imprime o stage no dry-run e grava `stage` na evidência; o relatório de preservação aceita `post-a|post-b|post-c|post-tests` com deltas de ledger 1/2/3/3. Antes de criar os arquivos, gerar timestamps UTC reais e verificar unicidade dos três prefixos no worktree, na branch de integração e em branches paralelas conhecidas. Nenhuma migration é aplicada em produção. Falha faz rollback, exige diagnóstico e ajuste antes de prosseguir.

A contingência da 2A preserva o comportamento existente: **não altera `enabled`**, não suspende adesões do sistema atual e não muda consumidores. O rollback estrutural remove os objetos novos apenas enquanto nenhuma versão publicada estiver referenciada por dados futuros; depois disso, a correção é publicar uma nova versão e repontar a vigência. Suspensão comercial da oferta é decisão operacional separada, fora desta subfatia.

### Ambiente de validação de banco (homolog local existente)

- **Workdir:** `G:\Vendeo-Homolog`.
- **Container:** `supabase_db_vendeo-homolog`.
- **PostgreSQL:** `127.0.0.1:57782`, banco `postgres`.
- Antes de qualquer escrita, confirmar identidade e estado atual: container em execução, porta/banco, versão do servidor, migrations/ledger aplicados, existência de `trial_offer_settings`/`trial_offer_enrollments` e contagens das tabelas preservadas.
- **Não criar outro banco, não executar `db reset` e não exigir backup** como condição desta subfatia. O ambiente é exclusivo de testes.
- Aplicar as migrations de forma incremental, cada uma em transação própria (por exemplo, `psql --single-transaction -f`), sem `db reset`. Em falha: rollback, identificação da causa, ajuste e nova aplicação antes de avançar.
- Usar o homolog para validar aplicação real de constraints, triggers, permissões, calendário e concorrência; mocks e inspeção estática não são evidência suficiente.
- Capturar contagens e checksums de `trial_offer_enrollments`, `credit_balances`, `credit_transactions` e `freemium_entitlements` antes e depois. Separar explicitamente os efeitos esperados da migration (nova coluna/referência e nova linha de versão) dos dados criados pelos próprios testes.
- Produção permanece fora desta autorização. Após a validação no homolog, a conferência de estruturas, migrations e permissões remotas necessárias é uma etapa separada.
- Declarar que essa validação é salvaguarda de homolog e não equivale a aprovação de produção.

## Open Questions

Nenhuma pendente para a 2A. Permanecem para as fatias seguintes, sem bloquear esta entrega:

- desenho da RPC/painel de publicação e edição pelo Admin;
- integração da concessão e backfill dos dados existentes, com ensaio em homologação;
- apresentação pública de ofertas mensais sem contagem fixa de liberações, que passa a ser derivada apenas quando houver `started_at`.
