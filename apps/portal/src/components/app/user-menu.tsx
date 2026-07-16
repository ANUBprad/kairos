"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown,
  LayoutDashboard,
  Settings,
  Building2,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/app/user-avatar";

interface UserMenuProps {
  email: string;
  name?: string | null;
  image?: string | null;
  organizationName?: string | null;
}

export function UserMenu({ email, name, image, organizationName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        aria-label="User menu"
        aria-expanded={open}
      >
        <UserAvatar image={image} name={name} email={email} />
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-xl z-50">
          <div className="px-3 py-3">
            <div className="flex items-center gap-3">
              <UserAvatar image={image} name={name} email={email} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">
                  {name || "Demo User"}
                </p>
                <p className="text-xs text-text-tertiary truncate">{email}</p>
              </div>
            </div>
            {organizationName && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-text-tertiary">
                <Building2 size={12} />
                <span className="truncate">{organizationName}</span>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-1">
            <Link
              href="/app"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
            <Link
              href="/app/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Settings size={16} />
              Settings
            </Link>
          </div>

          <div className="border-t border-border pt-1">
            <button
              onClick={toggleTheme}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <div className="flex items-center gap-2.5">
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </div>
              <div className="flex h-5 w-9 items-center rounded-full bg-border transition-colors duration-200">
                <div
                  className={cn(
                    "h-3.5 w-3.5 rounded-full bg-text-primary transition-transform duration-200",
                    theme === "light" && "translate-x-4"
                  )}
                />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
