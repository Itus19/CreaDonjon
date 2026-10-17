"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import BarreFlottante, { RESERVE_BARRE, type EntreeBarre } from "./BarreFlottante";
import { OutilsDalle, Rail, RailPart, RailRow, TraitSvg, useRailReplie } from "./Rail";
import { useChatUnread } from "./useChatUnread";
import NextSessionBadge, { type ProchaineSession } from "./scheduling/NextSessionBadge";

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
 * V3.1-29 : sous 768 px la barre d'onglets du bas est la barre flottante a six
 * entrees (`BarreFlottante`, de encoche au centre) : Perso., Edition, Notes |
 * Wiki, Regles, Chat — « Solo » prend la place de « Chat » dans un monde sans
 * MJ humain, seul moyen d'atteindre le solo sur telephone. Le badge
 * « Prochaine session » n'est plus dans la barre : il ouvre la page Perso.
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
  hasHumanGm,
  prochaineSession,
  children,
}: {
  worldSlug: string;
  worldName: string;
  /** V3.1-11 : masque l'onglet Solo — ce mode (V3, IA locale) n'a de sens que sans MJ humain sur ce monde. */
  hasHumanGm: boolean;
  /** Badge « Prochaine session », lu par le layout joueur (`null` : monde sans campagne). */
  prochaineSession: ProchaineSession | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("shell");
  const base = `/m/${worldSlug}/joueur`;
  const { unreadCount } = useChatUnread();
  const { replie, basculer } = useRailReplie();

  const destinations: Destination[] = [
    { href: base, label: "Personnage", icon: "user", match: (p) => p === base },
    { href: `${base}/fiche`, label: "Édition", icon: "card", match: (p) => p.startsWith(`${base}/fiche`) },
    // V3-B1 : septieme destination, la barre d'intention. Elle s'ajoute aux
    // six d'origine plutot que d'en remplacer une — un ecran qu'on ne peut
    // atteindre qu'en tapant son adresse n'est pas un ecran. V3.1-11 :
    // retiree quand la campagne a deja un MJ humain, le mode solo (IA
    // locale) n'a de sens que sans lui.
    ...(hasHumanGm ? [] : [{ href: `${base}/solo`, label: "Solo", icon: "dice", match: (p: string) => p.startsWith(`${base}/solo`) }]),
    { href: `${base}/notes`, label: "Notes", icon: "notes", match: (p) => p.startsWith(`${base}/notes`) },
    { href: `${base}/wiki`, label: "Wiki", icon: "map", match: (p) => p.startsWith(`${base}/wiki`) },
    { href: `${base}/regles`, label: "Règles", icon: "books", match: (p) => p.startsWith(`${base}/regles`) },
    { href: `${base}/chat`, label: "Chat", icon: "chat", match: (p) => p.startsWith(`${base}/chat`) },
  ];

  // Barre flottante du telephone : six des destinations d'au-dessus, libelles courts.
  const libellesBarre: Record<string, string> = {
    user: t("perso"),
    card: t("edition"),
    notes: t("notes"),
    map: t("wiki"),
    books: t("regles"),
    chat: t("chat"),
    dice: t("solo"),
  };
  const ordreBarre = ["user", "card", "notes", "map", "books", hasHumanGm ? "chat" : "dice"];
  const entreesBarre: EntreeBarre[] = ordreBarre.flatMap((icon) => {
    const d = destinations.find((dest) => dest.icon === icon);
    if (!d) return [];
    // Un lien ordinaire : retoucher l'entree active ramene a son ecran d'accueil.
    return [
      {
        cle: icon,
        libelle: libellesBarre[icon] ?? d.label,
        icone: <Icon name={icon} />,
        actif: d.match(pathname),
        badge: icon === "chat" ? unreadCount : undefined,
        href: d.href,
      },
    ];
  });

  return (
    // V2.1-16 — `h-full` a la place du `h-dvh` d'avant. Ce `h-dvh` etait un
    // contournement, et il le disait : `<body>` etant `min-h-full`, aucun
    // ancetre n'avait de hauteur a resoudre, et ce conteneur grandissait avec
    // son contenu au lieu de laisser `aside`/`main` defiler chacun dans son
    // cadre. La cause est corrigee a la racine (`<body>` en `h-full`), donc
    // le contournement peut partir — et il le DOIT : une unite de viewport
    // ignore le bandeau "voir comme", qu'un pourcentage soustrait tout seul.
    // Les deux retours d'origine restent tenus ("la sidebar prend toute la
    // hauteur", "la partie centrale ne defile pas avec le sommaire").
    <div className="flex h-full min-h-0 w-full flex-col md:flex-row">
      {/* V3.1-27 : a partir de 768 px la colonne de 80 px devient le rail
          flottant commun (parties arrondies, repliable, dalle « Outils »).
          Sous 768 px, il disparait : la barre flottante (plus bas) le remplace. */}
      <Rail ouvert={false} replie={replie} onBasculer={basculer} barreBasse>
        <RailPart className="md:min-h-0 md:flex-1">
          <div className="hidden shrink-0 items-center gap-2.5 px-[14px] py-3 md:flex">
            <Link
              href={`${base}/accueil`}
              title={worldName}
              aria-label={worldName}
              className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-ink"
            >
              {worldName.trim().charAt(0).toUpperCase() || "?"}
            </Link>
            {!replie && (
              <Link
                href={`${base}/accueil`}
                className="min-w-0 flex-1 truncate font-chrome text-sm font-semibold text-ink transition-colors hover:text-accent"
              >
                {worldName}
              </Link>
            )}
          </div>

          {/* Retour utilisateur : "pas d'ascenseur ... plutot une adaptation de
              la taille des boutons" — sous 768 px, dimensionnement fluide
              (icone/marges/texte en `clamp(.., vh, ..)`) plutot que
              `overflow-y-auto`. Dans le rail (V3.1-27), les lignes ont une
              hauteur fixe et la liste defile (`overflow-y-auto` ET
              `overflow-x-hidden`, sinon une barre horizontale apparait
              pendant l'animation de largeur). `md:min-h-0` : necessaire pour
              qu'un enfant `flex-1` accepte de descendre sous sa taille de
              contenu (memes causes que le commentaire de hauteur plus haut). */}
          <div className="flex flex-1 justify-around md:min-h-0 md:flex-col md:items-center md:justify-start md:gap-0.5 md:overflow-y-auto md:overflow-x-hidden md:p-2">
            <div className="hidden w-full flex-col gap-0.5 md:flex">
              {destinations.map((d) => (
                <RailRow
                  key={d.href}
                  href={d.href}
                  icone={<Icon name={d.icon} />}
                  libelle={d.label}
                  actif={d.match(pathname)}
                  badge={d.icon === "chat" ? unreadCount : undefined}
                />
              ))}
            </div>
            {/* Rail seulement : sous 768 px le badge vit en tete de la page Perso
                (plus bas). Replie, la banniere n'aurait pas la place : elle disparait. */}
            {!replie && <NextSessionBadge worldSlug={worldSlug} prochaineSession={prochaineSession} />}
          </div>

          <div className="hidden shrink-0 border-t border-edge p-2 md:block">
            <RailRow
              href="/"
              icone={
                <TraitSvg>
                  <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                  <path d="M10 8l-4 4 4 4" />
                  <path d="M6 12h10" />
                </TraitSvg>
              }
              libelle={t("mesMondes")}
            />
          </div>
        </RailPart>
        <OutilsDalle worldSlug={worldSlug} />
      </Rail>
      {/* Chaque page choisit sa propre largeur (retour utilisateur, suite) :
          Personnage/Fiche se centrent (confort de lecture du wiki public,
          `BookSkin.tsx`), Wiki/Regles/Notes gerent eux-memes leur propre
          disposition (respectivement sommaire etroit + fiche centrale, et
          arbre + page + compagnon pour le cahier, V2.1-2) et ont donc
          besoin de toute la largeur disponible ici. */}
      <div className={`min-h-0 flex-1 overflow-y-auto p-4 md:p-6 ${RESERVE_BARRE}`}>
        {/* Telephone : « Prochaine session » n'a plus sa place dans la barre ;
            il se range en tete de la page Perso, l'ecran d'accueil du joueur. */}
        {pathname === base && prochaineSession && (
          <div className="mb-3 flex md:hidden">
            <NextSessionBadge worldSlug={worldSlug} prochaineSession={prochaineSession} />
          </div>
        )}
        {children}
      </div>
      <BarreFlottante entrees={entreesBarre} libelle={t("barreJoueur")} />
    </div>
  );
}

/**
 * Icones minimales en SVG (pas de dependance a une police d'icones cote app)
 * — cinq suffisent, jamais un jeu d'icones complet pour cette coquille.
 * `width`/`height` a 100% (jamais un nombre de pixels fixe) : la taille
 * reelle vient du conteneur `clamp(...)` pose par l'appelant
 * (`PlayerShell.tsx`), pour retrecir avec la hauteur d'ecran disponible.
 */
function Icon({ name }: { name: string }) {
  const common = { width: "100%", height: "100%", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
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
    case "dice":
      return (
        <svg {...common}>
          <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
          <path d="M4 7.5 12 12l8-4.5M12 12v9" />
        </svg>
      );
    default:
      return null;
  }
}
