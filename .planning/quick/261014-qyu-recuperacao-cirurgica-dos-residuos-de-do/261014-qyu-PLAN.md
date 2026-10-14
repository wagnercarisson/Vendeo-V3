---
id: 261014-qyu
type: quick
status: complete
date: 2026-10-14
---

# Recuperação cirúrgica dos dois stash pop indevidos

Autorização: responsável pediu reversão cuidadosa, sem perda de conteúdo válido.
GSD iniciado por `gsd-sdk.cmd query init.quick`; execução inline, sem delegação.
Parar para revisão sem commit automático, push ou avanço da F56.

Revisão posterior: responsável autorizou o commit documental da quick. Configurações `.opencode/**` permanecem fora deste commit; nenhuma retomada de fase autorizada.

## Escopo e evidência

- HEAD inicial: `2109d59a691a6a4329d168505bedab938206787d`.
- Em 14/10 o gsd-executor / qwen3.8-flash / opencode-go / low executou dois pops após pushes sem alterações.
- Primeiro: stash `18c1723dfa78449d3263e7d2429efb37dc4b75ab`, salvo em 28/09; restaurou documento F44 já sem extensão e saiu da pilha.
- Segundo: stash `6b525361c6086040c3179a5eda0469b71570b87b`, antiga fase 4.4; conflitos e resíduos untracked. Permanece na pilha.
- Runtime anteriormente afetado já coincide com HEAD; não requer restauração.

## Tarefas

1. Validar blobs de cada arquivo contra seu stash/parent, ausência no índice, HEAD e hashes de todas as alterações preexistentes. Criar backup exclusivo fora do repositório, com hashes conferidos; copiar também os três WIP já preservados em Temp.
2. Mover somente os seis resíduos comprovados da 4.4 para quarentena. Preservar documento F44 sob `docs/alinhamento-fase-44-temas-de-campanhas.md` sem alteração de bytes. Não sobrescrever destino existente, não mover diretórios amplos.
3. Verificar HEAD/índice/stash/worktree, hashes dos arquivos ambientais e backups, lista OpenSpec e ausência de diferenças de runtime. Registrar SUMMARY e linha aditiva em STATE; parar sem staging/commit.

## Proibições

Sem stash push/pop/drop, reset, checkout/restore amplo, git clean, exclusão de conteúdo, migrations, banco, provider, alteração de flags, deploy, push ou avanço do plano pendente.
Preservar `.opencode/**`, a pilha de stash e as cópias de recuperação existentes.
Não atribuir ao executor a retirada histórica de `.md`: não foi comprovada.
