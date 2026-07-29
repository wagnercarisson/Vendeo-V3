import { getStoreReadiness } from "@/lib/store-readiness";
import { ReadinessBanner } from "./readiness-banner";

export async function ReadinessCheckBanner({ storeId }: { storeId: string }) {
  const readiness = await getStoreReadiness(storeId);

  if (readiness.ready) return null;

  return <ReadinessBanner missing={readiness.missing} />;
}
