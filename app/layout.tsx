import type { Metadata } from "next";
import "./global.css";

export const metadata: Metadata = {
  title: "WorkforceIQ Enterprise",
  description: "Workforce management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}