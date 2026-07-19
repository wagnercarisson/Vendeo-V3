# Deploy Checklist

## Pré-requisitos

- [ ] Todas as migrations aplicadas (`supabase/migrations/`)
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

## Rollback de Código

**Vercel:**
1. Acessar Vercel Dashboard > Deployments
2. Identificar o último deploy estável
3. Clicar em "..." > "Promote to Production"

## Rollback de Banco

As migrations são reversíveis. Para reverter:

1. Identificar a migration mais recente aplicada
2. Executar o bloco `REVERT` documentado no final do arquivo de migration
3. Exemplo: `supabase/migrations/20260718000002_expand_generation_events.sql`

## Responsabilidades

| Ação | Responsável |
|------|-------------|
| Deploy código | Desenvolvedor |
| Rollback código | Desenvolvedor |
| Rollback banco | Desenvolvedor + DBA |
| Verificação pós-deploy | Desenvolvedor |
| Migrations | Desenvolvedor |
