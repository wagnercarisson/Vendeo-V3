# UAT Session 3 — Loja Farmácia Cooper

**Data:** 2026-07-13
**Participante:** Loja Farmácia Cooper
**Contato:** WhatsApp individual
**Responsável:** Wagner
**Ambiente:** produção/UAT
**Decisão:** Aprovado

## Resumo

- Tempo até primeira campanha: 04:55
- Campanha gerada: Vitamina Guday
- Peça considerada publicável? Não
- Canal de feedback confirmado? Sim

## Cenários

| # | Cenário | Status | Evidência | Observações |
|---|---------|--------|-----------|-------------|
| 1 | Cadastro/onboarding | Passou | Onboarding tranquilo e intuitivo | |
| 2 | Admin concede créditos | Passou | Testes de implementação usaram essa loja | Ok |
| 3 | Geração bem-sucedida | Passou | 4bf0376c-814f-4428-a5ff-a7c2305eec8e | Diretor alterou imagem enviada - ficou publicável mas não corresponde ao produto real - após esse teste alteramos o prompt do diretor para evitar esse tipo de problema e os novos testes mostraram que agora ele respeita criteriosamente a imagem enviada (ok) |
| 4 | Geração com erro | Passou | 8f0965e6-590c-404f-a1c3-0c5d4960b089 | Erro ao executar a revisão de qualidade da imagem. Tente novamente. - User tentou gerar novamente e conseguiu gerar sem problemas (ok) |
| 5 | Saldo consistente | Passou | 37 | |
| 6 | Extrato correto | Passou | Sim | |
| 7 | Admin visualiza erro | Passou | Temos 3 erros registrados para esse user - Erro ao executar a revisão de qualidade da imagem. Tente novamente. / O nome do produto digitado não corresponde à imagem enviada. / O prompt de geração contém placeholders não resolvidos. A campanha não pode ser gerada. - Esse último ajustamos para que a geração não seja executada se placeholders não estiverem completos | |
| 8 | Admin audit log | Passou | N.A. | Operações de crédito foram realizadas antes da implementação do audit log, mas estão registradas na conta do user corretamente |

## Feedback Qualitativo

- O que ficou claro: Onboarding e geração simples e intuitivas
- O que gerou dúvida: Alteração de imagens pelo gerador de campanhas
- O que incomodou: Alteração de imagens pelo gerador de campanhas
- O que encantou: Gerações rápidas e com qualidade publicável
- Sugestões do lojista:
  - O sistema deve respeitar a imagem do produto - Isso já foi ajustado e testado, inclusive validado por este user (ok)
  - Quando tiver imagem de mais de um item o preço deveria mencionar que o valor se refere a unidade "cada" - Implementamos o campo de texto mandatório, no qual user poderá especificar essas condicionantes e isso também poderá ser esclarecido nos copys

## Bugs/Ajustes

| Severidade | Área | Descrição | Decisão |
|------------|------|-----------|---------|
| Fix | Geração de Campanha | Alteração da imagem enviada | Corrigir - Alteramos o prompt do gerador de campanhar para que respeite criteriosamente a imagem do produto enviada, não comprometendo informações e quantidades da embalagem - adicionamos a arte o texto "imagem meramente ilustrativa" para contornar drifts menores que possam ocorrer, evitando questões jurídicas ao user (ok) |

## Métricas Após Sessão

- `/admin/metrics` health: Saudável
- success rate 24h: 21% (considerando 14 gerações no total)
- avg cost: N.A.
- avg duration: N.A.
- refunds: N.A. 
- observações: Métricas calculadas pelo período de uso anterior aos registros, apenas para fins de observabilidade

## Go/No-Go Da Sessão

Decisão: Go
Justificativa: Falahs pontuais e previstas de geração - Problemas com a imagem resolvidos
Próximo passo: