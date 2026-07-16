import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[var(--radius-lg)] border border-border bg-surface p-6 transition-all duration-200",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

export { Card };
