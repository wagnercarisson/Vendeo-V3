export interface F60WindowParsed {
  start: number;
  end: number;
  responsible: string;
  startRaw: string;
  endRaw: string;
}

export type F60WindowStatus = "active" | "closed" | "future" | "invalid";

export function isHomologTarget(target: {
  hostname: string;
  port?: string | number | null;
  pathname: string;
}): boolean;

export interface F60TargetPreflight {
  ok: boolean;
  url: URL | null;
  homolog: boolean;
  errors: string[];
}

export function evaluateF60Target(
  value: unknown,
  env?: Record<string, string | undefined>,
  now?: number,
): F60TargetPreflight;

export function assertF60Target(
  value: unknown,
  env?: Record<string, string | undefined>,
): URL;

export function parseF60Window(value: unknown): F60WindowParsed | null;

export function evaluateF60Window(
  value: unknown,
  now?: number,
): { status: F60WindowStatus; parsed: F60WindowParsed | null };
