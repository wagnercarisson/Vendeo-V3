import { requireUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { redirect } from "next/navigation";
import { CnpjUpdateForm } from "./cnpj-update-form";

export default async function CadastroCnpjPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    redirect("/");
  }

  const fiscalComplete =
    store.cnpj_normalized &&
    store.cnpj_normalized !== "" &&
    store.razao_social &&
    store.razao_social !== "" &&
    store.nome_fantasia &&
    store.nome_fantasia !== "";

  if (fiscalComplete) {
    redirect("/");
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const returnTo = typeof searchParams.returnTo === "string" ? searchParams.returnTo : null;

  return (
    <div className="max-w-lg mx-auto mt-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Atualizar CNPJ</h1>
      {returnTo && (
        <div className="mb-4 flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
          <p className="text-accent-amber text-sm font-body">
            Sua loja precisa do CNPJ, razão social e nome fantasia para gerar campanhas. Atualize seus dados cadastrais para continuar.
          </p>
        </div>
      )}
      <p className="text-muted-foreground text-sm mb-6">
        Informe seus dados cadastrais para continuar usando o Vendeo. Seus
        créditos e campanhas atuais serão mantidos.
      </p>
      <CnpjUpdateForm storeId={store.id} existingCnpj={store.cnpj_normalized ?? undefined} existingRazaoSocial={store.razao_social ?? undefined} existingNomeFantasia={store.nome_fantasia ?? undefined} />
    </div>
  );
}
