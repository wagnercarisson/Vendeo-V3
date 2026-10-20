import Link from "next/link";

export const metadata = {
  title: "Aceitar convite — Vendeo",
  description: "Aceite seu convite de acesso ao Vendeo.",
  robots: { index: false, follow: false },
};

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "suporte@vendeo.tech";

function InvalidInvite({ reason }: { reason: string }) {
  return (
    <div className="text-center">
      <h1 className="mb-4 text-2xl font-bold text-slate-50">Convite indisponível</h1>
      <p className="text-slate-300">{reason}</p>
      <p className="mt-4 text-sm text-slate-400">
        Para receber um novo convite, fale com o suporte:{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Novo%20convite%20de%20acesso%20Vendeo`}
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
      <p className="mt-6 text-sm text-slate-400">
        Já definiu sua senha?{" "}
        <Link href="/login" className="text-blue-400 hover:text-blue-300 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[]; type?: string | string[] }>;
}) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = typeof params.type === "string" ? params.type : "";

  if (!tokenHash || (type !== "invite" && type !== "magiclink")) {
    return <InvalidInvite reason="Este link de convite está incompleto ou é inválido." />;
  }

  return (
    <div className="text-center">
      <h1 className="mb-3 text-2xl font-bold text-slate-50">Seu acesso foi aprovado</h1>
      <p className="text-slate-300">
        Clique no botão abaixo para aceitar o convite e definir sua senha de acesso ao
        Vendeo.
      </p>
      <p className="mt-3 text-xs text-slate-400">
        Por segurança, o convite só é validado depois do seu clique.
      </p>

      <form method="post" action="/auth/confirm" className="mt-8">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          style={{ minHeight: "44px" }}
        >
          Aceitar convite e definir senha
        </button>
      </form>

      <p className="mt-6 text-xs text-slate-500">
        Se o link expirou ou já foi usado, solicite um novo convite ao suporte:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
