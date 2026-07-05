export const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One number (0-9)", test: (v: string) => /[0-9]/.test(v) },
] as const;
