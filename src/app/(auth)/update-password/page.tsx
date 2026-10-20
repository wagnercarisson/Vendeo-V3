import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./update-password-form";

export const dynamic = "force-dynamic";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "suporte@vendeo.tech";

export default async function UpdatePasswordPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-slate-50">Link indisponível</h1>
        <p className="text-slate-300">
          Este link de convite ou recuperação é inválido, expirou ou já foi usado.
        </p>
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
          <Link href="/login" className="text-blue-400 hover:text-blue-300 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    );
  }

  return <UpdatePasswordForm />;
}
