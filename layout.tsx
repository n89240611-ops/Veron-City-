import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "VYRON City — Cinematic Open-World Social Universe",
  description:
    "VYRON City is an original 3D open-world social game: build an avatar, drive the districts, run missions with friends, and climb the boards.",
  applicationName: "VYRON City",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "VYRON City" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-vyron-void text-vyron-ink antialiased selection:bg-vyron-cyan/30">
        {children}
      </body>
    </html>
  );
}
