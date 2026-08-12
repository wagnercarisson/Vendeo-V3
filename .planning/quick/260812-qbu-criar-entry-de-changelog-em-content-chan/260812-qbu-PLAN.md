---
phase: quick-260812-qbu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md
  - src/lib/changelog/__tests__/get-changelog.test.ts
  - .planning/quick/260812-qbu-criar-entry-de-changelog-em-content-chan/260812-qbu-SUMMARY.md
autonomous: true
requirements: [QBU-01, QBU-02, QBU-03, QBU-04]
must_haves:
  truths:
    - "Uma entry consolidada datada 2026-08-12 existe em content/changelog registrando as 5 entregas visíveis ao lojista: novo endereço vendeo.tech, página inicial pública com solicitação de acesso gratuito, acesso restrito a usuários liberados, app instalável como atalho na tela inicial (celular/desktop) e card de créditos com custos separados por tipo de geração (QBU-01)"
    - "A entry segue o padrão de frontmatter e estrutura do docs/changelog-update.md e das entries existentes, com frontmatter válido no schema zod (QBU-02)"
    - "A entry é escrita em português claro para o lojista e não cita Vercel, DNS, Supabase, migrations, redirects, runbook, branches, PWA nem qualquer detalhe técnico interno (QBU-03)"
    - "As validações de changelog passam (schema + testes de changelog + typecheck + lint) e NENHUM commit é feito: entry, ajuste de teste e SUMMARY ficam no working tree para revisão humana (QBU-04)"
  artifacts:
    - path: "content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md"
      provides: "Entry de changelog consolidada com frontmatter válido (id, title, date, milestone, category, importance, announcement) e seções O que mudou / Por que isso importa / O que você precisa fazer"
      contains: "vendeo.tech"
    - path: "src/lib/changelog/__tests__/get-changelog.test.ts"
      provides: "Duas expectativas com ordenação hardcoded (entries[0] e latest announcement) atualizadas para refletir a nova entry mais recente"
    - path: ".planning/quick/260812-qbu-criar-entry-de-changelog-em-content-chan/260812-qbu-SUMMARY.md"
      provides: "Resumo da quick (sem commit)"
  key_links:
    - from: "content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md"
      to: "src/lib/changelog/schema.ts"
      via: "ChangelogFrontmatterSchema parseia o frontmatter na leitura (zod, fail-fast em get-changelog.ts)"
      pattern: "ChangelogFrontmatterSchema"
    - from: "content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md"
      to: "src/lib/changelog/__tests__/get-changelog.test.ts"
      via: "getAllEntries ordena por data DESC — a nova entry (2026-08-12) passa a ser entries[0] e o latest announcement (card); as 2 expectativas hardcoded precisam refletir isso"
      pattern: "entries\\[0\\].frontmatter.id"
---

<objective>
Criar UMA entry consolidada de changelog em `content/changelog` registrando as entregas visíveis recentes do Vendeo para o lojista (novo endereço vendeo.tech, landing pública com solicitação de acesso free, beta fechado com login apenas para liberados, app instalável como atalho na tela inicial, card de créditos separando custos por tipo de geração).

**Purpose:** O guia `docs/changelog-update.md` exige que toda entrega com impacto perceptível ao lojista gere/atualize uma entry. As entregas das quicks 260808-rqw (landing + acesso fechado) e 260808-udc (PWA + clareza no card de créditos) e a migração de domínio vendeo.tech ainda não têm entry — esta quick consolida tudo em uma única entry datada 2026-08-12.

**Output:**
- `content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md` — a entry (único entregável de produto; **nada de código funcional**)
- `src/lib/changelog/__tests__/get-changelog.test.ts` — ajuste MÍNIMO de 2 expectativas de teste (ver Task 2 — manutenção de teste causada pela nova entry, não código funcional)
- `.planning/quick/260812-qbu-criar-entry-de-changelog-em-content-chan/260812-qbu-SUMMARY.md` — resumo da quick

**Regra de commit — OBRIGATÓRIA:** NENHUM `git commit` nesta execução. O executor cria/edita os arquivos e os deixa no working tree sem commit, para revisão humana. O commit fica para depois da aprovação humana (o ajuste de teste da Task 2 é justamente o ponto que o humano deve validar antes de commitar).
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/changelog-update.md
@.planning/STATE.md
@content/changelog/2026-08-06-fase-36-onboarding-navegacao-por-abas.md
@content/changelog/2026-07-31-fase-35-changelog-novidades.md
@src/lib/changelog/schema.ts
@src/lib/changelog/get-changelog.ts
@src/lib/changelog/__tests__/get-changelog.test.ts

# Convenções extraídas das entries existentes (F30/F32/F34/F35/F36) e do guia:

- **Arquivo:** `content/changelog/YYYY-MM-DD-slug.md` (slug minúsculo, hífens).
- **Frontmatter (valores entre aspas duplas), todos obrigatórios exceto milestone:** `id` (slug único estável), `title` (claro, não técnico), `date` (YYYY-MM-DD, data civil BR), `milestone` (opcional — padrão atual `"v1.5"`), `category` (`feature`|`improvement`|`fix`), `importance` (`major`|`minor`), `announcement` (`none`|`card`|`modal`).
- **Corpo:** seções `## O que mudou`, `## Por que isso importa`, `## O que você precisa fazer` (padrão das entries mais recentes F35/F36), com bullets curtos e **bold** nos termos-chave.
- **Tom:** português claro para o lojista; responde o que mudou, por que importa e se há ação esperada; **nunca** nomes de componentes, endpoints, tabelas, serviços, infra.
- **Validação real:** o frontmatter é parseado pelo zod em `src/lib/changelog/schema.ts` (fail-fast em `get-changelog.ts`). Não existe script de changelog no `package.json` — a validação executável é o teste `src/lib/changelog/__tests__/get-changelog.test.ts` + typecheck + lint.

# Impacto da nova entry nas validações existentes (fato importante para a Task 2):

`get-changelog.test.ts` lê o diretório real e tem 2 expectativas com ordenação hardcoded que QUEBRAM ao adicionar a entry de 2026-08-12:
- Linha 36–41: `expect(entries[0].frontmatter.id).toBe("fase-36-onboarding-navegacao-por-abas")` e `.date` `"2026-08-06"` — com a nova entry (2026-08-12, mais recente) `entries[0]` passa a ser ela.
- Linha 99–103: `getLatestAnnouncement` no diretório real espera `fase-36` como mais recente com anúncio — com a nova entry `announcement: "card"`, o mais recente passa a ser ela.

Isso é manutenção de teste exigida pelo conteúdo novo (não é código funcional de produto). O ajuste é mínimo e fica **sem commit** para o humano revisar e aprovar junto com a entry.

# Sobre `announcement: "card"`:

Compatível com o guia e com o padrão do repo (F35 e F36 usam `card`). `getLatestAnnouncement` retorna apenas a entry mais recente com anúncio → a nova entry vira o card ativo da dashboard e o card da F36 deixa de ser exibido automaticamente (sem ação extra).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Criar a entry consolidada de changelog (2026-08-12)</name>
  <files>content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md</files>
  <action>
  Criar o arquivo `content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md` com EXATAMENTE este conteúdo (é o entregável da quick — não alterar copy):

  Frontmatter (valores entre aspas duplas, na ordem):
  - `id: "vendeo-em-novo-endereco-acesso-simples"`
  - `title: "Vendeo em novo endereço, com acesso mais simples pelo celular"` (sugestão do usuário, aplicada)
  - `date: "2026-08-12"`
  - `milestone: "v1.5"`
  - `category: "improvement"` (sugestão do usuário, aplicada — melhora a experiência de acesso e clareza)
  - `importance: "major"` (sugestão do usuário, aplicada — muda o fluxo principal de acesso do lojista)
  - `announcement: "card"` (sugestão do usuário, aplicada — destaque leve na dashboard)

  Corpo — seção `## O que mudou` com bullets (verbatim):
  - O Vendeo agora está em um novo endereço: **vendeo.tech**.
  - A página inicial virou pública: qualquer pessoa pode conhecer o Vendeo e **solicitar acesso gratuito** sem depender de convite.
  - O acesso continua controlado: só entra quem foi liberado. Quem ainda não tem acesso pode pedir pela página inicial.
  - Agora dá para **instalar o Vendeo como aplicativo** no celular ou no computador: ele vira um atalho na tela inicial, com ícone próprio, para abrir direto como qualquer app.
  - O card de créditos ficou mais claro: os custos aparecem separados por tipo de geração (campanha e assinatura visual), sem textos confusos.

  Seção `## Por que isso importa` (verbatim):
  - Com o novo endereço, fica mais fácil apresentar o Vendeo para a sua loja e para outras lojas.
  - Instalar como aplicativo deixa o Vendeo sempre à mão, com um toque na tela inicial.
  - Ver o custo separado por tipo de geração ajuda a acompanhar seus créditos com mais clareza.

  Seção `## O que você precisa fazer` (verbatim):
  - Acesse o Vendeo pelo novo endereço **vendeo.tech**.
  - No celular ou no computador, use **Adicionar à tela inicial** (ou **Instalar aplicativo**, no navegador) para criar o atalho do Vendeo.
  - Se ainda não tiver acesso, solicite pela página inicial — você entra assim que for liberado.

  Formatação do arquivo: frontmatter delimitado por `---` no topo (mesmo formato das entries existentes), uma linha em branco entre frontmatter e corpo, e uma linha em branco entre seções. Termos-chave em **negrito** como nas entries F35/F36.

  RESTRIÇÕES EDITORIAIS (conferir antes de salvar): não usar as palavras Vercel, DNS, Supabase, migration(s)/migração, redirect(s), runbook, branch(es), PWA, endpoint, service worker, hook, componente, tabela — nem qualquer outro detalhe técnico interno. O texto acima já está limpo; não reescrever a copy.
  </action>
  <verify>
    <automated>rg -c "^id: \"vendeo-em-novo-endereco-acesso-simples\"|^title: \"Vendeo em novo endereço|^date: \"2026-08-12\"|^category: \"improvement\"|^importance: \"major\"|^announcement: \"card\"" content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md; if (-not $?) { exit 1 }; rg -in "vercel|supabase|dns|migra|redirect|runbook|branch|pwa|endpoint|service worker" content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md; if ($LASTEXITCODE -eq 0) { exit 1 } else { "FORBIDDEN-TERMS-CLEAN" }</automated>
  </verify>
  <done>A entry `2026-08-12-vendeo-em-novo-endereco-acesso-simples.md` existe com frontmatter completo (id/title/date/milestone/category/importance/announcement), as 3 seções do padrão, as 5 entregas cobertas em português claro para o lojista, e nenhuma menção a termos técnicos internos. Sem commit.</done>
</task>

<task type="auto">
  <name>Task 2: Validar changelog (schema + testes) e ajustar as 2 expectativas hardcoded</name>
  <files>
    - src/lib/changelog/__tests__/get-changelog.test.ts
    - .planning/quick/260812-qbu-criar-entry-de-changelog-em-content-chan/260812-qbu-SUMMARY.md
  </files>
  <action>
  Validar a entry criada na Task 1 e ajustar a manutenção de teste necessária:

  1. Rodar a validação de changelog: `npm test -- src/lib/changelog/__tests__/get-changelog.test.ts`. Esperado: 2 falhas nos testes que leem o diretório real (asserções hardcoded sobre a entry mais recente).

  2. Aplicar o ajuste MÍNIMO no arquivo `src/lib/changelog/__tests__/get-changelog.test.ts` (apenas estas mudanças — nada além):
     - Teste "getAllEntries lê o diretório real..." (linha ~36): atualizar o nome do teste de `(F36 → F35 → F34 → F32 → F30)` para `(novo-endereço 2026-08-12 → F36 → F35 → F34 → F32 → F30)`; trocar `expect(entries[0].frontmatter.id).toBe("fase-36-onboarding-navegacao-por-abas")` por `toBe("vendeo-em-novo-endereco-acesso-simples")`; trocar `expect(entries[0].frontmatter.date).toBe("2026-08-06")` por `toBe("2026-08-12")`. As asserções de entries[1] (fase-36 / 2026-08-06) permanecem como estão.
     - Teste "getLatestAnnouncement retorna a entry mais recente com anúncio no diretório real (F36)" (linha ~99): atualizar o nome do teste para citar a nova entry (ex.: `(nova entry 2026-08-12)`); trocar `expect(result!.frontmatter.id).toBe("fase-36-onboarding-navegacao-por-abas")` por `toBe("vendeo-em-novo-endereco-acesso-simples")`.
     - NÃO alterar mais nada no arquivo (demais testes usam fixtures temporárias e seguem válidos).

  3. Re-rodar `npm test -- src/lib/changelog/__tests__/get-changelog.test.ts` até passar 100%.

  4. Rodar as validações de projeto afetadas: `npm run typecheck` e `npm run lint` (devem passar limpos).

  5. Criar `.planning/quick/260812-qbu-criar-entry-de-changelog-em-content-chan/260812-qbu-SUMMARY.md` seguindo o template summary.md, registrando: entry criada (path + data + categoria/importância/announcement), resumo do conteúdo, ajuste das 2 expectativas de teste e por quê (ordenação hardcoded do diretório real), resultado das validações (testes/typecheck/lint verdes) e a restrição explícita de que NENHUM commit foi feito.

  6. **NÃO executar `git commit`** (nem add, nem commit, nem push). Conferir no final que `git status --porcelain` mostra exatamente os 3 arquivos desta quick como untracked/modified.
  </action>
  <verify>
    <automated>npm test -- src/lib/changelog/__tests__/get-changelog.test.ts 2>&1; npm run typecheck 2>&1; npm run lint 2>&1; git status --porcelain</automated>
  </verify>
  <done>Teste de changelog passa (schema zod valida a nova entry), typecheck e lint verdes, SUMMARY.md criado, e `git status --porcelain` mostra a entry, o teste ajustado e o SUMMARY **sem commit** — prontos para revisão humana. Nenhum commit foi criado nesta execução.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| entry changelog → app (parser zod + /novidades) | conteúdo user-facing parseado em runtime; frontmatter inválido quebra a página de novidades (fail-fast) |
| entry changelog → dashboard (announcement) | nova entry com `announcement: card` vira o card ativo da dashboard (substitui o da F36) |
| conteúdo da entry → público (lojistas) | texto publicado em canal visível a todos os usuários liberados |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260812-01 | Tampering | frontmatter da entry (schema zod) | mitigate | frontmatter fixado no plano (Task 1) com valores exatos; validado por `npm test -- src/lib/changelog/__tests__/get-changelog.test.ts` (zod fail-fast) |
| T-260812-02 | Information Disclosure | corpo da entry (canais públicos) | mitigate | restrição editorial de termos proibidos (Vercel/DNS/Supabase/migrations/redirects/runbook/branches/PWA) verificada por grep na Task 1 + revisão humana pré-commit |
| T-260812-03 | Availability | src/lib/changelog/__tests__/get-changelog.test.ts | mitigate | as 2 expectativas hardcoded do diretório real são atualizadas para a nova entry (Task 2) e o teste re-rodado até verde — sem deixar suite quebrada |
| T-260812-04 | Spoofing (UI) | announcement da dashboard | accept | `announcement: "card"` segue o padrão do repo (F35/F36); `getLatestAnnouncement` exibe só a mais recente — card antigo cai automaticamente, sem ação extra |
</threat_model>

<verification>
```bash
# 1. Entry existe com frontmatter completo e sem termos técnicos proibidos (Task 1)
rg -c "^id:|^title:|^date: \"2026-08-12\"|^milestone:|^category:|^importance:|^announcement:" content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md
rg -in "vercel|supabase|dns|migra|redirect|runbook|branch|pwa|endpoint|service worker" content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md   # esperado: sem matches
# 2. Validações de changelog + projeto verdes (Task 2)
npm test -- src/lib/changelog/__tests__/get-changelog.test.ts
npm run typecheck
npm run lint
# 3. Sem commit — exatamente 3 arquivos no working tree
git status --porcelain
# 4. SUMMARY.md criado
Test-Path ".planning/quick/260812-qbu-criar-entry-de-changelog-em-content-chan/260812-qbu-SUMMARY.md"
</verification>

<success_criteria>
- [ ] Existe exatamente UMA entry nova: `content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md` (QBU-01).
- [ ] A entry cobre as 5 entregas visíveis: vendeo.tech, página inicial pública com solicitação de acesso free, beta fechado (só liberados), app instalável (atalho na tela inicial celular/desktop), card de créditos com custos separados por tipo de geração (QBU-01).
- [ ] A entry segue o padrão exato do guia e das entries existentes: frontmatter completo (id, title, date, milestone, category, importance, announcement) + seções `## O que mudou` / `## Por que isso importa` / `## O que você precisa fazer` (QBU-02).
- [ ] Texto em português claro para o lojista, sem jargão técnico e sem as palavras proibidas (QBU-03).
- [ ] Sugestões do usuário aplicadas: título "Vendeo em novo endereço, com acesso mais simples pelo celular", `category: "improvement"`, `importance: "major"`, `announcement: "card"` (QBU-04 — compatível com o guia e com o padrão do repo).
- [ ] Validações verdes: teste de changelog (inclui schema zod), typecheck e lint (QBU-04).
- [ ] As 2 expectativas hardcoded do teste de changelog foram ajustadas de forma mínima e documentada no SUMMARY (QBU-04).
- [ ] NENHUM commit foi feito — os 3 arquivos estão no working tree para revisão humana (QBU-04).
</success_criteria>

<output>
Create `.planning/quick/260812-qbu-criar-entry-de-changelog-em-content-chan/260812-qbu-SUMMARY.md` when done

**IMPORTANTE:** NÃO commitar nada. Deixar todos os arquivos no working tree para revisão humana.
</output>
