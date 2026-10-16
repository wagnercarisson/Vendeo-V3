---
id: 261016-nst
part: network-and-integrations
status: report
date: 2026-10-16
---

# Rede, administrador e integrações externas — vendeo-homolog

## 1. Administrador preservado (OK)

- `public.admin_users` no homolog: **1 linha**, `user_id = 1273d07b-…` (owner da Adega).
- Remoto (`admin_users` via REST): **1 linha**, mesmo `user_id`. **Idêntico.**
- `auth.users.is_super_admin`: nulo para os 2 usuários (sem super-admin).
- Nenhum privilégio administrativo adicional concedido.

## 2. Integrações externas ativas: NENHUMA

| Item | Estado |
|---|---|
| `supabase_functions.hooks` (edge hooks) | **0 linhas** |
| `net.http_request_queue` (pg_net) | **0** |
| Triggers usando `net.*`/HTTP | **nenhum** |
| `pg_cron` / `cron.job` | **ausente** |
| Tabelas com colunas webhook/url | **nenhuma** |
| Edge runtime / vector / analytics | **excluídos no start** |
| Mailpit (e-mail) | **excluído** (`exec format error`) |
| Google OAuth | `enabled=true`, mas **client id/secret não definidos** → inerte |
| Provider de IA | **sem chaves** no ambiente do homolog |
| `product_flow_stage_authorizations` | **não existe** (migration pendente) |

`pg_extension` presente: `pg_net 0.20.3` (disponível, **não usado**), `pgcrypto`,
`pg_stat_statements`, `supabase_vault`, `uuid-ossp`, `plpgsql`.

`feature_flags` (iguais ao remoto): `captcha_enabled=true` (Turnstile — requer app+secret),
`campaign_generation_enabled=true`, `visual_signature_generation_enabled=true`,
`theme_generation_enabled=true`, `force_brief_vision_check=false`,
`campaign_approval_enabled=false`.

## 3. Isolamento de rede — PENDÊNCIA

- Todos os containers do homolog estão na **rede dedicada** `supabase_network_vendeo-homolog` (sem compartilhar rede com outras instâncias).
- **Problema:** o CLI publica as portas em **0.0.0.0 e [::]** (não só loopback):
  - `57781` (Kong/API), `57782` (Postgres), `57783` (Studio).
- **Controle compensatório atual:** Windows Firewall ativo nos 3 perfis; `DefaultInboundAction = NotConfigured` (equivale a **Block**); **não existe** regra de liberação inbound para `5778x`. Ou seja, LAN deveria estar bloqueada por padrão.
- **Correção recomendada (requer elevação — a sessão atual NÃO é admin):**
  ```
  New-NetFirewallRule -DisplayName "vendeo-homolog block 57780-57789" -Direction Inbound -Action Block -Protocol TCP -LocalPort 57780-57789 -Profile Any
  ```
  (loopback permanece acessível; regra reversível por `Remove-NetFirewallRule`).
- Alternativa nativa (bind loopback) **não é suportada** pelo Supabase CLI 2.104.0.
- Saída (egress): a bridge permite internet; como **não há chaves de provider** e
  `pg_net`/hooks estão ociosos, não há integração externa ativa. A troca da aplicação
  para o homolog deve **neutralizar chaves de provider** (ver script de troca).

## 4. Correção de rede aplicada — RESULTADO (parcial; bloqueio externo NÃO comprovado)

- Regra aplicada com elevação (UAC): `vendeo-homolog block 57780-57789` — `Inbound` / `Block` / `TCP` / `Any` / `Enabled`. Localhost segue OK (`127.0.0.1:57781` e `:57782` conectam).
- **Não foi possível comprovar o bloqueio externo** desta máquina, e a existência da regra **não** foi aceita como prova.
- **Experimento de controle:** listener simples na porta `59999` + regra `Block` equivalente → ainda **acessível** de outro namespace Docker, tanto por `host.docker.internal` quanto pelo IP da LAN (`192.168.1.8`). Conclusão: **o tráfego container→host não é filtrado pelo Windows Firewall** (proxy do Docker Desktop), portanto o método de teste por container **não mede** o alcance LAN real.
- Antes da regra, o homolog era **alcançável** de outro namespace (`REACHABLE` em `57782`), confirmando a exposição em `0.0.0.0`.
- **Limitação aberta:** a comprovação de que um **host externo real** (outra máquina na LAN) está bloqueado exige um teste a partir de outro dispositivo. Alternativas não suportadas nativamente pelo Supabase CLI 2.104/2.75 (sem bind loopback).
- A regra é mantida como defesa em profundidade e é reversível (`Remove-NetFirewallRule -DisplayName "vendeo-homolog block 57780-57789"`).

## 5. TESTE LAN — para execução pelo usuário em outro dispositivo (sem instalar nada)

Objetivo: provar de fora se as portas do homolog estão acessíveis pela LAN. IP do host: **`192.168.1.8`**.

Passos (outro dispositivo, na **mesma rede**, sem isolamento entre clientes):
1. Navegador em `http://192.168.1.8:57781/rest/v1/`
2. Navegador em `http://192.168.1.8:57783/` (Studio)
3. **Critério:** **QUALQUER resposta HTTP** — inclusive `401`/`403`/JSON/erro — **demonstra alcance da porta** (EXPOSTO). Só **falha de conexão/timeout/sem resposta** indica **BLOQUEADO** (desejado).
4. Reporte o resultado de `57781` e `57783` (bloqueado/exposto + mensagem).

Notas:
- **Não testar `57782` pelo navegador:** PostgreSQL não fala HTTP; uma página que falha não comprova bloqueio da porta.
- Confirmar que o dispositivo está na **mesma rede e sem isolamento de clientes** (AP isolation); senão o teste não é conclusivo.
- Não instalar ferramentas nem abrir portas adicionais. A app Next **não** é acessível pela LAN (escuta `127.0.0.1:3000`).
- Se aparecer **EXPOSTO**, a regra de firewall não surte efeito no caminho LAN e será preciso endurecer (ex.: restringir a publicação de portas Docker/WSL).

### Resultado do teste LAN (relato do usuário — registrado, sem repetição)
- `http://192.168.1.8:57781/rest/v1/` e `http://192.168.1.8:57783/` → **timeout no celular, no Wi-Fi principal**.
- Leitura: **favorável** (sem resposta HTTP), porém **não conclusivo** isoladamente (eventual isolamento de clientes / rede não confirmados).
- **Porta 57782 não coberta** (Postgres não fala HTTP) — não declarar cobertura. **Pendência aberta**; não solicitar repetição.
