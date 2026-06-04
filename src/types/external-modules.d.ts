declare module 'get-pixels' {
  import { Buffer } from 'buffer';
  export default function getPixels(
    path: string | Buffer | Uint8Array,
    type: string,
    callback: (err: Error | null, pixels: any) => void
  ): void;
}

declare module 'get-rgba-palette' {
  export default function getPalette(
    pixels: Uint8Array | number[],
    count?: number,
    quality?: number,
    callback?: (err: Error | null, palette: number[][]) => void
  ): number[][];
}
