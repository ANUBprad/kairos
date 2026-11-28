import type { SVGProps } from "react";

export interface KairosLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textSize?: string;
  textColor?: string;
  textClassName?: string;
  iconClassName?: string;
  subtitle?: string;
}

export function KairosMark({
  size = 28,
  className = "",
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="12"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeOpacity="0.2"
      />
      <path
        d="M13 10.5V29.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M29 10.5L16.5 20L29 29.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="29" cy="10.5" r="3.4" fill="var(--foreground)" />
    </svg>
  );
}

export function KairosLogo({
  className = "",
  size = 28,
  showText = true,
  textSize = "text-xl",
  textColor = "text-foreground",
  textClassName = "",
  iconClassName = "",
  subtitle,
}: KairosLogoProps) {
  return (
    <div className={`inline-flex select-none items-center gap-2.5 ${className}`}>
      <KairosMark size={size} className={`shrink-0 text-primary ${iconClassName}`} />
      {showText ? (
        <span className="flex flex-col leading-none">
          <span
            className={`font-heading font-semibold tracking-tight ${textColor} ${textSize} ${textClassName}`}
          >
            Kairos
          </span>
          {subtitle ? (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
