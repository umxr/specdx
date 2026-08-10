/**
 * Quiet-aware console output.
 *
 * `--quiet` used to only lower a consola log level while every user-facing
 * line went out through `console.log`, so the flag changed nothing a user
 * could see (audit run 5, F2). Routing the pretty renderers through this
 * splits output into two classes and gives the flag something to suppress.
 */
export interface Output {
  /** Banners, verdicts, summaries — chrome. Suppressed by `--quiet`. */
  info(line?: string): void;
  /** Diagnostics, findings, payloads. Always printed. */
  out(line?: string): void;
  /** Errors and warnings, on stderr. Always printed. */
  error(line?: string): void;
}

export function createOutput(options: { quiet?: boolean } = {}): Output {
  const quiet = options.quiet === true;
  return {
    info(line = "") {
      if (!quiet) console.log(line);
    },
    out(line = "") {
      console.log(line);
    },
    error(line = "") {
      console.error(line);
    },
  };
}
