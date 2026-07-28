"use client";

import { cn } from "@/lib/utils";

interface Member {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  role: string;
}

interface MemberAvatarsProps {
  members: Member[];
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-brand text-white",
  ADMIN: "bg-success text-white",
  MEMBER: "bg-surface text-text-primary",
  VIEWER: "bg-surface text-text-tertiary",
};

export function MemberAvatars({
  members,
  max = 5,
  size = "md",
  className,
}: MemberAvatarsProps) {
  const sizeClasses = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const visibleMembers = members.slice(0, max);
  const remainingCount = Math.max(0, members.length - max);

  return (
    <div className={cn("flex items-center", className)}>
      {visibleMembers.map((member, index) => (
        <div
          key={member.id}
          className={cn(
            "relative rounded-full border-2 border-surface",
            index > 0 && "-ml-2"
          )}
          title={`${member.user.name || member.user.email} (${member.role})`}
        >
          {member.user.image ? (
            <img
              src={member.user.image}
              alt={member.user.name || member.user.email}
              className={cn("rounded-full", sizeClasses[size])}
            />
          ) : (
            <div
              className={cn(
                "rounded-full flex items-center justify-center font-medium",
                sizeClasses[size],
                ROLE_COLORS[member.role] || ROLE_COLORS.MEMBER
              )}
            >
              {getInitials(member.user.name, member.user.email)}
            </div>
          )}
        </div>
      ))}

      {remainingCount > 0 && (
        <div
          className={cn(
            "relative -ml-2 rounded-full border-2 border-surface bg-surface-hover flex items-center justify-center font-medium text-text-tertiary",
            sizeClasses[size]
          )}
          title={`${remainingCount} more members`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
