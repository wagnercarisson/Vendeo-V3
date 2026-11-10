## Context

A F60 encerrou o controle da operação 9:16 em duas etapas. O que falta é a camada que guarda e devolve os artefatos dessa composição. Esta fatia (60.1) prepara um módulo independente, reutilizável por orquestrações futuras, sem reabrir a F60 e sem alterar o fluxo 1:1 atual.

### Diagnóstico das estruturas existentes

| Estrutura | O que já resolve | Limitação real para a 60.1 |
|---|---|---|
| `public.product_1_1_campaign_artifacts` | Registro imutável por `(campaign_id, operation_id)`, caminho único, dimensões e MIME, `service_role` apenas | Não tem `store_id`, bytes, checksum, papel (`original`/`preparado`/`vertical`) nem proveniência. A unicidade `(campaign_id, operation_id)` impede guardar mais de um artefato na mesma operação — exatamente o caso base + preparação + vertical. |
| Bucket `campaign-images` | Bucket privado, upload imutável, usado pelo 1:1 e pelo vertical | Possui policy `owner_select_campaign_images` que permite ao lojista autenticado ler **qualquer** objeto sob o prefixo da própria loja. Um artefato interno gravado ali ficaria legível ao lojista, mesmo sem entrega. Nome de path não é fronteira de autorização; `service_role` ignora RLS, então ausência de policy não garante imutabilidade. |
| Bucket `lab-artifacts` | Precedente de bucket privado com policy exclusiva de `service_role` | É o bucket do laboratório; reutilizá-lo para artefatos produtivos mistura bounded contexts. Serve como referência de desenho, não como destino. |
| `campaigns.storage_path` + `campaign_art_versions` | Caminho canônico da arte 1:1 já projetada; o approve reponta `campaigns.storage_path` para a versão aprovada | Não guarda checksum/bytes; a arte legada é 1080×1080 JPEG e a do novo fluxo 1:1 é 1024×1024 JPEG. É fonte somente leitura, precisa de sonda por conteúdo. |
| `src/lib/product-1-1/artifact/**` | Path determinístico, upload `upsert:false`, probe tipado, verificação por decode completo | Acoplado ao 1:1 e à tabela existente; não deve ser refatorado nesta fatia. Padrões são reutilizáveis, o store não. |
| `src/lib/product-vertical-9-16/artifact/**` | Path vertical, probe, verificação 1080×1920 | Acoplado ao 9:16 direto e à mesma tabela; não cobre papéis nem múltiplos artefatos por operação. |
| `src/lib/lab/bench/persistence/bench-artifact-service.ts` | Checksum SHA-256, bytes reais, upload sem sobrescrita, tratamento de conflito | É do laboratório; o padrão é útil, a tabela/bucket não. |
| `src/lib/campaign/format-resolution.ts` | Fonte de verdade 1:1/9:16, fail-closed | Reutilizável para decidir se uma campanha é quadrada. |
| `product_9_16_two_stage_*` e `product_1_1_campaign_credit_operations` | Identidade `(campaign_id, operation_id)` e vínculo com loja | Não existe um registro universal de operação. A operação de crédito é financeira; a de duas etapas é específica. A 60.1 não deve inventar uma tabela universal nem acoplar-se a uma delas. |

### Restrições

- Nenhum código, migration, escrita em banco, deploy, merge, push, flag ou chamada paga nesta rodada.
- O fluxo 1:1 atual, o 9:16 direto da F59 e o controle da F60 permanecem com o mesmo contrato.
- Legado não é migrado, renomeado ou reclassificado automaticamente.
- Persistência não é entrega: o módulo não compra, cobra, libera download, assina URL nem projeta entrega.
- Nenhuma exclusão automática (TTL, purge ou limpeza) nesta fatia.

## Goals / Non-Goals

**Goals:**

- Persistir artefatos de composição com identidade `(store, campaign, operation, role)` e vínculo validado server-side.
- Distinguir `square_original`, `square_prepared` e `vertical`, com dimensões, MIME e decodificação completa por papel.
- Guardar bytes, checksum SHA-256 e proveniência derivados dos bytes gravados.
- Garantir idempotência por identidade, conteúdo e proveniência, com recusa explícita de conflito de conteúdo, identidade, metadados ou proveniência, inclusive sob corrida de upload.
- Recuperar e validar artefatos server-side com resultado tipado, sem confundir ausência com erro de Storage, exigindo autorização em toda leitura/escrita.
- Manter artefatos internos privados para `anon`/`authenticated`, separando essa privacidade da imutabilidade da linha e da não sobrescrita do objeto.
- Separar fonte de campanha já entregue de base interna; reconhecer a base interna mesmo com campanha vertical em processamento, sem escrever no legado.
- Provar offline, com o decodificador real, rejeição de bytes truncados e dimensões incorretas, sem rede, banco ou IA.
- Deixar a biblioteca pronta para orquestradores futuros, sem criar nenhum orquestrador agora.

**Non-Goals:**

- Gerar copy ou imagem; redimensionar 1024→1152; expandir por IA; compor prompt.
- Reservar, confirmar, estornar ou comprar créditos; autorizar entrega por formato.
- Criar UI, seletor, download público, duas versões ou apresentação.
- Criar orquestrador universal, orquestradores futuros, rotas, flags ou ativação.
- Alterar `product_1_1_campaign_artifacts`, `campaign-images`, `campaigns`, `campaign_art_versions` ou os stores 1:1/vertical existentes.
- Migrar, renomear, copiar ou reclassificar artefatos legados.
- TTL, purge, limpeza, cron, fila ou worker.

## Architecture

### Módulo

Biblioteca em `src/lib/campaign/composition-artifacts/**`, sem rota e sem UI:

- **Contratos puros** (sem `server-only`, sem I/O): papéis, formatos, identidade, política de dimensão, builder/parser de path, uniões de resultado, códigos de conflito e regras puras de classificação.
- **Server-only**: persistência, leitura, verificação por conteúdo, checksum, resolução de fonte e adaptação ao cliente Supabase.
- **Dependências injetáveis**: cliente Supabase e relógio/IDs quando necessário. O decodificador de imagem real é usado nos testes de integridade com fixtures determinísticas; a decodificação não é simulada nos testes que precisam provar rejeição de JPEG truncado ou dimensão incorreta.

O módulo não conhece crédito, entrega, aprovação, UI ou orquestração. Ele recebe bytes e identidade, devolve metadados/resultado tipado.

### Contratos de entrada e saída

**Identidade**

```
ArtifactIdentity = {
  storeId: UUID
  campaignId: UUID
  operationId: UUID
  role: "square_original" | "square_prepared" | "vertical"
}
```

**Persistência**

```
PersistArtifactInput = {
  identity: ArtifactIdentity
  authorization: AuthorizationContext
  bytes: Buffer
  origin: "provider_generation" | "deterministic_preparation" | "ai_expansion"
  source:
    | { kind: "none" }
    | { kind: "internal_artifact"; artifactId: UUID }
    | { kind: "delivered_campaign_source"; descriptor: ReusableSquareSource }
  sourceCampaignId?: UUID | null
  provenance?: Record<string, unknown>  // allowlist server-side
}
```

`source` é obrigatório para `deterministic_preparation` e `ai_expansion`: o módulo revalida a origem server-side (linha/bytes/checksum do artefato interno ou descritor de campanha entregue) antes de persistir o derivado. `source.delivered_campaign_source.descriptor` SHALL ter `origin: "legacy_campaign" | "new_flow_1_1"` e exigir `sourceCampaignId`; a revalidação é específica por origem (legado 1080×1080/path legado; novo fluxo 1:1 1024×1024/path `product-1-1`). `source.internal_artifact` referencia a linha interna por `artifactId`. `source: none` é o caso de `provider_generation`.

Resultado discriminado: `created`, `reused`, `content_conflict`, `identity_conflict`, `metadata_conflict`, `provenance_conflict`, `invalid_input`, `integrity_failure`, `persistence_failure`. Conflitos carregam o registro existente (server-only), sem sobrescrever nada.

**Recuperação**

```
RetrieveArtifactInput = {
  identity: ArtifactIdentity
  authorization: AuthorizationContext
}

RetrieveArtifactResult =
  | { kind: "integral"; artifact: ArtifactRecord; bytes: Buffer }
  | { kind: "absent" }
  | { kind: "invalid"; reason: ... }
  | { kind: "metadata_conflict"; artifact: ArtifactRecord; reason: ... }
  | { kind: "indeterminate" }
```

`absent` é determinado pela ausência da linha persistida; quando a linha existe, a ausência do objeto só é confirmada quando o Storage prova que ele não existe. Erro, timeout, 401/403, 5xx ou resposta ambígua são `indeterminate`.

**Fonte reutilizável**

```
ResolveSquareSourceInput =
  | { kind: "legacy_campaign"; storeId; campaignId; authorization }
  | { kind: "new_flow_1_1"; storeId; campaignId; authorization }
  | { kind: "composition_artifact"; storeId; campaignId; operationId; role; authorization }

ReusableSquareSource = {
  origin: "legacy_campaign" | "new_flow_1_1" | "composition_artifact"
  storeId; campaignId
  operationId?: UUID
  artifactId?: UUID
  bucket; storagePath
  width; height; mimeType; byteSize; checksumSha256
  role?: "square_original" | "square_prepared"
}
```

Resultado: `reusable` com o descritor acima ou `not_reusable` com motivo fechado (`not_owner`, `store_mismatch`, `campaign_not_ready`, `format_not_square`, `path_not_canonical`, `artifact_absent`, `artifact_invalid`, `artifact_indeterminate`, `unsupported_dimensions`, `unsupported_mime`). O descritor de campanha entregue (legado ou novo fluxo 1:1) inclui checksum e não cria linha fictícia; o derivado persiste `sourceCampaignId` e a proveniência allowlisted com o checksum da fonte.

**Autorização**

Toda operação que lê ou grava bytes — persistência, recuperação e resolução de fonte — SHALL receber um `AuthorizationContext` derivado pelo servidor, nunca do payload do cliente. O módulo recebe o contexto já resolvido pelo servidor e não o lê de request/body. `{ kind: "owner"; userId }` verifica `stores.user_id = userId` e `campaigns.store_id = storeId`. `{ kind: "system" }` é capacidade de servidor/orquestrador e verifica o vínculo loja↔campanha; `system` não dispensa esse vínculo. Nenhum path enviado pelo cliente é aceito como prova; o path é sempre derivado do banco ou da identidade.

**Evidência durável do objeto**

Para permitir adoção segura de órfão, o upload SHALL gravar, no mesmo request dos bytes, metadados customizados do objeto com uma evidência normalizada de identidade, conteúdo e proveniência:

```
ObjectEvidence = {
  v: 1
  storeId; campaignId; operationId; role
  origin
  sourceKind: "none" | "internal_artifact" | "delivered_campaign_source"
  sourceArtifactId?: UUID
  sourceCampaignId?: UUID
  sourceOrigin?: "legacy_campaign" | "new_flow_1_1"
  sourceChecksumSha256?: string
  width; height; mimeType; byteSize; checksumSha256
  provenanceDigest: string
}
```

- `provenanceDigest` é SHA-256 do JSON canônico (chaves ordenadas, sem espaços, UTF-8) da proveniência allowlisted.
- `sourceKind: "internal_artifact"` exige `sourceArtifactId`; `sourceKind: "delivered_campaign_source"` exige `sourceCampaignId` e `sourceOrigin` (`legacy_campaign`/`new_flow_1_1`); `sourceKind: "none"` não admite referência de origem.
- A chave de metadata `vendeo_composition_artifact` armazena `{ evidence, evidenceDigest }`, com `evidenceDigest` calculado sobre o JSON canônico de `evidence`.
- A evidência é gravada no mesmo request do objeto e **sobrevive à falha do insert da linha**, pois pertence ao Storage, não ao banco.
- Após o upload, o módulo SHALL ler `info(path)` e verificar a evidência antes de inserir a linha; se a evidência estiver ausente, malformada ou divergente, SHALL NOT inserir e SHALL devolver `persistence_failure`.
- Na adoção de órfão, o módulo SHALL baixar os bytes e ler a evidência via `info(path)`. Bytes iguais + evidência íntegra e compatível → adoção; bytes diferentes → `content_conflict`; evidência ausente, malformada ou incompatível → `provenance_conflict` com motivo `evidence_missing`/`evidence_invalid`/`evidence_mismatch`, sem adoção.
- Falha ou ambiguidade na leitura de `info` → `indeterminate`/`persistence_failure`, sem presumir ausência e sem adoção.
- A evidência é durável e verificável, mas não é imutável contra uma service key — a mesma limitação de RLS já declarada. A verificação detecta ausência, malformação ou divergência em relação à identidade/proveniência esperadas; não promete resistência a um atacante com a service key.

### Invariantes

1. Metadados persistidos são derivados dos bytes (decode completo), nunca do cliente; limites de bytes e pixels são aplicados antes do decode completo.
2. O path é determinístico a partir da identidade; o upload usa `upsert:false`; não há sobrescrita nem exclusão; a corrida de upload converge por releitura e validação.
3. A chave natural é `(store_id, campaign_id, operation_id, role)`; o banco impõe unicidade.
4. Linhas são imutáveis por grants e trigger (UPDATE/DELETE recusados).
5. `square_original` é imutável; `square_prepared` e `vertical` são artefatos independentes ligados por `derived_from_artifact_id` ou por descritor de campanha entregue validado.
6. O módulo não chama `createSignedUrl`, `getPublicUrl`, RPC de crédito, atualização de `campaigns` ou qualquer escrita de entrega.
7. O bucket privado protege `anon`/`authenticated`; `service_role` ignora RLS. A não sobrescrita dos objetos é garantida pelo comportamento do módulo (`upsert:false`, sem delete), não pela ausência de políticas. O path não é autorização.
8. Fonte de campanha entregue é somente leitura: nenhuma linha, arquivo, path ou classificação existente é alterada.
9. Idempotência exige conteúdo **e** proveniência compatíveis; mesmos bytes com origem/proveniência diferentes não são `reused`.
10. Adoção de órfão exige evidência durável no objeto; bytes sozinhos não comprovam origem. Evidência ausente, malformada ou incompatível → `provenance_conflict`, sem adoção.
11. A evidência é gravada no mesmo upload dos bytes e verificada por `info(path)` antes do insert; falha de verificação não insere linha e não apaga o objeto.

### Fluxo de persistência

1. Validar identidade, autorização e vínculo loja↔campanha.
2. Aplicar limites de bytes e pixels; validar papel/formato; decodificar os bytes por completo com o decodificador real; exigir dimensão/MIME do papel; calcular bytes e SHA-256.
3. Validar a referência de origem:
   - `internal_artifact`: reler a linha de origem, conferir loja/campanha/papel, baixar os bytes e comparar checksum/integridade.
   - `delivered_campaign_source`: revalidar o descritor canônico conforme `origin` (legado ou novo fluxo 1:1), incluindo campanha, path, dimensão, MIME e checksum; comparar com o descritor recebido.
   - Divergência de origem, papel ou checksum → `identity_conflict`/`metadata_conflict`.
4. Derivar o path determinístico do artefato.
5. Consultar a linha pela chave natural.
   - Linha existe + conteúdo, metadados e proveniência iguais → `reused`.
   - Linha existe + checksum diferente → `content_conflict`.
   - Linha existe + metadados divergentes dos bytes → `metadata_conflict`.
   - Linha existe + mesma imagem com origem/proveniência diferentes → `provenance_conflict`.
   - Linha existe + objeto ausente → `integrity_failure` (não regrava).
6. Sem linha: verificar o objeto no path.
   - Objeto existe: baixar os bytes e ler a evidência via `info(path)`.
   - Bytes diferentes → `content_conflict` (não sobrescreve).
   - Bytes iguais + evidência íntegra e compatível → adotar (inserir a linha) e devolver `reused`.
   - Bytes iguais + evidência ausente/malformada/incompatível → `provenance_conflict` (`evidence_missing`/`evidence_invalid`/`evidence_mismatch`), sem adoção.
   - Objeto ausente → montar a evidência, upload `upsert:false` com metadata `vendeo_composition_artifact`, verificar `info(path)` e só então inserir a linha.
7. Corrida de upload: se o upload for recusado por conflito de path (409/already exists/duplicate) porque outro gravou primeiro, **não** tratar como falha nem sobrescrever. Reler o objeto e a evidência e validar:
   - mesmos bytes + evidência compatível → convergir para um único registro (`reused`);
   - bytes diferentes → `content_conflict`;
   - mesmos bytes + evidência incompatível → `provenance_conflict`;
   - timeout, erro de rede ou resultado ambíguo → `indeterminate`/`persistence_failure`, sem presumir ausência e sem nova tentativa destrutiva.
8. Corrida de insert: reler a linha; mesmo conteúdo e proveniência → `reused`; caso contrário → conflito correspondente. Se a linha vencedora e a evidência do objeto divergirem, tratar como `provenance_conflict` e não adotar.
9. Falha de insert após upload: não apagar o objeto; devolver `persistence_failure` com o path. A evidência no objeto permite que a repetição adote o objeto íntegro, sem limpeza automática.
10. Falha na verificação da evidência após upload: não inserir a linha e não apagar o objeto; devolver `persistence_failure`. O objeto permanece não adotável até correção manual ou nova tentativa com evidência compatível.

### Fluxo de recuperação

1. Validar identidade, autorização e vínculo loja↔campanha.
2. Ler a linha pela chave natural; sem linha → `absent`.
3. Baixar o objeto do bucket interno; ausência provada → `absent`; erro/ambiguidade → `indeterminate`.
4. Aplicar limites e decodificar por completo; dimensão/MIME divergentes → `invalid`.
5. Comparar bytes, checksum e metadados com a linha; divergência → `metadata_conflict`.
6. Tudo compatível → `integral` com bytes e metadados.

### Fluxo de fonte reutilizável

- **Campanha já entregue — legado**: exigir autorização, `resolveCampaignFormat(campaign.input_snapshot).kind === "1:1"`, `campaigns.status = 'ready'`, `campaigns.storage_path` canônico (`{store}/{campaign}.jpg`, `{store}/{campaign}/v2.jpg` ou `v3.jpg`), vínculo loja/campanha; sondar `campaign-images` por conteúdo; exigir JPEG 1080×1080.
- **Campanha já entregue — novo fluxo 1:1**: mesma validação de campanha entregue, mas o path canônico é `{store}/{campaign}/product-1-1/{operation}/art-1024.jpg`; exigir JPEG 1024×1024. A linha de `product_1_1_campaign_artifacts` é evidência auxiliar, não prova de autorização.
- **Base interna**: validar identidade, autorização, papel (`square_original`/`square_prepared`) e integridade do artefato; **não** exigir campanha `ready`, entrega quadrada ou formato global 1:1. Uma campanha vertical em processamento com quadrado interno íntegro é fonte reutilizável.

Nenhuma fonte é copiada, migrada ou reclassificada. O descritor é um contrato de leitura para o orquestrador futuro; para o legado, inclui checksum e não cria linha fictícia.

## Data model (proposto; nenhum SQL é autorado ou aplicado nesta rodada)

### Nova tabela `public.campaign_composition_artifacts`

| Coluna | Regra |
|---|---|
| `id` | UUID PK |
| `store_id` | UUID NOT NULL, FK `stores(id)` |
| `campaign_id` | UUID NOT NULL, FK composta com `store_id` |
| `operation_id` | UUID NOT NULL, identidade opaca da orquestração (sem FK universal) |
| `role` | `square_original` \| `square_prepared` \| `vertical` |
| `format` | `1:1` \| `9:16`, coerente com o papel |
| `origin` | `provider_generation` \| `deterministic_preparation` \| `ai_expansion` |
| `derived_from_artifact_id` | UUID NULL, FK para a própria tabela |
| `source_campaign_id` | UUID NULL, FK composta `(source_campaign_id, store_id) → campaigns(id, store_id)` para proveniência de fonte |
| `storage_bucket` | TEXT NOT NULL (v1: `campaign-internal-artifacts`) |
| `storage_path` | TEXT NOT NULL UNIQUE |
| `width`, `height` | INTEGER NOT NULL, CHECK 1..8192 |
| `mime_type` | TEXT NOT NULL (v1: `image/jpeg`) |
| `byte_size` | BIGINT NOT NULL, CHECK > 0 |
| `checksum_sha256` | CHAR(64) NOT NULL, CHECK hexadecimal minúsculo |
| `provenance` | JSONB NOT NULL DEFAULT `{}`, objeto com allowlist server-side |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() |

Restrições: unicidade `(store_id, campaign_id, operation_id, role)`; FK composta `(campaign_id, store_id) → campaigns(id, store_id)` e, quando presente, `(source_campaign_id, store_id) → campaigns(id, store_id)`, com índice único aditivo em `campaigns(id, store_id)`; trigger de imutabilidade para UPDATE/DELETE; RLS habilitada; grants apenas `SELECT, INSERT` para `service_role`; `anon`/`authenticated` sem acesso.

Para derivados de artefato interno, `derived_from_artifact_id` referencia a linha de origem e o módulo revalida bytes/checksum. Para derivados de campanha entregue (legado ou novo fluxo 1:1), não há linha fictícia: `source_campaign_id` e a proveniência allowlisted registram `sourceOrigin`, `sourceChecksumSha256`, `sourceStoragePath`, `sourceWidth`, `sourceHeight` e `sourceMimeType`, sempre revalidados contra o descritor canônico.

A evidência durável do órfão não cria tabela nem coluna: ela vive nos metadados customizados do objeto (`vendeo_composition_artifact`) e é a única prova aceita para adoção sem linha.

### Novo bucket `campaign-internal-artifacts`

- `public = false`; limite de 10 MB; MIME `image/jpeg`.
- Políticas separadas de `SELECT` e `INSERT` para `service_role`, restritas ao bucket; nenhuma política para `anon`/`authenticated` (nem SELECT). Essas políticas são defesa em profundidade para a privacidade de `anon`/`authenticated`.
- **Limite importante:** `service_role` ignora RLS; a ausência de políticas de `UPDATE`/`DELETE` **não** impede uma service key de alterar objetos. A imutabilidade dos objetos é garantida pelo comportamento do módulo (`upsert:false`, nenhum delete) e a imutabilidade da linha por grants/trigger. A integração deve provar a negativa de leitura com usuário autenticado da própria loja e caminho conhecido, não apenas inspecionar nomes de políticas.
- Path determinístico `{storeId}/{campaignId}/{operationId}/{role}.jpg`, sem `upsert`.
- O bucket é a fronteira de privacidade para `anon`/`authenticated`; o path não é autorização.

### Por que não estender a tabela existente

Estender `product_1_1_campaign_artifacts` exigiria remover/alterar a unicidade `(campaign_id, operation_id)`, o que quebra o contrato do 1:1 e do 9:16 direto, e adicionaria colunas obrigatórias a linhas históricas. A nova tabela é aditiva, preserva o legado e permite múltiplos papéis por operação.

### Por que não reutilizar `campaign-images`

A policy de leitura do lojista é por prefixo de loja. Qualquer artefato interno ali seria legível ao lojista autenticado. Restringir por nome de path seria uma autorização baseada em string, frágil e contrária ao requisito. O bucket dedicado elimina a exposição sem tocar no bucket existente.

## Decisions

| ID | Decisão | Alternativas | Impacto |
|---|---|---|---|
| D1 | Criar tabela aditiva `campaign_composition_artifacts` | Estender `product_1_1_campaign_artifacts`; usar JSONB em `campaigns` | Preserva o 1:1/9:16 direto e mantém `product_1_1_campaign_artifacts` intocada; permite múltiplos papéis por operação; exige migration aditiva. |
| D2 | Criar bucket `campaign-internal-artifacts` com acesso de `service_role` e nenhuma política para `anon`/`authenticated` | Gravar em `campaign-images` com path interno; reutilizar `lab-artifacts` | Privacidade para `anon`/`authenticated`; não altera o bucket existente. `service_role` ignora RLS, então a não sobrescrita depende do comportamento do módulo (`upsert:false`, sem delete), não da política. |
| D3 | Fonte de campanha entregue (legado ou 1:1 atual) é descritor de leitura, sem nova linha | Copiar o legado para a nova tabela; reclassificar `campaigns` | Legado intacto; nenhum backfill; validação a cada uso; descritor inclui checksum e origem específica. |
| D4 | Idempotência por `(store, campaign, operation, role)` + checksum + proveniência; sem `upsert`; adoção de órfão exige evidência durável no objeto; upload recusado é revalidado; sem delete | Sobrescrever por path; usar apenas pré-checagem em código; adotar órfão só pelos bytes | Concorrência segura pela unicidade do banco, pela releitura do objeto e pela evidência de identidade/proveniência; sem perda de conteúdo; órfãos sem evidência não são adotados. |
| D5 | FK composta `(campaign_id, store_id)` e, quando aplicável, `(source_campaign_id, store_id)`, com índice único em `campaigns(id, store_id)` | Validar apenas em TypeScript | Vínculo loja↔campanha e origem imposto pelo banco; migration aditiva pequena. |
| D6 | `operation_id` é identidade opaca da orquestração, sem FK universal | FK para crédito; FK para duas etapas; criar tabela universal de operações | Evita acoplamento financeiro e duplicação de registro; o chamador deve reutilizar o mesmo `operation_id` em retomadas. |
| D7 | Nenhuma URL assinada, URL pública, download ou escrita de entrega no módulo | Expor `getSignedArtifactUrl` como nos stores atuais | Persistência não vira entrega; entrega futura terá módulo/gate próprio. |
| D8 | Nenhuma exclusão automática; falha de metadata não apaga o objeto | Rollback com delete; TTL/purge | Atende “sem exclusão automática”; repetição adota o objeto; limpeza futura é decisão separada. |
| D9 | Não refatorar os stores 1:1/vertical; criar helpers novos no módulo | Extrair helpers compartilhados dos stores existentes | Reduz o risco de regressão no 1:1/F59, mas não o elimina; consolidação futura só com justificativa e testes. |
| D10 | Fonte reutilizável cobre legado, novo fluxo 1:1 e composição interna | Apenas legado | Cobre as quatro orquestrações futuras sem inventar novo fluxo; o adaptador de path é pequeno e testável. |
| D11 | Testes offline com Storage/DB simulados e decodificador real; integração real e produção em gates separados | Testar direto em homolog/produção; simular a decodificação | Evita escrita/ambiente real nesta fatia e prova rejeição real de bytes inválidos; separa proteção local de prontidão produtiva. |

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| A policy de leitura do bucket `campaign-images` expor artefatos internos | Artefatos internos só no bucket novo, sem política para `authenticated`; a integração testa leitura negada com usuário autenticado da própria loja e caminho conhecido. |
| A unicidade da tabela existente impedir base + preparação + vertical | Nova tabela com chave natural por papel; tabela existente intocada. |
| `service_role` ignorar RLS e uma service key poder alterar objeto | O módulo usa `upsert:false` e não chama delete; a linha é imutável por grants/trigger; testes de contrato asseguram ausência de update/delete. A política de bucket não é apresentada como garantia contra `service_role`. |
| Concorrência entre duas persistências iguais, inclusive no upload | Unicidade no banco + releitura após conflito; upload recusado por outro gravador é revalidado; mesmo conteúdo → `reused`, diferente → `content_conflict`; resultado ambíguo → `indeterminate`/`persistence_failure`, sem sobrescrever. |
| Mesma imagem com proveniência incompatível | `provenance_conflict` explícito; `reused` só com conteúdo **e** proveniência compatíveis. |
| Órfão sem evidência durável ou com evidência incompatível | Não adotar; `provenance_conflict` (`evidence_missing`/`evidence_invalid`/`evidence_mismatch`); bytes sozinhos não comprovam origem. |
| Upload grava bytes, mas a metadata de evidência falha ou diverge | Verificar `info(path)` após o upload; não inserir a linha e não apagar o objeto; devolver `persistence_failure` e tratar manualmente. |
| Corrida com mesmos bytes e proveniências diferentes | A evidência do primeiro objeto vence; a segunda chamada relê e recebe `provenance_conflict`, sem adoção silenciosa. |
| Base interna de campanha vertical em processamento ser bloqueada por status/formato | Resolução interna valida identidade, autorização, papel e integridade; não exige campanha `ready`, entrega quadrada ou formato global 1:1. |
| Derivado de campanha 1:1 atual ser recusado por contrato que só aceita legado | `delivered_campaign_source` aceita `legacy_campaign` e `new_flow_1_1`, com revalidação específica; teste de fluxo completo cobre. |
| Objeto órfão após falha de insert | Repetição adota o objeto somente com evidência compatível; nenhuma exclusão automática; órfão sem evidência fica registrado no resultado para operação futura. |
| Path legado variar (`v2`/`v3`, 1080 vs 1024) | Allowlist explícita de paths canônicos + sonda por conteúdo + dimensão esperada por origem. |
| Cliente tentar forçar path ou artefato de outra loja | Path nunca vem do cliente; autorização por `stores.user_id`/`system`; vínculo campanha↔loja no banco e no serviço. |
| Migração colidir com timestamp de outra branch | Seguir `YYYYMMDDHHmmss_descricao.sql`, conferir unicidade na worktree/branch de destino/branches paralelas antes de criar e no conjunto integrado antes do release. |
| Escopo escorregar para entrega/crédito/UI | Non-goals explícitos; testes que asseguram ausência de chamadas de crédito, `campaigns` e URL assinada. |
| Duplicação de helpers de Storage entre stores existentes e o novo módulo | Aceita nesta fatia para não tocar no 1:1/F59; consolidação futura é dívida registrada, não bloqueio. |

## Migration Plan

1. **Agora (planejamento)**: nenhum arquivo `.sql` é criado; o desenho acima é a base para a implementação futura.
2. **Implementação autorizada**: criar migration aditiva com timestamp real `YYYYMMDDHHmmss_f60_1_composition_artifacts.sql`; conferir unicidade do prefixo; incluir tabela, índice único de vínculo, FK composta, trigger de imutabilidade, grants/RLS, bucket e políticas de `SELECT`/`INSERT` para `service_role`.
3. **Aplicação local/isolada**: aplicar somente em instância descartável ou homolog autorizado; verificar estrutura, RLS, grants, trigger, bucket privado e ausência de política autenticada. Nada em produção.
4. **Rollback**: em ambiente descartável, remover bucket/políticas, tabela, trigger e índice/FK aditivos. Em ambiente compartilhado, rollback é decisão separada e não automática; não há backfill de dados legados.
5. **Promoção produtiva**: gate separado, com autorização explícita, checklist de migration e verificação de que nenhuma ativação/flag/UI foi incluída. Conclusão local não é aprovação de produção.

## Test Strategy

### Offline (obrigatório nesta fatia)

Contratos com cliente Supabase/Storage falso e imagens determinísticas; o decodificador real é usado nos testes de integridade, sem rede, banco ou IA:

- Identidade e autorização: UUID inválido, campanha de outra loja, loja de outro usuário, operação ausente/instável, papel/formato incoerente, `owner`/`system` e ausência de contexto de autorização.
- Original intacto: persistir `square_prepared` e `vertical` não altera a linha/objeto de `square_original`; `derived_from_artifact_id` correto.
- Decodificação real: JPEG válido, JPEG truncado, não-JPEG, dimensão errada por papel e limites de bytes/pixels aplicados antes do decode completo.
- Idempotência: mesma identidade + mesmos bytes + mesma proveniência → `reused`, um upload, uma linha; corrida de insert → um vencedor e `reused`/`content_conflict` coerente; órfão íntegro **com evidência compatível** é adotado.
- Corrida de upload: duas chamadas veem "objeto ausente" e disputam o upload; recusa por outro gravador é revalidada; mesmos bytes + evidência compatível convergem para um registro; bytes diferentes → `content_conflict`; mesmos bytes + evidências diferentes → `provenance_conflict`; timeout/ambíguo → `indeterminate`/`persistence_failure`, sem presumir ausência nem sobrescrever.
- Evidência durável do órfão: upload grava metadata `vendeo_composition_artifact`; simular falha de insert e provar que a repetição adota o objeto; evidência ausente, malformada ou divergente → `provenance_conflict`, sem adoção; `info` indisponível → `indeterminate`/`persistence_failure`.
- Conflito: mesma identidade + checksum diferente → `content_conflict`, sem sobrescrita; path ligado a outra identidade → `identity_conflict`; linha divergente dos bytes → `metadata_conflict`; mesmos bytes com proveniência incompatível → `provenance_conflict`.
- Metadados incompatíveis: dimensão errada por papel, MIME não JPEG, bytes truncados, checksum/bytes divergentes.
- Origem legada: campanha pronta, 1:1, path canônico, 1080×1080 → `reusable`; 9:16, `generating`/`error`, path arbitrário, outra loja/usuário, objeto ausente, truncado ou não quadrado → `not_reusable`.
- Novo fluxo 1:1: path `product-1-1/.../art-1024.jpg`, 1024×1024 → `reusable`; path de outra campanha/loja → `not_reusable`.
- Base interna: campanha vertical em processamento com `square_original`/`square_prepared` interno íntegro → `reusable`, sem exigir campanha `ready`, entrega quadrada ou formato global 1:1.
- Proveniência de derivados: artefato interno → linha/bytes/checksum revalidados; campanha entregue (legado ou novo fluxo 1:1) → descritor canônico com checksum revalidado, sem linha fictícia.
- Fluxo completo 1:1 atual: resolver campanha 1:1 atual → `square_prepared` persistido com `delivered_campaign_source`/`origin: "new_flow_1_1"` → `created`/`reused`, com `sourceCampaignId` e proveniência corretos.
- Privacidade/escopo: nenhuma chamada a `createSignedUrl`/`getPublicUrl`; nenhuma escrita em `campaigns`, crédito ou operação; nenhuma exclusão; bucket interno usado para escrita; nenhum `update`/`delete` de objeto.

### Integração (somente com autorização)

- Aplicar a migration em ambiente descartável/homolog autorizado.
- Verificar tabela, constraints, FK composta, trigger de imutabilidade, RLS/grants e bucket `public=false` sem política para `authenticated`.
- Testar leitura negada com usuário autenticado da própria loja e caminho conhecido — não apenas inspecionar nomes de políticas.
- Exercitar upload/download/probe reais, evidência durável via `info`, adoção de órfão, corrida de upload, concorrência de insert e leitura de fonte legada e 1:1 atual com fixture controlada.
- Confirmar que a única escrita de objeto é upload `upsert:false`; que o módulo não chama update/delete; e que `service_role` não é usado como argumento de imutabilidade.
- Confirmar que `campaign-images`, `product_1_1_campaign_artifacts` e o fluxo 1:1 permanecem inalterados.
- Nenhuma chamada paga, nenhuma campanha real, nenhuma produção.

### Promoção produtiva (gate separado)

- Autorização explícita, migration revisada, backup/rollback definidos e smoke read-only.
- Ativação de qualquer orquestrador/UI é outra fatia; a 60.1 não ativa nada.

## Open Questions

Nenhuma bloqueante para o planejamento. Recomendações para a implementação:

- **Fonte `square_prepared`**: aceitar como fonte de expansão (1152×1152), além de `square_original`. Impacto: um papel a mais na resolução, sem mudar a tabela.
- **Novo fluxo 1:1 como fonte**: aceitar via `campaigns.storage_path` canônico, sem depender da linha de `product_1_1_campaign_artifacts`. Impacto: um adaptador de path e testes próprios.
- **Autorização**: manter `owner` e `system`; orquestradores usam `system`, aquisição futura usa `owner`. Impacto: validação explícita de propriedade.
- **Versionamento de artefato**: não criar `artifact_version` nesta fatia; conteúdo diferente na mesma identidade é conflito e exige nova operação. Impacto: contrato simples e seguro; revisão futura se a correção precisar de múltiplas versões por operação.
- **Limpeza de órfãos**: não implementar; registrar o path no resultado de falha e tratar em operação futura. Impacto: nenhuma exclusão automática agora.
