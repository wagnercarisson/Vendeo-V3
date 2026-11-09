# Phase 60: F60 — Controle da operação 9:16 em duas etapas e integração financeira — Context

**Gathered:** 2026-11-09
**Status:** Ready for planning
**Source:** `openspec/changes/product-9-16-two-stage-operation-control/` (proposta, design, specs e tasks aprovados em revisão; validação `--strict` OK)
**Phase number:** 60 (registrado no `.planning/ROADMAP.md`; execução ainda não autorizada)

<domain>
## Phase Boundary

Primeira fatia do novo fluxo 9:16: **controle da operação em duas etapas** (`base` quadrada e `expansion` vertical) e **conexão com os serviços financeiros existentes**, com uma **prova transacional bloqueante em homolog** antes da implementação completa do módulo.

Não há geração de imagem, composição de prompt, expansão real, armazenamento completo de artefatos, UI, flag, rota pública, cron, fila ou worker. O caminho incompleto não é disponibilizado ao lojista.

O OpenSpec é a fonte da verdade. Este CONTEXT é uma ponte compacta: não duplica proposal, design ou specs.
</domain>

<decisions>
## Implementation Decisions (locked)

### Contrato financeiro
- Um pedido 9:16 = **1 crédito**. Duas etapas pagas dentro da mesma operação.
- A reserva ocorre **uma única vez** na abertura, usando `product_1_1_reserve_credit_operation` (que chama `reserve_credit` na mesma transação).
- Conclusão da `base` **não** entrega, **não** confirma crédito e **não** altera o status financeiro.
- A `expansion` **não** reserva outro crédito.
- A entrega vertical confirma o único crédito (`delivered`).
- Falha definitiva sem entrega estorna **uma vez**.
- Resultado desconhecido **não** autoriza repetição nem estorno cego.
- Tentativas/chamadas ao provider **não** são créditos.

### Autoridade financeira e origem
- `public.product_1_1_campaign_credit_operations` é a **autoridade única** para `reserved`, `art_uploaded`, `delivered` e `refunded`.
- O módulo operacional **não** mantém segunda verdade terminal; estados financeiros são derivados e revalidados sob a trava C4 em toda transição.
- Encerramento/estorno administrativo prevalece: nova tentativa e resposta tardia são recusadas mesmo com registro operacional atrasado.
- Cada operação pertence a exatamente uma origem (`legacy` ou `9_16_two_stage`); as views de leitura aplicam anti-join para não duplicar operações/desfechos.

### Concorrência e autorização
- Ordem de travas: advisory de identidade (`request_id`) → `SELECT ... FOR UPDATE` na linha de crédito (C4) → linha de controle.
- Índice único parcial: no máximo uma tentativa `in_progress` por `(campaign_id, operation_id)`.
- `request_id` único por operação: reenvio devolve o mesmo claim.
- **Consulta ≠ autorização:** vencedor recebe `authorization='execute'`; reenvio recebe `query_only` e não executa. O `attempt_token` identifica a tentativa, não autoriza execução.
- A finalização de tentativa é CAS por token + status, revalidando a linha financeira.

### Política de tentativas
- **Base:** manter 2 principal + 1 fallback (máx. 3 chamadas), com as regras atuais de `image-generation-failure-policy`.
- **Expansão:** inicial + **uma** repetição automática, somente para falha transitória comprovada (`rate_limit`, indisponibilidade/capacidade explícita ou falha comprovadamente anterior ao envio).
- **Timeout, abort ou perda de comunicação após possível envio = resultado desconhecido**, mesmo com `retryable=true`; sem repetição automática.
- Limites lidos do banco, preservados entre requisições e retomadas.

### Leitura compartilhada e auditoria
- Views de união: `product_generation_active_claims_v` e `product_generation_operation_outcomes_v`, recortadas por origem canônica.
- Função `product_abandon_residual_attempts(campaign_id, operation_id)` chamada sob a trava C4.
- Ajustes compartilhados localizados em: `product_1_1_close_failed_operation`, `admin_resolve_product_1_1_pending`, `product_1_1_get_campaign_operation_by_campaign`, `SupabasePendingOperationsRepository.readClaims` e superfície `src/app/api/admin/product-1-1-pending/route.ts`.
- Preservar assinaturas vigentes, fence de publicação e frescor de epoch. Suíte de compatibilidade 1:1 / 9:16 direto obrigatória.
- Auditoria reutiliza `product_1_1_pending_resolution` com metadado de fluxo/etapa; não ampliar o CHECK compartilhado.

### Checkpoint e ambiente
- **A prova transacional em homolog é o primeiro plano e é bloqueante.** A implementação do módulo (planos seguintes) só começa após revisão e aprovação explícita do resultado da prova.
- Homolog `vendeo-homolog` (`supabase_db_vendeo-homolog`, `127.0.0.1:57782`, banco `postgres`), **não descartável**, mediante autorização específica.
- IDs exclusivos de teste (`p916test-`) isolam dados, **não** as RPCs compartilhadas. A prova exige janela de exclusividade registrada e confirmação de ausência de uso concorrente.
- Snapshot S0 somente leitura antes/depois; limpeza limitada aos IDs criados; `credit_transactions` é append-only.
- Retenção: remoção imediata dos dados de teste após a prova, limitada aos IDs criados; evidências JSON/MD permanecem na fase.
- Janela de exclusividade: coordenada e registrada antes da prova, cobrindo aplicação, prova e limpeza; sem prazo arbitrário fixo.
- Desfecho agregado: primeiro `failed`/`unknown` persistido é imutável e governa; replay divergente = `operation_identity_conflict`.
- Migrations futuras com timestamp UTC real `YYYYMMDDHHmmss`, unicidade verificada; `REVERT` manual documentado.
- Nenhuma migration é criada ou aplicada neste planejamento.

### Preservação do produto (não negociável)
- Não alterar o significado de `delivered`.
- Não alterar a cobrança atual.
- Não refatorar os orquestradores atuais; não copiar o orquestrador existente.
- Não modificar contratos compartilhados por conveniência. Adaptações compartilhadas só nos pontos listados, com justificativa e testes de compatibilidade.
- 1:1 e 9:16 direto preservados.
</decisions>

<requirements>
## Phase Requirements (derivados do OpenSpec)

| ID | Origem | Critério |
|---|---|---|
| REQ-60-01 | operation-control | Identidade durável `(campaign_id, operation_id)` com etapas `base` e `expansion` |
| REQ-60-02 | operation-control | Execução única; vencedor `execute`, reenvio `query_only` |
| REQ-60-03 | operation-control | Base concluída não entrega nem confirma; continuidade sem reexecutar base |
| REQ-60-04 | operation-control | Limite da expansão (2) e política da base (2+1); timeout = desconhecido |
| REQ-60-05 | operation-control | `unknown` imutável, sem repetição/estorno cego, resolução segura |
| REQ-60-06 | operation-control | Resposta tardia após encerramento não produz efeito |
| REQ-60-07 | operation-control | Idempotência por `request_id`; conflito em divergência |
| REQ-60-08 | financial | 1 crédito; expansão sem reserva; confirmação só na entrega vertical |
| REQ-60-09 | financial | Estorno único em falha definitiva sem entrega |
| REQ-60-10 | financial | Autoridade financeira única; estados derivados; admin prevalece |
| REQ-60-11 | financial | Encerramento/pendências reconhecem a execução nova |
| REQ-60-12 | financial | Origem canônica sem duplicação/desfechos conflitantes |
| REQ-60-13 | financeiro/orchestration | Sem ledger paralelo; 1:1 e 9:16 direto preservados |
| REQ-60-14 | viability-proof | Prova bloqueante em homolog com os 13 cenários e isolamento |
| REQ-60-15 | viability-proof | Separação local/homolog/produção; prova não é aceitação produtiva |
</requirements>

<out_of_scope>
## Out of Scope

- Geração real de copy ou imagem; prompt; diretores.
- Expansor de IA, preparação 1024→1152, exportação.
- Armazenamento completo/artefato vertical, miniaturas, download.
- UI, seletor de formato, aquisição de formatos, entrega dupla.
- Flag, ativação, deploy, produção.
- Cron, filas, workers, limpeza automática.
- Refatoração financeira genérica ou unificação do legado.
</out_of_scope>

<canonical_refs>
## Canonical References

- `AGENTS.md`
- `docs/fluxo-de-desenvolvimento.md`
- `openspec/changes/product-9-16-two-stage-operation-control/proposal.md`
- `openspec/changes/product-9-16-two-stage-operation-control/design.md`
- `openspec/changes/product-9-16-two-stage-operation-control/specs/**`
- `openspec/changes/product-9-16-two-stage-operation-control/tasks.md`
- `supabase/migrations/20261008000002_f56_2b1a_product_1_1_campaign_credit.sql`
- `supabase/migrations/20261009000001_f56_2b1b_atomic_attempt_start.sql`
- `supabase/migrations/20261015000003_f56_2b2b_pending_read.sql`
- `supabase/migrations/20261016000001_f56_2b2b_publication_fence.sql`
- `src/lib/product-1-1/credit-operation/credit-operation-client.ts`
- `src/lib/product-1-1/pending/pending-operations-repository.ts`
- `src/app/api/admin/product-1-1-pending/route.ts`
- `docs/operations/f56-2b2d-release-runbook.md`
- `docs/operations/backup-runbook.md`
</canonical_refs>
