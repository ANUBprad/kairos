import * as React from "react";
import { cn } from "@/lib/utils";

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "glass" | "gradient" | "interactive";
  padding?: "none" | "sm" | "md" | "lg";
}

const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ className, variant = "default", padding = "md", children, ...props }, ref) => {
    const paddingMap = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    const variantMap = {
      default: "border border-border bg-surface",
      elevated: "border border-border bg-surface shadow-lg",
      glass: "border border-border/50 bg-surface/80 backdrop-blur-xl",
      gradient: "border border-border bg-gradient-to-br from-surface to-surface-hover",
      interactive: "border border-border bg-surface hover:border-border-hover hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--radius-lg)] transition-all duration-200",
          variantMap[variant],
          paddingMap[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PremiumCard.displayName = "PremiumCard";

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

function CardHeader({ icon, action, className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)} {...props}>
      <div className="flex items-center gap-2">
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-brand/10 text-brand">
            {icon}
          </div>
        )}
        <div>
          {children}
        </div>
      </div>
      {action}
    </div>
  );
}

function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-sm font-semibold text-text-primary", className)} {...props}>
      {children}
    </h3>
  );
}

function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-text-tertiary", className)} {...props}>
      {children}
    </p>
  );
}

export { PremiumCard, CardHeader, CardTitle, CardDescription };
