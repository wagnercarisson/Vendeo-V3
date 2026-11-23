---
phase: 62-adicionar-vertical-campanha-quadrada
plan: 03
subsystem: campaign-format-addition
tags: [bridge, provenance, frozen-economics, pricing, financial-client, delivery-reader, legacy-1024]

requires:
  - phase: 62-adicionar-vertical-campanha-quadrada
    provides: contratos puros e persistência/RPCs/flag do 62-01/62-02
  - phase: 60.1-artefatos-de-composicao
    provides: persistência/readback/evidência de artefatos internos
  - phase: 60.2-persistencia-e-recuperacao-de-artefatos-reutilizaveis
    provides: preparação determinística sobre square_original

provides:
  - opt-in legado 1024 com default 1080 preservado
  - ponte square_original byte-idêntica com origem delivered_campaign_reuse
  - congelamento de seleção/catálogo/pricing/economia sem fallback à campanha
  - cliente financeiro strict das RPCs da adição
  - leitor canônico sanitizado por campanha/identidade

affects: [62-04, 62-05, 62-06, 62-07, 62-08]

tech-stack:
  added: []
  patterns:
    - opt-in explícito default-preserving
    - identidade estável de fonte (operação primária ou UUID sintético)
    - leitores estáticos de configuração congelada
    - allowlists de motivos por RPC
    - DTO sanitizado sem path/URL/snapshot/bytes

key-files:
  created:
    - src/lib/campaign/format-addition/source-registration.ts
    - src/lib/campaign/format-addition/frozen-economics.ts
    - src/lib/campaign/format-addition/financial-client.ts
    - src/lib/campaign/format-addition/delivery-reader.ts
    - src/lib/campaign/format-addition/__tests__/bridge.contract.test.ts
    - src/lib/campaign/format-addition/__tests__/frozen-economics.contract.test.ts
    - src/lib/campaign/format-addition/__tests__/financial-client.contract.test.ts
    - src/lib/campaign/format-addition/__tests__/delivery-reader.contract.test.ts
  modified:
    - src/lib/campaign/composition-artifacts/types.ts
    - src/lib/campaign/composition-artifacts/source-validation.ts
    - src/lib/campaign/composition-artifacts/resolve-source.ts
    - src/lib/campaign/composition-artifacts/persist.ts
    - src/lib/campaign/composition-artifacts/__tests__/resolve-source.contract.test.ts
    - src/lib/campaign/composition-artifacts/__tests__/persist.contract.test.ts

key-decisions:
  - "Legado 1024 é opt-in explícito; sem a opção, 1080 continua sendo o default de todos os consumidores."
  - "ArtifactOrigin ganhou delivered_campaign_reuse explicitamente, sem alterar o tratamento das origens existentes."
  - "A ponte usa operação primária entregue no fluxo novo e UUID sintético determinístico no legado; nunca cria operação financeira."
  - "A economia congelada lê os parâmetros atuais uma única vez; indisponibilidade de câmbio/credito vira null explícito, sem fallback ao snapshot da campanha."
  - "O cliente financeiro usa allowlists fechadas por RPC, incluindo os motivos corrigidos de fonte/path/proveniência."
  - "O leitor prioriza open/delivered mais recente; refunded só quando não há ativo; leitura falha não vira processing."

requirements-completed: [ADD-BRIDGE-04, ADD-ECON-05, COMP-ADD-17]

duration: ~45 min
completed: 2026-11-23
---

# Phase 62 Plan 03: Ponte de proveniência, economia congelada e cliente financeiro

**Opt-in legado 1024 default-preserving, ponte square_original estabilizada, seleção/pricing/economia congeladas sem fallback, cliente financeiro strict e leitor sanitizado**

> **Status: EXECUTADO LOCALMENTE/OFFLINE; CORREÇÕES DIRIGIDAS DA REVISÃO APLICADAS; AGUARDANDO NOVA REVISÃO; NÃO ACEITO.**
> `62-04` **não iniciado**. A migration do 62-02 **não foi aplicada**. Nenhum
> banco, Storage, provider, geração, flag em ambiente, merge, push, deploy,
> sync ou archive.
>
> **Correções dirigidas:** allowlist F60.4 atualizada somente com os seis
> caminhos autorizados e `preflightFrozenExpansion` passou a comparar a seleção
> completa (modelo, qualidade, `configVersionId`, origem) antes de delegar.

## Performance

- **Duration:** ~45 min
- **Started:** 2026-11-23T14:05:00Z (aprox.)
- **Completed:** 2026-11-23T14:50:00Z (aprox.)
- **Tasks:** 5/5
- **Files modified:** 14 (8 criados, 6 alterados)

## Task Commits

1. **Task 1: opt-in legado 1024 + `ArtifactOrigin`** — `bc5c46ea` (feat).
2. **Task 2: ponte estável de proveniência** — `6ea0afd0` (feat).
3. **Task 3: congelamento de seleção/pricing/economia** — `9cb43c39` (feat).
4. **Task 4: cliente financeiro strict** — `04d2433a` (feat).
5. **Task 5: leitor canônico sanitizado** — `3de5fd3a` (feat).
6. **Correção de fronteira:** remoção do import do runtime 1:1 na ponte — `63eddf83` (fix).
7. **Autorização dirigida no plano:** allowlist F60.4 e comparação completa — `fb3f279d` (docs).
8. **Correção dirigida:** seis caminhos na allowlist + seleção completa — `8dd7e254` (fix).

## Files Created/Modified

### Criados

- `source-registration.ts` — identidade estável (operação primária/sintética), download sem transformação, persistência/readback da ponte e revalidação de checksum.
- `frozen-economics.ts` — captura única de seleção/catálogo/pricing/economia, payloads da RPC, parse do congelado e leitores estáticos.
- `financial-client.ts` — wrappers strict de abertura/entrega/estorno, validação local, allowlists por RPC e envelopes fechados.
- `delivery-reader.ts` — leitura server-only por campanha/identidade, prioridade open/delivered e DTO sanitizado.
- 4 suítes de contrato.

### Alterados

- `composition-artifacts/types.ts` — `ArtifactOrigin` + `acceptLegacy1024` explícito.
- `source-validation.ts` — 1024 legado somente com opt-in; 1080 default.
- `resolve-source.ts` — opções propagadas.
- `persist.ts` — revalidação interna com opt-in; defaults preservados.
- `resolve-source.contract.test.ts` e `persist.contract.test.ts` — matriz novo/legado + defaults.

## Contrato implementado

- **Opt-in legado:** `acceptLegacy1024` aceita JPEG 1024×1024 legado no path histórico; sem a opção, 1080 permanece o default. New flow continua 1024.
- **R4:** `ArtifactOrigin` inclui `delivered_campaign_reuse`; nenhuma origem existente mudou de tratamento.
- **Ponte:** identidade = operação primária entregue (fluxo novo, lida pela RPC que exclui adições) ou UUID sintético determinístico (legado). Bytes baixados sem transformação, checksum revalidado antes de reutilizar, `persistCompositionArtifact` com `delivered_campaign_source`, readback e verificação de path/origem/proveniência. Nenhuma operação financeira.
- **R8:** campanha `legacy_campaign` usa a seleção **atual** `configured`; `legacy`/`legacy_sunburst_low` é rejeitado.
- **Economia congelada:** `captureFrozenEconomics` lê seleção/catálogo/pricing uma vez, valida cobertura e lê parâmetros econômicos atuais. Câmbio/credito indisponíveis ficam `null`; **não** usa `readExpansionEconomicSnapshot` nem o snapshot da campanha.
- **Leitores estáticos:** catálogo/pricing sintéticos a partir do congelado; seleção divergente é recusada; `readEconomicSnapshot` devolve os valores gravados.
- **Cliente financeiro:** valida UUIDs/checksum/epoch/token/frozen; envia apenas parâmetros das RPCs; allowlists separadas de abertura/entrega/estorno (incluindo `source_path_*`, `source_provenance_mismatch`, `source_operation_artifact_mismatch`, `vertical_artifact_invalid`, `vertical_provenance_invalid`). Motivo desconhecido/transporte não é sucesso.
- **Leitor:** prioriza open/delivered mais recente; refunded só sem ativo; open + crédito reservado/art_uploaded + outcome não unknown ⇒ processing; unknown/missing ⇒ unknown; falha de leitura ⇒ read_failed. DTO sem path/URL/snapshot/bytes.

## Gates reais

| Gate | Resultado |
|---|---|
| Seis arquivos do plano | **6 arquivos / 93 testes PASS** |
| `npm.cmd run typecheck` | exit **0** |
| `npm.cmd run lint` | exit **0** (não cobre TS — limitação preexistente) |
| `npm.cmd run build` | exit **0**; **102/102** páginas |
| Guard F60.4 | **8/8 PASS** |
| Suíte global local | exit **0**; **852 arquivos PASS + 2 skipped (854)**; **10.635 testes PASS + 10 skipped (10.645)** |
| OpenSpec `--changes --strict` | **1 passed, 0 failed** |
| `git diff --check` | limpo |

A suíte global passou após a autorização dirigida do guard e a comparação completa da seleção. Gates PostgreSQL/Storage/provider/app-env não executados; a migration não foi aplicada.

## Deviations from Plan

### Correção dirigida autorizada (F62/62-03)

**1. Guard F60.4 reconhece somente os seis caminhos autorizados**
- **Encontrado em:** suíte global, após os commits de implementação.
- **Situação:** `src/lib/campaign/square-base/__tests__/regression.contract.test.ts` comparava `CONTRACT_PATHS` contra `PHASE_BASE_SHA` e só aceitava arquivos em `AUTHORIZED_CONTRACT_CHANGES`. Os seis arquivos de `composition-artifacts` estavam em `files_modified` do 62-03, mas não na allowlist.
- **Autorização:** registrada no `62-03-PLAN.md` antes do código (`fb3f279d`).
- **Correção:** os seis caminhos exatos foram adicionados à allowlist com referência F62/62-03; `PHASE_BASE_SHA`, `PROTECTED_PATHS`, `CONTRACT_PATHS`, comparação temporal, controle positivo e demais asserções foram preservados. O diretório inteiro **não** foi liberado.
- **Verificação:** guard **8/8 PASS**; suíte global verde.
- **Commit:** `8dd7e254`.

**2. `preflightFrozenExpansion` compara a seleção completa**
- **Problema:** modelo/qualidade eram delegados ao preflight, mas `configVersionId` e origem não eram comparados explicitamente; trocar apenas um deles passava.
- **Correção:** comparação local de modelo, qualidade, `configVersionId` e origem antes de delegar; divergência retorna falha fechada (`model_unavailable` com `detail: frozen_selection_mismatch:<campo>`). O motor compartilhado **não** foi alterado.
- **Testes:** positivo com seleção intacta + negativos alterando somente `configVersionId` e somente origem, além de modelo/qualidade.
- **Commit:** `8dd7e254`.

### Auto-fixed Issues

**2. [Rule 1 - Boundary] Import do runtime 1:1 na ponte**
- **Encontrado em:** guard `non-activation.contract.test.ts`.
- **Problema:** `source-registration.ts` importava `artifactStoragePath` de `@/lib/product-1-1/...`, violando a fronteira de não-ativação.
- **Correção:** caminho canônico duplicado localmente (`{store}/{campaign}/product-1-1/{operation}/art-1024.jpg`) com comentário explícito; nenhuma dependência do runtime 1:1.
- **Verificação:** guard de não-ativação **77/77**; bridge **12/12**.
- **Commit:** `63eddf83`.

---

**Total deviations:** 2 correções dirigidas autorizadas (guard F60.4 + seleção completa) + 1 correção de fronteira.
**Impact:** implementação funcional e suíte global verde; aceite ainda depende da nova revisão.

## Issues Encountered

- **F60.4 global guard:** resolvido pela autorização dirigida registrada no plano; apenas os seis caminhos exatos foram allowlisted, com as demais proteções preservadas.
- **Comparação da seleção congelada:** `configVersionId` e origem agora são comparados explicitamente antes do preflight; negativos dedicados adicionados.
- **Leitura dupla da fonte:** `resolveReusableSquareSource` valida baixando os bytes e `ensureFormatAdditionSourceBridge` baixa novamente para passar ao `persistCompositionArtifact` (que revalida). É deliberado para preservar a autoridade F60.1 sem alterar sua assinatura; custo é uma leitura extra de Storage, não uma chamada paga.
- **Sem prova real:** nenhum SQL/RPC/Storage/provider executado; atomicidade, concorrência e comportamento PostgREST continuam no Gate de banco/prova real.

## Limitações explícitas

- Nenhum banco, Storage, provider, geração ou flag em ambiente foi acessado.
- A migration `20261123130252_campaign_format_addition.sql` continua **autorada e NÃO aplicada**.
- Testes são estáticos/fakes: não provam concorrência real, RLS, leases, locks nem downloads/uploads reais.
- A allowlist do cliente financeiro é estática; novos motivos exigem atualização explícita.
- A suíte global está verde após a autorização dirigida do guard F60.4; o guard continua bloqueando qualquer outro arquivo.
- `62-04` não iniciado; nenhum merge, push, deploy, sync ou archive.

## Next Phase Readiness

- Ponte, economia congelada, cliente financeiro e leitor prontos para revisão.
- **Review Stop do `62-03`:** aguardando revisão e decisão sobre o guard F60.4.
- `62-04` permanece bloqueado.

## Self-Check: PASSED

- [x] Opt-in 1024 com default 1080 preservado.
- [x] Ponte byte-idêntica, estável e sem crédito inventado (offline).
- [x] Economia congelada sem fallback à campanha original.
- [x] Cliente financeiro fechado; nenhum banco/provider acessado.
- [x] Seis arquivos do plano: 93/93 testes.
- [x] Guard F60.4: 8/8, com somente os seis caminhos autorizados.
- [x] Seleção completa (modelo/qualidade/configVersionId/origem) comparada antes do preflight.
- [x] Typecheck/lint/build/suíte global/OpenSpec/diff-check verdes.

---

*Phase: 62-adicionar-vertical-campanha-quadrada*
*Completed: 2026-11-23 (execução local/offline; aceite pendente)*
