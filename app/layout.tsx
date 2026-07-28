import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CreaDonjon",
  description: "Plateforme de création et de simulation de mondes narratifs",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";

  return (
    <html
      lang="fr"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="app-bg" aria-hidden="true" />
        <ThemeSwitcher currentTheme={theme} />
        {children}
      </body>
    </html>
  );
}
