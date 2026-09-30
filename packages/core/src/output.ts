import { encode } from "@toon-format/toon";
import type { AxiResponse } from "./types.js";

/** A plain object destined for TOON encoding (mirrors the SDK's shape). */
export type AxiStructuredOutput = Record<string, unknown>;

// Below this content size the fixed envelope (confidence, contentLength, …)
// costs more than it's worth, so we emit only the essentials.
const SMALL_PAGE_CHARS = 200;

/**
 * Map an AxiResponse to the flat-ish structure we hand to the TOON encoder.
 * Field order is deliberate: identity first, then content, then aggregates and
 * next steps. Low-value and empty fields are omitted to save tokens — `fetchedAt`
 * is dropped entirely (rarely actionable), `truncated` only shows when true, and
 * trivially small pages get a bare envelope.
 */
export function toStructured(response: AxiResponse): AxiStructuredOutput {
  const { metadata, content, nextSteps } = response;

  const hasStructure =
    Boolean(content.passages) ||
    content.sections.length > 0 ||
    content.codeBlocks.length > 0 ||
    content.tables.length > 0 ||
    content.links.length > 0;
  const isSmall = metadata.contentLength < SMALL_PAGE_CHARS && !hasStructure;

  const output: AxiStructuredOutput = {
    url: metadata.url,
    title: metadata.title,
    type: metadata.type,
  };

  // Size hint (AXI principle 3) isn't worth the tokens on trivially small pages.
  if (!isSmall) {
    output.contentLength = metadata.contentLength;
  }
  if (content.truncated) {
    output.truncated = true;
  }
  if (content.page) {
    output.page = `${content.page.number}/${content.page.of}`;
  }
  if (content.passages) {
    output.passages = content.passages.map((p) => ({ section: p.section ?? "", text: p.text }));
  } else {
    output.content = content.main;
  }

  if (content.sections.length > 0) {
    output.sections = content.sections;
  }
  if (content.codeBlocks.length > 0) {
    output.codeBlocks = content.codeBlocks;
  }
  if (content.tables.length > 0) {
    output.tables = content.tables;
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
