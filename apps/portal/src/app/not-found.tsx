import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="relative w-24 h-24 flex items-center justify-center mb-8">
        <Image
          src="/kai.png"
          alt="Kairos logo"
          width={96}
          height={96}
          priority
          className="object-contain"
        />
      </div>
      <h1 className="text-[72px] font-semibold tracking-tight text-text-primary/20 select-none">
        404
      </h1>
      <h2 className="mt-2 text-2xl font-semibold text-text-primary">
        Page not found
      </h2>
      <p className="mt-3 text-text-secondary max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
        Head back to your research workspace.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <Button variant="primary" size="lg" asChild>
          <Link href="/">
            Go to Home
          </Link>
        </Button>
        <Button variant="secondary" size="lg" asChild>
          <Link href="/app">
            Open Kairos
          </Link>
        </Button>
      </div>
      <p className="mt-6 text-[13px] text-text-tertiary">
        If you believe this is an error, contact us at{" "}
        <a href="mailto:hello@kairos.dev" className="text-brand hover:underline">
          hello@kairos.dev
        </a>
      </p>
    </div>
  );
}