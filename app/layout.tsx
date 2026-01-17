import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <div className="min-h-screen flex flex-col">
          {/* Top app bar */}
          <header className="border-b bg-slate-900 text-slate-50">
            <div className="max-w-xl mx-auto flex items-center justify-between px-4 py-3">
              <Link href="/" className="font-semibold text-base">
                Grassroots AMS
              </Link>
              <nav className="flex gap-4 text-sm">
                <Link href="/teams" className="hover:underline">
                  Teams
                </Link>
                <Link href="/" className="hover:underline">
                  Players
                </Link>
                <Link href="/sessions" className="hover:underline">
                  Sessions
                </Link>
                <Link href="/development" className="hover:underline">
                  Development
                </Link>
              </nav>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 max-w-xl mx-auto w-full px-4 py-4">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
