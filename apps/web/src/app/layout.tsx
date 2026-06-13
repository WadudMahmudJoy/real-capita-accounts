import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Capita Accounting & Project Finance System",
  description: "Phase 0 technical foundation for the Real Capita accounting-first system.",
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
