import React from "react";
import { cn } from "../../lib/utils";

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[112px] w-full resize-none rounded-sm border border-[#1a2e28]/15 bg-[#faf9f6] px-3.5 py-3 text-sm text-[#171816] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-[border-color,box-shadow] duration-300 placeholder:text-[#565a55]/65 focus-visible:border-[#0d4a39]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e2ad32]/35 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));

Textarea.displayName = "Textarea";

export { Textarea };
