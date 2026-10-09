/**
 * Fixed-ratio, swappable campaign image / placeholder primitive.
 *
 * The wrapper always owns a 1:1 (`aspect-square`) box so replacing the
 * placeholder with an approved campaign NEVER shifts layout. When `src` is
 * absent a neutral skeleton is rendered (no image tag); when `src` is present a
 * plain `<img>` fills the fixed box with `object-cover` (or `object-contain`
 * when `contain` is true).
 *
 * Swapping procedure: replace the `src` value with the approved landing-owned
 * asset path (or add `contain` to avoid cropping). The ratio utilities live
 * inside this wrapper, so the surrounding grid does not relayout.
 *
 * Do NOT use the Next.js Image component here — its intrinsic sizing would
 * reintroduce layout shift on swap; the codebase standard is a plain `<img>`
 * inside a fixed-ratio box.
 */
interface CampaignImageProps {
  src?: string;
  alt: string;
  className?: string;
  contain?: boolean;
}

export function CampaignImage({
  src,
  alt,
  className = "",
  contain = false,
}: CampaignImageProps) {
  return (
    <div
      data-campaign-image
      className={`aspect-square w-full overflow-hidden rounded-lg border border-border-light bg-bg-surface ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`h-full w-full ${contain ? "object-contain" : "object-cover"}`}
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-full w-full bg-bg-elevated"
        />
      )}
    </div>
  );
}
