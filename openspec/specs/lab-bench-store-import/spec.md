# Lab Bench Store Import

> Synced from `fase-48-2-3-fidelidade-experimental-bancada` (ADDED).

## Purpose

Define o comando local explícito de importação unidirecional da identidade das lojas de teste para a bancada: allowlist estrita de IDs, confirmação de loja de teste na origem, leitura remota somente-leitura, assets content-addressed, substituição transacional idempotente, proprietário local sintético, auditoria local e sanitização.

## Requirements

### Requirement: Importação por comando local explícito

O sistema SHALL disponibilizar a importação da identidade das lojas de teste **exclusivamente** por um comando local explícito (CLI), SHALL NOT oferecer botão de sincronização ou importação na aplicação e SHALL NOT consultar a origem remota durante o runtime normal da bancada. A origem remota SHALL ser acessada somente durante a execução do comando explícito de importação.

#### Scenario: Importação ocorre apenas por comando

- **WHEN** a identidade de uma loja de teste precisa ser materializada localmente
- **THEN** ela é importada por um comando local explícito
- **AND** a aplicação da bancada não oferece botão de importação ou sincronização

#### Scenario: Runtime não consulta a origem remota

- **WHEN** a bancada é usada normalmente (seleção de loja, branding, estimativa, geração)
- **THEN** nenhuma conexão à origem remota é aberta
- **AND** apenas o Supabase local é consultado

### Requirement: Somente IDs explícitos e confirmação de loja de teste

O comando SHALL aceitar **somente** os IDs de loja informados explicitamente pelo operador, SHALL NOT descobrir, listar ou importar lojas automaticamente e SHALL NOT oferecer uma opção de "importar todas". Para cada ID, o comando SHALL confirmar **na origem** que a loja é uma loja de teste (`is_test_store = true`) antes de qualquer cópia; um ID que não corresponda a uma loja de teste SHALL ser recusado. O contrato SHALL NOT depender da quantidade de lojas de teste existentes.

#### Scenario: ID implícito ou "importar todas" é recusado

- **WHEN** o operador não informa IDs explícitos ou tenta importar todas as lojas
- **THEN** o comando é recusado
- **AND** nenhuma leitura de identidade é executada

#### Scenario: Loja não marcada como teste é recusada

- **WHEN** um ID informado não corresponde a uma loja com `is_test_store = true` na origem
- **THEN** o comando recusa esse ID
- **AND** nenhuma identidade dessa loja é copiada

#### Scenario: Outras lojas de teste não são descobertas

- **WHEN** existem outras lojas marcadas como teste na origem além das informadas
- **THEN** elas não são descobertas nem importadas automaticamente

### Requirement: Origem somente-leitura e allowlist de tabelas e buckets

O comando SHALL ler da origem **somente** as tabelas `stores` (linhas de teste explicitadas), `store_brand_profiles`, `store_brand_assets` e `store_visual_signatures`, e **somente** os buckets `store-logos`, `store-brand-assets` e `visual-signatures`. O comando SHALL NOT ler nem gravar campanhas, imagens de campanha, produtos, ofertas, usuários reais, créditos, billing, histórico operacional ou logs produtivos. O comando SHALL NOT executar nenhuma escrita, atualização, exclusão ou promoção na origem.

#### Scenario: Allowlist de tabelas é respeitada

- **WHEN** o comando importa uma loja
- **THEN** apenas as tabelas de identidade/branding da allowlist são lidas na origem
- **AND** nenhuma tabela de campanha, crédito, billing ou log é lida

#### Scenario: Escrita no remoto é bloqueada

- **WHEN** o comando interage com a origem
- **THEN** apenas operações de leitura são executadas
- **AND** nenhuma escrita, atualização ou exclusão ocorre na origem

### Requirement: Importação apenas do estado atual, pelo comportamento produtivo

O comando SHALL importar **somente o estado atual** da identidade e do branding, importando **o único perfil `status='synced'`**, independentemente do `source`, **incluindo `text_only`**. **Ausência de perfil synced SHALL ser tratada como ausência de perfil**, preservando `stores.brand_color` e o fallback do segmento. Perfil **não sincronizado** SHALL NOT virar baseline em nenhuma hipótese. **Mais de um perfil synced SHALL ser tratado como estado ambíguo**, e a importação SHALL ser recusada com erro sanitizado. Não existe caminho normal de fallback `without_logo` quando não há synced. O comando SHALL registrar `profileSource` e `profileStatus` na evidência. O comando SHALL NOT importar histórico (por exemplo, `previous_identity_snapshot`), campanhas, runs, eventos de geração, créditos ou logs produtivos. A importação SHALL preservar localmente o `store.id` original.

#### Scenario: Perfil synced é importado (incluindo text_only)

- **WHEN** a loja possui um único perfil `status='synced'` (de qualquer `source`, inclusive `text_only`)
- **THEN** esse perfil é o importado
- **AND** um perfil não sincronizado não substitui o synced

#### Scenario: Ausência de perfil synced é ausência de perfil

- **WHEN** a loja não possui perfil `status='synced'`
- **THEN** nenhum perfil é importado
- **AND** `stores.brand_color` e o fallback de segmento permanecem aplicáveis
- **AND** nenhum perfil `without_logo` é usado como baseline

#### Scenario: Múltiplos perfis synced recusam a importação

- **WHEN** a origem retorna mais de um perfil `status='synced'`
- **THEN** a importação é recusada com erro sanitizado
- **AND** nenhuma identidade é materializada

#### Scenario: profileSource e profileStatus são registrados

- **WHEN** o perfil é importado
- **THEN** `profileSource` e `profileStatus` são registrados na evidência

#### Scenario: Apenas o estado atual é copiado

- **WHEN** a loja possui histórico de identidade ou branding
- **THEN** somente o estado atual é materializado localmente
- **AND** nenhum registro histórico é importado

#### Scenario: Identificador original é preservado

- **WHEN** a loja é materializada localmente
- **THEN** o `store.id` local é idêntico ao da origem

### Requirement: Cópia controlada dos assets atuais

O comando SHALL copiar para o storage **local** apenas os assets atuais necessários à identidade da loja, nos buckets locais `store-logos`, `store-brand-assets` e `visual-signatures`, gravando-os em **paths versionados/content-addressed** (por exemplo, derivados do checksum do conteúdo). O comando SHALL NOT sobrescrever objetos ainda referenciados pela identidade anterior. O comando SHALL NOT persistir URLs assinadas nem referências a buckets ou paths remotos. Nenhum objeto SHALL ser lido ou gravado em `campaign-images`.

#### Scenario: Assets atuais são copiados em paths versionados

- **WHEN** a loja possui logo, assinatura ou assets ativos
- **THEN** esses objetos são copiados para os buckets locais de branding em paths versionados/content-addressed
- **AND** nenhum objeto ainda referenciado pela identidade anterior é sobrescrito

#### Scenario: URLs assinadas não são persistidas

- **WHEN** a identidade local é gravada
- **THEN** nenhuma URL assinada ou token é persistido
- **AND** nenhum objeto é lido ou gravado em `campaign-images`

### Requirement: Proprietário local sintético por loja

Como `stores.user_id` é único, o comando SHALL criar, localmente, um **proprietário sintético** distinto para cada loja importada e associá-lo à loja local. O comando SHALL NOT copiar o usuário real, credenciais, perfil pessoal ou quaisquer dados pessoais. O administrador local da bancada SHALL continuar podendo acessar todas as lojas importadas.

#### Scenario: Proprietário sintético é criado

- **WHEN** uma loja é importada
- **THEN** um proprietário local sintético é criado para essa loja
- **AND** o `user_id` real da origem não é copiado

#### Scenario: Administrador local acessa as lojas importadas

- **WHEN** o administrador local abre a bancada
- **THEN** todas as lojas importadas estão acessíveis
- **AND** nenhum dado pessoal do usuário real é exposto

### Requirement: Substituição integral transacional e idempotente

Uma nova importação da mesma loja SHALL substituir integralmente sua identidade local, de forma **idempotente** e **transacional**. Os novos assets SHALL ser gravados em paths versionados/content-addressed e as referências SHALL ser trocadas em uma única transação; os objetos antigos sem referência SHALL ser removidos **somente após o commit**. Se a importação falhar **antes** da confirmação local, o comando SHALL remover **apenas** os objetos novos e preservar integralmente os anteriores. A operação SHALL ser **local-only**, auditável e segura contra escrita ou alteração acidental no remoto.

#### Scenario: Reimportação substitui integralmente

- **WHEN** a mesma loja é importada novamente
- **THEN** a identidade local anterior é substituída por completo
- **AND** nenhum resíduo da identidade anterior permanece referenciado

#### Scenario: Falha não deixa identidade parcial

- **WHEN** a importação falha antes da confirmação local
- **THEN** apenas os objetos novos são removidos
- **AND** a identidade local anterior permanece íntegra, sem referência a objeto ausente

#### Scenario: Operação é idempotente

- **WHEN** a mesma importação é executada novamente sem mudanças na origem
- **THEN** o resultado local é o mesmo (mesmos checksums e paths)
- **AND** nenhuma duplicação é criada

### Requirement: Auditoria e sanitização

O comando SHALL registrar localmente um resultado auditável da importação (loja, origem, momento, quantidade de assets e status) e SHALL sanitizar logs, URLs, tokens e secrets. O comando SHALL NOT imprimir nem persistir chaves de API, tokens ou URLs assinadas.

#### Scenario: Resultado é auditável

- **WHEN** a importação conclui
- **THEN** um registro local auditável é produzido
- **AND** o registro não contém secrets

#### Scenario: Logs são sanitizados

- **WHEN** o comando registra sua execução
- **THEN** chaves, tokens e URLs assinadas são omitidos ou mascarados

### Requirement: Importação não dispara geração nem chamadas pagas

O comando SHALL NOT iniciar geração, SHALL NOT chamar provedores de IA e SHALL NOT consumir créditos. Nenhuma chamada real de IA SHALL ocorrer durante a importação.

#### Scenario: Nenhuma chamada paga

- **WHEN** a importação é executada
- **THEN** nenhuma chamada a provedor de IA é realizada
- **AND** nenhum crédito é consumido

### Requirement: Fronteira de autorização da importação

Antes de qualquer autorização humana, o comando SHALL operar somente com fixtures, fakes ou `--dry-run` **completamente offline**. Qualquer execução que use URL ou credencial remota — **inclusive `--dry-run`** — SHALL exigir aprovação humana prévia. O `--dry-run` SHALL impedir materialização/escrita local, mas SHALL NOT prometer ausência de leitura remota.

#### Scenario: Sem autorização, apenas offline

- **WHEN** não há autorização humana
- **THEN** o comando usa somente fixtures/fakes ou `--dry-run` offline
- **AND** nenhuma conexão remota é aberta

#### Scenario: Execução com remoto exige aprovação

- **WHEN** a execução usa URL ou credencial remota, inclusive `--dry-run`
- **THEN** a aprovação humana prévia é exigida
- **AND** o `--dry-run` não é tratado como garantia de não-leitura remota
