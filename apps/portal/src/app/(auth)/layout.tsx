import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Gauge, Sparkles, DollarSign, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: {
    template: "%s | Kairos",
    default: "Sign In | Kairos",
  },
  robots: {
    index: false,
    follow: false,
  },
};

const highlights = [
  { icon: Gauge, text: "24% better recall than static RAG" },
  { icon: Sparkles, text: "Adaptive retrieval per query" },
  { icon: DollarSign, text: "40% lower cost on average" },
  { icon: ShieldCheck, text: "Built for RAG research and experimentation" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left: Branding Panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-bg">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(var(--color-border) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, var(--color-brand-muted) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute bottom-1/4 -right-40 w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />

        <div className="relative flex flex-col justify-between w-full p-12 xl:p-16">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Kairos home">
            <Image
              src="/kai.png"
              alt="Kairos"
              width={36}
              height={36}
              priority
              className="object-contain"
            />
          </Link>

          <div className="space-y-8 max-w-md">
            <div>
              <h2 className="text-[28px] font-semibold text-text-primary tracking-tight leading-[1.15]">
                RAG research platform for AI/ML engineers.
              </h2>
              <p className="mt-3 text-[15px] text-text-secondary leading-relaxed">
                Kairos provides production-grade retrieval-augmented generation with document intelligence, embeddings, semantic search, and explainable AI evaluation.
              </p>
            </div>

            <div className="space-y-4">
              {highlights.map((h) => {
                const Icon = h.icon;
                return (
                  <div key={h.text} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-[8px] bg-brand/10">
                      <Icon size={15} className="text-brand" />
                    </div>
                    <span className="text-sm text-text-secondary">{h.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-text-tertiary">
            &copy; 2026 Kairos. MIT License.
          </p>
        </div>
      </div>

      {/* Right: Auth Form Panel */}
      <div className="flex-1 flex items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo - visible only on mobile/tablet */}
          <div className="lg:hidden flex justify-center mb-10">
            <Link href="/" aria-label="Kairos home">
              <Image
                src="/kai.png"
                alt="Kairos"
                width={32}
                height={32}
                priority
                className="object-contain"
              />
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
