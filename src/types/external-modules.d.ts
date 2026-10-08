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
  // Opções de conexão compartilhadas por Pool/Client. A declaração ambiente é
  // mínima (o pacote `pg` não traz tipos próprios e `@types/pg` não é instalado);
  // `ssl` é necessário e tipado explicitamente — sem cast para contornar.
  export interface ConnectionOptions {
    connectionString?: string;
    ssl?: boolean | Record<string, unknown>;
  }

  export interface PoolClient {
    query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
    release(): void;
  }

  export class Pool {
    constructor(options?: ConnectionOptions);
    query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
  export class Client {
    constructor(options?: ConnectionOptions);
    connect(): Promise<void>;
    query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  }
}
