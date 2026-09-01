# Quick Task 260814-na1: Adicionar link de Novidades (changelog) na landing - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Task Boundary

Adicionar link de Novidades (changelog) na landing pública — link de destaque
(maior contraste) no rodapé e/ou abaixo do card "Solicite seu acesso free";
exibição das novidades integrada à landing (modal preferido) sem deslocar
navegação, com botões visíveis de retorno; e máscara de telefone no campo
WhatsApp do formulário de acesso enquanto o usuário digita.
</domain>

<decisions>
## Implementation Decisions

### Posição do link
- Link chamativo (maior contraste) logo abaixo do card "Solicite seu acesso
  free" + link discreto no rodapé junto a Termos/Privacidade.
- Justificativa: o link abaixo do card capitaliza a intenção de acesso; o do
  rodapé dá acesso persistente a quem rola até o fim.

### Formato de exibição
- Modal sobre a própria landing, reutilizando os dados do changelog existente
  (`getAllEntries` do server-only `src/lib/changelog/get-changelog.ts`), com
  botão claro de fechar/voltar. Mantém o visitante no ambiente da landing.
- Sem rota pública nova — a rota `/novidades` atual fica restrita ao grupo
  autenticado `(app)`.

### Conteúdo exibido
- Apenas as entradas mais recentes do changelog (limite de ~5), ordenadas por
  data desc. Reutiliza `ChangelogCard`/`ChangelogList` existentes se viável.
- Dados resolvidos no server component da landing e repassados por props ao
  client component do modal (padrão `novidades/page.tsx`).
- **Decisão editorial permanente:** a partir desta entrega, TODA entry em
  `content/changelog/` pode aparecer publicamente na landing para visitante
  não autenticado. Critério obrigatório ao publicar novas entradas: o conteúdo
  (título, body, milestone) deve ser publicável para público externo — nada de
  referências internas, jargão de fase ou informações não públicas.
- **Reconhecimento de superfície:** a renderização de markdown do changelog
  passa a ocorrer na landing pública (antes restrita a `/novidades`
  autenticado). Mesmo com renderer existente e conteúdo first-party, produto e
  segurança devem tratar isso como mudança real de superfície de exposição —
  não como "sem alteração".

### Máscara WhatsApp (padrão do projeto)
- Investigado: o cadastro de loja usa máscara progressiva inline no CNPJ
  (`store-identity-form.tsx`), aplicando formato durante a digitação via
  `onChange`. O campo `billing_phone` do mesmo formulário é texto livre.
- Para a landing, seguir o padrão de máscara progressiva inline (como CNPJ):
  `(11) 99999-9999` enquanto o usuário digita, com `maxLength` = 15.
- Persistência: manter o valor mascarado (sem normalizar para dígitos) — é o
  comportamento atual do backend (`whatsapp` string livre, max 20) e o admin
  já exibe dados no formato `(11) 99999-9999` (ver tests do admin).
  Sem mudanças na API `POST /api/access-requests`.

### the agent's Discretion
- Detalhes de estilo do link chamativo (cor/borda) seguindo o design system
  existente (accent-green/amber, font-heading, min-h 44px).
- Estrutura interna do modal (acessibilidade: role=dialog, aria-modal, foco,
  Esc) seguindo padrões de `credit-cta.tsx` e `changelog-announcement.tsx`.
</decisions>

<specifics>
## Specific Ideas

Nenhum requisito específico adicional — decisões acima capturam o escopo.
</specifics>

<canonical_refs>
## Canonical References

- `src/app/page.tsx` — landing (server component, header/footer)
- `src/components/landing/access-request-section.tsx` — card "Solicite seu acesso free"
- `src/components/landing/access-request-form.tsx` — campo WhatsApp (sem máscara hoje)
- `src/lib/changelog/get-changelog.ts` — getAllEntries (server-only)
- `src/components/changelog/changelog-list.tsx` / `changelog-card.tsx` — renderização
- `src/components/changelog/changelog-announcement.tsx` — padrão de modal do changelog
- `src/components/credit/credit-cta.tsx` — padrão de modal acessível (Esc, foco)
- `src/components/flow/store-identity-form.tsx` — padrão de máscara progressiva (CNPJ)
- `src/app/api/access-requests/route.ts` — schema whatsapp (string, max 20)
</canonical_refs>
