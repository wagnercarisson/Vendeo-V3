# Alinhamento — Onboarding do responsável e CNPJ opcional

**Data:** 2026-11-26

**Estado:** linha guia de produto e divisão de entrega alinhadas com o responsável pelo projeto. Implementação não iniciada por este registro.

## 1. Objetivo e autoridade deste documento

Abrir o Vendeo a profissionais autônomos e negócios com ou sem CNPJ, exigindo a identificação do responsável pela conta e o aceite dos documentos aplicáveis antes de permitir gerações.

Este documento consolida as decisões da conversa e a ordem das fatias. Orienta o detalhamento posterior no OpenSpec, fonte da verdade funcional e técnica, e no GSD, responsável pelo planejamento e tracking. Não substitui uma proposta OpenSpec revisada, não constitui plano executável de todas as fatias e não autoriza implementação ou operações remotas.

Os números abaixo identificam fatias desta iniciativa, não números de fases já atribuídos no roadmap. A próxima atividade é detalhar a fatia 1.

## 2. Decisões consolidadas

### 2.1 Responsável, negócio e faturamento

- A identificação do responsável pertence a um módulo protegido, com tabelas e acessos próprios, separado dos dados comerciais de usuário/loja consumidos pelo restante da aplicação.
- O vínculo com a conta usa o identificador interno do usuário. Os geradores não precisam receber CPF, nome civil, endereço pessoal ou contatos privados.
- O mesmo CPF pode aparecer em várias contas, cada uma dedicada a um negócio. Não haverá unicidade global de CPF no cadastro dos responsáveis.
- O negócio mantém nome público, segmento, posicionamento, identidade visual e localização comercial. O CNPJ passa a ser opcional; quando informado, continua sujeito à validação pertinente.
- Dados do responsável, endereço comercial do negócio e dados fiscais do tomador são conjuntos distintos. Alterações em um não devem sobrescrever os demais automaticamente.
- Faturamento poderá aproveitar dados do responsável ou da empresa mediante confirmação. O tomador usado em cada contratação deve ser preservado independentemente de edições posteriores.

### 2.2 Organização das telas e autorização

As quatro abas serão, nesta ordem:

1. Identificação do responsável.
2. Dados do negócio, mantendo os aceites contratuais nesta etapa.
3. Posicionamento.
4. Direção visual.

A identificação válida do responsável e os aceites vigentes substituem a obrigatoriedade de CNPJ como condição cadastral para geração. Permanecem as demais condições atuais, como preparação visual, saldo, disponibilidade e autorização da operação.

O bloqueio deve existir no servidor nas entradas de geração, além da interface. A mudança deve preservar o processamento interno dos geradores, as reservas/estornos e os fluxos visuais existentes. A criação da direção visual durante o onboarding não pode exigir que ela já esteja concluída.

Durante pendência cadastral, o usuário deve conseguir acessar o caminho de regularização, os documentos, o suporte e a saída da conta. Consulta/conciliação de operações já iniciadas precisa ser distinguida de uma nova chamada de geração.

#### Navegação por dependências e salvamento

- Manter o botão Salvar. Ao escolher uma aba posterior, validar os dados necessários da etapa atual e, se completos, salvar sem confirmação adicional e avançar somente após sucesso no servidor.
- Se faltar informação, permanecer na etapa e apontar os campos pendentes. Em falha de salvamento, preservar o preenchimento, informar o problema e não avançar como se os dados estivessem persistidos.
- A navegação respeita a hierarquia Responsável → Dados do negócio → Posicionamento → Direção visual. Ao escolher uma etapa sem seus pré-requisitos, abrir a primeira etapa pendente, em vez de ignorar dependências.
- Exemplo: responsável completo e dados do negócio pendentes; clicar em Direção visual salva o responsável e abre Dados do negócio. Posicionamento também deve estar atendido antes de abrir a direção visual, conforme seus requisitos.
- A consulta a uma aba anterior não exige completar a etapa atual. Edições não podem ser descartadas silenciosamente.
- Salvamento silencioso na navegação não dispensa a confirmação/aceite obrigatórios quando houver troca de CPF.

### 2.3 Alterações cadastrais e responsável

- Alterar campos pessoais não dispara realinhamento de direção visual, reprocessamento de logo/perfil/assinatura nem nova concessão.
- As regras existentes de realinhamento por alterações comerciais permanecem as mesmas.
- Correções de nome ou mudanças de telefone/endereço são atualizações cadastrais auditáveis.
- CPF é validado durante o preenchimento e novamente no servidor. Não tentar distinguir uma correção de CPF informado incorretamente de uma troca efetiva da pessoa responsável: qualquer CPF diferente do salvo segue o mesmo procedimento de substituição.
- Toda troca de CPF abre modal com acesso aos documentos legais, checkbox desmarcado e confirmação explícita do responsável na sessão autenticada. Quem informou o CPF errado também passa por esse aceite simples.
- Cancelar mantém o cadastro anterior. Confirmar persiste a alteração e o novo aceite de forma consistente, sem salvar o CPF novo antes da confirmação. Redação final da modal será detalhada na fatia 1; o gatilho já está fechado: mudança do CPF salvo.
- O registro comprova a declaração feita naquela sessão, não a identidade civil documental de quem opera. Novo aceite é uma regra contratual/de evidência do Vendeo, não uma obrigação legal universal para toda atualização cadastral.
- O registro deve distinguir a versão do responsável que aceitou, mesmo que `user_id` e versão dos Termos sejam iguais aos do aceite anterior.
- Transferência entre contas autenticadas distintas não integra esta iniciativa.

### 2.4 Oferta única por conta e CPF

**Uma concessão nova exige que nem a conta nem o CPF tenham recebido a oferta anteriormente.**

| Situação | Regra |
|---|---|
| Conta e CPF sem benefício anterior | Podem receber a oferta, atendidas as demais condições de conclusão e elegibilidade |
| Mesmo CPF em outra conta após concessão | Cadastro permitido; não recebe outra oferta |
| Conta beneficiada troca para CPF nunca beneficiado | Não recebe outra oferta |
| CPF cadastrado, sem concessão efetiva | O simples cadastro não consome o benefício |
| Créditos consumidos ou vencidos | Não renovam a elegibilidade |
| Dados alterados ou conta excluída | Não devem permitir reiniciar o benefício; retenção da evidência precisa de definição própria |
| Chamadas repetidas ou simultâneas | No máximo uma concessão válida, sem gravação parcial |

A concessão registra o `user_id` e a referência protegida do CPF beneficiado naquele momento. Alterações posteriores do cadastro não reescrevem essa evidência. A simples troca de CPF de uma conta já beneficiada também não deve marcar o novo CPF como beneficiado sem concessão a ele.

A carteira, o consumo, as reservas e os estornos permanecem vinculados a `store_id`. O controle de elegibilidade por CPF fica no domínio protegido, sem enviar o documento aos geradores. O identificador pessoal pode se repetir no cadastro; a unicidade do benefício é uma regra separada.

Não adotar janela promocional compartilhada entre contas, distribuição de um teto de créditos entre negócios ou renovação mensal da oferta. Essas alternativas foram descartadas em favor da regra simples acima.

#### Base versionada e condições adquiridas

**A referência desta entrega é a oferta atual de até 20 créditos em 28 dias, em quatro parcelas de 5 créditos nos dias 0, 7, 14 e 21.** Redução de quantidade ou duração e painel de edição pelo Admin ficam para evolução futura; não antecipar a oferta de 10 créditos/15 dias nesta iniciativa.

A estrutura atual `trial_offer_settings` controla principalmente ativação e marcos; duração, quantidade e calendário ainda aparecem fixos em código/SQL. Criar a base parametrizada não basta: os consumidores previstos nesta entrega devem passar a usá-la conforme suas fatias, preservando os caminhos antigos necessários à transição.

Separar os seguintes conceitos, com nomenclatura física a definir no desenho técnico:

| Conceito | Responsabilidade |
|---|---|
| Oferta | Identidade estável do programa promocional, independente da versão |
| Versão da oferta | Condições publicadas e imutáveis: duração, total máximo e calendário de parcelas |
| Configuração vigente | Referência à versão utilizada para novas concessões e divulgação atual |
| Concessão | Conta, referência protegida do CPF, versão imutável e referência às condições adquiridas |

Campos iniciais alinhados para a base de versões:

| Campo/conjunto | Preenchimento inicial ou regra |
|---|---|
| Identificador e versão | Referência única e imutável |
| Nome público | Teste gratuito de 28 dias |
| Duração | 28 dias |
| Total máximo | 20 créditos |
| Calendário | 5 créditos nos dias 0, 7, 14 e 21 |
| Estado de publicação | Controla disponibilidade da versão para uso |
| Registro administrativo | Autor, data e motivo da publicação |

Definir estes campos e seu preenchimento antes da implementação dos consumidores. A subfatia 2A cria/preenche a base inicial; a fatia 4 integra o motor de concessão. Versões publicadas não são editadas: uma futura alteração pelo Admin publica outra versão e a torna vigente para novas concessões.

- Divulgação e páginas para novos cadastros leem a versão vigente. Informações numéricas devem ser derivadas da base, evitando textos independentes e divergentes sobre créditos e dias.
- Na concessão, resolver e registrar a versão e suas condições de forma consistente. Telas do beneficiário e processamento de parcelas/vencimento usam a concessão original, não a configuração vigente.
- Exemplo: conta recebe oferta de 20 créditos; Admin publica oferta de 10; essa conta mantém os 20 nas condições/calendário originais e novas concessões passam a usar os 10.
- Publicar uma versão nova não reinicia a elegibilidade de conta ou CPF já beneficiados. A unicidade do benefício não pode ser limitada somente à versão da oferta.
- Desativar novas adesões não cancela concessões, parcelas ou condições já adquiridas.
- A leitura de parâmetros inclui processamento no servidor e apresentação do benefício; remover apenas constantes da interface deixaria a configuração incompleta.
- A base e seus contratos são construídos agora; o painel completo de edição/publicação de ofertas pelo Admin fica fora desta sequência.

### 2.5 Privacidade, contato e auditoria

- Dados pessoais só devem ser lidos para cadastro/edição, faturamento, contato necessário ou consulta legal/administrativa autorizada.
- Exibição mascarada por padrão; respostas de API também devem limitar os dados, sem enviar valores completos apenas para escondê-los na tela.
- Leitura completa deve ser restrita à finalidade e ao ator autorizado, com rastreabilidade quando pertinente.
- Dados pessoais não entram em prompts, snapshots comerciais, logs gerais ou no rascunho comercial atual em armazenamento local do navegador.
- Nome e contatos podem ser apresentados ao suporte quando necessários. Comunicação promocional deve respeitar finalidade, base de tratamento e preferências; aceite dos Termos não concede automaticamente autorização de marketing.
- Auditoria deve registrar eventos necessários e preservar a atribuição histórica, sem espalhar cópias de CPF/endereço por registros genéricos.
- Campos, retenção e acesso decorrentes de obrigação legal devem ser distinguidos dos requisitos definidos pelo produto. A lista do esboço inicial não constitui comprovação de obrigação legal de coletar todos os campos.

### 2.6 Usuários existentes

Segundo o responsável pelo projeto, a base atual é pequena, majoritariamente familiar e sem clientes ativos dependentes da manutenção de ofertas antigas. Não ampliar esta iniciativa com uma transição comercial complexa para essa base.

Após a implantação e ativação, os usuários existentes serão direcionados a completar o cadastro do responsável/CPF e realizar o reaceite aplicável. A conferência dos dados empresariais será oferecida sem exigir CNPJ. Dados comerciais, campanhas e direção visual existentes serão aproveitados.

Preservar saldos e históricos por padrão. Eventuais divergências devem ser identificadas e tratadas pontualmente com evidência, sem compensação automática implícita. O requisito central é oferecer um caminho funcional de regularização e continuidade de acesso.

**A preparação/migração efetiva e a transição dos usuários existentes são a última fatia.** Antes disso, somente ensaios em homologação. A estrutura nova pode ser criada antes; marcar usuários reais como pendentes ou obrigá-los a atualizar fica para o final.

## 3. Sequência das fatias

Cada fatia deve ter seu próprio recorte OpenSpec/GSD conforme o fluxo do projeto, entrega demonstrável, revisão e evidência de fechamento. Aprovar um fechamento local não equivale a aprovar publicação ou ativação. Os testes específicos acompanham cada fatia; não são todos adiados para a fatia 7.

### Fatia 1 — Contrato funcional e campos

**Entrega:** fechar campos, obrigatoriedade, validações, acesso, edição, privacidade, aceites e comportamento de acesso. Incorporar o gatilho já definido para toda troca de CPF, a navegação por dependências e o contrato de oferta versionada com preenchimento inicial de 28 dias/20 créditos. Definir fronteiras de faturamento e a transição simples dos usuários existentes.

**Fechamento:** decisões e cenários de aceite revisados, sem dúvida material que impeça projetar a base de dados. As sugestões iniciais de campos são confirmadas ou ajustadas aqui.

### Fatia 2 — Bases de dados, em duas subfatias fecháveis

Executar e validar 2A e 2B separadamente, após o contrato da fatia 1. A divisão mantém nove fatias principais e evita concentrar duas bases distintas em uma única entrega.

#### Fatia 2A — Base versionada de ofertas

**Depende de:** 1.

**Entrega:** estrutura de oferta, versão imutável publicada, referência vigente, preenchimento inicial e leitura centralizada. Preparar o contrato que permitirá registrar condições adquiridas na concessão e fornecer dados públicos da oferta. Sem construir o painel de edição do Admin ou alterar concessões reais.

**Fechamento:** base e leitura verificadas em ambiente de teste; oferta inicial corresponde a 28 dias, até 20 créditos e calendário 0/7/14/21 de 5 créditos. Versão publicada não pode ser alterada; mudar a referência vigente não altera a versão anterior. Sem dados pessoais nos dados públicos da oferta e sem mudança prematura dos consumidores atuais de produção.

A leitura do calendário é pura, sem reserva de créditos. A validação desta subfatia é de homolog local e não equivale a aprovação de produção; a integração de `offer_version_id`, a RPC/painel Admin e a troca de fonte dos consumidores pertencem às fatias seguintes.

#### Fatia 2B — Estrutura protegida do responsável

**Depende de:** 1; executar após fechar 2A na sequência desta iniciativa.

**Entrega:** tabelas do responsável, vínculo com a conta, versão cadastral, auditoria necessária e permissões. CPF repetível no cadastro; sem incluir os dados pessoais nas estruturas comerciais. Definir as garantias de armazenamento/proteção pertinentes ao contrato.

**Fechamento:** migrations aplicadas e verificadas no ambiente de teste previsto, incluindo isolamento entre contas e restrição de leitura. Nenhum dado comercial existente alterado. Sem migração dos usuários reais.

### Fatia 3 — Serviços e APIs do responsável

**Depende de:** 2B.

**Entrega:** leitura, edição, validação no servidor, projeções mascaradas, resultado cadastral mínimo para autorização e evidência de aceite ligada à versão do responsável. Preparar o salvamento consistente de toda troca de CPF e do novo aceite, sem tentar classificá-la como correção ou substituição real.

**Fechamento:** operações verificadas independentemente da UI, tentativas de acesso indevido bloqueadas, dados completos restritos e alterações sem chamar serviços visuais. Nenhum bloqueio obrigatório ativado.

### Fatia 4 — Nova regra de concessão da oferta

**Depende de:** 2A e 3, conforme contrato da fatia 1.

**Entrega:** controle conjunto por conta e CPF, evidência histórica protegida, crédito na carteira existente e convivência explícita com os caminhos antigos de concessão. Consumir a base 2A e registrar a referência à versão imutável na concessão. Parcelas, vencimento e apresentação do benefício usam a oferta adquirida; novas concessões consultam a vigente. Integrar as leituras de concessão/divulgação previstas, com projeções próprias e números derivados da base. Momento da concessão segue o contrato da fatia 1.

**Fechamento:** provas de concessão única, repetição, concorrência, falha sem gravação parcial e troca posterior de CPF. Comprovar que uma nova versão muda somente novas concessões, mantendo parcelas/vencimento/apresentação das anteriores e sem reiniciar elegibilidade. Conferir coerência entre divulgação e concessão. A regra funciona sem depender da nova interface e sem duplicar benefício por um caminho antigo. Sem novas concessões em produção nesta etapa.

### Fatia 5 — Nova aba e ajustes pontuais no onboarding

**Depende de:** 3–4.

**Entrega:** aba do responsável e integração com as três abas atuais, mantendo os aceites na segunda. Edição/retomada, mascaramento, validação e modal obrigatória para toda troca de CPF. Botão Salvar e salvamento ao avançar, com sucesso confirmado no servidor; etapas posteriores levam à primeira dependência pendente, sem perda silenciosa de edição ao voltar. Preparar documentos revisados e sua apresentação, sem ativar versões obrigatórias em produção antecipadamente.

**Fechamento:** percurso visual em desktop/mobile, persistência, navegação hierárquica e edição comprovados. Cobrir salvar ao avançar, campos faltantes, falha no servidor, salto para Direção visual com dados do negócio pendentes e cancelamento/confirmação da troca de CPF. Dados pessoais não entram no rascunho comercial; alterações pessoais não provocam realinhamento. A exigência global continua desativada.

### Fatia 6 — Liberação de acesso e CNPJ opcional

**Depende de:** 4–5.

**Entrega:** substituir a obrigatoriedade fiscal pela identificação válida e pelos aceites na autorização; ajustar mensagens e navegação; integrar a oferta ao momento correto de conclusão. Preparar o direcionamento futuro dos usuários existentes sem executá-lo em produção.

**Fechamento:** usuário sem CNPJ conclui onboarding e gera; cadastro incompleto não gera nem por API direta; demais condições atuais continuam operantes. Configuração visual não sofre bloqueio circular e operações já iniciadas têm tratamento definido.

### Fatia 7 — Validação integrada e preparação da publicação

**Depende de:** 6.

**Entrega:** UAT e evidências integradas em homologação, ensaio da futura transição de usuários existentes e roteiro de implantação, publicação documental, ativação e contingência.

**Fechamento:** cenários completos aprovados, verificações técnicas exigidas pelo projeto concluídas e roteiro executável. Cobrir usuário novo com/sem CNPJ, CPF repetido, conta beneficiada com CPF alterado, substituição do responsável, usuário existente e ausência de dados pessoais nos geradores. Contingência deve considerar usuários válidos sem CNPJ.

### Fatia 8 — Publicação do novo fluxo em produção

**Depende de:** 7 e autorização específica para as operações remotas.

**Entrega:** estrutura e código compatíveis publicados, com exigência cadastral e novas concessões ainda desativadas até a sequência de ativação. Conferir deployment e acessibilidade das telas necessárias à regularização.

**Fechamento:** versão publicada verificada e fluxo preparado em produção, sem direcionar a base atual para pendência. Publicação não equivale à ativação da abertura ou do bloqueio obrigatório.

### Fatia 9 — Transição dos usuários existentes e ativação

**Depende de:** 8 e autorização específica para migração/ativação.

**Entrega:** preparar/migrar os vínculos dos usuários existentes, ativar o direcionamento para CPF e reaceite e habilitar o novo acesso/oferta na ordem ensaiada. Não inferir nome civil de razão social ou preencher dados pessoais inexistentes.

**Fechamento:** conta existente consegue regularizar e continuar usando; conta nova sem CNPJ conclui o fluxo; bloqueios e concessão única comprovados em produção. Histórico, identidade visual e continuidade de acesso conferidos; tracking reconciliado.

## 4. Pontos a fechar na fatia 1

1. Dicionário final de campos: proposta inicial de nome civil, CPF, telefone, país, CEP, logradouro, número/opção sem número, complemento opcional, bairro, cidade e UF. E-mail e confirmação vêm da autenticação. Definir obrigatoriedade e regras de consistência.
2. Significado de validação: formato/dígitos de CPF e consistência cadastral não comprovam identidade civil. Não adicionar documento, selfie ou verificação externa implicitamente.
3. Redação final da modal e evidência da troca de CPF/aceite. O gatilho já está fechado: qualquer alteração do CPF salvo, sem distinguir correção de substituição.
4. Início/conclusão que habilitam a concessão, reconhecimento de benefícios anteriores nas contas existentes e detalhes técnicos da referência vigente/referência à versão imutável. Quantidade, duração e calendário iniciais já estão alinhados: até 20 créditos, 28 dias, quatro parcelas de 5 nos dias 0/7/14/21; alterações futuras somente em nova versão.
5. Retenção e proteção da evidência de benefício por CPF/conta após edição ou exclusão, conciliando a regra antifraude com as obrigações de proteção de dados. Não presumir retenção irrestrita de dados completos.
6. Matriz mínima de acesso: cadastro, faturamento, suporte, comunicações e consulta legal/auditoria. Definir fonte confiável de IP e eventos necessários, sem coleta indiscriminada.
7. Mecanismo de publicação/ativação e procedimento simples para eventuais divergências dos usuários existentes.

## 5. Limites desta iniciativa

- Preservar os geradores e a política atual de realinhamento; não ampliar para uma reescrita do pipeline.
- Não converter a carteira de `store_id` para `user_id`.
- Não criar carteira compartilhada entre contas ou novas regras de múltiplas lojas por conta.
- Criar a base versionada de ofertas e integrar seus consumidores previstos nesta iniciativa; o painel completo de edição/publicação pelo Admin fica para fase futura.
- Não implementar checkout PF/PJ completo, emissão de NFS-e, CRM ou ferramentas comerciais nesta sequência. Preparar os contratos necessários para evolução própria.
- Não prometer campanhas de Serviço apenas pela abertura cadastral a autônomos; capacidade de geração de serviços é uma iniciativa distinta.
- Não executar migração real de usuários antes de o caminho de atualização estar publicado e verificado.
- Não transformar esta documentação em autorização de merge, push, deploy, migration ou ativação.

## 6. Referências para o detalhamento técnico

As referências abaixo descrevem o desenho atual; não significam que as novas regras já estejam implementadas.

- [Fluxo de desenvolvimento](fluxo-de-desenvolvimento.md).
- [Estado de execução](../.planning/STATE.md) e [roadmap operacional](../.planning/ROADMAP.md).
- [Onboarding por abas](../src/lib/store-onboarding/tabs.ts) e [rascunho comercial](../src/lib/store-onboarding/draft-store.ts).
- [Criação de negócio com/sem CNPJ](../src/app/api/store/route.ts).
- [Prontidão atual](../src/lib/store-readiness.ts) e [contrato SQL fiscal/visual](../supabase/migrations/20260729000001_f34_store_readiness.sql).
- [Conclusão e concessão atuais](../src/lib/credit/trial-offer/completion.ts) e [identidade do benefício por CNPJ](../supabase/migrations/20261022000002_f50_4_enrollment_identity.sql).
- [Configuração atual de ofertas](../supabase/migrations/20261020000001_f50_2_trial_offer_settings.sql), [parcelamento atual](../supabase/migrations/20261020000003_f50_2_trial_offer_rpcs.sql) e [constantes atuais](../src/lib/credit/trial-offer/constants.ts).
- [Aceites contratuais](../src/lib/legal/acceptance-service.ts), [ciência de privacidade](../src/lib/legal/privacy.ts) e [autorização legal](../src/lib/legal/clearance.ts).
- [Dados de faturamento](../src/lib/billing/store-billing-info.ts).
- [Política de realinhamento](../src/lib/drift.ts) e [contexto comercial de geração](../src/components/campaign/types.ts).

## 7. Próximo passo

Concluir o detalhamento e a revisão da fatia 1, usando esta linha guia para a proposta OpenSpec pertinente. Depois, executar e fechar a base versionada de ofertas (2A) e a base protegida do responsável (2B), antes dos respectivos consumidores. Cada fatia deve encerrar seu próprio escopo e registrar pendências externas sem confundi-las com implementação concluída.
