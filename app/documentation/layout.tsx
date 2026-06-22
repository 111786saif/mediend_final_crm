import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mediend CRM - Documentation",
  description: "Complete documentation for Mediend CRM v2 system including APIs, workflows, and frontend architecture",
  robots: {
    index: true,
    follow: true,
  },
};

export default function DocumentationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
