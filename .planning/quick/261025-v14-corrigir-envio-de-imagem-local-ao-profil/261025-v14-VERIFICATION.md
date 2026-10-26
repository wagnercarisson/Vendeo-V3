---
phase: 261025-v14
plan: 01
type: verification
status: gap_closure_complete
verified_at: 2026-10-25
---

# Verificação — quick 261025-v14 (gap closure)

## Escopo

Complemento da **mesma** quick `261025-v14`, sem nova quick/plano/fase/change.
Fechamento de duas lacunas de apresentação encontradas na revisão e no teste
manual, sem alterar regras de negócio.

## GAP 1 — aviso antigo após recuperação

**Problema:** o aviso de direção era exibido apenas por
`redirectMessage === "needs-visual-direction"`, então permanecia após o
realinhamento bem-sucedido e a prontidão ficar pronta.

**Correção:**
- `StoreIdentityForm` passou a manter `readinessStatus` (`loading` / `ready` /
  `unavailable`) e só mostra o aviso quando:
  - `redirectMessage === "needs-visual-direction"`;
  - a prontidão terminou de carregar (`ready`);
  - há `brand_profile` confirmado em `missing`;
  - não existe banner específico de falha de direção ativo.
- `ready=false` isolado não basta: pendência apenas fiscal não mostra o aviso de
  direção.
- Carregamento, erro HTTP, rejeição e o fallback server-side de prontidão
  (razão “Não foi possível verificar a prontidão da loja…”) não são tratados
  como prova de ausência de direção.
- O banner específico de falha (`DirectionPendingBanner` com código de suporte)
  foi preservado.
- Após realinhamento/approvação bem-sucedidos, a reconsulta de readiness é
  sinalizada como `loading` antes do refetch, removendo o aviso sem reload,
  sem navegação e sem apagar parâmetros.
- Se outra pendência (fiscal) permanecer, o aviso de direção não reaparece e o
  formulário não apresenta campanhas como liberadas.

**Evidências offline:**
- `GAP 1 — aviso de direção derivado da prontidão` em
  `src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx`:
  URL + prontidão completa; pendência apenas fiscal; `brand_profile`
  confirmado; carregando; fallback/erro; realinhamento com prontidão atualizada
  e URL inalterada; outra pendência após recuperação.

## GAP 2 — código ausente no erro de conexão do modal

**Problema:** o `catch` de `handleRetryBP` em
`VisualSignatureApprovalModal` substituía a mensagem por um texto genérico sem
o código público já conhecido.

**Correção:**
- `support-codes.ts` ganhou guarda de código conhecido, mensagem de conexão e
  fallback seguro de realinhamento.
- No erro de conexão, o modal preserva o código conhecido e exibe a mensagem
  canônica do catálogo uma única vez; sem código conhecido, exibe mensagem
  segura sem inventar `DVAP01`/`DVRE01`, referência ou classificação.
- O mesmo texto é propagado via `onDirectionPending` para o formulário.
- O `handleDirectionRealign` do formulário também deixou de inventar `DVAP01`
  em falha de conexão/falha funcional sem código; usa o código conhecido ou uma
  mensagem segura.
- UUID, erro bruto, URL, stack trace e credenciais não são exibidos.
- Nenhuma referência é persistida para falha de rede sem resposta do servidor.
- Assinatura aprovada, pendência e botão de realinhamento permanecem; sucesso e
  política de retries não foram alterados.

**Evidências offline:**
- Testes em `src/components/flow/__tests__/visual-signature-approval-modal.test.tsx`:
  conexão com código conhecido (código uma vez, sem UUID, mensagem propagada) e
  conexão sem código conhecido (sem código/referência inventados).
- `onDirectionPending` é a fronteira de propagação para o formulário; os testes
  integrados existentes continuam cobrindo a atualização do banner.

## Arquivos alterados neste complemento

**Implementação**
- `src/components/flow/store-identity-form.tsx`
- `src/components/flow/visual-signature-approval-modal.tsx`
- `src/lib/visual-signature/support-codes.ts`

**Testes**
- `src/components/flow/__tests__/store-identity-form.direction-pending.test.tsx`
- `src/components/flow/__tests__/visual-signature-approval-modal.test.tsx`

## Validação executada

- Focados: **64/64** testes / 3 arquivos — verdes
  (`store-identity-form.direction-pending`, `visual-signature-approval-modal`,
  `direction-pending`).
- Regressão relacionada: **721/721** testes / 67 arquivos — verdes
  (`src/lib/visual-signature`, rotas de brand-profile/visual-signature e
  `src/components/flow`).
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `git diff --check`: sem erros (apenas avisos de normalização LF/CRLF do Git).

## Natureza da evidência

- Esta verificação é **offline**, com mocks/fakes de `fetch` e de prontidão.
- A validação humana anterior confirmou o fluxo real de falha/realinhamento,
  mas **não** houve nova validação humana, em banco, em provider ou em produção
  neste complemento.
- Nenhum acesso a banco local/remoto, Docker, Supabase CLI ou provider foi
  realizado; nenhuma imagem foi gerada, nenhuma migration foi aplicada, nada
  foi feito merge/push/deploy.

## Limitações

- A detecção do fallback de prontidão usa o prefixo de razão já emitido por
  `getStoreReadiness`; não foi criada uma nova classificação/rota de prontidão.
- O aviso de direção continua dependendo do parâmetro de URL para existir, mas
  agora a prontidão é a fonte da verdade e o parâmetro não é apagado.
- A mensagem de conexão sem código é uma apresentação segura; não identifica
  uma ocorrência persistida nem cria suporte automático.
- A suíte completa do projeto não é gate válido neste ambiente (integração
  exige PostgreSQL/Docker e há falhas preexistentes); não foi declarada verde.

## Status

**Parado para revisão do Codex antes de publicação.**
