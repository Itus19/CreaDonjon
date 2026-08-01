import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import ModeSwitcher from "@/components/shell/ModeSwitcher";
import "./globals.css";

// Trois familles chargees localement (auto-hebergees a la build par
// next/font, aucune requete a un CDN tiers au chargement de la page —
// specs/coquille-et-design.md §2, critere V0-03b). Memes polices que
// l'ancienne application (master) : Geist Sans pour le texte courant,
// Outfit pour les titres, Geist Mono pour les valeurs mecaniques.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CreaDonjon",
  description: "Plateforme de création et de simulation de mondes narratifs",
};

const VALID_MODES = ["dark", "dim", "soft", "light"];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const modeCookie = cookieStore.get("mode")?.value ?? "dark";
  const mode = VALID_MODES.includes(modeCookie) ? modeCookie : "dark";
  const contrast = cookieStore.get("contrast")?.value === "high" ? "high" : undefined;
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-mode={mode}
      data-contrast={contrast}
      className={`${geistSans.variable} ${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div
          className="app-backdrop"
          style={{ ["--bg-image" as string]: "url(/backgrounds/Artwork_C.png)" }}
          aria-hidden="true"
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ModeSwitcher currentMode={mode} currentContrast={contrast ?? "off"} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
