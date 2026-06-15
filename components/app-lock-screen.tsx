import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";

import { PinPad } from "@/components/pin-pad";
import { ConfirmDialog, SpriteIcon, Text } from "@/components/ui";
import { db } from "@/db/index";
import { appSettingsCollection } from "@/db/collections";
import {
  accountBalanceCollection,
  accountCollection,
  categoryCollection,
  transactionCollection,
} from "@/db/collections/finance";
import { subscriptionCollection } from "@/db/collections";
import { resetAppLockAndWipe } from "@/db/services/app-lock-ops";
import { cooldownSeconds } from "@/lib/security/app-lock";
import { authenticateBiometric, isBiometricAvailable } from "@/lib/security/biometric";
import { PIN_LENGTH, verifyPin } from "@/lib/security/pin";

/**
 * Full-screen lock overlay (App-lock design): padlock + "unmiser is locked",
 * the 4-dot PIN pad, and an optional "Use fingerprint" affordance. Calls
 * `onUnlock` once the PIN verifies or biometric succeeds. Back is swallowed.
 *
 * Hardening (§10): a wrong-PIN cooldown that escalates every 5 attempts, and a
 * "Forgot PIN?" recovery that erases on-device data + disables the lock (the
 * only safe reset for local-only, account-less data).
 */
export function AppLockScreen({
  biometricEnabled,
  onUnlock,
}: {
  biometricEnabled: boolean;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [canBiometric, setCanBiometric] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const promptedRef = useRef(false);

  // Block hardware back while locked.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  // Cooldown countdown tick.
  useEffect(() => {
    if (lockedUntil == null) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setLockedUntil(null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const tryBiometric = useCallback(async () => {
    const ok = await authenticateBiometric("Unlock Unmiser");
    if (ok) onUnlock();
  }, [onUnlock]);

  // Probe biometric availability, and auto-trigger the prompt once on mount
  // when it's enabled + available (Cashiro behaviour).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const available = biometricEnabled && (await isBiometricAvailable());
      if (cancelled) return;
      setCanBiometric(available);
      if (available && !promptedRef.current) {
        promptedRef.current = true;
        void tryBiometric();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [biometricEnabled, tryBiometric]);

  const locked = remaining > 0;

  const onChange = (next: string) => {
    if (locked) return;
    setError(false);
    setPin(next);
    if (next.length === PIN_LENGTH) {
      void (async () => {
        if (await verifyPin(next)) {
          onUnlock();
          return;
        }
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        setError(true);
        const cooldown = cooldownSeconds(nextAttempts);
        if (cooldown > 0) setLockedUntil(Date.now() + cooldown * 1000);
        setTimeout(() => {
          setPin("");
          setError(false);
        }, 600);
      })();
    }
  };

  const onForgotReset = async () => {
    setResetting(true);
    try {
      await resetAppLockAndWipe(db);
      await Promise.all([
        appSettingsCollection.utils.refetch(),
        transactionCollection.utils.refetch(),
        accountCollection.utils.refetch(),
        accountBalanceCollection.utils.refetch(),
        categoryCollection.utils.refetch(),
        subscriptionCollection.utils.refetch(),
      ]);
      setConfirmReset(false);
      onUnlock();
    } finally {
      setResetting(false);
    }
  };

  const subtitle = locked
    ? `Too many attempts — try again in ${remaining}s`
    : error
      ? "Wrong PIN — try again"
      : "Enter your PIN to continue";

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <SpriteIcon name="lock-01" size={64} />
      <Text variant="title" className="mt-6 text-[26px]">
        unmiser is locked
      </Text>
      <Text variant="body" className="mt-1.5 text-[15px] text-muted">
        {subtitle}
      </Text>

      <View
        className="mt-9"
        style={{ opacity: locked ? 0.4 : 1 }}
        pointerEvents={locked ? "none" : "auto"}
      >
        <PinPad value={pin} onChange={onChange} length={PIN_LENGTH} error={error} />
      </View>

      {canBiometric && !locked ? (
        <Pressable
          onPress={() => void tryBiometric()}
          className="mt-8 flex-row items-center gap-2 active:opacity-70"
          accessibilityLabel="Use fingerprint"
        >
          <SpriteIcon name="fingerprint-01" size={22} />
          <Text variant="heading" className="text-[15px]">
            Use fingerprint
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => setConfirmReset(true)}
        className="mt-8 active:opacity-70"
        accessibilityLabel="Forgot PIN"
      >
        <Text variant="body" className="text-[14px] text-muted underline">
          Forgot PIN?
        </Text>
      </Pressable>

      <ConfirmDialog
        isOpen={confirmReset}
        onOpenChange={setConfirmReset}
        icon="trash-outline"
        title="Reset & erase data?"
        description="There's no way to recover a forgotten PIN without erasing this device's data — nothing was ever sent to a server. This wipes every account, transaction and setting, and turns App-lock off."
        confirmLabel="Erase everything"
        busy={resetting}
        onConfirm={() => void onForgotReset()}
      />
    </View>
  );
}
