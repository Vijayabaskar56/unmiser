import { useThemeColor } from "heroui-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";

import { getIconSvg } from "@/lib/icons/sprite";

export interface SpriteIconProps {
  /** Sprite symbol id, e.g. "shopping-cart". */
  name: string;
  size?: number;
  /** Glyph colour; defaults to the theme foreground (ink). */
  color?: string;
}

/**
 * Renders an icon from the UI sprite (ADR-0003, Option B). The sprite loads once
 * asynchronously; until the symbol resolves we render a same-size spacer so
 * layout doesn't jump. Recolours via `color` (the extractor maps fills/strokes
 * to currentColor).
 */
export function SpriteIcon({ name, size = 24, color }: SpriteIconProps) {
  const foreground = useThemeColor("foreground");
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setXml(null);
    void getIconSvg(name).then((svg) => {
      if (active) setXml(svg);
    });
    return () => {
      active = false;
    };
  }, [name]);

  if (!xml) return <View style={{ width: size, height: size }} />;
  return <SvgXml xml={xml} width={size} height={size} color={color ?? foreground} />;
}
