"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import RadioWidget from "./RadioWidget";
import { useChatUnread } from "./useChatUnread";

interface Destination {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
}

/**
 * Coquille joueur (V2-M7b, retour utilisateur avec maquette) — responsive,
 * un seul composant pour telephone/tablette/PC plutot que deux
 * implementations : barre d'onglets en bas sous 768px (zone du pouce,
 * inspiration DnD Beyond), rail lateral au-dessus. Jamais `MondeShell`
 * (fenetres flottantes, paradigme desktop) ni `MjSidebar` (outils MJ) —
 * six destinations fixes, Personnage/Fiche/Notes/Wiki/Regles/Chat, jamais
 * l'onglet MJ. Personnage (V2-M7b suite, retour utilisateur 31 aout) :
 * ajoute par-dessus les quatre d'origine, premiere/racine de la coquille —
 * la fiche jouable seule, plus rapide d'acces pour jouer que le profil
 * complet (Fiche, deplace vers `/joueur/fiche`). Chat (V2-M12, retour
 * utilisateur 1er sept.) : salon partage avec le MJ, pastille de messages
 * non lus (`useChatUnread`, mont sur `AppShell` — partage avec `MjSidebar`
 * cote MJ, un seul salon par campagne).
 *
 * En-tete/pied (retour utilisateur, suite) : "retirer cette barre en haut
 * et tout mettre sur la side bar" — `AppShell.tsx` ne rend plus son en-tete
 * pour cette coquille, le nom du monde/la radio/"Mes mondes" vivent
 * desormais ici. Desktop uniquement (`md:`) : sur telephone la coquille
 * reste la simple barre d'onglets d'origine, un nom de monde et une radio
 * n'y ont pas leur place (memes contraintes qu'avant pour `Clock`, retire
 * de la coquille joueur — un outil de suivi de seance, plus proche du MJ).
 * Jamais de bouton Reglages ici : "les joueurs n'ont pas besoin d'avoir
 * acces au menu de reglages" — de toute facon retire de l'application
 * entiere (retour utilisateur, ses options ont rejoint la sidebar MJ et
 * l'ecran d'accueil du compte).
 */
export default function PlayerShell({
  worldSlug,
  worldName,
  children,
}: {
  worldSlug: string;
  worldName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("shell");
  const base = `/m/${worldSlug}/joueur`;
  const { unreadCount } = useChatUnread();

  const destinations: Destination[] = [
    { href: base, label: "Personnage", icon: "user", match: (p) => p === base },
    { href: `${base}/fiche`, label: "Édition", icon: "card", match: (p) => p.startsWith(`${base}/fiche`) },
    { href: `${base}/notes`, label: "Notes", icon: "notes", match: (p) => p.startsWith(`${base}/notes`) },
    { href: `${base}/wiki`, label: "Wiki", icon: "map", match: (p) => p.startsWith(`${base}/wiki`) },
    { href: `${base}/regles`, label: "Règles", icon: "books", match: (p) => p.startsWith(`${base}/regles`) },
    { href: `${base}/chat`, label: "Chat", icon: "chat", match: (p) => p.startsWith(`${base}/chat`) },
  ];

  return (
    // `h-dvh` (retour utilisateur : "la sidebar prenne toute la hauteur" /
    // "sans que la partie centrale scroll avec [le sommaire]") — deux bugs
    // lies a la meme cause, resolus ensemble par une unite de viewport
    // plutot qu'un pourcentage :
    // 1) `height: 100%` sur un item flexbox n'est pas une taille "auto" pour
    //    l'algorithme flex — ca desactive le `stretch` par defaut (qui, lui,
    //    remplit vraiment le parent) et retombe sur la resolution de
    //    pourcentage classique (rail tronque a mi-hauteur).
    // 2) `<body>` (app/layout.tsx) est volontairement `min-h-full`, pas
    //    `h-full` — necessaire pour que les pages qui defilent normalement
    //    (accueil, connexion...) restent scrollables. Sans un point d'ancrage
    //    absolu quelque part, un enfant qui demande "100% de mon parent" hier
    //    aussi haut que le contenu de CE enfant : ce conteneur grandissait
    //    pour tout faire tenir plutot que de laisser `aside`/`main`
    //    defiler chacun dans leur propre espace borne. `h-dvh` fixe une
    //    hauteur reelle (le viewport), immunisee aux deux problemes.
    <div className="flex h-dvh min-h-0 w-full flex-col-reverse md:flex-row">
      <nav className="flex shrink-0 justify-around border-t border-edge bg-panel md:w-20 md:flex-col md:justify-start md:border-t-0 md:border-r print:hidden">
        <Link
          href={`${base}/accueil`}
          className="hidden shrink-0 truncate border-b border-edge px-2 py-3 text-center text-xs font-semibold text-ink transition-colors hover:text-accent md:block"
        >
          {worldName}
        </Link>

        <div className="flex flex-1 justify-around md:flex-col md:justify-start md:gap-1 md:overflow-y-auto md:p-2">
          {destinations.map((d) => {
            const active = d.match(pathname);
            const badge = d.icon === "chat" ? unreadCount : 0;
            return (
              <Link
                key={d.href}
                href={d.href}
                className={`relative flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] transition-colors md:py-3 ${
                  active ? "text-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                <span className="relative">
                  <Icon name={d.icon} />
                  {badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 rounded-full bg-accent px-1 text-[9px] font-semibold leading-tight text-accent-ink">
                      {badge}
                    </span>
                  )}
                </span>
                {d.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden shrink-0 flex-col items-center gap-2 border-t border-edge p-3 md:flex">
          <RadioWidget worldSlug={worldSlug} />
          <Link href="/" className="text-center text-xs text-ink-muted hover:text-ink">
            {t("mesMondes")}
          </Link>
        </div>
      </nav>
      {/* Chaque page choisit sa propre largeur (retour utilisateur, suite) :
          Personnage/Fiche/Notes se centrent (confort de lecture du wiki
          public, `BookSkin.tsx`), Wiki/Regles gerent eux-memes leur propre
          disposition a deux volets (sommaire etroit + fiche centrale) et
          ont donc besoin de toute la largeur disponible ici. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
    </div>
  );
}

/** Icones minimales en SVG (pas de dependance a une police d'icones cote app) — cinq suffisent, jamais un jeu d'icones complet pour cette coquille. */
function Icon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
  switch (name) {
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
    case "notes":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      );
    case "books":
      return (
        <svg {...common}>
          <path d="M5 4h4a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5V4Z" />
          <path d="M13 4h4v16h-4a2 2 0 0 0-2 2V6a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "card":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="11" r="2" />
          <path d="M5.5 16c.5-2 2-3 3-3s2.5 1 3 3M14 9.5h5M14 13h5" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 4V5Z" />
          <path d="M8 9h8M8 12.5h5" />
        </svg>
      );
    default:
      return null;
  }
}
