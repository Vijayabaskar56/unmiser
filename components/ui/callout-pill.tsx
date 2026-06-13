import { cn } from "heroui-native";
import { Text, View } from "react-native";

const tabularNums = { fontVariant: ["tabular-nums" as const] };

export interface CalloutPillProps {
  /** Income amount string, e.g. "₹0" */
  income: string;
  /** Expense amount string, e.g. "₹37,965" */
  expense: string;
  /** Label preceding the income amount. Default "In" */
  incomeLabel?: string;
  /** Label preceding the expense amount. Default "Out" */
  expenseLabel?: string;
  className?: string;
}

/**
 * The Minna 収支 income/expense callout pill — a single inline ink pill
 * showing income and expense separated by a thin vertical hairline.
 */
export function CalloutPill({
  income,
  expense,
  incomeLabel = "In",
  expenseLabel = "Out",
  className,
}: CalloutPillProps) {
  return (
    <View
      className={cn(
        "flex-row items-center self-start rounded-[3px] bg-foreground px-3 py-[6px]",
        className,
      )}
    >
      <Text className="text-[12px] font-bold text-background">
        {incomeLabel}{" "}
        <Text className="text-[12px] font-bold text-background" style={tabularNums}>
          {income}
        </Text>
      </Text>

      <View className="mx-[9px] h-[12px] w-px bg-muted opacity-50" />

      <Text className="text-[12px] font-bold text-background">
        {expenseLabel}{" "}
        <Text className="text-[12px] font-bold text-background" style={tabularNums}>
          {expense}
        </Text>
      </Text>
    </View>
  );
}
