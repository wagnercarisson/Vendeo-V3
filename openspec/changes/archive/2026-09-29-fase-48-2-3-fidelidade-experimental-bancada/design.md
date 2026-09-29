# Design — F48.2.3: Fidelidade experimental da bancada

## Context

A F48.2.2 entregou a bancada de geração local (`/admin/laboratorio/bancada`), com persistência própria (`lab_bench_runs`/`lab_bench_artifacts`), manifesto local de lojas de teste (`fixtures/lab/bench/stores.json`), contrato local de branding (`branding-service.ts`, já expondo `typography_direction`), presets/pricing em código, adapter `Images` dedicado e single-shot. O UAT técnico foi aprovado com **uma** geração real controlada, mas a qualidade criativa não foi validada porque as fixtures eram **artificiais**: o formulário da bancada tem apenas três campos, a identidade não vem das lojas reais e a tipografia não entra no briefing.

O laboratório já provê os seams que esta fase reutiliza: guarda de ambiente fail-closed (`src/lib/lab/environment-guard.ts`), manifesto/`assertBenchTestStore` (`src/lib/lab/bench/domain/store-manifest.ts`), signer restrito de branding (`bench-branding-signer.ts`), serviços de run/artefato, e o padrão de comandos locais (`scripts/lab/48-2-2-bench-bootstrap.mjs`, com `assertLocalHost`, bloco REVERT e execução idempotente).

Fatos relevantes confirmados na investigação:

1. **O formulário produtivo** (`src/components/flow/use-campaign-form.ts`, `campaign-input-form.tsx`) tem campos e regras que a bancada não reproduz: nome (60), descrição (120), imagem principal + até 3 adicionais (`MAX_CAMPAIGN_IMAGES = 4`, 5MB, PNG/JPEG/WEBP/HEIC/HEIF), preço de/por com normalização por dígitos, selo por intenção, intenção derivada (`ambos > 0 → offer`; `só venda → spotlight`; `nenhum → exclusive`), **preservação da imagem original** (`preserveImageContext`, exibido só em Destaque/Exclusivo, enviado no body e limpo ao mudar para Oferta), validade (`until-date`/`range`/`today`/`stock`/`custom`), aviso ilustrativo (padrão ligado) e informações obrigatórias na arte (200).
2. **Módulos puros reutilizáveis**: `src/lib/campaign/field-guidance.ts`, `src/lib/formatters.ts` (`formatCurrencyBRL`), `src/lib/constants.ts` (`BADGE_OPTIONS_BY_INTENT`), `src/lib/campaign/brief.ts` (`buildCampaignBriefFromFlat`/`buildCampaignBriefSnapshot`), `src/lib/campaign/brief-schema.ts`, `src/lib/image-generation/schema.ts` (`GenerateImageRequestSchema`). Alguns helpers puros vivem no hook cliente e são exportados (`inferIntent`, `buildValidityDisplayText`, `buildMandatoryArtworkText`, `buildCampaignGenerationBody`).
3. **A resolução de `brandColor`** é inline em `resolveStoreIdentity` (`src/lib/store-identity-service.ts:30-150`). O perfil efetivo é **o único `status='synced'`** (qualquer `source`, **incluindo `text_only`**), porque `store_brand_profiles` tem índice parcial único em `(store_id) WHERE status='synced'`. A precedência efetiva é: (1) `brand_colors_chosen[0]` válido → (2) `safe_color_tokens.primary` válido → (3) `inferred_primary_color` válido, **apenas quando `source === 'text_only'`** → (4) `stores.brand_color` → (5) `getDefaultBrandColor(segment)`. O bloco `without_logo` de `resolveStoreIdentity` (`store-identity-service.ts:117-150`) é **inalcançável na prática**: como qualquer perfil `without_logo` synced já seria encontrado pela primeira consulta (`status='synced'`, qualquer `source`), não existe caminho normal de fallback. **Ausência de perfil synced = ausência de perfil.** O fallback atual da bancada (`readBrandProfile`) lê `source='without_logo'` sem exigir `status='synced'` — divergência a corrigir nesta fase.
4. **`stores.user_id` é UNIQUE** (`20260706000001_add_user_id_to_stores.sql:14`), exigindo um proprietário por loja; a bancada usa `supabaseAdmin` (service role) + `requireAdmin`, portanto acessa todas as lojas importadas independentemente de RLS.
5. **DDL local-first** (`supabase/lab/bench-schema.sql`, fora de `supabase/migrations/`) é aplicado por `scripts/lab/48-2-2-bench-bootstrap.mjs` (idempotente, com REVERT).
6. **A bancada F48.2.2 envia apenas o prompt manual** ao modelo: identidade, tipografia e dados estruturados não compõem o texto. O operador precisa **ler, corrigir e aprovar o texto completo** antes de qualquer geração paga — o que exige um **compositor determinístico mínimo** com etapa explícita de preflight (compor → revisar → editar → aprovar). A Images API recebe **um único texto de prompt**.

## Goals / Non-Goals

**Goals:**

- Importar, por comando local explícito, a identidade atual das lojas de teste selecionadas, com isolamento absoluto e sem qualquer consulta remota no runtime.
- Reproduzir na bancada os campos e comportamentos programáticos relevantes do formulário produtivo, com paridade testada.
- Disponibilizar um briefing experimental estruturado (incluindo `typography_direction`) com `brandColor` resolvido pela precedência produtiva exata.
- Compor, de forma determinística e sem IA, o prompt final a partir do briefing + dados estruturados + prompt-base manual, com preview/edição/aprovação explícita antes de qualquer geração paga.
- Manter a bancada produzindo apenas runs e artefatos laboratoriais, com persistência mínima da evidência do preflight.

**Non-Goals:**

- Sincronização automática/periódica, botão de importação na UI, consulta remota pela aplicação.
- Importar campanhas, usuários reais, créditos, billing, eventos, logs ou histórico de branding.
- Templates criativos completos por intenção/formato/tema; gerador inteligente ou baseado em IA; revisor automático; scoring; deduplicação semântica; múltiplas estratégias de composição; versionamento histórico de rascunhos; promoção produtiva. (O **compositor determinístico mínimo** desta fase é explicitamente **in-scope**; o futuro template criativo de Oferta 1:1 permanece fora e será tratado na F48.2.4.)
- Alterar o fluxo produtivo (formulário, pipeline, `resolveStoreIdentity`, `BrandProfileSnapshot`, `art-director-briefing`, `prompts/`, `MODEL_ALLOWLIST`, `ImagesAdapter`, `campaign-images`).
- Persistência visual determinística para `text_only` (fonte exata, wordmark, renderização programática) e mobile da bancada.
- Nova tabela de versões de prompt, novo estado persistido do run, sistema de candidatos, workflow de revisão automática, hashes persistidos ou infraestrutura de assinatura.

## Decisions

### D1 — Importação por CLI dedicado, nunca pela aplicação

O comando vive em `scripts/lab/**` (padrão dos scripts existentes: ESM, `main(argv, env)` testável, sem efeitos de import, guard local antes de I/O). A aplicação da bancada **não** ganha rota, botão ou job de importação; o runtime continua acessando **somente** o Supabase local. **Alternativa rejeitada:** endpoint administrativo de importação — manteria uma superfície de acesso remoto dentro do runtime que a fase quer eliminar.

### D2 — Dois clientes separados: origem somente-leitura e destino local

O comando usa dois clientes distintos:

- **Origem (remota)**: URL e chave fornecidas **somente por variáveis de ambiente** do operador (`BENCH_IMPORT_SOURCE_URL`/`BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY`, ou credencial de um papel somente-leitura quando disponível). Nunca persistidas, nunca logadas. O código de origem expõe **apenas** funções de leitura (`.select`/storage `.download`); nenhuma chamada de mutação existe no caminho.
- **Destino (local)**: URL local validada por `assertLocalHost` (mesma canonicalização do bootstrap), chave local de service role. Todas as escritas ocorrem aqui.

**Alternativa rejeitada:** um único cliente apontando para a origem — impossibilita garantir por construção o bloqueio de escrita no remoto. Um teste de fronteira (grep/inspeção de uso) garante que o módulo de origem não contém métodos de mutação. **Fronteira de autorização (Checkpoint A):** antes da autorização humana, o comando opera **somente** com fixtures, fakes ou `--dry-run` **completamente offline**; qualquer execução com URL ou credencial remota — **inclusive `--dry-run`** — exige aprovação humana prévia. O `--dry-run` impede materialização/escrita local, mas **não** garante ausência de leitura remota.

### D3 — Somente IDs explícitos; recusa de descoberta ampla

A CLI aceita `--store <uuid>` repetível (ou `--stores <csv>`). Sem IDs → erro; `--all`/descoberta → recusado. Cada ID é confirmado na origem com `stores.select("id,is_test_store,...").eq("id", id)` exigindo `is_test_store = true`; caso contrário, o ID é recusado. O contrato não assume quantidade fixa de lojas. **Alternativa rejeitada:** listar todas as lojas marcadas como teste — violaria "não descoberta ampla".

### D4 — Allowlist de tabelas, colunas e buckets

Leitura remota limitada a `stores`, `store_brand_profiles`, `store_brand_assets`, `store_visual_signatures` e aos buckets `store-logos`/`store-brand-assets`/`visual-signatures`, com **allowlist de colunas** (apenas identidade/branding atual). Proibido ler `campaigns`, `campaign_images`, `generation_events`, `ai_model_selection`, `credit_*`, `admin_audit_log`, `prompts/` ou qualquer log. Nenhuma leitura/gravação em `campaign-images`.

### D5 — Apenas o estado atual da identidade/branding, pelo comportamento produtivo

Importa-se **o único perfil `status='synced'`**, independentemente do `source`, **incluindo `text_only`**. **Ausência de perfil synced = ausência de perfil**, preservando `stores.brand_color` e o fallback do segmento. Perfil **não sincronizado** SHALL NOT virar baseline em nenhuma hipótese. **Mais de um perfil synced = estado ambíguo**, e a importação SHALL ser recusada com erro sanitizado. Não existe caminho normal de "fallback `without_logo` synced quando não há synced" (esse bloco produtivo é inalcançável; ver Contexto item 3). Importam-se os assets **ativos** (`store_brand_assets.status='active'`) e a assinatura **ativa** (`store_visual_signatures.status='active'`). **Não** se importa `previous_identity_snapshot` (histórico), versões antigas, nem campanhas/eventos/créditos. O `store.id` original é preservado. Registra-se `profileSource`/`profileStatus` na evidência. A leitura da bancada (`readBrandProfile`) SHALL ler o único perfil synced, sem fallback `without_logo`.

### D6 — Proprietário local sintético por loja

Como `stores.user_id` é UNIQUE, o comando cria um proprietário sintético local por loja via admin API local (`supabase.auth.admin.createUser`) com e-mail determinístico `bench-store+<storeId>@bench.local` e `email_confirm: true`. Reimportação faz lookup por e-mail e reutiliza o usuário (idempotente). Nenhum dado do usuário real é copiado. O runtime acessa as lojas por `supabaseAdmin` + `requireAdmin`, sem depender de posse. **Alternativa rejeitada:** inserir direto em `auth.users` — frágil e fora do caminho suportado.

### D7 — Reconstrução saneada das linhas locais

As linhas locais são reconstruídas a partir de uma **allowlist explícita de colunas**, preservando IDs referenciados por FKs (`store_brand_assets.id` ← `store_brand_profiles.active_logo_asset_id`; `store_visual_signatures.id` ← `store_brand_profiles.visual_signature_id`). Campos que poderiam vazar URLs remotas são saneados: `stores.logo_url = null`; `store_visual_signatures.asset_url` recebe o **path local** (nunca URL assinada); `metadata` é saneado (remove valores URL/JWT). Não se seleciona `stores.accent_color` (coluna inexistente nas migrations; divergência pré-existente irrelevante para `brandColor`).

### D8 — Assets em paths versionados/content-addressed, depois a transação

Ordem: (1) baixar os assets remotos; (2) gravar os assets locais em **paths versionados/content-addressed** (derivados de `store_id`/asset id **+ checksum do conteúdo**), sem sobrescrever objetos ainda referenciados pela identidade anterior; (3) executar **uma** transação SQL local que troca as referências para os novos paths; (4) **após o commit**, remover os objetos antigos que ficaram sem referência; (5) em falha **antes** do commit, remover **apenas** os objetos novos e preservar integralmente os anteriores. Assim, nenhuma referência local aponta para objeto ausente quando o banco é confirmado e uma falha nunca corrompe a identidade anterior. **Alternativa rejeitada:** `upsert` nos mesmos paths antes da transação — poderia sobrescrever o conteúdo ainda referenciado pela identidade anterior e, com uma falha posterior, deixar o banco antigo apontando para conteúdo novo.

### D9 — Substituição integral transacional e idempotente

A transação local apaga as linhas-filhas de identidade/branding da loja (perfis, assets, assinaturas) e faz upsert da loja + inserção do novo conjunto, já com os `storage_path` **novos** (versionados/content-addressed). Reimportação substitui integralmente; execução repetida sem mudanças na origem produz o mesmo estado (mesmos checksums → mesmos paths, idempotente). A remoção dos objetos antigos ocorre **após** o commit, best-effort e somente para os sem referência. Usa o mesmo `pg.Client` do bootstrap, com bloco REVERT para o DDL novo.

### D10 — Manifesto é atualizado pelo comando

O comando faz upsert idempotente do par `{ id, label }` (label = nome da loja na origem) em `fixtures/lab/bench/stores.json`, mantendo o manifesto como **única fonte de elegibilidade** do runtime (`assertBenchTestStore` inalterado). O arquivo é versionado, então diffs são esperados e revisáveis. **Alternativa rejeitada:** derivar elegibilidade do banco — mudaria o contrato do manifesto e ampliaria a superfície de elegibilidade.

### D11 — Auditoria local

O DDL local ganha `lab_bench_store_imports` (`id`, `store_id`, `source_host` canonicalizado sem credenciais, `imported_at`, `imported_by`, `source_updated_at`, `asset_count`, `status`, `detail` jsonb saneado). É aplicado pelo bootstrap local com REVERT; nada é promovido ao remoto. **Alternativa rejeitada:** relatório em arquivo — menos consultável e propenso a divergir.

### D12 — Sanitização e ausência de chamada de IA

Logs, erros e `detail` são saneados (`sanitizeAiErrorMessage`/mascaramento de chave/token/URL assinada). A importação não inicializa providers, não gera imagem e não consome créditos.

### D13 — Paridade do formulário por módulo puro próprio + reuso

Novo módulo puro `src/lib/lab/bench/domain/form-rules.ts` reproduz as regras relevantes (validação de nome/descrição/imagem, normalização monetária por dígitos, de/por, selo por intenção, derivação/seleção de intenção, modos e texto de validade, aviso ilustrativo, concatenação das informações obrigatórias e **preservação da imagem original** — `preserveImageContext`, exibido apenas em Destaque/Exclusivo e limpo ao mudar para Oferta). Ele **reutiliza** os módulos genuinamente puros e sem acoplamento (`field-guidance`, `formatters`, `constants`, `campaign/brief`, `brief-schema`, `image-generation/schema`, `campaign/types`) e os helpers puros exportados pelo hook quando importáveis sem DOM (`inferIntent`, `buildValidityDisplayText`, `buildMandatoryArtworkText`, `buildCampaignGenerationBody`). Onde o compartilhamento aumentar risco/acoplamento, mantém-se a separação com **testes explícitos de paridade**. O formulário produtivo e o hook **não** são editados. **Alternativa rejeitada:** importar o hook cliente inteiro no domínio da bancada (acopla React/DOM) e editar o hook para extrair helpers (toca produção).

### D14 — Snapshot fiel pelos mappers produtivos

O `BenchProduct`/`BenchOffer` atuais (limites divergentes: nome 200, descrição 2000) são substituídos por um contrato fiel ao produtivo (nome 60, descrição 120, 1+3 imagens, 5MB, tipos produtivos, selo/intenção/validade/aviso/texto obrigatório e **`preserveImageContext`** — enviado apenas em Destaque/Exclusivo). O snapshot é construído com `buildCampaignBriefFromFlat`/`buildCampaignBriefSnapshot` (puros) para garantir compatibilidade contratual, acrescido da configuração da bancada e da intenção resolvida (`intentResolvedFrom`). Cada dado estruturado tem **um bloco canônico único** no prompt compilado (D19). A persistência continua em `lab_bench_runs.campaign_snapshot`.

### D15 — Briefing experimental estruturado, sem tocar o produtivo

Novo módulo puro `src/lib/lab/bench/domain/experimental-briefing.ts` monta o briefing **estruturado** a partir do contrato de branding local + snapshot + config: direção visual consolidada (briefing de campanha, diretrizes, estilo, tom e personalidade), **direção tipográfica** e `brandColor` resolvido. Ele é a **entrada do compositor** (D17/D19), não o texto final. Reutiliza helpers puros (`formatPriceBRL`, `sanitizePromptText`) quando aplicável e **não** altera `art-director-briefing.ts` nem `BrandProfileSnapshot`. **Alternativa rejeitada:** promover tipografia ao snapshot produtivo — escopo declarado de mudança posterior e violaria "produção intocada".

### D16 — `brandColor` por precedência produtiva exata

Novo módulo puro `resolveBenchBrandColor` reproduz **exatamente** a precedência produtiva efetiva (Contexto, item 3): para o **único perfil `status='synced'`** (qualquer `source`, incluindo `text_only`), (1) `brand_colors_chosen[0]` válido → (2) `safe_color_tokens.primary` válido → (3) `inferred_primary_color` válido **apenas em `text_only`** → (4) `stores.brand_color` → (5) fallback de segmento. **Ausência de perfil synced = ausência de perfil** (sem fallback `without_logo`). Não se inventa precedência nem se expande paleta. Um **teste de paridade** aciona a resolução produtiva sobre fixtures e afirma igualdade de `brandColor`. **Alternativa rejeitada:** editar `resolveStoreIdentity` para extrair um resolver compartilhado — toca o pipeline produtivo.

### D17 — Preflight: composição determinística, preview, edição e aprovação

A bancada SHALL oferecer uma etapa explícita anterior à geração: (1) **Compor prompt**; (2) exibir o **prompt compilado** completo; (3) permitir **edição manual** do prompt compilado; (4) exigir **aprovação explícita**; (5) somente então habilitar o caminho de **estimativa/confirmação** da geração. O compositor é **puro e sem IA**: não reescreve o prompt-base, não interpreta criatividade, não avalia qualidade, não deduplica semanticamente, não chama provider, não promove nada e **não substitui o futuro template criativo de Oferta 1:1**. Qualquer alteração em dados usados pela composição invalida o prompt compilado/aprovado e exige nova composição e aprovação; alterar o prompt final depois da aprovação também invalida a aprovação. A execução envia **exatamente** o texto final visível e aprovado — nenhuma concatenação, instrução ou transformação ocorre após a aprovação. A **confirmação financeira** da chamada paga permanece **separada** da aprovação do prompt. **Alternativa rejeitada:** manter o briefing apenas como evidência e enviar só o prompt manual — a tipografia não influenciaria a imagem, contrariando o objetivo aprovado.

### D18 — Sem promoção, sem avaliação automática e controle de complexidade

Nenhuma correção de cores/tipografia é promovida ao contrato produtivo. A persistência visual determinística para `text_only` fica fora de escopo. Nenhuma avaliação automática, comparação de resultados, votação, scoring ou revisor de IA é implementada; nenhuma geração real ocorre em implementação/testes/CI. A fase **não** ganha: tabela de versões de prompt, novo workflow de estados persistidos, biblioteca de templates, promoção produtiva, deduplicação semântica, múltiplas estratégias de composição ou o template criativo definitivo de Oferta 1:1. A próxima fase (F48.2.4) usará a bancada pronta para testar e refinar o primeiro template Oferta 1:1.

### D19 — Estrutura de blocos do prompt compilado

O prompt compilado usa, nesta primeira versão avaliável, os blocos: `[IDENTIDADE E DIREÇÃO VISUAL]`, `[DIREÇÃO TIPOGRÁFICA]`, `[PRODUTO E IMAGENS DE REFERÊNCIA]`, `[CONDIÇÕES COMERCIAIS]`, `[INTENÇÃO E FORMATO]`, `[INSTRUÇÕES DO PROMPT-BASE]`, `[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]`. Mapeamento canônico (um dado → um bloco): identidade/branding → `[IDENTIDADE E DIREÇÃO VISUAL]`; `typography_direction` → `[DIREÇÃO TIPOGRÁFICA]`; produto, descrição e imagens/referências → `[PRODUTO E IMAGENS DE REFERÊNCIA]` (incluindo `preserveImageContext`); preços de/por, selo e validade → `[CONDIÇÕES COMERCIAIS]`; intenção e formato → `[INTENÇÃO E FORMATO]`; prompt-base manual → `[INSTRUÇÕES DO PROMPT-BASE]`; aviso ilustrativo e informações obrigatórias na arte → `[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]`. Regras: o compositor e os blocos gerados **não** introduzem contexto de laboratório, experimento, baseline, comparação de variantes ou avaliação, nem bloco "Objetivo experimental"; a proibição vale para o **conteúdo gerado pelo compositor** e **não** é blacklist lexical sobre o prompt completo; o **prompt-base é preservado integralmente** e o compositor **não filtra nem reescreve** palavras legítimas ("teste", "comparação", "avaliação") fornecidas pelo operador (a aprovação humana responde pelo texto final); **blocos vazios são omitidos**; o compositor **não repete deliberadamente** o mesmo campo em vários blocos; **sem deduplicação semântica** nesta fase (duplicidades entre prompt-base e dados estruturados são avaliadas manualmente). A estrutura é uma primeira versão avaliável, não arquitetura definitiva.

### D20 — Persistência mínima do preflight

Reusa o run `draft`, `prompt_sent`, `campaign_snapshot` e o snapshot de briefing já previstos. Registra como evidência: prompt-base manual; blocos estruturados utilizados; prompt originalmente compilado; prompt final editado e aprovado; versão estática do compositor; `prompt_sent` idêntico ao prompt final aprovado. **Não** cria: nova tabela de versões; histórico de rascunhos; novo estado do run; sistema de candidatos; workflow de revisão automática; hashes persistidos ou infraestrutura de assinatura (salvo se indispensável e explicitamente justificado). Rascunhos descartados vivem apenas no estado da UI; cada geração persiste somente seu snapshot final auditável. **Alternativa rejeitada:** tabela de versões/histórico — complexidade fora do escopo e sem consumidor nesta fase.

### D21 — UAT e consumo de IA

O UAT obrigatório cobre importação, paridade, composição, preview, edição, aprovação e isolamento **sem chamada ao provider**. A eventual geração real é realizada **exclusivamente pelo usuário**, manualmente e com autorização explícita, e **não** é critério automático de conclusão. Testes automatizados usam mocks/stubs/fixtures/adapters gravadores; nenhuma task autônoma gera ou avalia imagens. O UAT sem provider comprova: blocos corretos; ausência de contexto experimental **gerado pelo compositor** (verificação por origem, com o prompt-base preservado); tipografia presente; cor produtiva preservada; edição e aprovação; invalidação após mudança das entradas; `prompt_sent` idêntico ao aprovado (via adapter gravador).

## Risks / Trade-offs

- **[Escrita acidental no remoto]** → cliente de origem somente-leitura por construção, allowlist estrita e testes negativos que falham em qualquer mutação.
- **[Credenciais remotas expostas]** → apenas por variáveis de ambiente do operador, nunca persistidas/logadas; sanitização; possibilidade de papel somente-leitura.
- **[Identidade local parcialmente atualizada]** → assets em paths versionados/content-addressed + transação SQL única + remoção dos antigos **só após o commit**; falha antes do commit remove apenas os novos e preserva integralmente os anteriores.
- **[Divergência de paridade com o tempo]** → módulo puro próprio + testes de paridade + guarda de regressão que comprova que os arquivos produtivos não mudaram.
- **[Vazamento de URL remota em campos de URL]** → `logo_url = null`, `asset_url` = path local, `metadata` saneado, proibição de persistir URL assinada.
- **[Diffs no manifesto versionado]** → comportamento documentado; o comando é idempotente e o manifesto permanece a fonte de elegibilidade revisável.
- **[`stores.accent_color` divergente (pré-existente)]** → não é selecionado nem importado; irrelevante para `brandColor`.
- **[Importar perfil errado]** → importar o **único perfil `status='synced'`** (qualquer `source`, incluindo `text_only`); ausência de synced = ausência de perfil; perfil não sincronizado nunca vira baseline; **mais de um synced = estado ambíguo, importação recusada com erro sanitizado**; registrar `profileSource`/`profileStatus` na evidência.
- **[Acoplamento ao hook cliente]** → preferir módulos puros compartilhados; testes de paridade onde houver replicação.
- **[Composição opaca ou contexto experimental nos blocos gerados]** → compositor puro, blocos canônicos e testes que verificam, **por origem**, que os blocos gerados pelo compositor não introduzem contexto de laboratório/experimento/baseline/comparação/avaliação; o prompt-base é preservado sem filtragem lexical.
- **[Divergência entre prompt aprovado e enviado]** → `prompt_sent` é exatamente o texto aprovado; nenhuma transformação após a aprovação; teste com adapter gravador.
- **[Sobrecarga de persistência]** → reuso do run `draft`/`prompt_sent`/snapshot; sem tabela de versões nem histórico; rascunhos apenas no estado da UI.

## Migration Plan

1. Estender o DDL local (`supabase/lab/bench-schema.sql`): `lab_bench_store_imports` e as colunas de evidência do preflight em `lab_bench_runs` (reusando `prompt_sent`/`campaign_snapshot`), com bloco REVERT; aplicar via bootstrap local.
2. Implementar o comando de importação (`scripts/lab/48-2-3-bench-import-stores.mjs`) com `--dry-run` **offline por padrão**, dois clientes, allowlists e transação local; qualquer uso de URL/credencial remota (inclusive `--dry-run`) exige aprovação humana (Checkpoint A).
3. Implementar `form-rules.ts`, o snapshot fiel, `experimental-briefing.ts`, `resolveBenchBrandColor` e o **compositor determinístico** (`prompt-composer.ts`) com os blocos canônicos (D19) e a versão estática do compositor.
4. Estender API (`GET /.../briefing`, preview/aprovação do prompt compilado, payload fiel de `/runs`) e UI (formulário fiel + etapa de preflight: compor/editar/aprovar).
5. Testes: paridade do formulário, resolução cromática, blocos corretos e ausência de contexto experimental, tipografia no `prompt_sent`, invalidação por mudança de entradas, `prompt_sent` idêntico ao aprovado (adapter gravador), fronteira/importação (negativos), idempotência, ausência de chamada paga.
6. UAT manual **sem provider** (obrigatório): importar as duas lojas de teste por comando e verificar fidelidade de identidade, paridade dos campos, composição/preview/edição/aprovação, tipografia presente, cor produtiva preservada, invalidação após mudança de entradas, isolamento e ausência de alteração em produção. **Geração real é opcional**: só ocorre se iniciada manualmente pelo usuário com autorização explícita, e **não** é critério obrigatório de conclusão desta fase.
7. **Sem `db push` remoto, sem promoção e sem chamada real de IA** durante implementação/testes/verificação.

## Open Questions

- **Credencial de origem (não bloqueante)**: usar service role remoto com leitura por construção ou um papel somente-leitura dedicado. Decisão operacional; o contrato exige apenas leitura e não altera as decisões aprovadas.
- **Nenhuma dúvida bloqueante.** O perfil importado é o **único `status='synced'`** (qualquer `source`, incluindo `text_only`); ausência de synced = ausência de perfil; mais de um synced é estado ambíguo e a importação é recusada.
