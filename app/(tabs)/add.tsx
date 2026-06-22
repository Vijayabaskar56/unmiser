import { useRouter } from "expo-router";
import { View } from "react-native";

import { TransactionForm } from "@/components/transactions/transaction-form";
import { AppBar } from "@/components/ui";

/**
 * Manual capture — the centre-"+" destination (wireframe flow's "+"). A full
 * screen (not a bottom sheet): mounting through the native navigator means the
 * large account/category picker tree no longer blocks a sheet open animation.
 */
export default function AddScreen() {
  const router = useRouter();
  const leave = () => (router.canGoBack() ? router.back() : router.navigate("/transactions"));

  return (
    <View className="flex-1 bg-background">
      <AppBar title="New transaction" onBack={leave} />
      <TransactionForm onDone={leave} />
    </View>
  );
}
