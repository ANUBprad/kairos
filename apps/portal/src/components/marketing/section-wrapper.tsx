import { cn } from "@/lib/utils";

interface SectionWrapperProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function SectionWrapper({
  children,
  className,
  id,
}: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={cn(
        "mx-auto max-w-[1280px] px-6 sm:px-8 py-20 md:py-28",
        className
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-center text-[28px] sm:text-[36px] font-semibold tracking-tight text-text-primary",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function SectionSubheading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-4 text-center text-[16px] sm:text-[18px] text-text-secondary max-w-2xl mx-auto leading-relaxed",
        className
      )}
    >
      {children}
    </p>
  );
}
