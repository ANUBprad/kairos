import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[14px] border border-border bg-surface p-6 transition-all duration-200",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardInteractive = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[14px] border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-[2px] hover:border-border-hover hover:shadow-lg cursor-pointer",
      className
    )}
    {...props}
  />
));
CardInteractive.displayName = "CardInteractive";

export { Card, CardInteractive };
