import { encode } from "gpt-tokenizer";

/**
 * Count tokens with a tiktoken (cl100k/o200k) encoder. Claude uses a different
 * tokenizer, but tiktoken is the industry-standard proxy and the *ratios*
 * between formats (the point of this benchmark) track closely across encoders.
 */
export function countTokens(text: string): number {
  return encode(text).length;
}
