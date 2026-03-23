import { loadConfig, parseSpec, resolveGlob } from "@specdx/core";
import { runCheck } from "@specdx/check";
import type { ParsedSpec } from "@specdx/core";

export async function handleCheck(params: {
  framework?: string;
  specId?: string;
}): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const paths = await resolveGlob(entry.path, configDir);
    for (const p of paths) {
      const spec = await parseSpec(p);
      if (params.specId && spec.frontmatter.id !== params.specId) continue;
      specs.push(spec);
    }
  }

  const checkConfig = {
    ...config.check,
    ...(params.framework
      ? { framework: params.framework as "express" | "hono" | "nextjs" }
      : {}),
  };

  const result = await runCheck(specs, configDir, checkConfig);
  return JSON.stringify(result);
}
