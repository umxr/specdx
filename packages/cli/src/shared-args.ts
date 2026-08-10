/**
 * Args every reporting command shares.
 *
 * `--format` is declared per command, not globally. Spreading one blanket
 * `format` arg put the value `github` in every `--help` while only two
 * commands implemented it, and an unknown value fell through to pretty output
 * with exit 0 — a CI step could ask for annotations, get none, and still go
 * green (audit run 5, F2). A command now names the formats it renders, the
 * help text is generated from that list, and anything else is an error.
 */

/** The single source of truth for a command's `--format` values. */
export type FormatArg = {
  type: "string";
  description: string;
  default: string;
};

export const quietArg = {
  type: "boolean" as const,
  description: "Suppress success and summary output; problems still print",
  alias: ["q"],
};

export const verboseArg = {
  type: "boolean" as const,
  description: "Enable debug output",
  alias: ["V"],
};

/**
 * Build the `--format` arg from the formats a command actually implements.
 * The first entry is the default.
 */
export function formatArg(formats: readonly string[]): FormatArg {
  const [fallback] = formats;
  if (!fallback) throw new Error("formatArg requires at least one format");
  return {
    type: "string",
    description: `Output format (${formats.join(", ")})`,
    default: fallback,
  };
}

/** `--quiet`, `--verbose`, and a `--format` limited to what the command renders. */
export function sharedArgs(formats: readonly string[]): {
  quiet: typeof quietArg;
  verbose: typeof verboseArg;
  format: FormatArg;
} {
  return { quiet: quietArg, verbose: verboseArg, format: formatArg(formats) };
}

/**
 * Narrow a user-supplied `--format` to one the command renders.
 *
 * Returns null when the value is unsupported, so the caller can print and pick
 * its own exit code. Silently falling back to pretty is the defect this
 * replaces: the user asked for a machine-readable payload and got prose.
 */
export function resolveFormat<T extends string>(
  value: string | undefined,
  formats: readonly T[],
): { ok: true; format: T } | { ok: false; message: string } {
  const [fallback] = formats;
  if (!fallback) throw new Error("resolveFormat requires at least one format");
  if (value === undefined) return { ok: true, format: fallback };
  if ((formats as readonly string[]).includes(value)) return { ok: true, format: value as T };
  return {
    ok: false,
    message: `unknown --format "${value}". This command renders: ${formats.join(", ")}.`,
  };
}
