import { Slider } from "heroui-native";

export interface AppSliderProps {
  /** Initial value — the slider is UNCONTROLLED so the thumb tracks the finger
   *  smoothly without a React round-trip; report via onChange/onChangeEnd. */
  defaultValue: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
}

const single = (v: number | number[]): number => (Array.isArray(v) ? v[0] : v);

/**
 * AppSlider — the unmiser slider (design/Appearance.png): an ink-filled track on
 * a light rail with a clean white circular thumb ringed in ink. Wraps HeroUI's
 * Slider, overriding the default rounded-rect accent thumb (thumbContainer +
 * thumbKnob slots) for the editorial look, and runs uncontrolled so dragging is
 * smooth (persist on `onChangeEnd`, not every tick).
 */
export function AppSlider({
  defaultValue,
  minValue = 0,
  maxValue = 100,
  step = 1,
  onChange,
  onChangeEnd,
}: AppSliderProps) {
  return (
    <Slider
      defaultValue={defaultValue}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      onChange={(v) => onChange?.(single(v))}
      onChangeEnd={(v) => onChangeEnd?.(single(v))}
    >
      <Slider.Track className="h-3 overflow-visible rounded-full border border-border bg-surface-secondary">
        <Slider.Fill className="rounded-full bg-foreground" />
        <Slider.Thumb
          classNames={{
            // White circle, thin ink ring, no inner knob/shadow.
            thumbContainer:
              "h-7 w-7 rounded-full border-[1.5px] border-foreground bg-background p-0",
            thumbKnob: "rounded-full bg-transparent shadow-none",
          }}
        />
      </Slider.Track>
    </Slider>
  );
}
