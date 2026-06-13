import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text as RNText, View } from "react-native";

import { Container } from "@/components/container";
import { useAppTheme } from "@/contexts/app-theme-context";
import {
  AppBar,
  Badge,
  Button,
  CalloutPill,
  Card,
  Chip,
  MonthScrubber,
  Segmented,
  SubTabs,
  Tag,
  Text,
  TxnRow,
} from "@/components/ui";

/**
 * /design-system — dev-only visual preview route.
 *
 * Renders every UI primitive in every variant so we can eyeball parity against
 * `unmiser Design System.html` on-device. A header toggle flips light/dark so
 * both themes are checkable. Interactive primitives (Segmented / SubTabs /
 * MonthScrubber) are wired with local state so they actually toggle.
 */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-7 px-5">
      <Text variant="caption" className="mb-3">
        {label}
      </Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap items-center gap-2">{children}</View>;
}

export default function DesignSystemScreen() {
  const { toggleTheme, currentTheme } = useAppTheme();
  const router = useRouter();

  // Interactive state for navigation primitives.
  const [seg2, setSeg2] = useState("Spend");
  const [seg3, setSeg3] = useState("Week");
  const [tab, setTab] = useState("All");
  const [month, setMonth] = useState("Jun");

  return (
    <View className="flex-1 bg-background">
      {/* Hide Expo Router's native header; we render our own AppBar. */}
      <Stack.Screen options={{ headerShown: false }} />
      {/* Design-system app bar (replaces the native Stack header) */}
      <AppBar
        title="Design System"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        right={
          <Pressable
            onPress={toggleTheme}
            accessibilityRole="button"
            className="rounded-[3px] border-[1.5px] border-foreground bg-surface px-[13px] py-2"
          >
            <RNText className="text-[13px] font-extrabold text-foreground">
              {currentTheme === "dark" ? "☀ Light" : "☾ Dark"}
            </RNText>
          </Pressable>
        }
      />

      <Container className="pt-2">
        {/* Typography */}
        <Section label="Typography">
          <Text variant="display">Display 46</Text>
          <Text variant="title">Title 30</Text>
          <Text variant="balance">₹62,000.00</Text>
          <Text variant="heading">Heading 18</Text>
          <Text variant="body">
            Body 14 — secondary ink for descriptive copy and supporting text.
          </Text>
          <Text variant="caption">Caption · mono uppercase</Text>
          <Text variant="tag">Tag 12 bold</Text>
        </Section>

        {/* Buttons */}
        <Section label="Buttons">
          <Row>
            <Button variant="solid">Solid</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="accent">Accent</Button>
          </Row>
          <Row>
            <Button variant="solid" size="sm">
              Solid sm
            </Button>
            <Button variant="outline" size="sm">
              Outline sm
            </Button>
            <Button variant="accent" size="sm">
              Accent sm
            </Button>
          </Row>
          <Row>
            <Button variant="solid" disabled>
              Disabled
            </Button>
          </Row>
        </Section>

        {/* Chips & Tags */}
        <Section label="Chips & Tags">
          <Row>
            <Chip variant="default">All</Chip>
            <Chip variant="on">Spends</Chip>
            <Chip variant="accent">Needs tag</Chip>
          </Row>
          <Row>
            <Tag variant="default">food</Tag>
            <Tag variant="on">salary</Tag>
          </Row>
        </Section>

        {/* Badges */}
        <Section label="Badges">
          <Row>
            <Badge variant="default">New</Badge>
            <Badge variant="accent">Auto</Badge>
            <Badge variant="gray">Synced</Badge>
          </Row>
        </Section>

        {/* Cards */}
        <Section label="Cards">
          <Card variant="ink">
            <Text variant="caption">Balance · ink</Text>
            <Text variant="balance">₹48,520</Text>
          </Card>
          <Card variant="soft">
            <Text variant="caption">Grouped list · soft</Text>
            <TxnRow merchant="Swiggy" sub="3 Jun · UPI · food" amount="−₹480" direction="out" />
            <TxnRow
              merchant="Salary"
              sub="1 Jun · NEFT · income"
              amount="+₹62,000"
              direction="in"
            />
          </Card>
          <Card variant="inverted">
            <Text variant="caption" className="text-background/60">
              Feature moment · inverted
            </Text>
            <Text variant="heading" className="text-background">
              You saved ₹1,240 this week
            </Text>
          </Card>
        </Section>

        {/* Transaction rows */}
        <Section label="Transaction rows">
          <Card variant="soft">
            <TxnRow merchant="Swiggy" sub="3 Jun · UPI · food" amount="−₹480" direction="out" />
            <TxnRow
              merchant="Salary"
              sub="1 Jun · NEFT · income"
              amount="+₹62,000"
              direction="in"
            />
            <TxnRow
              merchant="Amazon"
              sub="2 Jun · Card · shopping"
              amount="−₹2,199"
              direction="out"
            />
            <TxnRow
              merchant="Uber"
              sub="2 Jun · UPI"
              amount="−₹260"
              direction="out"
              badge={<Badge variant="accent">Needs a tag</Badge>}
            />
          </Card>
        </Section>

        {/* Navigation */}
        <Section label="Navigation">
          <Segmented options={["Spend", "Income"]} value={seg2} onChange={setSeg2} />
          <Segmented options={["Week", "Month", "Year"]} value={seg3} onChange={setSeg3} />
          <SubTabs
            options={["All", "Spends", "Income", "Subscriptions"]}
            value={tab}
            onChange={setTab}
          />
          <MonthScrubber items={["Mar", "Apr", "May", "Jun"]} value={month} onChange={setMonth} />
          <CalloutPill income="₹62,000" expense="₹37,965" />
        </Section>

        <View className="h-10" />
      </Container>
    </View>
  );
}
