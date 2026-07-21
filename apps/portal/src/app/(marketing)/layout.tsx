import { Nav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";
import { SmoothScrollProvider } from "@/components/shared/smooth-scroll";
import { ReducedMotionProvider } from "@/components/shared/reduced-motion-provider";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReducedMotionProvider>
      <SmoothScrollProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main-content">{children}</main>
        <Footer />
      </SmoothScrollProvider>
    </ReducedMotionProvider>
  );
}
