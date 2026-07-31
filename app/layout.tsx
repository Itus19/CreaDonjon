import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Spectral } from "next/font/google";
import { cookies } from "next/headers";
import ModeSwitcher from "@/components/shell/ModeSwitcher";
import "./globals.css";

// Trois familles chargees localement (auto-hebergees a la build par
// next/font, aucune requete a un CDN tiers au chargement de la page —
// specs/coquille-et-design.md §2, critere V0-03b).
const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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

  return (
    <html
      lang="fr"
      data-mode={mode}
      data-contrast={contrast}
      className={`${spectral.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div
          className="app-backdrop"
          style={{ ["--bg-image" as string]: "url(/backgrounds/Artwork_C.png)" }}
          aria-hidden="true"
        />
        <ModeSwitcher currentMode={mode} currentContrast={contrast ?? "off"} />
        {children}
      </body>
    </html>
  );
}
