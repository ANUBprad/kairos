"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive" | "brand";
  href?: string;
  icon?: LucideIcon;
  iconColor?: string;
  header?: React.ReactNode;
  action?: React.ReactNode;
  noPadding?: boolean;
}

function DashboardCard({
  variant = "default",
  href,
  icon: Icon,
  iconColor = "text-brand",
  header,
  action,
  noPadding = false,
  className,
  children,
  ...props
}: DashboardCardProps) {
  const variantStyles = {
    default: "border border-border bg-surface",
    elevated: "border border-border bg-surface shadow-lg shadow-black/5",
    interactive: "border border-border bg-surface hover:border-border-hover hover:shadow-lg hover:shadow-black/5 transition-all duration-200 cursor-pointer",
    brand: "border border-brand/20 bg-gradient-to-br from-brand/5 via-surface to-surface",
  };

  const content = (
    <div
      className={cn(
        "rounded-[var(--radius-lg)]",
        variantStyles[variant],
        !noPadding && "p-5",
        className
      )}
      {...props}
    >
      {(header || Icon || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-surface-hover",
                iconColor && `bg-current/10`
              )}
              style={iconColor ? { backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` } : undefined}
              >
                <Icon size={18} className={iconColor} />
              </div>
            )}
            {header}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-[var(--radius-lg)]">
        {content}
      </Link>
    );
  }

  return content;
}

function CardSection({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {children}
    </div>
  );
}

function CardSectionHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      {children}
    </div>
  );
}

function CardSectionTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-sm font-semibold text-text-primary", className)} {...props}>
      {children}
    </h3>
  );
}

function CardSectionLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "text-xs font-medium text-brand hover:text-brand-hover transition-colors",
        className
      )}
    >
      {children}
    </Link>
  );
}

export { DashboardCard, CardSection, CardSectionHeader, CardSectionTitle, CardSectionLink };
