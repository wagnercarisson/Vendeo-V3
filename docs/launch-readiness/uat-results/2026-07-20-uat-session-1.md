# UAT Session 1 — Loja da Esquina

**Data:** 2026-07-20
**Participante:** Loja da Esquina
**Contato:** WhatsApp individual
**Responsável:** Wagner
**Ambiente:** produção/UAT
**Decisão:** Aprovado 

## Resumo

- Tempo até primeira campanha: 00:04:54
- Campanha gerada: Pijama Vaquinha Soneca
- Peça considerada publicável? Sim
- Canal de feedback confirmado? Sim

## Cenários

| # | Cenário | Status | Evidência | Observações |
|---|---------|--------|-----------|-------------|
| 1 | Cadastro/onboarding | Passou |           | |
| 2 | Admin concede créditos | Passou | audit log | |
| 3 | Geração bem-sucedida | Passou | 5f1bb69d-08a0-43b1-b65b-85b8a85e7da9 | |
| 4 | Geração com erro | N.A. | | |
| 5 | Saldo consistente | Passou | 5 - 1 = 4 | |
| 6 | Extrato correto | Passou | 5 - 1 + 5 = 9 | |
| 7 | Admin visualiza erro | N.A. | | |
| 8 | Admin audit log | Passou | /admin/audit-log | |

## Feedback Qualitativo

- O que ficou claro: fluxo válido, intuitivo, natural
- O que gerou dúvida:
- O que incomodou:
- O que encantou:
- Sugestões do lojista:

## Bugs/Ajustes

| Severidade | Área | Descrição | Decisão |
|------------|------|-----------|---------|
| Blocker/Fix/Monitor | | | Corrigir/Aceitar/Adiar |

## Métricas Após Sessão

- `/admin/metrics` health: Saudável
- success rate 24h: 100%
- avg cost: 0,22
- avg duration: 01:15
- refunds: 2
- observações: refunds para loja anterior ao teste

## Go/No-Go Da Sessão

Decisão: go
Justificativa: todo fluxo e2e operacional, rápido, objetivo e claro com resultado publicável
Próximo passo: 