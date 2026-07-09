import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[10px] font-semibold transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-white hover:bg-brand-hover active:bg-brand-active active:scale-[0.97]",
        secondary:
          "border border-border bg-transparent text-text-primary hover:bg-surface hover:border-border-hover active:scale-[0.97]",
        ghost:
          "bg-transparent text-text-secondary hover:bg-surface hover:text-text-primary",
        danger:
          "bg-error text-white hover:bg-red-700 active:bg-red-800 active:scale-[0.97]",
        "danger-outline":
          "border border-error/30 bg-transparent text-error hover:bg-error/10 active:scale-[0.97]",
      },
      size: {
        sm: "h-9 px-4 text-[13px] gap-1.5",
        md: "h-10 px-5 text-[14px] gap-2",
        lg: "h-12 px-7 text-[15px] gap-2",
        xl: "h-14 px-9 text-[16px] gap-2.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
