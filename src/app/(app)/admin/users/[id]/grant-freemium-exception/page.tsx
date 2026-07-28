import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { maskCnpj } from "@/lib/cnpj/mask";
import { GrantFreemiumExceptionForm } from "./form";

export default async function GrantFreemiumExceptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("id, name, cnpj_normalized, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!store) {
    redirect("/admin/users");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conceder Exceção Freemium</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Loja: {store.name}
          {store.cnpj_normalized ? ` — CNPJ: ${maskCnpj(store.cnpj_normalized)}` : ""}
        </p>
      </div>
      <GrantFreemiumExceptionForm storeId={store.id} userId={userId} />
    </div>
  );
}
