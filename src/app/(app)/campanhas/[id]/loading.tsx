import { PreviewSkeleton, FormSkeleton } from "@/components/ui/loading-skeleton";

export default function CampaignDetailLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <PreviewSkeleton />
      <FormSkeleton />
    </div>
  );
}
