import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "noxo",
  description: "noxo Service Management",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/noxo-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
