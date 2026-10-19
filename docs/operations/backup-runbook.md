# Runbook de Backup e Continuidade

**Escopo:** F50 e beta fechado, enquanto banco, autenticação e Storage permanecem no Supabase.

**Objetivo:** manter uma cópia externa, privada, criptografada e restaurável do banco e dos objetos antes do primeiro convite.

## Regras

- O backup externo não é migração para R2 nem mudança do Storage primário.
- O destino deve estar fora do domínio de falha do Supabase e com acesso privado, MFA e auditoria.
- Credenciais, chaves de criptografia, dumps, manifestos e objetos copiados ficam fora do Git.
- A retenção é rotativa por 30 dias, com exclusão segura das cópias expiradas.
- Nunca registrar secrets, tokens ou conteúdo sensível em logs de CI.

## Conteúdo do Backup

1. Gerar dump lógico consistente do banco Supabase, incluindo schema, dados, funções, policies e metadados necessários para restauração.
2. Enumerar todos os buckets, incluindo `campaign-images`, `lab-artifacts`, `store-brand-assets`, `visual-signatures` e `store-logos`.
3. Copiar cada objeto preservando bucket, storage path, mime type, tamanho e checksum SHA-256.
4. Gerar um manifesto imutável com timestamp, versão da ferramenta, contagem de linhas, contagem de objetos, bytes e checksums.
5. Criptografar dump, manifesto e objetos antes do envio, usando uma chave gerenciada fora do repositório.
6. Enviar para o destino externo privado e validar o checksum remoto antes de considerar a execução concluída.

## Execução Operacional

- Executar em ambiente de operação controlado, com service role temporária e menor privilégio possível.
- Usar diretório temporário fora do workspace para arquivos intermediários.
- Nomear a execução por timestamp e manter o manifesto junto da cópia criptografada.
- Repetir a execução diariamente ou conforme o SLA operacional definido, mantendo no máximo 30 dias de retenção rotativa.
- Após a cópia, verificar que nenhum artefato foi criado no workspace ou incluído no índice Git.
- Registrar apenas o identificador da execução, horário, contagens, checksums e resultado; não registrar credenciais.

## Decisões Obrigatórias Antes do Corte

Estas decisões não são preenchidas automaticamente neste runbook e devem ser registradas pelo responsável operacional antes do primeiro convite:

- **Destino externo:** provedor, conta/projeto, região e domínio de falha independente.
- **Criptografia:** algoritmo, ferramenta/KMS, custódia, rotação e procedimento de recuperação da chave.
- **Restauração:** ambiente isolado, responsável, janela, acesso temporário e descarte seguro após a validação.
- **Retenção:** responsável pela limpeza e evidência de que cópias com mais de 30 dias não permanecem acessíveis.

## Teste Real de Restauração

O teste real é um gate do corte 50-14 e deve ocorrer antes da liberação do primeiro convite. Em ambiente isolado:

1. Baixar uma cópia criptografada e descriptografar usando a chave sob custódia controlada.
2. Restaurar o dump em um banco separado, sem apontar a aplicação de produção para ele.
3. Comparar contagem de linhas e checksums do banco e do manifesto original.
4. Restaurar os metadados dos buckets e todos os objetos de uma amostra representativa, incluindo um bucket privado de identidade.
5. Comparar contagem, bytes, mime types e SHA-256 dos objetos restaurados.
6. Gerar uma URL assinada para um arquivo restaurado e comprovar leitura HTTP bem-sucedida.
7. Registrar evidência com identificador da execução, timestamps, contagens, checksums, bucket/path testado e resultado.
8. Destruir o ambiente temporário, URLs assinadas e cópias de trabalho após a validação.

### Resultado Validado — F50

O teste real foi executado em `2026-09-23` exclusivamente a partir do backup
`C:\Vendeo-Backups\f50-post-migration-20260923-clean`.

- Resultado: **RESTORE VALIDADO**.
- Ambiente isolado: `f50_restore_20260923`.
- Portas isoladas: API `55431`, banco `55432`, Studio `55433`, Inbucket `55434`, analytics `55437`.
- Banco, roles, schema e dados restaurados; estruturas F50 presentes.
- Ledger validado sem inconsistências; cinco buckets privados confirmados.
- `419/419` objetos restaurados e validados por SHA-256; URL assinada e download com checksum confirmado.
- Nenhuma escrita remota foi executada; o ambiente Vendeo original permaneceu preservado.
- O índice temporário `restore_objects_bucket_name_compat` foi criado exclusivamente no banco isolado para compatibilidade com o runtime local. Ele não pertence ao backup e não deve virar migration de produção.

O ambiente isolado foi mantido após o teste para inspeção posterior autorizada. A
evidência detalhada permanece fora do Git.

Sem evidência de restauração de banco, metadados e objetos, o primeiro convite permanece bloqueado, mesmo que a implementação técnica da F50 esteja concluída.

## F56.2b2d — Backup Verificável Antes das Migrations do Release

Esta seção é **obrigatória** antes de qualquer migration do conjunto definitivo do release
F56.2b2d (ver `f56-2b2d-release-runbook.md`, etapa 1). A verificação de restauração ocorre
**antes** das migrations remotas, em checkpoint humano próprio.

### Estado real do projeto Free (fato, não presunção)

- O projeto de produção está no **plano Free**, que **NÃO oferece backup restaurável gerenciado**.
  Não existe cópia gerenciada do próprio Supabase para a qual recorrer após um erro.
- `walg_enabled=true` e `backups=[]` (estado observado) **NÃO provam restaurabilidade**. WAL-G
  habilitado não é prova de que existe uma cópia restaurável e íntegra; a lista de backups vazia
  confirma que não há ponto de restauração gerenciado disponível.
- **PITR está desabilitado** (`pitr_enabled=false`). Portanto **nenhum procedimento aqui presume
  point-in-time recovery**; a restauração depende exclusivamente do backup externo produzido por
  este runbook.

### Backup do banco e dos objetos de Storage

Repetir o fluxo já descrito em *Conteúdo do Backup* e materializar, para esta fase:

1. Dump lógico do banco com schema, dados, funções, policies e metadados.
2. Cópia de **todos** os objetos de Storage (buckets privados e artefatos), preservando bucket,
   storage path, mime type, tamanho e checksum SHA-256.
3. Manifesto imutável com timestamp, versão da ferramenta, **contagem de linhas, contagem de
   objetos, bytes e SHA-256** de cada item.
4. Criptografar e enviar ao destino externo privado, validando o checksum remoto.

### Restauração comprovada em destino LOCAL SEPARADO

- A restauração é executada em um **destino local separado**, **sem sobrescrever o ambiente
  `vendeo-homolog`**. O ambiente isolado é descartável e não aponta a aplicação para ele.
- Comparar **contagens e checksums** do banco restaurado com o manifesto.
- Restaurar os metadados dos buckets e uma amostra representativa de objetos, comparando
  **contagem, bytes e SHA-256**, e comprovando leitura via URL assinada.
- Sem esta evidência, as migrations do conjunto definitivo **permanecem bloqueadas**.

### Evidência

- Guardar a evidência (manifesto, relatório de restauração, checksums e prova de leitura assinada)
  **fora do Git**, no sistema de evidências do responsável. Nunca versionar dumps, objetos ou chaves.
- Registrar apenas identificador da execução, timestamps, contagens, checksums e resultado.

## Verificação de Segredos e Git

- Usar variáveis de ambiente ou secret manager para service role, destino e chave de criptografia.
- Não salvar dumps, arquivos de objetos, manifests, chaves ou credenciais em `docs/`, `supabase/`, `scripts/` ou qualquer diretório versionado.
- Confirmar antes de cada execução: `git status --porcelain` não contém artefatos de backup, `.env` ou secrets.
- Confirmar depois de cada execução que o destino externo é privado e que o workspace não contém arquivos temporários.

## Evidências do Gate

Guardar fora do Git, no sistema operacional de evidências definido pelo responsável:

- manifesto criptografado e checksum da cópia;
- relatório de restauração com contagens e checksums;
- prova de leitura assinada do objeto restaurado;
- aprovação do responsável pelo destino, chave e restauração.
