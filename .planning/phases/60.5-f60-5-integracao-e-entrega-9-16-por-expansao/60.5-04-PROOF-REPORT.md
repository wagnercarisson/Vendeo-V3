# F60.5 / 60.5-04 — PROVA REAL INTEGRADA 9:16 POR EXPANSÃO

**Status:** failed — **0 chamadas pagas; estorno único**
**Início:** 2026-11-13T21:06:34.796Z
**Fim:** 2026-11-13T21:06:37.441Z
**Terminal:** error

## Autorização

- Modo: `authorize-server`
- Orçamento autorizado: US$ 0.12
- Máximo de chamadas pagas: 3
- Sem retry/fallback; uma única operação.

## Preflight

- Status: **ready** (ready)
- PASS — Homolog existente: API 127.0.0.1:57781; DB 127.0.0.1:57782/postgres; producao nao consultada
- PASS — Autorizacao explicita: approved; budget=0.12; maxPaidCalls=3
- PASS — Credencial de produto: OPENAI_API_KEY presente; OPENAI_BENCH_API_KEY nao e usada silenciosamente
- PASS — Credenciais Supabase: service role presente
- PASS — Campanha-fonte existente e pertencente: status=ready; store=3dc7d274-0b57-45ba-883a-7b235056feda
- PASS — Imagens de produto legiveis: images=2
- PASS — Identidade acessivel ou fallback explicito: identityAsset=homolog-bucket
- PASS — Configuracao ativa do par: gpt-image-2.5-sunburst/medium; fallback gpt-image-2/low
- PASS — Pricing base completo: base=0.044
- PASS — Pricing expansao completo: expansion=0.036
- PASS — Orcamento autorizado cobre a estimativa: authorized=0.12; estimate=0.0805
- PASS — Campanha/operacao/artefatos alvo ausentes: campaign=absent; operations=0; artifacts=0; credit=0; copy=0
- PASS — Bucket F60.1 acessivel: campaign-internal-artifacts
- PASS — Codigo aceito e SHAs registrados: phaseBaseSha=35b0aa4e; acceptedHead=e35b5a1d
- PASS — Responsavel pelo aceite humano definido: humanAcceptanceOwner=operator

## Preparação da campanha

- Campanha: `98925e2c-5032-4544-8ae8-06fe6a4a7ebd`
- Operação: `68264a54-66c4-41ec-bc6f-a5961820c8fb`
- Origem: `9_16_two_stage`
- Inputs verificados: 3
- resumeContext completo: true

## Execução e chamadas

- Chamadas pagas: 0 (teto 3)
- Custo observado: US$ 0
- Custo dentro do teto: sim
- Invocações gratuitas: 0

## Entrega

- Vertical: ausente
- Checksum verificado: não
- Miniatura derivada: ausente
- Copy: não concluída/sem bloqueio
- Crédito: status=refunded; reservas=1; confirmações=0; estornos=1
- beginPublication antes da confirmação: not_observed

## Aceite técnico

- Resultado: **FAIL**
- FAIL — Terminal resultado entregue: error:generation_failed
- FAIL — Campanha projetada ready: status=error
- FAIL — Vertical persistido 1080x1920 JPEG: missing
- FAIL — Checksum do vertical confere: mismatch
- FAIL — Miniatura derivada presente: missing
- PASS — Nenhum vertical integral em campaign-images: ok
- PASS — Copy entregue ou falha nao bloqueante: copyRows=0; completed=false
- PASS — Credito: reserva/confirmacao coerentes: status=refunded; amount=1
- PASS — Custo disponivel e dentro do teto: calls=0; observed=0; budget=0.12
- PASS — Chamadas pagas <= 3: calls=0
- PASS — generation_events correlacionados: events=0
- PASS — Campanha-fonte/imagens preservadas: snapshot=true; identity=true; images=true; status=true
- PASS — Inputs enviados e verificados: uploadsVerified=3

## Análise da falha

- `readSquareBaseFrozenState` devolveu `absent` (primeira execução).
- `reconstructFirstExecution` devolveu `{ ok: false, reason: "resume_context_malformed", definitive: true }` **antes** de adquirir etapa ou chamar provider.
- Causa raiz: `reconstructFirstExecution` compara `resumeContext.briefingText` (string `JSON.stringify` gravada na preparação) com `JSON.stringify(briefing)` relido do `campaigns.input_snapshot`. O round-trip JSONB do PostgreSQL reordena as chaves; o conteúdo é semanticamente idêntico, mas as strings não são iguais. Evidência em `evidence/diagnosis-resume-context.json`.
- Consequência: nenhuma claim, nenhum `generation_events`, nenhuma chamada paga; 1 reserva e **1 estorno único**; campanha-alvo em `error`; campanha-fonte/imagens preservadas; sem vertical/copy/miniatura.
- Ação: **não repetir** a operação nem criar outra sob esta autorização. O aceite humano fica bloqueado até a correção da comparação canônica e uma **nova autorização** para uma nova operação.

## Aceite humano — BLOQUEADO

Abrir o vertical original local (não a miniatura) e conferir:
1. enquadramento 9:16, nitidez, produto, preço, selo, validade e aviso obrigatório;
2. copy entregue contra o briefing congelado;
3. miniatura do card, sem uso como arte de entrega;
4. crédito: 1 reserva e 1 confirmação, sem segundo débito.

Arquivo local: `-`

## Não escopo

- produção, deploy, flag global, migration, reset, merge, push;
- nova operação, retry, fallback ou segunda reserva;
- 60.5-05 e ativação permanente.

## Remediação offline (pós-falha)

A comparação de `briefingText` foi corrigida para JSON canônico e as regressões
offline foram acrescentadas. Detalhes e gates em `60.5-04-REVIEW-FIX.md`.
Nenhuma nova operação/chamada foi executada; a operação estornada permanece
preservada e não será reutilizada.

