import { createConsola, type ConsolaInstance } from "consola";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  quiet?: boolean;
  verbose?: boolean;
}

export interface Logger extends ConsolaInstance {
  level: number;
}

export function createLogger(options?: LoggerOptions): Logger {
  let level = 3; // info
  if (options?.quiet) level = 1; // only errors
  if (options?.verbose) level = 4; // debug
  return createConsola({ level }) as Logger;
}
