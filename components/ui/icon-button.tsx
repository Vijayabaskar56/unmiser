import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

export function IconButton({
  name,
  onPress,
  label,
  active,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={
        active
          ? "h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground bg-foreground active:opacity-70"
          : "h-9 w-9 items-center justify-center rounded-[6px] border-[1.5px] border-foreground active:opacity-70"
      }
    >
      <StyledIonicons
        name={name}
        size={18}
        className={active ? "text-background" : "text-foreground"}
      />
    </Pressable>
  );
}
