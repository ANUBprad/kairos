import Image from "next/image";

export function LeafLogo({ size = 28 }: { size?: number }) {
  const h = size;
  const w = Math.round(h * (1648 / 954));
  return (
    <Image
      src="/kairos-nav.png"
      alt="Kairos"
      width={w}
      height={h}
      className="object-contain"
      priority
    />
  );
}

export function KairosWordmark() {
  return null;
}
