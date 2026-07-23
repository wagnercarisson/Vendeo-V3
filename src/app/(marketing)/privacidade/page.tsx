import { getCurrentVersion } from "@/lib/legal/document-versions";

export default async function PrivacidadePage() {
  const version = await getCurrentVersion("privacy_policy");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article className="prose prose-invert max-w-none">
        <h1>Política de Privacidade</h1>
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
          <a href="/docs/legal/privacy-policy-v1.md" target="_blank" rel="noopener noreferrer">
            docs/legal/privacy-policy-v1.md
          </a>
        </p>

        <h2>1. Controlador e Contato</h2>
        <p>O Vendeo é o controlador dos dados pessoais tratados no âmbito da Plataforma.</p>
        <p>Dúvidas sobre esta Política podem ser enviadas para o email de suporte do Vendeo.</p>

        <h2>2. Dados Coletados</h2>
        <h3>2.1. Dados fornecidos pelo Usuário</h3>
        <ul>
          <li>Email e senha (criação de conta)</li>
          <li>Nome da loja, segmento, cidade, estado</li>
          <li>Logotipo, marca, cores, posicionamento comercial</li>
          <li>Informações de produto e oferta para geração de campanhas</li>
        </ul>
        <h3>2.2. Dados coletados automaticamente</h3>
        <ul>
          <li>Endereço IP</li>
          <li>User agent do navegador</li>
          <li>Dados de uso e interação com a Plataforma</li>
          <li>Cookies essenciais para funcionamento</li>
        </ul>
        <h3>2.3. Dados gerados pela Plataforma</h3>
        <ul>
          <li>Campanhas visuais geradas</li>
          <li>Metadados de geração (data, configurações, custo estimado)</li>
        </ul>

        <h2>3. Bases Legais (LGPD)</h2>
        <table>
          <thead>
            <tr>
              <th>Finalidade</th>
              <th>Base Legal</th>
              <th>Exige Consentimento?</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Operação do serviço</td><td>Execução de contrato (art. 7º, V)</td><td>Não</td></tr>
            <tr><td>Comunicações transacionais</td><td>Execução de contrato (art. 7º, V)</td><td>Não</td></tr>
            <tr><td>Prevenção a fraude</td><td>Legítimo interesse (art. 7º, IX)</td><td>Não</td></tr>
            <tr><td>Obrigação fiscal/regulatória</td><td>Obrigação legal (art. 7º, II)</td><td>Não</td></tr>
            <tr><td>Comunicações comerciais</td><td>Consentimento (art. 7º, I)</td><td>Sim</td></tr>
          </tbody>
        </table>

        <h2>4. Finalidades do Tratamento</h2>
        <p>Os dados pessoais são tratados para operação e manutenção da Plataforma, geração de campanhas visuais, controle de créditos e faturamento, prevenção a fraudes, comunicações transacionais e, mediante consentimento, comunicações comerciais.</p>

        <h2>5. Compartilhamento com Terceiros</h2>
        <p>O Vendeo compartilha dados com Supabase (armazenamento), OpenAI (geração de IA), Vercel (hospedagem) e Anthropic/Gemini (fallback), limitado ao necessário para a prestação do Serviço. O Vendeo não vende dados pessoais.</p>

        <h2>6. Direitos do Titular (LGPD art. 18)</h2>
        <p>O titular tem direito a confirmar o tratamento, acessar, corrigir, anonimizar, portar, eliminar dados, revogar consentimento e opor-se ao tratamento com base em legítimo interesse.</p>

        <h2>7. Retenção e Eliminação</h2>
        <p>Os dados são mantidos enquanto a conta estiver ativa. Após cancelamento, são eliminados ou anonimizados em até 90 dias, exceto quando exigido por obrigação legal.</p>

        <h2>8. Segurança</h2>
        <p>O Vendeo adota criptografia TLS, controle de acesso RBAC, isolamento multi-tenant via RLS e auditoria de operações administrativas.</p>

        <h2>9. Consentimento para Comunicações Comerciais</h2>
        <p>O consentimento é opcional, destacado, não condiciona o uso do Serviço e pode ser revogado a qualquer momento na página de conta.</p>

        <h2>10. Disposições Gerais</h2>
        <p>Esta Política pode ser atualizada. Alterações serão comunicadas ao Usuário. É regida pela Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).</p>
      </article>
    </main>
  );
}
