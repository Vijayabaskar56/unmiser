import { useLiveQuery } from "@tanstack/react-db";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Container } from "@/components/container";
import { PinPad } from "@/components/pin-pad";
import { AppBar, AppSwitch, Card, SpriteIcon, Text } from "@/components/ui";
import { appDb } from "@/db/app-db";
import { appSettingsCollection } from "@/db/collections";
import { APP_SETTING_KEYS } from "@/db/schema/app-settings";
import { setSetting } from "@/db/services/app-settings";
import { LOCK_TIMEOUT_OPTIONS, parseAppLockPrefs, timeoutLabel } from "@/lib/security/app-lock";
import { isBiometricAvailable } from "@/lib/security/biometric";
import { clearPin, hasPin, PIN_LENGTH, setPin } from "@/lib/security/pin";

type SetupPhase = "set" | "confirm";

export default function AppLockSettingsScreen() {
  const router = useRouter();

  const { data: settingRows } = useLiveQuery((q) => q.from({ setting: appSettingsCollection }));
  const prefs = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const row of settingRows ?? []) map[row.key] = row.value ?? null;
    return parseAppLockPrefs(map);
  }, [settingRows]);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  useEffect(() => {
    void isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  // Inline PIN setup overlay state.
  const [phase, setPhase] = useState<SetupPhase | null>(null);
  const [firstPin, setFirstPin] = useState("");
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);
  // After a successful PIN setup we also flip the master switch on.
  const [enableAfterSetup, setEnableAfterSetup] = useState(false);

  const persist = async (key: string, value: string) => {
    await setSetting(appDb, key, value);
    await appSettingsCollection.utils.refetch();
  };

  const startSetup = (alsoEnable: boolean) => {
    setEnableAfterSetup(alsoEnable);
    setFirstPin("");
    setEntry("");
    setError(false);
    setPhase("set");
  };

  const cancelSetup = () => {
    setPhase(null);
    setEntry("");
    setFirstPin("");
    setError(false);
  };

  const onToggleMaster = async (next: boolean) => {
    if (next) {
      if (await hasPin()) {
        await persist(APP_SETTING_KEYS.appLockEnabled, "true");
      } else {
        startSetup(true);
      }
    } else {
      await clearPin();
      await persist(APP_SETTING_KEYS.appLockEnabled, "false");
      await persist(APP_SETTING_KEYS.appLockBiometric, "false");
    }
  };

  const onSetupChange = (value: string) => {
    setError(false);
    setEntry(value);
    if (value.length < PIN_LENGTH) return;
    if (phase === "set") {
      setFirstPin(value);
      setEntry("");
      setPhase("confirm");
      return;
    }
    // confirm
    if (value === firstPin) {
      void (async () => {
        await setPin(value);
        if (enableAfterSetup) {
          await persist(APP_SETTING_KEYS.appLockEnabled, "true");
          // Biometric is the primary factor — turn it on by default when it's
          // available; the PIN we just set is the secondary fallback.
          if (biometricAvailable) await persist(APP_SETTING_KEYS.appLockBiometric, "true");
        }
        cancelSetup();
      })();
    } else {
      setError(true);
      setTimeout(() => {
        setEntry("");
        setError(false);
        setFirstPin("");
        setPhase("set");
      }, 600);
    }
  };

  if (phase) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <SpriteIcon name="lock-01" size={56} />
        <Text variant="title" className="mt-6 text-[24px]">
          {phase === "set" ? "Set a PIN" : "Confirm your PIN"}
        </Text>
        <Text variant="body" className="mt-1.5 text-[15px] text-muted">
          {error
            ? "PINs didn’t match — start over"
            : phase === "set"
              ? `Choose a ${PIN_LENGTH}-digit PIN`
              : "Re-enter your PIN"}
        </Text>
        <View className="mt-9">
          <PinPad value={entry} onChange={onSetupChange} length={PIN_LENGTH} error={error} />
        </View>
        <Pressable onPress={cancelSetup} className="mt-8 active:opacity-70">
          <Text variant="heading" className="text-[15px] text-muted">
            Cancel
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppBar
        title="App lock"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/data-privacy"))}
      />
      <Container isScrollable={false} className="px-4">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10 pt-2 gap-4"
        >
          {/* Master switch */}
          <Card variant="soft" className="flex-row items-center gap-3.5 p-4">
            <View className="h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-foreground">
              <SpriteIcon name="lock-01" size={22} />
            </View>
            <View className="min-w-0 flex-1">
              <Text variant="heading" className="text-[17px]">
                App lock
              </Text>
              <Text variant="body" className="text-[13px]">
                Biometric unlock, with a PIN fallback
              </Text>
            </View>
            <AppSwitch
              value={prefs.enabled}
              onChange={(v) => void onToggleMaster(v)}
              accessibilityLabel="App lock"
            />
          </Card>

          {prefs.enabled ? (
            <>
              {/* Biometric */}
              <Card variant="soft" className="flex-row items-center gap-3.5 p-4">
                <View className="h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-foreground">
                  <SpriteIcon name="fingerprint-01" size={22} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text variant="heading" className="text-[17px]">
                    Unlock with biometrics
                  </Text>
                  <Text variant="body" className="text-[13px]">
                    {biometricAvailable
                      ? "Use fingerprint or face to unlock"
                      : "Set up fingerprint/face in device settings"}
                  </Text>
                </View>
                <AppSwitch
                  value={prefs.biometric && biometricAvailable}
                  isDisabled={!biometricAvailable}
                  onChange={(v) => void persist(APP_SETTING_KEYS.appLockBiometric, String(v))}
                  accessibilityLabel="Unlock with biometrics"
                />
              </Card>

              {/* Auto-lock timeout */}
              <View>
                <Text variant="caption" className="mb-2 ml-1">
                  Auto-lock
                </Text>
                <Card variant="soft" className="gap-0 p-0">
                  {LOCK_TIMEOUT_OPTIONS.map((minutes, i) => {
                    const selected = prefs.timeoutMinutes === minutes;
                    return (
                      <Pressable
                        key={minutes}
                        onPress={() =>
                          void persist(APP_SETTING_KEYS.appLockTimeoutMinutes, String(minutes))
                        }
                        className="active:opacity-70"
                      >
                        {i > 0 ? <View className="mx-4 h-px bg-separator" /> : null}
                        <View className="flex-row items-center gap-3 px-4 py-3.5">
                          <Text variant="heading" className="flex-1 text-[15px]">
                            {timeoutLabel(minutes)}
                          </Text>
                          {selected ? <SpriteIcon name="check" size={18} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </Card>
              </View>

              {/* Change PIN */}
              <Card variant="soft" className="p-0">
                <Pressable onPress={() => startSetup(false)} className="active:opacity-70">
                  <View className="flex-row items-center gap-3.5 px-4 py-4">
                    <View className="h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-foreground">
                      <SpriteIcon name="refresh-ccw-01" size={22} />
                    </View>
                    <Text variant="heading" className="flex-1 text-[17px]">
                      Change PIN
                    </Text>
                  </View>
                </Pressable>
              </Card>
            </>
          ) : null}
        </ScrollView>
      </Container>
    </View>
  );
}
