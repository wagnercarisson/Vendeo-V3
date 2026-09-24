# Fluxo de Desenvolvimento

## Responsabilidades

- **OpenSpec:** fonte da verdade funcional e técnica.
- **GSD:** tradução da especificação em contexto, planos, execução e tracking.
- **Codex:** alinhamento e validação entre usuário, OpenSpec, GSD e código.
- **Usuário:** problema, resultado esperado, decisões e aprovações.

## Fluxo obrigatório

1. `/opsx-propose`
2. Revisão e aprovação Codex/usuário.
3. `/gsd-plan-phase`
4. Revisão dos planos pelo Codex.
5. `/gsd-execute-phase`
6. Revisão da execução pelo Codex.
7. `/gsd-verify-work`
8. `/opsx-verify`
9. `/opsx-sync`
10. `/opsx-archive`
11. Reconciliação final de STATE, ROADMAP e demais trackings.

## Regras

- GSD não redesenha decisões aprovadas no OpenSpec.
- `CONTEXT.md` deve ser uma ponte compacta, não cópia dos artefatos.
- Planos devem referenciar apenas specs, arquivos e decisões relevantes.
- Se houver mais de 8–10 planos, interromper antes da execução e avaliar divisão com o usuário.
- Mudança de escopo retorna ao OpenSpec antes de alterar código.
- Archives não são carregados automaticamente.
- Não carregar fases anteriores, todos os summaries ou todo o repositório sem necessidade.
- Usar `rg` e leituras direcionadas.
- Preservar alterações preexistentes não relacionadas.

## Validações distintas

- **plan-checker:** coerência e executabilidade dos planos.
- **verifier GSD:** implementação contra planos e objetivo.
- **gsd-verify-work:** validação funcional/UAT e tracking.
- **opsx-verify:** implementação contra a base técnica OpenSpec.
- **Code review:** defeitos, regressões, segurança e qualidade.
- **Codex:** coerência transversal e aprovação de passagem entre etapas.

## Checklist de nova sessão/fase

- Ler `AGENTS.md` e este guia.
- Identificar fase, OpenSpec ativo e estado do worktree.
- Ler somente PROJECT, STATE, ROADMAP e REQUIREMENTS ativos necessários.
- Ler os artefatos OpenSpec da mudança atual.
- Ler somente CONTEXT/PLAN/SUMMARY relevantes da fase atual.
- Confirmar escopo, bloqueios, fonte da verdade e próximo comando.
- Não executar se houver divergência não resolvida.

## Checklist de encerramento

- Planos e summaries completos.
- Verificação GSD concluída.
- OpenSpec verificado, sincronizado e arquivado.
- Tracking reconciliado.
- Pendências futuras separadas da fase concluída.
- Worktree e commits conferidos.
