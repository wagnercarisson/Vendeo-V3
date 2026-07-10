import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { listCampaigns } from "@/lib/campaign/list";
import MyCampaignsClient from "./client";

export default async function MyCampaignsPage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    redirect("/store");
  }

  const campaigns = await listCampaigns(store.id);

  return <MyCampaignsClient campaigns={campaigns} />;
}
