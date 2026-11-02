import { getStoreReadiness } from "@/lib/store-readiness";
import { ReadinessBanner, type ReadinessMessages } from "./readiness-banner";

export async function ReadinessCheckBanner({
  storeId,
  messages,
}: {
  storeId: string;
  messages?: ReadinessMessages;
}) {
  const readiness = await getStoreReadiness(storeId);

  if (readiness.ready) return null;

  return <ReadinessBanner missing={readiness.missing} messages={messages} />;
}
