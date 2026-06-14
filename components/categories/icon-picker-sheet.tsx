import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { BottomSheet } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput } from "react-native";

import { SpriteIcon, Text } from "@/components/ui";
import { getAllIconIds } from "@/lib/icons/sprite";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
}

/**
 * Searchable grid over all ~1,177 sprite icons (ADR-0003, Option B). Ids load
 * once from the sprite; the search field filters by substring; each cell renders
 * the icon via the on-demand sprite loader.
 */
export function IconPickerSheet({ isOpen, onClose, onPick }: Props) {
  const [allIds, setAllIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void getAllIconIds().then((ids) => {
      if (active) setAllIds(ids);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ids = q ? allIds.filter((id) => id.includes(q)) : allIds;
    return ids.slice(0, 300); // cap the rendered set; narrow via search
  }, [allIds, query]);

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={(o) => !o && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["85%"]}
          enableOverDrag={false}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
          keyboardBehavior="extend"
        >
          <BottomSheet.Title>Choose an icon</BottomSheet.Title>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search icons (e.g. car, gift, bank)"
            placeholderTextColor="#9a988c"
            autoCapitalize="none"
            autoCorrect={false}
            className="my-3 rounded-[3px] border border-border bg-surface px-3.5 py-3 text-[15px] text-foreground"
          />
          <BottomSheetFlatList
            data={results}
            keyExtractor={(id) => id}
            numColumns={5}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={{ gap: 8 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onPick(item);
                  onClose();
                }}
                className="aspect-square flex-1 items-center justify-center rounded-[3px] border border-border active:opacity-60"
              >
                <SpriteIcon name={item} size={26} />
              </Pressable>
            )}
            ListEmptyComponent={
              <Text variant="body" className="pt-6 text-center">
                No icons match “{query}”.
              </Text>
            }
          />
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
