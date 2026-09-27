import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SmsProvider } from "@/lib/context/sms-context";
import { Navigation } from "@/components/navigation";
import { ToastContainer } from "@/components/toast-container";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SMS Gateway PK", template: "%s · SMS Gateway PK" },
  description: "Enterprise bulk SMS platform for Pakistani mobile networks — Jazz, Zong, Telenor, Ufone, SCOM.",
};

export const viewport: Viewport = {
  themeColor: "#050810",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body suppressHydrationWarning className="min-h-full bg-[#050810] text-[#e6edf3] antialiased">
        <SmsProvider>
          <Navigation />
          <ToastContainer />
          {/* Offset content by sidebar width on desktop */}
          <div className="lg:pl-[220px] flex flex-col min-h-screen">
            {children}
          </div>
        </SmsProvider>
      </body>
    </html>
  );
}
