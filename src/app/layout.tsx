import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { strings } from "@/frame/strings";
import { THEME_BOOTSTRAP_SCRIPT } from "@/frame/theme-bootstrap";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: strings.site.name, template: `%s · ${strings.site.name}` },
  description: strings.site.description,
  applicationName: strings.site.name,
  openGraph: {
    type: "website",
    siteName: strings.site.name,
    title: strings.site.name,
    description: strings.site.description,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the bootstrap script before hydration, hence suppressHydrationWarning.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
