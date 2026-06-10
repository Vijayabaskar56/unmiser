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
  | { kind: "needs-create"; canonicalBank: string; accountLast4: string };

export function resolveAccount(query: ResolveQuery, existing: ExistingAccount[]): ResolveResult {
  const exact = existing.find(
    (account) =>
      account.canonicalBank === query.canonicalBank && account.accountLast4 === query.accountLast4,
  );
  if (exact) {
    return { kind: "matched", accountId: exact.id };
  }

  // Partial fragment (<4 chars): fuzzy-match to the unique same-bank account
  // whose last4 ends with the fragment. 0 or many -> keep the fragment.
  if (query.accountLast4.length < 4) {
    const suffixMatches = existing.filter(
      (account) =>
        account.canonicalBank === query.canonicalBank &&
        account.accountLast4.endsWith(query.accountLast4),
    );
    if (suffixMatches.length === 1) {
      return { kind: "matched", accountId: suffixMatches[0].id };
    }
  }

  return {
    kind: "needs-create",
    canonicalBank: query.canonicalBank,
    accountLast4: query.accountLast4,
  };
}
