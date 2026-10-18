import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ABAPForge — The Modern ABAP Studio (Free)",
  description:
    "ABAPForge is a free, browser-based SAP-style ABAP studio: procedural + object-oriented ABAP, ALV reports, simulated SFLIGHT database with Open SQL, and modern 7.40+ syntax. SE38 editor, SE11 dictionary, SE16 data browser, SE24 class builder, SE37 function builder — no setup, no cost.",
  keywords: [
    "ABAPForge", "ABAP", "SAP", "ABAP IDE", "ABAP editor", "SE38", "SE80", "SE11", "SE16",
    "SE24", "SE37", "ALV", "ABAP Objects", "OOP", "POP", "training", "free", "online ABAP compiler",
  ],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "ABAPForge — The Modern ABAP Studio",
    description:
      "Write, run and master ABAP in your browser — procedural + OO ABAP, ALV grids, simulated SAP database, 36 runnable examples. Free forever.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
