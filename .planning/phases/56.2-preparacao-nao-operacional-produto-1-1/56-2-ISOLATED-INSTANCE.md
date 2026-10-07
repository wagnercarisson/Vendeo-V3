# Instância isolada F56.2a

BASE_SHA: `335bfb70`

Antes de iniciar qualquer plano da onda 1, valide que esse commit existe (`git cat-file -e 335bfb70^{commit}`) e é ancestor do HEAD (`git merge-base --is-ancestor 335bfb70 HEAD`). Não capturar/derivar BASE_SHA do HEAD corrente nem da ordem de commits paralelos.

Instância descartável (workdir/project_id e registro de preflight):

- Workdir fixo: `C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated`
- project_id exigido: `vendeo-f562a-isolated`
- SERVICE_ROLE_KEY: registrar somente origem/disponibilidade redigida; nunca persistir segredo nem saída env bruta.

## Preflight antes da única inicialização

- prestart_gate: `passed`
- prestart_timestamp: `2026-10-07T13:35:02-03:00`
- BASE_SHA: `335bfb70` (commit existe e é ancestor do HEAD)
- Configuração: project_id exato `vendeo-f562a-isolated`
- configured_ports: `[56320, 56321, 56322, 56323, 56324, 56327, 56329]`
- prestart_ports_exclusive: `true`
- prestart_ports_conflicts: `none` (sem interseção com F56.1 `55320–55329`, Vendeo_V3 ou listeners locais)
- Espaço antes do start: C: `19.16 GiB` livres; G: `48.71 GiB` livres
- Docker Desktop: backend WSL 2 ativo; disk image em `G:\DockerDesktopData-F56.2a\DockerDesktopWSL\disk\docker_data.vhdx` (`14.03 GiB` alocados)
- F56.1 antes do start: DB/Auth/Kong `running, healthy`; PostgREST `running`; volume `supabase_db_vendeo-f561-isolated` presente; rede `supabase_network_vendeo-f561-isolated` presente
- Prova de conteúdo F56.1 (somente leitura): versão do par `b3fa7b83-a0aa-48db-8f02-9bcbdd32bbe8`; principal `gpt-image-2.5-sunburst / medium`; fallback `gpt-image-2 / medium`; 4 auditorias de `image_model_pair_config_update`; 0 diagnósticos
- Backup lógico pré-mudança F56.1 (fora do repositório): `G:\F56.1-Docker-Move-Backup-20261007\f561-postgres-pre-move.dump`; SHA-256 `9FC88FF7A76927EA1E6034E3B05E775DC7296230450B42A44F2FC0010F024AF2`; `pg_restore --list` exit 0; manter intacto até comparação pós-mudança
- F56.2a antes do primeiro start: nenhum serviço ativo, nenhum volume/rede; containers parados `supabase_inbucket_vendeo-f562a-isolated` e `supabase_vector_vendeo-f562a-isolated` preservados, não remover
- initial_start_command: `supabase start --workdir "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated" --exclude mailpit`
- Tentativa 1: initial command acima; `start_invocations: 1`; `initial_start_exit_code: nonzero_numeric_unavailable` (a ferramenta informou falha, mas não expôs código numérico); mailpit-only; poststart gate: `blocked`
- Erro da tentativa 1: `failed to create docker container: Conflict. The container name "/supabase_vector_vendeo-f562a-isolated" is already in use by container "5d0330b2982ae7f8be3e054db13ad4ff06024c1b2eedae6e7111f4616b57289a". You have to remove (or rename) that container to be able to reuse that name.`
- Inspeção read-only subsequente: `docker inspect 5d0330b2982ae7f8be3e054db13ad4ff06024c1b2eedae6e7111f4616b57289a` retornou `no such object`; `docker ps -a` não lista containers F56.2a. O container conflitante desapareceu sem intervenção nesta recuperação; nenhuma operação `docker rename` ocorreu. Nenhum container foi removido manualmente pelo executor.
- Autorização de recuperação: instrução explícita do responsável em 2026-10-07; permite exatamente uma tentativa adicional, somente após confirmar o ID conflitante ausente e sem rename. Não é retry automático nem autorização para tentativa em cascata.
- recovery_attempt_number: `2`
- recovery_start_invocations: `0` (pendente da nova execução autorizada)
- recovery_authorized_at: `2026-10-07T13:43:52-03:00`
- recovery_attempt_limit: `1`
- recovery_authorization: explícita no pedido do responsável em 2026-10-07; tentativa adicional somente para resolver o conflito já desaparecido, sem retry automático
- recovery_start_command: `supabase start --workdir "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated" --exclude mailpit`
- conflicting_container_id: `5d0330b2982ae7f8be3e054db13ad4ff06024c1b2eedae6e7111f4616b57289a`
- conflict_inspection_result: `docker inspect` retornou `no such object`; `docker ps -a` sem containers F56.2a
- rename_performed: `false`
- recovery_prestart_gate: `passed`
- recovery_start_exit_code: `pending`
- recovery_poststart_gate: `pending`
- recovery_prestart_timestamp: `2026-10-07T14:06:15-03:00`
- recovery_prestart_project_id: `vendeo-f562a-isolated`
- recovery_configured_ports: `[56320, 56321, 56322, 56323, 56324, 56327, 56329]`; únicas, no intervalo e livres; sem conflito com F56.1
- recovery_C_free: `19.11 GiB`
- recovery_G_free: `48.71 GiB`
- recovery_F56_1: DB/Auth/Kong `running, healthy`; PostgREST `running`; volume e rede presentes
- recovery_conflict_id_absent: `true` (confirmed absent again with `docker ps -a --no-trunc` immediately before start)
- recovery_F56_2a_before_start: nenhum container, volume ou rede; nenhum rename
- recovery_backup_sha256_unchanged: `9FC88FF7A76927EA1E6034E3B05E775DC7296230450B42A44F2FC0010F024AF2`
- Estado após a falha: C: `19.16 GiB` livres; G: `48.71 GiB` livres; F56.1 DB/Auth/Kong `running, healthy`, PostgREST `running`; volume e rede F56.1 presentes e inalterados
- Backup pré-mudança permanece intacto em G:, SHA-256 ainda `9FC88FF7A76927EA1E6034E3B05E775DC7296230450B42A44F2FC0010F024AF2`
