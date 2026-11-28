import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, JetBrains_Mono, Figtree, Newsreader } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/theme-provider";
import QueryProvider from "@/components/providers/query-provider";
import { PWAProvider } from "@/components/providers/pwa-provider";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { UpgradeModal } from "@/features/billing";
import { Analytics } from "@vercel/analytics/next";

const figtreeDisplay = Figtree({
  subsets: ["latin"],
  variable: "--font-kairos-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-kairos-mono",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-kairos-serif",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F5" },
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Kairos — Research with receipts",
    template: "%s | Kairos",
  },
  description:
    "Kairos turns your sources into grounded answers, study material, and conversations you can trust.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kairos",
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/logo.svg",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={cn(
        "h-full antialiased font-sans",
        geistSans.variable,
        geistMono.variable,
        jetbrainsMono.variable,
        figtreeDisplay.variable,
        newsreader.variable
      )}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <PWAProvider>
              {children}
              <UpgradeModal />
              <InstallPrompt />
            </PWAProvider>
          </QueryProvider>
        </ThemeProvider>
        {process.env.VERCEL === "1" ? <Analytics /> : null}
      </body>
    </html>
  );
}
