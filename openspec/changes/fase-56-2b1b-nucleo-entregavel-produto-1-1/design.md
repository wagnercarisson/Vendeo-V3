## Contexto

F56.2b1b depende do fechamento e verificação independentes da F56.2b1a, inclusive do gate de isolamento/schema aprovado e da operação atômica de reserva/estado testada. A b1b não concede autorização; ela conecta o fluxo end-to-end sem habilitar loja.

**Contratos implementados que a b1b SHALL preservar (b1a):**

- Identidade canônica server-side `resolveCanonicalInstanceIdentity()` = `new URL(NEXT_PUBLIC_SUPABASE_URL).host`; entrada do cliente é rejeitada; fail-closed.
- Escrita **RPC-only**: tabelas de autorização e de crédito concedem apenas `SELECT` à `service_role`; mutações só por RPC `SECURITY DEFINER` com `search_path=''`.
- Operação de crédito idempotente por `campaignId + operation_id` (`product_1_1_campaign_credit_operations`), estados `reserved → art_uploaded → delivered | refunded`; `delivered` terminal; `refunded` uma vez; reconciliação **adia** a resolução.
- Exclusão de estágio habilitador nas RPCs operacionais; estado operacional `off`.

**Runtime/deploy atual (evidência):** geração roda **dentro de uma única requisição HTTP** em `src/app/api/campaign/generate-image/route.ts` (`export const runtime = "nodejs"`, sem `maxDuration`), com streaming NDJSON; **sem** fila/worker/outbox e **sem** cron de geração.

**Decisão humana (2026-10-09):** a **execução durável independente da requisição/navegador** fica **fora** desta fatia e será retomada futuramente, quando houver **Vercel Pro**, mediante nova investigação. A investigação read-only permanece como **referência DIFERIDA** (`D6.1-DURABLE-EXECUTION-INVESTIGATION.md`), **não** como requisito ou pré-condição.

## Decisões

### B1B-D1 — Elegibilidade controla UI e POST

Servidor decide elegibilidade com leitura válida das duas flags, uma flag aplicável ao escopo ligada e autorização independente vigente. O formulário só monta seletores e só envia campos Produto 1:1 quando elegível. O POST revalida; revogação entre renderização/envio gera erro seguro anterior a crédito, sem fallback que descarte campos.

### B1B-D2 — Geração no ciclo da requisição; reenvio é consulta

A geração SHALL rodar **dentro do ciclo da requisição**, com limites explícitos (teto de duração da função/rota, timeout próprio da chamada ao provider e política 2+1) e falhas tratadas. **Não** existe execução durável nesta fatia. O navegador acompanha o progresso, mas não há garantia de continuidade do processamento após desconexão.

O reenvio do lojista SHALL ser **somente consulta** à operação existente (`campaignId + operation_id`): se houver arte salva, recupera essa arte; se o resultado continuar desconhecido, **não** chama o modelo novamente. O reenvio **não** inicia tentativa, não duplica geração nem cobrança. O teto 2+1 pertence à **operação inteira** (persistido), **não** a cada reenvio.

### B1B-D3 — Snapshot congelado (briefing, referências, composição, modelo/qualidade)

O snapshot persistido antes da reserva/provider SHALL congelar: briefing, referências/seleções (intenção, direção de fundo, imagens), **versões de composição** (base, compositor, políticas) e o par principal/fallback modelo+qualidade com versão/origem. A execução SHALL NOT reler configuração mutável; correção/regeração da mesma campanha reutiliza o snapshot original.

### B1B-D4 — Reserva temporária, um crédito por entrega, sem cobrança por tentativa técnica

Usar a operação Postgres atômica da b1a. `reserved` reduz saldo disponível temporariamente; não é consumo definitivo. `delivered` efetiva **exatamente um** crédito e é terminal; `refunded` restaura a reserva uma vez. As tentativas da política 2+1 e qualquer retry técnico compartilham a **mesma identidade** e **não** criam reservas nem cobranças adicionais.

### B1B-D5 — Falha confirmada × resultado desconhecido (resolução por suporte)

- **Falha confirmada sem arte utilizável:** a operação é estornada (`refunded`) **uma vez**.
- **Resultado desconhecido** (ex.: timeout de chamada): **não** repete cegamente e **não** estorna com base apenas em timeout. A operação fica **pendente/limitada**, sem **nenhuma** retomada — nem automática, **nem por reenvio do lojista** (que é somente consulta, D2).
- **UI:** exibir **“Não foi possível confirmar a conclusão desta geração”** com a **referência de suporte**; **não** oferecer **“Gerar novamente”** para essa mesma operação.
- **Suporte/admin (resolução por evidência, sem re-queue):** a resolução de uma pendência exige um **administrador autorizado**, **motivo obrigatório** e **registro auditável** das **evidências** e da **transição**. Pode **entregar a arte existente** (quando houver arte íntegra) ou **estornar uma vez** após **confirmar ausência de arte e encerramento da execução**. **Não** exige dois aprovadores nesta versão.
- **“Fila de atendimento” é somente uma lista de pendências**, sem execução automática. Permanecem **proibidos**: re-queue, nova geração administrativa e chamada automática ao provider.

### B1B-D6 — Entrega e arte

Persistir arte real 1024×1024 sob caminho imutável em `campaign-images` (bucket privado). Download requer fluxo persistido novo, objeto íntegro e operação `delivered`; upload sozinho (`art_uploaded`) não libera acesso. Dimensões reais persistidas correspondem ao arquivo. Campanhas legadas mantêm regras próprias; a F37 não governa o novo fluxo.

### B1B-D7 — Persistência da campanha concluída

A campanha concluída SHALL ser persistida e recuperável **ao retornar ao aplicativo** (persistência do resultado). Isso **não** é retomada de processamento: se a execução não concluiu (pendente/limitada), a UI exibe o estado persistido e o **reenvio do lojista apenas consulta** a operação — **não** retoma processamento nem inicia nova tentativa. A UI reflete o estado persistido sem controlar a execução.

### B1B-D8 — Copy e instrumentação

Falha de copy é persistida e **não** bloqueia download da arte `delivered`; **sem ação de retry** nesta fatia. Copy pendente **não** prolonga indefinidamente a entrega da imagem: a imagem é entregue independentemente do estado da copy, e os estados são persistidos com feedback seguro. Cancelamentos são tratados separadamente (não confundidos com falha de copy). Cada tentativa emite envelope/custo; falhas produzem `IMG-001` e diagnóstico durável sanitizado, correlacionável apenas por suporte/admin.

### B1B-D9 — Testes por harness isolado

Os testes SHALL rodar em **harness isolado** com **provider simulado** e **Postgres/Storage locais reais** (instância descartável já usada pela b1a), sem chamada paga e **sem bypass operacional de autorização** (nenhuma concessão via API/RPC operacional; estágios por fixtures controladas + função pura). A prova de arte usa **upload real** no Storage local.

### B1B-D10 — UI-SPEC antes do planejamento conectado

Como a b1b conecta controles visíveis ao lojista (seletores elegíveis, estados do fluxo, feedback de copy), uma **UI-SPEC** SHALL ser criada — seguindo `openspec/design-system/MASTER.md` — **antes** do planejamento dos controles conectados (F56.2a/b1a pularam UI-SPEC por não montar interface). A UI-SPEC pode ser preparada separadamente, **sem** liberar o núcleo.

### B1B-D11 — Estado desligado e fronteira F56.3

Implementar e testar o ramo, mas manter as duas flags e autorização em `off`; nenhum comércio é habilitado. A b1b salva a campanha pronta, mas **não** implementa aprovação humana nem aprovação automática — aprovação/reprovação/correção/cobrança por correção permanecem na F56.3. Retry de copy, E2E completo, piloto pago e autorização habilitadora permanecem na b2.

### B1B-D12 — Início de tentativa atômico no banco (sem fila/cron/worker)

Duas requisições simultâneas SHALL NOT chamar o provider duas vezes para a mesma operação. A reserva financeira idempotente da b1a, **isoladamente, NÃO garante isso**. SHALL existir um **controle atômico de início de tentativa no Postgres** — por exemplo CAS/`INSERT ... ON CONFLICT` sobre `(campaign_id, operation_id, attempt_seq)` ou um lock por operação — que permita **um único início de tentativa por vez**, **sem** fila, cron ou worker. Quem perde a corrida **aguarda/consulta** a operação e **NÃO** dispara nova chamada. O teto 2+1 é contado na **operação inteira** (persistido), não por reenvio.

## Diferido (referência, não requisito)

A execução durável independente da requisição/navegador — fila/outbox de geração, cron/dispatcher e worker, claim/lease/heartbeat/fencing, continuidade após fechar a página, retomada automática e a prova executável da candidata A — **não** pertence a esta fatia. Fica preservada como **referência DIFERIDA** em `D6.1-DURABLE-EXECUTION-INVESTIGATION.md`, a ser retomada **quando houver Vercel Pro**, mediante **nova investigação**, **sem presumir solução aprovada**.

## Fora de escopo

Execução durável (diferida, acima); fundação de autorização e RPC atômica (b1a); retry de copy, E2E completo e piloto controlado (b2); aprovação/reprovação/correção (F56.3); migration remota, `db push` e deploy.

## Riscos / trade-offs

- **Desconexão durante a geração** → sem garantia de continuidade; a campanha pode ficar pendente/limitada; o reenvio **apenas consulta** a operação e **não** há retomada (limitação explícita).
- **Duas requisições simultâneas** → controladas pelo **início de tentativa atômico no banco** (D12), que impede chamada dupla ao provider; a reserva financeira sozinha não bastaria.
- **Cobrança dupla em reenvio/retry** → identidade única `campaignId + operation_id`; um crédito por entrega.
- **Estorno indevido por timeout** → proibido: resultado desconhecido **não** estorna com base só em timeout.
- **Reexecução cega** → proibida: reenvio é consulta; resolução de pendência só por suporte/admin com evidência, sem re-queue.
- **Regressão no legado** → fronteira produtiva preservada e testes de não-regressão.
