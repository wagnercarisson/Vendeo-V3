import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { CampaignPageClient } from "@/components/flow/campaign-page-client";

export default async function Home() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    redirect("/store");
  }

  return (
    <main>
      <CampaignPageClient store={store} />
    </main>
  );
}
