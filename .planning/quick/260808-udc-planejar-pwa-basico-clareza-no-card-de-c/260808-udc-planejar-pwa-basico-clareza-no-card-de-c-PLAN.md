---
phase: quick-udc
plan: 01
quick_id: 260808-udc-planejar-pwa-basico-clareza-no-card-de-c
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/manifest.ts
  - public/icons/icon-192x192.png
  - public/icons/icon-512x512.png
  - public/icons/icon-maskable-512x512.png
  - public/icons/apple-touch-icon.png
  - scripts/generate-pwa-icons.mjs
  - src/app/layout.tsx
  - src/components/pwa/install-hint.tsx
  - src/app/(app)/conta/page.tsx
  - src/components/credit/balance-card.tsx
  - src/components/credit/__tests__/balance-card.test.tsx
autonomous: true
requirements: [UDC-PWA, UDC-CREDITS]
must_haves:
  truths:
    - "Manifesto PWA instalável válido servido em /manifest.webmanifest (name, short_name, description, start_url '/dashboard', scope, display standalone, theme_color, background_color, ícones 192/512/maskable)"
    - "Ícones PNG existem em public/icons e são referenciados corretamente pelo manifest e pela metadata do layout"
    - "layout.tsx expõe metadata PWA/iOS (manifest link, export viewport com themeColor, appleWebApp, icons com apple-touch-icon) e o build Next passa sem warnings relevantes de metadata/manifest — sem favicon top-level em metadata nem themeColor deprecado em metadata"
    - "Nenhum service worker nem cache offline introduzido (sem sw.js, sem registros de serviceWorker, sem alteração de next.config)"
    - "Card de créditos não exibe texto ambíguo: quando custos carregados, mostra custo por operação ('Campanha: N crédito(s)' / 'Assinatura visual: N crédito(s)' ou 'indisponível')"
    - "Quando custos não carregaram, o card mostra texto neutro sem número incorreto"
    - "Dica iOS discreta ('Compartilhar → Adicionar à Tela de Início') aparece só no Safari iOS fora de standalone e não bloqueia o fluxo"
  artifacts:
    - path: "src/app/manifest.ts"
      provides: "Manifesto PWA gerado por convenção do Next.js App Router"
      contains: "start_url"
      exports: ["default"]
    - path: "public/icons/icon-192x192.png"
      provides: "Ícone 192x192 para o manifest"
    - path: "public/icons/icon-512x512.png"
      provides: "Ícone 512x512 para o manifest"
    - path: "public/icons/icon-maskable-512x512.png"
      provides: "Ícone maskable 512x512 (fundo full-bleed, glifo na zona segura)"
    - path: "public/icons/apple-touch-icon.png"
      provides: "Ícone 180x180 para iOS/Safari"
    - path: "scripts/generate-pwa-icons.mjs"
      provides: "Gerador programático dos PNGs (sharp — dependência já existente)"
      contains: "sharp"
    - path: "src/app/layout.tsx"
      provides: "Metadata PWA/iOS (manifest, export viewport com themeColor, appleWebApp, icons incl. apple-touch-icon)"
      contains: "appleWebApp"
    - path: "src/components/pwa/install-hint.tsx"
      provides: "Dica iOS discreta, só fora de display-mode: standalone"
      contains: "display-mode: standalone"
    - path: "src/app/(app)/conta/page.tsx"
      provides: "Hospeda a dica iOS na área da conta"
      contains: "InstallHint"
    - path: "src/components/credit/balance-card.tsx"
      provides: "Visão de custo por operação (Campanha / Assinatura visual) sem texto ambíguo"
      contains: "indisponível"
    - path: "src/components/credit/__tests__/balance-card.test.tsx"
      provides: "Testes atualizados + novos casos (plural, indisponível, loading)"
      contains: "Assinatura visual"
  key_links:
    - from: "src/app/manifest.ts"
      to: "public/icons/*.png"
      via: "src /icons/... referenciados no array icons do manifest"
      pattern: "icons/"
    - from: "src/app/layout.tsx"
      to: "src/app/manifest.ts"
      via: "manifest: /manifest.webmanifest na metadata (link auto-injetado pelo Next)"
      pattern: "manifest"
    - from: "src/components/credit/balance-card.tsx"
      to: "src/hooks/use-operation-costs.ts"
      via: "useOperationCosts() alimenta as linhas de custo por operação (já importado)"
      pattern: "useOperationCosts"
    - from: "src/components/credit/balance-card.tsx"
      to: "src/lib/credit/format.ts"
      via: "formatCredits(costCredits) → 'N crédito(s)' com singular/plural"
      pattern: "formatCredits"
---

<objective>
Dois workstreams independentes:

1. **PWA básico instalável (sem service worker)** — manifest válido (`src/app/manifest.ts`), ícones PNG gerados programaticamente (não existem assets de imagem no repo), metadata PWA/iOS no layout, e uma dica iOS discreta na área da conta.
2. **Clareza no card de créditos** — substituir a frase ambígua `"Cada geração consome X."` / `"Cada geração consome créditos."` (linha 60 de `balance-card.tsx`) por uma visão compacta de custo por operação (Campanha / Assinatura visual), usando o hook `useOperationCosts` já existente.

**Purpose:** Tornar o Vendeo instalável no celular (iOS/Android) e eliminar a ambiguidade de custo que o lojista vê no card de créditos, aumentando confiança para publicar.

**Output:** `src/app/manifest.ts`, 4 PNGs em `public/icons/`, `scripts/generate-pwa-icons.mjs`, metadata PWA/iOS em `src/app/layout.tsx`, `src/components/pwa/install-hint.tsx`, `InstallHint` em `src/app/(app)/conta/page.tsx`, visão de custo por operação em `src/components/credit/balance-card.tsx`, testes atualizados em `src/components/credit/__tests__/balance-card.test.tsx`.

**Escopo (locked):** NÃO criar service worker, NÃO introduzir cache offline, NÃO alterar next.config, NÃO mexer em migrations/banco/env/Supabase Auth/Vercel, NÃO criar landing page, NÃO construir prompt de instalação (nenhum botão que bloqueie fluxo).
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@src/app/layout.tsx
@src/components/credit/balance-card.tsx
@src/components/credit/__tests__/balance-card.test.tsx
@src/hooks/use-operation-costs.ts
@src/lib/credit/types.ts
@src/lib/credit/format.ts
@src/app/(app)/conta/page.tsx

**Estado atual confirmado por leitura:**

- `src/app/layout.tsx` (27 linhas): metadata mínima `{ title: "Vendeo", description: "Motor de geração de campanhas profissionais" }`; `<head>` com preconnect + Google Fonts (Open Sans/Poppins). Não tem manifest, themeColor, appleWebApp nem ícones.
- `src/app/page.tsx` → `redirect("/dashboard")` (server-side). `/dashboard` é protegido pelo middleware (visitante → `/login?redirect=/dashboard`). Rotas públicas: `/login`, `/signup`, `/termos`, `/privacidade`, `/uso-aceitavel`. **Decisão: `start_url: "/dashboard"`** — `/` será a landing pública após o merge da quick de landing (worktree `Vendeo-Quick-Landing`), então NÃO pode ser o entry do PWA instalado. `/dashboard` abre direto no app para logado e é redirecionado ao login pelo middleware para visitante (per requirement).
- **Não existe NENHUM asset de imagem no repo** (glob `**/*.{svg,png,ico,webp}` → 0 resultados; `public/` só tem markdowns legais). Decisão: gerar ícones placeholder programaticamente via `sharp@^0.34.5` (dependência JÁ existente em `package.json` — sem novo pacote). Cores da marca em `globals.css`: `--bg-surface: #0F172A`, `--accent-green: #22C55E`.
- `src/app` é Next.js **15.3.1** → convenção `src/app/manifest.ts` (export default `MetadataRoute.Manifest`) suportada; Next injeta automaticamente `<link rel="manifest" href="/manifest.webmanifest">`.
- `useOperationCosts` (`src/hooks/use-operation-costs.ts`) retorna `{ costs: Record<OperationKey, {costCredits, enabled}> | null, status: "loading"|"unavailable"|"loaded", refetch }`. OperationKeys (de `src/lib/credit/types.ts`): `campaign_generation`, `visual_signature_generation`.
- `formatCredits` (`src/lib/credit/format.ts`) resolve singular/plural: `formatCredits(1)` → `"1 crédito"`, `formatCredits(2)` → `"2 créditos"`, `formatCredits(0)` → `"0 créditos"`. **Reutilizar — não criar helper de pluralização novo.**
- `balance-card.tsx` linha 60 (estado `normal`): `description: status === "loaded" && costs?.campaign_generation ? \`Cada geração consome ${formatCredits(...)}.\` : "Cada geração consome créditos."` — é esta a frase ambígua a substituir. Estados `low`/`zero` não mencionam custos (não mudar).
- `balance-card.test.tsx` (63 linhas, `// @vitest-environment node`, `renderToString`): assere `"Cada geração consome 1 crédito"` (teste 1) e `"Cada geração consome créditos."` (teste 4 — texto neutro preservado).
- `conta/page.tsx` (server component): card "Informações da Conta" (linhas 62-73) é o local para a dica iOS discreta.
- Estilo do projeto: Tailwind dark (`bg-bg-surface`, `text-text-muted`, `text-accent-green`, `font-body`, `font-heading`), PT-BR.

<interfaces>
<!-- Contratos que o executor deve usar diretamente — sem exploração adicional. -->

From src/lib/credit/types.ts (JÁ EXISTE — não alterar):
```typescript
export const OPERATION_KEYS = ["campaign_generation", "visual_signature_generation"] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];
```

From src/hooks/use-operation-costs.ts (JÁ EXISTE — não alterar):
```typescript
export type OperationCostsMap = Record<OperationKey, { costCredits: number; enabled: boolean }>;
export type UseOperationCostsStatus = "loading" | "unavailable" | "loaded";
// useOperationCosts(): { costs: OperationCostsMap | null; status: UseOperationCostsStatus; refetch: () => void }
```

From src/lib/credit/format.ts (JÁ EXISTE — não alterar):
```typescript
export function formatCredits(value: number): string; // 1→"1 crédito", 2→"2 créditos", 0→"0 créditos"
```

From src/app/(app)/conta/page.tsx — padrão de card para inserir o InstallHint (card "Informações da Conta", linhas 62-73): `<h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary font-heading">` + `<p className="text-sm text-text-muted font-body">Email</p>` + `<p className="text-text-primary font-body">{email}</p>`.
</interfaces>

**Riscos de conflito com F38.1 (worktree/branch separada, em execução):**

| Arquivo | Situação |
|---------|----------|
| `src/components/credit/balance-card.tsx` | MODIFICADO por este plano (Workstream B). F38.1 não o altera nos plans 08-11 (rotas/views), mas é arquivo compartilhado — risco ao merge. |
| `src/hooks/use-operation-costs.ts` | NÃO modificado por este plano (só consumido). Listado como risco de conflito porque F38.1 pode tocá-lo; não editar. |
| `src/app/layout.tsx` | MODIFICADO por este plano (metadata PWA). Compartilhado com F38.1 — manter o diff mínimo e cirúrgico. |
| `public/` | MODIFICADO por este plano (4 PNGs novos em `public/icons/` — aditivo, baixo risco, a menos que F38.1 adicione assets). |
| `src/components/credit/__tests__/balance-card.test.tsx` | MODIFICADO por este plano. Mesmo risco do balance-card.tsx. |

Executor deve manter as mudanças locais e mínimas, sem tocar em nada além dos arquivos listados em cada `<files>`.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gerar ícones PNG programaticamente + criar manifest.ts (PWA Workstream A parte 1)</name>
  <files>scripts/generate-pwa-icons.mjs, public/icons/icon-192x192.png, public/icons/icon-512x512.png, public/icons/icon-maskable-512x512.png, public/icons/apple-touch-icon.png, src/app/manifest.ts</files>
  <action>
    NÃO há assets de imagem no repo (verificado). NÃO instalar pacote novo — usar `sharp@^0.34.5` (já em package.json). A pasta `public/icons/` não existe; o script deve criá-la.

    1. Criar `scripts/generate-pwa-icons.mjs` (Node ESM, roda com `node`):
       - `import sharp from "sharp";` e `import { mkdir } from "node:fs/promises";`.
       - Criar um builder de SVG que monta um `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` com:
         - Fundo: retângulo `fill="#0F172A"`. Para as variantes NÃO-maskable (192, 512, apple-touch), usar `rx="96"` (cantos arredondados); para a maskable, retângulo cheio sem `rx` (full-bleed, exigência de ícones maskable).
         - Glifo "V" do Vendeo: um `<polyline>` com `points="160,168 256,344 352,168"`, `stroke="#22C55E"`, `stroke-width="64"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"` — desenho determinístico em vetor, SEM depender de fontes (librsvg não garante renderização de `<text>`). Para a maskable, o glifo deve caber na zona segura central de 80% (centro 256,256; raio ~204) — o polyline acima já satisfaz (máx. ~X:160-352, Y:168-344).
         - Parâmetro `rounded` no builder (true para não-maskable, false para maskable).
       - Para cada saída, rasterizar via `sharp(Buffer.from(svg)).png().resize(size, size).toFile(dest)`:
         - `public/icons/icon-192x192.png` — 192, rounded
         - `public/icons/icon-512x512.png` — 512, rounded
         - `public/icons/icon-maskable-512x512.png` — 512, full-bleed (rounded=false)
         - `public/icons/apple-touch-icon.png` — 180, rounded
       - Self-verify ao final: para cada PNG gerado, ler `await sharp(dest).metadata()` e lançar erro (exit != 0) se `format !== "png"` ou `width/height` não baterem com o alvo; logar `OK <nome> <width>x<height>` por arquivo. Isso torna a Task 1 verificável sem ferramentas externas.

    2. Criar `src/app/manifest.ts` (convenção Next.js App Router — export default function retornando `MetadataRoute.Manifest`; importar `import type { MetadataRoute } from "next";`):
       - `name: "Vendeo"`, `short_name: "Vendeo"`, `description: "Motor de geração de campanhas profissionais"` (mesmo texto do layout atual).
        - `start_url: "/dashboard"` — decisão fundamentada: `/` será a landing pública após o merge da quick de landing (worktree separado), então NÃO usar `/`. `/dashboard` é protegido pelo middleware: visitante sem sessão é redirecionado ao `/login?redirect=/dashboard`; usuário autenticado abre direto no app.
        - `scope: "/"`, `display: "standalone"`, `theme_color: "#0F172A"` (--bg-surface), `background_color: "#0F172A"`.
       - `icons`: array com 3 entradas, todas `type: "image/png"`:
         - `{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }`
         - `{ src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }`
         - `{ src: "/icons/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }`
       - Sem service worker, sem `prefer_related_applications`, sem `shortcuts`.
       - NÃO colocar código-fenced inline aqui: o executor implementa o arquivo conforme o contrato acima.

    NÃO alterar `next.config.*`, NÃO criar `public/sw.js`, NÃO registrar `serviceWorker` em lugar nenhum (escopo locked).
  </action>
  <verify>
    <automated>node scripts/generate-pwa-icons.mjs; if ($?) { Get-ChildItem public\icons | Select-Object Name, Length }; npm run typecheck</automated>
  </verify>
  <done>4 PNGs existem em public/icons com as dimensões exatas (192x192, 512x512, 512x512 maskable, 180x180 — confirmado pelo self-verify do script que loga "OK <nome> WxH" e falha se divergir); `src/app/manifest.ts` exporta Manifest com name/short_name/start_url "/dashboard"/scope "/"/display standalone/theme e background #0F172A/3 ícones (192, 512, maskable); typecheck limpo.</done>
</task>

<task type="auto">
  <name>Task 2: Metadata PWA/iOS no layout + dica iOS discreta na área da conta (PWA Workstream A parte 2)</name>
  <files>src/app/layout.tsx, src/components/pwa/install-hint.tsx, src/app/(app)/conta/page.tsx</files>
  <action>
    2.1. Em `src/app/layout.tsx`, estender o arquivo mantendo `title: "Vendeo"` e `description` atuais:
    - Alterar o import para `import type { Metadata, Viewport } from "next";`.
    - Adicionar um NOVO export junto ao `metadata`:
      ```ts
      export const viewport: Viewport = {
        themeColor: "#0F172A",
      };
      ```
      **NÃO colocar `themeColor` dentro de `metadata`** — no Next 15 `themeColor` em `metadata` é `@deprecated` (trocado por `viewport`); manter no `metadata` gera warning de depreciação.
    - No objeto `metadata`, adicionar:
      - `manifest: "/manifest.webmanifest"` (explicito; o Next também injeta o link automaticamente ao detectar `manifest.ts`).
      - `appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Vendeo" }`.
      - `icons: { icon: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] }`.
      - **NÃO usar `favicon` top-level em `metadata`** — a interface `Metadata` do Next 15 NÃO possui o campo `favicon` (apenas `icons`); usar `favicon` quebra o typecheck. O favicon é atendido pela entrada `icons.icon` (rel="icon" padrão), que já cobre o tab favicon.
    - NÃO mexer no `<head>` com preconnect/fonts (fica intacto). NÃO adicionar `<link rel="manifest">` manual no `<head>` — o Next injeta; manter o `<head>` como está.

    2.2. Criar `src/components/pwa/install-hint.tsx` — componente CLIENT discreto e não-bloqueante:
    - `"use client";` no topo.
    - Estado `visible: boolean` iniciando `false` (render inicial nulo → SSR-safe, sem hydration mismatch).
    - `useEffect` (roda só no cliente): detectar `const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)` e `const isStandalone = window.matchMedia("(display-mode: standalone)").matches`; chamar `setVisible(isIos && !isStandalone)`.
    - Quando `visible === false`, retornar `null` (sem elementos no DOM). Quando visível, renderizar UMA linha discreta de texto — NENHUM botão: `<p className="text-xs text-text-muted font-body">Dica: use Compartilhar → "Adicionar à Tela de Início" para instalar o Vendeo.</p>` (pt-BR, curto, não bloqueia nada).
    - NÃO criar prompt de instalação (sem `beforeinstallprompt`, sem botão, sem modal).

    2.3. Em `src/app/(app)/conta/page.tsx` (server component), importar `InstallHint` de `@/components/pwa/install-hint` e renderizar `<InstallHint />` DENTRO do card "Informações da Conta", logo após o `<p className="text-text-primary font-body">{email}</p>` (linha 71) e antes do fechamento do card — é a área da conta; o componente cliente renderiza nulo em standalone/desktop/Android, então a página não muda visualmente nesses casos.

    NÃO alterar mais nada no layout, na página de conta ou no app shell. NÃO mexer em `src/app/(app)/layout.tsx`.
  </action>
  <verify>
    <automated>npm run typecheck; if ($?) { npm run lint }</automated>
  </verify>
  <done>metadata do layout inclui manifest apontando para /manifest.webmanifest, appleWebApp, icons (icon + apple-touch-icon) e um export `viewport` com `themeColor: "#0F172A"` — SEM `themeColor` deprecado em `metadata` e SEM `favicon` top-level; InstallHint existe como client component, renderiza nulo em standalone e fora do iOS, e aparece como texto discreto no card "Informações da Conta" só no Safari iOS fora de standalone; typecheck e lint limpos.</done>
</task>

<task type="auto">
  <name>Task 3: Visão de custo por operação no BalanceCard + testes atualizados (Workstream B)</name>
  <files>src/components/credit/balance-card.tsx, src/components/credit/__tests__/balance-card.test.tsx</files>
  <action>
    3.1. Em `src/components/credit/balance-card.tsx` (203 linhas), substituir a frase ambígua da linha 60:

    - No objeto `stateConfig`, no estado `normal`, REMOVER a propriedade `description` (linha 60) — o custo deixa de ser uma string única.
    - Manter `description` intacto nos estados `low` e `zero` (não mencionam custos — não mudar).
    - Adicionar no arquivo um pequeno componente de função `OperationCostRows({ costs, status }: { costs: OperationCostsMap | null; status: UseOperationCostsStatus })` (tipos importados de `@/hooks/use-operation-costs`):
      - Se `status === "loaded" && costs`: renderizar um bloco compacto (NENHUMA tabela — máximo 2 linhas, legível em mobile) com o padrão `Label: Valor`:
        - Linha Campanha: `Campanha: {formatCredits(costs.campaign_generation?.costCredits ?? 0)}` se `costs.campaign_generation?.enabled !== false`; caso contrário `Campanha: indisponível`.
        - Linha Assinatura visual: `Assinatura visual: {formatCredits(costs.visual_signature_generation?.costCredits ?? 0)}` se `costs.visual_signature_generation?.enabled !== false`; caso contrário `Assinatura visual: indisponível`.
        - Defensivo: operação ausente no map (anomalia de dados) é tratada como `indisponível`. Sempre usar `formatCredits` para singular/plural (1 → "1 crédito", 2 → "2 créditos").
        - Marcação: cada linha como `<p className="text-sm text-text-muted font-body">Campanha: 1 crédito</p>` (mesmo estilo do `description` atual, `mt-0` — o container já tem espaçamento).
      - Caso contrário (`status === "loading"` ou `"unavailable"` ou `costs` nulo): renderizar UMA linha neutra SEM número (não inventar custo): `<p className="text-sm text-text-muted font-body mt-1">Cada geração consome créditos.</p>`.
    - No JSX do `ReadyContent`, no bloco `<div>` que hoje renderiza `{config.title}` e `{config.description}` (linhas 88-95): renderizar `config.title` como antes; e, quando `displayState === "normal"`, renderizar `<OperationCostRows costs={costs} status={status} />` no lugar do `<p>{config.description}</p>`; quando `low`/`zero`, manter o `<p>{config.description}</p>` atual.
    - O `useOperationCosts()` já é chamado no topo de `ReadyContent` (linha 27) — REUTILIZAR `costs` e `status`; não adicionar chamadas novas.
    - Importar `formatCredits` já existe (linha 7). NÃO remover nenhum comportamento de `low`/`zero`/`no_store`/loading skeleton/error. Card continua focado em saldo.

    3.2. Em `src/components/credit/__tests__/balance-card.test.tsx` (63 linhas, `// @vitest-environment node`, mock de `useOperationCosts` existente via `vi.mock("@/hooks/use-operation-costs")`):
    - Teste 1 ("renders formatted balance with description for normal balance"): trocar a asserção `expect(html).toContain("Cada geração consome 1 crédito")` por `expect(html).toContain("Campanha: 1 crédito")` e `expect(html).toContain("Assinatura visual: 1 crédito")`.
    - Teste 4 ("unavailable → description without assumed cost number"): manter `expect(html).toContain("Cada geração consome créditos.")` (texto neutro preservado) e manter `not.toContain("Cada geração consome 1 crédito")`.
    - NOVOS testes (mesmo padrão de mock, `renderToString`):
      - "loaded com custo 2 → plural": mock `campaign_generation: { costCredits: 2, enabled: true }`; assertar `html` contém `"Campanha: 2 créditos"`.
      - "loaded com visual_signature_generation desabilitada → indisponível": mock `visual_signature_generation: { costCredits: 3, enabled: false }`; assertar `html` contém `"Assinatura visual: indisponível"` e NÃO contém `"Assinatura visual: 3"`.
      - "loaded com campaign_generation desabilitada → indisponível": mock `campaign_generation: { costCredits: 5, enabled: false }`; assertar `html` contém `"Campanha: indisponível"`.
      - "loading → texto neutro sem linhas de custo": mock `costs: null, status: "loading"`; assertar `html` contém `"Cada geração consome créditos."` e NÃO contém `"Campanha:"` nem `"Assinatura visual:"`.
      - "loaded → sem texto ambíguo 'Cada geração consome'": com custos carregados, assertar `html` NÃO contém `"Cada geração consome"`.
    - NÃO criar arquivos de teste novos; NÃO alterar os testes 2, 3 nem os mocks de `refetch`.
  </action>
  <verify>
    <automated>npm test -- src/components/credit/__tests__/balance-card.test.tsx; if ($?) { npm run typecheck }; if ($?) { npm run lint }</automated>
  </verify>
  <done>Card de créditos (estado normal) mostra "Campanha: N crédito(s)" e "Assinatura visual: N crédito(s)" quando carregado e habilitado, "indisponível" quando desabilitado, e texto neutro sem número quando não carregou; NENHUM texto ambíguo "Cada geração consome X." dinâmico permanece; testes antigos atualizados + novos cenários (plural, indisponível, loading, sem-ambiguidade) passando; typecheck e lint limpos.</done>
</task>

</tasks>

<verification>
Rodar a partir da raiz do projeto: `C:\Projetos\Vendeo-Quick-PWA` (todas as tarefas já passaram pelos gates locais; estes são os gates finais):

1. `node scripts/generate-pwa-icons.mjs` → loga "OK" para os 4 PNGs com dimensões exatas (192x192, 512x512, 512x512, 180x180) e exit 0.
2. `npm run typecheck` — sem erros.
3. `npm run lint` — sem erros.
4. `npm test -- src/components/credit/__tests__/balance-card.test.tsx` — todos os testes (existentes atualizados + novos) passando.
5. `npm run build` — build Next passa SEM warnings relevantes de metadata/manifest; confirmar na saída a rota `/manifest.webmanifest` (prerender do manifest.ts), a ausência de warnings de favicon/icon quebrado e a ausência de warning de `themeColor` deprecado em `metadata`.
6. Grep gates (via `Select-String`, que é o disponível na máquina):
   - `Select-String -Pattern "serviceWorker|navigator\.serviceWorker" -Path src\**\*.tsx, src\**\*.ts, public\** -ErrorAction SilentlyContinue` → NENHUM registro (sem service worker).
   - `Select-String -Pattern "Cada geração consome" src\components\credit\balance-card.tsx` → deve retornar SOMENTE a ocorrência do texto neutro estático sem interpolação (linha do fallback) — NUNCA o template dinâmico com `formatCredits`.
   - `Get-ChildItem public\icons -File | Select-Object Name` → 4 PNGs presentes.
7. `git status` — apenas os arquivos listados em `files_modified` alterados/criados (nenhum arquivo fora do escopo).
</verification>

<success_criteria>
- Manifesto instalável válido servido em `/manifest.webmanifest` (name/short_name/description/start_url "/dashboard"/scope "/"/display standalone/theme #0F172A/background #0F172A/ícones 192+512+maskable).
- Ícones PNG existem em `public/icons/` e são referenciados corretamente pelo manifest e pela metadata do layout.
- Metadata PWA/iOS configurada no layout (manifest, export `viewport` com themeColor, appleWebApp, icons incl. apple-touch-icon); build Next passa sem warnings relevantes de metadata/manifest — sem `favicon` top-level e sem `themeColor` deprecado em `metadata`.
- Nenhum service worker nem cache offline introduzido (sem sw.js, sem registros, sem mudança em next.config).
- Dica iOS discreta aparece somente no Safari iOS fora de `display-mode: standalone`, dentro da área da conta, sem botão e sem bloquear fluxo.
- Card de créditos sem texto ambíguo: custo por operação quando carregado (Campanha / Assinatura visual, com singular/plural via `formatCredits`, "indisponível" para operação desabilitada) e texto neutro sem número quando não carregou.
- typecheck, lint, vitest (balance-card) e build verdes.
</success_criteria>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| cliente (browser/PWA) → app | Manifesto, metadata e ícones servidos estaticamente em /manifest.webmanifest e public/icons; custos exibidos no card vêm da API autenticada /api/operation-costs (JÁ existente) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-UDC-01 | Tampering | public/icons/*.png + src/app/manifest.ts | mitigate | Assets estáticos binários gerados por script local e versionados; manifest sem nenhum dado sensível (apenas nome/cores/ícones). Nenhuma secret entra em manifest/metadata. Sem mudança em next.config (headers/expiracao) — nada de cache agressivo |
| T-UDC-02 | Information Disclosure | src/components/credit/balance-card.tsx | accept | Os custos exibidos (costCredits/enabled) já são expostos ao lojista autenticado via GET /api/operation-costs (F38); o card apenas renderiza o mesmo dado — sem dado novo ou PII. Quando indisponível, texto neutro não vaza configuração |
| T-UDC-03 | Spoofing | src/components/pwa/install-hint.tsx | accept | Texto estático localizado, sem inputs do usuário e sem link/URL; não há superfície de injeção. Nenhuma ação do usuário é capturada |
| T-UDC-SC | Tampering | npm installs | accept | NENHUM pacote novo instalado — ícones usam sharp@^0.34.5 já presente em package.json; sem auditoria de legitimidade necessária |
</threat_model>

<output>
Create `.planning/quick/260808-udc-planejar-pwa-basico-clareza-no-card-de-c/260808-udc-SUMMARY.md` when done
</output>
