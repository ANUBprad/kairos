import * as React from "react";
import { cn } from "@/lib/utils";

const Select = ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (value: string) => void }) => {
  const [internalValue, setInternalValue] = React.useState(value || "");
  const [open, setOpen] = React.useState(false);

  const currentValue = value !== undefined ? value : internalValue;

  const handleSelect = (val: string) => {
    if (value === undefined) setInternalValue(val);
    onValueChange?.(val);
    setOpen(false);
  };

  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, {
        open,
        setOpen,
        value: currentValue,
        onSelect: handleSelect,
      });
    }
    return child;
  });

  return <div className="relative">{childrenWithProps}</div>;
};
Select.displayName = "Select";

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { open?: boolean; setOpen?: (v: boolean) => void; value?: string }
>(({ className, children, open, setOpen, ...props }, ref) => (
  <button
    ref={ref}
    onClick={() => setOpen?.(!open)}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-[10px] border border-border bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40",
      className
    )}
    {...props}
  >
    {children}
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-2 text-text-tertiary">
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
));
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string; value?: string }>(
  ({ className, placeholder, value, ...props }, ref) => (
    <span ref={ref} className={cn("text-text-primary", !value && "text-text-tertiary", className)} {...props}>
      {value || placeholder || "Select..."}
    </span>
  )
);
SelectValue.displayName = "SelectValue";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { open?: boolean; setOpen?: (v: boolean) => void }
>(({ className, open, children, ...props }, ref) => {
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-1 w-full rounded-[10px] border border-border bg-surface shadow-lg py-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string; onSelect?: (v: string) => void }
>(({ className, children, value, onSelect, ...props }, ref) => (
  <div
    ref={ref}
    onClick={() => onSelect?.(value)}
    className={cn(
      "px-3 py-2 text-sm text-text-primary cursor-pointer hover:bg-surface-hover transition-colors",
      className
    )}
    {...props}
  >
    {children}
  </div>
));
SelectItem.displayName = "SelectItem";

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
