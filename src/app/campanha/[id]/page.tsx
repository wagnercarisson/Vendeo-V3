import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { getCampaignForDisplay, generateSignedPreviewUrl, mapCampaignToProps } from "@/lib/campaign/display";
import CampaignPageClient from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignPage({ params }: PageProps) {
  const { id } = await params;

  const user = await requirePageUser();

  const store = await getCurrentStore(user.userId);
  if (!store) {
    redirect("/store");
  }

  const campaign = await getCampaignForDisplay(id);
  if (!campaign) {
    notFound();
  }

  const props = mapCampaignToProps(campaign, id);

  if (campaign.status === "ready" && campaign.storage_path) {
    const signedUrl = await generateSignedPreviewUrl(campaign.storage_path);
    props.imageUrl = signedUrl;
  }

  return <CampaignPageClient {...props} />;
}
