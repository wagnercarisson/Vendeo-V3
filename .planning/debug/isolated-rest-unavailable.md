---
status: root_cause_found
trigger: "Diagnosticar a indisponibilidade do REST da instância Supabase isolada vendeo-f562a-isolated, que bloqueia o build após a quick 261013-hxm."
created: 2026-10-13T13:10:00Z
updated: 2026-10-13T13:25:00Z
---

## Constraints (READ-ONLY — OBRIGATÓRIO)

Escopo autorizado: **SOMENTE LEITURA**. PROIBIDO durante toda a investigação:

- restart / start / stop / reset (Docker ou Supabase CLI)
- remover/renomear containers, volumes ou redes
- aplicar migrations, `db push`, `db reset`, DDL/DML de escrita
- editar env/config/runtime (inclui `.env.local`, `config.toml`, `next.config.ts`)
- instalar pacotes
- executar as suítes reais/integração (16 arquivos que dependem do runner isolado)
- chamar provider, ativar flags, deploy, push ou iniciar a b2

Preservar `.opencode/**` e quaisquer alterações alheias no working tree.
**Nunca expor credenciais/JWT/chaves** em logs, comandos ecoados ou relatório — redigir
(`[REDACTED]`/booleano de disponibilidade). Parar para aprovação ANTES de qualquer recuperação.

## Target (identidade aprovada — gate `56.2.1-01-GATE.md` / `56-2-ISOLATED-INSTANCE.md`)

- project_id: `vendeo-f562a-isolated`
- Workdir: `C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated`
- API loopback (Kong): `http://127.0.0.1:56321`
- DB: `127.0.0.1:56322` (PostgreSQL 17.6)
- Studio: `127.0.0.1:56323`
- Configured ports: `[56320, 56321, 56322, 56323, 56324, 56327, 56329]`
- Containers/volume/rede: prefixo `vendeo-f562a-isolated` (`supabase_*_vendeo-f562a-isolated`)
- CLI: `npx --no-install supabase` 2.104.0
- Gate histórico: Kong/DB/Auth/Storage `healthy`, PostgREST `running`, REST 200, Auth health 200;
  Vector `Restarting` (anomalia NÃO bloqueante). Nenhum container `Vendeo_V3` ativo.

## Current Focus

hypothesis: "Kong escuta na porta 56321 (aceita TCP), mas o upstream PostgREST está indisponível/em erro (ou a conexão REST↔Postgres está travada), de modo que a requisição REST fica pendurada até o timeout. Auth deve ser testado separadamente para localizar a fronteira. A causa-raiz provável é um container de serviço exigido (PostgREST ou DB) fora de saúde/estável, não a conectividade TCP do gateway."

test: "Estado/health dos containers (docker ps/inspect) + probes com timeout explícito a Kong (`/rest/v1/`), Auth (`/auth/v1/health`) e DB (`psql select 1`) + logs recentes sanitizados de Kong, PostgREST, Auth e DB, separando o que responde do que trava."

expecting: "Kong aceita conexão, mas `/rest/v1/` (PostgREST) não responde; `/auth/v1/health` e/ou DB podem responder ou também travar; logs devem identificar o serviço falho."

next_action: "CAUSA CONFIRMADA — engine Docker Desktop (WSL2) parado; forwards vpnkit órfãos em 56321/56322/56323. PARAR para aprovação antes de qualquer recuperação (ver 'Recovery Proposal')."

## Symptoms

expected: "`GET http://127.0.0.1:56321/rest/v1/` (com apikey) responde HTTP 200 rapidamente e o build conclui o export estático."

actual: "A porta 56321 aceita conexão TCP, mas uma consulta REST a `legal_document_versions` fica pendurada (timeout > 8s). Durante `next build`, as páginas `/(marketing)/termos|/privacidade|/uso-aceitavel` (que chamam `getCurrentVersion` → `supabaseAdmin` em tempo de export estático) estouram 60s×3 e o build falha (exit 1). Levantado após a quick 261013-hxm (não relacionado às mudanças de teste)."

errors: "Probe REST anterior: `O tempo limite da operação foi atingido` (timeout). Build: `Failed to build /(marketing)/termos/page ... took more than 60 seconds` (3 tentativas) e `Export encountered an error on /(marketing)/termos/page`."

reproduction: "1) TCP connect 127.0.0.1:56321 → sucesso; 2) `GET /rest/v1/legal_document_versions?select=version&limit=1` com apikey → timeout; 3) `npm run build` → falha no export estático das páginas legais."

started: "Observado em 2026-10-13 no build pós-quick-261013-hxm. O gate F56.2b1a (2026-10-08) registrava REST/Auth 200 na mesma instância; o momento exato da indisponibilidade é desconhecido."

## Scope Notes

- Distinguir o **REST indisponível** da **ausência das variáveis do runner** nos 16 arquivos de integração
  (`isolated_integration_requires_runner_and_redacted_preflight`) — **não** tratar como causa única.
- Confirmar (sem imprimir segredos) se a config usada pelo build (`.env.local`) aponta para esta instância.
- Explicar o caminho `getCurrentVersion` → `legal_document_versions` → `supabaseAdmin` e por que trava.

## Deliverables

- causa confirmada OU hipóteses com evidências e incertezas;
- impacto no build e nas integrações;
- proposta mínima de recuperação com alvos/comandos exatos (NÃO executar);
- validações necessárias após a recuperação.

## Symptoms (structured)

- expected: REST 200 e build concluído
- actual: REST pendura; build falha no export estático das páginas legais
- errors: timeout de probe REST; 60s×3 por página no build
- reproduction: TCP ok; GET /rest/v1/ trava; build falha
- started: 2026-10-13 (instância/gate histórico 2026-10-08 estava 200)

## Evidence (read-only, 2026-10-13 ~13:15-13:25 local / ~16:15-16:25Z)

- timestamp: 2026-10-13T16:15Z — `docker ps -a --filter name=vendeo-f562a-isolated` → **`Error response from daemon: Docker Desktop is unable to start`** (exit 1). Nenhum container listável.
- timestamp: 2026-10-13T16:15Z — `docker network ls` / `docker volume ls` (filtro isolado) → mesmo erro do daemon. Impossível inspecionar containers/volume/rede.
- timestamp: 2026-10-13T16:15Z — `docker version` → apenas bloco **Client** presente (29.8.1, API 1.56, context `desktop-linux`); bloco **Server** ausente com `Error response from daemon: Docker Desktop is unable to start`. Daemon/engine **NÃO está rodando**.
- timestamp: 2026-10-13T16:15Z — Processos `Docker Desktop` (PID 10468/10864/13884/21528), `com.docker.backend` (PID 7748/21688), `com.docker.build` (6424) presentes, iniciados **13/10/2026 11:37-11:37** local. A UI/backend sobem, mas o engine WSL falha.
- timestamp: 2026-10-13T16:15Z — `netstat -ano | Select-String "5632[0-9]"` → **TCP 56321/56322/56323 LISTENING em 0.0.0.0 e [::]**, dono **PID 7748 (`com.docker.backend`)**. São os forwards vpnkit órfãos (host-side) que sobrevivem ao engine morto.
- timestamp: 2026-10-13T16:16Z — `curl -m 8 http://127.0.0.1:56321/rest/v1/` (header apikey) → **`HTTP 000`, `curl (28) Operation timed out after 8001 ms with 0 bytes received`**. Confirmado: handshake TCP ok, **nenhuma resposta HTTP**.
- timestamp: 2026-10-13T16:16Z — `curl -m 8 http://127.0.0.1:56321/auth/v1/health` → **`HTTP 000` / timeout 8s**. Auth também pendura (mesma fronteira: engine morto).
- timestamp: 2026-10-13T16:16Z — `Test-NetConnection 127.0.0.1:56322` → **TcpTestSucceeded=True** (mas é só o proxy vpnkit; não há Postgres real atrás).
- timestamp: 2026-10-13T16:16Z — `wsl.exe -l -v` → única distro: **`docker-desktop  Stopped  2`**. `wsl --status` → distro padrão `docker-desktop`, versão 2. A distro do engine existe mas está **parada**.
- timestamp: 2026-10-13T16:16Z — `docker-desktop.exe.log` (host) → última entrada `2026-10-13T16:16:29Z` é o IPC do meu próprio `docker` CLI; sem erros úteis.
- timestamp: 2026-10-13T16:17Z — `com.docker.backend.exe.log.20261013-120326.991` (rotacionado 12:03:26 local) — **causa-raiz do engine**:
  ```
  [2026-10-13T14:37:43.968Z][wsl-bootstrap.version][W] failed to read component versions:
        open /opt/docker-desktop/componentsVersion.json: no such file or directory
  [2026-10-13T14:38:01-03Z][wsl-bootstrap] ... provisioning data via data disk 974d4fd1-...
  [2026-10-13T14:39:36-56Z][wsl-bootstrap.vpnkitcontrol] adding ... tcp forward
        0.0.0.0:56321 -> 172.19.0.4:8000   (Kong)
        0.0.0.0:56323 -> 172.19.0.3:3000   (Studio)
        0.0.0.0:56322 -> 172.19.0.9:5432   (DB)
  [2026-10-13T15:03:08.888Z][com.docker.backend.exe.wslexec][E] wsl.exe -d docker-desktop
        -u root -e wsl-bootstrap run ... : exit status 1
  [2026-10-13T15:03:26.980Z][com.docker.backend.exe.wslexec][E] wsl.exe --terminate
        docker-desktop failed: exit status 1 (stderr: "O WSL está concluindo uma atualização...")
  [2026-10-13T15:03:26.981Z][com.docker.backend.exe.state] backend state changed to stopped
  [2026-10-13T15:03:26.981Z][com.docker.backend.exe.apiproxy] set engine error: starting WSL
        engine: bootstrapping main distribution: running wslexec: ... ExecError ... exit status 1
  ```
- timestamp: 2026-10-13T16:17Z — Timeline (UTC; local = UTC-3):
  - 14:37-14:39Z (11:37-11:39 local) Docker Desktop sobe; wsl-bootstrap restaura forwards; containers de 14:39Z referenciados (56321→Kong 172.19.0.4:8000, 56322→DB 172.19.0.9:5432, 56323→Studio 172.19.0.3:3000).
  - 15:03Z (12:03 local) engine `linux/wsl` **falha** (exit status 1) e muda para `stopped`/erro. Rotação de logs em 12:03:26 local casa com esse evento.
  - 15:03Z+ os forwards vpnkit ficam **órfãos** e continuam LISTENING → TCP aceita, HTTP pendura.
- timestamp: 2026-10-13T16:18Z — `.env.local` (valores redigidos): `SUPABASE_URL=http://127.0.0.1:56321`, `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321`; `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` = **[REDACTED] (presentes)**. Build aponta para a instância isolada — confirmado.
- timestamp: 2026-10-13T16:18Z — `src/lib/supabase/server.ts:42` → `export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)` — **sem `global.fetch` custom, sem `AbortSignal`/timeout**. `document-versions.ts:5-28` → `getCurrentVersion()` faz `.from("legal_document_versions").select(...).lte(...).maybeSingle()` via REST, com `try/catch` que **só captura erro, não timeout pendurado**. As páginas `(marketing)/termos|privacidade|uso-aceitavel/page.tsx:8` `await getCurrentVersion(...)` no topo (export estático). → o await nunca retorna → Next.js estoura 60s/página (×3) → exit 1.
- timestamp: 2026-10-13T16:18Z — Caminho de integração (separado): `src/lib/product-1-1/__tests__/integration-harness.ts:32-49` exige `F562A_ISOLATED_SUPABASE_URL` / `F562A_ISOLATED_SERVICE_ROLE_KEY` / `F562A_ISOLATED_DATABASE_URL`, senão lança `isolated_integration_requires_runner_and_redacted_preflight`; valida url==`http://127.0.0.1:56321` e porta db==56322. 12 arquivos `*.integration.test.ts` + `integration-harness.ts` + `image-generation-operations-repository.integration.test.ts`/`image-generation-diagnosis-repository.test.ts` compõem a família (quick 261013-hxm registra **16 arquivos** falhando só na coleta por ausência do runner).
- timestamp: 2026-10-13T16:19Z — `261013-hxm-SUMMARY.md` (§Pendências 2) já registrava: build bloqueado por ambiente; `.env.local` → isolado 56321 "aceita TCP mas não responde"; 16 arquivos de integração falham só na coleta por ausência do runner. Gate `56.2.1-01-GATE.md` (2026-10-08) → REST/Auth 200 na mesma instância (antes da queda).

## Root Cause (CONFIRMADA)

**O engine Docker Desktop (WSL2) está parado e falhou ao (re)iniciar.** A distro `docker-desktop` está `Stopped`; o backend registrou `engine linux/wsl run error ... exit status 1` e `set engine error`, mudando para `stopped` em **2026-10-13T15:03:26Z (12:03:26 local)**. O stderr do `wsl-bootstrap` indica instalação/estado inconsistente do Docker Desktop (`failed to read component versions: open /opt/docker-desktop/componentsVersion.json: no such file or directory`) e o `wsl --terminate docker-desktop` falhou com **"O WSL está concluindo uma atualização..."** (WSL em atualização pendente).

Consequência mecânica (por que TCP conecta mas REST pendura): o **proxy vpnkit host-side** (processo `com.docker.backend`, PID 7748) mantém os forwards TCP `56321/56322/56323` **LISTENING** mesmo com o engine morto. Assim o handshake TCP completa (SYN-ACK do proxy) mas **nenhum upstream (Kong/PostgREST/Auth/Postgres) existe** — a requisição HTTP nunca recebe resposta → `curl` reporta `0 bytes received`; `supabase-js` (undici, sem timeout) fica pendurado.

Efeito no build: `next build` exporta estaticamente `(marketing)/termos|privacidade|uso-aceitavel`; cada página faz `await getCurrentVersion()` → REST pendurado → não retorna nem lança (o `try/catch` não cobre timeout) → Next.js aborta a página em 60s, 3 tentativas → **`Export encountered an error` → exit 1**. A indisponibilidade do REST é **ambiental**, não regressão das mudanças do quick 261013-hxm (nenhum arquivo alterado participa do import graph dessas páginas).

Observações: `docker ps` confirmou que nenhum container está listável; não há como afirmar linhas/tabelas (`legal_document_versions`) — o DB não está acessível. O gate de 2026-10-08 registrava REST/Auth 200, então a queda ocorreu entre 2026-10-08 e a observação de 2026-10-13 (evento registrado em 12:03 local de hoje).

## Incertezas

- Estado dos containers/volume/rede e do schema (`legal_document_versions`) **não verificável** enquanto o engine estiver parado — permanecem no data disk `974d4fd1-cacc-5a47-a01a-63ab6e7188d1` até o engine voltar.
- Motivo último do exit 1 do `wsl-bootstrap` não está totalmente detalhado no log capturado; os indícios apontam para WSL em atualização + `componentsVersion.json` ausente (possível instalação/atualização do Docker Desktop incompleta). Confirmar exige subir o WSL/engine e reenviar logs.
- Não é possível separar, agora, "REST indisponível" de "DB disponível" — ambos dependem do mesmo engine.

## NOT a single cause (distinção explícita)

São **duas** condições independentes, ambas ambientais:
1. **REST/engine parado** (este laudo) → bloqueia o **build** (export estático das páginas legais).
2. **Ausência das variáveis do runner** (`F562A_ISOLATED_*`) nos **16 arquivos de integração** → falha **somente na coleta** (`isolated_integration_requires_runner_and_redacted_preflight`) em `npx vitest run`. Mesmo com o engine de pé, sem essas variáveis as suítes continuam não coletáveis. Não tratar como causa única do build.

## Recovery Proposal (NÃO EXECUTADO — requer aprovação)

Alvos: Docker Desktop (engine WSL2) e, subsequentemente, a instância `vendeo-f562a-isolated` (workdir `C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated`). **Nenhum comando abaixo foi executado.**

Fase A — restaurar o engine Docker (fora do escopo read-only; exige aprovação):
1. Concluir/cancelar qualquer **atualização pendente do WSL** e reiniciar o host se o Windows exigir (`wsl --shutdown` seguido de reboot, se aplicável).
2. Reiniciar o Docker Desktop pela UI (ou `Restart-Service com.docker.service` com privilégio) e confirmar `docker version` com bloco **Server** presente e `docker info` sem "unable to start".
3. Se persistir `componentsVersion.json: no such file or directory`: reparar/reinstalar o Docker Desktop (mesma versão) — a falha é de instalação, não de containers.

Fase B — subir a instância isolada (após engine OK):
4. `docker ps -a --filter name=vendeo-f562a-isolated` → confirmar containers `supabase_*_vendeo-f562a-isolated` no data disk `974d4fd1-...` (não recriar; sem `db reset`/`db push`).
5. `npx --no-install supabase --workdir "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated" start` (ou `docker start` dos containers específicos) — sem migrations.
6. Limpar forwards órfãos se os ports ficarem presos: reiniciar `com.docker.backend` via engine restart (evitar remover rede/volume).

## Post-Recovery Validations

- `docker ps --filter name=vendeo-f562a-isolated` → DB/Kong/Auth/Storage `healthy`, PostgREST `running`.
- `curl -m 8 http://127.0.0.1:56321/rest/v1/` com apikey anon → **HTTP 200** (não mais `000`/timeout).
- `curl -m 8 http://127.0.0.1:56321/auth/v1/health` → HTTP 200.
- `psql -h 127.0.0.1 -p 56322 -U postgres -d postgres -t -A -c "select 1"` → exit 0 (`1`).
- Identidade/isolamento inalterados: `project_id` no `config.toml` == `vendeo-f562a-isolated`; 0 containers `Vendeo_V3`.
- `GET /rest/v1/legal_document_versions?select=version&limit=1` responde (confirma o caminho de `getCurrentVersion`).
- `npm run build` → export estático de `(marketing)/termos|privacidade|uso-aceitavel` conclui; exit 0.
- Suítes de integração: exportar `F562A_ISOLATED_SUPABASE_URL`/`F562A_ISOLATED_SERVICE_ROLE_KEY`/`F562A_ISOLATED_DATABASE_URL` antes de `npx vitest run` (o engine de pé NÃO substitui a ausência do runner).

## Recovery Attempt 1 — engine (2026-10-13, aprovado pelo responsável)

**Escopo autorizado:** SOMENTE Quit + reabertura do Docker Desktop; sem encerramento forçado de
processos, sem `wsl --shutdown`, sem reboot, sem reparo/reinstalação; depois, apenas inspeção
read-only; sem iniciar/parar Supabase nem alterar recursos.

**Pré-checagem de dependência (read-only):** nenhuma conexão ESTABLISHED para 5532x/5632x/5432x;
nenhuma sessão RDP (LogonType 10); única sessão interativa (Session 4, `WAGNER\wagne`, 1×
`explorer.exe`); nenhum processo `supabase`/`psql`/dev-server (único `node.exe` = runtime Codex CUA).
WSL: `WslService` Running, distro `docker-desktop` v2 (Stopped), `CustomWslDistroDir =
G:\DockerDesktopData-F56.2a\DockerDesktopWSL`; `docker_data.vhdx` 17,27 GiB intacto. `docker
desktop status` = `stopped`.

**Ações executadas (e SOMENTE estas):**
1. `docker desktop stop` → exit 0 (`✓ Stopping Docker Desktop`). Quit gracioso; forwards órfãos 5632x
   liberados; nenhum processo `com.docker.*` remanescente.
2. `docker desktop start` → exit 0 (`✓ Starting Docker Desktop`).
3. Inspeção read-only (`docker ps -a`, `volume ls`, `network ls`, probes `curl`, logs sanitizados).

**Validação do engine:** `docker version` → **Server 29.8.1** presente; `docker desktop status` →
`running`. **Falha do engine resolvida.**

**Containers auto-iniciados pelo Docker Desktop (registro):** TODOS os três stacks foram reiniciados
automaticamente no relançamento — `vendeo-f562a-isolated`, `vendeo-f561-isolated` e
`vendeo-landing-lab`. Volumes existentes: `supabase_db_vendeo-f562a-isolated`,
`supabase_storage_vendeo-f562a-isolated`, `supabase_db_vendeo-f561-isolated`,
`supabase_db_vendeo-landing-lab`, `supabase_storage_vendeo-landing-lab`. Redes: as três
`supabase_network_vendeo-*-isolated` + `supabase_network_vendeo-landing-lab`. **Nenhum recurso foi
alterado/criado/removido por nós.**

**Efeito imediato no alvo (`vendeo-f562a-isolated`, ~2 min pós-start):** Kong `healthy`; PostgREST
`Up`; `pg_meta` passou a `healthy`; **DB `unhealthy` — em crash recovery** (`LOG: syncing data
directory (fsync), elapsed time: 80.06 s`), respondendo `FATAL: the database system is starting up
(SQLSTATE 57P03)`; **Auth `Restarting (1)`** porque não consegue migrar enquanto o DB não aceita
conexões (`dial tcp 172.19.0.8:5432: connection refused` → depois `57P03`); `realtime` em
`health: starting`; `studio`/`storage` `unhealthy` (dependem do DB); `edge_runtime`/`vector`/
`analytics` **Exited** (estado pré-existente, 5 dias; `analytics` desabilitado por design).

**Efeito no sintoma original:** a porta `56321` agora responde (**não pendura mais**): `GET
/rest/v1/` → **HTTP 503 em ~0,004 s** (PostgREST de pé, DB indisponível) e `/auth/v1/health` →
HTTP 503. Antes: `HTTP 000`/timeout. O hang do build está **resolvido na causa imediata**; resta a
recuperação do DB.

**Interpretação (precaução do responsável):** o backend órfão explica **apenas o sintoma "TCP conecta
sem responder"**; **não** é a causa-raiz única. Há três camadas distintas: (i) engine Docker parado
por `exit status 1` do WSL bootstrap (causa interna ainda não esclarecida); (ii) forwards vpnkit
órfãos mascarando a queda; (iii) **agora, crash recovery do Postgres** após o desligamento abrupto.
O loop do Auth é **consequência** de (iii).

**PARADO para revisão.** Não foi executado `supabase start/stop`, `db reset`/`db push`, migration,
nem qualquer alteração de container/volume/rede. Build e integrações permanecem na próxima etapa
(integrações via runner com gate, não por export manual de credenciais).

## Post-recovery read-only gates (2026-10-13, após autorização de observação)

**Observação:** monitoramento read-only (intervalos ~45 s). Já na 1ª verificação: `db=healthy`,
`auth=running` (restart count 10, estabilizado), `rest=running`, `REST=200`, `AUTH=200`, **sem padrão
de erro de WAL/checkpoint/I/O/disco**. Disco: C livre ~13,1 GiB, G livre ~45,5 GiB. Recuperação
(crash recovery) **concluída sem intervenção**.

| Gate | Resultado |
|---|---|
| DB healthy | ✅ `supabase_db_vendeo-f562a-isolated` **healthy** |
| Auth funcionando | ✅ `supabase_auth_vendeo-f562a-isolated` **healthy**; `/auth/v1/health` → **HTTP 200** (0,003 s) |
| REST respondendo | ✅ `GET /rest/v1/` (apikey) → **HTTP 200** (0,03 s) |
| `SELECT 1` | ✅ `docker exec … psql -U postgres -c "select 1"` → `1` |
| Caminho do build | ✅ `GET /rest/v1/legal_document_versions?select=version&limit=1` via **service_role** → **HTTP 200** (0,006 s). (Com anon → 401 por RLS; o build usa service role.) |
| Identidade/isolamento | ✅ 3 stacks com nomes/portas/redes dedicadas: f562a `56321/56322/56323` (rede `supabase_network_vendeo-f562a-isolated`), f561 `55321/55322` (`…-f561-isolated`), landing-lab `57321/57322` (`…-landing-lab`). Sem colisão. |
| Containers inesperados | ✅ **nenhum**; ausência de `Vendeo_V3`. Exited pré-existentes em f562a: `edge_runtime` (255), `vector` (0), `analytics` (137, desabilitado por design). |

**Estado:** DB/Kong/Auth/Storage/Realtime/Studio/pg_meta de f562a `healthy`; f561 e landing-lab
`healthy`. REST `Up`. Engine Docker `running`.

**PARADO para revisão.** Build e integrações **não** executados (próxima autorização; integrações
devem usar o runner com gate em modo **sem aplicação de migrations**). Nenhum restart/reset/remoção/
reparação; nenhuma alteração de recurso.

## Final Validation (2026-10-13) — build + integrações reais via runner

**Pré-condição:** nenhum `next dev` na mesma `.next`; `.next` sem arquivo de lock.

**1. `npm run build` → exit 0.** `/termos`, `/privacidade` e `/uso-aceitavel` prerenderizadas como
**estáticas (○)**; as demais rotas geradas normalmente. **Bloqueio ambiental de build encerrado.**

**2. Gate do runner (fail-closed) → PASS** (`-PreflightOnly` e `-SkipApply`): ProjectId
`vendeo-f562a-isolated`; API loopback `http://127.0.0.1:56321`; portas dedicadas `[56320..56329]`
sem conflito; `db/auth/kong` f562a `running|healthy`, `rest` `running`; F56.1 preservada
(`db/auth/kong` healthy, `rest` running); `VendeoV3Active=false`; `MailpitActive=false`;
`CredentialValues=suppressed`.

**3. Migrations:** `pending = 0`; SHA-256 das 5 migrations b1b conferidos (source revision
`6733d9a3`); **7 relações + 8 RPCs** presentes; **nenhuma migration aplicada** (`-SkipApply`).

**4. Integrações reais (runner `-SkipApply -RunSuites`) → exit 0 — 54 passed / 0 failed / 0 skipped:**

| Suíte | passed | failed | skipped | gate por suíte |
|---|---|---|---|---|
| atomic-attempt | 7 | 0 | 0 | OK |
| credit-delivery | 6 | 0 | 0 | OK |
| artifact-download | 7 | 0 | 0 | OK |
| pending-resolution | 7 | 0 | 0 | OK |
| persisted-campaign | 5 | 0 | 0 | OK |
| integration-corrections | 13 | 0 | 0 | OK |
| copy-state | 8 | 0 | 0 | OK |
| concurrent-route-submission | 1 | 0 | 0 | OK |

Provider **simulado** (zero chamada paga). Nenhum `db push`/reset/migration/deploy/ativação; outros
stacks preservados; `.opencode/**` preservado.

**Causa interna da falha inicial do Docker: permanece NÃO esclarecida.** Registra-se apenas a
recuperação (Quit/relança gracioso + crash recovery do Postgres), **sem** inferir a causa-raiz do
`exit status 1` do bootstrap WSL. Bloqueio ambiental **encerrado** para build e integrações; o
alinhamento da b2 pode ser retomado sob nova autorização.
