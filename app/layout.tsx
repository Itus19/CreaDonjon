import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getOwnProfile } from "@/src/server/repos/account";
import { resolveBackgroundSelection } from "@/src/server/services/backgroundImages";
import ViewAsBanner from "@/components/shell/ViewAsBanner";
import { MusicPlaybackProvider } from "@/components/shell/MusicPlaybackContext";
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

  // Le menu de reglages n'a de sens que pour un utilisateur connecte
  // (compte, suppression...) : absent sur /login, /signup, /partage/*.
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = user ? await getOwnProfile(supabase, user.id) : null;

  // Fond d'ecran personnel (V2-G4 reformule) : meme technique que
  // data-mode/data-contrast ci-dessus (cookie lu et applique cote serveur,
  // avant le premier rendu) — aucun scintillement au chargement.
  const backgroundRef = cookieStore.get("background")?.value;
  const background = await resolveBackgroundSelection(supabase, backgroundRef);

  // Flou du fond, reglable (retour utilisateur) : --bg-blur est distinct de
  // --blur (flou verre depoli des fenetres/panneaux, app/globals.css) —
  // 20px par defaut, comportement inchangé pour qui n'a jamais touche au
  // curseur.
  const bgBlurCookie = Number(cookieStore.get("bgBlur")?.value);
  const bgBlur = Number.isFinite(bgBlurCookie) && bgBlurCookie >= 0 && bgBlurCookie <= 40 ? bgBlurCookie : 20;

  // "Voir comme" (retour utilisateur, section Administration) : le cookie
  // httpOnly pose par /api/admin/view-as est la seule trace de ce mode — la
  // session courante EST deja celle du compte cible a ce stade, jamais
  // distinguable autrement. Bandeau rendu ici (racine) pour rester visible
  // sur TOUTE page, pas seulement l'ecran d'accueil.
  const viewingAsAdminUid = cookieStore.get("view_as_admin_uid")?.value;

  return (
    <html
      lang={locale}
      data-mode={mode}
      data-contrast={contrast}
      style={{ ["--h" as string]: background.hue, ["--c" as string]: background.chroma, ["--bg-blur" as string]: `${bgBlur}px` }}
      className={`${geistSans.variable} ${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div
          className="app-backdrop"
          style={{ ["--bg-image" as string]: `url("${background.backdropUrl}")` }}
          aria-hidden="true"
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <MusicPlaybackProvider>
            {viewingAsAdminUid && user && <ViewAsBanner viewingAsEmail={profile?.display_name || user.email || ""} />}
            {children}
          </MusicPlaybackProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
