import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seedbed Voter — Finova AI Ideas",
  description: "Vote for your favourite shortlisted AI idea from Seedbed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="bg-ink px-7 py-3.5 flex justify-between items-center">
          <span className="font-bold text-[15px] text-white tracking-tight">
            Seedbed <span className="font-normal opacity-45">/ Voter</span>
          </span>
          <span className="font-mono text-[12px] text-white/50 uppercase tracking-wider">
            Finova AI Council
          </span>
        </nav>
        {children}
      </body>
    </html>
  );
}
