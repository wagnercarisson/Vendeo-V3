---
quick_id: 261102-tnu
phase: quick
plan: 01
type: execute
wave: 1
depends_on: ["261102-qna"]
autonomous: false
status: complete
decisions_reviewed: 2026-11-03
approval_required: true
implementation_authorized: true
implementation_status: complete_production
backfill_authorized: true
publication_authorized: true
production_acceptance: approved_by_owner
base_sha: c703acdf9249c221a0b66975d09408fb541fe246
branch: perf/miniaturas-campanhas
files_modified:
  - src/lib/campaign/list.ts
  - src/__tests__/lib/campaign/list.test.ts
  - src/components/dashboard/available-campaign-card.tsx
  - src/components/dashboard/__tests__/available-campaign-card.test.tsx
  - src/app/(app)/campanhas/client.tsx
  - src/__tests__/app/minhas-campanhas-client.test.tsx
  - .planning/quick/261102-tnu-conectar-dashboard-e-listagem-de-campanh/evidence/
requirements: [REQ-tnu-01, REQ-tnu-02, REQ-tnu-03, REQ-tnu-04, REQ-tnu-05, REQ-tnu-06, REQ-tnu-07]
must_haves:
  truths:
    - "Dashboard e listagem assinam e solicitam o caminho .thumb-v1.webp derivado do original; não assinam nem carregam a arte original para a miniatura."
    - "O bucket campaign-images permanece privado; nenhum objeto, policy ou bucket público é criado."
    - "Miniatura ausente, assinatura indisponível ou erro de carregamento resultam no placeholder existente, e a abertura da campanha continua funcional."
    - "Após uma falha, trocar `thumbnailUrl` por uma URL válida volta a exibir a imagem nos dois cards (reset do estado de falha por mudança de URL)."
    - "Não há fallback automático para a arte original nessas duas telas."
    - "Detalhe, download e demais fluxos que exigem qualidade integral continuam usando a arte original; o botão Baixar funciona mesmo quando a miniatura falha."
    - "Filtros, paginação, contagens, elegibilidade ready-only, idioma pt-BR/es-419 e isolamento entre lojas permanecem inalterados."
    - "A composição visual aprovada (80/96 px, proporção, responsividade) é preservada; apenas atributos de carregamento/decodificação e o fallback de erro são adicionados."
  artifacts:
    - path: "src/lib/campaign/list.ts"
      provides: "Assinatura central do caminho derivado da miniatura para dashboard e listagem, com placeholder em falha"
      contains: "deriveThumbnailPath"
    - path: "src/components/dashboard/available-campaign-card.tsx"
      provides: "Card do dashboard consumindo a miniatura assinada, preservando fallback pré/pós-hidratação e o link"
    - path: "src/app/(app)/campanhas/client.tsx"
      provides: "Card da listagem consumindo a miniatura assinada, com fallback pré/pós-hidratação preservando Abrir/Baixar"
    - path: "src/__tests__/lib/campaign/list.test.ts"
      provides: "Prova de derivação/assinatura do .thumb-v1.webp para legado, v2 e novo fluxo, sem fallback ao original"
  key_links:
    - from: "src/lib/campaign/list.ts"
      to: "src/lib/campaign/thumbnail/thumbnail-path.ts"
      via: "deriveThumbnailPath"
      pattern: "deriveThumbnailPath"
    - from: "src/lib/dashboard/campaigns.ts"
      to: "src/lib/campaign/list.ts"
      via: "generateBatchThumbnailUrls"
      pattern: "generateBatchThumbnailUrls"
    - from: "src/app/(app)/campanhas/page.tsx"
      to: "src/lib/campaign/list.ts"
      via: "listCampaigns"
      pattern: "listCampaigns"
    - from: "src/app/(app)/campanhas/client.tsx"
      to: "src/lib/campaign/list.ts"
      via: "CampaignListItem.thumbnailUrl"
      pattern: "thumbnailUrl"
user_setup: []
---

# Conectar dashboard e listagem às miniaturas persistidas

**Objetivo:** fazer dashboard e listagem carregarem a miniatura WebP persistida (`.thumb-v1.webp`) em vez da arte original, preservando composição, navegação, filtros e privacidade.

**Quick anterior:** `261102-qna` — geração automática + backfill idempotente; Gate B local concluído com **67/67 miniaturas** do fluxo legado. Esta quick consome esse contrato, sem gerar miniaturas.

**Base:** branch `perf/miniaturas-campanhas`, commit `c703acdf`, com alterações documentais/evidências da quick anterior **não commitadas** — preservar.

**Sequência de entrega acordada**
1. Implementar e validar esta quick localmente, **após aprovação deste plano**.
2. Preparar separadamente a liberação controlada do script para produção (ambiente hoje bloqueado).
3. Mediante autorização específica, executar o backfill remoto e conferir.
4. Publicar o código das duas quicks juntas.
5. Reexecutar o script idempotente se surgirem campanhas no intervalo.

## 1. Escopo

**Dentro**
- Reutilizar `deriveThumbnailPath` de `src/lib/campaign/thumbnail/thumbnail-path.ts`.
- Alterar `generateBatchThumbnailUrls` para assinar o caminho da miniatura.
- Ajustar os dois consumidores (`AvailableCampaignCard` e `CampaignCard`) para placeholder em falha e atributos de carregamento.
- Testes focados + validação local/browser.

**Fora**
- Gerar miniaturas em render/request.
- Fallback para o original nas duas telas.
- Alterar detalhe, download, geração, crédito, aprovação ou recuperação.
- Migration, coluna, tabela, bucket, policy, fila, cron, dependência ou serviço.
- Otimizar outras telas (registrar oportunidades).

## 2. Investigação dos consumidores e URLs assinadas

- **Dashboard:** `src/lib/dashboard/campaigns.ts:55-61` chama `generateBatchThumbnailUrls` com `storagePath` das campanhas `ready`; `AvailableCampaignCard` renderiza `thumbnailUrl` em caixa 80/96 px (`h-20 w-20 sm:h-24 sm:w-24`) e já tem fallback `ImageOff` + detecção pré-hidratação (`complete && naturalWidth === 0`).
- **Listagem:** `src/app/(app)/campanhas/page.tsx:41-50` chama `listCampaigns`; `list.ts:116` usa `generateBatchThumbnailUrls`; `CampaignCard` em `client.tsx:246-295` renderiza `<img>` em 96×96 px, com placeholder vazio quando `null`, botões Abrir/Baixar e navegação.
- **Assinatura atual:** `list.ts:173-201` assina `item.storagePath` (arte original) com TTL 3600 no bucket privado `campaign-images`.
- **Consumidores da função compartilhada:** apenas `list.ts` e `dashboard/campaigns.ts` (grep). Alterar a função atende os dois; nenhum outro fluxo depende dela.
- **Detalhe/download:** continuam usando `campaigns.storage_path`/artefato original; não serão tocados.

## 3. Contrato de mídia

| Item | Proposta |
|---|---|
| Caminho | `deriveThumbnailPath(originalPath)` — legado, v2 e novo fluxo |
| Assinatura | `createSignedUrl(thumbPath, 3600)` no bucket privado existente |
| Inelegível | `thumbnailUrl = null` (sem assinar original) |
| Ausente/erro de assinatura | `thumbnailUrl = null` (placeholder) |
| Erro de carregamento | placeholder local no card; link/Abridores preservados |
| Original | intocado; detalhe/download seguem usando-o |
| Novos objetos públicos | nenhum |

**Sem verificação remota extra de existência:** a assinatura é feita direto no caminho derivado; se o objeto não existir ou falhar, o card cai no placeholder (pré ou pós-hidratação).

## 4. Tarefas

### Task 1 — Assinatura central do caminho da miniatura

**Files**
- `src/lib/campaign/list.ts`
- `src/__tests__/lib/campaign/list.test.ts`

**Action**
1. Em `generateBatchThumbnailUrls`:
   - manter filtro `status === "ready"` + `storagePath` presente;
   - derivar `const thumbPath = deriveThumbnailPath(item.storagePath)`;
   - se `null` → resultado `null` para o item, **sem** assinar o original;
   - assinar `thumbPath` com TTL 3600 no bucket `campaign-images`;
   - `Promise.allSettled` continua: erro/rejeição → `null` para aquele item;
   - nenhuma chamada nova por item além da assinatura.
2. Não alterar query, filtros, paginação, contagens, `CampaignListItem` ou `storagePath`.
3. Atualizar fixtures de teste para paths UUID canônicos.
4. Testes:
   - legado `{store}/{campaign}.jpg` → assina `{store}/{campaign}.thumb-v1.webp`;
   - v2 `{store}/{campaign}/v2.jpg` → assina `.../v2.thumb-v1.webp`;
   - novo fluxo `.../art-1024.jpg` → assina `.../art-1024.thumb-v1.webp`;
   - path inelegível (`/inputs/`, não-UUID) → `null` e **zero** chamadas de assinatura;
   - erro/rejeição de assinatura → `null` sem lançar;
   - nunca assina `.jpg` original.

**Verify**
- `npm.cmd test -- src/__tests__/lib/campaign/list.test.ts src/lib/dashboard/__tests__/campaigns.test.ts`
- Grep: `createSignedUrl` recebe apenas caminhos `.thumb-v1.webp` nos testes; nenhuma referência a fallback original.

**Done**
- Dashboard e listagem recebem URL assinada da miniatura; inelegível/erro vira `null`; original não é assinado.

### Task 2 — Consumidores: dashboard e listagem

**Files**
- `src/components/dashboard/available-campaign-card.tsx`
- `src/components/dashboard/__tests__/available-campaign-card.test.tsx`
- `src/app/(app)/campanhas/client.tsx`
- `src/__tests__/app/minhas-campanhas-client.test.tsx`

**Action**
1. Dashboard (`AvailableCampaignCard`):
   - manter estrutura/classes 80/96 px, `alt=""`, fallback `ImageOff` e link “Abrir campanha”;
   - adicionar `decoding="async"` e `loading="eager"` (até 3 cartões acima da dobra);
   - preservar a detecção pré-hidratação (`complete && naturalWidth === 0`) e `onError`;
   - **recuperação:** o efeito depende de `thumbnailUrl` e reseta `failed` antes de reavaliar; uma URL nova válida volta a renderizar a imagem.
2. Listagem (`CampaignCard`):
   - adicionar estado `failed` + `useRef` + efeito de montagem para detectar falha antes da hidratação; o efeito reseta `failed` quando `thumbnailUrl` muda e então verifica `complete && naturalWidth === 0`;
   - `showImage = Boolean(thumbnailUrl) && !failed`; fallback = div `bg-bg-elevated` existente;
   - `onError` → fallback; `alt` do produto permanece;
   - `decoding="async"`; `loading={index < 3 ? "eager" : "lazy"}` (primeiros cartões visíveis sem atraso; demais abaixo da dobra);
   - preservar botões Abrir/Baixar, rotas e status;
   - **download independente:** o botão Baixar continua apontando para `/api/campaign/{id}/download` (arte original), inclusive quando `thumbnailUrl` é nulo ou a imagem falhou.
3. Não extrair componente compartilhado nesta quick (evita alterar a composição F58); a lógica de fallback é pequena e local.
4. Testes:
   - miniatura válida renderiza `src` com `.thumb-v1.webp`;
   - `thumbnailUrl = null` → placeholder e link/botões funcionais;
   - `onError` → placeholder, link “Abrir”/botão Abrir preservados;
   - falha antes da hidratação (`complete=true`, `naturalWidth=0`) → placeholder;
   - **recuperação por mudança de URL (ambos os cards):** após `onError`/falha pré-hidratação, rerenderizar com uma URL válida volta a exibir `<img>`;
   - **download independente (listagem):** com miniatura nula **e** com miniatura em erro, o botão Baixar continua direcionando para `/api/campaign/{id}/download` (original);
   - atributos `decoding="async"` e política de `loading` (eager nos 3 primeiros, lazy nos demais);
   - listagem mantém 10 cartões/paginação e idioma sem mudanças.

**Verify**
- `npm.cmd test -- src/components/dashboard/__tests__/available-campaign-card.test.tsx src/__tests__/app/minhas-campanhas-client.test.tsx src/__tests__/app/dashboard/dashboard-page.test.tsx src/__tests__/app/minhas-campanhas.test.tsx`
- `npm.cmd run typecheck`

**Done**
- Os dois cards usam a miniatura assinada; falha em qualquer estado cai no placeholder; navegação e composição preservadas.

### Task 3 — Validação integrada e evidência local

**Files**
- `.planning/quick/261102-tnu-conectar-dashboard-e-listagem-de-campanh/evidence/`

**Action**
1. Gates automatizados:
   - testes focados das Tasks 1–2;
   - regressão: `campaign-download`, `list`, `dashboard/campaigns`, `dashboard-page`, `minhas-campanhas`, `display`;
   - typecheck, lint (limitação conhecida sem TS), build, `git diff --check`.
2. Validação browser local (sem dependência nova):
   - dashboard com 3 campanhas: requests automáticos dos cards terminam em `.thumb-v1.webp`, tamanho compatível (~10–24 KB), **nenhum** request da arte original `.jpg` disparado pelos cards;
   - listagem: idem para os 10 itens; paginação/filtros continuam funcionando;
   - **distinção explícita de rede:** separar os requests automáticos dos cards (devem ser apenas miniaturas) daqueles disparados por **abrir a campanha** (detalhe) ou **Baixar** (download), que podem e devem carregar o original;
   - desktop e mobile; pt-BR e es-419; sem mudança visual além da imagem mais leve;
   - simular miniatura ausente/erro (bloquear request ou apontar 404) e confirmar placeholder + abertura;
   - com miniatura falhando, acionar Baixar e confirmar que o original é servido normalmente.
3. Registrar em `evidence/`:
   - comandos, contagens de requests/tamanhos, capturas desktop/mobile nos dois idiomas, resultado dos gates;
   - distinção explícita: evidência **local**; produção não preenchida nem validada.

**Verify**
- `npm.cmd test -- src/__tests__/lib/campaign/list.test.ts src/__tests__/app/minhas-campanhas-client.test.tsx src/components/dashboard/__tests__/available-campaign-card.test.tsx`
- `npm.cmd run typecheck && npm.cmd run lint && npm.cmd run build`
- `git diff --check`
- Browser/CDP: URLs de miniatura e ausência de originais nos requests.

**Done**
- Evidência local completa; nenhuma geração/escrita remota; produção explicitamente pendente.

## 5. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| `createSignedUrl` não valida existência | Erro de carregamento cai no placeholder; sem checagem remota extra |
| Path antigo/não canônico | `deriveThumbnailPath` retorna `null` → placeholder, sem original |
| Regressão na função compartilhada | Consumidores mapeados: apenas dashboard e listagem; testes dos dois |
| Fallback pré-hidratação perdido | Efeito de montagem preservado/adicionado; testes com `complete/naturalWidth` |
| `loading="lazy"` atrasar cards visíveis | Primeiros 3 cartões da listagem e os 3 do dashboard em `eager`; medir no browser |
| Assinatura por item adicionar latência | Mesmo número de chamadas atual (uma por item ready); `allSettled` mantido |
| Isolamento entre lojas | Query e `store_id` intocados; testes existentes preservados |
| Localização | Nenhum texto/rota alterado; testes pt-BR/es-419 existentes |
| V2/novo fluxo sem miniatura em produção | Placeholder até backfill; script idempotente preenche depois, sem mecanismo novo |

## 6. Decisões (revisão de 2026-11-03)

1. **Loading:** `eager` nos 3 do dashboard e nos 3 primeiros da listagem; `lazy` nos demais — **adotado**.
2. **Fallback:** lógica local nos dois cards, sem componente compartilhado — **adotado**.
3. **Consumidores:** confirmado no código que `generateBatchThumbnailUrls` atende somente dashboard e listagem — **resolvido**, não é decisão pendente.
4. **V2 pendente:** preservar o caminho canônico atual (`campaigns.storage_path`; v1 até aprovação), sem antecipar arte não aprovada — **adotado**.
5. **Outras telas:** fora do escopo; registrar oportunidades de follow-up — **adotado**.
6. **Recuperação após mudança de URL:** resetar a falha e voltar a exibir a imagem quando `thumbnailUrl` mudar — **adicionado aos testes dos dois cards**.
7. **Download independente:** Baixar usa sempre o original, inclusive com miniatura ausente/falha — **adicionado aos testes e à evidência de rede**.

## 7. Adequação a uma quick

**Sim.** 3 tarefas, ~6 arquivos de código/teste, sem migration, fila, bucket, dependência ou mudança de contrato comercial. O risco está concentrado na função compartilhada (apenas dois consumidores) e no fallback dos dois cards.

## 8. Não fazer nesta rodada

Sem implementação, execução de script, escrita em banco/Storage, commit, merge, push ou deploy. Aguardar aprovação explícita do plano e das decisões da §6.

## 9. Encerramento e aceite de produção (2026-11-03)

Registro final, conforme confirmação do responsável:

- **Push e deploy realizados.**
- **Validação funcional e visual em produção aprovada.**
- **Original 1024×1024 preservado.**
- **Miniaturas 288×288 funcionando.**
- **As duas quicks (`261102-qna` + `261102-tnu`) concluídas e aceitas em produção.**

Este registro substitui a pendência de publicação do histórico acima. Não foram inventadas evidências adicionais: não houve registro de geração de campanha nova nem de validação visual em es-419 na produção nesta rodada. Evidência: `261102-qna/evidence/production-ACCEPTANCE.md`.
