import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/Providers";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Kairos — Adaptive Retrieval Intelligence Platform",
    template: "%s | Kairos",
  },
  description:
    "Kairos is an open-source RAG research platform for document intelligence, embeddings, semantic search, and explainable AI. Build production-grade retrieval systems.",
  openGraph: {
    title: "Kairos — Adaptive Retrieval Intelligence Platform",
    description:
      "Open-source RAG research platform for document intelligence, embeddings, semantic search, and explainable AI.",
    type: "website",
    siteName: "Kairos",
    locale: "en_US",
    images: [{
      url: "/kai.png",
      width: 500,
      height: 500,
      alt: "Kairos — Adaptive Retrieval Intelligence Platform",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kairos — Adaptive Retrieval Intelligence Platform",
    description:
      "Open-source RAG research platform for document intelligence, embeddings, and semantic search.",
    images: ["/kai.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: { url: "/kai.png", type: "image/png" },
    apple: { url: "/kai.png", sizes: "500x500" },
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://kairos.dev"),
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${plusJakartaSans.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                if (theme === 'light' || (!theme && window.matchMedia('(prefers-color-scheme: light)').matches)) {
                  document.documentElement.classList.add('light');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded-md focus:outline-none focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>
        <Providers>
          {children}
        </Providers>
        <Toaster
          position="top-right"
          expand={false}
          richColors
          closeButton
          theme="dark"
          toastOptions={{
            duration: 3000,
          }}
        />
      </body>
    </html>
  );
}
