"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, Search } from "lucide-react";
import type { CampaignListItem } from "@/lib/campaign/list";
import type { CampaignListMessages } from "@/lib/i18n/campaign-list/messages";
import { formatCampaignListDate } from "@/lib/i18n/campaign-list/format-date";
import type { SupportedUiLocale } from "@/lib/i18n/locales";
import { useDebounce } from "@/hooks/use-debounce";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";

interface Props {
  items: CampaignListItem[];
  total: number;
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
  messages: CampaignListMessages;
  locale: SupportedUiLocale;
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
  messages,
  locale,
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
    { label: messages.filters.statusAll, value: "ready,error" },
    { label: messages.filters.statusReady, value: "ready" },
    { label: messages.filters.statusError, value: "error" },
  ] as const;

  const currentStatus =
    typeof rawParams.status === "string"
      ? rawParams.status
      : "ready,error";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={messages.title} />

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="relative w-full md:w-auto md:min-w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder={messages.search.placeholder}
            aria-label={messages.search.ariaLabel}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 md:w-auto"
          />
        </div>
        <select
          aria-label={messages.filters.periodLabel}
          value={
            typeof rawParams.date === "string" ? rawParams.date : "all"
          }
          onChange={(e) => navigate({ date: e.target.value })}
          className="min-h-[44px] rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        >
          <option value="all">{messages.filters.periodAll}</option>
          <option value="7d">{messages.filters.period7d}</option>
          <option value="30d">{messages.filters.period30d}</option>
          <option value="90d">{messages.filters.period90d}</option>
          <option value="year">{messages.filters.periodYear}</option>
        </select>
        <select
          aria-label={messages.filters.sortLabel}
          value={`${typeof rawParams.sort === "string" ? rawParams.sort : "created_at"},${typeof rawParams.order === "string" ? rawParams.order : "desc"}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(",");
            navigate({ sort, order });
          }}
          className="min-h-[44px] rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        >
          <option value="created_at,desc">{messages.filters.sortNewest}</option>
          <option value="created_at,asc">{messages.filters.sortOldest}</option>
          <option value="product_name,asc">{messages.filters.sortNameAsc}</option>
          <option value="product_name,desc">{messages.filters.sortNameDesc}</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`min-h-[44px] rounded-lg px-4 py-1.5 text-sm font-heading font-semibold transition-all duration-200 ${
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
          icon={Megaphone}
          title={messages.empty.noCampaignsTitle}
          description={messages.empty.noCampaignsBody}
          action={
            <Link
              href="/campanhas/nova"
              className="inline-flex items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200"
            >
              {messages.empty.noCampaignsCta}
            </Link>
          }
        />
      )}

      {items.length === 0 && hasActiveFilters && (
        <EmptyState
          icon={Search}
          title={messages.empty.searchTitle}
          description={messages.empty.searchBody}
        />
      )}

      {items.length > 0 && (
        <div className="space-y-4">
          {items.map((campaign, index) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              index={index}
              messages={messages}
              locale={locale}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={navigateToPage}
          labels={messages.pagination}
        />
      )}
    </div>
  );
}

function campaignStatusDisplay(
  campaign: CampaignListItem,
  messages: CampaignListMessages["status"],
): {
  text: string;
  className: string;
} {
  if (campaign.status === "ready") {
    return { text: messages.ready, className: "text-accent-green" };
  }
  // Quick 261018-enc — campanha do NOVO fluxo encerrada com estorno: rótulo
  // NEUTRO (não “falha técnica”; o tratamento por motivo vive no detalhe).
  if (campaign.flow === "new") {
    return { text: messages.incomplete, className: "text-text-secondary" };
  }
  return { text: messages.error, className: "text-accent-red" };
}

function CampaignCard({
  campaign,
  index,
  messages,
  locale,
}: {
  campaign: CampaignListItem;
  index: number;
  messages: CampaignListMessages;
  locale: SupportedUiLocale;
}) {
  const router = useRouter();
  const formattedDate = formatCampaignListDate(campaign.createdAt, locale);
  const status = campaignStatusDisplay(campaign, messages.status);
  const formatLabel =
    campaign.format === "1:1"
      ? messages.format.square
      : campaign.format === "9:16"
        ? messages.format.vertical
        : null;
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(campaign.thumbnailUrl) && !imageFailed;

  useEffect(() => {
    // URL nova limpa a falha anterior (recuperação após erro/404).
    setImageFailed(false);

    // Falha antes da hidratação não reemite `error` para o React.
    const image = imageRef.current;
    if (image && image.complete && image.naturalWidth === 0) {
      setImageFailed(true);
    }
  }, [campaign.thumbnailUrl]);

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-bg-surface p-4">
      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
        {showImage && campaign.thumbnailUrl ? (
          <img
            ref={imageRef}
            src={campaign.thumbnailUrl}
            alt={campaign.productName}
            lang=""
            loading={index < 3 ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="h-full w-full bg-bg-elevated" />
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1">
        <h3
          lang=""
          className="text-lg font-semibold text-text-primary font-heading"
        >
          {campaign.productName}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted font-body">
          <span>{formattedDate}</span>
          {formatLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatLabel}</span>
            </>
          )}
        </div>
        <span className={`text-sm font-medium font-heading ${status.className}`}>
          {status.text}
        </span>
      </div>
      <div className="flex flex-col items-end justify-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => router.push(`/campanhas/${campaign.id}`)}
        >
          {messages.actions.open}
        </Button>
        {campaign.status === "ready" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { window.location.href = `/api/campaign/${campaign.id}/download`; }}
          >
            {messages.actions.download}
          </Button>
        )}
      </div>
    </div>
  );
}
