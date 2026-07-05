"use client";

import { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, XCircle } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "@/lib/validation";

interface FormFieldProps {
  label: string;
  type?: string;
  placeholder?: string;
  register: UseFormRegisterReturn;
  error?: FieldError;
  hint?: string;
  maxChars?: number;
  value?: string;
  showPasswordRequirements?: boolean;
  autoComplete?: string;
  disabled?: boolean;
}

export function FormField({
  label,
  type = "text",
  placeholder,
  register,
  error,
  hint,
  maxChars,
  value = "",
  showPasswordRequirements,
  autoComplete,
  disabled,
}: FormFieldProps) {
  const [charCount, setCharCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setCharCount(value.length);
  }, [value]);

  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  const inputId = `field-${register.name || label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-[13px] font-medium text-text-primary">
        {label}
      </label>

      <div className="relative">
        <input
          {...register}
          id={inputId}
          type={inputType}
          placeholder={placeholder}
          maxLength={maxChars}
          autoComplete={autoComplete}
          disabled={disabled}
          className={cn(
            "w-full h-11 rounded-[10px] border px-3.5 pr-10 text-sm text-text-primary placeholder:text-text-tertiary/50 transition-all outline-none",
            error
              ? "border-error/60 bg-error/5 focus:ring-2 focus:ring-error/20 focus:border-error"
              : "border-border bg-surface/50 focus:ring-2 focus:ring-brand/15 focus:border-brand/40",
            disabled && "opacity-40 cursor-not-allowed"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isPassword && value.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          {error && !isPassword && (
            <XCircle size={16} className="text-error shrink-0" />
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-error flex items-center gap-1.5 mt-1">
          <XCircle size={12} className="shrink-0" />
          {error.message}
        </p>
      )}

      {hint && !error && (
        <p className="text-xs text-text-secondary">{hint}</p>
      )}

      {showPasswordRequirements && (
        <div className="space-y-1 mt-2 p-2.5 rounded-[8px] bg-brand/5 border border-brand/10">
          {PASSWORD_REQUIREMENTS.map((req) => (
            <div key={req.label} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 transition-colors duration-200",
                  req.test(value)
                    ? "bg-success text-white"
                    : "bg-border text-text-tertiary"
                )}
              >
                {req.test(value) ? "✓" : "○"}
              </span>
              <span
                className={cn(
                  "transition-colors duration-200",
                  req.test(value) ? "text-success" : "text-text-tertiary"
                )}
              >
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {maxChars && (
        <p className="text-xs text-text-secondary text-right">
          {charCount} / {maxChars}
        </p>
      )}
    </div>
  );
}
