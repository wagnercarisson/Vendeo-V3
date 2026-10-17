export declare function runProofs(opts: {
  makeClient: () => {
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  };
  log?: (msg: string) => void;
}): Promise<{ failures: number }>;
