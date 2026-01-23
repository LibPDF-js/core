import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";

import "./global.css";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LibPDF - The PDF library TypeScript deserves",
    template: "%s | LibPDF",
  },
  description:
    "Parse, modify, sign, and generate PDFs with a modern TypeScript API. The only library with incremental saves that preserve digital signatures.",
  keywords: [
    "PDF",
    "TypeScript",
    "JavaScript",
    "pdf-lib",
    "pdf.js",
    "digital signatures",
    "incremental updates",
    "form filling",
    "encryption",
  ],
  authors: [{ name: "Documenso" }],
  creator: "Documenso",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://libpdf.dev",
    siteName: "LibPDF",
    title: "LibPDF - The PDF library TypeScript deserves",
    description:
      "Parse, modify, sign, and generate PDFs with a modern TypeScript API. The only library with incremental saves that preserve digital signatures.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LibPDF - The PDF library TypeScript deserves",
    description:
      "Parse, modify, sign, and generate PDFs with a modern TypeScript API. The only library with incremental saves that preserve digital signatures.",
  },
  metadataBase: new URL("https://libpdf.dev"),
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
