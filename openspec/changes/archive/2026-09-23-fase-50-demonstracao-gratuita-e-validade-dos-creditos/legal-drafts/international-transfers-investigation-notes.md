# Registro interno de fechamento — Transferências internacionais

**USO INTERNO — NÃO PUBLICAR. Não integra o Anexo público.**

## 1. Decisão do responsável — 2026-10-30

Concluir a entrega documental com as evidências disponíveis e a orientação jurídica fornecida, sem novas investigações gerais e sem enquadramentos condicionados à permanência em beta.

Referências recebidas:
- Orientação jurídica: anexo `335cebd8-68d3-4fb2-a1d4-4bf08fa78d2b/Texto colado.txt`.
- Complemento sobre coleta direta e simplificação: anexo `d6c2850c-5cda-4ecf-8704-f3a81b1d8750/Texto colado.txt`.
- Decisão subsequente: retirar OAuth e Fonts da relação de exportações atribuídas ao Vendeo, preservar a transparência da Privacidade e distinguir coleta do Turnstile de validação de token.

Esses anexos identificam a orientação encaminhada pelo responsável; não são contratos dos fornecedores ou provas de localização.

## 2. Evidências operacionais e limites

| Origem | Evidência | Limite |
|---|---|---|
| Código | OAuth `openid/email/profile`; Google Fonts externo; backend processa requisições | Não comprova todos os países de processamento |
| Código de autenticação | Navegador envia `captchaToken` ao Supabase Auth; não foi localizada chamada própria do aplicativo à Siteverify | Não comprova os parâmetros enviados pelo Supabase; não afirmar ausência de `remoteip` |
| Capturas | Resend com chave restrita a `vendeo.tech`; SMTP Resend; OTP 3600 s; Vercel sem Drain | Não comprovam localização integral nem retenção interna |
| Declarações do responsável | Planos gratuitos de Vercel e Resend; somente Turnstile na Cloudflare; rastreamento Resend não configurado; mesma chave no SMTP; acesso administrativo exclusivo e 2FA | Registro operacional, não certificação jurídica |
| Documentação oficial | Contratos, políticas e listas referenciados no pacote | Endereço empresarial e documentos de outro produto não comprovam o destino de um serviço |

A região Supabase não garante ausência de tratamento internacional; uma hora de consulta de logs não comprova exclusão em uma hora; infraestrutura de envio de email no Brasil não comprova armazenamento integral no Brasil.

## 3. Enquadramento adotado conforme orientação recebida

- **Vercel, OpenAI e Resend:** transferências necessárias à infraestrutura, geração e comunicação operacional; fundamento orientado nos arts. 7º, V, e 33, IX, limitado aos dados e finalidades necessários. DPA estrangeiro não equivale automaticamente a cláusulas brasileiras.
- **Google OAuth:** coleta/autenticação direta pelo Google e retorno dos dados de identificação ao Vendeo. Não integra a lista de exportações atribuídas ao Vendeo nesta composição. As obrigações próprias sobre os dados recebidos continuam preservadas.
- **Google Fonts:** requisição direta do navegador ao serviço de fontes; não integra a lista de exportações atribuídas ao Vendeo. A informação permanece na Privacidade; não se atribui automaticamente execução contratual a todos os tratamentos do fornecedor.
- **Turnstile:** coleta técnica pelo widget separada da validação do token pelo Supabase Auth. A Privacidade mantém o uso para segurança. Não se presume envio adicional de IP pelo Vendeo, ausência de `remoteip` no serviço gerenciado ou que toda etapa seja exclusivamente coleta direta.
- **Papéis:** o Turnstile declara atuar como operador na proteção do site e como controlador na melhoria de sua detecção. Os demais papéis devem ser lidos por finalidade, não como isenção de responsabilidades. Preservada a divisão entre instruções do Lojista e obrigações próprias da Plataforma.

O estado interno **Documentado** significa finalidade, orientação e evidência registradas; não é certificação, garantia de ausência de incidentes ou confirmação de todos os destinos possíveis.

## 4. Composição pública

Anexo por categorias, sem mapa de fornecedores, códigos de região ou notas investigativas. Países já documentados consolidados, sem associação entre cada país e fornecedor e sem afirmar que todos participam de cada requisição. Brasil identificado como tratamento nacional.

Não foram inventados destinos para OAuth, Fonts ou Turnstile. Esses serviços continuam identificados na Privacidade. Retirar da relação de exportações não cria isenção de responsabilidade.

## 5. Manutenção e separação de etapas

- Fontes locais pertencem à fase SEO; até implantação verificada, Fonts permanece fluxo existente. Nenhuma alteração de código foi feita aqui.
- Atualizar o inventário na entrada de fornecedores, em mudança material conhecida ou revisão periódica; não testar a localização de cada chamada.
- Gate técnico de aceite, rotação de chaves e melhorias de logs ficam em tarefas próprias. Reaceite de Termos/AUP e nova ciência da Privacidade, inclusive beta testers, permanecem.
- Datas ainda dependem de definição do responsável; não foram inventadas.
- Tracking e versionamento ficam com o executor; merge e push com o usuário.
- Esta rodada não publica, ativa, altera catálogo, banco, migrations efetivas ou sistemas.
