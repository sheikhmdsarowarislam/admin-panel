import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cookie Manager Panel",
  description: "Cookie Manager System in Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}