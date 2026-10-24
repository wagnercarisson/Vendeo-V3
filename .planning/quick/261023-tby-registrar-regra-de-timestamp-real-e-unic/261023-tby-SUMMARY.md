---
type: quick
status: complete
date: 2026-10-23
---

# Registro documental da regra de migrations

- GSD iniciado por `gsd-sdk query init quick` na raiz `C:\Projetos\Vendeo V3`.
- AGENTS.md e docs/fluxo-de-desenvolvimento.md exigem timestamp real UTC `YYYYMMDDHHmmss`, sem contador diário artificial, com checagem de unicidade antes da criação e no conjunto integrado.
- Registrada a decisão: preservar migration F50.3; renumerar F47.1 somente na integração autorizada, mantendo versão/hash originais, evidências locais e referências/testes atualizados, sem repair silencioso de ledger.
- Registrada a distinção entre proteção do laboratório e promoção produtiva.
- Nenhuma migration renomeada ou aplicada; nenhum runtime, banco, branch, segredo ou configuração alterado. Sem commit, push, merge, chamadas pagas ou deploy.
- Alterações documentais entregues para revisão; sem testes de aplicação por não haver alteração de código.
- `git diff --check`: passou; tabela Quick Tasks Completed do STATE atualizada sem recalcular contadores de fases ou alterar o status da F50.4.
