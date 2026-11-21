# Phase 61 — Plan Check (veredito final)

**Fase:** `61-padronizar-chips-formatos-campanhas`
**Planos verificados:** `61-01`, `61-02`, `61-03`
**Revisão final:** idempotência do teste de evidência, propriedade/estabilidade, cenários do JSON, baseline documental e execução do teste nos planos 02/03.
**Método:** goal-backward + confronto com o código/configuração real. Nenhum código, banco, Storage, provider, homolog ou produção foi tocado; nenhum plano foi editado.

---

## Veredito

# ✅ PASS

**0 BLOCKERS · 0 HIGH · 3 MEDIUM (não bloqueantes) · 4 LOW/INFO**

O **BLOCKER-01** e o **HIGH-01** anteriores foram verificados e resolvidos:
- O teste de evidência é **idempotente**: grava `baseline-calls.json` somente com `BASELINE_CAPTURE=1` ou arquivo ausente; caso contrário, lê e assere `toEqual`. A suíte global roda em modo leitura e **não sobrescreve** o baseline (`61-01` Task 1, linha 174).
- O teste **não constrói** `CampaignListItem`/`EligibleCampaignCard`/`CampaignPageProps`; apenas chama funções reais e mede mocks, permanecendo estável após 61-02/03 (`61-01` linha 175).
- O `<verify>` confere os cenários `list.joint`, `list.legacy_only`, `list.no_signable_thumbnail`, `dashboard.joint`, `dashboard.no_signable_thumbnail`, `detail.joint`, `detail.new_flow` e `detail.legacy` (`61-01` linha 182).
- O `61-BASELINE.md` reconhece `STATE.md`/`ROADMAP.md` modificados como baseline documental autorizada (linha 12).
- `61-02` Task 1 (linha 159) e `61-03` Task 3 (linha 168) executam o teste de evidência em modo leitura.

Também seguem resolvidos: M-01 (`unavailable` vence aprovação/regeneração — `61-03` linha 135), M-03 (`row.status as CampaignStatus` — `61-02` linha 152), M-04 (vertical por expansão — `61-03` linha 137), `active` com preview efetivo (`61-03` linhas 133-137; `61-CONTEXT` linha 266) e remoção de `min_lines: 120`.

---

## 1. Cobertura requisito → plano/tarefa

| ID | Plano(s) / Tarefa(s) | Evidência no plano | Status |
|---|---|---|---|
| **FMT-PRES-01** — dois chips em todas as superfícies | 01-4; 02-2/3; 03-2 | Componente sempre 1:1/9:16; card/linha/página | ✅ Coberto |
| **FMT-MODEL-02** — modelo tipado, `flow`, `partial`, estorno, `active` | 01-2 | Builders joint/individual/unknown/unavailable + matriz | ✅ Coberto |
| **FMT-VIS-03** — texto+forma, ativo distinto, ausente sem `+`, nunca “Não gerado” | 01-4 | Contrato visual + testes | ✅ Coberto |
| **FMT-A11Y-04** — hover/foco/toque, foco visível, 44×44, sem disabled | 01-4; 03-2/3 | `focus-visible`, classes `group-hover`/`group-focus-within`, toggle, 44×44 | ✅ Coberto |
| **FMT-INFO-05** — chips informativos, sem navegar/gerar | 02-2/3 | Sem `hrefs`; testes de ausência de link/navegação | ✅ Coberto |
| **FMT-EFFECT-06** — nenhum efeito novo | 01-2/4; 02-1; 03-1/3 | Builders puros + contagens + “não alterar” RPC/polling | ✅ Coberto |
| **FMT-DETAIL-07** — ativo, seleção conjunta, `?format=` estrito, gates | 03-1/2 | Matriz de página; hrefs só delivered; parser intacto | ✅ Coberto |
| **FMT-AUTH-08** — conjunto antes do individual; sem fallback 1:1 | 02-1; 03-1 | `classifyTwoFormatCampaign(...).kind`; testes nulo/não-objeto/objeto | ✅ Coberto |
| **FMT-SCOPE-09** — não prometer/negar formato futuro | 02-1; 03-1/2; 01-3 | Textos congelados; nenhuma sonda/consulta nova | ✅ Coberto |
| **FMT-PERF-10** — zero chamadas adicionais; lote | 02-1; 03-1/3 | Baseline medido idempotente + prova antes/depois | ✅ Coberto |
| **FMT-I18N-11** — catálogo único pt/es, responsivo | 01-3; 02-2/3; 03-2 | `campaign-formats/`; `toBe`; caminhos `formats`/`campaigns.formats` | ✅ Coberto |
| **LIST-UI-12** — card único, dois chips, ações preservadas | 02-2 | Card único; Abrir/Baixar/miniatura | ✅ Coberto |
| **DASH-UI-13** — linha única, dois chips, contagem/miniatura/abertura | 02-3 | Linha única; `openHref`; contagem; fallback | ✅ Coberto |
| **PAGE-UI-14** — detalhe individual/legado, aprovação, regeneração | 03-1/2 | Mapeamento por fluxo + testes | ✅ Coberto |

**Delta specs:** todos os cenários têm tarefa correspondente. “PODE ter menos evidência”, “sem N+1”, “localização/responsividade”, “vertical por expansão”, “active com preview efetivo” e “gates” estão cobertos.

---

## 2. Verificação dos ajustes finais

| Ajuste | Evidência | Resultado |
|---|---|---|
| Teste de evidência idempotente | `61-01` linha 174: grava só com `BASELINE_CAPTURE=1`/arquivo ausente; caso contrário lê e assere `toEqual`; suíte global em leitura | ✅ Resolvido |
| Teste não constrói DTOs | `61-01` linha 175; apenas chama funções reais/mede mocks; typesafe/lint-clean | ✅ Resolvido |
| Verify com cenários | `61-01` linha 182: `list.joint`, `list.legacy_only`, `list.no_signable_thumbnail`, `dashboard.joint`, `dashboard.no_signable_thumbnail`, `detail.joint`, `detail.new_flow`, `detail.legacy` | ✅ Resolvido |
| Baseline documental | `61-BASELINE.md:12`: STATE/ROADMAP modificados autorizados; untracked `openspec/...` e `.planning/phases/61-.../` | ✅ Resolvido |
| 61-02/61-03 executam a evidência | `61-02` linha 159; `61-03` linha 168 | ✅ Resolvido |
| `active` com preview efetivo | `61-03` linhas 133-137; `61-CONTEXT` linha 266; testes de `previewUrl`/`imageUrl` nulos | ✅ Resolvido |
| `min_lines: 120` removido | `61-01` linhas 58-59 | ✅ Resolvido |
| M-01/M-03/M-04 | `61-03` linha 135; `61-02` linha 152; `61-03` linha 137 | ✅ Mantidos |

---

## 3. Findings remanescentes (sem blocker/high)

### 🟡 MEDIUM-01 — O `<verify>` do JSON não exige o cenário “1 vs 3 conjuntas” nem o “legacy_only” do dashboard

**Dimensão:** verification derivation / FMT-PERF-10
**Onde:** `61-01` Task 1 ação (linha 171, item d: 1 vs 3 conjuntas; linha 172: “os mesmos cenários” no dashboard) vs `<verify>` (linha 182).
**Fato:** o verify confere `list.joint`, `list.legacy_only`, `list.no_signable_thumbnail`, `dashboard.joint`, `dashboard.no_signable_thumbnail`, `detail.*`. Não confere um cenário dedicado de 1 vs 3 conjuntas (prova de lote constante) nem `dashboard.legacy_only`.
**Impacto:** um teste que omitisse esses cenários ainda passaria no JSON verify; a prova de lote constante ficaria mais fraca. A ação do teste, porém, exige; um executor diligente inclui.
**Correção recomendada:** acrescentar `list.one_vs_three` (ou equivalente) e `dashboard.legacy_only` ao JSON/verify, ou fazer o teste asserir a existência desses cenários.

---

### 🟡 MEDIUM-02 — Fallback “arquivo ausente” ainda pode recriar o baseline em modo leitura

**Dimensão:** prova de baseline
**Onde:** `61-01` linha 174.
**Fato:** o teste grava quando `BASELINE_CAPTURE=1` **ou** o arquivo não existe. No fluxo normal, o JSON é criado no 61-01 e existe no 61-02/03; porém, se o arquivo for removido antes da suíte global, o teste recria `baseline-calls.json` com os números “depois” em modo leitura.
**Impacto:** cenário de borda; não ocorre no fluxo planejado. A prova principal permanece válida.
**Correção recomendada:** no modo leitura, falhar com mensagem explícita se `baseline-calls.json` não existir (em vez de gravar), deixando a criação apenas para `BASELINE_CAPTURE=1`.

---

### 🟡 MEDIUM-03 — Escopo do `61-01` (4 tarefas / 25 arquivos)

**Dimensão:** scope sanity
**Onde:** `61-01` frontmatter linhas 11-34; Task 3 linha 200.
**Fato:** acima do alvo 2-3/5-8. A justificativa de coesão é razoável (catálogos pequenos/testes de paridade), mas o Task 3 concentra 20 arquivos e o Task 1 inclui suíte global + build + evidência.
**Correção opcional:** dividir o Task 3 em 3a/3b ou manter a justificativa. Não bloqueia.

---

### 🟢 LOW / INFO

| # | Severidade | Finding | Correção sugerida |
|---|---|---|---|
| L-01 | LOW | `61-CONTEXT.md:313` ainda diz que o único untracked é `openspec/...`; o baseline doc já reconhece STATE/ROADMAP + phase dir. | Atualizar a frase do CONTEXT ou remover a duplicação. |
| L-02 | LOW | Os testes existentes de catálogo verificam congelamento de namespaces listados; incluir `formats`/`jointNotes` nas listas de congelamento. | Atualizar `NAMESPACES`/checagens dos três `catalogs.test.ts`. |
| L-03 | LOW | O teste do componente não afirma explicitamente o `aria-label` concatenado (`${infoAria}: ${name}`). | Adicionar asserção por formato. |
| L-04 | INFO | `61-02` T-61-11 diz que `storage_path` está “fora do DTO”, mas `CampaignListItem.storagePath` existe (pré-existente). | Reformular para “fora do DTO de apresentação/`formatPresentation`”. |

---

## 4. O que está correto (não bloquear por engano)

- **Cobertura:** 14/14 IDs de `61-CONTEXT.md` nos `requirements`; todos com tarefa.
- **Baseline antes de edição:** `61-01` Task 1 é a primeira tarefa; branch/HEAD conferem; worktree documental autorizada; passo 8 captura e lê a evidência.
- **Evidência idempotente:** a suíte global executa o teste em modo leitura; não sobrescreve; se houver chamada nova, o `toEqual` falha — vira gate de regressão.
- **Autoridade conjunta antes do individual:** `page.tsx:110-136`; `inconsistent`/falha não caem no individual.
- **`error`/`stale` → `unknown`:** explícito; nenhum teste manda virar `absent`.
- **Sem fallback 1:1:** `resolveCampaignFormat` (`format-resolution.ts:88-95`) e testes; snapshot nulo/não-objeto/objeto separados.
- **Estorno visível:** `absent + refunded` + rótulo/explicação; `summary.view.creditRefunded`.
- **Lista/dashboard informativos:** cards são `div` (`campanhas/client.tsx:309`, `available-campaign-card.tsx:56-118`); chips sem `href`; Abrir/Baixar/miniatura preservados.
- **Detalhe:** duplicação real (`client.tsx:395-430`/`798-833`) removida; chips abaixo de `PageHeader`; `?format=` estrito; hrefs só delivered; `active` só com preview efetivo; aprovação/regeneração com gate preservado e `unavailable` vencendo.
- **Namespaces:** `CampaignListMessages.formats`, `DashboardMessages["campaigns"].formats`, `CampaignDetailMessages.formats`; `DashboardCampaigns` recebe `DashboardMessages["campaigns"]`, então `messages.formats` dentro do componente é correto.
- **A11y:** `focus-visible`, classes `group-hover`/`group-focus-within`, 44×44, sem `disabled`, teste por classe/atributo.
- **Task 3:** `## VALIDACAO FINAL F61` no `61-BASELINE.md`; `files_modified` inclui o baseline; prova de detalhe.
- **4 testes de props:** incluídos em arquivos, verify e suíte final.
- **Waves/autonomia:** 1/2/3, `depends_on` acíclico, `autonomous: false`, `## Review Stop`.
- **Escopo:** nenhuma migration/banco/Storage/provider/homolog/produção/merge/push/deploy/sync/archive; `supabase/**`, `product-two-format/**` e `format-resolution.ts` intocados.
- **Nyquist:** `workflow.nyquist_validation = false`; sem `RESEARCH.md`/`VALIDATION.md` → Dimensão 8/11/7c **SKIPPED**.

---

## 5. Conclusão

O **BLOCKER-01** e o **HIGH-01** foram resolvidos: o teste de evidência é idempotente, não constrói DTOs, a suíte global não sobrescreve o baseline, o verify cobre os cenários centrais e o baseline documental reconhece a worktree autorizada. M-01, M-03, M-04, `active` com preview e `min_lines` também estão corretos.

Não há blocker/high remanescente. As ressalvas são de reforço de verificação (1 vs 3/dashboard legacy no JSON), robustez do fallback de arquivo ausente, escopo do 61-01 e documentação; não impedem a execução.

**Resultado:** `passed` → **PASS**.
**Nada foi executado contra banco, Storage, provider, homolog ou produção.**
