import { Pressable, Text, View } from "react-native";
import { cn } from "heroui-native";

export interface SegmentedProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Segmented({ options, value, onChange, className }: SegmentedProps) {
  return (
    <View
      className={cn(
        "flex-row overflow-hidden rounded-[3px] border-[1.5px] border-foreground",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            className={cn("flex-1 py-2", selected && "bg-foreground")}
          >
            <Text
              className={cn(
                "text-center text-[12px] font-bold",
                selected ? "text-background" : "text-foreground",
              )}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
