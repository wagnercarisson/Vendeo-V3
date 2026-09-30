---
phase: quick
plan: 260929-rtl
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: []
files_modified:
  - scripts/lab/48-2-3-bench-import-stores.mjs
  - src/lib/lab/bench/domain/store-manifest.ts
  - src/lib/lab/bench/domain/schemas.ts
  - src/lib/lab/bench/domain/branding-service.ts
  - src/lib/lab/bench/domain/resolve-bench-identity.ts
  - src/app/api/admin/laboratorio/bancada/branding/route.ts
  - src/app/(app)/admin/laboratorio/bancada/_components/bench-branding-panel.tsx
  - src/lib/lab/bench/__tests__/resolve-bench-identity.test.ts
  - src/lib/lab/bench/__tests__/branding-service.test.ts
  - src/lib/lab/bench/__tests__/bench-import.contract.test.ts
  - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts
must_haves:
  truths:
    - "A bancada resolve a referência de identidade a partir de `stores.identity_state`, nunca de 'primeiro asset com signedUrl'."
    - "Loja com estado `logo` exibe o logo (variante normalized > original > on_dark); loja com `visual_signature` exibe a assinatura; `text_only` não exibe imagem de identidade."
    - "A variante de logo é selecionada por prioridade (normalized → original → on_dark) ANTES de qualquer assinatura; falha de assinatura da variante escolhida mantém o descritor selecionado com `signedUrl: null` e `identityReason` de falha — nunca cai para a variante seguinte."
    - "Ausência do asset esperado produz referência nula com motivo explícito — nunca cai para outro tipo de identidade."
    - "`identity_state` ausente/desconhecido na origem interrompe a importação com erro sanitizado ANTES da transação (fail-closed), sem conversão silenciosa para `text_only`."
    - "A reimportação explícita das duas lojas de teste persiste `identity_state` em `stores` local (INSERT + ON CONFLICT DO UPDATE)."
    - "O snapshot de branding (`.strict()`) contém `identityState`, `identityReference` (kind/variantType/storagePath, sem URL assinada) e `identityReason`; a `signedUrl` existe apenas no contrato transitório da API."
    - "A resolução é pura e determinística (mesma entrada → mesma saída) e não toca o pipeline produtivo."
  artifacts:
    - path: "src/lib/lab/bench/domain/resolve-bench-identity.ts"
      provides: "Resolver puro de identidade da bancada (estado + variantes + assinatura → referência + motivo)"
      min_lines: 60
    - path: "scripts/lab/48-2-3-bench-import-stores.mjs"
      provides: "Allowlist e persistência de `identity_state` na importação"
      contains: "identity_state"
    - path: "src/lib/lab/bench/domain/branding-service.ts"
      provides: "Contrato com `identityState` + referência resolvida (sem alternativa silenciosa)"
      contains: "identityState"
    - path: "src/lib/lab/bench/domain/schemas.ts"
      provides: "`BenchBrandingSnapshotSchema` com `identityState`"
      contains: "identityState"
    - path: "src/lib/lab/bench/__tests__/resolve-bench-identity.test.ts"
      provides: "Cobertura dos três estados, prioridade de variante, ausência, coexistência e determinismo"
      min_lines: 80
  key_links:
    - from: "src/lib/lab/bench/domain/branding-service.ts"
      to: "src/lib/lab/bench/domain/resolve-bench-identity.ts"
      via: "loadBenchBranding resolve a referência canônica com o resolver puro"
      pattern: "resolveBenchIdentity"
    - from: "src/lib/lab/bench/domain/store-manifest.ts"
      to: "stores.identity_state"
      via: "assertBenchTestStore .select(...) inclui identity_state e o devolve em BenchTestStoreRecord"
      pattern: "identity_state"
    - from: "src/app/api/admin/laboratorio/bancada/branding/route.ts"
      to: "src/lib/lab/bench/domain/branding-service.ts"
      via: "withSignedAssets apenas renova a URL assinada do descritor já selecionado por loadBenchBranding (não re-resolve identidade, não usa 'primeiro signedUrl')"
      pattern: "identityReference"
    - from: "scripts/lab/48-2-3-bench-import-stores.mjs"
      to: "public.stores"
      via: "buildStoreUpsert INSERT + ON CONFLICT SET identity_state = EXCLUDED.identity_state"
      pattern: "identity_state = EXCLUDED.identity_state"
user_setup: []
---

# Quick Task 260929-rtl — Fidelidade de identidade visual da bancada (`stores.identity_state`)

## Phase Goal

**Correção estritamente corretiva**: persistir e transportar `stores.identity_state` até a bancada, para que a identidade exibida/resolvida reflita o estado real da loja — eliminando o bug do "asset alternativo silencioso" introduzido na F48.2.3. **Planejamento SOMENTE** — o executor NÃO será acionado nesta sessão.

## Root cause (confirmada no código)

A F48.2.3 importou as duas lojas e seus assets, mas `stores.identity_state` nunca foi importado nem exposto. Âncoras verificadas:

1. `scripts/lab/48-2-3-bench-import-stores.mjs`
   - `STORE_COLUMNS` (linhas 134–135) **não** inclui `identity_state` → a leitura de `stores` descarta a coluna.
   - `buildSanitizedStoreRow` (linhas 696–710) **não** carrega `identity_state`.
   - `buildStoreUpsert` (linhas 1132–1162): o `INSERT ... ON CONFLICT DO UPDATE` (colunas na linha 1134; `SET` nas 1136–1147; `values` nas 1148–1160) **não** define `identity_state` → a loja local mantém o DEFAULT `'text_only'` mesmo quando a origem é `logo`/`visual_signature`.
2. `src/lib/lab/bench/domain/branding-service.ts`
   - `BenchBrandingContract` (linhas 59–92) não tem `identityState`.
   - `readStoreBrandColor` (linhas 217–232) lê apenas `brand_color`; o registro da loja vem de `assertBenchTestStore` (`store-manifest.ts`, select na linha 268) que **também** omite `identity_state`.
   - `logoUrl` (linha 352) = "primeiro asset com `signedUrl` não nulo"; `signatureUrl` (linhas 341–350) é a VS ativa incondicionalmente. A rota repete o padrão em `withSignedAssets` (linha 61). Esse é exatamente o bug do asset alternativo silencioso: um asset de logo aparece mesmo com estado `visual_signature` (e vice-versa).
3. `src/lib/lab/bench/domain/schemas.ts` — `BenchBrandingSnapshotSchema` (linhas 152–184) não tem `identityState` (schema `.strict()`).
4. Regra produtiva a espelhar — `src/lib/store-identity-service.ts::resolveStoreIdentity` (linhas 30–83):
   - `identityState = store.identity_state ?? 'text_only'` (linha 32).
   - `logo`: assets ativos (`status='active'`), escolhe a variante por prioridade `normalized ?? original ?? on_dark` (linhas 57–60) **antes** de assinar; só assina o asset escolhido, se houver `storage_path` e a URL tiver sucesso (62–70); senão **nenhuma imagem**. **A seleção NÃO depende do sucesso da assinatura** — falha ao assinar a variante escolhida não cai para a variante seguinte.
   - `visual_signature`: VS ativa (`getActiveVisualSignature`) → assina de `visual-signatures` (73–82); senão nenhuma imagem.
   - `text_only`: nenhuma imagem de identidade.
   - **Fato de banco**: `stores.identity_state TEXT NOT NULL DEFAULT 'text_only'` com `CHECK IN ('text_only','logo','visual_signature')` — `supabase/migrations/20260612000001_add_identity_state_fields.sql` (linhas 5 e 11).
5. Fixtures `fixtures/lab/bench/stores.json`: NovaTek `3dc7d274-0b57-45ba-883a-7b235056feda` (sem logo, com assinatura → esperado `visual_signature`) e Adega `48b212f8-2b0f-4679-b553-122a601bacac` (com logo, sem assinatura → esperado `logo`). **Os estados exatos serão lidos do remoto durante a reimportação autorizada — nunca assumidos.**

## Files and contracts affected

**Produção que deve permanecer INTOCADA (verificar por `git diff` vazio):**
- `src/lib/store-identity-service.ts` (e qualquer consumidor produtivo de identidade).
- `src/lib/ai/adapters/bench-images.ts` e qualquer pipeline/provider de imagem.
- `supabase/migrations/**` (nenhuma DDL nova; a coluna já existe).

**Arquivos modificados/criados:**
| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `scripts/lab/48-2-3-bench-import-stores.mjs` | `STORE_COLUMNS` + `buildSanitizedStoreRow` + `buildStoreUpsert` com `identity_state` |
| 2 | `src/lib/lab/bench/domain/store-manifest.ts` | select (l. 268) + `BenchTestStoreRecord` (l. 193–202) + retorno (l. 281–290) |
| 3 | `src/lib/lab/bench/domain/schemas.ts` | `BenchBrandingSnapshotSchema` (l. 152–184) ganha `identityState` |
| 4 | `src/lib/lab/bench/domain/branding-service.ts` | `BenchBrandingContract` (l. 59–92), wiring do resolver (l. 341–395), snapshot (l. 410–416) |
| 5 | `src/lib/lab/bench/domain/resolve-bench-identity.ts` | **NOVO** resolver puro (espelha `resolve-bench-brand-color.ts`) |
| 6 | `src/app/api/admin/laboratorio/bancada/branding/route.ts` | `withSignedAssets` (l. 47–63) para de derivar `logoUrl` do "primeiro signedUrl" |
| 7 | `src/app/(app)/admin/laboratorio/bancada/_components/bench-branding-panel.tsx` | `BenchBrandingView` (l. 35–60) + exibição de estado/asset/motivo (l. 155–188) — sem redesenho |
| 8 | `src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx` | **Somente** se a tipagem de `BenchBrandingView` exigir; nenhuma mudança de fluxo |
| 9–12 | testes co-localizados | ver "Required tests" |

## Implementation sequence

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Importar e persistir `identity_state` na CLI (allowlist + upsert)</name>
  <files>scripts/lab/48-2-3-bench-import-stores.mjs, src/lib/lab/bench/__tests__/bench-import.contract.test.ts</files>
  <behavior>
    - `STORE_COLUMNS` inclui `identity_state`; `SOURCE_COLUMN_ALLOWLIST.stores` aceita a coluna.
    - `identity_state` é validado contra o conjunto fechado `text_only | logo | visual_signature`; ausente/desconhecido interrompe a importação daquela loja com erro sanitizado **antes** da transação (fail-closed), sem conversão silenciosa.
    - `buildSanitizedStoreRow` devolve `identity_state` **já validado** (sem fallback `?? "text_only"`).
    - `buildStoreUpsert` grava `identity_state` no INSERT e no `ON CONFLICT DO UPDATE SET`.
    - Coluna fora da allowlist continua recusada por `assertAllowedSourceColumns`.
  </behavior>
  <action>
    Em `STORE_COLUMNS` (l. 134–135), adicionar `identity_state` logo após `brand_color`; `SOURCE_COLUMN_ALLOWLIST.stores` (l. 150–155) deriva de `STORE_COLUMNS.split(",")` e passa a aceitá-la automaticamente, sem duplicação. Adicionar uma constante `VALID_IDENTITY_STATES = Object.freeze(["text_only", "logo", "visual_signature"])` e um validador **puro** exportado `assertValidIdentityState(value)` que devolve o valor quando pertence ao conjunto e lança `BenchImportBlockedError("import_store_identity_state_invalid", ...)` (mensagem sanitizada, sem ecoar conteúdo remoto) caso ausente/desconhecido. Chamar `assertValidIdentityState(store.identity_state)` em `importOneStore` (l. 1339–1342), logo após `confirmTestStore` e **antes** de `orderAssetsTopologically`/`materializeStoreAssets`/`runIdentityTransaction` — fail-closed, sem qualquer upload ou escrita. Em `buildSanitizedStoreRow` (l. 696–710), inserir `identity_state: assertValidIdentityState(store.identity_state)` entre `brand_color` e `logo_url` (valor já validado; **sem** `?? "text_only"` e sem inventar estado). Em `buildStoreUpsert` (l. 1132–1162), adicionar `identity_state` à lista de colunas do INSERT **após `brand_color`** e antes de `logo_url`; ajustar o `VALUES` para `$1..$12`; incluir `identity_state = EXCLUDED.identity_state` no `ON CONFLICT DO UPDATE SET`; inserir `store.identity_state` no array `values` na posição correspondente. Nova ordem de `values` (1-based para índice 0-based): `1 id, 2 name, 3 segment, 4 subsegment, 5 tone_of_voice, 6 positioning, 7 short_description, 8 slogan, 9 brand_color, 10 identity_state, 11 logo_url, 12 user_id` — portanto `brand_color = 8` (inalterado), `identity_state = 9`, `logo_url = 10`. Atualizar `bench-import.contract.test.ts`: a asserção de `logo_url` (l. 433–434) passa de `values[9]` para `values[10]`; adicionar asserção `values[9]` igual ao `identity_state` importado; manter `brand_color` em `values[8]` (l. 480–481) e `segment` em `values[2]`; adicionar teste negativo de coluna fora da allowlist (ex.: `accent_color` ou `user_id`) ainda recusada; adicionar teste fail-closed de `identity_state` ausente e de valor desconhecido (ex.: `"legacy"`) interrompendo a importação com `import_store_identity_state_invalid`, sem uploads e sem statements no DB.
  </action>
  <verify>
    <automated>npx vitest run src/lib/lab/bench/__tests__/bench-import.contract.test.ts</automated>
    <automated>grep -v '^#' scripts/lab/48-2-3-bench-import-stores.mjs | grep -c identity_state (esperado 3 ou mais: allowlist, sanitized row, upsert)</automated>
  </verify>
  <done>`identity_state` é aceito pela allowlist, carregado no saneamento e persistido no upsert (INSERT + EXCLUDED); os índices do teste de contrato refletem a nova ordem.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Criar resolver puro de identidade `resolve-bench-identity.ts` + testes</name>
  <files>src/lib/lab/bench/domain/resolve-bench-identity.ts, src/lib/lab/bench/__tests__/resolve-bench-identity.test.ts</files>
  <behavior>
    - `text_only` retorna `reference: null` com motivo `text_only:no_identity_image`.
    - `logo` seleciona a variante por prioridade `normalized → original → on_dark` com base na **presença do registro ativo** (não na URL assinada).
    - `logo` sem variante ativa presente retorna `reference: null` com motivo `logo:missing_active_asset`.
    - `visual_signature` seleciona a VS ativa; sem VS ativa retorna `reference: null` com motivo `visual_signature:missing_active_signature`.
    - A referência devolvida é um **descritor** (`kind`, `variantType`, `storagePath`) — sem URL assinada e sem I/O.
    - Coexistência de logo e assinatura escolhe apenas o que casa com `identity_state`.
    - Mesma entrada produz mesma saída (determinismo); módulo sem I/O.
  </behavior>
  <action>
    Criar módulo puro e determinístico (sem I/O, sem `process.env`, sem client Supabase, sem `await`, sem importar serviço produtivo), espelhando o estilo de `resolve-bench-brand-color.ts`. Assinatura sugerida (ajustável, mas pura e **sem URL assinada**): entrada `{ identityState: string | null | undefined; logoAssets: Array<{ variantType: string; storagePath: string }>; visualSignature: { storagePath: string } | null }`; saída `{ identityState: "text_only" | "logo" | "visual_signature" | "unknown"; reference: { kind: "logo" | "visual_signature"; variantType: string | null; storagePath: string } | null; reason: string }`. Regras de paridade com `resolveStoreIdentity` (l. 32 e 48–83): validar `identityState` contra o conjunto fechado (`text_only`/`logo`/`visual_signature`); **estado ausente/desconhecido NÃO vira `text_only`** — devolve `reference: null` com `reason: "unknown_identity_state"` (fail-closed, nenhuma imagem); `logo` seleciona a variante por prioridade `normalized → original → on_dark` com base na **presença do registro ativo** (não na URL assinada) e devolve o descritor com `storagePath`; sem nenhuma variante ativa → `reference: null` com `reason: "logo:missing_active_asset"`; `visual_signature` seleciona a VS ativa e devolve o descritor com `storagePath`; sem VS ativa → `reference: null` com `reason: "visual_signature:missing_active_signature"`; `text_only` → `reference: null` com `reason: "text_only:no_identity_image"`. Nunca cair para outro tipo de identidade nem para outra variante quando o asset esperado falta. **A assinatura do asset selecionado é responsabilidade do chamador** (I/O), não do resolver: o descritor selecionado é preservado (kind/variantType/storagePath); se a assinatura do `storagePath` escolhido falhar, o chamador mantém o descritor com `signedUrl: null` e registra o motivo de falha — sem fallback para a variante seguinte. Criar `resolve-bench-identity.test.ts` cobrindo: três estados; prioridade `normalized` sobre `original` sobre `on_dark`; seleção por presença do registro (independe de assinatura); `logo` sem asset ativo; `visual_signature` sem VS ativa; coexistência logo e assinatura (só o que casa com o estado); estado desconhecido → `null` (fail-closed); determinismo (mesma entrada, chamadas repetidas); pureza (asserção lendo o próprio arquivo-fonte de que não importa `@/lib/supabase` nem `@/lib/store-identity-service` e não usa `await`/`process.env`).
  </action>
  <verify>
    <automated>npx vitest run src/lib/lab/bench/__tests__/resolve-bench-identity.test.ts</automated>
    <automated>grep -v '^#' src/lib/lab/bench/domain/resolve-bench-identity.ts | grep -c "await|process.env|supabase|signedUrl" (esperado 0 — resolver puro, sem URL assinada)</automated>
  </verify>
  <done>Resolver puro cobre os três estados, prioridade, ausência, coexistência e determinismo; nenhum fallback criativo.</done>
</task>

<task type="auto">
  <name>Task 3: Expor `identityState` no contrato e eliminar o asset alternativo silencioso</name>
  <files>src/lib/lab/bench/domain/store-manifest.ts, src/lib/lab/bench/domain/schemas.ts, src/lib/lab/bench/domain/branding-service.ts, src/app/api/admin/laboratorio/bancada/branding/route.ts, src/app/(app)/admin/laboratorio/bancada/_components/bench-branding-panel.tsx, src/lib/lab/bench/__tests__/branding-service.test.ts, src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts</files>
  <action>
    `store-manifest.ts`: incluir `identity_state` no `.select(...)` (l. 268); adicionar `identityState: "text_only" | "logo" | "visual_signature"` a `BenchTestStoreRecord` (l. 193–202) e devolvê-lo no retorno (l. 281–290), validando o valor (fail-closed) contra o conjunto fechado. `schemas.ts`: adicionar `BenchIdentityReferenceSchema` (`.strict()`) com `kind: z.enum(["logo", "visual_signature"])`, `variantType: z.string().nullable()`, `storagePath: z.string().min(1)` e **sem** `signedUrl`; adicionar a `BenchBrandingSnapshotSchema` (l. 152–184, `.strict()`) exatamente três campos novos: `identityState: z.enum(["text_only", "logo", "visual_signature"])`, `identityReference: BenchIdentityReferenceSchema.nullable()` e `identityReason: z.string().min(1)`. `branding-service.ts`: em `BenchBrandingContract` (l. 59–92) adicionar `identityState` e expor `identityReference` **transitório** como o descritor selecionado (`{ kind; variantType; storagePath; signedUrl: string | null } | null`) mais `identityReason`. Em `loadBenchBranding` (l. 305–396), `loadBenchBranding` é o **único** lugar que decide qual asset corresponde ao `identity_state`: substituir a derivação `logoUrl` da l. 352 chamando `resolveBenchIdentity` **primeiro** (com `store.identityState`, as variantes ativas `{ variantType, storagePath }` e a assinatura ativa `{ storagePath }`) para **selecionar** o descritor; **só então** assinar o `storagePath` do descritor escolhido (via `signBrandingPath`) e preencher `identityReference.signedUrl` com o resultado; se a assinatura falhar, **preservar o descritor** (`kind`/`variantType`/`storagePath`) com `signedUrl: null` e definir `identityReason` de falha de assinatura (`"logo:sign_failed"`/`"visual_signature:sign_failed"`) — **sem** cair para a variante seguinte; `logoUrl` só é preenchido quando o descritor tem `kind === "logo"` e `signedUrl` não nulo, e `signatureUrl` só quando `kind === "visual_signature"` e `signedUrl` não nulo. `toBenchBrandingSnapshot` (l. 410–416) deve **mapear explicitamente** os campos (não espalhar o contrato inteiro sobre o schema `.strict()`): preservar os campos existentes, propagar `identityState`, `identityReason` e `identityReference` **sem URL** (`{ kind, variantType, storagePath } | null`), e zerar as demais URLs assinadas como já faz hoje. `branding/route.ts`: em `withSignedAssets` (l. 47–63), **não re-resolver identidade** (a rota não chama `resolveBenchIdentity`); apenas **renovar a URL assinada do descritor já selecionado** por `loadBenchBranding`: para `kind === "logo"`, localizar exatamente o asset cujo `storagePath` é igual ao do descritor e assiná-lo; para `kind === "visual_signature"`, renovar exatamente o `storagePath` da assinatura selecionada; associar a URL renovada ao mesmo descritor e a `logoUrl`/`signatureUrl`; em falha, manter `signedUrl: null` sem fallback. Remover a linha 61 ("primeiro asset com signedUrl"). `bench-branding-panel.tsx`: adicionar `identityState`, `identityReference` e `identityReason` a `BenchBrandingView` (l. 35–60) e exibir sem redesenhar o estado da identidade, o asset escolhido (variante/tipo) e o motivo; manter os blocos de Logo/Assinatura (l. 155–188), agora alimentados pelos campos gated pelo estado. Atualizar mocks/asserções em `bench-api.contract.test.ts` (fixture de branding em l. ~308 e mock em l. ~608) e em `branding-service.test.ts` para o novo contrato; adicionar testes: (i) loja `visual_signature` com logo presente não expõe `logoUrl` (e vice-versa); (ii) snapshot `.strict()` válido contendo `identityState`/`identityReference`/`identityReason` e **sem** `signedUrl`; (iii) falha de assinatura **preserva o descritor selecionado** com `signedUrl: null` e `identityReason` de falha, sem fallback para a variante seguinte; (iv) a rota apenas renova a URL do mesmo descritor (não re-resolve identidade): logo localizado pelo `storagePath` selecionado e assinatura pelo path selecionado.
  </action>
  <verify>
    <automated>npx vitest run src/lib/lab/bench/__tests__/branding-service.test.ts src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts</automated>
    <automated>npm run typecheck</automated>
    <automated>git diff --exit-code -- src/lib/store-identity-service.ts src/lib/ai/adapters/bench-images.ts supabase/migrations (esperado vazio)</automated>
  </verify>
  <done>`identityState` chega ao contrato, ao snapshot (`.strict()`, sem `signedUrl`) e à API; a variante é selecionada por prioridade antes da assinatura; `logoUrl`/`signatureUrl` derivam da referência resolvida pelo estado; nenhum asset alternativo silencioso; painel mostra estado, asset e motivo.</done>
</task>

</tasks>

## Required tests

Co-localizados em `src/lib/lab/bench/__tests__/` (e na pasta da API):

1. **`resolve-bench-identity.test.ts` (NOVO)** — três estados; prioridade `normalized > original > on_dark`; seleção por **presença do registro** (independente de assinatura); ausência do asset esperado (`logo` sem asset ativo → `null`; `visual_signature` sem VS → `null`); coexistência logo+assinatura (só o que casa com o estado); estado desconhecido → `null` (fail-closed); determinismo; pureza.
2. **`branding-service.test.ts`** — `identityState` exposto; referência resolvida gated pelo estado; loja `logo` não expõe `signatureUrl` e vice-versa; `text_only` sem imagem; falha de assinatura da variante escolhida → **descritor preservado** (`kind`/`variantType`/`storagePath`) com `signedUrl: null` e `identityReason` de falha, sem fallback para a variante seguinte; snapshot `.strict()` válido com `identityState`/`identityReference`/`identityReason` e **sem** `signedUrl`.
3. **`bench-import.contract.test.ts`** — `identity_state` na allowlist e persistido no upsert; índices atualizados (`brand_color` 8, `identity_state` 9, `logo_url` 10); coluna fora da allowlist ainda recusada; **fail-closed**: `identity_state` ausente e valor desconhecido interrompem a importação (`import_store_identity_state_invalid`) antes da transação, sem uploads e sem statements no DB.
4. **`bench-api.contract.test.ts`** — `GET /branding` retorna `identityState` e a referência canônica; a rota **apenas renova** a URL do descritor já selecionado (não re-resolve identidade): logo localizado pelo `storagePath` selecionado e assinatura pelo path selecionado; falha mantém `signedUrl: null` sem fallback; continua usando o signer restrito (nunca o de artefatos).
5. **Guarda de produção intocada** — teste que lê `src/lib/store-identity-service.ts` e confirma os marcadores canônicos (l. 32 e 48–83) inalterados, **ou** (preferencial) verificação `git diff --exit-code` das fronteiras produtivas no encerramento, espelhando a prova `base..HEAD` vazia usada na F48.2.3.

## Planned local UAT (após reimportação autorizada — NÃO executar no planejamento)

1. Reimportação **idempotente e manual**, somente as duas lojas por ID explícito (a flag `--store` é repetível; `--all` é recusado pelo script):
   `node scripts/lab/48-2-3-bench-import-stores.mjs --store 3dc7d274-0b57-45ba-883a-7b235056feda --store 48b212f8-2b0f-4679-b553-122a601bacac`
   - **Exige autorização humana explícita antes de rodar**; ler os estados reais do remoto durante essa execução (nunca assumir).
2. Abrir `/admin/laboratorio/bancada`, selecionar cada loja e confirmar:
   - loja com estado `logo` → exibe o **logo** correto (variante esperada) e nenhuma assinatura;
   - loja com estado `visual_signature` → exibe a **assinatura** e nenhum logo;
   - caso `text_only` → **nenhuma** imagem de identidade;
   - painel mostra **estado + asset escolhido + motivo** para inspeção.
3. Confirmar que o estado exibido bate com o `identity_state` real de `stores` local (via reimportação), não com um default.

## Completion criteria

- `identity_state` é importado/persistido pela CLI (fail-closed: valor ausente/desconhecido aborta a loja) e exposto em `BenchTestStoreRecord`, `BenchBrandingContract`, `BenchBrandingSnapshotSchema` e na resposta de `GET /branding`.
- A referência de identidade exibida/resolvida é derivada do estado via resolver puro — **nunca** de "primeiro asset com signedUrl"; a variante é selecionada por prioridade **antes** da assinatura; falha de assinatura preserva o descritor com `signedUrl: null` e não cai para a variante seguinte.
- Ponto único de decisão: `loadBenchBranding()` decide qual asset corresponde ao `identity_state`; a rota apenas renova a URL assinada do mesmo descritor (não re-resolve identidade).
- O snapshot `.strict()` contém `identityState`, `identityReference` (kind/variantType/storagePath) e `identityReason`, **sem** `signedUrl`; a URL assinada permanece apenas no contrato transitório da API.
- Resolver puro e determinístico com cobertura dos três estados, prioridade de variante, ausência, coexistência, estado desconhecido (fail-closed) e determinismo.
- Produção intocada (`git diff` vazio em `store-identity-service.ts`, `bench-images.ts`, `supabase/migrations`); nenhuma geração de imagem; nenhum provider; custo US$ 0.
- `npm run typecheck` exit 0; lint sem novos warnings; suíte da bancada verde.

## Risks and boundaries

- **Fronteira de produção:** qualquer alteração em `resolveStoreIdentity` ou no pipeline produtivo é proibida — a fidelidade é alcançada por espelhamento em módulo novo, não por edição do produtivo.
- **Reimportação remota:** é a única operação que lê o remoto; permanece read-only, via CLI explícita, com autorização humana prévia; nenhuma credencial/URL assinada/conteúdo remoto é persistido.
- **Runtime do app:** nunca consulta o remoto; destino validado como Supabase local (`assertLocalHost`).
- **Sem provider:** nenhuma chamada paga; sem envio de logo/assinatura ao modelo.
- **Risco de índice:** a inserção de `identity_state` desloca `logo_url` (9→10); atualizar todas as asserções indexadas no mesmo commit para evitar falso verde.
- **Risco de paridade de seleção:** se a seleção da variante de logo considerar a URL assinada, uma falha ao assinar `normalized` faria a bancada cair para `original` — comportamento que produção **não** tem. Selecionar por **presença do registro** e assinar somente o escolhido; falha de assinatura → descritor preservado com `signedUrl: null` e motivo de falha, sem fallback.
- **Risco de decisão duplicada:** se a rota re-resolver identidade, a decisão de qual asset corresponde ao estado ficaria em dois lugares e poderia divergir. `loadBenchBranding()` é o ponto único de decisão; a rota apenas renova a URL do descritor já selecionado.
- **Risco de `.strict()`:** `toBenchBrandingSnapshot()` espalha o contrato sobre o schema; adicionar `identityReference`/`identityReason` sem declará-los no snapshot (ou sem mapear explicitamente) quebra o parse. O snapshot deve mapear campos explicitamente, conter `identityState`/`identityReference` (kind/variantType/storagePath) e `identityReason`, e **nunca** `signedUrl`.
- **Risco de fail-closed:** importar `identity_state` inválido/ausente deve **abortar** a loja com erro sanitizado antes da transação; converter silenciosamente para `text_only` esconderia a própria falha de fidelidade que esta quick corrige.
- **Risco de mock:** o novo campo obrigatório em `BenchBrandingContract`/schema `.strict()` pode quebrar mocks/asserções existentes — atualizá-los é parte da Task 3, não um desvio.
- **Fora de escopo:** enviar a identidade resolvida ao modelo e sua orientação no prompt pertencem à **F48.2.4** — declarado explicitamente abaixo. Se o escopo deixar de ser pequeno/corretivo, **parar e propor fase separada** em vez de expandir.

## Real size estimate

- **Arquivos tocados:** 7 de produção/teste + 2 novos (resolver + teste do resolver) + 2 testes atualizados ≈ 11 arquivos.
- **LOC (balpark):** ~170–220 LOC de código-fonte; ~230–300 LOC de testes; total ~400–520 LOC.
- **Testes:** ~32–42 casos novos/atualizados (resolver ~14–18; branding-service ~7–9 incl. snapshot sem `signedUrl` e falha de assinatura; import contract ~7–9 incl. fail-closed; API contract ~3–4; guarda ~1–2).
- **Custo de contexto estimado:** Task 1 ~8–12%; Task 2 ~18–22%; Task 3 ~30–35%; total ~60–65% (acima do alvo de 50% por ser correção transversal — se a Task 3 crescer, dividir em 3a domínio e 3b API/UI).

## Declaração explícita de fronteira

O **transporte da referência de identidade ao modelo** (envio de logo/assinatura como referência) e sua **orientação no prompt** **NÃO** fazem parte desta correção — permanecem para a **F48.2.4 (Experimento determinístico Oferta 1:1)**. Esta task apenas garante que o estado e a referência correta sejam persistidos, resolvidos e visíveis na bancada.

## Adendo — correção complementar de idempotência (mesma quick, sem ampliar escopo)

**Causa real (confirmada pelos logs do Storage local):** a primeira reimportação
das duas lojas falhou com `import_destination_upload_failed:The upstream server is
timing out`. O objeto content-addressed da assinatura da NovaTek **já existia**; o
upload com `upsert: false` fez o Storage registrar internamente
`KeyAlreadyExists`/`ResourceAlreadyExists`; o erro do cliente **não** trouxe texto
confiável de duplicidade e a detecção por regex em `error.message` não garantiu a
idempotência. O Storage local estava saudável — não foi indisponibilidade.

**Separação de objetos (semântica adotada):**
- `referencedObjects` — todos os objetos exigidos pela nova identidade;
- `createdObjects` — somente os criados nesta tentativa;
- `reusedObjects` — content-addressed já existentes e validados.

Cleanup: falha na materialização ou na transação remove **somente `createdObjects`**;
reutilizados/preexistentes nunca são removidos; após o commit remove
`oldObjects − referencedObjects`. A transação usa os paths de todos os objetos
referenciados (criados ou reutilizados).

**Garantia idempotente:** `ensureContentAddressedObject` — pré-checagem local por
checksum; existente idêntico → reutiliza; existente divergente → erro sanitizado de
integridade (sem overwrite/remoção); ausente → upload `upsert:false`; erro
ambíguo/timeout → **uma** leitura de confirmação; duplicidade não é reconhecida por
regex de mensagem.

**Contadores honestos:** `objectsWritten` = criados nesta tentativa; `objectsReused`;
`objectsReferenced`; auditoria `assetCount`/`objectCount` = conjunto final referenciado.

**Testes:** `ensureContentAddressedObject` (5 casos), `materializeStoreAssets`
(reuso e cleanup seletivo), idempotência de duas importações consecutivas sobre o
mesmo destino, e teste integrado local real (PostgreSQL + Storage) executando a
importação duas vezes com origem fake (sem remoto) e cleanup integral.

**Estado:** implementação corrigida e testada; **reimportação remota e UAT ainda
pendentes de nova autorização humana** (não executados).

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CLI import → Supabase remoto | leitura read-only de `stores`/branding de origem via CLI explícita |
| CLI import → Supabase local | escrita saneada em `stores` local (incl. `identity_state`) |
| API admin `/branding` → app runtime | leitura local de branding/identidade com signer restrito |
| app runtime → provider de imagem | **não cruzado nesta task** (nenhuma chamada) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260929-01 | Tampering | `buildStoreUpsert` (`identity_state`) | mitigate | valor vem de `assertValidIdentityState(store.identity_state)` (conjunto fechado, fail-closed); CHECK do banco reforça `('text_only','logo','visual_signature')` |
| T-260929-05 | Tampering | seleção de variante vs assinatura | mitigate | seleção por prioridade **antes** da assinatura; falha de assinatura preserva o descritor com `signedUrl: null` e não cai para a variante seguinte (paridade com produção); rota não re-resolve (ponto único: `loadBenchBranding`) |
| T-260929-06 | Information Disclosure | snapshot de branding `.strict()` | mitigate | `toBenchBrandingSnapshot` mapeia explicitamente e remove `signedUrl`; snapshot contém só `kind`/`variantType`/`storagePath` |
| T-260929-02 | Information Disclosure | URL assinada de asset/assinatura | mitigate | `identityReference` expõe apenas a URL assinada efêmera já existente; snapshot persiste sem URLs (`toBenchBrandingSnapshot`) |
| T-260929-03 | Spoofing | resolução de identidade | mitigate | resolver puro determinístico; nunca troca de tipo de identidade quando o asset esperado falta |
| T-260929-04 | Elevation of Privilege | leitura remota a partir do runtime | accept | runtime nunca consulta o remoto; apenas a CLI explícita, com autorização humana e `assertLocalHost` no destino |
| T-260929-SC | Tampering | instalações npm/pip/cargo | accept | nenhuma dependência nova é adicionada por esta correção |
</threat_model>

## Output

Atualizar `.planning/quick/260929-rtl-f48-2-3-identity-state-fidelity-fix/` com o resumo da execução quando (e se) autorizada.
