---
status: complete
implementation_status: implemented
gate_status: automated_green
acceptance: pending_visual
date: 2026-10-27
quick_id: 261027-p0h
phase: quick
branch: feature/fase-58-composicao-e-legibilidade-do-dashboard
commits:
  - 7f6ef7b3
  - 6e107cc0
  - b9af61a7
verification:
  shell_tests: "PASS — 7 files / 58 tests (src/__tests__/components/shell)"
  related_tests: "PASS — 2 files / 27 tests (layout-metadata + landing-page)"
  typecheck: "PASS — tsc -p tsconfig.typecheck.json --noEmit"
  lint: "PASS (exit 0) — limitação: eslint.config.mjs não cobre TypeScript; evidência não prova lint efetivo dos .ts/.tsx"
  build: "PASS — check:cnae + next build; 91/91 páginas"
  asset: "PASS — public/brand/vendeo-signature.png em 1256x923 RGBA, cantos alpha 0 e 575.797 pixels transparentes"
  diff_check: "PASS — git diff --check sem erros"
  visual: "PENDENTE — validação humana em navegador, incluindo 320/375 px, 559/560 px, texto ampliado e zoom 200%"
---

# Quick 261027-p0h — Identidade Vendeo no app shell

## Resultado

Implementada a identidade do shell **sem tocar em dashboard, banco, APIs, migrations, flags,
dependências, landing ou manifest/PWA**:

- Sidebar desktop: logotipo horizontal sem slogan no topo, clicável para `/dashboard`.
- Sidebar desktop: assinatura “Postou, vendeo!” centralizada na base, **118 px** de largura,
  altura automática ≈86,7 px, **opacidade original**.
- Assinatura oculta por **guarda medida** (`shouldShowSignature`), com piso de 560 px e
  `ResizeObserver`; sem observer, permanece oculta.
- Topbar mobile: símbolo entre o hambúrguer e o nome da loja, clicável para `/dashboard`.
- Drawer: logotipo horizontal no topo, clicável para `/dashboard` e fechando o menu.
- Assinatura ausente da topbar e do drawer.
- Navegação, loja, CTA, notificações, conta, focus trap, Escape, scroll lock e reduced motion
  preservados.

## Medição aplicada

```text
montagem: 1536x1024
sidebar_na_montagem: 304 px
assinatura_na_montagem: ~229 px
ratio: 229/304 = 0,7533
largura: 0,7533 × 224 × 0,70 = 118,1 px → 118 px
altura: 118 × 923/1256 ≈ 86,7 px
bloco: 16 + 86,7 + 20 = 122,7 px
espaço mínimo: 122,7 + 16 = 138,7 px
```

Caminho da montagem registrado no CONTEXT/PLAN para conferência.

## Arquivos entregues

**Novos**
- `public/brand/vendeo-signature.png`
- `src/components/shell/vendeo-brand.tsx`
- `src/components/shell/vendeo-signature.tsx`
- `src/__tests__/components/shell/vendeo-brand.test.tsx`
- `src/__tests__/components/shell/vendeo-signature.test.tsx`

**Modificados**
- `src/components/shell/app-shell.tsx`
- `src/components/shell/topbar.tsx`
- `src/components/shell/sidebar-drawer.tsx`
- `src/__tests__/components/shell/app-shell.test.tsx`
- `src/__tests__/components/shell/sidebar-drawer.test.tsx`
- `src/__tests__/components/shell/topbar.test.tsx` (arquivo existente **estendido**; os testes
  anteriores foram preservados)

**Intocados**
- `public/landing/vendeo-logo-dark.webp`
- `public/icons/icon-512x512.png`
- `src/components/shell/sidebar.tsx`
- `src/app/globals.css`
- `tailwind.config.ts`

## Desvios e decisões de execução

1. **Recorte da assinatura:** `sharp.trim()` com threshold 1 gerou 1260x927, incluindo ~2 px de
   textura tênue em cada borda. Para honrar exatamente 1256x923, foi usado `extract` com a bbox
   de alpha medida em (44,162,1256,923). Não houve resize nem redesenho; apenas remoção de
   margens transparentes.
2. **`topbar.test.tsx`:** o arquivo já existia com cobertura de CTA, hambúrguer, conta e reload;
   foi estendido, não substituído. A cobertura original permanece.
3. **`ResizeObserver`:** é obrigatório para exibir a assinatura. Sem ele, a assinatura permanece
   oculta; `window.resize` só complementa quando o observer existe.
4. **Fallback de asset:** removido conforme o plano. `sharp` estava disponível; não foi necessário
   bloquear a execução.

## Evidências

- `npx vitest run src/__tests__/components/shell` — **7 arquivos / 58 testes**.
- `npx vitest run src/__tests__/app/layout-metadata.test.ts src/components/landing/__tests__/landing-page.test.tsx`
  — **2 arquivos / 27 testes**.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0; sem cobertura TypeScript (limitação conhecida).
- `npm run build` — exit 0; **91/91 páginas**; aviso de plugin ESLint do Next ausente (limitação
  preexistente de configuração).
- `git diff --check` — limpo.
- Auditoria do asset — 1256x923, RGBA, cantos alpha 0.

## Pendente

- **Validação visual humana** em navegador: 1440/1024/768/375/320 px; alturas 900/600/560/559/480;
  nome de loja longo em 320/375; texto ampliado; zoom 200%; teclado/foco; logo sem retângulo;
  assinatura centralizada/discreta; drawer sem assinatura.
- Nenhum push, deploy, merge ou ativação foi executado.
- `npm test` completo não foi executado; a suíte global tem histórico não-verde e não foi adotada
  como baseline neste recorte.
