/**
 * Where data may go.
 *
 * A boundary is a place data lives under one set of rules: your own Mac mini,
 * a client-managed laptop, a client's cloud account. What decides a
 * boundary is which model sees the data, not where the file sits. An email
 * read by an agent signed in to your own Claude account has left the client's
 * boundary, even if no file moved.
 *
 * Records cross a boundary only as a card: a fixed set of fields with a title
 * written for the destination. Nothing is copied across field by field, so a
 * field added to a record later cannot leak by default.
 */
import { z } from "zod/v4";

import { Classification, Identifier } from "./model";

export const classificationRank: Record<Classification, number> = {
  public: 0,
  internal: 1,
  "client-confidential": 2,
  restricted: 3,
};

export const BoundaryPolicy = z.object({
  id: Identifier,
  name: z.string().min(1),
  /** The most sensitive classification this boundary may hold. */
  clearance: Classification,
});
export type BoundaryPolicy = z.infer<typeof BoundaryPolicy>;

export function mayHold(
  boundary: BoundaryPolicy,
  classification: Classification,
): boolean {
  return (
    classificationRank[classification] <= classificationRank[boundary.clearance]
  );
}

/**
 * The only shape that crosses a boundary. `.strict()` rejects any field not
 * listed, so a caller cannot pass a whole record through.
 */
export const BoundaryCard = z
  .object({
    id: Identifier,
    kind: z.enum(["task", "question", "decision"]),
    clientId: Identifier,
    title: z.string().min(1).max(120),
    /** A short status word or two, such as "in review". */
    state: z.string().min(1).max(40),
    classification: Classification,
    sourceBoundary: Identifier,
    /** Opaque. Resolves to the original only inside the source boundary. */
    sourceReference: z.string().min(1).max(200),
  })
  .strict();
export type BoundaryCard = z.infer<typeof BoundaryCard>;

export interface Withheld {
  withheld: true;
  clientId: string;
  sourceBoundary: string;
}

export interface CardRequest {
  id: string;
  kind: BoundaryCard["kind"];
  clientId: string;
  /** Written for the destination by the agent inside the source boundary. */
  title: string;
  state: string;
  classification: Classification;
  sourceBoundary: string;
  sourceReference: string;
}

/**
 * A card for the destination, or a bare "withheld" marker when the
 * destination may not hold the record's classification. Restricted records
 * therefore show up only as a count, never with a title.
 *
 * Throws when the title still contains personal data; the boundary agent
 * must rewrite it rather than have it silently trimmed.
 */
export function exportCard(
  request: CardRequest,
  destination: BoundaryPolicy,
): BoundaryCard | Withheld {
  if (!mayHold(destination, request.classification)) {
    return {
      withheld: true,
      clientId: request.clientId,
      sourceBoundary: request.sourceBoundary,
    };
  }
  // Both free-text fields: a state is short, but "waiting on +44 20..." is
  // still personal data. Lengths are checked first by the schema, so the
  // patterns never run on a long input.
  const card = BoundaryCard.parse(request);
  for (const field of ["title", "state"] as const) {
    const findings = findPersonalData(card[field]);
    if (findings.length > 0) {
      throw new Error(
        `card ${field} for ${request.id} contains ${findings.map((finding) => finding.kind).join(", ")}; rewrite it inside the source boundary`,
      );
    }
  }
  return card;
}

export interface PersonalDataFinding {
  kind: "email" | "phone" | "long-number" | "url-with-query";
  index: number;
}

// Most specific first: a long identifier is also a run of digits the phone
// pattern would claim, and the more specific name is the more useful one.
const detectors: Array<[PersonalDataFinding["kind"], RegExp]> = [
  ["email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ["url-with-query", /https?:\/\/[^\s?]+\?[^\s]+/g],
  ["long-number", /\b\d{8,}\b/g],
  ["phone", /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,4}\d{2,4}/g],
];

/**
 * A deterministic second check for the obvious cases: email addresses, phone
 * numbers, long numeric identifiers (patient, subject, account numbers) and
 * URLs carrying query strings. It is a net under the allow-list, not a
 * replacement for it, and it does not find names.
 */
export function findPersonalData(text: string): PersonalDataFinding[] {
  const findings: PersonalDataFinding[] = [];
  const claimed: Array<[number, number]> = [];
  for (const [kind, pattern] of detectors) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (kind === "phone" && match[0].replace(/\D/g, "").length < 7) continue;
      if (claimed.some(([from, to]) => start < to && end > from)) continue;
      claimed.push([start, end]);
      findings.push({ kind, index: start });
    }
  }
  return findings.sort((first, second) => first.index - second.index);
}
