import { Redirect } from "expo-router";

// The app opens straight into the tabs (no drawer, no Home landing). The group's
// index just forwards to Transactions, the default screen; this route is hidden
// from the tab bar (href: null in _layout).
export default function Index() {
  return <Redirect href="/transactions" />;
}
