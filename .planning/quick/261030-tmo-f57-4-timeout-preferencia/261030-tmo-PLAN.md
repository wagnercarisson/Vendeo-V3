---
status: planned
date: 2026-10-30
slug: f57-4-timeout-preferencia
quick_id: 261030-tmo
initiative: F57.4
phase: quick
plan: 261030-tmo
type: plan-only
wave: 1
depends_on: []
approval: pending_user_codex_review
execution_status: not_started
branch: feature/fase57-4-base-traducao-interface-configuracoes
head: 39ef947e
files_modified:
  - src/lib/i18n/server.ts
  - src/lib/i18n/__tests__/server.test.ts
  - openspec/changes/fase-57-4-base-traducao-interface-configuracoes/specs/ui-localization/spec.md
  - openspec/changes/fase-57-4-base-traducao-interface-configuracoes/specs/user-locale-preference/spec.md
  - openspec/changes/fase-57-4-base-traducao-interface-configuracoes/design.md
  - openspec/changes/fase-57-4-base-traducao-interface-configuracoes/tasks.md
  - .planning/phases/57.4-f57-4-base-de-tradu-o-da-interface-e-configura-es/evidence/57.4-production-timeout-incident.md
  - .planning/STATE.md
autonomous: false
requirements:
  - REQ-57.4-02
must_haves:
  truths:
    - "A leitura de preferência em condições normais de produção não cai no fallback de 200 ms observado em 2026-10-30."
    - "O limite permanece finito, com timer limpo e sem troca tardia de idioma."
    - "Layout e /configuracoes continuam usando uma única leitura cacheada por requisição/usuário."
    - "Nenhuma escrita durante GET, alteração de API/schema, migration ou dependência é introduzida."
    - "O novo valor é justificado e não é apresentado como eliminação de falhas de infraestrutura."
  artifacts:
    - path: "src/lib/i18n/server.ts"
      provides: "Constante de timeout atualizada e documentada"
      contains: "UI_LOCALE_READ_TIMEOUT_MS = 1000"
    - path: ".planning/phases/57.4-f57-4-base-de-tradu-o-da-interface-e-configura-es/evidence/57.4-production-timeout-incident.md"
      provides: "Registro da falha real em produção e distinção causa/homolog"
---

<objective>
Planejar (somente) a correção pontual do timeout de leitura da preferência de interface da F57.4:
`preferences_read_timeout` em produção com o limite de 200 ms.

**Não implementar, não publicar, não acessar banco, não repetir a investigação confirmada.**
</objective>

<context>
- Branch de trabalho: `feature/fase57-4-base-traducao-interface-configuracoes`; HEAD `39ef947e`;
  worktree limpa.
- `origin/main` contém o merge `d56354e5` da F57.4; a publicação foi feita pelo responsável.
  O código publicado não é acessado por esta etapa.
- A F57.4 está verificada local/homolog; produção apresentou o defeito abaixo.
- Evidência histórica do homolog: `.planning/phases/57.4-.../evidence/57.4-homolog-proof.md`.
- Contexto OpenSpec: `openspec/changes/fase-57-4-base-traducao-interface-configuracoes/`.
</context>

## 1. Causa confirmada × hipóteses

**Confirmado:**
- Logs de produção, somente leitura, registraram `[i18n] preferences_read_timeout`:
  - 3 ocorrências em `GET /configuracoes`;
  - 1 ocorrência em `GET /dashboard`.
- O código publicado usa `UI_LOCALE_READ_TIMEOUT_MS = 200` em `src/lib/i18n/server.ts`.
- `/configuracoes` exibe “Não foi possível carregar suas preferências.” quando
  `getUiRenderContext` retorna `ok:false` / `preferences_read_timeout`.
- Não há migration faltante.

**Hipóteses não comprovadas:**
- cold start serverless;
- latência entre aplicação/Vercel e Supabase;
- picos transitórios de conexão/pooler;
- contenção no banco.

Nenhuma dessas hipóteses deve ser apresentada como causa. O aumento do limite não elimina falhas
de infraestrutura; apenas dá margem para o caminho normal completar.

## 2. Solução proposta

**Menor alteração: aumentar o limite único de `200` para `1000 ms`.**

Justificativa:
- o acesso é uma leitura pontual por chave primária (`user_preferences.user_id`), não uma consulta
  pesada;
- 200 ms é agressivo para cold start/pooler em produção; 1000 ms dá margem a picos normais,
  mantendo limite finito e fallback;
- o caminho normal medido no homolog foi p50 ≈ 5 ms / p95 ≈ 7 ms, então o aumento só afeta o
  caminho degradado;
- o pior caso de espera do shell passa a 1 s, ainda limitado e com fallback `pt-BR`;
- `/configuracoes` usa o mesmo contexto; não há timeout distinto nem segunda consulta.

**Estratégias distintas para layout e `/configuracoes`: rejeitadas nesta correção.**
- `getUiRenderContext` é cacheado por requisição/usuário e alimenta layout e página;
- timeouts distintos exigiriam separar a leitura ou aceitar shell em fallback e página em espanhol
  na mesma requisição;
- isso criaria risco de leitura concorrente/duplicada e inconsistência de idioma.
- Se o novo limite ainda falhar em produção, a investigação deve ir para infraestrutura/latência,
  não para timeouts divergentes.

**Não será feito:** remover o limite, retry/polling, cache global, alteração do cliente Supabase,
migration, endpoint novo, mudança de API/schema ou refatoração da tradução.

## 3. Tasks

### T1 — Ajustar o limite e o teste de timeout
**files:** `src/lib/i18n/server.ts`, `src/lib/i18n/__tests__/server.test.ts`

- Trocar `UI_LOCALE_READ_TIMEOUT_MS` para `1000`.
- Atualizar comentário para explicar que 1000 ms é margem para latência normal/cold start e que
  ainda é fallback, não garantia.
- Ajustar o teste existente para o novo valor.
- Adicionar um caso: leitura resolve em ~250 ms (acima dos antigos 200 ms, abaixo de 1000 ms) e
  devolve `ok:true`, sem timeout.
- Preservar o caso acima de 1000 ms com fallback, timer limpo, rejeição tardia isolada e ausência
  de troca tardia.
- Preservar testes de cache/isolamento e ausência de escrita.

**verify:** `npx vitest run src/lib/i18n/__tests__/server.test.ts src/__tests__/app/layout-i18n.test.tsx src/__tests__/app/configuracoes/configuracoes-page.test.tsx`

### T2 — Atualizar referências normativas ativas
**files:** specs `ui-localization` e `user-locale-preference`, `design.md`, `tasks.md` da change ativa.

- Substituir 200 ms por 1000 ms nas referências normativas e nos cenários de timeout.
- Atualizar a task 2.1 e a task 6.4 para o novo limite.
- Atualizar a justificativa do design, sem reescrever a evidência histórica do homolog.
- Não sincronizar nem arquivar a change.

**verify:** `openspec validate fase-57-4-base-traducao-interface-configuracoes --strict`; busca
garante que specs/design/tasks ativos não fixam mais 200 ms como valor vigente.

### T3 — Registrar o incidente de produção
**files:** `evidence/57.4-production-timeout-incident.md`

- Registrar data, somente leitura dos logs, 3 ocorrências em `/configuracoes` e 1 em `/dashboard`.
- Separar causa confirmada de hipóteses.
- Relacionar o valor antigo, o novo e o limite de validade da conclusão.
- Preservar a evidência histórica do homolog; não reescrever os 200 ms antigos.
- Não incluir PII, cookies ou tokens.

### T4 — Gates locais e revisão
- Testes focados, typecheck, lint (limitação TS conhecida), build, `git diff --check`.
- Revisão do diff: apenas timeout, teste, documentação e evidência; sem API/schema/migration.
- Parar para revisão do usuário/Codex antes de publicar.

### T5 — Homolog curto (somente se necessário)
- Reiniciar app de homolog com `I18N_TIMING=1`, carregar `/configuracoes` e `/dashboard` com
  conta de teste existente.
- Registrar `ui_locale_read_ms` e ausência de timeout na amostra curta.
- Não repetir a bateria completa da F57.4.

## 4. Critérios de aceite
- Constante = **1000 ms**; limite finito preservado.
- Leitura de ~250 ms resolve normalmente; >1000 ms cai no fallback `pt-BR` com
  `preferences_read_timeout`.
- Timer limpo, rejeição tardia isolada e nenhuma troca tardia.
- Cache por requisição/usuário, uma leitura por request, sem escrita no GET.
- Nenhuma alteração de API/schema/migration/dependência.
- Specs/design/tasks ativos atualizados; evidência histórica preservada; incidente registrado.
- Gates locais verdes; lint com limitação declarada.
- Nenhuma publicação automática.

## 5. Publicação e rollback (somente após autorização)
1. Confirmar branch/HEAD e diff; publicar apenas o commit da correção.
2. Sem migration e sem alteração de schema.
3. Smoke de produção: login de teste, `/configuracoes` abre, troca `pt-BR → es-419`, reload
   persiste, retorno a `pt-BR`; `/dashboard` carrega.
4. Consultar logs por janela e contar `preferences_read_timeout` e `outcome=timeout`; não declarar
   ausência de erro com base em uma única requisição.
5. Rollback: reverter o commit e publicar o build anterior. Preferências persistidas permanecem
   válidas; o código anterior volta ao limite de 200 ms. Nenhuma migration reversa.

## 6. Riscos
- 1000 ms pode ainda ser insuficiente sob falha de infraestrutura; não é garantia.
- Pior caso de navegação sobe de 200 ms para 1 s apenas no caminho degradado.
- Se timeouts persistirem, investigar cold start/pooler/latência, não aumentar indefinidamente.
- Evidência de produção é pequena (4 amostras); não representa distribuição completa.
- Atualizar specs/design/tasks é necessário para não deixar 200 ms como contrato vigente.

## 7. Fora do escopo
- Alterar `/api/preferences`, CAS/CSRF, banco, migrations ou cliente Supabase global.
- Duas leituras/timeouts distintos, retry/polling, cache global.
- Refatorar i18n, UI, campanhas, onboarding, créditos ou cobrança.
- Sync/archive OpenSpec, merge, push, deploy ou produção nesta etapa.

## 8. Stop condition
Somente plano e tracking. Não alterar código, testes, specs, banco ou ambiente. Parar para revisão
do usuário/Codex antes da implementação.
