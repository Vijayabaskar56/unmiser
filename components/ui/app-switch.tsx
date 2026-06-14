import { cn, Switch, useThemeColor } from "heroui-native";

import { useAccent } from "@/lib/appearance/use-accent";

export interface AppSwitchProps {
  /** Whether the switch is on. */
  value: boolean;
  /** Fired when the user toggles. */
  onChange?: (value: boolean) => void;
  isDisabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * AppSwitch — the unmiser toggle (design system `Notifications` switch).
 *
 * A chunky, outlined pill: white track with a hairline border when off, the
 * accent (unmiser yellow) track with a solid ink thumb when on. Wraps HeroUI's
 * `Switch`, overriding the petite default size and pinning the on/off colours
 * to theme tokens (accent + accent-foreground stay constant across themes).
 */
export function AppSwitch({ value, onChange, isDisabled, accessibilityLabel }: AppSwitchProps) {
  const [ink, surface] = useThemeColor(["accent-foreground", "surface"]);
  const accent = useAccent(); // runtime accent (reflects the Appearance preference)

  return (
    <Switch
      isSelected={value}
      onSelectedChange={onChange}
      isDisabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      // Bold ink outline on the track in BOTH states (design spec); only the
      // fill changes — white when off, accent yellow when on.
      className={cn("h-[30px] w-[52px] border-[1.5px] border-foreground")}
      animation={{ backgroundColor: { value: [surface, accent] } }}
    >
      <Switch.Thumb
        className="h-[22px] w-[22px] rounded-full"
        // Solid ink thumb in both states. Kill the default field shadow — it
        // haloes the thumb and reads choppy. `left` is the edge inset: it sets
        // the off gap directly and the on gap via (width − thumb − left), so a
        // generous value keeps a symmetric gap on the active (right) side too.
        style={{ shadowOpacity: 0, shadowRadius: 0, elevation: 0 }}
        animation={{
          left: { value: 5 },
          backgroundColor: { value: [ink, ink] },
        }}
      />
    </Switch>
  );
}
