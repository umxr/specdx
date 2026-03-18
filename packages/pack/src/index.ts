export type {
  PackOptions,
  PackResult,
  PackStats,
  SpecAllocation,
  RelevanceScore,
  CompressedSpec,
  CompressedSection,
  CompressionOptions,
} from "./types.js";

export { scoreSpecs, scoreSpecsByIds } from "./resolver.js";
export { allocate, type AllocatorOptions, type AllocationResult } from "./allocator.js";
export { compressSpec } from "./compressor.js";
