import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const BG = "#0F172A";
const ACCENT = "#22C55E";

// Deterministic vector glyph — the "V" of Vendeo drawn with a polyline,
// no font/text dependency (librsvg does not guarantee <text> rendering).
// Extents: X 160..352, Y 168..344 — inside the maskable safe zone (80%).
function buildSvg({ rounded }) {
  const background = rounded
    ? `<rect width="512" height="512" rx="96" fill="${BG}" />`
    : `<rect width="512" height="512" fill="${BG}" />`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${background}
  <polyline points="160,168 256,344 352,168" stroke="${ACCENT}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>`;
}

const targets = [
  { name: "icon-192x192.png", size: 192, rounded: true },
  { name: "icon-512x512.png", size: 512, rounded: true },
  { name: "icon-maskable-512x512.png", size: 512, rounded: false },
  { name: "apple-touch-icon.png", size: 180, rounded: true },
];

await mkdir("public/icons", { recursive: true });

for (const target of targets) {
  const svg = buildSvg({ rounded: target.rounded });
  const dest = `public/icons/${target.name}`;
  await sharp(Buffer.from(svg))
    .png()
    .resize(target.size, target.size)
    .toFile(dest);

  // Self-verify: fail (exit != 0) if the PNG format or dimensions diverge.
  const meta = await sharp(dest).metadata();
  if (meta.format !== "png" || meta.width !== target.size || meta.height !== target.size) {
    throw new Error(
      `Self-check failed for ${target.name}: got ${meta.format} ${meta.width}x${meta.height}, expected png ${target.size}x${target.size}`,
    );
  }
  console.log(`OK ${target.name} ${meta.width}x${meta.height}`);
}
