import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthShell from "./AuthShell";
import RegisterSW from "./RegisterSW";

export const metadata: Metadata = {
  title: "Grassroots AMS",
  description: "Grassroots football attendance and player development",
  manifest: "/manifest.webmanifest",
  themeColor: "#020617",
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="!light">
      <body className="bg-slate-50 text-slate-900">
        {/* PWA service worker registration */}
        <RegisterSW />
        {/* Auth + app shell */}
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}

