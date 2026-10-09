## Why

Esta change conecta os componentes preparados na F56.2a e a fundação segura/atômica da F56.2b1a em um fluxo entregável **dentro do ciclo da requisição**. Geração, crédito e download passam a funcionar juntos, ainda com flags e autorização `off` e sem habilitar lojas.

A b1b salva a campanha concluída, persistida e recuperável ao retornar ao aplicativo — **não** implementa aprovação humana nem aprovação automática; essa fronteira permanece na F56.3.

**Decisão humana (2026-10-09):** a **execução durável independente da requisição/navegador** (fila/outbox, cron/dispatcher, worker, claim/lease/heartbeat/fencing, retomada automática) **fica fora desta fatia**. O assunto será retomado futuramente, quando houver **Vercel Pro**, mediante **nova investigação** — sem presumir solução aprovada.

## What Changes

- Formulário e roteamento conectados apenas sob elegibilidade server-side; em `off`, sem seletores/campos exclusivos.
- **Geração no ciclo da requisição**, com **limites e falhas tratados** explicitamente (sem prometer continuidade após desconexão).
- **Campanha concluída persistida e recuperável ao retornar ao aplicativo** (persistência do resultado, não retomada de processamento).
- **Briefing, referências/seleções e versões de composição congelados** no snapshot, junto do par modelo/qualidade.
- Orquestração com preflight `complete`, política 2+1, snapshot e histórico append-only.
- **Reenvio do lojista = somente consulta**: se houver arte salva, recupera essa arte; se o resultado continuar desconhecido, **não** chama o modelo novamente (mesma `campaignId + operation_id`).
- **Início de tentativa atômico no banco** (sem fila/cron/worker): duas requisições simultâneas não chamam o provider duas vezes; teto 2+1 por operação.
- Reserva temporária via operação atômica da b1a; `delivered` finaliza consumo; **um crédito por entrega**; **nenhuma cobrança adicional por tentativa técnica**.
- **Falha confirmada sem arte utilizável → `refunded` uma vez.**
- **Resultado desconhecido** (ex.: timeout): **sem repetição cega**, **sem retomada** (nem automática, nem por reenvio) e **sem estorno baseado apenas em timeout**; a UI mostra “Não foi possível confirmar a conclusão desta geração” com referência de suporte e **não** oferece “Gerar novamente” para essa operação.
- **Administrador autorizado resolve pendências por evidência**, com **motivo obrigatório** e **registro auditável das evidências e da transição** (sem dois aprovadores nesta versão): entrega arte existente ou estorna uma vez após confirmar ausência e encerramento. “Fila de atendimento” é **somente lista de pendências, sem execução automática**; **sem re-queue**, nova geração administrativa ou chamada automática ao provider.
- Arte real 1024×1024 em Storage privado e download somente após `delivered`.
- Copy não bloqueante: copy pendente **não** prolonga indefinidamente a entrega da imagem; estados persistidos com feedback seguro; cancelamentos separados; **sem ação de retry**.
- Diagnóstico `IMG-001` e instrumentação por tentativa; legado preservado.
- **UI-SPEC obrigatória antes** do planejamento dos controles conectados.
- **Testes isolados** com provider simulado e Postgres/Storage locais reais.

## Capabilities

### New
- `product-1-1-generation-orchestration`
- `product-1-1-artifact-delivery`
- `product-1-1-copy-recovery`

### Modified
- `product-1-1-flow-activation` (conexão do roteamento após a fundação b1a)
- `product-1-1-intent-background-selection`
- `product-1-1-campaign-credit-billing` (consumo da operação atômica, um crédito por entrega e falha/resultado desconhecido)
- `image-generation-config-snapshot`
- `image-generation-failure-policy`
- `image-generation-support-reference`
- `image-generation-model-pair-config`
- `image-generation-instrumentation`

## Critérios de Aceite

1. Sem elegibilidade, controles/campos novos não são montados/enviados; POST revalida elegibilidade e payload incompatível é recusado antes de crédito.
2. Snapshot é persistido antes da reserva/provider; briefing, referências/seleções e versões de composição ficam congelados; tentativas são append-only e reconstruíveis.
3. Preflight exige pricing `complete` para principal e fallback; política permite até 2+1 e não chama revisor automático.
4. Reserva temporária reduz saldo disponível; só `delivered` torna o crédito consumo definitivo e libera download; um crédito por entrega; tentativas técnicas não geram cobrança adicional.
5. **Duas requisições simultâneas não chamam o provider duas vezes**: início de tentativa atômico no Postgres, sem fila/cron/worker; o teto 2+1 pertence à operação inteira, não a cada reenvio.
6. **Reenvio do lojista apenas consulta a operação**: se houver arte salva, recupera essa arte; se o resultado continuar desconhecido, não chama o modelo novamente. Não inicia tentativa, geração nem cobrança.
7. Falha confirmada sem arte utilizável gera `refunded` uma vez. Resultado desconhecido não gera repetição cega nem estorno baseado apenas em timeout; a UI mostra “Não foi possível confirmar a conclusão desta geração” com referência de suporte e **não** oferece “Gerar novamente” para essa operação. **Administrador autorizado** resolve por evidência, com **motivo obrigatório** e **registro auditável** (sem dois aprovadores): entrega arte existente ou estorna uma vez após confirmar ausência e encerramento; **sem re-queue** nem nova geração administrativa; a fila é apenas lista de pendências.
8. Campanha concluída fica persistida e recuperável ao retornar ao aplicativo (persistência do resultado; **sem** retomada de processamento interrompido).
9. Arte 1024×1024 real em Storage privado, caminho imutável; download somente após `delivered`; campanhas legadas conservam seu download.
10. Copy pendente não prolonga indefinidamente a entrega; estado persistido com feedback seguro; cancelamentos separados; sem retry nesta change.
11. Instrumentação, custo por tentativa, `IMG-001` e diagnóstico durável funcionam sem expor motivo interno.
12. Testes isolados com provider simulado e Postgres/Storage locais reais; nenhuma prova depende de bypass operacional de autorização.
13. B1b mantém flags/autorização `off`, nenhuma loja habilitada, sem chamada paga/`db push`/deploy. UI-SPEC criada antes do planejamento dos controles conectados.

## Comportamento quando a conexão cai (explícito)

- A geração roda **no ciclo da requisição**; o navegador acompanha, mas **não** controla a execução durável (que não existe nesta fatia).
- **Não** SHALL ser afirmado que a desconexão **cancela necessariamente** a chamada ao provider, **nem** que o processamento **continuará garantidamente**. Comportamento real: a chamada já despachada pode seguir ou ser interrompida pelo runtime; **não há garantia** em nenhum dos sentidos.
- Se a conexão cair e a execução **não** concluir, a campanha fica **pendente/limitada**. O **reenvio do lojista apenas consulta** a operação: recupera arte salva se existir; se o resultado continuar desconhecido, **não** chama o modelo novamente; não inicia tentativa, geração nem cobrança.
- **Limites do fluxo por requisição:** teto de duração da função/rota, timeout próprio da chamada ao provider, e política 2+1 (por operação). Ao exceder: falha confirmada → `refunded` uma vez; resultado desconhecido → pendente, sem estorno por timeout.

## Diferido (referência, não requisito)

- A **execução durável** (fila/outbox, cron/dispatcher, worker, claim/lease/heartbeat/fencing, continuidade após fechar a página, retomada automática) **não** é requisito nem pré-condição desta fatia.
- A investigação read-only está preservada em **`D6.1-DURABLE-EXECUTION-INVESTIGATION.md`** como **referência DIFERIDA**; será retomada **quando houver Vercel Pro**, mediante **nova investigação**, **sem presumir solução aprovada**.

## Dependências e fronteiras

- **Limitação aceita (somente na entrega inativa da b1b) + GATE obrigatório da b2:** não há, no escopo aprovado, **fonte operacional comprovada** de encerramento; claims `in_progress` residuais permanecem **bloqueados** para resolução (**sem estorno**, **sem nova geração**, **sem retomada**); a b1b **não** declara **recuperabilidade completa** e **evidência simulada não é prova operacional**. O piloto e a habilitação de lojas na **b2** permanecem **BLOQUEADOS** até comprovar uma **estratégia operacional segura de resolução de claims residuais**; confirmar **plano/limites** (Vercel Hobby / Supabase Free **informados**; limites **não verificados**) pode **sustentar** a estratégia, mas, **isoladamente, NÃO satisfaz o gate**, e **evidência simulada não substitui comprovação operacional**. A b1b inativa pode ser concluída com a limitação documentada; o bloqueio não impede a preparação documental da b2.
- Depende da F56.2b1a fechada e verificada separadamente; reutiliza sua RPC transacional, identidade canônica server-side, escrita RPC-only e idempotência.
- Preserva o par principal `gpt-image-2.5-sunburst / medium`, fallback `gpt-image-2 / medium` e a política de até 2+1 tentativas.
- F56.2b2 permanece responsável por retry de copy, E2E completo, piloto controlado pago e **autorização habilitadora**.
- F56.3 continua aprovação/reprovação/correção — a b1b não aprova nem reprova.
- Tokens GSD: `56.2.1` (b1a); **`56.2.2` (b1b)**; `56.2.3` (b2).

## Checkpoint

Revisão humana antes de implementação/plano GSD. Nenhuma loja habilitada nesta change. Esta reconciliação é documental: não cria change, não inicia GSD, não implementa, não roda migration, não chama provider, não ativa flags, não faz deploy, commit ou push.
