import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StoreIdentityForm } from "@/components/flow/store-identity-form";

export default function StorePage() {
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
      <StoreIdentityForm />
    </main>
  );
}
