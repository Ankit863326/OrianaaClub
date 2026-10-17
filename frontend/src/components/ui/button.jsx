import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#0d4a39] text-[#e2ad32] hover:bg-[#083d30]",
        outline: "border border-[#171816] bg-white text-[#171816] hover:bg-[#f5f5f3]",
        ghost: "bg-transparent text-[#171816] hover:bg-[#f5f5f3]",
        carousel: "border border-white/80 bg-[rgba(17,24,21,0.42)] text-white hover:bg-[#0d4a39]",
        indicator: "bg-[#171816]/25 hover:bg-[#0d4a39]",
      },
      size: {
        default: "min-h-11 px-4 py-2",
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