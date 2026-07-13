## REMOVED Requirements

### Requirement: AuthHeader component

**Reason**: O `AuthHeader` em `src/components/auth/auth-header.tsx` é removido. Suas responsabilidades são absorvidas pelo App Shell: sidebar (links estruturais Dashboard, Campanhas, Loja, Conta) e topbar (CTA "Nova Campanha" + menu de conta com Configurações e Sair). O root layout perde o `<header>` — html/body passa a ser só estrutura base.

**Migration**:
- `src/components/auth/auth-header.tsx` — arquivo removido
- `src/app/layout.tsx` — `<header>` removido, mantém apenas html/body/fonts/globals
- Componentes que importavam `AuthHeader` — import removido
- Testes que referenciam `AuthHeader` — removidos ou adaptados para o App Shell
