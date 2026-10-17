import React from "react";
import { cn } from "../../lib/utils";

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-[11px] font-semibold uppercase tracking-[0.14em] text-[#53665b]",
      className,
    )}
    {...props}
  />
));

Label.displayName = "Label";

export { Label };
