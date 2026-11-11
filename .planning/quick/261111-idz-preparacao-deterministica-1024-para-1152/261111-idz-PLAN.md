---
phase: 261111-idz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/campaign/square-preparation/types.ts
  - src/lib/campaign/square-preparation/recipe.ts
  - src/lib/campaign/square-preparation/reuse-compatibility.ts
  - src/lib/campaign/square-preparation/reuse-evidence.ts
  - src/lib/campaign/square-preparation/transform.ts
  - src/lib/campaign/square-preparation/prepare.ts
  - src/lib/campaign/square-preparation/__tests__/reuse-compatibility.contract.test.ts
  - src/lib/campaign/square-preparation/__tests__/transform.contract.test.ts
  - src/lib/campaign/square-preparation/__tests__/prepare.contract.test.ts
  - src/lib/campaign/square-preparation/__tests__/support/jpeg-fixtures.ts
  - src/lib/campaign/square-preparation/__tests__/support/fake-artifact-backend.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Um artefato interno square_original JPEG 1024×1024 produz, sem IA e sem crédito, um square_prepared JPEG 1152×1152 persistido pelo F60.1."
    - "O original permanece byte-a-byte, linha e objeto inalterados; nenhum upload/delete/update atinge o path de origem."
    - "Repetir a mesma chamada devolve persistence 'reused' sem segundo upload, segunda linha, transformação nem persistência, somente após verificar a evidência durável do objeto prepared."
    - "Evidência durável ausente, inválida, divergente ou indisponível nunca retorna 'reused' pelo atalho; o fluxo cai na autoridade F60.1 e devolve conflito/indeterminado sem sobrescrever."
    - "Fonte ausente, inválida, truncada, 1080, metadata_conflict, storage indeterminado, autorização ausente/negada e falha de persistência são recusados com resultado tipado e sem sobrescrever nada."
    - "Nenhuma URL assinada/pública, atualização de campanha, RPC de crédito ou exclusão é executada em nenhum caminho."
  artifacts:
    - path: "src/lib/campaign/square-preparation/types.ts"
      provides: "Contrato de entrada e união discriminada de resultado (puro)"
    - path: "src/lib/campaign/square-preparation/recipe.ts"
      provides: "Receita determinística e limites derivados de ROLE_POLICY"
    - path: "src/lib/campaign/square-preparation/reuse-compatibility.ts"
      provides: "Predicado puro de compatibilidade prepared↔fonte"
    - path: "src/lib/campaign/square-preparation/reuse-evidence.ts"
      provides: "Verificação read-only da evidência durável do prepared, usando helpers F60.1"
    - path: "src/lib/campaign/square-preparation/transform.ts"
      provides: "Pipeline Sharp 1024→1152 com decode completo e verificação F60.1 do output"
    - path: "src/lib/campaign/square-preparation/prepare.ts"
      provides: "Orquestração retrieve→transform→persist→readback sobre F60.1"
  key_links:
    - from: "src/lib/campaign/square-preparation/prepare.ts"
      to: "src/lib/campaign/composition-artifacts/retrieve.ts"
      via: "retrieveCompositionArtifact para fonte e para prepared"
      pattern: "retrieveCompositionArtifact"
    - from: "src/lib/campaign/square-preparation/prepare.ts"
      to: "src/lib/campaign/composition-artifacts/persist.ts"
      via: "persistCompositionArtifact com origin deterministic_preparation e source internal_artifact"
      pattern: "deterministic_preparation"
    - from: "src/lib/campaign/square-preparation/transform.ts"
      to: "src/lib/campaign/composition-artifacts/integrity.ts"
      via: "verifyCompositionArtifactBytes(output, \"square_prepared\")"
      pattern: "verifyCompositionArtifactBytes"
    - from: "src/lib/campaign/square-preparation/reuse-evidence.ts"
      to: "src/lib/campaign/composition-artifacts/evidence.ts"
      via: "buildObjectEvidence + verifyObjectEvidence para a evidência durável do prepared"
      pattern: "verifyObjectEvidence"
    - from: "src/lib/campaign/square-preparation/reuse-evidence.ts"
      to: "src/lib/campaign/composition-artifacts/storage.ts"
      via: "CompositionArtifactStorage.readObjectInfo"
      pattern: "readObjectInfo"
---

<objective>
Criar um módulo server-only independente que prepara deterministicamente um artefato interno `square_original` JPEG 1024×1024 em um artefato interno `square_prepared` JPEG 1152×1152, reutilizando integralmente os contratos, a persistência, a recuperação, a proveniência e a idempotência da F60.1.

Purpose: a expansão 9:16 precisará de um quadrado 1152×1152 como entrada. Esta fatia entrega somente essa preparação geométrica determinística — sem IA, sem crédito, sem entrega — para que a fase de expansão seguinte não reinvente persistência nem proveniência.

Output: módulo `src/lib/campaign/square-preparation/` com 6 arquivos de produção, 3 suítes focadas e 2 apoios de teste; nenhuma alteração em F60.1, migrations, rotas, UI, flags ou banco.

Escopo estrito: NÃO gera/compoõe 1:1, NÃO expande com IA, NÃO toca crédito, campanhas/entrega, UI, rotas, orquestradores, downloads, flags, deploy, merge/push. Sem 1080 de entrada e sem outras dimensões. Sem migration e sem alteração de contrato normativo.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@docs/fluxo-de-desenvolvimento.md
@.planning/phases/60.1-f60-1-persistencia-e-recuperacao-de-artefatos-reutilizaveis/60.1-CONTEXT.md
@openspec/specs/campaign-composition-artifacts/spec.md
@src/lib/campaign/composition-artifacts/types.ts
@src/lib/campaign/composition-artifacts/role-policy.ts
@src/lib/campaign/composition-artifacts/artifact-path.ts
@src/lib/campaign/composition-artifacts/identity.ts
@src/lib/campaign/composition-artifacts/integrity.ts
@src/lib/campaign/composition-artifacts/retrieve.ts
@src/lib/campaign/composition-artifacts/persist.ts
@src/lib/campaign/composition-artifacts/source-validation.ts
@src/lib/campaign/composition-artifacts/storage.ts
@src/lib/campaign/composition-artifacts/repository.ts
@src/lib/campaign/composition-artifacts/conflict-decision.ts
@src/lib/campaign/composition-artifacts/evidence.ts
@src/lib/product-vertical-9-16/artifact/resize.ts
@src/lib/campaign/composition-artifacts/__tests__/persist.contract.test.ts

## Diagnóstico — encaixe nos contratos F60.1 (verificado por leitura)

1. **Nenhum contrato novo é necessário.** `ROLE_POLICY` já declara `square_prepared` = 1:1, 1152×1152, `image/jpeg`; a tabela `campaign_composition_artifacts` já aceita `role = 'square_prepared'`, `format = '1:1'`, `origin = 'deterministic_preparation'`, `storage_bucket = 'campaign-internal-artifacts'` e `mime_type = 'image/jpeg'`; o path canônico `{store}/{campaign}/{operation}/square_prepared.jpg` já é gerado por `compositionArtifactStoragePath`. **Confirmado: sem migration e sem alteração normativa (decisão 2).**
2. **`persistCompositionArtifact` já cobre a escrita.** Aceita `origin: "deterministic_preparation"` com `source: { kind: "internal_artifact", artifactId }` (rejeita `source.kind === "none"` fora de `provider_generation`, e rejeita `delivered_campaign_source` para esse caso não é necessário aqui). Deriva a proveniência allowlisted a partir da fonte **revalidada** (`sourceProvenance`): `sourceOrigin`, `sourceStoragePath`, `sourceWidth`, `sourceHeight`, `sourceMimeType`, `sourceChecksumSha256`, `derivedFromArtifactId`. A evidência durável vai no mesmo upload e sobrevive à falha do insert.
3. **Lacuna real, estreitada no nosso módulo.** `validateInternalArtifactSource` (usado pela persistência) aceita `role ∈ { square_original, square_prepared }` — a F60.1 é deliberadamente mais ampla. A decisão 6 exige `square_original` exato; portanto **o nosso módulo valida esse papel na entrada e nunca altera a F60.1**.
4. **`retrieveCompositionArtifact` já cobre leitura e validação.** Devolve `integral` (bytes + `ArtifactRecord`), `absent`, `invalid(reason)`, `metadata_conflict(artifact, reason)` e `indeterminate`. Ausência de artefato = ausência de **linha**; quando a linha existe e o objeto não, o passo (4) também devolve `absent` — comportamento documentado na decisão 11.
5. **Falhas de acesso chegam como `invalid`.** `verifyCampaignAccess` produz `not_owner` / `store_mismatch` / `identity_conflict` e `retrieve` os reembala em `{ kind: "invalid", reason }`. O módulo precisa separar esses três casos (autorização) dos demais motivos de invalidez (conteúdo/metadados).
6. **F60.1 é a única autoridade de idempotência.** `decidePersistOutcome` exige conteúdo **e** proveniência **e** evidência compatíveis para `reused`; `content_conflict`, `identity_conflict`, `metadata_conflict`, `provenance_conflict`, `integrity_failure(object_absent)`, `indeterminate` e `persistence_failure` já são explícitos e nunca sobrescrevem. O nosso módulo **não** cria chave, lock, tabela, retry ou mecanismo paralelo.
7. **`verifyCompositionArtifactBytes`** aplica limites antes do decode, exige `jpeg` real e faz **decode completo** de pixels contra a política do papel — é o verificador do nosso output, sem reimplementar decodificação.
8. **`retrieveCompositionArtifact` não verifica a evidência durável.** Ele compara bytes↔linha, mas não lê a metadata do objeto. O atalho de reuse, portanto, precisa de uma checagem adicional: montar a evidência esperada com `buildObjectEvidence`, ler a metadata com `CompositionArtifactStorage.readObjectInfo` e validar com `verifyObjectEvidence`. Isso fecha a lacuna sem alterar a F60.1: evidência ausente, inválida, divergente ou indisponível **não** pode retornar `reused`; o fluxo cai na persistência F60.1, que classifica o conflito/indeterminado e nunca sobrescreve.

**Aceite remoto da F60.1:** o fluxo remoto permanece funcional após o deploy; isso é registrado apenas como **compatibilidade observada**. Este plano não presume que a migration da F60.1 esteja aplicada no Supabase remoto, não consulta o ambiente remoto e não depende disso para a implementação ou para os testes offline. Qualquer integração real continua exigindo autorização separada.

## Contrato de entrada e saída (formas TypeScript)

`src/lib/campaign/square-preparation/types.ts` (puro — importa apenas tipos da F60.1):

```ts
import type {
  ArtifactRecord,
  AuthorizationContext,
} from "@/lib/campaign/composition-artifacts/types";

export interface PrepareSquareSourceIdentity {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: "square_original";
}

export interface PrepareSquareInput {
  readonly source: PrepareSquareSourceIdentity;
  readonly preparedOperationId: string;
  readonly authorization: AuthorizationContext;
}

export type PrepareSquareInvalidReason =
  | "source_identity_invalid"
  | "prepared_identity_invalid"
  | "source_role_not_original"
  | "prepared_operation_missing"
  | "authorization_missing"
  | "authorization_invalid"
  | "path_not_accepted"
  | "url_not_accepted";

export type PrepareSquareResult =
  | {
      readonly kind: "prepared";
      readonly artifact: ArtifactRecord;
      readonly bytes: Buffer;
      readonly persistence: "created" | "reused";
    }
  | { readonly kind: "invalid_input"; readonly reason: PrepareSquareInvalidReason }
  | {
      readonly kind: "authorization_denied";
      readonly reason: "not_owner" | "store_mismatch" | "identity_conflict";
    }
  | {
      readonly kind: "source_unavailable";
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
      readonly detail?: string;
      readonly artifact?: ArtifactRecord;
    }
  | {
      readonly kind: "transform_failed";
      readonly reason:
        | "source_not_jpeg"
        | "source_dimension_mismatch"
        | "source_decode_failed"
        | "output_verification_failed";
      readonly detail?: string;
    }
  | {
      readonly kind: "conflict";
      readonly reason:
        | "content_conflict"
        | "identity_conflict"
        | "metadata_conflict"
        | "provenance_conflict";
      readonly detail: string;
      readonly existing: ArtifactRecord | null;
    }
  | {
      readonly kind: "persistence_failed";
      readonly reason: "integrity_failure" | "persistence_failure" | "invalid_input";
      readonly detail: string;
      readonly storagePath?: string;
    }
  | {
      readonly kind: "readback_failed";
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
      readonly detail?: string;
      readonly artifact?: ArtifactRecord;
    }
  | { readonly kind: "indeterminate"; readonly stage: "persist" };
```

`transform.ts` (server-only) expõe:

```ts
export type SquareTransformResult =
  | {
      readonly ok: true;
      readonly bytes: Buffer;
      readonly width: 1152;
      readonly height: 1152;
      readonly mimeType: "image/jpeg";
    }
  | {
      readonly ok: false;
      readonly reason:
        | "source_not_jpeg"
        | "source_dimension_mismatch"
        | "source_decode_failed"
        | "output_verification_failed";
      readonly detail?: string;
    };

export async function transformSquare1024To1152(
  bytes: Buffer,
): Promise<SquareTransformResult>;
```

`prepare.ts` (server-only) expõe:

```ts
export interface PrepareSquareDeps {
  readonly client?: SupabaseClient;
  /** Costura de teste: prova que `reused` não transforma. Default = receita real. */
  readonly transform?: (bytes: Buffer) => Promise<SquareTransformResult>;
}

export async function prepareSquareForExpansion(
  input: PrepareSquareInput,
  deps?: PrepareSquareDeps,
): Promise<PrepareSquareResult>;
```

`reuse-compatibility.ts` (puro) expõe:

```ts
export interface PreparedCompatibilityInput {
  readonly artifact: ArtifactRecord;
  readonly source: {
    readonly artifactId: string;
    readonly storagePath: string;
    readonly width: number;
    readonly height: number;
    readonly mimeType: string;
    readonly checksumSha256: string;
  };
}

export function isCompatiblePreparedArtifact(
  input: PreparedCompatibilityInput,
): boolean;
```

`reuse-evidence.ts` (server-only) expõe:

```ts
export type ReuseEvidenceResult =
  | { readonly kind: "verified" }
  | {
      readonly kind: "not_verified";
      readonly reason:
        | "row_invalid"
        | "object_absent"
        | "indeterminate"
        | "evidence_missing"
        | "evidence_invalid"
        | "evidence_mismatch";
    };

export async function verifyPreparedReuseEvidence(
  artifact: ArtifactRecord,
  source: { readonly artifactId: string; readonly checksumSha256: string },
  deps?: { readonly client?: SupabaseClient },
): Promise<ReuseEvidenceResult>;
```

Implementação obrigatória: montar a evidência esperada com `buildObjectEvidence` usando a linha do prepared (`storeId`, `campaignId`, `operationId`, `role`, `origin`, dimensões, MIME, bytes, checksum e `provenance`), `sourceKind: "internal_artifact"`, `sourceArtifactId`/`sourceChecksumSha256` da fonte validada; ler a metadata com `CompositionArtifactStorage.readObjectInfo(artifact.storagePath)`; e validar com `verifyObjectEvidence(info.metadata, expected.evidence)`. Nenhum cálculo de evidência é reimplementado. `readObjectInfo` ausente → `object_absent`; indeterminado → `indeterminate`; `buildObjectEvidence` inválido → `row_invalid`.

## Receita de transformação (explícita) e não-garantias

Entrada obrigatória: JPEG, 1024×1024 exatos (o papel `square_original` já é garantido pela F60.1; o transform reafirma como defesa em profundidade). Saída: JPEG 1152×1152 exatos.

- `.resize(1152, 1152, { fit: "fill", kernel: "lanczos3" })` — ambos os canvas são 1:1, logo é **um único fator de escala 9/8 = 1,125**: sem crop, sem pad, sem distorção, sem barra, sem fundo.
- `.toColorspace("srgb")`.
- `.jpeg({ quality: 90, chromaSubsampling: "4:4:4", progressive: false, optimiseCoding: false, mozjpeg: false })`.
- **Proibido no pipeline:** `.rotate()` (nada de auto-orientação por EXIF), `.withMetadata()` (nada de EXIF/ICC copiado), `.flatten()`/`.background()`, `.extend()`, `.extract()`, qualquer edição criativa, banda, moldura ou texto.
- Verificação do **output** por `verifyCompositionArtifactBytes(output, "square_prepared")` (decode completo + política do papel + limites de bytes/pixels). Falha vira `output_verification_failed` com `detail` = motivo de integridade.
- A fonte também sofre decode completo (`sharp(input, { failOn: "error" }).raw().toBuffer(...)`) antes de codificar, para detectar truncamento que `metadata()` não vê — mesmo padrão de `src/lib/product-vertical-9-16/artifact/resize.ts`.

**Não-garantias (declaradas, não prometidas):** a saída **não** é lossless nem pixel-idêntica — JPEG q90 em 1,125× é reamostragem com perda; a fidelidade garantida é de **geometria** (1:1 preservado, sem recorte, marcadores escalados por um único fator) dentro da tolerância de Lanczos3 + JPEG. A reprodutibilidade byte-a-byte é garantida **por build de libvips/Sharp**: uma troca de versão do libvips pode gerar checksum diferente para a mesma fonte, e nesse caso a F60.1 responde `content_conflict` sem sobrescrever (fail-closed, comportamento aceito e documentado).

## Comportamento de repetição e conflito

1. **Probe do prepared antes de transformar:** `retrieveCompositionArtifact({ identity: { storeId, campaignId, operationId: preparedOperationId, role: "square_prepared" }, authorization })`.
   - `integral` **e** `isCompatiblePreparedArtifact(...)` verdadeiro **e** `verifyPreparedReuseEvidence(...)` = `verified` → devolve `{ kind: "prepared", artifact, bytes, persistence: "reused" }` **sem transformar e sem persistir**.
   - **Evidência durável é obrigatória para o atalho.** `verifyPreparedReuseEvidence` usa `buildObjectEvidence` + `readObjectInfo` + `verifyObjectEvidence` da F60.1. Se retornar `evidence_missing`, `evidence_invalid`, `evidence_mismatch`, `object_absent`, `indeterminate` ou `row_invalid`, **não** retornar `reused`: seguir para transform + persist, que classifica o conflito/indeterminado e nunca sobrescreve.
   - Compatibilidade exige, simultaneamente: `role === "square_prepared"`, `format === "1:1"`, `origin === "deterministic_preparation"`, `derivedFromArtifactId === source.artifact.id`, `sourceCampaignId === null`, `width === 1152`, `height === 1152`, `mimeType === "image/jpeg"`, `provenance.sourceOrigin === "composition_artifact"`, `provenance.derivedFromArtifactId === source.artifact.id`, `provenance.sourceChecksumSha256` igual (case-insensitive) ao checksum da fonte, `provenance.sourceStoragePath`/`sourceWidth`/`sourceHeight`/`sourceMimeType` iguais aos da fonte. O path canônico já foi provado pelo `retrieve`. O predicado exige o conjunto exato das chaves de proveniência esperadas; chave extra ou ausente retorna `false` (conservador: um falso-negativo apenas cai na autoridade F60.1).
   - **Compatível não significa “bytes recém-transformados”.** A compatibilidade valida integridade (bytes↔linha, via F60.1), papel, formato e vínculo de proveniência com a mesma fonte/checksum; ela **não** reexecuta a transformação para comparar pixels. Assim, um prepared existente gerado por outro build de libvips (bytes diferentes da receita atual) continua reutilizável, sem re-encode e sem overwrite. Se a proveniência for incompatível, o fluxo segue para persist e a F60.1 classifica `content_conflict`/`provenance_conflict`; se o artefato estiver corrompido, `retrieve` não devolve `integral` e o fluxo também segue para a autoridade.
   - **Nenhum outro caso curto-circuita:** `integral` incompatível, evidência não verificada, `absent`, `invalid` (não-autorização), `metadata_conflict` e `indeterminate` seguem para transform + `persistCompositionArtifact`, que decide. Se a linha existe e o objeto sumiu, `retrieve` devolve `absent`; **não** interpretar como “não há linha” e **não** curto-circuitar: persistir e deixar a F60.1 devolver `integrity_failure` / `object_absent` sem overwrite.
   - Exceção estreita e deliberada: se o probe devolver `invalid` com `reason` exatamente `not_owner`, `store_mismatch` ou `identity_conflict`, devolver `authorization_denied` **sem** transformar nem persistir (é prova de falta de acesso, não condição de bytes; a F60.1 recusaria de todo modo).
2. **Sem mecanismo paralelo:** nenhuma chave de unicidade nova, nenhum lock, nenhuma tabela, nenhum retry, nenhum `upsert:true`, nenhum delete/correção de linha ou objeto. `reused`/conflito/corrida pertencem exclusivamente à F60.1.
3. **Ordem final:** retrieve da fonte → probe do prepared (linha + evidência durável) → se não reutilizável, `transformSquare1024To1152` → `persistCompositionArtifact({ identity: prepared, authorization, bytes: output, origin: "deterministic_preparation", source: { kind: "internal_artifact", artifactId: source.artifact.id } })` (sem `sourceCampaignId`, sem `provenance` arbitrária) → `retrieveCompositionArtifact` do prepared e devolução do `artifact` + `bytes` lidos.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Contratos puros, receita e predicado de compatibilidade</name>
  <files>src/lib/campaign/square-preparation/types.ts, src/lib/campaign/square-preparation/recipe.ts, src/lib/campaign/square-preparation/reuse-compatibility.ts, src/lib/campaign/square-preparation/__tests__/reuse-compatibility.contract.test.ts</files>
  <action>Criar `types.ts` como módulo puro (sem `server-only`, sem `sharp`, sem Supabase) com exatamente as formas do bloco `<context>`: `PrepareSquareSourceIdentity` com `role: "square_original"` literal, `PrepareSquareInput`, `PrepareSquareInvalidReason` e a união discriminada `PrepareSquareResult` com os 9 membros (`prepared`, `invalid_input`, `authorization_denied`, `source_unavailable`, `transform_failed`, `conflict`, `persistence_failed`, `readback_failed`, `indeterminate`). Importar `ArtifactRecord`/`AuthorizationContext` com `import type` de `@/lib/campaign/composition-artifacts/types` (decisão 5: reusar tipos F60.1, nunca duplicar). Não redefinir papel, formato, limite de bytes/pixels nem motivo de integridade.

Criar `recipe.ts` puro que **deriva** de `ROLE_POLICY` (nunca repete números soltos): `SQUARE_PREPARATION_SOURCE` (`role: "square_original"`, `width`/`height`/`mimeType` de `ROLE_POLICY.square_original`), `SQUARE_PREPARATION_TARGET` (`role: "square_prepared"`, idem), `SQUARE_PREPARATION_ORIGIN = "deterministic_preparation"`, e `SQUARE_PREPARATION_RECIPE` congelado com `fit: "fill"`, `kernel: "lanczos3"`, `colorspace: "srgb"` e `jpeg: { quality: 90, chromaSubsampling: "4:4:4", progressive: false, optimiseCoding: false, mozjpeg: false }`, mais `scale: { numerator: 9, denominator: 8 }` documentando o fator único exato (1024 × 9/8 = 1152). Comentar, no próprio arquivo, as não-garantias: JPEG é lossy, não há promessa de pixel-identidade/lossless, e a reprodutibilidade byte-a-byte é por build de libvips.

Criar `reuse-compatibility.ts` puro exportando `isCompatiblePreparedArtifact(input: PreparedCompatibilityInput): boolean`. Implementar exatamente as 13 condições do bloco `<context>` (papel, formato, origem, `derivedFromArtifactId` de coluna e de proveniência, `sourceCampaignId === null`, dimensões 1152, MIME, `provenance.sourceOrigin === "composition_artifact"`, checksum de fonte case-insensitive, e `sourceStoragePath`/`sourceWidth`/`sourceHeight`/`sourceMimeType` iguais). Ser **conservador**: qualquer chave ausente, tipo inesperado, `provenance` não-objeto ou divergência retorna `false` (o custo de falso-negativo é apenas uma chamada extra à F60.1; falso-positivo devolveria `reused` sem consultar a autoridade). Nunca lançar. Não importar `server-only`.

Criar `__tests__/reuse-compatibility.contract.test.ts` com `// @vitest-environment node`, cobrindo: caso compatível completo → `true`; cada divergência isolada (origem `ai_expansion`, `derivedFromArtifactId` de outro artefato, `sourceCampaignId` preenchido, `sourceOrigin: "new_flow_1_1"`, checksum diferente, `sourceStoragePath` diferente, largura/altura 1024, MIME png, `provenance` ausente, `provenance` com chave extra irrelevante) → `false`; checksum em maiúsculas na proveniência → `true` (comparação case-insensitive); entrada malformada (`provenance: null` via cast de teste) → `false` sem lançar. Importar apenas o predicado, `ROLE_POLICY` e o tipo `ArtifactRecord`; montar o record de fixture manualmente (sem I/O). Não tocar em nenhum arquivo da F60.1.</action>
  <verify>
    <automated>npm.cmd exec --no-install vitest run src/lib/campaign/square-preparation/__tests__/reuse-compatibility.contract.test.ts</automated>
  </verify>
  <done>`types.ts` e `recipe.ts` não importam `server-only`, `sharp` ou Supabase (grep vazio para esses três em ambos); `recipe.ts` obtém todos os números de `ROLE_POLICY`; a suíte de compatibilidade passa e cobre as 13 condições individualmente, com `false` em toda divergência e sem lançar em entrada malformada.</done>
</task>

<task type="auto">
  <name>Task 2: Pipeline Sharp 1024→1152 e orquestração sobre F60.1</name>
  <files>src/lib/campaign/square-preparation/transform.ts, src/lib/campaign/square-preparation/reuse-evidence.ts, src/lib/campaign/square-preparation/prepare.ts</files>
  <action>Criar `transform.ts` com `import "server-only"`, `import sharp from "sharp"` e `verifyCompositionArtifactBytes`. Exportar `SquareTransformResult` e `transformSquare1024To1152(bytes)`, na ordem: (a) rejeitar `!Buffer.isBuffer(bytes) || bytes.length === 0` → `source_decode_failed`; (b) `sharp(bytes, { failOn: "error" }).metadata()` em `try/catch` (catch → `source_decode_failed`), `format !== "jpeg"` → `source_not_jpeg`; (c) `width !== 1024 || height !== 1024` → `source_dimension_mismatch` usando `SQUARE_PREPARATION_SOURCE` (nunca literais soltos); (d) decode completo da fonte `sharp(bytes, { failOn: "error" }).raw().toBuffer({ resolveWithObject: true })` em `try/catch` → `source_decode_failed`; (e) pipeline exatamente `.resize(SQUARE_PREPARATION_TARGET.width, SQUARE_PREPARATION_TARGET.height, { fit: "fill", kernel: "lanczos3" }).toColorspace("srgb").jpeg({ quality: 90, chromaSubsampling: "4:4:4", progressive: false, optimiseCoding: false, mozjpeg: false }).toBuffer()` em `try/catch` → `source_decode_failed`; (f) `verifyCompositionArtifactBytes(output, "square_prepared")` — se `!ok` → `output_verification_failed` com `detail: integrity.reason`. Retornar `width: 1152`/`height: 1152`/`mimeType: "image/jpeg"` como literais tipados. NÃO chamar `.rotate()`, `.withMetadata()`, `.flatten()`, `.background()`, `.extend()` ou `.extract()`; não copiar EXIF/ICC; não prometer lossless no comentário de cabeçalho (declarar explicitamente a perda de JPEG e a dependência do build de libvips). Nunca lançar: todo caminho de erro é retorno tipado.

Criar `reuse-evidence.ts` com `import "server-only"` exportando `ReuseEvidenceResult` e `verifyPreparedReuseEvidence(artifact, source, deps)` exatamente como no contrato. Implementação: chamar `buildObjectEvidence` (F60.1) com a linha do prepared, `sourceKind: "internal_artifact"`, `sourceArtifactId: source.artifactId`, `sourceOrigin: "composition_artifact"`, `sourceChecksumSha256: source.checksumSha256`, `provenance: artifact.provenance`; se `buildObjectEvidence` falhar → `{ kind: "not_verified", reason: "row_invalid" }`; instanciar `new CompositionArtifactStorage(deps.client)` e chamar `readObjectInfo(artifact.storagePath)`; `absent` → `object_absent`; `indeterminate` → `indeterminate`; `found` → `verifyObjectEvidence(info.metadata, expected.evidence)`, mapeando `ok` → `verified` e falha → `evidence_missing`/`evidence_invalid`/`evidence_mismatch`. Não calcular digest nem comparar campos manualmente; não escrever, apagar ou corrigir metadata. Nunca lançar.

Criar `prepare.ts` com `import "server-only"` exportando `PrepareSquareDeps` (com `client?: SupabaseClient` e a costura opcional `transform?: (bytes: Buffer) => Promise<SquareTransformResult>`, default = `transformSquare1024To1152`) e `prepareSquareForExpansion(input, deps = {})`. Ordem obrigatória, exatamente esta, sem nenhum I/O nos passos 1–3:

(1) Recusar chaves proibidas no topo do input e dentro de `input.source`: `storagePath`, `path`, `bucket`, `storageBucket` → `invalid_input` reason `path_not_accepted`; `url`, `publicUrl`, `signedUrl`, `downloadUrl` → `url_not_accepted` (decisão 6: nada de path/bucket/URL é aceito ou confiável). Usar `Object.prototype.hasOwnProperty`, não truthiness. Checar também que `input`, `input.source` e `input.authorization` são objetos (não `null`/array) antes de acessar chaves.

(2) Validar identidades com `validateArtifactIdentity` da F60.1: `{ storeId, campaignId, operationId: source.operationId, role: source.role }` → falha vira `source_identity_invalid`; papel diferente de `"square_original"` → `source_role_not_original` (a F60.1 aceita `square_prepared` como fonte; nós estreitamos, sem alterar a F60.1). `preparedOperationId` não-string ou vazia → `prepared_operation_missing`; validar `{ storeId, campaignId, operationId: preparedOperationId, role: "square_prepared" }` → falha vira `prepared_identity_invalid`. Nunca derivar `preparedOperationId` da origem; igualdade com `source.operationId` é permitida (o path inclui o papel, então não há colisão) e nenhuma regra de distinção é inventada.

(3) `validateAuthorizationContext(input.authorization)`; falha → `invalid_input` com `authorization_missing`/`authorization_invalid`. Nenhum byte lido antes disso.

(4) Retrieve da fonte: `retrieveCompositionArtifact({ identity: sourceIdentity, authorization }, { client })`; `integral` → guardar `source.artifact`/`source.bytes` e reafirmar `artifact.role === "square_original"`, `width === 1024`, `height === 1024`, `mimeType === "image/jpeg"` (violação → `source_unavailable` reason `invalid`, detail `role_policy_mismatch`); `absent` → `source_unavailable` reason `absent`; `invalid` com `reason` em `{ not_owner, store_mismatch, identity_conflict }` → `authorization_denied`, senão `source_unavailable` reason `invalid` com `detail`; `metadata_conflict` → `source_unavailable` reason `metadata_conflict` com `detail` e `artifact`; `indeterminate` → `source_unavailable` reason `indeterminate`. Nunca prosseguir nos quatro casos de falha (decisão 7).

(5) Probe do prepared (só agora, com a fonte real em mãos): `retrieveCompositionArtifact({ identity: preparedIdentity, authorization }, { client })`. Se `integral` **e** `isCompatiblePreparedArtifact({ artifact, source })` → chamar `verifyPreparedReuseEvidence(artifact, { artifactId: source.artifact.id, checksumSha256: source.artifact.checksumSha256 }, { client })`. Somente `verified` devolve `{ kind: "prepared", artifact, bytes, persistence: "reused" }` **sem transformar e sem persistir**. Qualquer `not_verified` (`row_invalid`, `object_absent`, `indeterminate`, `evidence_missing`, `evidence_invalid`, `evidence_mismatch`) **não** retorna sucesso: prossegue para o passo (6), deixando a persistência F60.1 classificar o conflito/indeterminado. Se o probe retornar `invalid` com `reason` em `{ not_owner, store_mismatch, identity_conflict }` → `authorization_denied` (exceção estreita e deliberada: prova de falta de acesso, nenhum trabalho de transform). Todos os demais desfechos (`integral` incompatível, evidência não verificada, `absent`, `invalid` de conteúdo, `metadata_conflict`, `indeterminate`) **prosseguem** para o passo (6) — inclusive `absent` causado por linha existente com objeto ausente, que não pode ser lido como “sem linha”.

(6) `const transform = deps.transform ?? transformSquare1024To1152;` executar sobre `source.bytes`; `ok === false` → `transform_failed` com `reason`/`detail` propagados; `ok === true` → `output`.

(7) `persistCompositionArtifact({ identity: preparedIdentity, authorization, bytes: output, origin: SQUARE_PREPARATION_ORIGIN, source: { kind: "internal_artifact", artifactId: source.artifact.id } }, { client })` — sem `sourceCampaignId` e sem `provenance` (a F60.1 deriva e revalida). Mapear: `created` → `persistence: "created"`; `reused` → `persistence: "reused"` (o campo `adoption` da F60.1 é interno e não aparece no resultado público; adoção legítima de órfão íntegro continua sendo `reused`); `content_conflict`/`identity_conflict`/`metadata_conflict`/`provenance_conflict` → `conflict` com `reason` = `kind` da F60.1, `detail` = `reason` da F60.1, `existing` preservado; `invalid_input` → `persistence_failed` reason `invalid_input` com `detail`; `integrity_failure` cujo `reason` é `artifact_absent`/`artifact_invalid`/`artifact_indeterminate` → `source_unavailable` correspondente (`absent`/`invalid`/`indeterminate`) com `detail: "persist_source_revalidation:<reason>"` (TOCTOU da fonte entre retrieve e persist); os demais `integrity_failure` (bytes do derivado) → `persistence_failed` reason `integrity_failure` com `detail`; `persistence_failure` → `persistence_failed` reason `persistence_failure` com `detail` + `storagePath`; `indeterminate` → `indeterminate` stage `persist`.

(8) Readback: `retrieveCompositionArtifact` do prepared; `integral` → devolver `{ kind: "prepared", artifact: readback.artifact, bytes: readback.bytes, persistence }` (os bytes autoritativos são os lidos, decisão 10); qualquer outro caso → `readback_failed` com `reason`/`detail`/`artifact` quando houver.

Não importar nem chamar RPC de crédito, atualização de `campaigns`, `createSignedUrl`, `getPublicUrl`, download público, delete ou qualquer orquestrador. Não alterar nenhum arquivo de `src/lib/campaign/composition-artifacts/**`.</action>
  <verify>
    <automated>npm.cmd run typecheck</automated>
  </verify>
  <done>`transform.ts` e `prepare.ts` compilam no typecheck global; `transform.ts` não contém `rotate`, `withMetadata`, `flatten`, `extend` ou `extract` (grep vazio) e não lança em nenhum caminho; `prepare.ts` só chama `retrieveCompositionArtifact`, `persistCompositionArtifact`, `validateArtifactIdentity`, `validateAuthorizationContext`, `isCompatiblePreparedArtifact`, `verifyPreparedReuseEvidence` e o transform injetado/default — nenhuma reimplementação de autorização, validação de fonte, evidência, proveniência, path ou idempotência; nenhum arquivo da F60.1 modificado.</done>
</task>

<task type="auto">
  <name>Task 3: Apoios determinísticos e matriz de testes offline</name>
  <files>src/lib/campaign/square-preparation/__tests__/support/jpeg-fixtures.ts, src/lib/campaign/square-preparation/__tests__/support/fake-artifact-backend.ts, src/lib/campaign/square-preparation/__tests__/transform.contract.test.ts, src/lib/campaign/square-preparation/__tests__/prepare.contract.test.ts</files>
  <action>Criar `__tests__/support/jpeg-fixtures.ts` gerando fixtures com Sharp a partir de **buffers de pixel crus** (sem fonte, sem texto, sem rede, determinístico): `buildSquare1024Fixture()` monta RGB 1024×1024 com metade esquerda vermelha (200,30,30), metade direita azul (30,30,200), um marcador preto 64×64 centrado em (256,256) e um marcador branco 64×64 centrado em (768,768), codificado com `.jpeg({ quality: 95, chromaSubsampling: "4:4:4" })`; `buildJpeg(width, height)` para tamanhos arbitrários (ex.: 1080×1080, 1152×1152); `buildPng(width, height)` para não-JPEG; `truncateJpeg(bytes)` cortando o buffer pela metade. Exportar também os centróides esperados após escala 1,125 (288,288) e (864,864), o lado esperado de cada marcador após a escala (72 px) e a coluna de transição esperada (576) como constantes nomeadas, para que os testes não repitam números mágicos.

Criar `__tests__/support/fake-artifact-backend.ts` — fake **focado e independente** na fronteira DB/Storage (decisão 13; não refatorar `persist.contract.test.ts`, que mantém o fake local dele). Deve imitar o cliente Supabase o suficiente para `verifyCampaignAccess`, `getArtifactByIdentity`/`getArtifactById`/`getArtifactByStoragePath`, `insertArtifactRow`, `CompositionArtifactStorage.downloadBytes`/`readObjectInfo`/`uploadImmutable`: `from(table)` com `select(cols).eq(...).maybeSingle()`/`.single()` e `insert(row).select().single()` (violação única quando já existe identidade `(store,campaign,operation,role)` ou mesmo `storage_path`, com `code: "23505"`); `storage.from(bucket)` com `upload` (respeitando `upsert:false` e devolvendo 409 `already exists`), `download` (404 `Object not found`), `info` (metadata convertendo `vendeo_composition_artifact` → `vendeoCompositionArtifact`, como o cliente real faz), e contadores `createSignedUrl`/`getPublicUrl`/`remove`/`update`/`list`. Expor handles observáveis: `uploads: { path, options }[]`, `inserts`, `downloads`, `infos`, `signed`, `removes`, `updates`, `rpcCalls` e helpers `seedCampaign`, `seedStore`, `seedArtifactRow`, `putObject`, `removeObject`, `replaceObjectBytes`, `hasObject(path)`, `rowsFor(identity)`, `getObjectMetadata(path)`, `setObjectMetadata(path, metadata)`, `removeObjectMetadata(path)`, `snapshotSource()`, `failNextInsert()`, `setUploadThrows()`, `setDownloadError(bucket?, error)`, `setInfoError(error)`. Nenhum estado global entre testes: cada caso cria sua instância.

Todas as suítes que importam módulos com `import "server-only"` devem declarar `vi.mock("server-only", () => ({}))`; a suíte de `prepare` também deve declarar `vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }))`, pois o client real nunca é usado (o fake é injetado via `deps.client`). Seguir o padrão já usado em `persist.contract.test.ts`.

Criar `__tests__/transform.contract.test.ts` (`// @vitest-environment node`, Sharp real): 1024×1024 → bytes JPEG decodificáveis 1152×1152, 3 canais, formato `jpeg`; 1080×1080 → `source_dimension_mismatch`; 1152×1152 → `source_dimension_mismatch`; PNG 1024×1024 → `source_not_jpeg`; JPEG truncado → `source_decode_failed`; buffer vazio/`null`-like → `source_decode_failed`; determinismo: duas execuções sobre o mesmo buffer produzem checksums SHA-256 idênticos (usar `computeChecksumSha256` da F60.1 apenas como utilitário de hash); nenhuma exceção lançada em qualquer caso (wrapper `expect(...).resolves` sem `rejects`).

Criar `__tests__/prepare.contract.test.ts` (`// @vitest-environment node`, Sharp real, fake DB/Storage, zero rede/banco/IA). Montar o cenário base semeando `campaigns(id, store_id)`, `stores(id, user_id)`, a linha `square_original` com `storage_path` canônico, checksum/byteSize/dimensões reais das fixtures e o objeto correspondente no bucket `campaign-internal-artifacts`; `authorization: { kind: "system" }` como padrão e um caso `owner`. Cobrir, no mínimo:

| Bloco | Asserção central |
|---|---|
| criação | `kind: "prepared"`, `persistence: "created"`, 1 upload no path `.../{preparedOperationId}/square_prepared.jpg`, 1 insert, `artifact.role/format/origin/derivedFromArtifactId/sourceCampaignId(null)/width/height/mimeType` corretos, `provenance` com as 7 chaves derivadas e `sourceChecksumSha256` da fonte, evidência no objeto (`vendeo_composition_artifact.evidence.sourceArtifactId` = id da fonte, `origin: "deterministic_preparation"`, `operationId` = prepared) |
| geometria | decodificar os bytes devolvidos: 1152×1152, 3 canais; transição vermelho→azul na linha y=100 ocorrendo em 576 ± 3; centróide do marcador preto em (288,288) ± 4 e do branco em (864,864) ± 4; **bounding box de cada marcador com largura e altura ≈72 px e razão largura/altura ≈1,0 ± 0,03** (prova de escala uniforme, sem distorção anamórfica); amostras (8,8) e (8,1143) vermelhas, (1143,8) e (1143,1143) azuis; nenhum pixel de borda quase-preto em (0,0)/(1151,0)/(0,1151)/(1151,1151) — prova de ausência de pad; documentar em comentário que as tolerâncias (±3 px na transição, ±4 px no centróide, ±3 px no lado, ±0,03 na razão) cobrem o ringing do Lanczos3 e o erro de quantização do JPEG q90 e que elas **não** cobrem crop/pad/distorção, que deslocariam a transição/centróides por dezenas de pixels ou alterariam a razão do marcador |
| original preservado | snapshot da linha e do objeto de origem antes/depois idênticos (bytes, checksum, dimensões, `storage_path`); nenhum upload/remoção/atualização com o path de origem; contagem de linhas da origem inalterada |
| idempotência | segunda chamada idêntica → `persistence: "reused"`, mesmos `artifact.id`/checksum/bytes, `uploads` ainda 1, `inserts` ainda 1, `rowsFor(prepared)` 1, `hasObject(prepared)` 1; com a costura `transform` injetada contando chamadas, a segunda chamada **não** invoca o transform **e** a evidência durável do objeto é verificada (helper `verifyPreparedReuseEvidence`). Caso adicional: prepared compatível cujos bytes foram codificados com outra qualidade (diferentes da receita atual) → `reused` e transform **não** invocado, provando que a compatibilidade é de proveniência/integridade, não de igualdade com a nova codificação |
| evidência durável | após criar o prepared, adulterar/remover a metadata do objeto e repetir a chamada. Casos: metadata ausente → `conflict` `provenance_conflict` detail `evidence_missing`; metadata `"{not-json"` → `evidence_invalid`; `evidenceDigest` adulterado → `evidence_mismatch`; campo da evidência divergente com digest recalculado → `evidence_mismatch`; `setInfoError` → `indeterminate` stage `persist`. Em **todos**: resultado **não** é `prepared`/`reused`; o transform **é** invocado (o atalho foi recusado); `uploads`/`inserts` não aumentam; `removes` 0; linha e objeto do prepared permanecem como estavam (nenhuma sobrescrita/correção) |
| recusas de entrada | autorização `undefined`/`null` → `invalid_input` `authorization_missing`; `role: "square_prepared"` → `source_role_not_original`; `preparedOperationId` ausente → `prepared_operation_missing`; UUID inválido em `preparedOperationId` → `prepared_identity_invalid`; `storagePath` no topo → `path_not_accepted`; `url` dentro de `source` → `url_not_accepted`; em todos, `downloads`/`uploads`/`inserts` = 0 |
| recusas de fonte | owner de outro usuário → `authorization_denied` `not_owner` sem downloads; campanha de outra loja → `store_mismatch`; linha ausente → `source_unavailable` `absent`; linha presente com objeto removido → `source_unavailable` `absent` sem upload; linha `square_original` apontando para bytes 1080×1080 → `source_unavailable` `invalid`; bytes truncados no objeto → `source_unavailable` `invalid`; `download` com erro 500 → `source_unavailable` `indeterminate`; linha com metadados divergentes → `source_unavailable` `metadata_conflict` com `artifact` |
| persistência | `failNextInsert()` → `persistence_failed` `persistence_failure` com `storagePath`, `rowsFor(prepared)` 0, objeto do prepared ainda presente (não apagado), `removes` 0; `setUploadThrows()` → `persistence_failed`, `removes` 0; ambiguidade em `info` do prepared após upload → `persistence_failed`/`indeterminate` sem delete |
| conflito | linha+objeto prepared pré-existentes **incompatíveis** com a fonte (ex.: `derived_from_artifact_id` de outro artefato) e com bytes diferentes da receita atual → `conflict` `content_conflict` `checksum_mismatch`, objeto intacto, `uploads` 0; linha+objeto prepared com **os mesmos bytes** que o transform produz (obtidos chamando `transformSquare1024To1152` no próprio teste) mas `origin: "ai_expansion"` e `derived_from_artifact_id` de outro artefato → `conflict` `provenance_conflict`, objeto intacto; linha prepared sem objeto → `persistence_failed` `integrity_failure` detail `object_absent`, sem upload e sem recriar objeto |
| ausência de efeitos | em todos os casos: `signed` 0, `removes` 0, `updates` 0, `rpcCalls` 0, linha de `campaigns` e de `stores` inalteradas |

Nenhum teste pode usar `npx`, rede, Supabase real, IA ou chamada paga. Não alterar `persist.contract.test.ts` nem qualquer teste/arquivo da F60.1.</action>
  <verify>
    <automated>npm.cmd exec --no-install vitest run src/lib/campaign/square-preparation</automated>
  </verify>
  <done>As 3 suítes do módulo passam (reuse-compatibility, transform, prepare), com os 2 apoios (`jpeg-fixtures`, `fake-artifact-backend`) carregados sem erro; a matriz cobre criação, geometria com tolerância justificada, original preservado, idempotência sem segundo upload/transform, **evidência durável ausente/inválida/divergente/indisponível sem `reused`**, todas as recusas exigidas pela decisão 13, falha de persistência sem overwrite/delete, conflito explícito com objeto intacto e ausência total de URL/campanha/crédito/delete; nenhum arquivo da F60.1 foi modificado (`git status` restrito ao novo diretório).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| chamador server-side → módulo | identidade e `AuthorizationContext` chegam prontos; o módulo não lê request/body e recusa path, bucket e URL |
| módulo → F60.1 (DB/Storage) | toda autorização, vínculo loja↔campanha, validação de fonte, proveniência, evidência e idempotência pertencem à F60.1 |
| fonte interna → derivado | bytes da fonte atravessam o decoder Sharp; a origem é revalidada pela F60.1 na persistência |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261111-idz-01 | Spoofing | `prepareSquareForExpansion` (autorização) | mitigate | `validateAuthorizationContext` antes de qualquer I/O; `retrieveCompositionArtifact`/`persistCompositionArtifact` revalidam `owner`/`system` e vínculo loja↔campanha; falha de acesso vira `authorization_denied` |
| T-261111-idz-02 | Tampering | path/bucket/URL do chamador | mitigate | recusa explícita de `storagePath`/`path`/`bucket`/`storageBucket`/`url`/`publicUrl`/`signedUrl`/`downloadUrl` com `path_not_accepted`/`url_not_accepted`; o path do derivado é sempre derivado da identidade pela F60.1 |
| T-261111-idz-03 | Tampering | bytes de saída | mitigate | `verifyCompositionArtifactBytes(output, "square_prepared")` após o encode (decode completo + limites + política de papel); falha → `output_verification_failed` |
| T-261111-idz-04 | Repudiation | proveniência do derivado | mitigate | proveniência e evidência derivadas exclusivamente pela F60.1 da fonte revalidada; nenhum `provenance` arbitrário é enviado; o atalho de reuse só retorna `reused` após `buildObjectEvidence` + `readObjectInfo` + `verifyObjectEvidence` |
| T-261111-idz-05 | Information Disclosure | artefato interno | accept | bucket privado `campaign-internal-artifacts` já sem policy para `anon`/`authenticated` (F60.1); o módulo não cria URL assinada/pública nem download |
| T-261111-idz-06 | Denial of Service | CPU/memória do decoder | mitigate | papel/política F60.1 limita bytes (10 MB) e pixels (16,7 MP) antes do decode; entrada restrita a 1024×1024 exatos |
| T-261111-idz-07 | Elevation of Privilege | `service_role` / imutabilidade | accept | `service_role` ignora RLS (limite documentado na F60.1); não sobrescrita depende de `upsert:false` + ausência de delete, ambos preservados |
| T-261111-idz-08 | Tampering | integridade da fonte (TOCTOU) | mitigate | fonte é recuperada/validada duas vezes (probe do módulo + revalidação da persistência); alteração entre etapas resulta em falha explícita da F60.1, sem overwrite |
| T-261111-idz-SC | Tampering | instalações npm | mitigate | nenhuma dependência nova (Sharp e Vitest já presentes); comandos de gate usam `--no-install`; nenhuma migration ou script de instalação |
</threat_model>

<verification>
Executar na ordem, registrando saída e exit code:

1. `npm.cmd exec --no-install vitest run src/lib/campaign/square-preparation`
   - Esperado: 3 arquivos de teste verdes (reuse-compatibility, transform, prepare).
2. `npm.cmd run typecheck` — exit 0.
3. `npm.cmd run lint` — exit 0 (limitação preexistente: o ESLint do projeto não cobre TypeScript; registrar, não corrigir).
4. `git diff --check` — sem erros de whitespace.
5. `git status --porcelain` — apenas os 11 arquivos novos em `src/lib/campaign/square-preparation/`, o PLAN e o SUMMARY; **nenhum** arquivo de `src/lib/campaign/composition-artifacts/**`, `supabase/migrations/**`, `package.json` ou configs de Vitest alterado.

Não executar a suíte global, a suíte de integração real (`npm.cmd run test:integration:*`), banco, Storage real, rede, IA ou chamadas pagas. Qualquer divergência entre o observado e o planejado deve ser registrada no SUMMARY antes de ampliar escopo.
</verification>

<success_criteria>
- `src/lib/campaign/square-preparation/` contém `types.ts`, `recipe.ts`, `reuse-compatibility.ts`, `reuse-evidence.ts`, `transform.ts`, `prepare.ts`, as 3 suítes focadas e os 2 apoios de teste previstos.
- Um `square_original` JPEG 1024×1024 vira um `square_prepared` JPEG 1152×1152 persistido pela F60.1 com `origin: "deterministic_preparation"`, `source.kind: "internal_artifact"`, `derivedFromArtifactId` da fonte e `sourceCampaignId` nulo.
- A geometria é provada por marcadores/quadrantes escalados por 1,125 sem crop/pad, com tolerância justificada; nenhuma promessa de lossless ou pixel-identidade aparece no código ou nos testes.
- O original permanece intacto; repetição é `reused` sem segundo upload/insert/transform somente quando a evidência durável do objeto é verificada; evidência ausente/inválida/divergente/indisponível nunca retorna `reused` e cai na autoridade F60.1.
- Todas as recusas e conflitos da decisão 12/13 têm teste e resultado tipado; nenhum caminho sobrescreve, apaga, assina URL, atualiza campanha ou chama crédito.
- Nenhuma dependência, migration, config, arquivo F60.1 ou teste F60.1 é alterado; typecheck/lint/diff gates verdes.
- Cada task gera um commit atômico (executor), sem push, sem merge, sem deploy.
</success_criteria>

<risks>
1. **Reprodutibilidade atrelada ao libvips.** O checksum de uma **nova** codificação depende do build de Sharp/libvips. Uma atualização de dependência pode gerar bytes diferentes para a mesma fonte. Isso é mitigado pelo probe: um prepared existente compatível é reutilizado sem re-encode, independentemente do build que o gerou. O risco residual aparece quando o prepared está ausente/incompatível e a persistência compara bytes: a F60.1 responde `content_conflict` (fail-closed), nunca sobrescreve. Aceito nesta fatia; a alternativa (cachear bytes ou criar versão de receita na proveniência) exigiria mecanismo/contrato paralelo, proibido pela decisão 11. Registrar como limitação, não corrigir.
2. **Múltiplas leituras de Storage por chamada.** No caminho `created` há até 4 downloads (probe do prepared quando há linha, retrieve da fonte, revalidação da fonte pela persistência, readback) e uma leitura extra de `info` para a evidência durável do atalho. Custo aceito: esta fatia não otimiza I/O e não cria cache paralelo.
3. **Falso-negativo de compatibilidade** devolve `reused` só depois de uma chamada extra à F60.1 (transform + persist). É o lado seguro do trade-off: falso-positivo devolveria `reused` sem a autoridade.
4. **Papel `square_prepared` como fonte.** A F60.1 aceita `square_prepared` em `validateInternalArtifactSource`; um chamador que ignore este módulo pode derivar prepared→prepared. Fora do escopo (decisão 6 estreita apenas a nossa entrada); nenhuma alteração na F60.1.
5. **Evidência durável exige uma leitura adicional e pode falhar fechado.** Se `info` estiver indisponível, o atalho não é usado e a persistência F60.1 devolve `indeterminate`; se a metadata estiver ausente/inválida/divergente, a persistência devolve `provenance_conflict`. Isso é intencional: preferir falha explícita a `reused` sem evidência.
6. **Sem incompatibilidade de contrato identificada.** `ROLE_POLICY`, a tabela, o bucket, o path canônico e `origin: "deterministic_preparation"` já cobrem este caso — não há necessidade de migration nem de alteração normativa (decisão 2 confirmada). Se a revisão discordar, **parar** em vez de planejar em volta.
</risks>

<out_of_scope>
- Geração ou composição 1:1, prompt, copy, tipografia, layout, bandas, moldura, fundo.
- Expansão por IA/9:16, provedores, chamadas pagas, `ai_expansion`, crédito, reserva/confirmação/estorno.
- Entrega de campanha, `campaigns.status`/`storage_path`, downloads, miniaturas, URLs assinadas/públicas, UI, rotas, flags, orquestradores, admin.
- Entrada 1080×1080 ou qualquer dimensão diferente de 1024×1024; saída diferente de 1152×1152.
- Migration, alteração de schema, alteração de spec normativa, alteração de qualquer arquivo/teste da F60.1, refatoração de `persist.contract.test.ts`.
- Suíte global, suíte de integração real (DB/Storage reais), homolog, produção, deploy, merge, push.
- SUMMARY, commit, STATE.md e OpenSpec nesta rodada (somente o PLAN).
</out_of_scope>

<stop_for_review>
**PLANO EXECUTADO — PARAR PARA REVISÃO.**

A execução está registrada em `261111-idz-SUMMARY.md` e nos commits `8b483a03`, `1f43506f`, `73cff523` e no commit documental. Foram criados apenas os 11 arquivos previstos em `src/lib/campaign/square-preparation/`; nenhuma alteração em F60.1, migrations, rotas, UI, banco/Storage real, Docker, IA ou chamada paga. A branch permanece `feat/fase-60-2-praparacao-deterministica-imagem-para-expansao`, sem upstream; não houve push, merge ou deploy. A revisão humana/Codex é o próximo gate antes de qualquer integração.
</stop_for_review>

<output>
Criar `.planning/quick/261111-idz-preparacao-deterministica-1024-para-1152/261111-idz-SUMMARY.md` ao concluir a execução, registrando: arquivos criados; contagem/exit code das 3 suítes focadas; resultado de typecheck, lint e `git diff --check`; saída de `git status` restrita ao novo diretório; confirmação de que nenhum arquivo F60.1/migration/dependência/config foi tocado; e as limitações de determinismo (build de libvips), perda de JPEG e leituras múltiplas de Storage.
</output>
