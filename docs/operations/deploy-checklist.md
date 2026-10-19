# Deploy Checklist

## Pré-requisitos

- [ ] Todas as migrations aplicadas (`supabase/migrations/`) — para o release F56.2b2d, aplicar o **conjunto definitivo** conforme o manifesto SHA-256 (ver seção *Release F56.2b2d*)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido
- [ ] `npx vitest run` — todos os testes passando
- [ ] Variáveis de ambiente configuradas no Vercel (ver `environment-variables.md`)

## Passos de Deploy (Vercel)

1. Fazer merge da branch para `main`
2. Vercel detecta automaticamente e inicia o build
3. Verificar logs do build no dashboard do Vercel
4. Se o build falhar: corrigir e fazer novo push

## Verificação Pós-Deploy

- [ ] Acessar a aplicação e confirmar que carrega sem erros
- [ ] Executar geração de campanha (smoke test)
- [ ] Acessar `/admin/metrics` e confirmar que os cards carregam
- [ ] Verificar health state no dashboard
- [ ] Confirmar que `generation_events` está sendo populado

## Release F56.2b2d — Deploy em `main` com Fluxo OFF

O release do Produto 1:1 hospedado é publicado com o **fluxo OFF** (nenhuma loja em `test_stores`
durante o deploy). A liberação efetiva do piloto é um passo separado e autorizado
(`f56-2b2d-pilot-runbook.md`).

### 1. Deploy do código

1. Fazer merge da branch para `main` e aguardar o build da Vercel.
2. Verificar via API Vercel, para o projeto `vendeo-v3`:
   - **commit** publicado = commit de `main` esperado;
   - **branch** de produção = `main`;
   - **plano** (hobby), **Fluid** habilitado e `functionDefaultTimeout=300`;
   - região `iad1` e memória 2048MB.
3. Confirmar que o deploy subiu com o **fluxo OFF** — nenhuma flag `product_1_1_*` habilitadora.

### 2. Migrations do conjunto definitivo

1. Gerar o manifesto do conjunto definitivo com `scripts/f56-2b2d/fix-migration-set.mjs`
   (`--dir supabase/migrations --out <manifest.json>`) e conferir com `--check` (SHA-256 e ordem
   por arquivo). O manifesto é fixado **após** a implementação.
2. Aplicar o conjunto definitivo via `supabase db push` (ordem de arquivo do manifesto).
3. Confirmar o **ledger completo**: o conjunto de migrations aplicadas deve cobrir exatamente o
   manifesto. **Não presumir 129** nem qualquer contagem fixa de ledger; o número cresce com as
   migrations desta change e as já publicadas em `main`.
4. As **duas migrations de laboratório** são explicitamente tratadas: a recomendação é aplicá-las
   no lote. **Nunca** usar `migration repair` para forjá-las.
5. Rodar `scripts/f56-2b2d/verify-hosted-release.mjs --check <evidence.json> --profile migrations`
   (exit 0 só com todos os critérios `PASS` com fonte e timestamp).

### 3. Verificação de não regressão do legado

- [ ] Novo fluxo **OFF** (nenhuma via estreita habilitadora vigente)
- [ ] Autorização desabilitada (último evento por escopo é `off`/`refused`)
- [ ] `all_stores=false`
- [ ] Pausa global (`VENDEO_GENERATION_PAUSED`) **preservada** como estava
- [ ] Rodar `verify-hosted-release.mjs --profile release` com evidência de liberação

## Rollback de Código

**Vercel:**
1. Acessar Vercel Dashboard > Deployments
2. Identificar o último deploy estável
3. Clicar em "..." > "Promote to Production"

## Rollback de Banco

**Rollback de código NÃO reverte banco nem o ledger de migrations.** Promover um deploy anterior
na Vercel restaura apenas o código; as migrations já aplicadas permanecem no banco e no ledger
(modelo **forward-only**). Reverter dados exige ação manual explícita e autorizada.

Para reverter uma migration específica:

1. Identificar a migration mais recente aplicada.
2. Executar o bloco `REVERT` documentado no final do arquivo de migration (ação manual).
3. Exemplo: `supabase/migrations/20260718000002_expand_generation_events.sql`

O ledger não é rebobinado por rollback de código; qualquer alteração de ledger é decisão humana
explícita, nunca inferida do deploy.

## Responsabilidades

| Ação | Responsável |
|------|-------------|
| Deploy código | Desenvolvedor |
| Rollback código | Desenvolvedor |
| Rollback banco | Desenvolvedor + DBA |
| Verificação pós-deploy | Desenvolvedor |
| Migrations | Desenvolvedor |
