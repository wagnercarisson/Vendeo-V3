import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { StorePageClient } from "@/components/flow/store-page-client";
import { PageHeader } from "@/components/ui/page-header";

export default async function LojaPage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  return (
    <div>
      <PageHeader title="Loja" />
      <StorePageClient initialStore={store} userId={user.userId} />
    </div>
  );
}
