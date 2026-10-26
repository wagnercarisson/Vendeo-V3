# Códigos de erro e referências de suporte

Decisão aprovada em 25/10/2026. Adoção gradual: esta convenção não declara que
todos os fluxos existentes já a implementam nem autoriza uma refatoração global.

## Objetivo

Dar ao lojista um código curto e compreensível para comunicar ao suporte, sem
expor detalhes técnicos. Preservar internamente a correlação com a ocorrência
real, a loja, a operação e o diagnóstico seguro.

## Três informações distintas

| Informação | Finalidade | Exposição |
| --- | --- | --- |
| Código público | Identificar a rotina e a categoria funcional do problema | Usuário e suporte |
| Referência interna | Identificar a tentativa/ocorrência específica, por exemplo `operation_run_id` | Registros internos e ferramentas autorizadas de suporte |
| Classificação técnica | Identificar a natureza da falha, por exemplo `provider_error` | Registros internos; não mostrar diagnóstico bruto ao usuário |

Um código público pode aparecer em várias ocorrências. Ele não substitui a
referência interna e não é um identificador único de incidente.

## Formato e estabilidade

- Usar somente letras maiúsculas ASCII e números, com até 8 caracteres:
  `^[A-Z0-9]{1,8}$`.
- Preferir prefixo reconhecível do domínio/rotina e sufixo numérico de categoria.
  Consultar o catálogo antes de criar um código para evitar duplicação.
- Não incluir dados da loja, do usuário ou do provider no código.
- Não truncar UUID para fabricar um código que pareça identificar unicamente
  uma ocorrência.
- Depois de publicado, não reutilizar o código para outro significado. Se
  necessário, descontinuá-lo preservando sua descrição histórica.
- Registrar novos códigos, significado e âmbito neste catálogo. Não é preciso
  criar um código diferente para cada exceção técnica subjacente.

## Catálogo inicial aprovado

| Código | Rotina e significado | Âmbito |
| --- | --- | --- |
| `DVAP01` | Falha ao concluir a direção visual após aprovação da assinatura | Assinatura aprovada e preservada; direção não concluída |
| `DVRE01` | Falha ao realinhar uma direção visual pendente | Recuperação da direção da assinatura ativa |

Estes códigos documentam o contrato aprovado. A implementação e a validação
pertencem às entregas específicas; este documento não comprova sua execução.
`DVRE01` não redefine a política de realinhamento comum com perfil válido.

## Mensagem ao usuário

- Explicar o que aconteceu, o que foi preservado, o impacto e a ação disponível.
- Exibir o código público uma única vez por aviso/modal, sem repetir UUID na
  mensagem ou acrescentar uma segunda linha com a mesma informação.
- Não expor erro bruto do provider, SQL, stack trace, URLs assinadas, conteúdo
  de imagens, chaves ou credenciais.
- Não afirmar bloqueio, sucesso ou recuperação que o estado persistido não
  confirme. O código é diagnóstico; não altera regras de negócio.

Exemplo para a falha após aprovação:

> Sua assinatura foi aprovada, mas não conseguimos concluir a direção visual.
> A geração de campanhas ficará indisponível até a conclusão. Entre em contato
> com o suporte e informe o código **DVAP01**. Após a orientação do suporte,
> clique em **Realinhar direção visual**.

## Persistência e rastreabilidade

- Manter o catálogo em código e sua descrição neste documento. Reutilizar as
  estruturas de eventos e metadata JSONB existentes quando adequadas; não criar
  tabela ou migration apenas para padronizar a apresentação.
- Correlacionar código público, referência interna, loja, rotina, ativo quando
  aplicável, horário e classificação técnica segura. Não duplicar dados sensíveis
  ou guardar payloads brutos para cumprir esta convenção.
- Preservar a classificação conhecida do gateway/provider. Usar
  `unexpected_error` apenas quando a natureza da falha não puder ser determinada.
- Para avisos persistentes, manter a associação da ocorrência para que ela
  continue rastreável após reload ou novo login.
- Preservar referências e eventos históricos; não executar backfill nem
  reescrever ocorrências antigas só para adotar a convenção. Quando possível,
  derivar a exibição do código a partir de evidência histórica suficiente.
- O suporte usa código público + loja + horário para localizar a ocorrência e
  sua referência interna. A capacidade de consulta deve ser verificada na
  entrega; trocar o texto na tela, sozinho, não cria uma ferramenta de suporte.

## Evolução futura

Uma tabela própria pode ser avaliada ao projetar o painel de suporte, caso haja
necessidade de catálogo administrável, busca de incidentes, permissões, histórico
ou auditoria específicos. Não é requisito atual e não autoriza implementação.
Novos fluxos devem adotar a convenção dentro de seu próprio escopo aprovado,
preservando contratos e comportamentos existentes.
