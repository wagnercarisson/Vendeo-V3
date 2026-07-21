# UAT Session 4 — Loja Floricultura Tambani

**Data:** 2026-07-17
**Participante:** Loja Floricultura Tambani
**Contato:** WhatsApp individual
**Responsável:** Wagner
**Ambiente:** produção/UAT
**Decisão:** Aprovado

## Resumo

- Tempo até primeira campanha: 08:12
- Campanha gerada: Buquê de rosas vermelhas importadas
- Peça considerada publicável? Sim
- Canal de feedback confirmado? Sim

## Cenários

| # | Cenário | Status | Evidência | Observações |
|---|---------|--------|-----------|-------------|
| 1 | Cadastro/onboarding | Passou | User realizou onboarding tranquilamente | |
| 2 | Admin concede créditos | N.A | -- | |
| 3 | Geração bem-sucedida | Passou | 77eb5d11-7c6e-418e-aade-449bc0b89d32 | |
| 4 | Geração com erro | Passou | 9ee9c5d5-bd93-4745-88da-5034f143ec2c |  |
| 5 | Saldo consistente | Passou | 30 | |
| 6 | Extrato correto | Passou | 30 | |
| 7 | Admin visualiza erro | Passou | O prompt de geração contém placeholders não resolvidos. A campanha não pode ser gerada. | |
| 8 | Admin audit log | N.A | Nenhuma concessão de créditos ainda | |

## Feedback Qualitativo

- O que ficou claro: sistema intuitivo, fácil de usar
- O que gerou dúvida: Posição da confirmação de salvamento da step 2 no onboarding - User não visualizou a operação (corrigido com rolagem de tela até a mensagem)
- O que incomodou: 
- O que encantou: Qualidade da composição das campanhas e rapidez
- Sugestões do lojista:
  - se tivesse uma opção para definir o formato da imagem, para gerar fotos para os storys (programado para fases futuras)

## Bugs/Ajustes

| Severidade | Área | Descrição | Decisão |
|------------|------|-----------|---------|
| Fix | Mensagem de salvamento na Onboarding | A mensagem de salvamento é exibida fora da área de visão do user, no topo da tela | Corrigir - Aplicar rolagem de tela para o topo após clicar em salvar, posicionando a mensagem na visão do user (Corrigido) |

## Métricas Após Sessão

- `/admin/metrics` health: Saudável
- success rate 24h: N.A
- avg cost: N.A
- avg duration: N.A
- refunds: N.A
- observações: Registro feitos a partir de dados já consolidados de gerações anteriores a implementação das métricas

## Go/No-Go Da Sessão

Decisão: Go
Justificativa: Erro de geração - corrigimos para que o sistema detecte placeholders incompletos antes de gerar, refaça o briefing e tente novamente / Posição da mensagem de salvamento também foi contornada com a rolagem de tela
Próximo passo: