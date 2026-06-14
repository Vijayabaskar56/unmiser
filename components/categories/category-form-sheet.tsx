import { BottomSheet } from "heroui-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { IconPickerSheet } from "@/components/categories/icon-picker-sheet";
import { Field, SpriteIcon, SubmitButton, Text } from "@/components/ui";
import type { Category } from "@/db/schema";
import { db } from "@/db/index";
import { createCategory, editCategory } from "@/db/services/category-ops";
import { categoryIconId, SPRITE_ICON_PREFIX } from "@/lib/categories/icons";

// Editorial-friendly palette (used as a subtle accent dot; icons render in ink).
const COLORS = ["#15140f", "#5b8def", "#1f7a3d", "#e0578a", "#d98a2b", "#7c5cbf", "#42a5b5"];

export type CategoryFormMode =
  | { type: "new"; isIncome: boolean }
  | { type: "edit"; category: Category };

interface Props {
  mode: CategoryFormMode | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create / edit a category: name, ink color accent, and a sprite icon. */
export function CategoryFormSheet({ mode, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [iconId, setIconId] = useState("tag-01");
  const [picking, setPicking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mode) return;
    if (mode.type === "edit") {
      setName(mode.category.name);
      setColor(mode.category.color || COLORS[0]);
      setIconId(categoryIconId(mode.category));
    } else {
      setName("");
      setColor(COLORS[0]);
      setIconId("tag-01");
    }
  }, [mode]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit || !mode) return;
    setSubmitting(true);
    try {
      const iconName = `${SPRITE_ICON_PREFIX}${iconId}`;
      if (mode.type === "new") {
        await createCategory(db, { name: name.trim(), color, iconName, isIncome: mode.isIncome });
      } else {
        await editCategory(db, mode.category.id, { name: name.trim(), color, iconName });
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Could not save category", String(e instanceof Error ? e.message : e));
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode?.type === "edit" ? "Edit category" : "New category";

  return (
    <>
      <BottomSheet isOpen={mode !== null && !picking} onOpenChange={(o) => !o && onClose()}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content keyboardBehavior="interactive">
            <BottomSheet.Title>{title}</BottomSheet.Title>
            <View className="gap-4 pt-3">
              {/* Icon + name */}
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={() => setPicking(true)}
                  className="h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-foreground active:opacity-70"
                >
                  <SpriteIcon name={iconId} size={26} />
                </Pressable>
                <View className="flex-1">
                  <Field
                    label="Name"
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Coffee"
                  />
                </View>
              </View>

              <Pressable onPress={() => setPicking(true)} className="active:opacity-70">
                <Text variant="caption">Tap the circle to change icon</Text>
              </Pressable>

              {/* Color accent */}
              <View>
                <Text variant="caption" className="mb-2">
                  Accent
                </Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      className="h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: c,
                        borderWidth: color === c ? 2 : 0,
                        borderColor: "#15140f",
                      }}
                    />
                  ))}
                </View>
              </View>

              <SubmitButton
                label={mode?.type === "edit" ? "Save changes" : "Add category"}
                submitting={submitting}
                canSubmit={canSubmit}
                onPress={() => void onSubmit()}
              />
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      <IconPickerSheet
        isOpen={picking}
        onClose={() => setPicking(false)}
        onPick={(id) => setIconId(id)}
      />
    </>
  );
}
