import { getCurrentVersion } from "@/lib/legal/document-versions";

export default async function TermosPage() {
  const version = await getCurrentVersion("terms_of_service");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article className="prose prose-invert max-w-none">
        <h1>Termos de Uso</h1>
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
          <a href="/docs/legal/terms-of-service-v1.md" target="_blank" rel="noopener noreferrer">
            docs/legal/terms-of-service-v1.md
          </a>
        </p>

        <h2>1. Definições</h2>
        <p>Para os fins destes Termos de Uso:</p>
        <ul>
          <li><strong>Plataforma:</strong> Sistema SaaS Vendeo, acessível via web, que permite a geração automatizada de campanhas visuais para redes sociais.</li>
          <li><strong>Usuário:</strong> Pessoa física ou jurídica que se cadastra na Plataforma.</li>
          <li><strong>Lojista:</strong> Usuário que cria uma loja na Plataforma e utiliza os serviços de geração de campanhas.</li>
          <li><strong>Conteúdo:</strong> Textos, imagens, logotipos, marcas e demais materiais fornecidos pelo Usuário ou gerados pela Plataforma.</li>
          <li><strong>Serviço:</strong> Geração automatizada de campanhas visuais para redes sociais utilizando inteligência artificial e renderização programática.</li>
          <li><strong>Política de Uso Aceitável:</strong> Documento complementar que estabelece restrições de uso, incorporado por referência a estes Termos.</li>
        </ul>

        <h2>2. Cadastro e Conta</h2>
        <p>2.1. Para utilizar a Plataforma, o Usuário deve criar uma conta fornecendo email e senha.</p>
        <p>2.2. O Usuário é responsável pela confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.</p>
        <p>2.3. O Usuário declara ser maior de 18 anos ou ter autorização legal para aceitar estes Termos.</p>
        <p>2.4. Cada Usuário pode criar uma ou mais lojas na Plataforma, sendo responsável pela veracidade das informações fornecidas.</p>

        <h2>3. Uso do Serviço</h2>
        <p>3.1. A Plataforma permite ao Lojista informar dados de produto e oferta, gerar campanhas visuais automatizadas, revisar e editar o conteúdo gerado, e exportar campanhas para uso em redes sociais.</p>
        <p>3.2. O Lojista reconhece que as campanhas são geradas por inteligência artificial e devem ser revisadas antes da publicação.</p>
        <p>3.3. É proibido utilizar a Plataforma para gerar conteúdo que viole a Política de Uso Aceitável.</p>

        <h2>4. Propriedade Intelectual</h2>
        <p>4.1. A Plataforma, incluindo seu código, design, algoritmos e infraestrutura, é propriedade exclusiva do Vendeo.</p>
        <p>4.2. O Conteúdo fornecido pelo Usuário permanece de propriedade do Usuário.</p>
        <p>4.3. As campanhas geradas pela Plataforma são disponibilizadas para uso do Lojista de acordo com os termos de licenciamento aplicáveis.</p>
        <p>4.4. O Usuário concede ao Vendeo licença não exclusiva para processar seu Conteúdo exclusivamente para fins de prestação do Serviço.</p>

        <h2>5. Limitação de Responsabilidade</h2>
        <p>5.1. A Plataforma é fornecida &ldquo;no estado em que se encontra&rdquo;, sem garantias de disponibilidade ininterrupta ou ausência de erros.</p>
        <p>5.2. O Vendeo não se responsabiliza pelo Conteúdo gerado pela inteligência artificial, sendo o Lojista o único responsável pela revisão e publicação das campanhas.</p>
        <p>5.3. Em nenhum caso o Vendeo será responsável por danos indiretos, lucros cessantes ou perda de oportunidades decorrentes do uso da Plataforma.</p>
        <p>5.4. A responsabilidade máxima do Vendeo está limitada ao valor efetivamente pago pelo Usuário nos 12 meses anteriores ao evento.</p>

        <h2>6. Cancelamento</h2>
        <p>6.1. O Usuário pode cancelar sua conta a qualquer momento através da plataforma.</p>
        <p>6.2. O Vendeo pode suspender ou cancelar o acesso do Usuário que violar estes Termos ou a Política de Uso Aceitável.</p>
        <p>6.3. Em caso de cancelamento, o Vendeo não é obrigado a manter o Conteúdo gerado após o prazo de 90 dias.</p>

        <h2>7. Disposições Gerais</h2>
        <p>7.1. Estes Termos são regidos pela legislação brasileira.</p>
        <p>7.2. Qualquer alteração nestes Termos será comunicada ao Usuário, que poderá rejeitá-la, resultando no encerramento do uso da Plataforma.</p>
        <p>7.3. A aceitação destes Termos é condição necessária para a criação da loja e utilização dos recursos de geração.</p>
        <p>7.4. Estes Termos incorporam por referência a Política de Privacidade e a Política de Uso Aceitável do Vendeo.</p>
      </article>
    </main>
  );
}
