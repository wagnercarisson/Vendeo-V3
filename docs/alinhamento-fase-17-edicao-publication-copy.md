# Alinhamento Fase 17 — Edição do Publication Copy (v1.3)

## Contexto

```
v1.3 — Persistência e Entrega da Campanha (milestone)
  ├── Phase 12 — Fundação DB/Storage                                 ✅ completa
  ├── Phase 13 — Serviço de Persistência e Download                  ✅ completa
  ├── Phase 14 — Integração no Fluxo de Geração                      ✅ completa
  ├── Phase 15 — /campanha/[id]                                      ✅ completa
  ├── Phase 16 — /minhas-campanhas                                   ✅ completa
  └── Phase 17 — Edição Publication Copy                             ← esta fase
```

A milestone v1.3 foi concluída com sucesso (F12–F16). O lojista gera, persiste, encontra e baixa campanhas. O publication copy (caption, hashtags, cta_post) é gerado pela IA e armazenado como snapshot imutável em `publication_copy_snapshot`.

**Problema:** O lojista não pode ajustar o texto de publicação sem regerar a campanha inteira. Se a IA sugeriu um caption que não reflete a oferta real, ou se o lojista quer adicionar hashtags sazonais, ele precisa de uma maneira simples de editar apenas o texto — sem alterar a imagem, sem nova geração.

**Dependências:** F12 (tabela `campaigns` com `publication_copy_snapshot`), F15 (página `/campanha/[id]`, display contract em `display.ts`, client component `client.tsx`), F13 (padrão apiHandler de route handlers).

---

## Propósito

1. Adicionar coluna `publication_copy_current` (JSONB, nullable) em `campaigns` para armazenar a versão editada
2. Modificar o display contract para dar preferência a `publication_copy_current` com fallback para `publication_copy_snapshot` quando `current` for null
3. Criar rota `PATCH /api/campaign/[id]/publication-copy` com ownership, validação e persistência
4. Adicionar modo de edição inline na página `/campanha/[id]` com botões "Salvar", "Restaurar original" e "Cancelar"
5. Validação básica de tamanho/formato no backend
6. `publication_copy_snapshot` permanece imutável — a edição nunca o altera

**Entrega verificável:**
- O lojista acessa `/campanha/[id]`, vê o publication copy, clica "Editar", altera caption/hashtags/cta_post, clica "Salvar" e vê as alterações refletidas
- O lojista pode clicar "Restaurar original" e o texto volta ao snapshot gerado pela IA
- Após restaurar, o campo `publication_copy_current` é null — o fallback usa o snapshot
- A imagem da campanha nunca é alterada
- `npm run typecheck`, `npm run lint`, `npm run build`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F16)

```
                                      ANTES (F16)                        DEPOIS (F17)
═══════════════════════════════════════════════════════════════════════════════════════
publication_copy_current              ✗ coluna não existe                  ✓ coluna JSONB nullable

display.ts:
  mapCampaignToProps                  só lê snapshot                     ✓ fallback: current > snapshot
  PublicationCopySnapshot                                                ✓ current opcional nos tipos



PATCH /api/campaign/[id]/             ✗ não existe                        ✓ CSRF + apiHandler +
  publication-copy                                                          requireOwnership + validação

/campanha/[id] client.tsx:
  ReadyView                           read-only                           ✓ modo edição inline
  Botão "Editar"                      ✗                                   ✓
  Botão "Salvar"                      ✗                                   ✓ (PATCH)
  Botão "Restaurar original"          ✗                                   ✓ (PATCH restore)
  Botão "Cancelar"                    ✗                                   ✓ (descarta edição local)

publication_copy_snapshot             imutável                            imutável (nunca alterado)

Validação backend                     ✗ inexistente                       ✓ caption (string, max 2200)
                                                                             hashtags (array, # formato, max 30)
                                                                             cta_post (string, max 200)

Testes:
  PATCH route                         ✗                                   ✓ sucesso, validação, ownership, 404
  Fallback display                    ✗                                   ✓ current > snapshot > vazio
  UI edição                           ✗                                   ✓ visualização, edição, salvar, restaurar
```

---

## Decisões de Arquitetura

### D1 — `publication_copy_current` como coluna JSONB direta em `campaigns`

`CONFIRMADO`

```
ALTER TABLE public.campaigns
  ADD COLUMN publication_copy_current JSONB;

COMMENT ON COLUMN public.campaigns.publication_copy_current IS
  'Versão editada pelo usuário do publication copy. Se null, usar publication_copy_snapshot como fallback.';
```

**Motivos:**
- Migração mínima: não cria tabela nova, não quebra existente
- Leitura sem JOIN: o Server Component busca `campaigns.*` e decide no display layer qual usar
- `publication_copy_snapshot` permanece imutável — nunca é tocado por escrita do usuário
- Se `current` for null, o fallback usa o snapshot — sem lógica condicional complexa
- Próximas milestones podem migrar para tabela de versões sem quebrar a F17

---

### D2 — Fallback no display layer: `current > snapshot > vazio`

`CONFIRMADO`

```typescript
// display.ts — função auxiliar
function getEffectivePublicationCopy(campaign: CampaignRecord): {
  caption: string;
  hashtags: string[];
  cta_post: string;
} {
  const current = campaign.publication_copy_current as PublicationCopySnapshot | null;
  if (
    current !== null &&
    typeof current === "object" &&
    "caption" in current &&
    "hashtags" in current &&
    "cta_post" in current &&
    typeof current.caption === "string" &&
    Array.isArray(current.hashtags) &&
    current.hashtags.every((tag) => typeof tag === "string") &&
    typeof current.cta_post === "string"
  ) {
    return current as PublicationCopySnapshot;
  }
  const snap = campaign.publication_copy_snapshot as PublicationCopySnapshot | null;
  return {
    caption: snap?.caption ?? "",
    hashtags: snap?.hashtags ?? [],
    cta_post: snap?.cta_post ?? "",
  };
}
```

**Regra:**
- Se `publication_copy_current` não é null, é um objeto, e contém `caption: string`, `hashtags: string[]`, `cta_post: string` → usa current
- Caso contrário → fallback para `publication_copy_snapshot`
- Se nem current nem snapshot têm dados → string vazia / array vazio (comportamento existente)
- **Critério é de shape/tipo, não de truthiness.** `cta_post` vazio (`""`) é um valor válido e não causa fallback indevido para o snapshot.

**Tipos:** `CampaignRecord.publication_copy_current` adicionado como `Record<string, unknown> | null` (mesmo padrão do snapshot). `PublicationCopySnapshot` interface reutilizada para ambos.

---

### D3 — Rota PATCH com validação no backend

`CONFIRMADO`

```
PATCH /api/campaign/[id]/publication-copy

Body (edição normal):
{
  caption: "Novo texto",
  hashtags: ["#promocao", "#oferta"],
  cta_post: "Compre agora"
}

Body (restaurar original):
{ restore: true }
```

**Fluxo:**
```
request → requireSameOrigin (CSRF) → requireApiUser → busca campaign por id
  → se não existir → 404
  → requireOwnership(campaign.store_id) → se falhar → 404
  → validar body
    → se restore === true:
        supabaseAdmin.from("campaigns").update({ publication_copy_current: null }).eq("id", id)
        → ler snapshot do banco (ou do body da resposta)
        → response 200 {
            restored: true,
            publication_copy_snapshot: { caption, hashtags, cta_post }
          }
        Nota: o cliente usa o snapshot retornado para atualizar a UI imediatamente,
        sem precisar recarregar a página. Isso resolve o contrato de atualização
        pós-restore: a resposta carrega o copy efetivo que será exibido.
    → se caption, hashtags, cta_post presentes:
        validar caption (string, max 2200)
        validar hashtags (array de strings, max 30, cada uma começa com #)
        validar cta_post (string, max 200)
        supabaseAdmin.from("campaigns").update({
          publication_copy_current: { caption, hashtags, cta_post }
        }).eq("id", id)
        → response 200 { publication_copy_current: { caption, hashtags, cta_post } }
    → se validação falhar → 400 { error: "...", issues: [...] }
```

**Validação:**

| Campo | Regras |
|-------|--------|
| `caption` | string, 1–2200 caracteres |
| `hashtags` | array de strings, 0–30 itens, cada um: 2–100 chars, começa com `#`, sem espaços, apenas letras/números/underscore após o `#` |
| `cta_post` | string, 0–200 caracteres (opcional, pode ser vazio) |
| `restore` | boolean — se true, ignora os outros campos e limpa `publication_copy_current` |

**Validação reutilizável:** Criar `validatePublicationCopy(body)` em `src/lib/campaign/publication-copy.ts` (ou em `types.ts`) — testável isoladamente.

---

### D4 — UI: edição inline em `/campanha/[id]`

`CONFIRMADO`

Modo de visualização (padrão):
```
┌──────────────────────────────────────────────┐
│  📱 Kit de Publicação                         │
│                                                │
│  Caption:                                      │
│    "Tênis Runner Pro — Conforto e estilo"      │
│                                                │
│  Hashtags:                                     │
│    #calcados #oferta #tenisrunnerpro           │
│                                                │
│  CTA:  "Compre agora pelo WhatsApp"            │
│                                                │
│  [✏️ Editar]                                   │
│                                                │
│  (se publication_copy_current existe:          │
│    mostra badge "Editado" ao lado do título)   │
└────────────────────────────────────────────────┘
```

Modo de edição (após clicar "Editar"):
```
┌──────────────────────────────────────────────┐
│  📱 Kit de Publicação                    (badge)│
│                                                │
│  Caption:                                      │
│  ┌──────────────────────────────────────────┐  │
│  │ Tênis Runner Pro — Conforto e estilo     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  Hashtags (uma por linha):                     │
│  ┌──────────────────────────────────────────┐  │
│  │ #calcados                                │  │
│  │ #oferta                                  │  │
│  │ #tenisrunnerpro                          │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  CTA:                                          │
│  ┌──────────────────────────────────────────┐  │
│  │ Compre agora pelo WhatsApp               │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [💾 Salvar]  [↩️ Restaurar original]  [Cancelar]│
└────────────────────────────────────────────────┘
```

**Estados da UI:**

| Ação | Comportamento |
|------|--------------|
| Clicar "Editar" | Entra em modo edição: campos viram inputs preenchidos com valores atuais (current ou snapshot) |
| Clicar "Salvar" | Chama `PATCH /api/campaign/[id]/publication-copy` com os dados → se 200, atualiza estado local → volta ao modo visualização com novos dados |
| Clicar "Restaurar original" | Confirmação "Restaurar texto original da IA?" → se sim, chama `PATCH ... { restore: true }` → resposta 200 retorna `publication_copy_snapshot` → cliente atualiza estado local com os dados restaurados → volta ao modo visualização sem recarregar a página |
| Clicar "Cancelar" | Descarta alterações locais, volta ao modo visualização sem chamar API |

**Estado de loading:** Botão "Salvar" desabilitado + texto "Salvando..." durante requisição. "Restaurar" também desabilitado.

**Tratamento de erro:** Se PATCH falhar, exibir toast/aviso "Não foi possível salvar. Tente novamente." e manter modo edição com dados não salvos.

---

### D5 — Dois planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **17-01** | Migration + Display contract + Validação | Migration: `publication_copy_current` column. `display.ts`: `getEffectivePublicationCopy()` com fallback current→snapshot. `types.ts`: campo opcional em CampaignRecord. `publication-copy.ts`: `validatePublicationCopy()` e tipo `PublicationCopyUpdate` |
| **17-02** | Rota PATCH + UI de edição | `PATCH /api/campaign/[id]/publication-copy`: apiHandler, validação, persistência, restore. `client.tsx`: modo edição inline, botões Salvar/Restaurar/Cancelar, loading/error states |

```
17-01 ──► 17-02
(contrato)  (rota + UI)
```

**Testes distribuídos:**
- 17-01: `validatePublicationCopy` (6+ cenários), `getEffectivePublicationCopy` (3 cenários)
- 17-02: PATCH route (sucesso, validação, ownership, 404, restore), UI (visualização, edição, salvar, restaurar, cancelar, loading, erro)

---

## Estrutura de Código

```
src/app/api/campaign/[id]/
  publication-copy/
    route.ts                  ← NOVO: PATCH apiHandler com validação e persistência

src/lib/campaign/
  display.ts                  ← MODIFICADO: getEffectivePublicationCopy, fallback current→snapshot
  types.ts                    ← MODIFICADO: CampaignRecord.publication_copy_current opcional
  publication-copy.ts         ← NOVO: validatePublicationCopy, PublicationCopyUpdate

src/app/campanha/[id]/
  client.tsx                  ← MODIFICADO: modo edição inline, botões Editar/Salvar/Restaurar/Cancelar

supabase/migrations/
  _<timestamp>_add_publication_copy_current.sql    ← NOVO
```

---

## Testes

### `publication-copy.test.ts`

| Teste | O que valida |
|-------|-------------|
| `validatePublicationCopy` aceita body válido | caption + hashtags + cta_post corretos → sem erros |
| `validatePublicationCopy` aceita `restore: true` | Ignora outros campos, retorna sem erros |
| `validatePublicationCopy` rejeita caption > 2200 chars | Erro de validação |
| `validatePublicationCopy` rejeita hashtag sem # | Erro de formatação |
| `validatePublicationCopy` rejeita > 30 hashtags | Erro de limite |
| `validatePublicationCopy` rejeita hashtag com espaço | Erro de formatação |
| `validatePublicationCopy` rejeita cta_post > 200 chars | Erro de validação |
| `validatePublicationCopy` rejeita body vazio | Erro de validação |

### `display.test.ts` (novos cenários)

| Teste | O que valida |
|-------|-------------|
| `getEffectivePublicationCopy` retorna current quando existe | Current tem prioridade |
| `getEffectivePublicationCopy` retorna snapshot quando current é null | Fallback funciona |
| `getEffectivePublicationCopy` retorna snapshot quando current tem campos faltando | Fallback seguro |
| `getEffectivePublicationCopy` retorna vazio quando ambos são null | Comportamento existente preservado |

### `publication-copy-route.test.ts`

| Teste | O que valida |
|-------|-------------|
| PATCH com body válido atualiza `publication_copy_current` | 200 + dados retornados |
| PATCH com body inválido retorna 400 | Erro de validação + issues |
| PATCH para campanha inexistente retorna 404 | notFound |
| PATCH para campanha de outro tenant retorna 404 | Ownership verificado |
| PATCH com `restore: true` limpa `publication_copy_current` e retorna snapshot | 200 + `{ restored: true, publication_copy_snapshot }` |
| PATCH sem autenticação retorna erro | requireApiUser respeitado |
| PATCH com CSRF inválido retorna erro | requireSameOrigin bloqueia |

### `client.test.tsx` (novos cenários)

| Teste | O que valida |
|-------|-------------|
| Modo visualização exibe publication copy | Caption, hashtags, cta_post presentes |
| Modo visualização exibe badge "Editado" quando current existe | Indicador presente |
| Botão "Editar" entra em modo edição | Inputs aparecem com valores preenchidos |
| Botão "Salvar" chama PATCH com dados corretos | Requisição feita |
| Botão "Restaurar original" chama PATCH com `restore: true` | Requisição feita |
| Botão "Cancelar" volta ao modo visualização sem alterações | Descarte local |
| Estado de loading durante salvamento | Botões desabilitados |
| Estado de erro após falha do PATCH | Mensagem de erro + modo edição mantido |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Usuário edita e fecha o navegador antes de salvar | Sem auto-save — perda deliberada. Melhor que salvar estado inconsistente |
| Validação no backend difere do frontend | Centralizar `validatePublicationCopy` em lib, reutilizar se necessário |
| `publication_copy_current` pode crescer com dados inválidos se migration falhar | Migration é ALTER TABLE ADD COLUMN, não destrutiva. Backup antes |
| Concorrência: dois edits simultâneos | Supabase UPDATE é atômico — último vence. Aceitável para v1 |
| Restaurar original sem confirmação acidental | Confirmação "Restaurar texto original da IA?" antes de executar |
| Badge "Editado" confunde usuário | Texto claro: "Editado por você" |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Histórico de edições (versionamento) | Exigiria tabela separada. Próxima milestone |
| Tabela separada de versões de publication copy | Overhead desnecessário agora. Postergado |
| Preview visual estilo post (Instagram mock) | Feature de UI/UX. Não bloqueia edição de texto |
| Indicador "editado" no dashboard `/minhas-campanhas` | Cosmético. Próximo milestone |
| Duplicar campanha reusando copy editado | Feature maior. Futuro |
| Edição com IA (regenerar caption) | Feature separada. Esta fase é edição manual |
| Auto-save | Perda deliberada. Botão explícito evita surpresas |
| Supabase gen types | Pós-v1.3 |
| Job de cleanup de `generating` stale | Futuro |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — `publication_copy_current` como coluna JSONB direta em `campaigns`
- [ ] D2 — Fallback no display layer: `current > snapshot > vazio`
- [ ] D3 — Rota `PATCH /api/campaign/[id]/publication-copy` com validação no backend e suporte a `restore`
- [ ] D4 — UI: edição inline em `/campanha/[id]` com botões Editar, Salvar (explícito), Restaurar original, Cancelar
- [ ] D5 — Dois planos de execução: 17-01 (contrato) | 17-02 (rota + UI)

### Plano 17-01 — Migration + Display contract + Validação
- [ ] Migration: `ALTER TABLE campaigns ADD COLUMN publication_copy_current JSONB`
- [ ] `types.ts`: adicionar `publication_copy_current: Record<string, unknown> | null` em `CampaignRecord`
- [ ] `display.ts`: `getEffectivePublicationCopy(campaign)` com fallback current→snapshot→vazio
- [ ] `mapCampaignToProps` usar `getEffectivePublicationCopy`
- [ ] `src/lib/campaign/publication-copy.ts` com `validatePublicationCopy(body)` e interface `PublicationCopyUpdate`
- [ ] Testes de `validatePublicationCopy` (8 cenários: válido, restore, caption longo, hashtag sem #, >30 hashtags, hashtag com espaço, cta longo, body vazio)
- [ ] Testes de `getEffectivePublicationCopy` (4 cenários: current existe, current null, current incompleto, ambos null)

### Plano 17-02 — Rota PATCH + UI de edição
- [ ] `src/app/api/campaign/[id]/publication-copy/route.ts` com `PATCH`:
  - [ ] `requireSameOrigin(request)` (CSRF — primeiro guard antes de auth)
  - [ ] `requireApiUser()`
  - [ ] Busca campanha por id (persistence.ts `getCampaign`)
  - [ ] 404 se não existir
  - [ ] `requireOwnership(campaign.store_id, user.userId)` → 404
  - [ ] Validar body via `validatePublicationCopy`
  - [ ] Se `restore: true`: update `publication_copy_current = null`
  - [ ] Se dados normais: update `publication_copy_current = { caption, hashtags, cta_post }`
  - [ ] Retornar 200 com `publication_copy_current` atualizado ou `{ restored: true, publication_copy_snapshot }`
  - [ ] Erro de validação → 400 com `{ error, issues }`
- [ ] `client.tsx` — modo edição inline:
  - [ ] Estado de visualização: exibe publication copy (current ou snapshot) + badge "Editado" se current existe
  - [ ] Botão "✏️ Editar" → entra em modo edição
  - [ ] Modo edição: inputs para caption (textarea), hashtags (textarea "uma por linha", normalizado como array no save), cta_post (input)
  - [ ] Botão "💾 Salvar" → PATCH com dados, loading state, feedback de sucesso/erro
  - [ ] Botão "↩️ Restaurar original" → confirmação → PATCH com `{ restore: true }`
  - [ ] Botão "Cancelar" → descarta alterações locais, volta ao modo visualização
- [ ] Testes do PATCH route (7 cenários: sucesso, validação, 404 inexistente, 404 outro tenant, restore, CSRF inválido, sem auth)
- [ ] Testes do UI (8 cenários: visualização, badge, edição, salvar, restaurar (com response do snapshot), cancelar, loading, erro)

### Verificação final
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] `npm run build` — build bem-sucedido

---

*Documento criado: 2026-07-10*
*Baseado no alinhamento da milestone v1.3, implementação das Fases 12–16, e decisões de escopo discutidas na exploração da Fase 17*
*Próximo passo: revisão do time, ajustes, então compor change proposal + plano GSD da Phase 17*
