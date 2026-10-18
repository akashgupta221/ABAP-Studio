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
  title: "ABAP Workbench — SAP Development Training",
  description:
    "Web-based SAP GUI-style ABAP Workbench: learn procedural ABAP, ABAP Objects, ALV reporting and modern 7.40+ syntax. Editor (SE38), Dictionary (SE11), Data Browser (SE16), Class Builder (SE24), Function Builder (SE37).",
  keywords: ["ABAP", "SAP", "Workbench", "SE38", "SE80", "ALV", "training", "ABAP Objects"],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "ABAP Workbench — SAP Development Training",
    description:
      "Browser-based SAP GUI-style ABAP IDE: procedural + OO ABAP, ALV reports, SE11/SE16/SE24/SE37, 40+ runnable examples.",
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
