# 59-10 — Proposta de correção da task 5.14 (rascunho local)

Status: **proposta; nenhum código editado**. Escopo: preservar o rascunho no reload
sem reintroduzir dados antigos ao iniciar outra campanha; pausa vertical com flag OFF
no cliente, complementando o servidor. Prompt, geração, crédito, auditoria e a quick
pós-F59 não são alterados.

## 1. Comportamento alvo

| Cenário | Esperado |
|---|---|
| Reload da mesma edição | campos, imagens e formato preservados |
| Revisão → edição e retorno após erro | dados preservados (já comprovado; regressão) |
| Início intencional de outra campanha | limpeza das chaves globais mantida |
| Restauração por `campaignId` (`restoreFrom`) | chave escopada preservada; sem regressão |
| Draft 9:16 + flag OFF | 9:16 preservado, pausa explicada e avanço/submissão bloqueados |
| Draft 1:1 | sem pausa; body sem chaves de formato |

## 2. Persistência atual

- `sessionStorage`: `campaign_draft` / `campaign_draft_image` (globais, campanha nova)
  ou `campaign_draft:<campaignId>` / `campaign_draft_image:<campaignId>` (restore).
- Autosave a cada 500 ms; grava `fields` (textos, preços, intenção, aviso,
  `productImages[].dataUrl`, `campaignFormat`).
- `CampaignPageClient` remove as chaves **globais** no `useLayoutEffect` de montagem;
  isso roda antes do `useEffect` de restauração do `useCampaignForm`.

## 3. Pontos de entrada e saída

**Entradas de campanha nova (devem marcar intenção):**
- `src/components/shell/topbar.tsx` — CTA global; na mesma rota já força reload.
- `src/components/dashboard/dashboard-campaigns.tsx` — CTA do dashboard.
- `src/components/dashboard/dashboard-shortcut.tsx` — atalho do dashboard.
- `src/app/(app)/campanhas/client.tsx` — CTA da listagem.
- `src/app/(app)/campanhas/[id]/client.tsx` — CTAs de erro/stale
  (`router.push("/campanhas/nova")`).

**Entradas que NÃO são campanha nova:**
- `/campanhas/nova?restoreFrom=<id>` — restauração escopada; não marcar.
- Retorno de `/loja`/legal para `/campanhas/nova` — retorno, não novo; não marcar.

**Saídas:**
- submit concluído → `clearFormState` já limpa o draft.
- reload → sem marcador; detectar `performance.getEntriesByType("navigation")[0].type === "reload"`.
- início intencional → marcador `sessionStorage` consumido no mount.

## 4. Mecanismo de distinção (reaproveita sessionStorage)

Adicionar em `src/hooks/use-input-preservation.ts`:

```ts
export const NEW_CAMPAIGN_INTENT_KEY = "campaign_new_intent";

export function markNewCampaignIntent(): void {
  try { sessionStorage.setItem(NEW_CAMPAIGN_INTENT_KEY, "1"); } catch {}
}

export function consumeNewCampaignIntent(): boolean {
  try {
    const value = sessionStorage.getItem(NEW_CAMPAIGN_INTENT_KEY) === "1";
    sessionStorage.removeItem(NEW_CAMPAIGN_INTENT_KEY);
    return value;
  } catch { return false; }
}
```

Em `CampaignPageClient`, substituir o clear incondicional por:

```ts
const [intentionalNew] = useState(() => consumeNewCampaignIntent());

useLayoutEffect(() => {
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const isReload = navigation?.type === "reload";
  if (intentionalNew || !isReload) {
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(IMAGE_DRAFT_KEY);
    sessionStorage.removeItem(PREVIEW_KEY);
  }
}, [intentionalNew]);
```

Regra:
- reload sem marcador → preserva globais;
- navegação normal sem marcador → limpa (comportamento atual de campanha nova);
- qualquer CTA de campanha nova → marca e limpa mesmo em reload;
- chaves escopadas nunca são tocadas pelo clear global.

Nos CTAs de campanha nova, chamar `markNewCampaignIntent()` no `onClick` (antes do
`router.push`/reload). No Topbar, marcar antes de `window.location.reload()`.

## 5. Pausa vertical no cliente

Em `useCampaignForm`, adicionar `verticalEnabled?: boolean` às options e derivar:

```ts
const effectiveCampaignFormatPaused =
  campaignFormatPaused ||
  (fields.campaignFormat === "9:16" && options?.verticalEnabled === false);
```

Usar `effectiveCampaignFormatPaused` nos guards de `handleSubmit`, `retrySubmit` e
`confirmReview` e devolvê-lo no hook. Em `CampaignInputForm`:

```ts
} = useCampaignForm(storeId, { eligible, restoredForm, campaignFormatPaused, verticalEnabled });
```

Passar o valor efetivo ao `FormContent` (banner, `disabled` do seletor, botão,
`aria-disabled`/`title`). O `campaignFormatPaused` server-side continua sendo a
autoridade para `restoreFrom`; o cálculo cliente é complementar, não substituto.

## 6. Arquivos do diff proposto

- `src/hooks/use-input-preservation.ts` — marcador/consumo.
- `src/components/flow/campaign-page-client.tsx` — clear condicional.
- `src/components/shell/topbar.tsx` — marcar antes de reload.
- `src/components/dashboard/dashboard-campaigns.tsx` — marcar no CTA.
- `src/components/dashboard/dashboard-shortcut.tsx` — marcar no CTA.
- `src/app/(app)/campanhas/client.tsx` — marcar no CTA.
- `src/app/(app)/campanhas/[id]/client.tsx` — marcar nos CTAs de erro/stale.
- `src/components/flow/use-campaign-form.ts` — `verticalEnabled` + pausa efetiva.
- `src/components/flow/campaign-input-form.tsx` — usar pausa efetiva.

Sem migration, RPC, prompt, geração, crédito ou auditoria.

## 7. Testes propostos

**`campaign-page-client-reload.test.tsx` (novo, jsdom)**
1. reload sem marcador → chaves globais preservadas.
2. marcador de campanha nova + reload → chaves globais removidas.
3. navegação normal sem marcador → chaves globais removidas.
4. chave escopada (`campaign_draft:<id>`) nunca é removida pelo clear global.

**`use-campaign-form-local-draft.test.ts` (novo)**
5. draft global 9:16 + imagem → restaura campos, `productImages[].dataUrl` e formato.
6. mesmo draft com `verticalEnabled:false` → 9:16 preservado, pausa efetiva true,
   `handleSubmit`/fetch não chamado.
7. draft 1:1 com `verticalEnabled:false` → sem pausa; body sem `campaignFormat`.

**`campaign-input-form.flag-off-local-draft.test.tsx` (novo)**
8. banner “Novo envio vertical pausado” e botão de revisão desabilitado com OFF.
9. com ON, botão habilitado e sem banner.

**Regressões**
10. `use-campaign-form-restore-format.test.ts`: restore por `campaignId` 9:16/1:1
    inalterado; 1:1 sem chaves.
11. `topbar.test.tsx`: CTA na mesma rota marca intenção antes do reload.
12. `refunded-recovery.test.tsx`: `restoreFrom` continua restaurando sem troca de
    formato.

## 8. Validação manual (após implementação)

Usar **janela anônima/incógnita** ou um perfil separado, com rascunho sintético,
para não tocar no draft atual do responsável:

1. Flag ON; `/campanhas/nova`; 9:16; preencher; revisão; voltar/editar; aguardar
   autosave; recarregar. Conferir campos, imagem e 9:16.
2. Flag OFF pela via auditada; recarregar o mesmo draft. Conferir 9:16, banner e
   botão desabilitado; não confirmar geração.
3. Restaurar flag ON no `finally`.
4. Abrir “Nova Campanha” pelo Topbar e confirmar que o formulário inicia limpo.

## 9. Critério de aceite

- reload preserva; campanha nova limpa; `restoreFrom` preserva escopo;
- 1:1 permanece intacto;
- draft 9:16 com OFF explica e bloqueia, sem troca para 1:1;
- nenhum fetch/geração/crédito/provider nos testes.
