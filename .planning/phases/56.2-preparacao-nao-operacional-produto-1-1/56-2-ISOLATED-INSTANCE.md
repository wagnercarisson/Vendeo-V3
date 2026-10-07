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
- F56.2a antes do start: nenhum serviço ativo, nenhum volume/rede; containers parados existentes `supabase_inbucket_vendeo-f562a-isolated` e `supabase_vector_vendeo-f562a-isolated` preservados, não remover
- Comando executado uma única vez: `supabase start --workdir "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated" --exclude mailpit`
- start_timestamp: `2026-10-07` (horário local; tentativa única)
- start_invocations: `1`
- start_exit_code: `nonzero` (o shell informou falha, mas não expôs o código numérico)
- mailpit_exclusion_only: `true`
- Post-start gate: `blocked`; sem API loopback/status aprovado e sem serviços F56.2a ativos após a tentativa
- Erro: `failed to create docker container: Conflict. The container name "/supabase_vector_vendeo-f562a-isolated" is already in use by container "5d0330b2982ae7f8be3e054db13ad4ff06024c1b2eedae6e7111f4616b57289a". You have to remove (or rename) that container to be able to reuse that name.` Nenhum container foi removido manualmente; nenhuma segunda tentativa será feita.
- Estado após a falha: C: `19.16 GiB` livres; G: `48.71 GiB` livres; F56.1 DB/Auth/Kong `running, healthy`, PostgREST `running`; volume e rede F56.1 presentes e inalterados
- Backup pré-mudança permanece intacto em G:, SHA-256 ainda `9FC88FF7A76927EA1E6034E3B05E775DC7296230450B42A44F2FC0010F024AF2`
