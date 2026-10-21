## Context

A `main` está em `8c4413de` (F50.2 arquivada, oferta ativa, F56 avançada) e a `escopo/landing` em `7d0d6d96` (F51.1 e F51.2 concluídas/arquivadas na branch, não publicadas). O merge-base é `e018c766`.

O merge de `escopo/landing` na `main` tem 14 arquivos tocados por ambas as frentes e 10 entradas de conflito previstas:

| Arquivo | Conflito | Fonte de verdade |
|---|---|---|
| `.planning/REQUIREMENTS.md` | textual | `main` + registro histórico F51.1/F51.2 |
| `.planning/ROADMAP.md` | textual | `main` + registro histórico F51.1/F51.2 |
| `.planning/STATE.md` | textual | `main` + registro histórico F51.1/F51.2 |
| `eslint.config.mjs` | textual | `main` (ignore específico do laboratório) |
| `next.config.ts` | textual | combinação: laboratório + headers + redirects |
| `src/__tests__/next.config.test.ts` | textual | combinação: laboratório + headers + redirects |
| `src/__tests__/app/landing-page.test.tsx` | modify/delete | migrar cobertura válida e então remover |
| `src/components/landing/access-request-section.tsx` | textual | landing (estrutura) + `main` (texto de convite/spam) |
| `tsconfig.json` | textual | `main` + exclusões específicas necessárias |
| `tsconfig.typecheck.json` | textual | `main` + exclusões específicas necessárias |

Além disso, `.opencode/**` foi alterado nas duas frentes sem conflito textual; a versão da `main` deve prevalecer para não reverter configuração atual.

Restrições: a `main` já corrigiu a exceção de typecheck `ssl`/`pg`; o laboratório usa `distDir` isolado sob sentinel; a oferta F50.2 está ativa em produção; a confirmação de convite por e-mail/caixa de spam é comportamento atual e aprovado.

## Goals / Non-Goals

**Goals:**

- Integrar landing F51.1 e SEO F51.2 preservando o visual aprovado e o aplicativo atual.
- Manter a confirmação de convite por e-mail e caixa de spam.
- Migrar cobertura válida antes de remover o teste legado.
- Recompor headers de SEO, isolamento do laboratório e os quatro redirects no mesmo `next.config.ts`.
- Preservar F56, backend, migrations, modelos, providers, créditos e flags sem alteração.
- Preservar o tracking atual e registrar F51.1/F51.2 como histórico integrado.
- Validar typecheck, lint, build, SEO compilado, testes relevantes e UAT mobile/desktop nos dois modos.
- Deixar explícito o follow-up de canonical/OG sem corrigi-lo.

**Non-Goals:**

- Executar merge, implementação, GSD, push, deploy, configuração externa, migrations, e-mail real ou geração paga **nesta rodada de elaboração da proposta**.
- Redefinir requisitos já aprovados de F51.1, F51.2, F50.2 ou F56.
- Alterar o texto público da oferta sem aprovação humana.
- Corrigir a origem canônica em produção ou o fallback de `metadataBase`.
- Criar terceira worktree, copiar `node_modules`, `.next`, credenciais ou ambientes.
- Fazer merge da branch de integração para a `main`, push ou publicação nesta rodada.

## Decisions

### D-01 — Merge controlado em branch própria, sem commit automático

Criar `integracao/landing-app-atual` a partir da `main` e executar `git merge --no-commit --no-ff escopo/landing` nela. O `--no-commit` impede qualquer commit automático antes da revisão; o `--no-ff` preserva a fronteira explícita da integração. Rebase foi descartado: reescreveria os commits já auditados da F51.1/F51.2 e dificultaria rastrear a cobertura migrada.

**Pré-condições:** os artefatos OpenSpec aprovados e o planejamento GSD devem estar commitados antes do merge, deixando a árvore limpa; `.dev.log` e alterações preexistentes identificadas e preservadas; SHAs completos de `main`, `escopo/landing` e merge-base registrados. A comparação de caminhos protegidos usa o **SHA completo da `main` registrado como base**, não o merge-base e não uma referência móvel.

### D-02 — Matriz de resolução por arquivo

- Arquivos exclusivos da landing (`src/components/landing/**`, `src/lib/seo/**`, `src/app/robots.ts`, `src/app/sitemap.ts`, `public/landing/**`, `public/seo/**`, specs F51.1/F51.2, artefatos `.planning/phases/51.*`): aceitar a versão da landing.
- Arquivos exclusivos da `main` e todo o backend/F56/F50.2: intocados.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`: partir da versão da `main` e acrescentar somente o registro histórico/integrado de F51.1/F51.2. Não restaurar posições, status ou fases antigas.
- `.opencode/**`: manter a versão da `main` (configuração atual), salvo complemento aditivo indispensável.
- `access-request-section.tsx`: adotar a estrutura da landing (seção apenas com formulário; Novidades no rodapé) e manter o texto de sucesso da `main` com convite por e-mail e caixa de spam.
- Configuração (`next.config.ts`, testes, `tsconfig*`, `eslint`, `.gitignore`): combinar, nunca escolher um lado inteiro.

### D-03 — Preservação explícita da confirmação de convite

A landing reduz `AccessRequestSection` ao cartão `#acesso`, mas o estado de sucesso deve manter exatamente o comportamento atual da `main`:

> “Recebemos sua solicitação. Vamos analisar seu pedido e, se aprovado, você receberá um convite por e-mail no endereço informado. Verifique também a caixa de spam.”

O formulário, `POST /api/access-requests`, resposta anti-enumeração e CTAs por flag permanecem inalterados. O teste do estado de sucesso deve afirmar convite por e-mail e caixa de spam.

### D-04 — Testes: migrar antes de remover

`src/__tests__/app/landing-page.test.tsx` é modificado na `main` e removido na landing. Antes da remoção:

1. Confirmar que as quatro interações de Novidades (abrir, fechar com foco, `Escape`, estado vazio) já estão cobertas pelo teste novo via gatilho do rodapé.
2. Migrar a asserção da `main` sobre convite por e-mail e caixa de spam para o teste vigente de `AccessRequestSection`/landing.
3. Substituir a asserção “CTA do hero some após envio” por cobertura do comportamento novo: o formulário é substituído pelo cartão de sucesso e não permite reenvio dentro de `#acesso`; os CTAs dos blocos permanecem visíveis por desenho da F51.1.
4. Só remover o arquivo legado depois que a cobertura migrada estiver verde.

### D-05 — `next.config.ts` combinado

Manter, na mesma configuração:

- o bloco condicional do laboratório (`VENDEO_LAB_ISOLATED_DIST === "true"` → `distDir` e `tsconfigPath` dedicados);
- `headers()` com `buildRobotsHeaders({ productionConfirmed: isProductionConfirmed() })`;
- os quatro redirects 301 existentes, sem adicionar redirect de `/`.

O teste de `next.config.ts` deve combinar as três famílias: isolamento do laboratório (com/sem sentinel), headers por ambiente/rota e quatro redirects, inclusive no modo isolado. Nenhuma regra de `Disallow` é introduzida.

### D-06 — TypeScript, lint e ignores sem ocultar produto

- Manter a correção atual de typecheck da `main`; não reintroduzir a exceção `ssl`/`pg`.
- Manter no `tsconfig.json` principal a inclusão atual de `.next/types/**/*.ts`, necessária aos tipos gerados pelo Next. Não redesenhar os tsconfigs.
- Manter a exclusão de `.next` no `tsconfig.typecheck.json` dedicado ao typecheck, como já ocorre na `main`.
- Manter o ignore específico `supabase/.temp/landing-lab/.next-web/` no ESLint e `tsconfig.landing-lab.json` no `.gitignore`.
- Não adotar, no ESLint, o ignore amplo `supabase/.temp/` nem `node_modules.*` da landing. Se o ambiente de integração gerar `node_modules.shared-link`, excluir somente esse caminho exato.
- As exclusões do `tsconfig` do laboratório permanecem como estão; nenhum caminho de `src/**` ou de teste pode ser excluído.
- Verificar que nenhum ignore esconde arquivo de produto ou teste e que `npm run typecheck` e `npm run lint` passam.

### D-07 — Fronteira funcional e base de comparação

Não alterar `supabase/migrations/**`, `src/app/api/**`, `src/lib/ai/**`, créditos, trial-offer, product-1-1, providers, flags operacionais, `middleware.ts` ou telas autenticadas. A landing pode consumir `getLaunchConfig()` e `POST /api/access-requests` como contratos existentes.

A prova de não-regressão compara o diff da integração com o **SHA completo da `main` registrado como base** (`8c4413de48cc8aab43a0b5f44e71983ffcd8addd`), não com o merge-base e não com `main`/`origin/main` no momento da checagem. A branch de integração não é mesclada na `main` nesta mudança.

### D-08 — Auditoria da oferta e aprovação de texto

Comparação entre a comunicação da landing e a política `trial-offer` implementada:

| Afirmação pública | Política implementada | Situação |
|---|---|---|
| “28 dias gratuitos e até 20 créditos” | 4 parcelas de 5, máximo 20, janela de 28 dias | Consistente |
| “5 iniciais e mais 5 nos dias 7, 14 e 21” | Parcelas elegíveis nos dias 7/14/21; cron diário credita na execução seguinte | **Ajuste necessário de texto** |
| “O período começa após concluir o cadastro e a configuração inicial” | Exige conta criada a partir do marco, raiz de CNPJ, loja não-teste e chave ligada | **Ajuste necessário de elegibilidade** |
| “Os créditos acumulam… vencem ao final do período” | Acúmulo e vencimento único em `expires_at` | Consistente |
| “No beta fechado, solicitar acesso não inicia o período” | Início somente na conclusão do onboarding elegível | Consistente |

**Texto proposto (aprovado em 2026-10-21):**

- Substituir a mecânica por: “Você recebe 5 créditos iniciais. Mais 5 são liberados a partir dos dias 7, 14 e 21, no processamento diário, até o máximo de 20 créditos no período.”
- Acrescentar no conteúdo secundário apenas: “Oferta para novas contas elegíveis.”

A decisão humana **não autoriza** exibir a participação por raiz de CNPJ na landing. A elegibilidade por raiz continua sendo regra interna da política `trial-offer`; a comunicação pública apenas informa que a oferta é para novas contas elegíveis. A frase sobre o início após o cadastro permanece.

**Escopo futuro (não aprovado para implementação):** avaliar a elegibilidade por **CNPJ completo**, em vez de raiz de CNPJ. Não altera a política atual, backend, migrations ou créditos nesta mudança.

### D-09 — Tracking: base atual + histórico

Usar `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` da `main` como base. Acrescentar F51.1/F51.2 como frentes concluídas/integradas, com SHAs e resultado da validação, sem:

- restaurar “Current Position” antiga (F56.2a) ou status anteriores;
- sobrescrever F50.2 concluída/ativa e a trilha F56 atual;
- reabrir fases já arquivadas;
- reintroduzir instrumentação de funil removida da F51.1.

O tracking de produto (`product_events` e eventos existentes) não é alterado.

### D-10 — Validação integrada

Sequência mínima, executada de forma sequencial para não disputar `.next` com servidor de desenvolvimento nem com o laboratório:

1. Testes relevantes:
   - landing, `next.config`, SEO (`src/lib/seo/**`, `src/__tests__/app/*`), acesso/convite;
   - oferta F50.2: `src/lib/credit/__tests__/trial-offer-*`, `src/app/api/admin/trial-offer/__tests__`, `src/app/api/store/trial-offer/retry/__tests__`, `src/components/credit/__tests__/trial-offer-retry.test.tsx` e `src/app/(app)/admin/feature-flags/__tests__/trial-offer-panel.test.tsx`;
   - contratos F56 relevantes (`src/lib/product-1-1/__tests__/*.contract.test.ts`, `src/lib/ai/__tests__/image-generation-config-snapshot*.test.ts`, `src/lib/ai/__tests__/image-generation-failure-policy.test.ts` e `src/lib/ai/__tests__/new-flow-isolation.contract.test.ts`), sem provider pago.
2. `npm run typecheck`.
3. `npm run lint`.
4. `npm run build`.
5. Smoke HTTP da aplicação compilada em porta loopback, não apenas inspeção de arquivos: home, `robots.txt`, `sitemap.xml`, headers `X-Robots-Tag` e os quatro redirects.
6. SEO compilado em três cenários: produção válida (home indexável), produção com origem inválida (fail-closed/noindex) e preview/local (`noindex`).
7. UAT visual mobile/desktop nos modos flag off/on, sem ativar signup público em produção.
8. `openspec validate --strict` para esta mudança.

Os builds não rodam em paralelo com `next dev` nem com o laboratório. Alterações temporárias de ambiente ficam restritas ao processo local e são restauradas ao final; nenhuma flag ou configuração externa é alterada.

### D-11 — Follow-up de canonical/OG

Registrar no tracking e no resumo da integração: em produção confirmada com origem inválida/ausente, `metadataBase` recai em `FALLBACK_ORIGIN` e a home emite `canonical`/`og:url` com `http://localhost:3000`. A recomendação é omitir essas URLs nesse caso, mas **não** será implementada nesta mudança.

### D-12 — Rollback e commits

Os artefatos aprovados e o planejamento são commitados antes do merge, deixando a árvore limpa. O merge usa `--no-commit --no-ff`: se a resolução não for segura, `git merge --abort` restaura o estado anterior sem commit de merge. O commit de merge na branch de integração só ocorre após a revisão. Não há merge para `main`, push ou deploy antes da aprovação humana.

## Risks / Trade-offs

- **Regressão silenciosa do convite/spam** → texto da `main` preservado e teste explícito antes da remoção do legado.
- **Perda do isolamento do laboratório** → merge combinado + testes com e sem sentinel.
- **Headers de SEO quebrarem redirects** → teste único cobrindo headers e os quatro redirects.
- **Ignores amplos esconderem produto** → proibir `supabase/.temp/` e `node_modules.*` genéricos; excluir apenas caminhos gerados.
- **Tracking antigo sobrescrever F56/F50.2** → base da `main` e inserção aditiva.
- **Divergência de copy da oferta** → auditoria registrada e ajuste sujeito a aprovação.
- **Teste legado removido cedo demais** → remoção somente após cobertura migrada verde.
- **Follow-up de canonical ser “corrigido” por engano** → registrar como pendência e não tocar em `src/lib/seo/origin.ts`/metadata.

## Migration Plan

1. Confirmar branch, SHAs, worktree limpa, artefatos/planejamento commitados e preservação de `.dev.log`.
2. Executar `git merge --no-commit --no-ff escopo/landing` e resolver os 10 pontos conforme D-02.
3. Aplicar D-03 a D-06 e migrar testes.
4. Auditar a oferta (D-08) e apresentar o texto proposto — incluindo a elegibilidade — para aprovação.
5. Rodar a validação integrada (D-10) e reconciliar tracking (D-09).
6. Registrar o follow-up (D-11), revisar o diff com base no SHA registrado da `main` e parar para aprovação humana antes do commit de merge, push ou deploy.

## Open Questions

- Aprovar o texto da oferta proposto em D-08, incluindo a frase de elegibilidade, antes da implementação.
- **Escopo futuro não aprovado:** avaliar elegibilidade por CNPJ completo em vez de raiz de CNPJ.
- Confirmar se `node_modules.shared-link` existirá no worktree de integração; se sim, excluir apenas esse caminho.
- Confirmar o local/estado atual de `.dev.log` antes do merge para garantir que permaneça intocado.
