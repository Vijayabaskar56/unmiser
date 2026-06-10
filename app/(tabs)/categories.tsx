import { useLiveQuery } from "@tanstack/react-db";
import { useThemeColor } from "heroui-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";
import { Icon } from "@/components/icon";
import { categoryCollection, subcategoryCollection } from "@/db/collections/finance";
import { db } from "@/db/index";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  editCategory,
  editSubcategory,
} from "@/db/services/category-ops";
import { resetCategory } from "@/db/services/seed";

// A small starter palette for the color picker — user categories can be any of
// these; editing/icon work beyond this is deferred (see DEVICE-GATED QA below).
const COLORS = [
  "#FF7043",
  "#66BB6A",
  "#42A5F5",
  "#AB47BC",
  "#FFCA28",
  "#26A69A",
  "#EC407A",
  "#8D6E63",
];

/**
 * Categories list with inline CRUD.
 *
 *  - Add: an inline form (toggled by state, mirroring the Add-transaction form in
 *    transactions.tsx) capturing name + color + income/expense.
 *  - Expand: tapping a row reveals its subcategories (inline accordion) with
 *    add / edit / delete affordances.
 *  - Edit: a category's name/color/income can be edited in place; user rows can be
 *    deleted (guarded: deleteCategory throws if any transaction references it).
 *  - System rows (isSystem) cannot be deleted — instead they offer "Reset" which
 *    restores the shipped name/color/icon via resetCategory (matched by seedKey).
 *
 * Writes go through the services layer (@/db/services/category-ops, seed) on the
 * app db (@/db). After every write we refetch the category + subcategory
 * collections so the live query re-reads persisted rows (mirrors the post-add
 * refetch pattern in transactions.tsx).
 *
 * DEVICE-GATED QA (cannot run under vitest):
 *  - Icon renders a colored letter chip until the nano-icon pack is ported.
 *  - Verify: add a category, expand it, add/edit/delete a subcategory, edit the
 *    category color/income, delete a user category, and confirm a system row's
 *    delete is disabled while Reset is offered.
 *  - Verify deleting an in-use category surfaces the "in use" error (caught and
 *    shown inline) rather than crashing.
 */
export default function CategoriesScreen() {
  const { data: categories, isLoading } = useLiveQuery((q) =>
    q.from({ category: categoryCollection }),
  );
  const { data: subcategories } = useLiveQuery((q) =>
    q.from({ subcategory: subcategoryCollection }),
  );

  const mutedColor = useThemeColor("muted");

  // Add-category form state.
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [isIncome, setIsIncome] = useState(false);
  const [busy, setBusy] = useState(false);

  // Which category row is expanded (accordion) and which is in edit mode.
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [editIsIncome, setEditIsIncome] = useState(false);

  // Add/edit-subcategory state (scoped to the expanded category).
  const [newSubName, setNewSubName] = useState("");
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [editSubName, setEditSubName] = useState("");

  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...(categories ?? [])].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
      ),
    [categories],
  );

  const subsByCategory = useMemo(() => {
    const map = new Map<number, typeof subcategories>();
    for (const s of subcategories ?? []) {
      const list = map.get(s.categoryId) ?? [];
      list.push(s);
      map.set(s.categoryId, list);
    }
    return map;
  }, [subcategories]);

  const refetch = useCallback(
    () => Promise.all([categoryCollection.utils.refetch(), subcategoryCollection.utils.refetch()]),
    [],
  );

  const canAdd = name.trim().length > 0 && !busy;

  const resetAddForm = useCallback(() => {
    setName("");
    setColor(COLORS[0]);
    setIsIncome(false);
  }, []);

  const onAddCategory = useCallback(async () => {
    if (!canAdd) return;
    setBusy(true);
    setError(null);
    try {
      await createCategory(db, { name: name.trim(), color, isIncome });
      await refetch();
      resetAddForm();
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  }, [canAdd, name, color, isIncome, refetch, resetAddForm]);

  const startEdit = useCallback((c: (typeof sorted)[number]) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
    setEditIsIncome(c.isIncome);
    setError(null);
  }, []);

  const onSaveEdit = useCallback(
    async (id: number) => {
      if (editName.trim().length === 0) return;
      setBusy(true);
      setError(null);
      try {
        await editCategory(db, id, {
          name: editName.trim(),
          color: editColor,
          isIncome: editIsIncome,
        });
        await refetch();
        setEditingId(null);
      } finally {
        setBusy(false);
      }
    },
    [editName, editColor, editIsIncome, refetch],
  );

  const onDeleteCategory = useCallback(
    async (id: number) => {
      setBusy(true);
      setError(null);
      try {
        await deleteCategory(db, id);
        await refetch();
        if (expandedId === id) setExpandedId(null);
        if (editingId === id) setEditingId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete category.");
      } finally {
        setBusy(false);
      }
    },
    [expandedId, editingId, refetch],
  );

  const onResetCategory = useCallback(
    async (seedKey: string) => {
      setBusy(true);
      setError(null);
      try {
        await resetCategory(db, seedKey);
        await refetch();
      } finally {
        setBusy(false);
      }
    },
    [refetch],
  );

  const onAddSubcategory = useCallback(
    async (categoryId: number) => {
      if (newSubName.trim().length === 0) return;
      setBusy(true);
      setError(null);
      try {
        await createSubcategory(db, { categoryId, name: newSubName.trim() });
        await refetch();
        setNewSubName("");
      } finally {
        setBusy(false);
      }
    },
    [newSubName, refetch],
  );

  const onSaveSub = useCallback(
    async (id: number) => {
      if (editSubName.trim().length === 0) return;
      setBusy(true);
      setError(null);
      try {
        await editSubcategory(db, id, { name: editSubName.trim() });
        await refetch();
        setEditingSubId(null);
      } finally {
        setBusy(false);
      }
    },
    [editSubName, refetch],
  );

  const onDeleteSub = useCallback(
    async (id: number) => {
      setBusy(true);
      setError(null);
      try {
        await deleteSubcategory(db, id);
        await refetch();
      } finally {
        setBusy(false);
      }
    },
    [refetch],
  );

  return (
    <Container className="px-4 pt-6 pb-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-3xl font-semibold text-foreground tracking-tight">Categories</Text>
        <Pressable
          onPress={() => {
            setShowForm((s) => !s);
            setError(null);
          }}
          className="rounded-xl bg-foreground px-4 py-2 active:opacity-70"
        >
          <Text className="text-background font-medium">{showForm ? "Cancel" : "Add"}</Text>
        </Pressable>
      </View>
      <Text className="text-muted text-sm mb-5">{sorted.length} categories</Text>

      {error && (
        <View className="mb-4 rounded-xl border border-danger/40 bg-danger/10 p-3">
          <Text className="text-danger text-xs">{error}</Text>
        </View>
      )}

      {showForm && (
        <View className="mb-6 rounded-xl border border-border p-4 gap-4">
          <View>
            <Text className="text-muted text-xs mb-1">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Category name"
              placeholderTextColor={mutedColor}
              className="rounded-xl border border-border bg-secondary px-4 py-3 text-foreground"
            />
          </View>

          <ColorPicker selected={color} onSelect={setColor} />

          <IncomeToggle value={isIncome} onChange={setIsIncome} />

          <Pressable
            onPress={() => void onAddCategory()}
            disabled={!canAdd}
            className={
              canAdd
                ? "rounded-xl bg-foreground px-4 py-3 items-center active:opacity-70"
                : "rounded-xl bg-secondary px-4 py-3 items-center"
            }
          >
            <Text className={canAdd ? "text-background font-medium" : "text-muted font-medium"}>
              {busy ? "Saving…" : "Save category"}
            </Text>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <Text className="text-muted text-sm">Loading…</Text>
      ) : sorted.length === 0 ? (
        <Text className="text-muted text-sm">No categories yet — add one above.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-2 pb-8">
            {sorted.map((category) => {
              const expanded = expandedId === category.id;
              const editing = editingId === category.id;
              const subs = [...(subsByCategory.get(category.id) ?? [])].sort((a, b) =>
                a.name.localeCompare(b.name),
              );

              return (
                <View key={category.id} className="rounded-xl border border-border overflow-hidden">
                  {/* Row header — tap to expand subcategories. */}
                  <Pressable
                    onPress={() =>
                      setExpandedId((prev) => (prev === category.id ? null : category.id))
                    }
                    className="flex-row items-center p-3 active:opacity-70"
                  >
                    <Icon
                      iconName={category.iconName}
                      color={category.color}
                      fallback={category.name}
                    />
                    <Text className="ml-3 flex-1 text-foreground font-medium">{category.name}</Text>
                    <View
                      className={
                        category.isIncome
                          ? "rounded-full bg-success/15 px-3 py-1"
                          : "rounded-full bg-secondary px-3 py-1"
                      }
                    >
                      <Text
                        className={
                          category.isIncome
                            ? "text-success text-xs font-medium"
                            : "text-muted text-xs font-medium"
                        }
                      >
                        {category.isIncome ? "Income" : "Expense"}
                      </Text>
                    </View>
                    <Text className="ml-2 text-muted text-xs">{expanded ? "▾" : "▸"}</Text>
                  </Pressable>

                  {expanded && (
                    <View className="border-t border-border p-3 gap-3">
                      {/* Category actions / edit form. */}
                      {editing ? (
                        <View className="gap-3 rounded-xl bg-secondary/40 p-3">
                          <TextInput
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Category name"
                            placeholderTextColor={mutedColor}
                            className="rounded-xl border border-border bg-secondary px-3 py-2 text-foreground"
                          />
                          <ColorPicker selected={editColor} onSelect={setEditColor} />
                          <IncomeToggle value={editIsIncome} onChange={setEditIsIncome} />
                          <View className="flex-row gap-2">
                            <Pressable
                              onPress={() => void onSaveEdit(category.id)}
                              className="flex-1 rounded-xl bg-foreground px-3 py-2 items-center active:opacity-70"
                            >
                              <Text className="text-background text-xs font-medium">Save</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setEditingId(null)}
                              className="flex-1 rounded-xl border border-border px-3 py-2 items-center active:opacity-70"
                            >
                              <Text className="text-foreground text-xs font-medium">Cancel</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View className="flex-row gap-2">
                          <Pressable
                            onPress={() => startEdit(category)}
                            className="rounded-lg border border-border px-3 py-1.5 active:opacity-70"
                          >
                            <Text className="text-foreground text-xs">Edit</Text>
                          </Pressable>
                          {category.isSystem ? (
                            category.seedKey ? (
                              <Pressable
                                onPress={() => void onResetCategory(category.seedKey!)}
                                className="rounded-lg border border-border px-3 py-1.5 active:opacity-70"
                              >
                                <Text className="text-foreground text-xs">Reset</Text>
                              </Pressable>
                            ) : null
                          ) : (
                            <Pressable
                              onPress={() => void onDeleteCategory(category.id)}
                              className="rounded-lg border border-danger/40 px-3 py-1.5 active:opacity-70"
                            >
                              <Text className="text-danger text-xs">Delete</Text>
                            </Pressable>
                          )}
                        </View>
                      )}

                      {/* Subcategories. */}
                      <Text className="text-muted text-xs mt-1">Subcategories</Text>
                      {subs.length === 0 ? (
                        <Text className="text-muted text-xs">None yet.</Text>
                      ) : (
                        <View className="gap-1.5">
                          {subs.map((sub) =>
                            editingSubId === sub.id ? (
                              <View key={sub.id} className="flex-row items-center gap-2">
                                <TextInput
                                  value={editSubName}
                                  onChangeText={setEditSubName}
                                  placeholder="Subcategory name"
                                  placeholderTextColor={mutedColor}
                                  className="flex-1 rounded-lg border border-border bg-secondary px-3 py-1.5 text-foreground text-xs"
                                />
                                <Pressable
                                  onPress={() => void onSaveSub(sub.id)}
                                  className="rounded-lg bg-foreground px-3 py-1.5 active:opacity-70"
                                >
                                  <Text className="text-background text-xs">Save</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => setEditingSubId(null)}
                                  className="rounded-lg border border-border px-3 py-1.5 active:opacity-70"
                                >
                                  <Text className="text-foreground text-xs">×</Text>
                                </Pressable>
                              </View>
                            ) : (
                              <View
                                key={sub.id}
                                className="flex-row items-center rounded-lg bg-secondary/40 px-3 py-2"
                              >
                                <Text className="flex-1 text-foreground text-xs">{sub.name}</Text>
                                <Pressable
                                  onPress={() => {
                                    setEditingSubId(sub.id);
                                    setEditSubName(sub.name);
                                  }}
                                  className="px-2 active:opacity-70"
                                >
                                  <Text className="text-muted text-xs">Edit</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => void onDeleteSub(sub.id)}
                                  className="px-2 active:opacity-70"
                                >
                                  <Text className="text-danger text-xs">Delete</Text>
                                </Pressable>
                              </View>
                            ),
                          )}
                        </View>
                      )}

                      {/* Add subcategory. */}
                      <View className="flex-row items-center gap-2 mt-1">
                        <TextInput
                          value={expanded ? newSubName : ""}
                          onChangeText={setNewSubName}
                          placeholder="New subcategory"
                          placeholderTextColor={mutedColor}
                          className="flex-1 rounded-lg border border-border bg-secondary px-3 py-1.5 text-foreground text-xs"
                        />
                        <Pressable
                          onPress={() => void onAddSubcategory(category.id)}
                          disabled={newSubName.trim().length === 0 || busy}
                          className={
                            newSubName.trim().length === 0
                              ? "rounded-lg bg-secondary px-3 py-1.5"
                              : "rounded-lg bg-foreground px-3 py-1.5 active:opacity-70"
                          }
                        >
                          <Text
                            className={
                              newSubName.trim().length === 0
                                ? "text-muted text-xs"
                                : "text-background text-xs"
                            }
                          >
                            Add
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Container>
  );
}

// ---- small presentational helpers --------------------------------------

function ColorPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (color: string) => void;
}) {
  return (
    <View>
      <Text className="text-muted text-xs mb-2">Color</Text>
      <View className="flex-row flex-wrap gap-2">
        {COLORS.map((c) => {
          const active = c === selected;
          return (
            <Pressable
              key={c}
              onPress={() => onSelect(c)}
              style={{ backgroundColor: c }}
              className={
                active
                  ? "h-9 w-9 rounded-full border-2 border-foreground"
                  : "h-9 w-9 rounded-full border border-border"
              }
            />
          );
        })}
      </View>
    </View>
  );
}

function IncomeToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View>
      <Text className="text-muted text-xs mb-2">Type</Text>
      <View className="flex-row gap-2">
        {[
          { label: "Expense", v: false },
          { label: "Income", v: true },
        ].map((opt) => {
          const active = value === opt.v;
          return (
            <Pressable
              key={opt.label}
              onPress={() => onChange(opt.v)}
              className={
                active
                  ? "rounded-full bg-foreground px-4 py-2"
                  : "rounded-full border border-border px-4 py-2"
              }
            >
              <Text className={active ? "text-background text-xs" : "text-foreground text-xs"}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
