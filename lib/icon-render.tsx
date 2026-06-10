import { Image } from "react-native";

import type { ResolvedIcon } from "./icon-registry";
import { getNanoIconComponent } from "./icons/nano-icon";

/**
 * JSX renderer for a {@link ResolvedIcon} (ADR-0003 layers B/C). The pure
 * decision lives in `icon-registry.ts`; this file is the `react-native`-bound
 * half. `components/icon.tsx` composes them with the fallback chip.
 */
export function renderResolvedIcon(
  resolved: ResolvedIcon,
  opts: { size: number; color?: string | null },
): React.ReactElement | null {
  switch (resolved.kind) {
    case "nano": {
      const NanoIcon = getNanoIconComponent();
      if (!NanoIcon) return null;
      // `name` is validated against the generated glyphmap by `resolveIcon`.
      return (
        <NanoIcon name={resolved.name as never} size={opts.size} color={opts.color ?? undefined} />
      );
    }
    case "brand":
      return (
        <Image
          source={resolved.source}
          style={{ width: opts.size, height: opts.size }}
          resizeMode="contain"
        />
      );
    case "fallback":
      return null; // chip is drawn by the <Icon> wrapper
  }
}
