import * as React from "react";

/**
 * Button styled for the Vidhana Soudha government office aesthetic.
 * Variants mimic official desk items: brass plaques, red seals,
 * file folder tabs, and ink stamps.
 */
type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "brass" | "seal" | "file";
type Size = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  // Default: brass plaque style (primary action)
  default: "brass-plaque font-serif",
  // Outline: like a file folder edge
  outline: "border-2 border-amber-800/40 bg-amber-50/80 text-amber-900 font-serif hover:bg-amber-100 hover:border-amber-800",
  // Secondary: wooden desk button
  secondary: "bg-gradient-to-b from-amber-800 to-amber-900 text-amber-100 font-serif hover:from-amber-700 hover:to-amber-800 shadow-md",
  // Ghost: transparent like a watermark
  ghost: "text-amber-900 font-serif hover:bg-amber-900/5",
  // Destructive: red official seal
  destructive: "bg-red-800 text-amber-50 font-serif hover:bg-red-700 shadow-md",
  // Brass: explicit brass plaque
  brass: "brass-plaque font-serif",
  // Seal: rubber stamp style
  seal: "border-2 border-red-800 text-red-800 font-serif font-bold uppercase tracking-wider hover:bg-red-50 rotate-[-2deg]",
  // File: manila folder tab
  file: "file-folder text-amber-900 font-serif hover:brightness-95",
};

const sizeClasses: Record<Size, string> = {
  default: "h-9 px-4 text-sm rounded-sm",
  sm: "h-8 px-3 text-xs rounded-sm",
  lg: "h-11 px-6 text-base rounded",
  icon: "h-9 w-9 rounded-sm",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? "button"}
      className={`inline-flex select-none items-center justify-center gap-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50 disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button };
