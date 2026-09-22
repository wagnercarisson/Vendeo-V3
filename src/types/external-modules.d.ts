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

declare module 'pg' {
  export class Pool {
    constructor(options?: { connectionString?: string });
    query<T = any>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  }
  export class Client {
    constructor(options?: { connectionString?: string });
    connect(): Promise<void>;
    query<T = any>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  }
}
