import * as React from "react";

/**
 * Slider styled for the government office aesthetic.
 * Looks like a brass-ruled ledger scale or an ink-marked ruler.
 * Built on a native range input for zero extra dependencies.
 */
export interface SliderProps {
  value?: number[];
  onValueChange?: (v: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    { value, onValueChange, min = 0, max = 100, step = 1, className = "", disabled },
    ref
  ) => (
    <input
      ref={ref}
      type="range"
      disabled={disabled}
      className={`h-2 w-full cursor-pointer appearance-none rounded-sm bg-gradient-to-r from-amber-900/20 to-amber-900/30 border border-amber-900/30 ${className}`}
      style={{
        accentColor: "#b8860b",
        background: `linear-gradient(to right, #b8860b 0%, #b8860b ${((value?.[0] ?? min) - min) / (max - min) * 100}%, #3d2914 ${((value?.[0] ?? min) - min) / (max - min) * 100}%, #3d2914 100%)`,
        WebkitAppearance: "none",
        appearance: "none",
      }}
      min={min}
      max={max}
      step={step}
      value={value?.[0] ?? min}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
    />
  )
);
Slider.displayName = "Slider";

export { Slider };
