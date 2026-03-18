import { encodingForModel } from "js-tiktoken";

let encoder: ReturnType<typeof encodingForModel> | undefined;

function getEncoder() {
  if (!encoder) encoder = encodingForModel("gpt-4o");
  return encoder;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  return getEncoder().encode(text).length;
}
