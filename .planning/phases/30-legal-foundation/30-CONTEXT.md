# Phase 30: Fundação Legal — Context

**Gathered:** 2026-07-23
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-30-legal-foundation/`

<domain>
## Phase Boundary

V1.5 está completa com 987+ testes passando — o Vendeo está tecnicamente pronto para receber lojistas reais. Porém, não existe fundação jurídica alguma: Termos de Uso, Política de Privacidade, Política de Uso Aceitável ou mecanismo de aceite/ciência documentado. Lojistas podem se cadastrar, criar loja e gerar campanhas sem nunca ter contato com documentos legais, expondo o projeto a riscos de uso indevido, responsabilidade sobre conteúdo gerado, ausência de base legal LGPD, falta de política de suspensão/reembolso e zero trilha de auditoria de ciência/aceite.

**Estado atual:**
- Nenhum documento legal existe
- Lojista cria conta sem declarar ciência de privacidade
- Lojista cria loja sem aceitar termos contratuais
- Pipeline gera campanhas sem verificação legal
- Admin não tem visibilidade de compliance legal

**O que esta fase entrega:**
- 3 documentos legais draft (Termos de Uso, Política de Privacidade LGPD, Uso Aceitável) com ressalva de revisão jurídica
- Páginas públicas `/termos`, `/privacidade`, `/uso-aceitavel`
- 6 novas migrations: `legal_document_versions`, `privacy_acknowledgements`, `legal_acceptances`, `user_consent_events`, `legal_helpers`, seed v1.0
- Módulo `src/lib/legal/` com services de privacy, clearance, acceptance, consent, document versions
- Duas camadas: ciência de privacidade no signup + aceite contratual no onboarding
- `requireLegalClearance()` — guard central no pipeline e VS
- Re-aceite contratual com bloqueio operacional e tela `/legal/reaccept`
- Acesso mínimo: docs legais, suporte, conta e cancelamento livres; geração, VS e exports bloqueados
- Admin: badges de status de ciência/aceite/consentimento
- RPC atômica `create_store_with_legal_acceptance`
- Consentimento LGPD para comunicações comerciais (append-only, destacável, revogável)
- 35+ testes novos, regressão 987+ existentes

**Dependências:** F26 (admin layout, admin gate, admin routes), F8 (signup flow), F19 (onboarding flow, store-identity-form), F25 (pipeline route generate-image), F4.4 (visual-signature-approval-modal)

**Non-Goals:**
- Revisão jurídica externa
- Consentimento LGPD para treino de IA com dados do usuário
- Infraestrutura de envio de comunicados comerciais
- Portal de autoatendimento para direitos do titular (exportar/excluir dados)
- Cancelamento de conta automatizado (já existe em F8)
- Responsabilidade civil sobre conteúdo gerado pela IA (disclaimer nos Termos)
- Compliance por segmento (saúde, finanças, alimentos)
- Tradução dos documentos para inglês

</domain>

<decisions>
## Implementation Decisions

### D1 — Duas camadas: ciência de privacidade + aceite contratual

`DECIDIDO`

A F30 separa dois atos jurídicos distintos em momentos diferentes:

```
SIGNUP (criação de identidade)
  → usuário declara CIÊNCIA da Política de Privacidade
  → registra em privacy_acknowledgements (user_id)
  → conta é criada

ONBOARDING (criação da loja — vínculo contratual)
  → usuário ACEITA Termos de Uso + Uso Aceitável
  → registra em legal_acceptances (store_id + accepted_by_user_id)
  → loja é criada com grant de créditos
  → funcionalidades protegidas são liberadas
```

**Bloqueio operacional, não absoluto** — sem aceite contratual vigente:
- PODE: tela de re-aceite, docs legais, conta/perfil, suporte, cancelamento
- NÃO PODE: geração de campanha, assinatura visual, exportação comercial

### D2 — requireLegalClearance(capability) como guardiã central

`DECIDIDO`

```typescript
const CAPABILITY_DOCUMENTS: Record<LegalCapability, DocumentType[]> = {
  content_generation: ["terms_of_service", "acceptable_use"],
};

const CAPABILITY_TREE: Record<string, string[]> = {
  content_generation: ["campaigns.create", "visual_signatures.create", "exports.create"],
};
```

`privacy_policy` NÃO está no mapa de capabilities. A ciência de privacidade é verificada no signup, não no guard de funcionalidades.

### D3 — Duas tabelas, dois significados jurídicos

`DECIDIDO`

| Tabela | Significado | PK | Server-only |
|--------|-------------|----|------------|
| `privacy_acknowledgements` | Ciência da Política de Privacidade | `user_id` | Sim |
| `legal_acceptances` | Aceite contratual (Termos + Uso Aceitável) | `(store_id, accepted_by_user_id, document_type, document_version)` | Sim |

Sem bulk_migration: Admin não aceita em nome do lojista. Cada aceite é pessoal e intransferível.

### D4 — Versionamento semântico de documentos legais

`DECIDIDO`

- Versão vigente: `effective_at` mais recente ≤ now()
- Privacidade muda → banner informativo (sem bloqueio)
- Termos/Uso Aceitável mudam → lojistas pendentes bloqueados via guard até re-aceite
- `legal_acceptances` UNIQUE(store_id, accepted_by_user_id, document_type, document_version)
- `privacy_acknowledgements` PK = user_id — upsert

Funções auxiliares SQL: `has_valid_acceptance(store_id, document_type)`, `has_valid_privacy_acknowledgement(user_id)`

### D5 — Checkboxes: ciência no signup, aceite no onboarding

`DECIDIDO`

**No signup:**
- ☐ "Declaro ciência da Política de Privacidade." — obrigatório | Link `/privacidade`
- ☐ "Aceito receber comunicações comerciais do Vendeo." — opcional | Separado e destacável

**No onboarding (store-identity-form, modo criação):**
- ☐ "Li e aceito os Termos de Uso e a Política de Uso Aceitável." — obrigatório | Links `/termos`, `/uso-aceitavel`

O client envia apenas `acceptedTerms: true` no body; versões são resolvidas server-side (evita version spoofing).

### D6 — LGPD: Política de Privacidade informa bases legais; consentimento separado

`DECIDIDO`

| Finalidade | Base legal (LGPD) | Exige consentimento? |
|------------|-------------------|---------------------|
| Operação do serviço | Execução de contrato (art. 7º, V) | Não |
| Comunicações transacionais | Execução de contrato (art. 7º, V) | Não |
| Prevenção a fraude | Legítimo interesse (art. 7º, IX) | Não |
| Obrigação fiscal/regulatória | Obrigação legal (art. 7º, II) | Não |
| Comunicações comerciais | Consentimento (art. 7º, I) | Sim |

### D7 — Re-aceite em mudança de versão

`DECIDIDO`

Documentos contratuais:
1. Guard detecta que loja não tem aceite da versão vigente
2. Bloqueio operacional — funcionalidades protegidas indisponíveis
3. Tela `/legal/reaccept` com sumário de mudanças e botão "Aceitar nova versão"
4. Após re-aceite: INSERT em `legal_acceptances` com nova versão

Privacidade: Banner de aviso (não bloqueante).

### D8 — Admin: visibilidade de ciência, consentimento e aceite

`DECIDIDO`

Em `/admin/users/[id]`:
- Badge de ciência de privacidade: "✅ Ciente" / "❌ Não registrado"
- Badge de aceite contratual: "✅ Vigente" / "⏳ Pendente" / "❌ Nunca aceitou"
- Badge de consentimento: "✅ Consentimento ativo" / "⏳ Revogado" / "❌ Nunca definido"
- Detalhamento por documento (versão, data, usuário, IP, UA)
- AdminUserSummary estendido com privacyAcknowledged, legalAcceptanceStatus, communicationsConsent

### D9 — Documentos legais: draft próprio + revisão jurídica externa

`DECIDIDO`

Drafts proprietários, não templates. Ressalva em cada documento:
> "Este documento é um draft preparado pelo time do Vendeo para revisão jurídica. Não constitui aconselhamento legal. Consulte um advogado antes de publicar."

### D10 — Criação de loja + aceite + grant como RPC atômica

`DECIDIDO`

RPC `create_store_with_legal_acceptance()` encapsula tudo em uma transação:
1. INSERT store (incluindo logo_url)
2. INSERT legal_acceptances (terms_of_service)
3. INSERT legal_acceptances (acceptable_use)
4. grant_credits(v_store_id, p_amount => 10, 'onboarding', 'onboarding_' || v_store_id, '{}'::jsonb, 'bonus_onboarding')

Substitui a RPC existente `create_store_with_initial_grant`.

### D11 — POST /api/legal/acknowledge-privacy: diferido para primeiro acesso autenticado

`DECIDIDO`

O client NÃO envia version string. O endpoint resolve via `getCurrentVersion("privacy_policy")`.

**Fluxo atualizado (pós-revisão):** No momento do signup, o usuário não tem sessão JWT (redirect para /check-email). Portanto:
1. Após signup bem-sucedido, o client salva `{ privacyAcknowledged: true, communicationsOptIn: boolean }` em `sessionStorage`
2. **Não chama o endpoint agora** — não há sessão autenticada
3. No primeiro acesso autenticado pós-confirmação de email, verifica `sessionStorage` e chama `POST /api/legal/acknowledge-privacy` COM sessão JWT
4. `requireUser()` extrai `userId` de `claims.sub` — endpoint NÃO aceita `userId` do client body (previne spoofing)
5. Se o endpoint falhar, a pendência permanece e o sistema notifica o usuário

**Recovery rule:** Se o usuário chegar sem pendência em `sessionStorage` mas `hasValidPrivacyAcknowledgement(userId)` retornar false, o sistema exibe notificação de pendência de privacidade antes de permitir onboarding/criação de loja.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec — Source of Truth
- `openspec/changes/fase-30-legal-foundation/proposal.md` — Why, What Changes, Capabilities, Impact
- `openspec/changes/fase-30-legal-foundation/design.md` — All design decisions (D1-D10), Risks/Trade-offs
- `openspec/changes/fase-30-legal-foundation/tasks.md` — 24 task groups with 136+ tasks
- `openspec/changes/fase-30-legal-foundation/specs/` — 16 spec files with detailed requirements

### Dependencies — Existing Phase Contexts
- `.planning/phases/26-admin-operacional/26-CONTEXT.md` — Admin layout, admin gate, admin routes (admin layout, admin pages structure)
- `.planning/phases/27-conta-saldo-extrato/27-CONTEXT.md` — /conta page structure, BalanceCard, TransactionHistory
- `.planning/phases/28-observabilidade-operacao-launch-controls/28-CONTEXT.md` — Pipeline logger, launch config module
- `.planning/phases/25-integracao-transacional-pipeline/25-CONTEXT.md` — generate-image route, pipeline 3-zone structure
- `.planning/phases/29-1-1-creditos-assinatura-visual/29-1-1-CONTEXT.md` — VS approval modal, credit integration

### Existing Source Files (modified by this phase)
- `src/app/(auth)/signup/signup-form.tsx` — Add privacy + communications checkboxes
- `src/components/flow/store-identity-form.tsx` — Add legal acceptance checkbox (create mode only)
- `src/app/api/store/route.ts` — Replace RPC with create_store_with_legal_acceptance
- `src/app/api/campaign/generate-image/route.ts` — Add requireLegalClearance pre-stream
- `src/components/flow/visual-signature-approval-modal.tsx` — Add legal clearance check
- `src/app/(app)/conta/page.tsx` — Add privacy/consent/acceptance section
- `src/app/(app)/admin/users/[id]/page.tsx` — Add legal status badges
- `src/middleware.ts` — Add legal routes to free routes

</canonical_refs>

<specifics>
## Specific Ideas

### Arquitetura do módulo src/lib/legal/

```
src/lib/legal/
├── types.ts                    — LegalCapability, DocumentType, interfaces
├── document-versions.ts        — getCurrentVersion, getVersionHistory, isVersionCurrent
├── privacy.ts                  — registerPrivacyAcknowledgement, hasValidPrivacyAcknowledgement
├── consent.ts                  — recordConsentEvent, getEffectiveConsent, revokeConsent
├── acceptance-service.ts       — registerAcceptance, registerAllContractAcceptances, getAcceptanceStatus, getStoreAcceptanceHistory
└── clearance.ts                — requireLegalClearance, CAPABILITY_DOCUMENTS, CAPABILITY_TREE
```

### Migrações (ordem)

1. `20260723000001_create_legal_document_versions.sql` — tabela `legal_document_versions`
2. `20260723000002_create_privacy_acknowledgements.sql` — tabela `privacy_acknowledgements` + RLS
3. `20260723000003_create_legal_acceptances.sql` — tabela `legal_acceptances` + RLS + RPC `create_store_with_legal_acceptance`
4. `20260723000004_create_user_consent_events.sql` — tabela append-only `user_consent_events` + RLS
5. `20260723000005_create_legal_helpers.sql` — funções SQL `has_valid_acceptance` e `has_valid_privacy_acknowledgement` (após tabelas existirem)
6. `20260723000006_seed_legal_document_versions_v1.sql` — INSERT v1.0 dos 3 documentos

### Regra de recovery de privacy acknowledgement

O POST /api/legal/acknowledge-privacy é chamado no primeiro acesso autenticado pós-confirmação de email, não durante o signup. Isso elimina o race condition de sessão inexistente.

**Dois cenários de recovery:**
1. **sessionStorage presente:** se a chamada ao endpoint falhar (rede, timeout), o `sessionStorage` persiste a intenção e o sistema notifica o usuário: "Pendência de privacidade — confirme sua ciência da Política de Privacidade para continuar"
2. **sessionStorage ausente mas pendência real:** se o usuário chegou sem sessionStorage (e.g., outro dispositivo, limpeza) mas `hasValidPrivacyAcknowledgement(userId)` retorna false, o sistema exibe notificação de pendência antes de permitir onboarding/criação de loja

**Onde a recovery roda:** um client component no app shell (`src/components/legal/privacy-recovery.tsx`) verifica ambos os cenários e é renderizado pelo layout autenticado `src/app/(app)/layout.tsx`.

</specifics>

<deferred>
## Deferred Ideas

- Revisão jurídica externa — F30 produz drafts preparatórios
- Consentimento LGPD para treino de IA com dados do usuário — fase futura
- Infraestrutura de envio de comunicados comerciais — F30 coleta/armazena consentimento apenas
- Portal de autoatendimento para direitos do titular (exportar/excluir dados) — fase futura
- Cancelamento de conta automatizado — já existe (F8), F30 apenas não bloqueia a rota
- Responsabilidade civil sobre conteúdo gerado pela IA — documentado nos Termos de Uso (disclaimer)
- Compliance por segmento (saúde, finanças, alimentos) — escopo futuro
- Tradução dos documentos para inglês — produto brasileiro

</deferred>

---

*Phase: 30-legal-foundation*
*Context gathered: 2026-07-23 via OpenSpec alignment*
