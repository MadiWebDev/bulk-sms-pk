import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SmsProvider } from "@/lib/context/sms-context";
import { Navigation } from "@/components/navigation";
import { ToastContainer } from "@/components/toast-container";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bulk SMS Pakistan - Enterprise Cellular SMS Platform",
  description: "Send high-throughput SMS campaigns, OTPs, and test alerts across all Pakistani mobile networks (Jazz, Zong, Telenor, Ufone, SCOM) with sms-gate.app and MongoDB persistence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200"
      >
        <SmsProvider>
          <Navigation />
          <ToastContainer />
          <div className="flex-1 flex flex-col">{children}</div>
        </SmsProvider>
      </body>
    </html>
  );
}
