export interface ValidatedSearchParams {
  page: number;
  pageSize: number;
  q: string | undefined;
  status: Array<"ready" | "error">;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  sortBy: "created_at" | "product_name";
  sortOrder: "asc" | "desc";
}

const VALID_STATUSES = ["ready", "error"] as const;
const VALID_DATES = ["7d", "30d", "90d", "year", "all"] as const;
const VALID_SORT = ["created_at", "product_name"] as const;
const VALID_ORDER = ["asc", "desc"] as const;

function resolveDatePreset(
  preset: string,
): { dateFrom: string | undefined; dateTo: string | undefined } {
  const now = new Date();

  switch (preset) {
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
    }
    case "90d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 90);
      return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
    }
    default:
      return { dateFrom: undefined, dateTo: undefined };
  }
}

export function parseCampaignListSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ValidatedSearchParams {
  const rawPage = typeof raw.page === "string" ? raw.page : undefined;
  const pageNum = rawPage ? parseInt(rawPage, 10) : NaN;
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1;

  const rawQ = typeof raw.q === "string" ? raw.q : undefined;
  const q = rawQ ? rawQ.trim().slice(0, 100) || undefined : undefined;

  const rawStatus = typeof raw.status === "string" ? raw.status : undefined;
  const statusValues = rawStatus
    ? rawStatus
        .split(",")
        .map((s) => s.trim())
        .filter((s) =>
          (VALID_STATUSES as ReadonlyArray<string>).includes(s),
        )
    : [];
  const status: Array<"ready" | "error"> =
    (statusValues.length > 0 ? statusValues : ["ready", "error"]) as Array<"ready" | "error">;

  const rawDate = typeof raw.date === "string" ? raw.date : undefined;
  const datePreset =
    rawDate && (VALID_DATES as readonly string[]).includes(rawDate)
      ? rawDate
      : "all";
  const { dateFrom, dateTo } = resolveDatePreset(datePreset);

  const rawSort = typeof raw.sort === "string" ? raw.sort : undefined;
  const sortBy =
    rawSort && (VALID_SORT as readonly string[]).includes(rawSort)
      ? (rawSort as "created_at" | "product_name")
      : "created_at";

  const rawOrder = typeof raw.order === "string" ? raw.order : undefined;
  const sortOrder =
    rawOrder && (VALID_ORDER as readonly string[]).includes(rawOrder)
      ? (rawOrder as "asc" | "desc")
      : "desc";

  return {
    page,
    pageSize: 10,
    q,
    status,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
  };
}
