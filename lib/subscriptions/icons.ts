/**
 * Maps a subscription to a UI-sprite icon id by reusing its linked category's
 * icon (ADR-0003 sprite layer). Subscriptions only store `categoryId` (plus a
 * denormalized name), so the caller passes a lookup of the category rows; we
 * resolve the icon via `categoryIconId`. With no category, a recurring-payment
 * glyph stands in.
 */
import { categoryIconId } from "@/lib/categories/icons";

export const SUBSCRIPTION_FALLBACK_ICON = "repeat-04";

interface CategoryIconFields {
  iconName?: string | null;
  seedKey?: string | null;
}

export function subscriptionIconId(
  subscription: { categoryId?: number | null },
  categoryById: Map<number, CategoryIconFields>,
): string {
  const category =
    subscription.categoryId != null ? categoryById.get(subscription.categoryId) : undefined;
  return category ? categoryIconId(category) : SUBSCRIPTION_FALLBACK_ICON;
}
