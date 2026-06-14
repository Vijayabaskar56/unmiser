import { useLiveQuery } from "@tanstack/react-db";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";
import { transactionRuleCollection, ruleApplicationCollection } from "@/db/collections";
import { appDb } from "@/db/app-db";
import { applyToPast, previewApplyToPast } from "@/db/services/apply-to-past";
import { saveRule } from "@/db/services/rule-ops";

export default function RulesScreen() {
  const { data: rules } = useLiveQuery((q) =>
    q.from({ rule: transactionRuleCollection }).orderBy(({ rule }) => rule.priority, "asc"),
  );
  const { data: applications } = useLiveQuery((q) =>
    q
      .from({ app: ruleApplicationCollection })
      .orderBy(({ app }) => app.appliedAt, "desc")
      .limit(8),
  );
  const [merchant, setMerchant] = useState("swiggy");
  const [category, setCategory] = useState("Food & Drinks");
  const [priority, setPriority] = useState("100");
  const [message, setMessage] = useState("");

  const activeRules = useMemo(() => (rules ?? []).filter((rule) => rule.isActive), [rules]);
  const templates = useMemo(() => (rules ?? []).filter((rule) => rule.isSystemTemplate), [rules]);

  const refresh = async () => {
    await Promise.all([
      transactionRuleCollection.utils.refetch(),
      ruleApplicationCollection.utils.refetch(),
    ]);
  };

  const createRule = async (isActive = true) => {
    const id = await saveRule(appDb, {
      name: `${merchant} -> ${category}`,
      priority: Number(priority) || 100,
      isActive,
      conditions: [{ field: "MERCHANT", operator: "CONTAINS", value: merchant }],
      actions: [{ actionType: "SET", field: "CATEGORY", value: category }],
    });
    await refresh();
    setMessage(`Saved rule ${id}`);
  };

  const preview = async () => {
    const result = await previewApplyToPast(appDb);
    setMessage(`${result.count} past transaction(s) would change`);
  };

  const apply = async () => {
    const result = await applyToPast(appDb);
    await refresh();
    setMessage(`Updated ${result.updated}/${result.processed} past transaction(s)`);
  };

  return (
    <Container>
      <View className="gap-4 p-4">
        <View>
          <Text className="text-foreground text-2xl font-semibold">Rules</Text>
          <Text className="text-muted mt-1">Active automation rules and inactive templates</Text>
        </View>

        <View className="gap-3 rounded-lg border border-border bg-content1 p-3">
          <Text className="text-foreground font-semibold">Rule Builder</Text>
          <TextInput
            className="rounded-md border border-border px-3 py-2 text-foreground"
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Merchant contains"
            placeholderTextColor="#888"
          />
          <TextInput
            className="rounded-md border border-border px-3 py-2 text-foreground"
            value={category}
            onChangeText={setCategory}
            placeholder="Set category"
            placeholderTextColor="#888"
          />
          <TextInput
            className="rounded-md border border-border px-3 py-2 text-foreground"
            value={priority}
            onChangeText={setPriority}
            keyboardType="number-pad"
            placeholder="Priority"
            placeholderTextColor="#888"
          />
          <View className="flex-row gap-2">
            <Pressable className="rounded-md bg-primary px-3 py-2" onPress={() => createRule(true)}>
              <Text className="text-primary-foreground font-semibold">Save</Text>
            </Pressable>
            <Pressable className="rounded-md border border-border px-3 py-2" onPress={preview}>
              <Text className="text-foreground font-semibold">Preview</Text>
            </Pressable>
            <Pressable className="rounded-md border border-border px-3 py-2" onPress={apply}>
              <Text className="text-foreground font-semibold">Apply</Text>
            </Pressable>
          </View>
          {message ? <Text className="text-muted">{message}</Text> : null}
        </View>

        <View className="gap-2">
          <Text className="text-foreground text-lg font-semibold">Active</Text>
          {activeRules.length === 0 ? <Text className="text-muted">No active rules.</Text> : null}
          {activeRules.map((rule) => (
            <View key={rule.id} className="rounded-lg border border-border bg-content1 p-3">
              <Text className="text-foreground font-semibold">{rule.name}</Text>
              <Text className="text-muted">Priority {rule.priority}</Text>
            </View>
          ))}
        </View>

        <View className="gap-2">
          <Text className="text-foreground text-lg font-semibold">System Templates</Text>
          {templates.map((rule) => (
            <View key={rule.id} className="rounded-lg border border-border bg-content1 p-3">
              <Text className="text-foreground font-semibold">{rule.name}</Text>
              <Text className="text-muted">{rule.description}</Text>
            </View>
          ))}
        </View>

        <View className="gap-2">
          <Text className="text-foreground text-lg font-semibold">Recent Applications</Text>
          {(applications ?? []).map((application) => (
            <Text key={application.id} className="text-muted">
              {application.ruleName} · {application.appliedAt}
            </Text>
          ))}
        </View>
      </View>
    </Container>
  );
}
