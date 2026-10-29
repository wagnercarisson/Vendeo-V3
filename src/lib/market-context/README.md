# market-context (v1)

Fundação multimercado do Vendeo: contratos puros de contexto para separar país
da loja, idioma do aplicativo, mercado padrão da loja, mercado de destino,
idioma do conteúdo e moeda anunciada.

## O que existe aqui

- `types.ts` — tipos, entradas de configuração, valores versionados, fontes por
  campo e erros tipados.
- `market-profiles.ts` — registry congelado com os perfis `BR` e `PY`.
- `validation.ts` — guards puros e checagem estática do registry.
- `store-context.ts` — resolução da configuração da loja e parser estrito do
  valor resolvido.
- `user-preference.ts` — idioma do aplicativo, independente de mercado/país.
  Interface aceita `pt-BR`/`es-419`; conteúdo/campanha aceita `pt-BR`/`es-PY`.
- `campaign-context.ts` — resolução de campanha nova, parser estrito e leitura
  de campanha entregue/legada.

## Regras invariantes

- **Perfis são referência, não autorização.** A existência do perfil `PY` não
  habilita cadastro, geração, cobrança ou operação no Paraguai.
- **Seis dimensões independentes.** Mercado não escolhe idioma de app; moeda
  anunciada não implica câmbio nem moeda de cobrança; país cadastral não
  determina idioma/moeda do conteúdo. O idioma da interface (`pt-BR`/`es-419`)
  é um contrato próprio, separado do idioma do conteúdo (`pt-BR`/`es-PY`).
- **Padrões:** idioma e moeda padrão da loja derivam do mercado padrão das
  campanhas; o fuso deriva do país cadastral; override explícito vence.
- **Entrada ≠ valor resolvido.** A configuração aceita campos parciais e recebe
  padrões; valores versionados/parsers exigem todos os campos e rejeitam
  incompletos, desconhecidos e versões diferentes.
- **`legacy` é declaração explícita.** Nunca é inferido. Nada cai
  silenciosamente em BR; ausência de país configurado retorna `missing_country`.
  Campos adicionais junto de `kind: "legacy"` são **rejeitados** (legado é
  ausência total), em vez de descartados em favor de BR/pt-BR.
- **Saídas são objetos novos e congelados.** Mutar entradas depois de resolver
  não altera o resultado.
- **Leitura de entregues:** `null`/`undefined` → `missing_legacy`; objeto
  vazio/incompleto/versão desconhecida/não-objeto → `invalid`; completo →
  `present` com cópia independente. Sem backfill e sem reinterpretação.

## Estado e limites desta fatia

- O contrato **precede** a persistência. Não há colunas, migrations, RLS, DTOs,
  RPC, telas, catálogos de tradução, formatadores ou integração com IA.
- A proteção produtiva de campanhas entregues (snapshot obrigatório e
  imutabilidade no banco) **não existe ainda**; este módulo apenas prepara o
  contrato e a leitura segura.
- Nenhum caminho produtivo importa este módulo. `src/lib/formatters.ts` e o
  Store continuam BR-only.
- Zero I/O, zero ambiente, zero dependência externa, sem `Intl` de descoberta.
