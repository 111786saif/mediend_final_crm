import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { BackCloseProvider } from "@/providers/back-close-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthenticatedWrapper } from "@/components/authenticated-wrapper";
import { ThemeProvider } from "@/components/theme-provider";

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="mediend-theme"
          disableTransitionOnChange
        >
          <QueryProvider>
            <BackCloseProvider>
              <AuthenticatedWrapper>{children}</AuthenticatedWrapper>
              <Toaster />
            </BackCloseProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}