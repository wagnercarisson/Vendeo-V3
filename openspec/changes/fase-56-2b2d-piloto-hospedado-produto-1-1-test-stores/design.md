# Design — Piloto hospedado do Produto 1:1 em lojas de teste

## Context

Estado verificado (somente leitura, 2026-10-18):

- **Produção (Vercel)**: projeto `vendeo-v3`, plano **hobby**, Fluid `true`, `functionDefaultTimeout=300` (s), `memorySize=2048`, região `iad1`. Deployment de produção `dpl_FE3ppNtc6HYjnH53C7Nr9nvtzqfk`, **commit `cc70e57c`**, **branch `main`** (source `git`), de 2026-10-05.
- **Produção (Supabase)**: `gvbzwihwgzujwsviufgy` (Vendeo-V3), **99 migrations aplicadas**; **30 pendentes** (estado **inicial** — o conjunto definitivo cresce com as novas migrations desta mudança); `pitr_enabled=false`, `walg_enabled=true`, `backups=[]`. Plano **Free informado**: **sem backup restaurável gerenciado**; WAL-G não é tratado como backup restaurável.
- **Local**: fluxo validado em `vendeo-homolog` (ledger 129) com provas de recuperação/segurança de escopo local; piloto pago N=1 aprovado.
- **Bloqueio de ativação**: `isolated_pilot` exige ambiente `isolated` (loopback); a RPC de concessão recusa todo outro estágio habilitador; o gate de gasto bloqueia qualquer estágio ≠ `isolated_pilot`. Logo não há via operacional hoje.

## Goals / Non-Goals

**Goals:**

1. Habilitar o estágio `test_stores` no **ambiente operacional**, alinhando RPC, rota admin e gate de gasto, **sem** remover a barreira global.
2. Definir e comprovar um **orçamento de tempo** compatível com o teto Vercel de 300s, com **margem** para persistência e **tratamento honesto de resultado desconhecido**.
3. Preparar a **publicação com fluxo OFF**: backup **verificável**, conjunto **exato** de migrations, deploy, configuração e verificação do legado.
4. Definir o **menor conjunto de provas hospedadas** de recuperação e segurança, reutilizando as locais.
5. Definir o **piloto manual restrito**, orçamento, monitoramento, critérios de parada e desligamento.

**Non-Goals:**

- **Não** abrir lojas gerais (`all_stores` permanece bloqueado); a abertura geral é mudança futura e separada.
- **Não** implementar F56.3 (aprovação/reprovação/correção).
- **Não** remover o fluxo legado.
- **Não** criar rota pública de simulação nem permitir que o cliente escolha provider simulado.
- **Não** assumir que WAL-G é backup restaurável.

## Decisions

### D1 — Habilitar `test_stores` no ambiente operacional (ajuste mínimo e aditivo)

A matriz de decisão já permite `stage="test_stores"` + `scope="test_stores"` + `environment="operational"`; faltam três pontos, resolvidos aditivamente:

1. **RPC de concessão** (sucessora de `20261017000001`): conceder também `test_stores`+`test_stores`, **recusando** `all_stores` e qualquer `scope='all_stores'`. Auditoria, idempotência, append-only e barreira global inalteradas.
2. **Rota admin** `product-flow-authorizations`: aceitar o envelope `test_stores`+`test_stores`; manter 403 para escopo geral.
3. **Gate de gasto** (`resolve-pilot-spend-gate`): armar (`armed`) para `test_stores` quando a loja é de teste e as flags são válidas; manter `all_stores`/geral bloqueado.

*Alternativas:* (a) reutilizar `isolated_pilot` no operacional — **rejeitada** por exigir loopback e por expandir `isolated_pilot`; (b) novo subsistema de autorização por loja — **rejeitada** por ampliar superfície. **Decisão:** ajuste mínimo na via existente, sem allowlist por loja.

### D2 — Orçamento de tempo (300s da plataforma)

Fato: o teto da plataforma é **300s** e o timeout interno atual é **300s** → **margem zero**; o kill de plataforma é **não graceful**.

**Decisão:** adotar um **deadline global comprovado**, com timeout interno **estritamente menor** que o teto (proposta: **≤ 240–270s**) e **margem para persistência cooperativa**. O deadline SHALL ser provado por teste; **não** se promete que a última escrita ocorre após um kill. Um kill abrupto **pode** impedir a última escrita; nesse caso, o **estado durável anterior** (último commit conhecido) SHALL permanecer recuperável. **Não** se inventa `unknown` persistido nem ausência de arte: se a persistência do `unknown` falhar, o estado anterior é o que vale. Alternativa rejeitada: manter 300s==300s (margem zero).

### D3 — Publicação com fluxo OFF e backup verificável

**Decisão:** a publicação ocorre em ordens separadas e autorizadas: (i) **backup verificável de banco e Storage**; (ii) **migrations do conjunto definitivo**; (iii) **deploy** (fluxo permanece OFF); (iv) **configuração** (catálogo/pricing/par); (v) **verificação do legado**.

- **Ressalva 1 (backup):** o **plano Free informado não oferece backup restaurável gerenciado**; `walg_enabled=true` e `backups=[]` **não** provam restaurabilidade. A preparação SHALL exigir: **backup atualizado do banco** com os componentes necessários à recuperação, **cópia dos objetos de Storage** e **restauração comprovada em destino local separado** (contagens/checksums), **antes** das migrations remotas. A restauração **não** SHALL sobrescrever a homologação permanente. PITR está desabilitado; **não** contar com recuperação point-in-time.
- **Conjunto de migrations fixado após a implementação:** o lote **inicial** tem 30 pendentes (2 de laboratório + 28 de F56/Luna), mas esta mudança **adiciona novas migrations** (autorização operacional, entre outras aprovadas). O **conjunto definitivo e seus SHA-256** SHALL ser fixados **após a implementação**, incluindo essas novas migrations; o ledger final **não** é presumido como 129. As **duas de laboratório** (`20260925*`, `20260926*`) SHALL ser tratadas explicitamente: **recomendação = aplicar** no mesmo lote (aditivas, já em `main`, ledger fiel), via `supabase db push` na ordem de arquivo; **não** usar `migration repair` para "pular" (gravaria ledger falso). Se excluídas, o único caminho CLI-limpo é remover os arquivos do diretório de migrations — não recomendado.
- **Rollback:** forward-only; rollback de código **não** reverte banco/ledger; migrations com `REVERT` manual.

### D4 — Provas hospedadas mínimas (reuso do local)

**Decisão:** reaproveitar as provas locais como evidência de contrato e adicionar apenas o que o local **não** emula:

- **Kill da plataforma** com **provider simulado** (sem chamada paga).
- Caminho **automático PF** e **resolução autorizada/auditada** no banco hospedado.
- **RLS/grants** e **ausência de vazamento de segredos em logs** no hospedado.
- Captcha/Google reais por login manual.

- **Ressalva 2 (kill ≠ ausência):** o kill da plataforma **não** prova ausência de upload e **não autoriza, por si só, nenhuma via de encerramento**. Preservar **duas vias**: (a) **automática**, com probe de arte (`integral`/`absent`/`invalid`/`indeterminate`) **fresco sob epoch** e as provas de fence; (b) **administrativa**, explicitamente **autorizada/auditada**, com as **precondições próprias** já aprovadas, **sem** exigir frescor universal. O frescor do epoch SHALL NOT ser universalizado.
- **Ressalva 4 (sem simulação pública):** os testes com provider simulado SHALL ser **internos/efêmeros** (harness/Preview), **sem rota pública** e **sem** que o cliente escolha provider simulado.

### D5 — Piloto manual restrito e separação da abertura geral

**Decisão:** piloto **manual**, **restrito a lojas de teste**, com orçamento, monitoramento, critérios de parada e desligamento. O **desligamento normal** SHALL ser **flag do novo fluxo OFF + revogação da autorização**; a **pausa global** (`VENDEO_GENERATION_PAUSED`) **não** SHALL ser usada como controle do piloto, pois bloquearia também o legado das lojas gerais. Pausa global permanece **somente** como procedimento emergencial **explicitamente autorizado**.

**Sequência de autorização:** as **provas hospedadas simuladas** e o **aceite para iniciar** precedem a **primeira chamada paga**; **não** se exige que o piloto hospedado já esteja aprovado para poder começar. **Ressalva 3:** o piloto é **uma etapa** da liberação; **não** é a abertura a lojas gerais. `all_stores` permanece bloqueado e a abertura geral exige **mudança futura e separada** (com D13/segurança/limites comprovados no hospedado).

## Risks / Trade-offs

- **[Kill durante publicação deixa arte órfã]** → fence `publication_state`/`state_epoch`; via automática exige probe fresco; via administrativa autorizada/auditada; kill sozinho não autoriza nenhuma.
- **[Sem backup restaurável gerenciado / sem PITR]** → backup de banco + objetos de Storage e restauração comprovada em destino local separado (sem sobrescrever a homologação permanente), antes das migrations.
- **[Timeout interno == teto da plataforma]** → deadline global comprovado com margem; persistência é cooperativa, não garantida após kill (D2).
- **[Aumento de superfície de autorização]** → recorte `test_stores`+`test_stores` apenas; `all_stores` recusado; auditoria/revogação preservadas.
- **[Drift de ledger (2 migrations de lab em `main` e fora do banco)]** → aplicar no lote, na ordem, sem `repair`.
- **[Simulação vazando para produção]** → harness interno, sem rota pública, sem provider simulado selecionável.
- **[Confundir piloto com promoção]** → critério explícito de separação e `all_stores` bloqueado.

## Migration Plan

1. **Checkpoint 0** — aprovação desta proposta (proposal/design/specs/tasks) antes do planejamento GSD.
2. **Checkpoint 1** — autorização do recorte D1 (nova fatia) e do orçamento de tempo D2.
3. **Checkpoint 2** — backup **verificável** (D3) e migrations remotas.
4. **Checkpoint 3** — deploy `main` (fluxo OFF) e configuração.
5. **Checkpoint 4** — provas hospedadas **simuladas** (sem chamada paga) e **aceite para iniciar**.
6. **Checkpoint 5** — piloto manual restrito: a **primeira chamada paga** só ocorre **após** o Checkpoint 4 e o aceite; desligamento = **flag do novo fluxo OFF + revogação** (pausa global só em emergência autorizada).
7. **Separação** — abertura a lojas gerais = mudança futura, não incluída aqui.

**Rollback:** código por *promote to production* de deploy anterior; **não** reverte banco/ledger; migrations forward-only com `REVERT` manual.

## Open Questions

1. Valor exato do timeout interno e da margem (proposta: ≤ 240–270s) — decisão humana.
2. Destino local separado (que **não** seja a homologação permanente) e janela do ensaio de restauração de banco + Storage — decisão humana.
3. Modelo/qualidade/pricing (principal e fallback) e teto de gasto do piloto — decisão humana.
4. Aplicar ou não as 2 migrations de laboratório (recomendação: aplicar) — decisão humana.
5. Janela do piloto e responsável pelo desligamento — decisão humana.
6. Conjunto definitivo de migrations e hashes, incluindo as novas migrations desta mudança — fixado **após a implementação**.
