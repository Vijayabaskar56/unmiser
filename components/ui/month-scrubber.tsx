import { Pressable, Text, View } from "react-native";
import { cn } from "heroui-native";

export interface MonthScrubberProps {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function MonthScrubber({ items, value, onChange, className }: MonthScrubberProps) {
  return (
    <View className={cn("flex-row items-center gap-2", className)}>
      {items.map((item) => {
        const active = item === value;
        return (
          <Pressable key={item} onPress={() => onChange(item)}>
            <View className="px-1 pb-[7px]">
              <Text
                className={cn("text-[14px] font-bold", active ? "text-foreground" : "text-muted")}
              >
                {item}
              </Text>
              {active ? (
                <View className="absolute inset-x-1 bottom-0 h-[2.5px] rounded-[2px] bg-foreground" />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
