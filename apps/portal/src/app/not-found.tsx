import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <Image src="/kairos-nav.png" alt="Kairos" width={120} height={28} priority />
      <h1 className="mt-8 text-[56px] font-semibold tracking-tight text-text-primary">404</h1>
      <p className="mt-3 text-[18px] text-text-secondary max-w-md">
        This page doesn&apos;t exist. It may have moved or the URL might be incorrect.
      </p>
      <div className="mt-8">
        <Button variant="primary" size="lg" asChild>
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
