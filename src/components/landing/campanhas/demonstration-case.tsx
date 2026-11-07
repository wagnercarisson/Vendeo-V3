import type { DemonstrationImage } from "./image-sources";

/**
 * One demonstration case: the submitted photo and the campaign created with
 * Vendeo. Used twice on `/campanhas-para-sua-loja`, each in its own section:
 *
 * - `square`: photo and 1:1 campaign, both in square-safe boxes with
 *   `object-contain`.
 * - `vertical`: photo (2:3) and campaign (9:16). The campaign width is capped on
 *   desktop so the full art stays visible; on mobile it uses the content width.
 *
 * The images are never cropped (`object-contain`) and never share a single grid
 * with the other case. The decorative arrow is hidden from assistive tech.
 */
interface DemonstrationCaseProps {
  id: string;
  heading: string;
  description: string;
  format: "1:1" | "9:16";
  photo: DemonstrationImage;
  campaign: DemonstrationImage;
  photoAlt: string;
  campaignAlt: string;
  loading: "eager" | "lazy";
  layout?: "square" | "vertical";
  quote?: string;
}

export function DemonstrationCase({
  id,
  heading,
  description,
  format,
  photo,
  campaign,
  photoAlt,
  campaignAlt,
  loading,
  layout = "square",
  quote,
}: DemonstrationCaseProps) {
  const vertical = layout === "vertical";
  const photoBox = vertical
    ? "aspect-[2/3] w-full overflow-hidden rounded-lg border border-border-light bg-bg-deep"
    : "w-full overflow-hidden rounded-lg border border-border-light bg-bg-deep";
  const photoFigure = "mx-auto w-full max-w-[342px] sm:mx-0 sm:max-w-none";
  const campaignFigure = "mx-auto w-full max-w-[342px] sm:mx-0 sm:max-w-none";
  const gridColumns = vertical
    ? "sm:grid-cols-[minmax(0,300px)_auto_minmax(0,270px)] sm:justify-center sm:gap-8"
    : "sm:grid-cols-[minmax(0,452px)_auto_minmax(0,452px)] sm:justify-center";
  const campaignBox = vertical
    ? "aspect-[9/16] w-full overflow-hidden rounded-lg border border-border-light bg-bg-deep"
    : "aspect-square w-full overflow-hidden rounded-lg border border-border-light bg-bg-deep";
  const imageClass = vertical
    ? "h-full w-full object-contain"
    : "h-auto w-full object-contain";

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
    >
      <h2
        id={`${id}-heading`}
        className="max-w-4xl font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        {heading}
      </h2>

      <div className={`mt-6 grid items-start gap-6 ${gridColumns}`}>
        <figure className={photoFigure}>
          <figcaption className="mb-3 flex min-h-8 items-start font-heading text-xs font-semibold uppercase tracking-wide text-accent-green">
            Foto enviada
          </figcaption>
          <div className={photoBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              srcSet={photo.srcSet}
              sizes={photo.sizes}
              width={photo.width}
              height={photo.height}
              alt={photoAlt}
              loading={loading}
              decoding="async"
              className={imageClass}
            />
          </div>
        </figure>

        <div
          aria-hidden="true"
          className="flex items-center justify-center self-center text-text-muted sm:self-stretch sm:pt-11"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 sm:hidden"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            className="hidden h-6 w-6 sm:block"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>

        <figure className={campaignFigure}>
          <div className="mb-3 flex min-h-8 items-start justify-between gap-3">
            <figcaption className="font-heading text-xs font-semibold uppercase tracking-wide text-accent-green">
              Campanha criada com o Vendeo
            </figcaption>
            <span className="shrink-0 rounded border border-border px-2 py-0.5 font-heading text-xs font-semibold text-text-secondary">
              {format}
            </span>
          </div>
          <div className={campaignBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={campaign.src}
              srcSet={campaign.srcSet}
              sizes={campaign.sizes}
              width={campaign.width}
              height={campaign.height}
              alt={campaignAlt}
              loading={loading}
              decoding="async"
              className="h-full w-full object-contain"
            />
          </div>
        </figure>
      </div>

      <p className="mt-6 max-w-3xl text-base text-text-secondary">{description}</p>

      {quote ? (
        <p className="mt-6 max-w-3xl border-l-2 border-accent-green pl-4 font-heading text-lg font-semibold text-text-primary">
          {quote}
        </p>
      ) : null}
    </section>
  );
}
