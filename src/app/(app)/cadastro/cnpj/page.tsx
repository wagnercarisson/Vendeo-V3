import { requireUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { supabaseAdmin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { validateCnpj } from "@/lib/cnpj/validate";
import { hashCnpjRoot } from "@/lib/cnpj/hash";
import { CnpjUpdateForm } from "./cnpj-update-form";

export default async function CadastroCnpjPage() {
  const user = await requireUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    redirect("/");
  }

  if ((store as unknown as Record<string, unknown>).cnpj_normalized) {
    redirect("/");
  }

  return (
    <div className="max-w-lg mx-auto mt-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Atualizar CNPJ</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Informe seus dados cadastrais para continuar usando o Vendeo. Seus
        cr\u00e9ditos e campanhas atuais ser\u00e3o mantidos.
      </p>
      <CnpjUpdateForm storeId={store.id} />
    </div>
  );
}
