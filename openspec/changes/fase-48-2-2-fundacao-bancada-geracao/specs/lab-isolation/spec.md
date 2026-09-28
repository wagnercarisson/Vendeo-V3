# Lab Isolation — delta (F48.2.2)

## ADDED Requirements

### Requirement: Acesso somente leitura a lojas e branding locais

A bancada SHALL acessar as tabelas de loja e branding (`stores`, `store_brand_profiles`, `store_brand_assets`, `store_visual_signatures`) **somente em leitura** e **somente no Supabase local**. A bancada SHALL NOT criar ou alterar linhas dessas tabelas, SHALL NOT sincronizar/importar lojas remotas e SHALL NOT ler ou gravar no bucket `campaign-images`. A leitura dos assets de branding SHALL ocorrer **somente** nos buckets locais `store-logos`, `store-brand-assets` e `visual-signatures`, **somente leitura** e **somente local**, por signer dedicado que nunca aceita bucket/path informado pelo cliente.

#### Scenario: Leitura de branding local é permitida e registrada

- **WHEN** a bancada carrega o branding de uma loja local
- **THEN** apenas operações de leitura ocorrem nas tabelas de loja/branding
- **AND** nenhuma linha é criada ou alterada

#### Scenario: Loja remota é recusada

- **WHEN** a seleção aponta para uma loja ausente do Supabase local
- **THEN** a operação é recusada
- **AND** nenhuma consulta remota é executada

#### Scenario: Bucket de imagens de campanha é proibido

- **WHEN** a bancada persiste entradas ou saída
- **THEN** nenhum objeto é lido ou gravado em `campaign-images`

#### Scenario: Bucket de branding fora da allowlist é recusado

- **WHEN** a bancada tenta assinar/ler um asset em bucket fora de `store-logos`/`store-brand-assets`/`visual-signatures`
- **THEN** a operação é recusada
- **AND** nenhum bucket produtivo é acessado

#### Scenario: Loja fora do manifesto é recusada antes da leitura

- **WHEN** um `storeId` fora do manifesto é usado em qualquer entrada
- **THEN** a operação é recusada antes de qualquer leitura de branding ou storage

### Requirement: DDL local da bancada fora da cadeia de migrations remotas

O DDL da bancada (`lab_bench_runs`, `lab_bench_artifacts`, RLS/grants, triggers e índice de geração ativa) SHALL viver **fora** de `supabase/migrations/` e SHALL ser aplicado por um bootstrap local da bancada, de modo que um `supabase db push` geral SHALL NOT carregar as tabelas da bancada ao remoto. O bootstrap local SHALL adicionar **somente** linhas de catálogo (`ai_model_catalog`) necessárias à validação local dos presets **também localmente**; o pricing SHALL existir **exclusivamente** em código (`src/lib/lab/bench/domain/bench-pricing.ts`), **sem tabela de pricing**; nada SHALL ser promovido ao remoto.

#### Scenario: Push remoto não carrega as tabelas da bancada

- **WHEN** um `supabase db push` geral é executado
- **THEN** as tabelas `lab_bench_runs` e `lab_bench_artifacts` não são criadas no remoto
- **AND** o bootstrap local é a única via de criação das tabelas da bancada

#### Scenario: Bootstrap local aplica o DDL

- **WHEN** o bootstrap local da bancada é executado em ambiente local
- **THEN** as tabelas da bancada são criadas apenas no Supabase local
- **AND** um bloco REVERT está disponível

### Requirement: Testes negativos de fronteira da bancada

O sistema SHALL incluir testes negativos que comprovem que a bancada não acessa banco, bucket ou provider remoto/produtivo e não consome créditos.

#### Scenario: Acesso produtivo faz o teste falhar

- **WHEN** um teste executa uma geração da bancada com fakes
- **THEN** apenas tabelas `lab_*`, as tabelas de loja/branding **em leitura** e o bucket `lab-artifacts` são acessados; a leitura de assets de branding é restrita a `store-logos`/`store-brand-assets`/`visual-signatures` (somente leitura, local)
- **AND** qualquer acesso a `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `admin_audit_log`, `credit_*` ou `campaign-images` faz o teste falhar

#### Scenario: Nenhuma chamada de rede real em testes

- **WHEN** a suíte de testes da bancada é executada
- **THEN** fakes de invocação e de telemetria são usados
- **AND** nenhuma requisição de rede a providers é realizada

#### Scenario: Bucket produtivo de branding faz o teste falhar

- **WHEN** um teste tenta assinar um asset de branding em bucket fora da allowlist, com traversal ou para loja fora do manifesto
- **THEN** o teste falha
- **AND** nenhuma chamada de rede real é realizada
