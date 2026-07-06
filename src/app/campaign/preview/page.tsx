import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import CampaignPreviewClient from "./preview-client";

export default async function CampaignPreviewPage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    redirect("/store");
  }

  return <CampaignPreviewClient />;
}
