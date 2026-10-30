# Pacote Jurídico — F50 (fechamento documental de 2026-10-30)

> Pacote revisado para refletir a oferta vigente, a identidade confirmada da empresa e as orientações jurídicas sobre política de ofertas, transferências internacionais e direitos do titular. As minutas continuam **não públicas e não vigentes**. **Não substitui revisão de advogado.**

## Achados destacados desta revisão

- **Coleta direta e verificação de segurança:** conforme a orientação jurídica encaminhada e a decisão do responsável, OAuth e Fonts saem da relação de exportações atribuídas ao Vendeo, permanecendo identificados na Privacidade. Turnstile é registrado separando coleta do widget e validação de token pelo Supabase. Não há declaração de isenção das obrigações próprias da Plataforma.
- **Infraestrutura, IA e comunicações:** inventário interno mantém Vercel, OpenAI e Resend, com o fundamento orientado nos arts. 7º, V, e 33, IX, para os dados necessários às operações descritas. Plano gratuito Vercel confirmado pelo responsável; não se presume aplicação do DPA Pro/Enterprise. Países consolidados no anexo público, sem associação pública por fornecedor.
- **Reaceite:** Termos 13.2 e AUP 7.2 agora declaram expressamente que a publicação destas versões exigirá reaceite de todos os usuários abrangidos, inclusive beta testers. A obrigação permanece; o gate técnico de aceite antes da oferta será tratado separadamente e **não é bloqueio documental automático** desta quick.
- **Delta dos Termos:** alinhado ao consolidado; a cláusula de acréscimo que não existia no texto integral foi removida e a prevalência do consolidado foi explicitada.
- **Versões públicas:** foram retiradas as frases editoriais sobre prazo de 30 dias e a coluna técnica de evidências; essas explicações permanecem neste pacote.
- **Impossibilidade técnica/operacional:** incluída nas exceções da 6.1, sem transformar conveniência comercial em impossibilidade.
- **Acúmulo no ciclo:** a 6.7 permite acúmulo das parcelas dentro do ciclo vigente, sem transferência para novo ciclo.
- **Anexo de transferências:** texto público por categorias, finalidades e países, sem nomes dos fornecedores de backend, códigos de região ou notas investigativas. Inventário detalhado em material interno. A entrega documental está concluída para aprovação final; datas permanecem por definir. Não houve publicação.
- **Evidências operacionais de 2026-10-30:** Cloudflare somente Turnstile; Resend plano gratuito, sem rastreamento e chave restrita; SMTP do Supabase via Resend; sem Drain na Vercel; 2FA e acesso administrativo exclusivo; Google OAuth limitado a `openid`/`email`/`profile`; Google Fonts como fluxo distinto. Esses itens foram incorporados como configuração/declaração, não como prova de país ou de retenção.

## Conteúdo do pacote

| Item | Fonte | Estado |
|---|---|---|
| Termos de Uso v1.5 — delta | `legal-drafts/terms-of-service-v1-5.md` | atualizado; não público |
| Política de Privacidade v1.4 — delta | `legal-drafts/privacy-policy-v1-4.md` | atualizado; não público |
| Política de Uso Aceitável v1.2 — delta | `legal-drafts/acceptable-use-v1-2.md` | atualizado; não público |
| Termos de Uso v1.5 — consolidado | `legal-consolidated-pending/terms-of-service-v1-5.md` | aprovado; cópia pública byte a byte em `public/docs/legal/`; pendente deploy/ativação |
| Política de Privacidade v1.4 — consolidado | `legal-consolidated-pending/privacy-policy-v1-4.md` | aprovado; cópia pública byte a byte; pendente deploy/ativação |
| Política de Uso Aceitável v1.2 — consolidado | `legal-consolidated-pending/acceptable-use-v1-2.md` | aprovado; cópia pública byte a byte; pendente deploy/ativação |
| Anexo de Transferências Internacionais — texto público | `legal-consolidated-pending/international-transfers-annex.md` | finalizado; cópia pública e página `/privacidade/transferencias`; pendente deploy |
| Notas internas de transferências | `legal-drafts/international-transfers-investigation-notes.md` | interno; não publicar |
| Orientação ao advogado | `legal-drafts/legal-counsel-brief.md` | interno; não publicar |
| Diferenças (diff) | tabelas de correspondência em cada delta | atualizado; não publicar |
| Template da migration de publicação | `legal-publication-template/20260920000003_f50_legal_publication.sql` | preservado como template; migration efetiva preparada em `supabase/migrations/20261030185658_f50_legal_publication.sql` |
| Catálogo | `src/lib/legal/document-content.ts` | **alterado; v1.5/v1.4/v1.2 reconhecidas** |

## Identidade confirmada

| Campo | Valor |
|---|---|
| Razão social | **Sara Schmoelz Wagner** |
| Nome fantasia | **Sara Schmoelz Wagner** (idêntico à razão social; não criar campo novo) |
| CNPJ | **15.696.769/0001-63** (canônico: `15696769000163`) |
| Endereço profissional | **Rua José Wagner, 45, Ibirama - SC, CEP 89140-000** |

Não há bairro ou complemento inventados. A identidade foi aplicada de forma idêntica nos Termos 14.7 e no "Controlador e Contato" da Privacidade. Restam apenas os placeholders de data, a serem preenchidos no corte/publicação.

## Oferta vigente documentada

| Fato | Regra |
|---|---|
| Início | Conclusão do onboarding da loja elegível (`onboarding_completed_at`) |
| Duração | 28 (vinte e oito) dias corridos, com vencimento comum ao final |
| Parcelas | Quatro parcelas de 5 (cinco) créditos nos dias 0, 7, 14 e 21 |
| Máximo | 20 (vinte) créditos |
| Expiração | As parcelas podem acumular dentro do ciclo vigente; todos os créditos vencem no mesmo instante final e não são transferidos para um novo ciclo, renovados ou convertidos |
| Elegibilidade | Individual por CNPJ completo (14 posições), conforme as regras atuais |
| Filiais | CNPJ distinto pode ser elegível individualmente; compartilhar raiz não é, por si só, fraude |
| Cobrança | Sem renovação automática, sem cobrança automática e sem cartão nesta oferta |
| Acesso após expiração | A expiração não encerra a conta nem bloqueia, por si só, o app e o conteúdo gerado; não há promessa de acesso eterno |
| Estorno após vencimento | Janela mínima de 24 (vinte e quatro) horas e janela compartilhada entre estornos do mesmo ciclo; consolidado 6.6 / delta 5.8 |
| Política de ofertas | Alterações prospectivas; preservação dos créditos concedidos e das condições dos ciclos já iniciados; sem renovação futura; comunicação prévia com antecedência razoável; medidas imediatas por fraude, abuso, erro material, obrigação legal, segurança ou impossibilidade técnica/operacional relevante, na extensão necessária e proporcional; conveniência comercial não é impossibilidade |
| Encerramento do beta | Preserva os ciclos promocionais já iniciados e observa a cláusula 6.1, sem prazo fixo de 30 dias |

## Decisões incorporadas nesta revisão

1. **Oferta atual:** teste de 28 dias, quatro parcelas de 5, máximo 20, vencimento comum, elegibilidade por CNPJ completo, sem renovação/cobrança automática. Parâmetros concentrados na seção 6 dos Termos; demais seções usam remissões.
2. **Política de ofertas:** alterações prospectivas para períodos futuros; preservação dos créditos já concedidos e das condições dos ciclos promocionais já iniciados; sem direito a renovação futura; comunicação prévia aos participantes afetados com antecedência razoável e data de aplicação; medidas imediatas por fraude, abuso, erro material comprovado, obrigação legal, risco à segurança ou impossibilidade técnica/operacional relevante devidamente justificada, na extensão necessária e proporcional. Mera conveniência comercial não é impossibilidade. Sem prazo fixo de 30 dias e sem promessa de manutenção indefinida.
3. **Transição:** participantes de oferta já iniciada recebem aviso; novas adesões passam às novas condições claramente apresentadas; quem ainda não concluiu o onboarding aceita os Termos então vigentes antes de iniciar.
4. **Expiração:** não encerra a conta nem bloqueia, por si só, o app e o conteúdo gerado; explicação concentrada na seção da oferta, sem prometer acesso eterno.
5. **Privacidade:** CNPJ completo, elegibilidade, registros da oferta e salvaguarda de filiais legítimas; nova ciência distinta de marketing.
6. **Identidade:** razão social, CNPJ e endereço confirmados e aplicados; datas preservadas.
7. **Correções anteriores:** janela de 24 horas, ordem de consumo, estorno, graça e demais salvaguardas preservadas. A preservação dos créditos já concedidos e das condições dos ciclos promocionais já iniciados é adotada, sem renovação futura e sem promessa genérica de manutenção indefinida.
8. **Direitos do titular:** inclusão de petição à ANPD e, quando aplicável, reclamação aos órgãos de defesa do consumidor, com canais oficiais acessíveis.

## Fechamento das transferências internacionais

### Decisão e alcance

O responsável autorizou os ajustes documentais finais diretamente nesta rodada, deixando tracking e versionamento ao executor e reservando merge e push para si. Nenhum arquivo de tracking foi alterado neste fechamento.

Aplicadas a orientação jurídica recebida e sua complementação sobre coleta direta, referenciadas em `legal-drafts/international-transfers-investigation-notes.md`. Não se reabre a política de ofertas ou a investigação geral dos fornecedores.

A classificação interna **Documentado** significa finalidade, enquadramento adotado e evidência registrados. Não é certificação, garantia de ausência de incidentes ou classificação provisória restrita ao beta.

### Fontes e documentos de suporte

Referências já utilizadas na composição, para conservação e revisão periódica. Links não são prova de contrato assinado, de aplicação de DPA a qualquer produto/plano ou de localização de cada requisição.

| Tema | Documento/fonte | Alcance registrado |
|---|---|---|
| LGPD/ANPD | [Resolução CD/ANPD nº 19/2024](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024), arts. 3º, 5º, 6º, 9º e 17 | Distingue coleta direta e transferência; prevê hipóteses legais e mecanismos; transparência e segredos comercial/industrial |
| Vercel | [DPA](https://vercel.com/legal/dpa), termos/privacidade do fornecedor e evidência de execução `iad1` | DPA consultado para Pro/Enterprise; responsável informou plano gratuito. Não presumir cobertura pelo DPA |
| OpenAI | [DPA](https://openai.com/policies/data-processing-addendum/), termos de API e [subprocessadores](https://openai.com/policies/sub-processor-list/) | Lista nominal da API e suporte/moderação consultada anteriormente; não comprova todos os destinos em cada operação |
| Resend | [DPA](https://resend.com/legal/dpa), [subprocessadores](https://resend.com/legal/subprocessors), [tratamento e localização](https://resend.com/security/gdpr) e [segurança](https://resend.com/security) | Processamento/armazenamento nos EUA; envio regional não fixa armazenamento; ausência de cláusula brasileira específica não é substituída por equivalência presumida |
| Google OAuth | [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) e [política de dados de APIs](https://developers.google.com/terms/api-services-user-data-policy) | Fluxo de autenticação e escopos. Lista Google Cloud não comprova país de OAuth nem cobertura contratual desse produto |
| Google Fonts | [FAQ de privacidade](https://developers.google.com/fonts/faq/privacy) e referências de fontes no layout | Requisição do navegador; fluxo ainda existente, sem país inferido da sede do Google. Substituição na fase SEO |
| Cloudflare Turnstile | [Aviso específico](https://www.cloudflare.com/turnstile-privacy-policy/), [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) e [Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) | Coleta de sinais; operador para proteção do site e controlador para melhoria da detecção; `remoteip` opcional na API |
| Supabase | Configuração regional e [residência de dados](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq) | Armazenamento principal em São Paulo não significa todo tratamento restrito ao Brasil |

A lista nominal já documentada para IA compreende EUA, Brasil, Canadá, Finlândia, Japão, Malásia, Países Baixos, Noruega, Singapura, Reino Unido, Alemanha, Austrália, Bélgica, Dinamarca, Espanha, França, Índia, Indonésia, Irlanda, Itália, México, Nova Zelândia, Polônia, Coreia do Sul, Suécia, Suíça, Emirados Árabes Unidos e África do Sul; suporte/moderação também informa Filipinas. Não é necessário identificar qual subprocessador executou cada geração para conservar essa evidência.

### Evidências operacionais

| Origem | Fato | Limite |
|---|---|---|
| Código | OAuth `openid/email/profile`; Fonts externo; backend processa dados; captchaToken entregue ao Supabase Auth | Não confirma todos os países nem parâmetros da validação gerenciada |
| Capturas | Chave Resend com Sending access para `vendeo.tech`; SMTP `smtp.resend.com:587`; remetente `noreply@vendeo.tech`; OTP 3600 s; Vercel sem Drain | Não comprova localização integral ou prazo de exclusão interna |
| Declarações | Planos gratuitos; Turnstile sem proxy/CDN/DNS Cloudflare; rastreamento não configurado; chave SMTP confirmada; acesso administrativo exclusivo e 2FA | Declarações do responsável, não certificação |
| Limites conhecidos | Não há país específico confirmado para OAuth/Fonts/Turnstile; DPA Pro/Enterprise não presumido para plano gratuito; logs consultáveis por uma hora | Não transformar endereço empresarial, falta de evidência ou janela de consulta em conclusão sobre processamento |

### Matriz interna por operação

| Fornecedor | Finalidade e dados | Papel por finalidade | Base e enquadramento adotados | Países/localidades e evidência | Registro |
|---|---|---|---|---|---|
| Supabase | Conta, loja, autenticação, banco e storage | Operador/suboperador para execução; obrigações próprias conforme os termos | Armazenamento principal nacional; operações internacionais não se confundem com a região do banco | Brasil/São Paulo para núcleo operacional; região e FAQ/DPA, sem garantia de confinamento nacional | **Documentado** — limite regional explicitado |
| Vercel | Backend; dados de conta/loja/campanha e requisições necessários ao serviço | Operador ou suboperador de infraestrutura, conforme o tratamento | Arts. 7º, V, e 33, IX, conforme orientação recebida para execução necessária | EUA/`iad1`; termos/privacidade e região; DPA Pro/Enterprise não presumido no plano gratuito | **Documentado** — limitações contratuais registradas, sem qualificação ligada ao beta |
| OpenAI | Geração solicitada; prompts, imagens, informações comerciais e resultados | Operador ou suboperador técnico, conforme a relação com o Lojista | Arts. 7º, V, e 33, IX, para operação necessária segundo orientação recebida | Lista nominal API/suporte acima; DPA/termos/lista oficiais; não equivale a execução em todos os países | **Documentado** |
| Resend | Emails transacionais e de autenticação; destinatário, conteúdo, links de acesso e metadados | Operador/suboperador de comunicação operacional | Arts. 7º, V, e 33, IX, para execução necessária segundo orientação recebida | EUA como processamento/armazenamento; Brasil como envio; DPA/termos/lista; plano gratuito, chave restrita e SMTP | **Documentado** — ausência de cláusula brasileira específica não é convertida em equivalência de instrumento |
| Google OAuth | Autenticação direta e retorno de identificador, email, nome e perfil | Google na autenticação/coleta; Vendeo responsável pelos dados recebidos, conforme finalidade | Coleta direta separada de exportação pelo Vendeo, conforme orientação; tratamento dos dados recebidos para autenticação vinculado à execução | Sem país inventado ou DPA Google Cloud presumido para OAuth; protocolo e escopos registrados | **Documentado** — fora da relação pública de exportações atribuídas ao Vendeo; informado na Privacidade |
| Google Fonts | Requisição do navegador para fontes; IP e sinais técnicos de conexão | Provedor na coleta direta; integração mantida pelo Vendeo | Coleta direta conforme orientação recebida; não aplicar automaticamente arts. 7º, V, e 33, IX, a qualquer finalidade do fornecedor | Sem país inferido da sede; docs de fontes e layout; fluxo existente até implantação da fase SEO | **Documentado** — fora da relação de exportações atribuídas ao Vendeo, sem apagar transparência |
| Cloudflare Turnstile | Coleta de sinais no widget e validação de token via Supabase Auth | Operador na proteção do site; controlador na melhoria de detecção, conforme aviso específico | Coleta direta distinguida da validação necessária à segurança; arts. 7º, V, e 33, IX, adotados conforme orientação para a operação necessária de validação, sem extensão automática a finalidades próprias do fornecedor | Aviso/DPA/Siteverify; não há chamada própria do aplicativo localizada; envio ou omissão de `remoteip` pelo serviço gerenciado não foi comprovado | **Documentado** — permanece na Privacidade, sem presumir envio de IP pelo Vendeo ou eliminação de toda etapa internacional |
| Google/Gemini (lab) | Testes controlados, fora da operação produtiva informada | Conforme uso de laboratório | Não incluído como fluxo produtivo | Uso condicional de laboratório | Registro separado; não expor no anexo público |

**Critério:** os fundamentos orientados para execução do serviço não se estendem automaticamente a qualquer dado, pessoa retratada ou finalidade própria do fornecedor. A divisão de responsabilidades sobre materiais, bases e autorizações do Lojista continua nos documentos, sem afastar deveres próprios da Plataforma. Preservadas as hipóteses aplicáveis a dados de terceiros e sensíveis; não se declara sua cobertura universal por execução contratual.

**Conclusão documental:** decisões incorporadas, matriz registrada e anexo público finalizado por categorias, com destinos consolidados das fontes disponíveis. Não há solicitação de nova investigação geral ou enquadramento temporário condicionado ao beta. O material segue para aprovação final e posterior publicação autorizada, sem garantia de conformidade absoluta ou de ausência de incidentes.

## Reaceite e ciência

- Termos v1.5 e AUP v1.2 mantêm reaceite de todos os abrangidos, inclusive beta testers.
- Privacidade v1.4 mantém nova ciência por usuário, distinta de marketing e de aceite contratual.
- O controle existente de geração utiliza `requireLegalClearance`, `legal_acceptances` e `/legal/reaccept`; a ciência utiliza `PrivacyGate`/`privacy_acknowledgements`.
- Gate técnico antes do início da oferta será tratado em etapa própria; não foi implementado nem é tratado como bloqueio automático desta entrega documental.
- Não houve reaceite ou ciência real nesta rodada.

## Datas e entrega para aprovação

O responsável encaminhou parecer favorável e autorizou o corte imediato em **30/10/2026 às 16:10:52 America/Sao_Paulo (19:10:52 UTC)**. A autorização não significa publicação realizada. Os Termos, na fonte e na cópia pública, estabelecem vigência em 30/10/2026 a partir da ativação desta versão na Plataforma, após disponibilização pública. A migration registra esse instante real com `effective_at = now()`, sem retroagir à autorização. Não há placeholder de vigência restante nos textos públicos. Se a ativação ultrapassar 30/10/2026 em Brasília, atualizar as datas e fazer novo deploy antes de aplicar a migration.

O encaminhamento ao advogado está em `legal-drafts/legal-counsel-brief.md`. Os quatro consolidados são os textos propostos; deltas, matriz e notas não serão publicados. As notas históricas de investigação e a decisão aplicada estão em `legal-drafts/international-transfers-investigation-notes.md`.

## Manutenção e etapas separadas

- Fontes locais: responsabilidade da fase SEO; fluxo externo ainda existente até implantação verificada.
- Revisão de contratos e países: novo fornecedor, mudança material conhecida ou revisão periódica; sem auditoria por requisição.
- Gate técnico, melhoria ampla de logs, Referrer-Policy e rotação de chaves: tarefas próprias.
- Tracking e versionamento: a preparação técnica registra PLAN, SUMMARY e STATE; ROADMAP não foi alterado. Commit, merge e push permanecem pendentes.
- Merge e push: responsabilidade do usuário.
- Publicação: preparação técnica e corte autorizados; deploy e aplicação da migration não executados nesta rodada. O usuário fará merge/push; a aplicação deve ocorrer somente após conferência do deploy.

## Preparação técnica de publicação (2026-10-30)

| Item | Caminho/estado |
|---|---|
| Termos v1.5 | `public/docs/legal/terms-of-service-v1-5.md` — cópia byte a byte |
| Privacidade v1.4 | `public/docs/legal/privacy-policy-v1-4.md` — cópia byte a byte |
| AUP v1.2 | `public/docs/legal/acceptable-use-v1-2.md` — cópia byte a byte |
| Anexo | `public/docs/legal/international-transfers-annex.md` — cópia byte a byte |
| Catálogo | `src/lib/legal/document-content.ts` — v1.5/v1.4/v1.2 |
| Página do anexo | `/privacidade/transferencias`, com link a partir da Privacidade |
| Migration | `supabase/migrations/20261030185658_f50_legal_publication.sql` — preparada, não aplicada |
| Vigência | Termos sem placeholder: ativação real após disponibilização pública em 30/10/2026; `effective_at = now()` na aplicação |

**Ordem segura:** versionamento → merge/push pelo usuário → deploy dos arquivos/catálogo/página → conferência das URLs e arquivos sem placeholders → aplicação somente da migration de publicação no projeto correto → conferência das versões e do reaceite/ciência. A migration usa `now()` para a ativação real; não aplicar antes do deploy nem reaplicar para deslocar a vigência. Se houver outras migrations pendentes, não as aplicar implicitamente. O anexo não é documento contratual autônomo.

## Integridade dos textos entregues

SHA-256 dos arquivos em `legal-consolidated-pending/` após os ajustes de 2026-10-30:

| Texto | SHA-256 |
|---|---|
| `terms-of-service-v1-5.md` | `0b57d2329abb9c2adc227211ecc71a6db0c9f00c6a70b6639c55120feb4357e0` |
| `privacy-policy-v1-4.md` | `9427b83344211c129bc86140a1141ee60b5bde9b61b6470e25cf3dbf16332469` |
| `acceptable-use-v1-2.md` | `2968f426e180dce9178615ef277e19f3ac852c650c6dd0f549b6a3ff8e60bc92` |
| `international-transfers-annex.md` | `cbecf6246e781a83d1d66e655c28b15ba97f4ae2d1c476d55d50ca455f03d620` |

No fechamento anterior, Termos, Privacidade e AUP permaneceram byte a byte iguais à versão recebida; também foram preservados os três deltas, o template e os arquivos de tracking, com conferência de SHA-256. Na complementação solicitada pelo responsável após o retorno jurídico, foram aplicados somente os dois ajustes de precisão: Privacidade 9.7 (com delta correspondente) e seção 4 do anexo. Na reconciliação, os três consolidados receberam a data de publicação 30/10/2026. Após a autorização do corte imediato, o campo de vigência dos Termos passou a indicar a ativação real após disponibilização pública; a fonte e a cópia pública foram atualizadas igualmente. Na preparação técnica, as quatro cópias públicas foram conferidas byte a byte e mantêm exatamente os hashes acima; nenhuma cláusula foi alterada.

Google Fonts continua externo no código conferido em `src/app/layout.tsx`; por isso foi mantida a informação existente na Privacidade. A implementação de fontes locais permanece na fase SEO. A data de publicação está preenchida (30/10/2026); o campo de vigência não contém placeholder e referencia a ativação real.

Qualquer alteração posterior exige diff e novos hashes. O preenchimento de datas altera o hash mesmo sem modificar outras cláusulas. Este registro não substitui a reconciliação de tracking e versionamento que caberá ao executor.
