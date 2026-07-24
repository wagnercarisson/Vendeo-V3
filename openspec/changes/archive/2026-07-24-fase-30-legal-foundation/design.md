## Context

A v1.5 está completa com 987+ testes passando — o Vendeo está tecnicamente pronto para receber lojistas reais em ambiente controlado. Porém, não existe fundação jurídica: sem Termos de Uso, Política de Privacidade, Uso Aceitável ou qualquer mecanismo de aceite/ciência. Lojistas podem se cadastrar, criar loja e gerar campanhas sem nunca ter contato com documentos legais, expondo o projeto a riscos de uso indevido, responsabilidade sobre conteúdo gerado, ausência de base legal LGPD e falta de trilha de auditoria de ciência/aceite.

**Dependências:** F26 (admin layout, admin gate), F8 (signup flow), F19 (onboarding flow), F25 (pipeline route), F4.4 (VS approval modal)

## Goals / Non-Goals

**Goals:**
- 3 documentos legais draft em `docs/legal/` (Termos de Uso, Política de Privacidade, Uso Aceitável) com ressalva de revisão jurídica pendente
- Páginas públicas `/termos`, `/privacidade`, `/uso-aceitavel` sem auth
- 6 migrations: `legal_document_versions`, `privacy_acknowledgements`, `legal_acceptances`, `user_consent_events`, `legal_helpers` (funções SQL após tabelas), seed v1.0
- Módulo `src/lib/legal/` com services de privacy, clearance, acceptance, consent, document versions
- Duas camadas: ciência de privacidade no signup (`privacy_acknowledgements`) + aceite contratual no onboarding (`legal_acceptances`)
- `requireLegalClearance({ capability: "content_generation" })` — guard central no pipeline e VS
- Re-aceite contratual com bloqueio operacional (não absoluto) e tela `/legal/reaccept`
- Acesso mínimo: docs legais, suporte, conta e cancelamento livres; geração, VS e exports bloqueados
- Admin: badges de status de ciência/aceite/consentimento em `/admin/users/[id]`
- RPC atômica `create_store_with_legal_acceptance` — loja + aceites + grant em 1 transação
- Consentimento LGPD para comunicações comerciais (append-only, destacável, revogável)
- 35+ testes novos; regressão geral (build, typecheck, lint, ~987 existentes)

**Non-Goals:**
- Revisão jurídica externa — F30 produz drafts preparatórios
- Consentimento LGPD para treino de IA com dados do usuário — fase futura
- Infraestrutura de envio de comunicados comerciais — F30 coleta/armazena consentimento apenas
- Portal de autoatendimento para direitos do titular (exportar/excluir dados) — fase futura
- Cancelamento de conta automatizado — já existe (F8), F30 apenas não bloqueia a rota
- Responsabilidade civil sobre conteúdo gerado pela IA — documentado nos Termos de Uso (disclaimer)
- Compliance por segmento (saúde, finanças, alimentos) — escopo futuro
- Tradução dos documentos para inglês — produto brasileiro

## Decisions

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

**Justificativa:** No signup não existe loja — não há vínculo contratual comercial. Tentar registrar "aceite contratual" nesse momento força gambiarra (store_id nullable). A privacidade nasce no primeiro contato com dados pessoais. Separar os dois atos é mais honesto juridicamente e mais limpo tecnicamente.

### D2 — `requireLegalClearance(capability)` como guardiã central

`DECIDIDO`

Em vez de `requireTermsAccepted()`, a F30 implementa `requireLegalClearance()` — uma função guard que verifica se a loja tem aceite vigente para TODOS os documentos legais obrigatórios antes de liberar uma capability.

```typescript
const CAPABILITY_DOCUMENTS: Record<LegalCapability, DocumentType[]> = {
  content_generation: ["terms_of_service", "acceptable_use"],
};
```

`privacy_policy` NÃO está no mapa de capabilities. A ciência de privacidade é verificada no signup, não no guard de funcionalidades.

**Por que capability-based:** Uma capability pode exigir múltiplos documentos. Se um novo documento for adicionado, basta atualizar o mapa da capability — todos os guards são atualizados automaticamente.

### D3 — Duas tabelas, dois significados jurídicos

`DECIDIDO`

| Tabela | Significado | PK | Server-only |
|--------|-------------|----|------------|
| `privacy_acknowledgements` | Ciência da Política de Privacidade | `user_id` | Sim |
| `legal_acceptances` | Aceite contratual (Termos + Uso Aceitável) | `(store_id, accepted_by_user_id, document_type, document_version)` | Sim |

`legal_acceptances` tem `store_id` + `accepted_by_user_id` — o contrato prático do Vendeo é com a loja, mas `accepted_by_user_id` prova quem manifestou a vontade. O UNIQUE constraint inclui `(store_id, accepted_by_user_id, document_type, document_version)` para que cada usuário da loja precise aceitar individualmente, já preparando o cenário multi-usuário futuro.

**Sem `bulk_migration`:** Admin não aceita em nome do lojista. Cada aceite é pessoal e intransferível. O UNIQUE inclui `accepted_by_user_id`, então cada usuário da loja precisará aceitar individualmente.

### D4 — Versionamento semântico de documentos legais

`DECIDIDO`

Tabela `legal_document_versions` com `document_type`, `version`, `effective_at`.

- Versão vigente: `effective_at` mais recente ≤ now()
- Privacidade muda → banner informativo (sem bloqueio)
- Termos/Uso Aceitável mudam → lojistas pendentes são bloqueados via guard até re-aceite
- `legal_acceptances` tem UNIQUE(store_id, accepted_by_user_id, document_type, document_version) — re-aceite da mesma versão pelo mesmo usuário é idempotente. Cada usuário da loja aceita individualmente, preparando multi-usuário futuro.
- `privacy_acknowledgements` tem PK = user_id — upsert na mesma linha quando versão muda

**Funções auxiliares (SQL):**
- `has_valid_acceptance(store_id, document_type)` — verifica se loja tem aceite da versão vigente
- `has_valid_privacy_acknowledgement(user_id)` — verifica se usuário tem ciência da versão vigente

### D5 — Checkboxes: ciência no signup, aceite no onboarding

`DECIDIDO`

**No signup** (entre campos de senha e botão criar conta):
- ☐ "Declaro ciência da Política de Privacidade." — **obrigatório** | Link para `/privacidade`
- ☐ "Aceito receber comunicações comerciais do Vendeo." — **opcional** | Separado e destacável

**No onboarding** (formulário de criação da loja, antes do botão salvar):
- ☐ "Li e aceito os Termos de Uso e a Política de Uso Aceitável." — **obrigatório** | Links para `/termos` e `/uso-aceitavel`

Após signup bem-sucedido: salva `{ privacyAcknowledged: true, communicationsOptIn: boolean }` em `sessionStorage` — NÃO insere direto porque não há sessão JWT (redirect para /check-email). No primeiro acesso autenticado pós-confirmação, `privacy-recovery.tsx` chama `POST /api/legal/acknowledge-privacy` (com `requireUser()`, userId de `claims.sub`) que registra `privacy_acknowledgements` + opcionalmente `user_consent_events`. Após loja criada: `INSERT INTO legal_acceptances` para ambos os documentos com `source='onboarding'`.

### D6 — LGPD: Política de Privacidade informa bases legais; consentimento separado

`DECIDIDO`

A LGPD permite tratamento de dados por várias bases legais, não só consentimento. A F30 adota:
1. Política de Privacidade documenta todas as bases legais aplicáveis
2. Consentimento é usado APENAS onde a LGPD exige (comunicações comerciais)
3. Checkbox de signup é declaração de ciência, não consentimento LGPD
4. Consentimentos opcionais são checkboxes separados e destacáveis
5. `user_consent_events` — tabela append-only, auditável

| Finalidade | Base legal (LGPD) | Exige consentimento? |
|------------|-------------------|---------------------|
| Operação do serviço | Execução de contrato (art. 7º, V) | Não |
| Comunicações transacionais | Execução de contrato (art. 7º, V) | Não |
| Prevenção a fraude | Legítimo interesse (art. 7º, IX) | Não |
| Obrigação fiscal/regulatória | Obrigação legal (art. 7º, II) | Não |
| Comunicações comerciais | Consentimento (art. 7º, I) | Sim ✅ |

### D7 — Re-aceite em mudança de versão

`DECIDIDO`

**Documentos contratuais (Termos, Uso Aceitável):**
1. Guard detecta que loja não tem aceite da versão vigente
2. Bloqueio operacional — funcionalidades protegidas indisponíveis
3. Tela `/legal/reaccept` com sumário de mudanças e botão "Aceitar nova versão"
4. Após re-aceite: INSERT em `legal_acceptances` com nova versão

**Privacidade:** Banner de aviso (não bloqueante): "A Política de Privacidade foi atualizada."

**Quando NÃO forçar re-aceite:** Se usuário já aceitou a versão vigente (idempotente). Se mudança for cosmética/ortográfica.

### D8 — Admin: visibilidade de ciência, consentimento e aceite

`DECIDIDO`

Em `/admin/users/[id]`:
- Badge de ciência de privacidade: "✅ Ciente" / "❌ Não registrado"
- Badge de aceite contratual: "✅ Vigente" / "⏳ Pendente" / "❌ Nunca aceitou"
- Badge de consentimento: "✅ Consentimento ativo" / "⏳ Revogado" / "❌ Nunca definido"
- Detalhamento por documento (versão, data, usuário, IP, UA)
- Ação: "Reenviar notificação de re-aceite" (logga em admin_audit_log)

### D9 — Documentos legais: draft próprio + revisão jurídica externa

`DECIDIDO`

A F30 produz drafts proprietários, não templates. Ressalva em cada documento:
> "Este documento é um draft preparado pelo time do Vendeo para revisão jurídica. Não constitui aconselhamento legal. Consulte um advogado antes de publicar."

### D10 — Criação de loja + aceite + grant como RPC atômica

`DECIDIDO`

RPC única `create_store_with_legal_acceptance()` encapsula tudo em uma transação:
1. INSERT store (including `logo_url`)
2. INSERT legal_acceptances (terms_of_service)
3. INSERT legal_acceptances (acceptable_use)
4. grant_credits(p_store_id, p_amount => 10, p_reason => 'onboarding', p_idempotency_key => 'onboarding_' || store_id, p_metadata => '{}'::jsonb, p_type => 'bonus_onboarding')

Se qualquer passo falhar, tudo é revertido. A RPC existente `create_store_with_initial_grant` é substituída.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Documentos com cláusulas abusivas** | Draft preparatório. Ressalva explícita. Advogado revisa antes da publicação oficial |
| **Re-aceite causa abandono** | Sumário de mudanças claro. Bloqueio é operacional — docs, suporte e conta continuam acessíveis |
| **Múltiplas versões em curto período** | Política editorial: versões com frequência mínima (salvo emergência legal). Agrupar mudanças |
| **LGPD — consentimento insuficiente** | Política mapeia bases legais específicas por finalidade. Revisão jurídica valida |
| **Usuário sem loja não aceita termos** | Correto — sem loja não há funcionalidade a bloquear. Aceite só é exigido no vínculo comercial |
| **IP/user agent obrigatórios quebram headless** | Route handler tem acesso ao request original. Para headless: "api" como fallback |
| **Backfill de usuários existentes** | Privacy: sem backfill — considerados cientes da versão atual no momento da ativação. Aceite: todos os lojistas existentes marcados como pendentes e forçados a re-aceitar |
| **Dois checkboxes em formulários diferentes aumentam atrito** | Cada checkbox está no formulário natural do respectivo momento. Integrados aos fluxos existentes, não são etapas extras |
