"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CampaignListItem } from "@/lib/campaign/list";
import { useDebounce } from "@/hooks/use-debounce";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  CAMPAIGNS_NO_CAMPAIGNS,
  CAMPAIGNS_SEARCH_EMPTY,
} from "@/lib/onboarding/microcopy";
import { Pagination } from "@/components/ui/pagination";
import { Search } from "lucide-react";

interface Props {
  items: CampaignListItem[];
  total: number;
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}

const DEFAULT_PARAMS = new Set([
  "page=1",
  "sort=created_at",
  "order=desc",
  "status=ready,error",
  "date=all",
  "q=",
]);

function isDefault(key: string, value: string | undefined): boolean {
  if (value === undefined) return true;
  return DEFAULT_PARAMS.has(`${key}=${value}`);
}

function buildCampaignUrl(
  currentParams: Record<string, string | string[] | undefined>,
  overrides?: Record<string, string | undefined>,
): string {
  const merged: Record<string, string> = {};
  for (const [key, val] of Object.entries(currentParams)) {
    if (typeof val === "string") merged[key] = val;
    else if (Array.isArray(val)) merged[key] = val.join(",");
  }
  if (overrides) {
    for (const [key, val] of Object.entries(overrides)) {
      if (val === undefined) {
        delete merged[key];
      } else {
        merged[key] = val;
      }
    }
  }
  const entries = Object.entries(merged).filter(
    ([key, val]) => !isDefault(key, val),
  );
  if (entries.length === 0) return "/campanhas";
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `/campanhas?${qs}`;
}

export default function CampaignListClient({
  items,
  total,
  page,
  totalPages,
  searchParams: rawParams,
}: Props) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(
    typeof rawParams.q === "string" ? rawParams.q : "",
  );
  const debouncedSearch = useDebounce(searchInput, 300);

  const navigateToPage = useCallback(
    (newPage: number) => {
      router.replace(
        buildCampaignUrl(rawParams, {
          page: newPage === 1 ? undefined : String(newPage),
        }),
      );
    },
    [router, rawParams],
  );

  const hasActiveFilters =
    (typeof rawParams.q === "string" && rawParams.q.trim().length > 0) ||
    (typeof rawParams.date === "string" &&
      rawParams.date !== "all" &&
      rawParams.date !== undefined) ||
    (typeof rawParams.sort === "string" &&
      rawParams.sort !== "created_at") ||
    (typeof rawParams.order === "string" && rawParams.order !== "desc") ||
    (typeof rawParams.status === "string" &&
      rawParams.status !== "ready,error");

  useEffect(() => {
    if (debouncedSearch !== (typeof rawParams.q === "string" ? rawParams.q : "")) {
      router.replace(buildCampaignUrl(rawParams, { q: debouncedSearch || undefined, page: undefined }));
    }
  }, [debouncedSearch]);

  const navigate = useCallback(
    (overrides: Record<string, string | undefined>) => {
      overrides.page = undefined;
      router.replace(buildCampaignUrl(rawParams, overrides));
    },
    [router, rawParams],
  );

  const STATUS_OPTIONS = [
    { label: "Todas", value: "ready,error" },
    { label: "Prontas", value: "ready" },
    { label: "Erro", value: "error" },
  ] as const;

  const currentStatus =
    typeof rawParams.status === "string"
      ? rawParams.status
      : "ready,error";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Campanhas" />

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="relative w-full md:w-auto md:min-w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Buscar campanhas..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 md:w-auto"
          />
        </div>
        <select
          value={
            typeof rawParams.date === "string" ? rawParams.date : "all"
          }
          onChange={(e) => navigate({ date: e.target.value })}
          className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        >
          <option value="all">Todas</option>
          <option value="7d">7 dias</option>
          <option value="30d">30 dias</option>
          <option value="90d">90 dias</option>
          <option value="year">Este ano</option>
        </select>
        <select
          value={`${typeof rawParams.sort === "string" ? rawParams.sort : "created_at"},${typeof rawParams.order === "string" ? rawParams.order : "desc"}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(",");
            navigate({ sort, order });
          }}
          className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        >
          <option value="created_at,desc">Mais recentes</option>
          <option value="created_at,asc">Mais antigas</option>
          <option value="product_name,asc">Nome A-Z</option>
          <option value="product_name,desc">Nome Z-A</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rounded-lg px-4 py-1.5 text-sm font-heading font-semibold transition-all duration-200 ${
              currentStatus === opt.value
                ? "bg-accent-green text-white"
                : "border border-border text-text-secondary hover:bg-bg-elevated"
            }`}
            onClick={() => navigate({ status: opt.value })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {items.length === 0 && !hasActiveFilters && (
        <EmptyState
          icon={CAMPAIGNS_NO_CAMPAIGNS.icon}
          title={CAMPAIGNS_NO_CAMPAIGNS.title}
          description={CAMPAIGNS_NO_CAMPAIGNS.description}
          action={
            <Link
              href={CAMPAIGNS_NO_CAMPAIGNS.ctaHref!}
              className="inline-flex items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200"
            >
              {CAMPAIGNS_NO_CAMPAIGNS.ctaLabel}
            </Link>
          }
        />
      )}

      {items.length === 0 && hasActiveFilters && (
        <EmptyState
          icon={CAMPAIGNS_SEARCH_EMPTY.icon}
          title={CAMPAIGNS_SEARCH_EMPTY.title}
          description={CAMPAIGNS_SEARCH_EMPTY.description}
        />
      )}

      {items.length > 0 && (
        <div className="space-y-4">
          {items.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={navigateToPage}
        />
      )}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const formattedDate = formatDate(campaign.createdAt);

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-bg-surface p-4">
      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
        {campaign.thumbnailUrl ? (
          <img
            src={campaign.thumbnailUrl}
            alt={campaign.productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-bg-elevated" />
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1">
        <h3 className="text-lg font-semibold text-text-primary font-heading">
          {campaign.productName}
        </h3>
        <span className="text-sm text-text-muted font-body">
          {formattedDate}
        </span>
        <span
          className={`text-sm font-medium font-heading ${
            campaign.status === "ready" ? "text-accent-green" : "text-accent-red"
          }`}
        >
          {campaign.status === "ready" ? "Pronta" : "Erro"}
        </span>
      </div>
      <div className="flex flex-col items-end justify-center gap-2">
        <Link
          href={`/campanhas/${campaign.id}`}
          className="rounded-lg bg-accent-green px-4 py-1.5 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200"
        >
          Abrir
        </Link>
        {campaign.status === "ready" && (
          <Link
            href={`/api/campaign/${campaign.id}/download`}
            className="rounded-lg border border-border px-4 py-1.5 text-sm text-text-secondary font-body hover:bg-bg-elevated transition-all duration-200"
          >
            Baixar
          </Link>
        )}
      </div>
    </div>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
