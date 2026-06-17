import { cn } from "heroui-native";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Onboarding shared shell — ports the `.ob`/`.obtn`/`.prog` primitives from
 * `unmiser Onboarding.html` to uniwind + the unmiser design tokens
 * (`foreground`/`background`/`border`/`surface`/`muted`/`accent`/`success`).
 *
 * Page transitions are handled by the route Stack (`animation: slide_from_right`)
 * so no custom Reanimated entering is needed here.
 */

/** Pill-dot progress: one pill marks the active step, dots the rest. */
export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View className="flex-row items-center gap-[5px] px-[18px] pt-[14px] pb-[2px]">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          className={cn(
            "h-[6px] rounded-full",
            i === current ? "w-[20px] rounded-[3px] bg-foreground" : "w-[6px] bg-border",
          )}
        />
      ))}
    </View>
  );
}

type ButtonVariant = "solid" | "outline" | "ghost";

interface OnboardingButtonProps extends ComponentProps<typeof Pressable> {
  variant?: ButtonVariant;
  disabled?: boolean;
  children: ReactNode;
}

/** The chunky near-square onboarding button. `disabled` renders a dimmed tile. */
export function OnboardingButton({
  variant = "solid",
  disabled = false,
  className,
  children,
  ...props
}: OnboardingButtonProps) {
  if (disabled) {
    return (
      <View
        className={cn(
          "rounded-[3px] border-[1.5px] border-border bg-border py-[14px] items-center",
          className,
        )}
      >
        <ButtonLabel className="text-background">{children}</ButtonLabel>
      </View>
    );
  }
  const variants: Record<ButtonVariant, string> = {
    solid: "bg-foreground border-[1.5px] border-foreground active:opacity-80",
    outline: "bg-background border-[1.5px] border-foreground active:opacity-80",
    ghost: "border border-transparent bg-transparent py-[8px] active:opacity-70",
  };
  const labelTone: Record<ButtonVariant, string> = {
    solid: "text-background",
    outline: "text-foreground",
    ghost: "text-muted text-[12.5px]",
  };
  return (
    <Pressable
      className={cn(
        "rounded-[3px] py-[14px] items-center justify-center",
        variants[variant],
        className,
      )}
      {...props}
    >
      <ButtonLabel className={labelTone[variant]}>{children}</ButtonLabel>
    </Pressable>
  );
}

function ButtonLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text className={cn("text-center text-[13.5px] font-extrabold tracking-tight", className)}>
      {children}
    </Text>
  );
}

/** Title/sub copy block: optional mono label, big black title, secondary sub. */
export function CopyBlock({
  label,
  title,
  subtitle,
  className,
}: {
  label?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn("px-[18px] pt-[8px]", className)}>
      {label != null && (
        <Text className="mb-[5px] font-mono text-[9.5px] uppercase tracking-[0.13em] text-muted">
          {label}
        </Text>
      )}
      <Text className="text-[26px] font-black leading-[1.04] tracking-[-0.03em] text-foreground">
        {title}
      </Text>
      {subtitle != null && (
        <Text className="mt-[7px] text-[13px] leading-[1.55] text-muted">{subtitle}</Text>
      )}
    </View>
  );
}

/** The "unmiser •" wordmark used on the welcome splash. */
export function LogoLockup() {
  return (
    <View className="flex-row items-center gap-[7px] px-[20px]">
      <Text className="text-[17px] font-black tracking-[-0.02em] text-foreground">unmiser</Text>
      <View className="h-[7px] w-[7px] rounded-full bg-foreground" />
    </View>
  );
}

/** Full-height screen container honouring top + bottom safe-area insets
 *  (bottom so the CTA foot row clears the home indicator / gesture bar). */
export function OnboardingScreen({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={cn("flex-1 bg-background", className)}
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {children}
    </View>
  );
}
