# Quick Task 261027-k4d: Planejar a primeira fatia da fundação multimercado - Context

**Gathered:** 2026-10-27
**Revised:** 2026-10-27 (revisão pontual do usuário/Codex — mesma quick, sem ampliar escopo)
**Status:** Ready for planning
**Initiative:** F57 — fundação multimercado (vínculo de iniciativa; registro formal de fase/requisitos permanece no fluxo OpenSpec/GSD)
**Scope:** documentação/planejamento apenas — nenhuma implementação nesta quick

<domain>
## Task Boundary

Produzir o PLANO (mais este contexto) da primeira fatia da fundação multimercado do Vendeo V3:
uma biblioteca pequena, independente e testável de contratos de contexto multimercado, sem
conexão com o funcionamento produtivo.

Esta quick **não implementa**: não cria `src/lib/market-context/**`, não altera banco, telas,
Store/DTO, autenticação, crédito, prompts, IA, formatação existente, dependências ou ambiente.
Não há commit automático nesta etapa.

</domain>

<decisions>
## Implementation Decisions

### 1. Topologia e autorização (decidido)
- Brasil e Paraguai compartilham o **mesmo projeto Supabase por ambiente**; isolamento continua
  por usuário/loja e por regras de mercado. A topologia **não está pendente**.
- `countryCode`/mercado **não é autorização**. Igualdade de país não concede acesso cruzado.
- A biblioteca é independente da topologia física e não introduz roteador multi-banco.

### 2. Seis dimensões independentes (não colapsar em um objeto único)
| Dimensão | Onde mora | Nunca determina |
|---|---|---|
| País da loja (cadastral/fiscal) | `StoreMarketContext.country` | idioma do conteúdo, moeda anunciada |
| Idioma do aplicativo | `UserLocalePreference` | país, mercado, moeda |
| Mercado padrão de campanhas | `StoreMarketContext.defaultCampaignMarket` | autorização |
| Mercado de destino da campanha | `CampaignMarketContext.market` | idioma do app |
| Idioma do conteúdo da campanha | `CampaignMarketContext.contentLocale` | país, moeda, câmbio |
| Moeda dos preços anunciados | `CampaignMarketContext.currency` | câmbio, moeda de cobrança |

### 3. Padrões: mercado padrão define idioma e moeda; país define fuso
- Perfis versionados `BR` e `PY` (referência, **não** habilitação operacional).
- `StoreMarketContext.defaultContentLocale` e `defaultCurrency` derivam do **mercado padrão das
  campanhas**, nunca do país cadastral. Loja BR com mercado padrão PY ⇒ `es-PY`/`PYG`.
- `StoreMarketContext.timeZone` deriva do **país cadastral** (`defaultTimeZone` do perfil).
- Overrides explícitos da loja são permitidos e precedem os padrões.
- Precedência de mercado: override da campanha > mercado padrão da loja > país da loja.
- Precedência de idioma/moeda do conteúdo (campanha): override explícito da campanha > padrão da
  loja (quando a campanha está no mercado padrão da loja) > padrão do perfil do **mercado de
  destino**. Ao trocar o destino, os padrões do destino são sugeridos; escolha explícita vence.
- Precedência do idioma do app: preferência explícita do usuário; ausência **total** declarada
  como legado ⇒ `pt-BR` com proveniência `legacy_br`. Nunca derivado do país/mercado da loja.
- Resultado carrega proveniência (`configured` / `legacy_br` / origem por campo) **fora** do valor
  versionado.

### 4. Entrada de configuração ≠ valor resolvido
- **Entrada de configuração** (`StoreMarketConfigInput`): pode omitir preferências; o resolvedor
  aplica os padrões da seção 3. `country` é obrigatório (é identidade, não preferência).
- **Valor resolvido/versionado** (`StoreMarketContext`, `CampaignMarketContext`): todos os campos
  são obrigatórios. Um valor persistido/fornecido incompleto é **inválido** — não recebe defaults
  silenciosos. Parsers dedicados (`parseStoreMarketContext`, `parseCampaignMarketContext`) fazem
  essa checagem estrita.
- Ausência, valor desconhecido, versão desconhecida e combinação inválida retornam **erro
  tipado**; nunca cair silenciosamente em Brasil.

### 5. Campanhas entregues
- `CampaignMarketContext` é um valor **autocontido, versionado e congelado**, materializado como
  cópia independente: alterar preferências/entradas depois da resolução não muda o valor.
- Leitura de campanha: `null`/`undefined` ⇒ `missing_legacy`; objeto vazio, incompleto ou com
  versão/campo desconhecido ⇒ `invalid`; objeto completo e válido ⇒ `present` com cópia própria.
- Sem backfill e sem reinterpretação de campanhas antigas. Nenhuma edição após entrega.
- Este contrato **prepara** a proteção; a proteção produtiva (persistência, snapshot obrigatório,
  imutabilidade no banco) **não** é implementada nesta fatia.

### 6. Caminho e forma do código
- Caminho confirmado: `src/lib/market-context/**` com `__tests__/` co-localizado.
  Adequação verificada: convenção `src/lib/<domínio>/` + `__tests__` (ex.: `cnpj`,
  `product-1-1`, `economic`), alias `@/*`, Vitest em ambiente `node`; não existe módulo de
  país/moeda hoje e `src/lib/formatters.ts` é explicitamente BR-only.
- `src/lib/localization/**` (rascunho antigo) **fica fora**: dinheiro, formatação, parsers, datas
  e catálogos não pertencem a este recorte.
- Perfis e registry protegidos por congelamento recursivo + testes de mutação.
- Perfil `PY` existe na biblioteca **sem** significar habilitação do país.

### 7. the agent's Discretion
- Nomes exatos dos helpers, quantidade de arquivos internos e formato de `source` por campo,
  desde que: tipos separados por responsabilidade, funções puras, zero I/O, erros tipados,
  perfis congelados, config parcial aceita / valor resolvido estrito e testes que cubram os dois
  sentidos de campanha cruzada.

</decisions>

<specifics>
## Specific Ideas

- Contratos-base:
  - `StoreMarketContext` (versionado, completo): `country`, `defaultCampaignMarket`,
    `defaultContentLocale`, `defaultCurrency`, `timeZone`.
  - `UserLocalePreference`: `uiLocale` + proveniência.
  - `CampaignMarketContext` (versionado, completo): `market`, `contentLocale`, `currency`.
  - `MarketProfile`: `market`, `profileVersion`, `defaultContentLocale`, `defaultCurrency`,
    `defaultTimeZone`.
- Combinações suportadas: `pt-BR`/`es-PY` × `BRL`/`PYG` × `BR`/`PY` são independentes; qualquer
  combinação de valores suportados é válida. Moeda de cobrança da assinatura **não** entra.
- Testes obrigatórios: BR→PY e PY→BR nos dois sentidos; loja BR com mercado padrão PY ⇒
  `es-PY`/`PYG`/fuso `America/Sao_Paulo`; app `pt-BR` com conteúdo `es-PY` e vice-versa; moeda
  independente do mercado; mutação após resolução; objeto `{}` inválido; versão desconhecida;
  campanha legada nula vs. contexto incompleto.

</specifics>

<canonical_refs>
## Canonical References

- `AGENTS.md` — enforcement GSD, migrations, códigos de erro de suporte, tracking.
- `docs/fluxo-de-desenvolvimento.md` — OpenSpec → revisão → GSD → execução → verificação.
- `.planning/STATE.md` — estado atual; `main` com alterações documentais não commitadas.
- `src/lib/formatters.ts` — evidência do acoplamento BR atual (não deve ser modificado).
- `src/lib/store.ts`, `src/lib/store-public-dto.ts`, `src/lib/campaign-intelligence/schema.ts` —
  contratos produtivos que esta fatia não altera.
- `vitest.config.ts`, `tsconfig.json`, `eslint.config.mjs` — runner, alias e cobertura real de
  lint (ESLint atual não cobre TypeScript).
- `package.json` — scripts `test`, `typecheck`, `lint`, `build`.

**Histórico (não é dependência):** o rascunho `openspec/changes/fundacao-multimercado-e-locales/`
e a quick `261027-ijl` foram criados por um agente anterior, nunca aprovados, e foram **removidos
pelo Codex a pedido do usuário na limpeza de 2026-10-27**. Não existem mais no worktree, não são
lidos por esta quick e não conferem aprovação retroativa.

</canonical_refs>
