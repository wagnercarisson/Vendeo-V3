# Milestone v1.2 — Contas e Propriedade

**Versão:** Documento exploratório — nenhuma decisão de implementação está tomada.
**Status:** Escopo confirmado, abordagem em aberto.
**Data:** 2026-07-03

---

## Objetivo da Milestone

Preparar o terreno para a estrutura SaaS do Vendeo. O core de geração de campanhas está validado (v1.1), mas o produto ainda não é uma versão pública utilizável — falta qualquer mecanismo de identificar quem é o usuário, proteger os dados e garantir que cada lojista acesse apenas sua própria loja.

Esta milestone não busca entregar um produto completo ou lançável. Ela busca estabelecer a camada fundacional de contas e propriedade para que as milestones seguintes possam construir sobre ela.

## Escopo Confirmado

O escopo desta milestone cobre:

- **Autenticação**: mecanismo para o usuário criar conta e acessar o sistema
- **Sessão**: persistência da identidade do usuário entre requisições
- **Vínculo user → store**: associar um usuário a uma loja (relação 1:1)
- **Ownership**: garantir que o usuário acesse apenas seus próprios dados
- **Proteção de rotas**: redirecionar usuários não autenticados para o fluxo de entrada
- **Fluxo de entrada/cadastro**: páginas mínimas de signup e login

## Exclusões Explícitas

| Item | Motivo |
|------|--------|
| Campanhas persistidas | Escopo é auth + ownership, não inclui salvar campanhas |
| Export PNG/JPG | Decisão MC-03 da v1.1 — movido para milestone futura |
| Dashboard completo | Foco em auth; dashboard exige mais definição de produto |
| Planos e cobrança | Uso livre durante validação do core |
| Histórico de campanhas | Depende de campanhas persistidas |
| Regeneração | Redefinida como "novo briefing" (decisão MC-02) |
| Múltiplas lojas | Relação 1:1 nesta milestone — expandir é decisão futura |
| Ajustes de arte | Motor valida geração, não edição (decisão MC-01) |

## Critério de Conclusão

> Um usuário entra no Vendeo e acessa exclusivamente sua própria loja e identidade.

Indicadores observáveis:
- Usuário não autenticado vê apenas páginas de entrada (login/signup)
- Usuário pode criar conta com email e senha
- Após criar conta, o usuário tem uma loja vinculada a ele
- Usuário autenticado acessa apenas seus próprios dados
- Logout retorna o usuário ao estado não autenticado
- Sessão persiste entre recarregamentos de página

## Estado Atual Relevante do Sistema

- **v1.0-v1.1**: ~8.800+ linhas TypeScript/TSX, 100+ source files, 297 testes
- **Sem auth**: Nenhum mecanismo de autenticação existe. O sistema opera sem identidade de usuário.
- **Stores existem**: Loja é criada e persistida via API, sem vínculo com user_id
- **Supabase client atual**: `@supabase/supabase-js` v2.49.4 via `createClient` (sem SSR/auth helpers)
- **Banco atual**: Tabela `stores` com dados de identidade da loja (segmento, cores, logo, etc.) — sem coluna `user_id`
- **Rotas atuais**: `/` (campaign), `/store` (store identity) — ambas públicas, sem proteção
- **Ambiente**: Next.js 15.3.1 (App Router), Supabase, Vercel deploy

## Riscos

| Risco | Impacto | Notas |
|-------|---------|-------|
| Quebrar fluxo existente de criação de loja | Alto | Loja atual é criada sem user_id; migração ou reset precisa ser decidido |
| Dados legado (stores sem dono) | Médio | Decisão tomada: resetar dados. Mas confirmar se há dados importantes a preservar. |
| Curva de aprendizado de Supabase Auth SSR | Baixo | Padrão bem documentado, mas nova dependência (@supabase/ssr) |
| Acoplamento prematuro a provider de auth | Médio | Supabase Auth é opinado; trocar depois pode ser caro |
| Testes existentes assumem ausência de auth | Alto | 297 testes precisam ser revisados para ambiente autenticado |

## Dependências

- `@supabase/ssr` — necessário para integração auth com App Router (não presente hoje)
- Supabase project — precisa ter Auth habilidado (verificar configuração atual)
- Variáveis de ambiente — `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` já existem; verificar se `SUPABASE_SERVICE_ROLE_KEY` é suficiente para operações admin

## Restrições

- **Stack fixa**: Next.js (App Router) + TypeScript + Supabase + Vercel — sem introdução de novos providers de auth
- **Reset de dados**: Dados existentes (pré-auth) serão resetados — decisão confirmada
- **Relação 1:1**: Um usuário = uma loja — decisão confirmada para esta milestone
- **Fluxo único**: Signup cria loja no mesmo fluxo — decisão confirmada

## Perguntas em Aberto

Estas perguntas precisam ser respondidas antes ou durante o planejamento da implementação:

### Autenticação
- Qual método de auth usar? (Supabase Auth built-in email/password? Magic link? OAuth social?)
- Fluxo de email verification é obrigatório para v1.2 ou pode ser simplificado?
- Onde o usuário é redirecionado após signup? (Para a loja recém-criada?)
- O que acontece se o email já está em uso? UI de erro ou "já tem conta? faça login"?

### Vínculo User → Store
- A loja é criada na mesma transação do signup? Ou em etapa separada?
- Qual o schema da tabela `stores`? Adicionar `user_id` (FK → auth.users)?
- A loja recém-criada precisa de dados iniciais (segmento, cor)? Ou começa vazia?
- O formulário de store identity existente precisa ser adaptado para o contexto autenticado?

### RLS e Segurança
- Quais tabelas precisam de RLS? Apenas `stores`? Ou também tabelas de assets, profiles?
- A política RLS é simples (`user_id = auth.uid()`) ou precisa considerar outros cenários?
- Como lidar com operações admin (ex: upload de logo que usa service role)?

### Rotas e Layout
- Qual a estrutura de rotas? `/login`, `/signup`, `/store` protegida?
- Existe um layout raiz que detecta sessão e redireciona?
- O middleware do Next.js é a abordagem correta para proteção de rotas?

### Migração de Dados
- Reset total foi confirmado — mas existe dump ou backup dos dados atuais?
- As migrações SQL existentes precisam ser revertidas ou substituídas?

### Testes
- Como adaptar os 297 testes existentes para um ambiente autenticado?
- Estratégia: mock de sessão? Provider de teste? Setup global de auth?

---

*Documento criado: 2026-07-03*
*Próximo passo: Aguardar autorização para planejamento — `/gsd-plan-phase [N]` ou `/gsd-discuss-phase [N]`*
