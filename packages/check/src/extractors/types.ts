import type { ExtractedRoute, ExtractedType, ExtractedTest } from "../types.js";

export interface RouteExtractor {
  extract(projectDir: string, routesDir?: string): Promise<ExtractedRoute[]>;
}

export type { ExtractedRoute, ExtractedType, ExtractedTest };
