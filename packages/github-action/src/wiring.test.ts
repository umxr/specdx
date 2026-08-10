import { describe, it, expect } from "vitest";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMENT_MARKER } from "./comment.js";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(pkgRoot, "src");
const bundle = join(pkgRoot, "bundle", "main.cjs");

/**
 * Reachability, not just correctness.
 *
 * `formatComment` and `generateBadge` were both fully implemented, fully
 * tested, and called by nothing: `main.ts` never imported them and `index.ts`
 * was `export {}`. Every unit test passed, the README promised the comment,
 * and the feature did not exist. Worse, the vacuous-pass audit "fixed" the
 * comment renderer's zero-spec case -- a fix landing in dead code, which is
 * why the live job path stayed broken through four audit runs.
 *
 * These assertions are about whether code is wired in, which no renderer test
 * can tell you.
 */
describe("every module is reachable from something that runs", () => {
  /** Modules that exist to be composed, not to be entrypoints. */
  const ENTRYPOINTS = ["main.ts", "index.ts"];

  function importsOf(file: string): string[] {
    const source = readFileSync(file, "utf-8");
    return [
      ...[...source.matchAll(/^(?:import|export)\s[\s\S]*?from\s*["'](\.[^"']+)["']/gm)],
      ...[...source.matchAll(/\bimport\(["'](\.[^"']+)["']\)/g)],
    ]
      .map((m) => m[1]!)
      .map((spec) => resolve(dirname(file), spec.replace(/\.js$/, ".ts")));
  }

  function reachableFrom(entry: string): Set<string> {
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (seen.has(current) || !existsSync(current)) continue;
      seen.add(current);
      queue.push(...importsOf(current));
    }
    return seen;
  }

  const modules = execFileSync("git", ["ls-files", "src"], { cwd: pkgRoot, encoding: "utf-8" })
    .split("\n")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(pkgRoot, f));

  it("imports every module into the entrypoint GitHub executes, or the library index", () => {
    const wired = new Set<string>();
    for (const entry of ENTRYPOINTS) {
      for (const file of reachableFrom(join(srcRoot, entry))) wired.add(file);
    }

    const orphans = modules.filter((m) => !wired.has(m)).map((m) => m.slice(srcRoot.length + 1));
    expect(orphans).toEqual([]);
  });

  it("reaches the comment and badge renderers from main, not only from the index", () => {
    // The index alone is not enough: this package is private and nothing
    // imports it, so a module exported there and used nowhere is still dead
    // as far as the shipped action is concerned.
    const fromMain = reachableFrom(join(srcRoot, "main.ts"));
    expect(fromMain).toContain(join(srcRoot, "comment.ts"));
    expect(fromMain).toContain(join(srcRoot, "badge.ts"));
  });

  it("keeps the renderers in the committed bundle", () => {
    // tsup tree-shakes. An unreachable renderer is dropped from the artifact
    // GitHub runs, so the bundle itself is the honest test of wiring -- and it
    // catches a fix that was made in src but never rebuilt.
    const source = readFileSync(bundle, "utf-8");
    expect(source).toContain("Spec Health Report");
    expect(source).toContain(COMMENT_MARKER);
    expect(source).toContain("spec health");
  });
});

/**
 * The comment path, end to end, against a fake GitHub API.
 *
 * `@actions/github` builds its octokit against `GITHUB_API_URL`, so pointing
 * that at a local server exercises the real request the action makes.
 */
describe("the action comments on pull requests", () => {
  interface Call {
    method: string;
    url: string;
    body: string;
  }

  /** Run the committed bundle against a stub API; returns stdout and the calls made. */
  async function runAction(options: {
    token?: string;
    badgePath?: string;
    postComment?: boolean;
    pullRequest?: boolean;
    respond?: (req: IncomingMessage, res: ServerResponse) => boolean;
  }): Promise<{ stdout: string; failed: boolean; calls: Call[]; dir: string }> {
    const calls: Call[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        calls.push({ method: req.method ?? "", url: req.url ?? "", body });
        if (options.respond?.(req, res)) return;
        res.setHeader("content-type", "application/json");
        if (req.method === "GET") {
          res.writeHead(200).end("[]");
        } else {
          res.writeHead(201).end(JSON.stringify({ id: 42 }));
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;

    const dir = mkdtempSync(join(tmpdir(), "sdx-action-comment-"));
    mkdirSync(join(dir, "specs"), { recursive: true });
    writeFileSync(
      join(dir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "project:",
        '  name: "act"',
        "ci:",
        `  post_comment: ${options.postComment ?? true}`,
        "specs:",
        "  ledger:",
        "    path: specs/ledger.md",
        "    type: quick-spec",
        "",
      ].join("\n"),
    );
    // A quick-spec needs the fewest sections of any type, so the fixture can
    // be free of *errors* -- these cases assert the job passes, which it can
    // only do if lint has nothing error-severity to say.
    writeFileSync(
      join(dir, "specs", "ledger.md"),
      [
        "---",
        'id: "ledger"',
        'type: "quick-spec"',
        'title: "Ledger export"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["a"]',
        "---",
        "",
        "## Intent",
        "",
        "Export the ledger to CSV for the finance team.",
        "",
        "## Boundaries",
        "",
        "CSV only. No scheduling, no email delivery.",
        "",
        "## Tasks",
        "",
        "- Add the export endpoint",
        "- Stream rows so a large ledger does not buffer",
        "",
      ].join("\n"),
    );
    const eventPath = join(dir, "event.json");
    writeFileSync(
      eventPath,
      JSON.stringify(
        options.pullRequest === false
          ? {}
          : { pull_request: { number: 7, base: { ref: "HEAD" }, head: { ref: "HEAD" } } },
      ),
    );

    // Async, not execFileSync: the stub server shares this process's event
    // loop, so a synchronous spawn would block it and deadlock against the
    // request the action is waiting on.
    let stdout: string;
    let failed = false;
    try {
      const result = await promisify(execFile)("node", [bundle], {
        cwd: dir,
        encoding: "utf-8",
        env: {
          ...process.env,
          "INPUT_WORKING-DIRECTORY": dir,
          INPUT_PRESET: "recommended",
          "INPUT_GITHUB-TOKEN": options.token ?? "",
          "INPUT_BADGE-PATH": options.badgePath ?? "",
          GITHUB_WORKSPACE: dir,
          GITHUB_REPOSITORY: "umxr/specdx",
          GITHUB_EVENT_NAME: "pull_request",
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_API_URL: `http://127.0.0.1:${port}`,
        } as NodeJS.ProcessEnv,
      });
      stdout = result.stdout;
    } catch (err) {
      failed = true;
      stdout = String((err as { stdout?: string }).stdout ?? "");
    }

    await new Promise<void>((r) => server.close(() => r()));
    return { stdout, failed, calls, dir };
  }

  it("posts the rendered comment when given a token", async () => {
    const { calls, failed, dir } = await runAction({ token: "t0ken" });

    const created = calls.find((c) => c.method === "POST");
    expect(created).toBeDefined();
    expect(created!.url).toBe("/repos/umxr/specdx/issues/7/comments");
    const body = JSON.parse(created!.body).body as string;
    expect(body).toContain(COMMENT_MARKER);
    expect(body).toContain("Spec Health Report");
    expect(body).toContain("1 specs checked");
    expect(failed).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it("updates its own previous comment instead of stacking a new one", async () => {
    const { calls, dir } = await runAction({
      token: "t0ken",
      respond: (req, res) => {
        if (req.method !== "GET") return false;
        res.setHeader("content-type", "application/json");
        res
          .writeHead(200)
          .end(JSON.stringify([{ id: 99, body: `${COMMENT_MARKER}\nstale report` }]));
        return true;
      },
    });

    expect(calls.some((c) => c.method === "POST")).toBe(false);
    const patched = calls.find((c) => c.method === "PATCH");
    expect(patched).toBeDefined();
    expect(patched!.url).toBe("/repos/umxr/specdx/issues/comments/99");

    rmSync(dir, { recursive: true, force: true });
  });

  it("makes no request and still passes when no token is given", async () => {
    const { calls, stdout, failed, dir } = await runAction({ token: "" });

    expect(calls).toEqual([]);
    expect(stdout).toContain("no github-token");
    expect(failed).toBe(false);

    rmSync(dir, { recursive: true, force: true });
  });

  it("honours post_comment: false", async () => {
    const { calls, stdout, dir } = await runAction({ token: "t0ken", postComment: false });

    expect(calls).toEqual([]);
    expect(stdout).toContain("post_comment is false");

    rmSync(dir, { recursive: true, force: true });
  });

  it("does not fail a passing check when the API rejects the comment", async () => {
    // The common cause is a workflow without `pull-requests: write`. A spec
    // suite that passed must not go red because a comment could not be left.
    const { stdout, failed, dir } = await runAction({
      token: "t0ken",
      respond: (req, res) => {
        res.setHeader("content-type", "application/json");
        res
          .writeHead(403)
          .end(JSON.stringify({ message: "Resource not accessible by integration" }));
        return true;
      },
    });

    expect(failed).toBe(false);
    expect(stdout).toContain("::warning");
    expect(stdout).toContain("pull-requests: write");

    rmSync(dir, { recursive: true, force: true });
  });

  it("writes the badge only when a path is given", async () => {
    const withBadge = await runAction({ badgePath: "health.svg" });
    const svg = readFileSync(join(withBadge.dir, "health.svg"), "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("spec health");
    // The fixture is error-free, so the status must read passing -- a badge
    // that always said the same thing would satisfy the assertion above.
    expect(svg).toContain("passing");
    expect(withBadge.stdout).toContain("Spec health badge written to health.svg (passing)");
    rmSync(withBadge.dir, { recursive: true, force: true });

    const without = await runAction({});
    expect(existsSync(join(without.dir, "health.svg"))).toBe(false);
    rmSync(without.dir, { recursive: true, force: true });
  });
});
