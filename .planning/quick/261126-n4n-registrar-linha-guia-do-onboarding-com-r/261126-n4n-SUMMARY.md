---
quick_id: 261126-n4n
date: 2026-11-26
status: complete
scope: documentation-only
publication: not-executed
---

# Linha guia do onboarding registrada

## Entrega

Criado `docs/alinhamento-onboarding-responsavel-cnpj-opcional.md` com as decisões da conversa, nove fatias, dependências, critérios de fechamento, pontos a definir na fatia 1 e referências técnicas locais. Referência adicionada em STATE, sem alterar ROADMAP, progresso ou criar fase/OpenSpec.

## Correções finais preservadas

- CPF repetível no cadastro; oferta única exige conta e CPF ainda não beneficiados.
- Trocar CPF de conta beneficiada não concede créditos, nem marca automaticamente o novo CPF como beneficiado.
- Dados pessoais separados dos geradores e da identidade comercial; edição pessoal não dispara realinhamento.
- Termos na segunda aba e confirmação simples para substituição efetiva do responsável.
- Carteira permanece por store_id; concessão registra conta e referência protegida do CPF.
- Usuários existentes somente na fatia 9; fatia 8 publica sem ativar a exigência. Ensaio da transição em homologação na fatia 7.
- Campos exatos, retenção e parâmetros da oferta permanecem para detalhamento na fatia 1.

## Verificação

- Leitura crítica contra as decisões finais da conversa.
- Nove fatias detectadas, na ordem aprovada.
- Dezesseis links locais do guia resolvidos.
- Whitespace verificado nos arquivos novos e `git diff --check` no tracking.
- Testes de aplicação, typecheck e build não executados: alteração exclusivamente documental, sem código ou configuração de runtime.

## Limites

Somente arquivos locais. Sem commit, push, merge, deploy, banco, migration, ativação ou geração paga. A etapa de commit do workflow não foi executada; a entrega documental está disponível no worktree para revisão. Próximo trabalho funcional: detalhamento da fatia 1 via proposta OpenSpec e planejamento GSD pertinentes.
