import { Text, View } from "react-native";
import { cn } from "heroui-native";
import { tv } from "tailwind-variants";

const tag = tv({
  slots: {
    base: "self-start flex-row items-center rounded-[3px] border-[1.2px] px-[9px] py-[3px]",
    hash: "text-[11.5px] font-bold",
    label: "text-[11.5px] font-bold",
  },
  variants: {
    variant: {
      default: {
        base: "bg-surface border-border",
        // default `#` is the faint hairline (--hair); only the `on` state
        // bumps it to muted for contrast on the ink fill.
        hash: "text-border",
        label: "text-foreground",
      },
      on: {
        base: "bg-foreground border-foreground",
        hash: "text-muted",
        label: "text-background",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface TagProps {
  /** Visual state. `on` inverts to ink. */
  variant?: "default" | "on";
  /** Tag text WITHOUT the leading `#` (rendered for you). */
  children: string;
  className?: string;
}

export function Tag({ variant = "default", children, className }: TagProps) {
  const styles = tag({ variant });
  return (
    <View className={cn(styles.base(), className)}>
      <Text className={styles.hash()}>#</Text>
      <Text className={styles.label()}>{children}</Text>
    </View>
  );
}
