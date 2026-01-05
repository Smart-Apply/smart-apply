import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { ErrorBoundary } from "@/components/error-boundary";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "arial"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart Apply - KI-gestützte Bewerbungen",
  description: "Erstelle personalisierte Bewerbungen mit KI-Unterstützung",
  openGraph: {
    title: 'Smart Apply - KI-gestützte Bewerbungen',
    description: 'Erstelle personalisierte Bewerbungen mit KI-Unterstützung',
    images: ['/Logo/Full Logo.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Smart Apply - KI-gestützte Bewerbungen',
    description: 'Erstelle personalisierte Bewerbungen mit KI-Unterstützung',
    images: ['/Logo/Full Logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
