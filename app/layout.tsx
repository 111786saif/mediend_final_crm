import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { BackCloseProvider } from "@/providers/back-close-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthenticatedWrapper } from "@/components/authenticated-wrapper";
import { AIProvider } from "@/components/ai/ai-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#062D4C",
};

export const metadata: Metadata = {
  title: "Mediend CRM",
  description: "Mediend CRM - Patient Lead Management System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mediend Workspace",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        <QueryProvider>
          <BackCloseProvider>
            <AIProvider>
              <AuthenticatedWrapper>{children}</AuthenticatedWrapper>
              <Toaster />
            </AIProvider>
          </BackCloseProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
