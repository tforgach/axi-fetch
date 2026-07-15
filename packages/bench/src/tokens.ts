import { encode } from "gpt-tokenizer/encoding/o200k_base";

/**
 * Count tokens with the o200k_base encoder (GPT-4o / modern OpenAI models).
 * Claude uses a different tokenizer, but o200k is a current industry-standard
 * proxy and the *ratios* between formats (the point of this benchmark) track
 * closely across encoders.
 */
export function countTokens(text: string): number {
  return encode(text).length;
}
