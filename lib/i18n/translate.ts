import {
  DEFAULT_LOCALE,
  RESOURCES,
  type LocaleCode,
  type ResourceTree,
} from "@/lib/i18n/translations";

/** Params interpolated into `{name}` placeholders. */
export type TranslateParams = Record<string, string | number>;

function lookup(tree: ResourceTree | undefined, path: string[]): string | undefined {
  let node: string | ResourceTree | undefined = tree;
  for (const segment of path) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[segment];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Resolve a dotted translation key for a locale. Falls back to the default
 * locale (`en`) per missing key, then to the raw key, so a partial locale never
 * yields a blank — it shows English. `{param}` placeholders are interpolated.
 */
export function translate(locale: LocaleCode, key: string, params?: TranslateParams): string {
  const path = key.split(".");
  const localized = lookup(RESOURCES[locale], path);
  if (localized !== undefined) return interpolate(localized, params);
  const fallback = lookup(RESOURCES[DEFAULT_LOCALE], path);
  if (fallback !== undefined) return interpolate(fallback, params);
  return key;
}
