import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { StorePageClient } from "@/components/flow/store-page-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function StorePage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors duration-200 font-heading font-medium text-sm rounded-lg px-3 py-1.5 -ml-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
      </div>
      <StorePageClient initialStore={store} />
    </main>
  );
}
