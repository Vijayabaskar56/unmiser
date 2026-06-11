export interface ExistingAccount {
  id: number;
  canonicalBank: string;
  accountLast4: string;
}

export interface ResolveQuery {
  /** Already normalized from the manifest — NOT a free-text display label. */
  canonicalBank: string;
  accountLast4: string;
}

export type ResolveResult =
  | { kind: "matched"; accountId: number }
  /** No same-bank account matches — safe to auto-create (ADR-0006). */
  | { kind: "none"; canonicalBank: string; accountLast4: string }
  /** A partial fragment matches several same-bank accounts — genuinely
   *  ambiguous; the only case that still needs human resolution. */
  | { kind: "many"; canonicalBank: string; accountLast4: string; candidateIds: number[] };

export function resolveAccount(query: ResolveQuery, existing: ExistingAccount[]): ResolveResult {
  const exact = existing.find(
    (account) =>
      account.canonicalBank === query.canonicalBank && account.accountLast4 === query.accountLast4,
  );
  if (exact) {
    return { kind: "matched", accountId: exact.id };
  }

  // Partial fragment (<4 chars): fuzzy-match to the unique same-bank account
  // whose last4 ends with the fragment. 0 -> none (keep the fragment); many ->
  // ambiguous, surface for review.
  if (query.accountLast4.length < 4) {
    const suffixMatches = existing.filter(
      (account) =>
        account.canonicalBank === query.canonicalBank &&
        account.accountLast4.endsWith(query.accountLast4),
    );
    if (suffixMatches.length === 1) {
      return { kind: "matched", accountId: suffixMatches[0].id };
    }
    if (suffixMatches.length > 1) {
      return {
        kind: "many",
        canonicalBank: query.canonicalBank,
        accountLast4: query.accountLast4,
        candidateIds: suffixMatches.map((account) => account.id),
      };
    }
  }

  return {
    kind: "none",
    canonicalBank: query.canonicalBank,
    accountLast4: query.accountLast4,
  };
}
