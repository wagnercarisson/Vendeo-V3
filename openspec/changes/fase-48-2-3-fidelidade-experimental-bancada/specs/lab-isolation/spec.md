# Lab Isolation — delta (F48.2.3)

## ADDED Requirements

### Requirement: Fronteira da importação remota

A importação da identidade das lojas de teste SHALL acessar a origem remota **somente** pelo comando local explícito, **somente em leitura** e **somente** nas tabelas `stores`/`store_brand_profiles`/`store_brand_assets`/`store_visual_signatures` e nos buckets `store-logos`/`store-brand-assets`/`visual-signatures`. O comando SHALL NOT executar escrita, atualização, exclusão ou promoção na origem. O runtime da bancada SHALL NOT acessar a origem remota.

#### Scenario: Escrita no remoto é bloqueada

- **WHEN** o comando de importação é executado
- **THEN** apenas leituras são feitas na origem
- **AND** nenhuma escrita, atualização ou exclusão ocorre no remoto

#### Scenario: Allowlist de origem é respeitada

- **WHEN** o comando importa uma loja
- **THEN** apenas tabelas e buckets da allowlist são acessados na origem
- **AND** nenhuma tabela produtiva de campanha, crédito, billing ou log é lida

#### Scenario: Runtime não toca o remoto

- **WHEN** a bancada é usada normalmente
- **THEN** nenhuma conexão à origem remota é aberta

### Requirement: Escrita local permitida apenas ao comando de importação

O runtime da bancada SHALL permanecer **somente leitura** nas tabelas de loja/branding e nos buckets de branding locais. A escrita local nessas tabelas e buckets SHALL ocorrer **exclusivamente** pelo comando de importação, **local-only**, transacional e idempotente.

#### Scenario: Runtime permanece somente leitura

- **WHEN** a bancada carrega branding ou gera uma imagem
- **THEN** nenhuma linha de loja/branding e nenhum objeto de branding são gravados pelo runtime

#### Scenario: Importação escreve apenas localmente

- **WHEN** a identidade é materializada
- **THEN** as escritas ocorrem apenas no Supabase e no storage local
- **AND** a origem remota permanece intocada

### Requirement: Ausência de persistência de URLs assinadas e sanitização

A importação SHALL NOT persistir URLs assinadas, tokens ou secrets em banco, storage, logs ou artefatos, e SHALL sanitizar logs e erros. Nenhuma chamada real de IA SHALL ocorrer durante a importação.

#### Scenario: Nenhuma URL assinada persistida

- **WHEN** a identidade local é gravada
- **THEN** nenhuma URL assinada ou token é persistido

#### Scenario: Nenhuma chamada de IA na importação

- **WHEN** o comando de importação é executado
- **THEN** nenhuma chamada a provedor de IA é realizada
- **AND** nenhum crédito é consumido

### Requirement: Testes negativos da importação

O sistema SHALL incluir testes negativos que comprovem que a importação não escreve no remoto, não importa loja não marcada como teste, não aceita IDs implícitos ou descoberta ampla, não importa campanhas, usuários reais, créditos ou histórico, e não persiste URLs assinadas.

#### Scenario: Escrita remota faz o teste falhar

- **WHEN** um teste executa a importação com fakes
- **THEN** qualquer tentativa de escrita no remoto faz o teste falhar

#### Scenario: Loja não-teste faz o teste falhar

- **WHEN** um teste importa um ID que não é loja de teste
- **THEN** a importação é recusada
- **AND** nenhuma identidade é copiada

### Requirement: Contexto experimental restrito ao conteúdo gerado

A ausência de contexto de laboratório, experimento, baseline, comparação de variantes ou avaliação SHALL ser verificada sobre o **conteúdo gerado pelo compositor** (blocos estruturados), e SHALL NOT ser imposta como blacklist lexical ao prompt-base manual do operador. O prompt-base SHALL ser preservado integralmente e a aprovação humana responde pelo texto final.

#### Scenario: Verificação por origem, não blacklist

- **WHEN** o prompt compilado é avaliado
- **THEN** a verificação de contexto experimental incide sobre os blocos gerados pelo compositor
- **AND** o prompt-base do operador não é filtrado por palavras

#### Scenario: Prompt-base com palavras legítimas é preservado

- **WHEN** o operador usa "teste", "comparação" ou "avaliação" no prompt-base
- **THEN** o prompt-base é preservado integralmente
- **AND** nenhuma reescrita ou filtragem é aplicada
