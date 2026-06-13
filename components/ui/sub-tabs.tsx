import { cn } from "heroui-native";
import { Pressable, Text, View } from "react-native";

export interface SubTabsProps {
  /** Tab labels, in order. */
  options: string[];
  /** Currently active label. */
  value: string;
  /** Fired with the newly selected label. */
  onChange: (value: string) => void;
  /** Forwarded to the row container. */
  className?: string;
}

export function SubTabs({ options, value, onChange, className }: SubTabsProps) {
  return (
    <View className={cn("flex-row border-b border-separator", className)}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option)}
            className="relative mr-[18px] pb-[9px]"
          >
            <Text
              className={cn("text-[13px] font-bold", active ? "text-foreground" : "text-muted")}
            >
              {option}
            </Text>
            {active ? (
              <View className="absolute inset-x-0 bottom-[-1px] h-[2px] bg-foreground" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
