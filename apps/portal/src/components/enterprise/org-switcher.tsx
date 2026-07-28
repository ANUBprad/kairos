"use client";

import { useState } from "react";
import {
  ChevronDown,
  Check,
  Plus,
  Settings,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
}

interface OrgSwitcherProps {
  currentOrganization: Organization;
  organizations: Organization[];
  className?: string;
}

export function OrgSwitcher({
  currentOrganization,
  organizations,
  className,
}: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border hover:bg-surface-hover transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {currentOrganization.logo ? (
          <Image
            src={currentOrganization.logo}
            alt={currentOrganization.name}
            width={24}
            height={24}
            className="rounded-md"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/10 text-brand text-xs font-medium">
            {getInitials(currentOrganization.name)}
          </div>
        )}
        <span className="flex-1 text-left text-sm font-medium text-text-primary truncate">
          {currentOrganization.name}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-text-tertiary transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
            {/* Organization List */}
            <div className="p-1 max-h-60 overflow-y-auto">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setIsOpen(false);
                    // TODO: Switch organization
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left transition-colors",
                    org.id === currentOrganization.id
                      ? "bg-brand/10 text-brand"
                      : "hover:bg-surface-hover text-text-primary"
                  )}
                >
                  {org.logo ? (
                    <Image
                      src={org.logo}
                      alt={org.name}
                      width={20}
                      height={20}
                      className="rounded-md"
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-surface text-text-tertiary text-[10px] font-medium">
                      {getInitials(org.name)}
                    </div>
                  )}
                  <span className="flex-1 truncate text-sm">{org.name}</span>
                  <span className="text-[10px] text-text-tertiary capitalize">
                    {org.role}
                  </span>
                  {org.id === currentOrganization.id && (
                    <Check size={14} className="text-brand" />
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-border p-1">
              <Link
                href="/app/settings/organization"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-text-secondary hover:bg-surface-hover transition-colors"
              >
                <Settings size={14} />
                <span className="text-sm">Organization Settings</span>
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false);
                  // TODO: Create new organization
                }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-text-secondary hover:bg-surface-hover transition-colors"
              >
                <Plus size={14} />
                <span className="text-sm">Create Organization</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
