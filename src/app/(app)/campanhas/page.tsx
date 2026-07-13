import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { listCampaigns } from "@/lib/campaign/list";
import { CampaignListClient } from "./client";

export default async function CampanhasPage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    redirect("/loja");
  }

  const campaigns = await listCampaigns(store.id);

  return <CampaignListClient campaigns={campaigns} />;
}
