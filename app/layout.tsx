import type { Metadata } from "next";
import "./globals.css";
import AuthShell from "./AuthShell";

export const metadata: Metadata = {
  title: "Grassroots AMS",
  description: "Grassroots football attendance and player development",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="!light">
      <body className="bg-slate-50 text-slate-900">
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}
