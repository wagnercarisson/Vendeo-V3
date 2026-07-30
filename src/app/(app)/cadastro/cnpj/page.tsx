import { redirect } from "next/navigation";

export default async function CadastroCnpjPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams ?? {};
  const returnTo = typeof searchParams.returnTo === "string"
    ? searchParams.returnTo
    : "/dashboard";
  redirect(`/loja?required=cadastro-fiscal&returnTo=${encodeURIComponent(returnTo)}`);
}
