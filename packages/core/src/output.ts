import { encode } from "@toon-format/toon";
import type { AxiResponse } from "./types.js";

/** A plain object destined for TOON encoding (mirrors the SDK's shape). */
export type AxiStructuredOutput = Record<string, unknown>;

/**
 * Map an AxiResponse to the flat-ish structure we hand to the TOON encoder.
 * Field order is deliberate: identity first, then content, then aggregates and
 * next steps. Empty collections are omitted to save tokens.
 */
export function toStructured(response: AxiResponse): AxiStructuredOutput {
  const { metadata, content, nextSteps } = response;

  const output: AxiStructuredOutput = {
    url: metadata.url,
    title: metadata.title,
    type: metadata.type,
    confidence: Number(metadata.confidence.toFixed(2)),
    fetchedAt: metadata.fetchedAt,
    contentLength: metadata.contentLength,
    truncated: content.truncated,
    content: content.main,
  };

  if (content.sections.length > 0) {
    output.sections = content.sections;
  }
  if (content.links.length > 0) {
    output.links = content.links;
  }
  if (nextSteps.length > 0) {
    output.help = nextSteps;
  }

  return output;
}

/** Encode an AxiResponse as a TOON string (the agent-facing payload). */
export function toToon(response: AxiResponse): string {
  return encode(toStructured(response));
}
