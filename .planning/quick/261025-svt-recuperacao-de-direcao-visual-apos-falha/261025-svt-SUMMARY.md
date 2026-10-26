---
plan: 261025-svt
status: complete
completed: "2026-10-25"
scope: quick
branch: current
head_before: 580a5d2f
requirements: ["SV-DIR-RECOVERY"]
---

# Quick 261025-svt — Recuperação de direção visual após falha

## Resultado

Falha do `brand_profile_vision` na aprovação de uma nova assinatura visual deixou de ser um estado ambíguo. A assinatura permanece ativa, a direção anterior é invalidada (nunca restaurada), a falha é registrada na metadata JSONB existente, a pendência é detectada no carregamento e recuperável pelo endpoint de realinhamento existente.

Nenhuma migration, tabela, coluna, status novo, dependência ou variável de ambiente foi criada. Uso exclusivo de `store_brand_profiles.status` e `store_visual_signatures.metadata` (JSONB).

## Arquivos alterados

### Código
- `src/lib/visual-signature/direction-pending.ts` (novo) — estado de pendência, invalidação fail-closed, marcação/limpeza de metadata, guard de assinatura ativa e sanitização.
- `src/lib/visual-signature/types.ts` — `BrandProfilerInput.assertActiveVisualSignature`.
- `src/lib/visual-signature/brand-profiler.ts` — guard chamado antes de `generate()` (reuso), `persistProfile`, `persistWithRegenerate` e `persistFailedProfile`.
- `src/app/api/store/[id]/visual-signature/approve/route.ts` — fail-closed em standard e substitution; restore removido; metadata/referência gravadas; guard no reuso.
- `src/app/api/store/[id]/brand-profile/realign/route.ts` — distingue realinhamento comum de recuperação; referência nova apenas em pendência; 409/500 seguros.
- `src/app/api/store/[id]/brand-profile/route.ts` — `GET ?status=direction-state`.
- `src/components/flow/direction-pending-banner.tsx` (novo) — banner persistente `role="alert"` com referência e CTA.
- `src/components/flow/visual-signature-approval-modal.tsx` — `bp_failed` em ambos os modos, referência, realinhamento e `onComplete`.
- `src/components/flow/store-identity-form.tsx` — detecção no load, limpeza de campos orientadores, erro explícito, realinhamento e refresh de readiness/drift.

### Testes
- `src/lib/visual-signature/__tests__/direction-pending.test.ts` (novo)
- `src/lib/visual-signature/__tests__/brand-profiler.test.ts`
- `src/app/api/store/[id]/visual-signature/approve/__tests__/approve-route.test.ts`
- `src/app/api/store/[id]/brand-profile/realign/__tests__/realign-route.test.ts`
- `src/app/api/store/[id]/brand-profile/__tests__/route.test.ts`
- `src/app/api/campaign/generate-image/__tests__/route.test.ts`
- `src/components/flow/__tests__/direction-pending-banner.test.tsx` (novo)
- `src/components/flow/__tests__/visual-signature-approval-modal.test.tsx`
- `src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx` (novo)

## Comportamento

- **Aprovação standard e substitution:** falha do profiler → assinatura ativa, perfis `synced` alheios viram `outdated` (conteúdo/histórico preservados), metadata da assinatura recebe `brand_profile_status:'failed'`, `brand_profile_failure_reference`, `brand_profile_failure_at`, `brand_profile_failure_code`; resposta 200 com `bp_status:'failed'`, `brand_profile_status:'failed'`, `failure_reference`, `brandProfileData:null`, sem cores de fallback. Bloco de restore da substituição removido.
- **Persistência/reload:** `GET ?status=direction-state` retorna `pending`/`complete`/`no-active`; erro de leitura → 500 `direction_state_unavailable` (nunca ausência/legado). Guard `assertActiveVisualSignature` antes de qualquer escrita, inclusive reuso.
- **Resposta atrasada/substituída:** 409 `visual_signature_superseded`, sem cleanup, sem metadata e sem tocar no perfil da assinatura mais nova.
- **Readiness:** sem perfil `synced` da assinatura ativa, a RPC existente mantém `ready=false`; `generate-image` continua bloqueando (412) antes de reserva/provider.
- **Recuperação:** realinhamento em pendência grava NOVA referência (`operationRunId`) e mantém o bloqueio em nova falha; realinhamento comum com perfil válido preserva o perfil e responde “A direção visual anterior foi mantida.”. Sucesso limpa a metadata e reporta `synced`.
- **Mensagem segura:** respostas e logs usam apenas códigos; diagnósticos passam por `sanitizeDirectionDiagnostic` (remove `sk-*`, Bearer, URLs; colapsa/trunca). Nenhuma mensagem crua de provider/SQL/URL é devolvida.
- **UI:** banner persistente com referência e “Realinhar direção visual”; modal trata `bp_status:'failed'` nos dois modos; formulário, no load com pendência, limpa campos orientadores, não aplica `?status=synced` e não trata erro de leitura como legado; após recuperação aplica o perfil e atualiza readiness/drift.

## Testes e gates

- Suíte focada: **222 passed / 0 failed** (9 arquivos).
- Regressão ampliada (`visual-signature` + `api/store` + `components/flow/__tests__` + readiness + guarda de não-ativação + generate-image): **931 passed / 0 failed** (78 arquivos).
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `git diff --check`: limpo.
- Verificação estática: nenhum import de `@/lib/product-1-1` nos arquivos alterados; nenhuma alteração em `supabase/migrations`.

## Complemento pós-revisão (2026-10-25)

Após revisão do orquestrador, foram corrigidos pontos de borda sem ampliar o escopo:

1. **Assinatura que falhou ainda é a ativa:** a invalidação agora marca TODOS os perfis `synced` (inclusive um perfil antigo da própria assinatura, cenário possível na substituição). Quando OUTRA assinatura já assumiu, o perfil dela é preservado (`markSyncedProfilesOutdatedExceptActive` com `signatureId`).
2. **Resposta atrasada:** referência de falha/metadata condicionais a `status='active'`; o guard do profiler continua antes de qualquer escrita; a limpeza nunca toca o perfil da assinatura mais nova.
3. **Referência segura:** fallback para o id existente da assinatura caso o `operationRunId` não tenha sido produzido antes da falha.
4. **UI:** falha de realinhamento no modal propaga a nova referência para o banner do formulário; campos orientadores/avisos são limpos ao entrar em pendência; botão do modal passou a “Fechar” (sem “ignorar e continuar”).
5. **Metadados:** `recordVisualDirectionFailure`/`clearVisualDirectionFailure` não alteram mais `store_visual_signatures.updated_at` (preserva `approved_at`/histórico); logs de approve/realign usam apenas códigos, sem detalhe de provider/SQL.
6. **Readiness:** teste do caminho legado adicionado além do novo fluxo; `reserveCredit` e provider não são chamados quando falta `brand_profile`.

Gates reexecutados após o complemento: focados **222/222** (9 arquivos); regressão ampliada **931/931** (78 arquivos); `npm run typecheck`, `npm run lint` e `git diff --check` exit 0.

## Sem banco/provider/ambiente

Nenhum Docker, Supabase CLI, psql, banco de dados, provider, chamada de rede ou migration foi executado. Testes são offline com mocks/fakes. Nenhuma tabela/coluna/status/migration/dependência/env foi criada ou alterada.

## Limitações

- Mocks e fakes **não** substituem validação de banco real nem validação humana/visual. Não houve execução contra PostgreSQL nem UAT humano.
- A prova de concorrência real (duas aprovações simultâneas) é comportamental por simulação, não por transação de banco. O guard é verificado imediatamente antes de cada persistência e a limpeza/metadata são condicionais à assinatura ativa; permanece uma janela teórica entre a checagem e o write, não coberta por transação/RPC.
- A transição central de ativação/arquivamento da VS no modo standard não foi redesenhada; os novos writes do fluxo de falha (invalidação, referência e limpeza) são verificados e falham explicitamente.
- Nenhuma validação de produção, deploy ou ativação.
- A falha conhecida de envio da imagem local ao `brand_profile_vision` permanece intocada, conforme o escopo.

## Disposição

Commits locais de código/testes referenciando `261025-svt`: `20d25bf2` (implementação) e `12ed46c3` (complemento pós-revisão). Artefatos `.planning/**`, `STATE.md` e `ROADMAP.md` permanecem fora desses commits.
