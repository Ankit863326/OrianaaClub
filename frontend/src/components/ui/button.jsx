import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-[#0d4a39] text-[#e2ad32] border border-[#e2ad32]/35 shadow-[0_0_0_1px_rgba(226,173,50,0.35),0_12px_35px_rgba(13,74,57,0.45)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#0b4531] hover:text-[#f1d99c] hover:border-[#dfcc9e]/80 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(213,187,124,0.45),0_8px_26px_rgba(183,155,99,0.27),0_14px_35px_rgba(13,74,57,0.55),inset_0_1px_0_rgba(255,255,255,0.24)] active:translate-y-0 active:scale-[0.98] [&_svg]:transition-transform [&_svg]:duration-250 hover:[&_svg]:translate-x-1",
        outline: "border border-[#171816] bg-white text-[#171816] hover:bg-[#f5f5f3]",
        ghost: "bg-transparent text-[#171816] hover:bg-[#f5f5f3]",
        glass:
          "rounded-full border border-white/40 bg-white/15 text-white backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_15px_rgba(0,0,0,0.08)] hover:bg-white hover:text-black hover:border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.5),0_6px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        carousel: "border border-white/80 bg-[rgba(17,24,21,0.42)] text-white hover:bg-[#0d4a39]",
        indicator: "bg-[#171816]/25 hover:bg-[#0d4a39]",
      },
      size: {
        default: "min-h-11 px-5 py-2",
        icon: "h-11 w-11",
        indicator: "h-1 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(({ asChild = false, className = "", size, variant, ...props }, ref) => {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      ref={ref}
      className={`${buttonVariants({ variant, size })} ${className}`.trim()}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button };
