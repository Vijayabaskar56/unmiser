import { BottomSheet } from "heroui-native";
import { SheetOverlay } from "@/components/ui/sheet-overlay";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { Field, SubmitButton, Text } from "@/components/ui";
import type { Account } from "@/db/schema";
import type { BankSubtype } from "@/db/schema";
import { db } from "@/db/index";
import { appDb } from "@/db/app-db";
import {
  type AccountKind,
  createAccount,
  editAccount,
  setManualBalance,
} from "@/db/services/account-ops";
import { kindMeta, rowToKind } from "@/lib/accounts/kinds";

const SUBTYPES: BankSubtype[] = ["savings", "salary", "current"];

export type FormMode = { type: "new"; kind: AccountKind } | { type: "edit"; account: Account };

interface Props {
  mode: FormMode | null;
  onClose: () => void;
  /** Called after a successful create/edit so the caller can refetch. */
  onSaved: () => void;
}

interface FormState {
  name: string;
  last4: string;
  currency: string;
  subtype: BankSubtype;
  creditLimit: string;
  balance: string;
}

/**
 * Create / edit an account in a bottom sheet. Fields adapt to the kind via
 * `kindMeta` (last4 + subtype for bank, limit for credit, manual balance for
 * cash). Writes go through `account-ops` (services own the unique constraint
 * and the main-account cleanup), then the caller refetches.
 */
export function AccountFormSheet({ mode, onClose, onSaved }: Props) {
  const kind: AccountKind =
    mode?.type === "edit" ? rowToKind(mode.account) : (mode?.kind ?? "bank");
  const meta = kindMeta(kind);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  // Re-seed the form whenever the sheet opens for a different target.
  useEffect(() => {
    if (!mode) return;
    if (mode.type === "edit") {
      const a = mode.account;
      setForm({
        name: a.bankName,
        last4: a.accountLast4,
        currency: a.currency,
        subtype: (a.bankSubtype as BankSubtype) ?? "savings",
        creditLimit: a.creditLimit ?? "",
        balance: "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [mode]);

  const nameValid = form.name.trim().length > 0;
  const currencyValid = form.currency.trim().length > 0;
  const last4Valid = !meta.hasLast4 || form.last4.trim().length > 0;
  const canSubmit = nameValid && currencyValid && last4Valid && !submitting;

  const onSubmit = async () => {
    if (!canSubmit || !mode) return;
    setSubmitting(true);
    try {
      const currency = form.currency.trim().toUpperCase();
      const last4 = meta.hasLast4 ? form.last4.trim() : "";
      const creditLimit =
        meta.hasCreditLimit && form.creditLimit.trim().length > 0 ? form.creditLimit.trim() : null;
      const bankSubtype = meta.hasSubtype ? form.subtype : null;

      if (mode.type === "new") {
        const id = await createAccount(db, {
          bankName: form.name.trim(),
          accountLast4: last4,
          currency,
          kind,
          bankSubtype,
          creditLimit,
        });
        if (meta.manualBalance && form.balance.trim().length > 0) {
          await setManualBalance(appDb, id, form.balance.trim());
        }
      } else {
        await editAccount(db, mode.account.id, {
          bankName: form.name.trim(),
          accountLast4: last4,
          currency,
          bankSubtype,
          creditLimit,
        });
        if (meta.manualBalance && form.balance.trim().length > 0) {
          await setManualBalance(appDb, mode.account.id, form.balance.trim());
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Could not save", String(e instanceof Error ? e.message : e));
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode?.type === "edit" ? `Edit ${meta.label.toLowerCase()}` : `New ${meta.label.toLowerCase()}`;

  return (
    <BottomSheet isOpen={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <BottomSheet.Portal>
        <SheetOverlay />
        <BottomSheet.Content keyboardBehavior="interactive">
          <BottomSheet.Title>{title}</BottomSheet.Title>
          <View className="gap-3 pt-3">
            <Field
              label={meta.hasLast4 ? "Bank name" : "Name"}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder={meta.hasLast4 ? "e.g. HDFC" : meta.label}
            />

            {meta.hasSubtype ? (
              <View>
                <Text variant="caption" className="mb-1.5">
                  Type
                </Text>
                <View className="flex-row gap-2">
                  {SUBTYPES.map((s) => {
                    const active = s === form.subtype;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setForm((f) => ({ ...f, subtype: s }))}
                        className={
                          active
                            ? "rounded-[3px] border-[1.3px] border-foreground bg-foreground px-3 py-2"
                            : "rounded-[3px] border-[1.3px] border-border px-3 py-2"
                        }
                      >
                        <Text
                          className={
                            active ? "text-[12px] text-background" : "text-[12px] text-foreground"
                          }
                        >
                          {s}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {meta.hasLast4 ? (
              <Field
                label="Last 4 digits"
                value={form.last4}
                onChangeText={(v) => setForm((f) => ({ ...f, last4: v }))}
                placeholder="1234"
                keyboardType="number-pad"
                maxLength={4}
              />
            ) : null}

            <Field
              label="Currency"
              value={form.currency}
              onChangeText={(v) => setForm((f) => ({ ...f, currency: v }))}
              placeholder="INR"
              autoCapitalize="characters"
              maxLength={3}
            />

            {meta.hasCreditLimit ? (
              <Field
                label="Credit limit"
                value={form.creditLimit}
                onChangeText={(v) => setForm((f) => ({ ...f, creditLimit: v }))}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            ) : null}

            {meta.manualBalance ? (
              <Field
                label={mode?.type === "edit" ? "New balance (optional)" : "Current balance"}
                value={form.balance}
                onChangeText={(v) => setForm((f) => ({ ...f, balance: v }))}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            ) : null}

            <SubmitButton
              label={mode?.type === "edit" ? "Save changes" : "Add account"}
              submitting={submitting}
              canSubmit={canSubmit}
              onPress={() => void onSubmit()}
            />
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

function emptyForm(): FormState {
  return { name: "", last4: "", currency: "INR", subtype: "savings", creditLimit: "", balance: "" };
}
