import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Mediend CRM",
  description: "Mediend CRM - Patient Lead Management System",
  manifest: "/manifest.json",
  themeColor: "#062D4C",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}
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
