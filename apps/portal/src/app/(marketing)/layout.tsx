import { Nav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";
import { SmoothScrollProvider } from "@/components/shared/smooth-scroll";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SmoothScrollProvider>
      <Nav />
      <main id="main-content">{children}</main>
      <Footer />
    </SmoothScrollProvider>
  );
}
