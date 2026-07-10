## Context

A milestone v1.3 foi concluída com sucesso (F12–F16). O lojista gera, persiste, encontra e baixa campanhas. O publication copy (caption, hashtags, cta_post) é gerado pela IA e armazenado como snapshot imutável em `publication_copy_snapshot`.

**Problema:** O lojista não pode ajustar o texto de publicação sem regerar a campanha inteira. Se a IA sugeriu um caption que não reflete a oferta real, ou se o lojista quer adicionar hashtags sazonais, ele precisa editar apenas o texto — sem alterar a imagem, sem nova geração.

**Dependências:** F12 (tabela `campaigns` com `publication_copy_snapshot`), F15 (página `/campanha/[id]`, display contract em `display.ts`, client component `client.tsx`), F13 (padrão apiHandler de route handlers).

## Goals / Non-Goals

**Goals:**
- Adicionar coluna `publication_copy_current` (JSONB, nullable) em `campaigns` para armazenar a versão editada
- Modificar o display contract para dar preferência a `publication_copy_current` com fallback para `publication_copy_snapshot` quando `current` for null
- Criar rota `PATCH /api/campaign/[id]/publication-copy` com ownership, validação e persistência
- Adicionar modo de edição inline na página `/campanha/[id]` com botões "Salvar", "Restaurar original" e "Cancelar"
- Validação básica de tamanho/formato no backend
- `publication_copy_snapshot` permanece imutável — a edição nunca o altera

**Non-Goals:**
- Histórico de edições (versionamento) — exigiria tabela separada
- Tabela separada de versões de publication copy
- Preview visual estilo post (Instagram mock)
- Indicador "editado" no dashboard `/minhas-campanhas`
- Duplicar campanha reusando copy editado
- Edição com IA (regenerar caption)
- Auto-save
- Supabase gen types

## Decisions

### D1 — `publication_copy_current` como coluna JSONB direta em `campaigns`

`CONFIRMADO`

```
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS publication_copy_current JSONB;

COMMENT ON COLUMN public.campaigns.publication_copy_current IS
  'Versão editada pelo usuário do publication copy. Se null, usar publication_copy_snapshot como fallback.';
```

**Motivos:**
- Migração mínima: não cria tabela nova, não quebra existente
- Leitura sem JOIN: o Server Component busca `campaigns.*` e decide no display layer qual usar
- `publication_copy_snapshot` permanece imutável — nunca é tocado por escrita do usuário
- Se `current` for null, o fallback usa o snapshot — sem lógica condicional complexa

### D2 — Fallback no display layer: `current > snapshot > vazio`

`CONFIRMADO`

Criar `getEffectivePublicationCopy(campaign)` em `display.ts`. Regra:
- Se `publication_copy_current` não é null, é um objeto, e contém `caption: string`, `hashtags: string[]`, `cta_post: string` → usa current
- Caso contrário → fallback para `publication_copy_snapshot`
- Se nem current nem snapshot têm dados → string vazia / array vazio
- **Critério é de shape/tipo, não de truthiness.** `cta_post` vazio (`""`) é um valor válido e não causa fallback indevido para o snapshot.

`mapCampaignToProps` passa a usar `getEffectivePublicationCopy` em vez de ler diretamente o snapshot.

**Novos campos no contrato:**
- `campaignId: string` — ID da campanha, usado pelo Client Component para montar a URL do PATCH (`/api/campaign/${campaignId}/publication-copy`)
- `isPublicationCopyEdited: boolean` — derivado de `publication_copy_current !== null`, usado pelo Client Component para exibir o badge "Editado" sem precisar acessar o snapshot diretamente

### D3 — Rota PATCH com validação no backend

`CONFIRMADO`

```
PATCH /api/campaign/[id]/publication-copy

Body (edição normal):
{ caption: "Novo texto", hashtags: ["#promocao", "#oferta"], cta_post: "Compre agora" }

Body (restaurar original):
{ restore: true }
```

**Fluxo:**
```
request → requireSameOrigin (CSRF) → requireApiUser → validar UUID v4 (se inválido → 404) → busca campaign por id
  → se não existir → 404
  → requireOwnership(campaign.store_id) → se falhar → 404
  → validar body
    → se restore === true:
        supabaseAdmin.from("campaigns").update({ publication_copy_current: null }).eq("id", id)
        → ler snapshot do banco
        → response 200 { restored: true, publication_copy_snapshot: { caption, hashtags, cta_post } }
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

### D4 — UI: edição inline em `/campanha/[id]`

`CONFIRMADO`

| Ação | Comportamento |
|------|--------------|
| Clicar "Editar" | Entra em modo edição: campos viram inputs preenchidos com valores atuais (current ou snapshot) |
| Clicar "Salvar" | Chama PATCH com dados → se 200, atualiza estado local → volta ao modo visualização |
| Clicar "Restaurar original" | Confirmação → chama PATCH `{ restore: true }` → resposta retorna snapshot → cliente atualiza estado → volta ao modo visualização sem recarregar |
| Clicar "Cancelar" | Descarta alterações locais, volta ao modo visualização sem chamar API |

**Badge "Editado":** Exibido ao lado do título "Kit de Publicação" quando `publication_copy_current` não é null.

### D5 — Dois planos de execução

`CONFIRMADO`

| Plano | Foco | Arquivos |
|-------|------|----------|
| **17-01** | Migration + Display contract + Validação | Migration column, `display.ts` (`getEffectivePublicationCopy`), `types.ts` (campo opcional), `publication-copy.ts` (validação) |
| **17-02** | Rota PATCH + UI de edição | `route.ts` (PATCH), `client.tsx` (modo edição inline) |

```
17-01 ──► 17-02
(contrato)  (rota + UI)
```

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Usuário edita e fecha o navegador antes de salvar | Sem auto-save — perda deliberada. Melhor que salvar estado inconsistente |
| Validação no backend difere do frontend | Centralizar `validatePublicationCopy` em lib — testável isoladamente |
| `publication_copy_current` pode crescer com dados inválidos se migration falhar | Migration é ALTER TABLE ADD COLUMN, não destrutiva |
| Concorrência: dois edits simultâneos | Supabase UPDATE é atômico — último vence. Aceitável para v1 |
| Badge "Editado" confunde usuário | Texto claro: "Editado por você" |
