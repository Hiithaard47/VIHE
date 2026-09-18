import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Work_Sans } from "next/font/google";
import { AppFooter } from "@/components/app-footer";
import { NavigationProgress } from "@/components/navigation-progress";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-serif",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Vihe Attendance",
  description: "Attendance tracking for teachers and admins",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${workSans.variable}`}>
      <body className="min-h-screen antialiased">
        <NavigationProgress />
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
