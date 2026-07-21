# UAT Session 2 — Loja Wagner Bebidas

**Data:** 2026-07-16
**Participante:** Loja Wagner Bebidas
**Contato:** WhatsApp individual
**Responsável:** Wagner
**Ambiente:** produção/UAT
**Decisão:** Aprovado

## Resumo

- Tempo até primeira campanha: 05:10
- Campanha gerada: Conhaque Dreher 900ml
- Peça considerada publicável? Sim
- Canal de feedback confirmado? Sim

## Cenários

| # | Cenário | Status | Evidência | Observações |
|---|---------|--------|-----------|-------------|
| 1 | Cadastro/onboarding | Passou | Login com Logotipo | |
| 2 | Admin concede créditos | Passou | audit log | |
| 3 | Geração bem-sucedida | Passou | 8f1a0841-4bb6-4b68-8ba5-c25e9ef88832 | |
| 4 | Geração com erro | N.A. | | |
| 5 | Saldo consistente | Passou | 60 | |
| 6 | Extrato correto | Passou | 50 + 10 = 60 | |
| 7 | Admin visualiza erro | N.A. | | |
| 8 | Admin audit log | Passou | /admin/audit-log | |

## Feedback Qualitativo

- O que ficou claro: Onboarding e geração simples e intuitivos
- O que gerou dúvida: IA nem sempre respeita a foto enviada - Instruímos user a guiar o diretor de geração usando termos impositivos para respeitar conteúdo - User testou e funcionou - Gera um pouco de fricção mas resolve e traz bons resultados (ok)
- O que incomodou: Campanhas extrapolavam tela (Iphone) - Celular estava com zoom - Ajustou o zoom e funcionou perfeitamente (ok)
- O que encantou: Gerações prontas para publicação
- Sugestões do lojista: 
  - variações de cores pra não ficar toda vez a mesma cara 
  - criação de encarte com mais produtos
  - criação de imagem sem ser oferta de preço (pra gerar tipo chegou novidade - confira o lançamento - bom dia - sextou) = já existe / lojista informado (ok)

## Bugs/Ajustes

| Severidade | Área | Descrição | Decisão |
|------------|------|-----------|---------|
| Monitor | Mobile | Extrapolou tela no Iphone | Aceitar - monitorar se houver mais relatos|

## Métricas Após Sessão

- `/admin/metrics` health: Saudável
- success rate 24h: 100%
- avg cost: N/A
- avg duration: N/A
- refunds: 10
- observações: Auditado via painel pós gerações

## Go/No-Go Da Sessão

Decisão: Go
Justificativa: User gerou 5 artes todas com sucesso
Próximo passo: