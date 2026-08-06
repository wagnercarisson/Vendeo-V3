---
status: complete
phase: 36-onboarding-navegacao-por-abas
source: 36-01-SUMMARY.md, 36-02-SUMMARY.md, 36-03-SUMMARY.md, 36-04-SUMMARY.md, 36-05-SUMMARY.md, 36-06-SUMMARY.md
started: 2026-08-05T17:45:00Z
updated: 2026-08-06T18:45:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 20/20
name: UAT final F36 — coerência cruzada (abas/autosave/legal/CNPJ/drift sensível/crítico/mobile)
expected: |
  Revisão final de coerência antes do openspec verify: validações automáticas (typecheck/lint/vitest/openspec validate --strict) + cenários críticos das 7 dimensões (navegação por abas, autosave, legal acceptance, CNPJ/readiness, drift sensível, drift crítico, mobile/desktop). Pronto para openspec verify.
awaiting: openspec verify (próximo passo)

## Tests

### 1. Cold Start Smoke Test
expected: Servidor sobe sem erros; /loja carrega com o painel de 3 abas (migration `create_store_draft` aplicada no remoto)
result: pass

### 2. Painel de 3 abas em /loja
expected: Desktop mostra labels completos (Dados / Posicionamento / Direção Visual); mobile mostra compactos (Dados / Perfil / Visual). Aceite legal aparece como coluna lateral (desktop sticky) / bloco compacto (mobile).
result: pass

### 3. Aba Dados aberta por padrão
expected: Ao abrir /loja sem `?tab=`, a aba Dados é a ativa por padrão, com formulário (Nome, Segmento, CNPJ opcional, billing colapsado) visível.
result: pass

### 4. Desbloqueio progressivo da aba Posicionamento
expected: Sem nome+segmento+aceite legal, a aba Posicionamento fica bloqueada e NÃO é ativável (hard-block D16) — clique/teclado/"Continuar" mantêm o usuário em Dados com feedback do que falta. Ao preencher o mínimo + aceitar o legal, a aba desbloqueia.
result: pass
note: "D16 implementado e verificado em suíte automatizada (store-tabs.test.tsx): aba bloqueada com `aria-disabled` + motivo no botão (title/aria-label), clique/Enter/Space não disparam `onTabChange`, painel 'Etapa bloqueada' removido; mobile 'Continuar' disabled com microcopy 'Complete Dados para liberar Perfil'. Posicionamento bloqueado por `needs_store_created` é a única exceção (autoSave cria a loja draft, D4) — `setActiveTab` segue chamando `commitTabChange` quando `hasMinimumForCreation()`."
note2: "Revalidação pós-fix do auto-avanço (rodada D16-fix): motivo de bloqueio refinado por precedência — sem nome/segmento → `needs_basic_data` (antes mascarado por `needs_legal_acceptance`); com mínimo mas sem aceite → `needs_legal_acceptance`; com mínimo+aceite sem loja → `needs_store_created`. Copy específico por motivo via `tabBlockReasonText` no botão da aba, no CTA desktop e no 'Continuar' mobile (tabs.test.ts, reason-text.test.ts, store-tabs.test.tsx)."

### 5. Aceite legal como coluna lateral global
expected: Estado Pendente/Aceito/Reaceite necessário visível na coluna lateral; CTA "Revisar e aceitar" abre o modal de contrato; sem aceite a aba Posicionamento permanece bloqueada.
result: pass

### 6. Desbloqueio da aba Direção Visual
expected: Sem `storeId` + tom de voz, a aba Direção Visual fica bloqueada e NÃO é ativável (hard-block D16) — upload/logo/assinatura visual/geração text-only/salvar visual nunca renderizam. Após criar loja (auto-save) e preencher tom de voz, desbloqueia.
result: pass
note: "D16 verificado em suíte automatizada: aba Direção Visual bloqueada não é ativável e o conteúdo funcional nunca renderiza (o painel ativo é sempre o da aba liberada). store-identity-form.tsx ganhou `isTabBlocked`/`direcaoVisualBlocked` — botão 'Continuar para Direção Visual' disabled; o aviso `blockedNotice` (role=status) substituiu o botão 'Voltar para Dados' removido."
note2: "Revalidação pós-fix do auto-avanço (rodada D16-fix): preencher `tone_of_voice` **destrava a aba mas NÃO auto-avança** — permanece em Posicionamento, aviso `blockedNotice` limpo, nenhum autoSave automático (use-onboarding-tabs.test.ts). CTA desktop disabled agora expõe o motivo específico via `title`/`aria-label` (`tabBlockReasonText`); `blockedNotice` exibe o motivo específico além do 'Complete esta etapa...'."
note3: "Revalidação pós-fix da memoização (rodada memo-stale): editar o tom de voz NÃO liberava a aba Direção Visual / botão Continuar — root cause: `tabStates` (useMemo) dependia de `hasLocalEdits` (booleano) e NÃO recomputava quando o valor já era `true` (qualquer edição anterior), mantendo `direcao-visual` presa em `needs_tone_of_voice` stale. Fix: memo agora reage a `formData`/`storeId`/`legalAccepted`/`hasVisualDirection` (recompute na hora). Testes de regressão adicionados (tom de voz e aceite legal atualizam o estado sem re-render de formData). Revalidado → pass."

### 7. CNPJ opcional — não bloqueia navegação
expected: Dá para avançar até a Direção Visual sem CNPJ. A aba Dados mostra aviso "Fiscal pendente" quando CNPJ/razão/nome fantasia ausentes.
result: pass

### 8. Auto-save silencioso na troca de aba
expected: Editar um campo válido e trocar de aba persiste silenciosamente (badge "Salva ✓"), sem modal nem botão. PATCH falho não bloqueia; POST (criação) falho bloqueia o avanço.
result: pass

### 9. Rascunho sobrevive a fechar aba (localStorage + TTL 24h)
expected: Preencher parcialmente, fechar/recarregar a página → rascunho restaurado (dentro de 24h). Após o 1º save que cria a loja, a chave `:new` é limpa. No logout, rascunhos são limpos.
result: pass

### 10. URL ?tab= + back/forward
expected: Trocas de aba atualizam a URL (`/loja?tab=posicionamento`); botões back/forward do navegador navegam entre abas; `?tab=` inválido é ignorado.
result: pass

### 11. Deep-link em aba bloqueada
expected: Abrir `/loja?tab=direcao-visual` bloqueada redireciona/sincroniza para a primeira aba anterior válida (Posicionamento se liberada, senão Dados) + aviso "Complete esta etapa para liberar Direção Visual" — nunca tela em branco, nunca conteúdo funcional da aba bloqueada (D16).
result: pass
note: "D16 verificado em suíte automatizada (use-onboarding-tabs.test.ts): deep-link/popstate para aba bloqueada NÃO sincroniza activeTab — `firstValidPreviousTab` roteia para a primeira aba anterior válida (posicionamento com storeId, dados sem), `blockedNotice` emitido e URL corrigida via replaceState. `?tab=` liberado abre direto (store-identity-ui spec)."
note2: "Revalidação pós-fix do auto-avanço (rodada D16-fix): root cause do bug era o re-check do deep-link re-executando a cada mudança de formData e, com `deepLinkTargetRef` mantido + `userNavigatedRef === false` (redirect via replaceState), o ramo `current !== target` com alvo destravado chamava `commitTabChange('direcao-visual')` indevidamente. Fix: auto-avanço **somente** quando o desbloqueio vem de data-load (`hasVisualDirection === true`); desbloqueio por edição do usuário (tom de voz) consome o deep-link e limpa o aviso — sem armadilha de re-render posterior (use-onboarding-tabs.test.ts: novos 4 cenários)."

### 12. Mobile: abas compactas + "Continuar" fixo + 44px
expected: Em viewport mobile, abas compactas com ponto discreto; botão "Continuar" sempre visível (avança/retrocede); áreas de toque ≥ 44px. (D16: "Continuar" **desabilitado** com microcopy quando a próxima aba está bloqueada — re-verificar com 4/6/11.)
result: pass

### 13. Acessibilidade — teclado nas abas
expected: As abas têm role tablist/tab/tabpanel; roving tabindex — apenas a aba ATIVA entra na ordem de Tab (a tecla Tab navega pelos campos da tela, não pelas abas); setas ←/→, Home/End movem o foco entre abas sem selecionar; Enter/Space selecionam; estados por aria-label. (D16: aba bloqueada com `aria-disabled` + motivo via `aria-label`/`aria-describedby` no próprio botão — re-verificar com 4/6/11.)
result: pass
note: "Correção do movimento registrado (usuário): a tecla Tab segue a ordem normal dos campos da tela — não navega entre abas. As demais teclas (setas ←/→, Home/End, Enter/Space) funcionam corretamente. Sem problemas observados. Re-verificar aria-disabled após D16."

### 14. Guard /campanhas/nova para loja draft
expected: Loja sem cadastro fiscal tentando gerar → redireciona para `/loja?tab=dados&fiscal=pending&returnTo=/campanhas/nova`; sem direção visual → `/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=/campanhas/nova`.
result: pass

### 15. Banners do dashboard apontam para ?tab=
expected: ReadinessBanner (cadastro_fiscal) → `/loja?tab=dados&fiscal=pending`; (brand_profile) → `/loja?tab=direcao-visual&message=needs-visual-direction`. Pós-cadastro CNPJ → `?tab=dados&fiscal=pending` ou `?tab=direcao-visual&message=cnpj-updated`.
result: pass

### 16. Typecheck limpo (gate técnico)
expected: `npm run typecheck` finaliza sem erros (todas as SUMMARYs declaram "typecheck clean")
result: pass
note: "Era issue (5 erros do commit 44eb92d: useRef sem import, skipped sem tipo, colisão FormData). Corrigido em sessão e reexecutado: typecheck limpo, lint limpo, 1480/1480 testes. Gap resolvido (ver Gaps)."

### 17. Drift sensível recorrente (D13)
expected: Alterar um campo do snapshot e tentar sair do contexto (trocar de aba / gerar campanha / dashboard / back-forward) abre o DriftDecisionModal **antes** de qualquer PATCH dos campos do snapshot. Realinhar persiste os dados aceitos **antes** do POST `/realign`; "Manter e salvar"/ignorar persiste sem realinhar e grava o `drift_dismissed_snapshot`; cancelar não persiste nada; nova divergência reabre o fluxo (drift NÃO é one-shot); espelho local (`dismissedSnapshot`) evita reabertura falsa antes de um refetch; edições em campos fora do snapshot (ex.: billing/cidade) fazem auto-save normalmente mesmo com drift pendente.
result: pass
note: "Coberto por store-identity-form.drift-tabs.test.ts (30 cenários): (a) interceptação por atividade (driftStatus 'new', não driftCategory), (b) navegação interna intercepta, (c) modal correto (sensível vs crítico), (d) cancelar sem persistir, (e) endpoints (realign/metadata/dismiss) + resume pós-decisão, (Fix A) dismissed não reintercepta + resume, (Fix B) espelho local, (g) auto-save seletivo de campos fora do snapshot. Revalidado na revisão final → pass."

### 18. Drift crítico de assinatura visual + créditos (D13)
expected: VS ativa + edição de `name`/`segment` (ou `slogan`/`cidade`/`UF` quando `content_used` indicar) → DriftCriticalModal computado **client-side contra o formData vivo** antes de qualquer PATCH (o servidor veria valores antigos e retornaria 'none'). Dismiss persiste o snapshot dos **valores aceitos** (`{ name, segment, slogan, city, state }`) com fallback para o banco. "Gerar novamente" só com crédito (`canGenerateNewSignature = !charging || saldo > 0`); sem crédito, o modal oferece "Ver meus créditos" (→ `/conta`), "Manter direção atual" e "Remover mesmo assim" — nunca "Gerar novamente". "Gerar novamente" persiste os dados aceitos **antes** de abrir a aprovação (save falho NÃO abre a aprovação; modal permanece com erro visível). `totalGeneratedSignatures` permanece contagem informativa (exclui `failed`).
result: pass
note: "Coberto por store-identity-form.drift-tabs.test.ts (crítico client-side, dismiss com valores aceitos, créditos com/sem saldo, persist antes da aprovação) + rota `dismiss-critical-drift` (merge do snapshot no metadata com fallback DB). Revalidado na revisão final → pass."

### 19. Autosave fiscal / CNPJ (fix fiscal)
expected: CNPJ válido + troca de aba / navegação interna / "Gerar campanha" persiste o fiscal via `POST /api/store/update-cnpj` **antes** de navegar (sem exigir "Salvar e continuar"); CNPJ inválido/incompleto ou sem razão social NÃO dispara update-cnpj (readiness permanece `cadastro_fiscal` pendente); falha 400/409/503 → `{ ok: false }` + erro visível (não finge sucesso fiscal; navegação prossegue pois storeId existe); loja que JÁ tem CNPJ usa PATCH com `razaoSocial/nomeFantasia` (sem update-cnpj); após `fiscalPersisted` a próxima navegação NÃO repete update-cnpj; o readiness é refeito (`readinessRefreshKey`) e o banner "Fiscal pendente" some quando `cadastro_fiscal` sai de `missing` (derivado do readiness vivo, não de `initialStore` stale).
result: pass
note: "Coberto por use-store-form.autosave-fiscal.test.ts (11 cenários) + use-onboarding-tabs.test.ts (ordem: update-cnpj resolve ANTES da navegação) + store-page-client.test.tsx. Revalidado na revisão final → pass."

### 20. Feedback explícito de aceite legal (fix aceite)
expected: Com dados mínimos mas sem aceite, clicar em "Salvar e continuar" (desktop ou mobile) NÃO salva, NÃO navega e exibe feedback imediato — modal com a mensagem curta "Para continuar, leia e aceite os termos de uso."; ao fechar, o foco/scroll vai ao card de aceite **visível** no viewport (`#aceite-legal` desktop / `#aceite-legal-mobile` mobile, ids únicos). Tentar avançar por aba sem aceite → `blockedNotice` com motivo `needs_legal_acceptance` e autoSave NÃO chamado. Após aceitar → salva e navega. Mobile "Continue" mantém o microcopy do motivo (inalterado).
result: pass
note: "Coberto por store-identity-form.aceite-legal.test.tsx (3 cenários: modal + sem save, foco ao card, pós-aceite navega) + use-onboarding-tabs.test.ts (bloqueio legal na troca de aba). Revalidado na revisão final → pass."

## Summary

total: 20
passed: 20
issues: 0
pending: 0
skipped: 0
blocked: 0

> **UAT final (coerência cruzada — 2026-08-06):** revisão de coerência das 7 dimensões (navegação por abas / autosave / legal acceptance / CNPJ-readiness / drift sensível / drift crítico / mobile-desktop) confrontando os artefatos (design.md D1-D16 + specs `store-onboarding-tabs`, `store-onboarding-autosave`, `store-identity-ui`, `legal-acceptance-panel`, `store-readiness`, `store-ownership-api`, `store-onboarding-draft`, `store-draft-creation`) com a implementação (`use-onboarding-tabs.ts`, `use-store-form.ts`, `use-drift-detection.ts`, `store-identity-form.tsx`, `store-tabs.tsx`, `legal-acceptance-panel.tsx`, `drift-critical-modal.tsx`, `drift-decision-modal.tsx`, rotas `update-cnpj`/`dismiss-critical-drift`, `POST /api/store` draft × verified, migration `create_store_draft`). **Validações automáticas:** `npx tsc -p tsconfig.typecheck.json --noEmit` (limpo), `npm run lint` (limpo), `npx vitest run` (**182 arquivos / 1546 testes pass**), `npx openspec validate fase-36-onboarding-navegacao-por-abas --strict` (valid). **Divergências menores (não bloqueantes):** (1) flags de interceptação `driftNavIntercept`/`driftSaveIntercept` são código morto (nunca `setXxx(true)`) — o modal de navegação duplicado (linha 2624) é inalcançável e não persiste antes do realign, risco se religado; (2) label "CNPJ *" mantém o asterisco mesmo com CNPJ opcional (F36 D8); (3) `onContinueWithoutDismiss` (estado de erro do modal) não limpa `pendingTabRef` — edge case, drift segue `new` e o resume fica pendente. **Recomendação:** pronto para `openspec verify` — correções opcionais de higiene podem ser tratadas em follow-up.

> **D16 (revisão pós-UAT):** testes 4, 6 e 11 reabertos para re-verificação após a implementação do **hard-block** (decisão de produto que substitui o soft-block). Artefatos atualizados: `openspec/.../design.md` (D16), `specs/store-onboarding-tabs|store-onboarding-autosave|store-identity-ui|legal-acceptance-panel`. Implementado em `src/hooks/use-onboarding-tabs.ts`, `src/components/flow/store-tabs.tsx` e `src/components/flow/store-identity-form.tsx`; testes D16 em `store-tabs.test.tsx` e `use-onboarding-tabs.test.ts`. Re-verificado: typecheck limpo, lint limpo, **1483/1483 testes** (13 novos/reescritos D16). Testes 4/6/11 revalidados → pass.

> **Rodada D16-fix (auto-avanço indevido):** corrigido o bug em que preencher `tone_of_voice` em loja nova pulava automaticamente para a aba Direção Visual. Root cause: re-check do deep-link (`resolveBlockedDeepLink`) re-executava a cada mudança de `formData` com `deepLinkTargetRef` mantido e `userNavigatedRef === false` (redirect via `replaceState`), e o ramo `current !== target` com alvo destravado chamava `commitTabChange` indevidamente. Fix (ajuste aprovado): auto-avanço **somente** quando o desbloqueio vem de **data-load** (`hasVisualDirection === true`); desbloqueio por edição do usuário (ex.: tom de voz) NUNCA auto-avança — consome o deep-link, limpa `blockedNotice` e o avanço fica manual. Ajuste 2 aprovado: novo motivo `needs_basic_data` em `TabBlockReason` com precedência sobre `needs_legal_acceptance` no `computeTabUnlock('posicionamento')`. Copy específica por motivo em `tabBlockReasonText` (novo `src/lib/store-onboarding/reason-text.ts`) usada no tooltip/`aria-label` do CTA desktop, no aviso `blockedNotice` e no microcopy do "Continuar" mobile. Artefatos atualizados: `design.md` D16 + specs (`store-onboarding-tabs`, `store-identity-ui`). Testes novos/ajustados: `tabs.test.ts` (2 cenários `needs_basic_data` + precedência), `reason-text.test.ts` (novo, 6 casos de copy), `use-onboarding-tabs.test.ts` (4 cenários de auto-avanço data-load vs edição), `store-tabs.test.tsx` (microcopy específica). Validado: typecheck limpo, lint limpo, **1494/1494 testes** (180 arquivos), `openspec validate --strict` OK. Testes 4/6/11 revalidados → pass.

> **Rodada memo-stale (tom de voz não liberava a aba):** reportado pelo usuário — em Posicionamento, editar `tone_of_voice` não liberava a aba Direção Visual nem o botão "Continuar". Root cause: `tabStates` (`useMemo` em `use-onboarding-tabs.ts`) dependia apenas de `[computeUnlockFor, hasLocalEdits, isPersisted, readiness]`; `hasLocalEdits` é um booleano que vira `true` no 1º campo editado e `true === true` não recomputa — então qualquer edição posterior (ex.: tom de voz) NÃO atualizava o estado da aba, mantendo `direcao-visual` presa em `blocked`/`needs_tone_of_voice` stale. Fix: memo reativo às entradas reais (`formData`, `storeId`, `legalAccepted`, `hasVisualDirection`) — o desbloqueio passa a recomputar na hora (também cobre aceite legal sem edição de campo). Testes de regressão: `use-onboarding-tabs.test.ts` (editar tom de voz com `hasLocalEdits` já `true`; aceitar legal sem edição). Artefatos: `specs/store-onboarding-tabs/spec.md` (2 cenários novos). Validado: typecheck limpo, lint limpo, **1496/1496 testes** (180 arquivos), `openspec validate --strict` OK. Teste 6 revalidado → pass.

## Gaps

- truth: "npm run typecheck finaliza sem erros (todas as SUMMARYs declaram typecheck clean)"
  status: failed
  reason: "User reported: typecheck falha com 5 erros — useRef não importado (use-store-form.ts:168), 'skipped' não existe no tipo autoSave (use-onboarding-tabs.ts:366), FormData colide com DOM FormData (store-identity-form.tsx:338/344/368) — introduzidos pelo commit de code review 44eb92d"
  severity: blocker
  test: 16
  root_cause: "Commit 44eb92d (code review HR-01/HR-02 + MD-01..05) adicionou useRef sem import e result.skipped sem ampliar o tipo, e reintroduziu colisão de FormData; typecheck não foi reexecutado após o commit"
  artifacts:
    - path: "src/components/flow/use-store-form.ts"
      issue: "useRef usado na linha 168 mas não importado (import: useState, useEffect, useCallback, useMemo)"
    - path: "src/hooks/use-onboarding-tabs.ts"
      issue: "result.skipped acessado na linha 366 mas o tipo autoSave da interface (linha 50) não declara skipped"
    - path: "src/components/flow/store-identity-form.tsx"
      issue: "FormData resolve para o DOM global FormData (não o alias StoreFormData) nas linhas 338/344/368"
  missing:
    - "Adicionar useRef ao import do react em use-store-form.ts"
    - "Ampliar o tipo de autoSave na interface para incluir skipped?: boolean"
    - "Trocar FormData por StoreFormData (ou tipar explicitamente) no bloco persistedFormRef/editedFields de store-identity-form.tsx"
  debug_session: ""

- truth: "/loja carrega sem erros de runtime e mostra o painel de 3 abas"
  status: failed
  reason: "User reported: ReferenceError: useRef is not defined em use-store-form.ts:168 — /loja crasha"
  severity: blocker
  test: 1
  root_cause: "useRef não importado em use-store-form.ts (mesma causa do teste 16) — erro de runtime derruba a página"
  artifacts:
    - path: "src/components/flow/use-store-form.ts"
      issue: "useRef usado na linha 168 mas não importado no import do react"
  missing:
    - "Adicionar useRef ao import do react em use-store-form.ts"
  debug_session: ""

- truth: "Sem loja criada + tom de voz, a aba Direção Visual fica bloqueada com motivo"
  status: failed
  reason: "User reported: a aba Direção Visual desbloqueou junto com a Posicionamento mesmo com tom de voz não preenchido ('selecione')"
  severity: major
  test: 6
  root_cause: "Para loja draft (sem CNPJ) computeTabState retorna { state: pending_generation, reason: fiscal_pending } para TODAS as abas porque a checagem fiscal short-circuits antes de !unlocked (tab-state.ts) — prioridade D7/D8 intencional e testada (tab-state.test.ts). Com state !== blocked, o painel 'Etapa bloqueada' e o aria-describedby (store-tabs.tsx) não renderizavam e a razão needs_tone_of_voice de computeTabUnlock nunca chegava à UI — o gate D9 ficava invisível durante todo o draft. Fix aplicado em sessão (decisão: mostrar o motivo mesmo com fiscal): unlockReason propagado à UI"
  artifacts:
    - path: "src/lib/store-onboarding/tab-state.ts"
      issue: "computeTabState retorna pending_generation/fiscal_pending antes de checar unlocked; sem campo para carregar o motivo de desbloqueio à UI"
    - path: "src/hooks/use-onboarding-tabs.ts"
      issue: "tabStates descartava unlock.reason quando state era pending_generation (só anexava reason para state === blocked)"
    - path: "src/components/flow/store-tabs.tsx"
      issue: "Painel de motivo renderizava apenas com state === 'blocked' e aria-describedby só apontava para isBlocked"
  missing:
    - "Propagar o motivo de desbloqueio (unlockReason) mesmo quando pending_generation domina (D9 preservado no painel ativo)"
    - "Renderizar o painel de motivo quando a aba ativa não está desbloqueada, não apenas quando state === 'blocked'"
    - "Atualizar aria-describedby para apontar ao painel quando a aba ativa não está desbloqueada"
  superseded: "Registro do fix soft-block (D9/unlockReason). O D16 (hard-block) substitui esta abordagem: aba bloqueada NÃO fica ativa; o motivo fica acessível no próprio botão (aria-label/aria-describedby/tooltip) — ver openspec design.md D16."
  debug_session: ""
