import "./globals.css";
import type { Metadata, Viewport } from "next";
import PwaServiceWorker from "@/components/pwa-service-worker";

export const metadata: Metadata = {
  title: "noxo",
  description: "noxo Service Management",
  applicationName: "noxo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "noxo",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/noxo-icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        <PwaServiceWorker />
        {children}
      </body>
    </html>
  );
}
