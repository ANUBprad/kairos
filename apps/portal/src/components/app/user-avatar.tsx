import Image from "next/image";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return (email?.charAt(0) || "?").toUpperCase();
}

interface UserAvatarProps {
  image?: string | null;
  name?: string | null;
  email: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-8 w-8 text-[13px]",
  lg: "h-10 w-10 text-[15px]",
};

export function UserAvatar({ image, name, email, size = "sm", className }: UserAvatarProps) {
  const initials = getInitials(name, email);

  if (image) {
    return (
      <Image
        src={image}
        alt={name || email}
        width={40}
        height={40}
        className={cn("rounded-full object-cover shrink-0", sizeMap[size], className)}
      />
    );
  }

  const colors = [
    "bg-brand/15 text-brand",
    "bg-blue-500/15 text-blue-400",
    "bg-purple-500/15 text-purple-400",
    "bg-green-500/15 text-green-400",
    "bg-amber-500/15 text-amber-400",
    "bg-pink-500/15 text-pink-400",
    "bg-cyan-500/15 text-cyan-400",
  ];

  const colorIndex = email.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-bold shrink-0 select-none",
        sizeMap[size],
        colors[colorIndex],
        className
      )}
    >
      {initials}
    </div>
  );
}
