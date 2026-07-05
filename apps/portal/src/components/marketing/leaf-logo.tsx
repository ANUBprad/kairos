import Image from "next/image";

export function LeafLogo({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/kai.png"
      alt="Kairos"
      width={size}
      height={size}
      className="object-contain"
      priority
    />
  );
}


