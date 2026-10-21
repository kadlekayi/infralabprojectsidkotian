import * as React from "react";

/**
 * Minimal Badge matching the shadcn/ui API surface the game uses
 * (`variant`, `className`). Colors are deliberately left to the
 * caller — the game's EraBadge passes its own bg/text/border
 * classes, and keeping variants color-free means those always win.
 */
type Variant = "default" | "secondary" | "outline" | "destructive" | "success";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  default: "",
  secondary: "",
  outline: "border border-white/20",
  destructive: "",
  success: "",
};

const Badge = ({ className = "", variant = "default", ...props }: BadgeProps) => (
  <div
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${variantClasses[variant]} ${className}`}
    {...props}
  />
);

export { Badge };
