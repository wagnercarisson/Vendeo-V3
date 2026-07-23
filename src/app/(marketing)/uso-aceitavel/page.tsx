import { getCurrentVersion } from "@/lib/legal/document-versions";

export default async function UsoAceitavelPage() {
  const version = await getCurrentVersion("acceptable_use");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article className="prose prose-invert max-w-none">
        <h1>Política de Uso Aceitável</h1>
        {version && (
          <p className="text-sm text-text-muted">
            Versão {version.version}
            {version.effectiveAt && (
              <> &mdash; Efetivo em {new Date(version.effectiveAt).toLocaleDateString("pt-BR")}</>
            )}
          </p>
        )}

        <blockquote>
          <p>
            <strong>Aviso importante:</strong> Este documento é um draft preparado pelo time do Vendeo para
            revisão jurídica. Não constitui aconselhamento legal. Consulte um advogado antes de publicar.
          </p>
        </blockquote>

        <p>
          Documento de referência:{" "}
          <a href="/docs/legal/acceptable-use-v1.md" target="_blank" rel="noopener noreferrer">
            docs/legal/acceptable-use-v1.md
          </a>
        </p>

        <h2>1. Propósito</h2>
        <p>Esta Política de Uso Aceitável estabelece as regras para utilização da Plataforma Vendeo e complementa os Termos de Uso.</p>

        <h2>2. Restrições de Conteúdo</h2>
        <p>É proibido utilizar a Plataforma para gerar campanhas que contenham ou promovam:</p>
        <ul>
          <li><strong>Nudez e conteúdo sexual explícito</strong> — Imagens ou textos de natureza sexual, pornográfica ou obscena.</li>
          <li><strong>Violência</strong> — Representações gráficas de violência, lesões, morte ou sofrimento.</li>
          <li><strong>Discurso de ódio</strong> — Conteúdo que promova discriminação por raça, etnia, gênero, religião, orientação sexual, deficiência ou condição social.</li>
          <li><strong>Atividades ilegais</strong> — Promoção ou instrução para práticas ilegais.</li>
          <li><strong>Plágio e violação de direitos autorais</strong> — Conteúdo que infrinja direitos de propriedade intelectual de terceiros.</li>
          <li><strong>Desinformação</strong> — Informações falsas ou enganosas sobre saúde, segurança, eleições ou interesse público.</li>
          <li><strong>Conteúdo enganoso</strong> — Publicidade enganosa ou abusiva.</li>
          <li><strong>Conteúdo restrito a menores</strong> — Conteúdo destinado a menores que não atenda à regulamentação aplicável.</li>
        </ul>

        <h2>3. Conduta Proibida</h2>
        <p>O Usuário não pode utilizar a Plataforma para enviar spam, burlar sistemas de rate limit/autenticação/créditos, realizar engenharia reversa, usar bots ou scrapers, criar múltiplas contas para contornar restrições, ou compartilhar credenciais de acesso.</p>

        <h2>4. Sanções</h2>
        <p>A violação desta Política pode resultar em advertência, suspensão temporária, cancelamento da conta ou cancelamento da loja, a critério exclusivo do Vendeo. Violações graves ou reincidentes podem resultar em cancelamento imediato sem reembolso de créditos não utilizados.</p>

        <h2>5. Responsabilidade do Usuário</h2>
        <p>O Lojista é o único responsável pelo conteúdo das campanhas geradas e publicadas, devendo garantir que seu produto e materiais cumprem a legislação aplicável, incluindo o Código de Defesa do Consumidor e regulamentações do CONAR.</p>

        <h2>6. Disposições Gerais</h2>
        <p>Esta Política pode ser atualizada periodicamente. A versão vigente é aquela aceita pelo Usuário no momento da criação da loja. Dúvidas podem ser direcionadas ao suporte do Vendeo.</p>
      </article>
    </main>
  );
}
