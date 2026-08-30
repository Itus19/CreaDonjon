"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Clock from "./Clock";
import RadioWidget from "./RadioWidget";

/**
 * Coquille commune aux trois sections (Monde/Règles/MJ) : uniquement
 * l'en-tete (specs/coquille-et-design.md §3, revu V2-K2). Le bandeau
 * Monde/Règles/MJ (`SectionToggle`) ne vit plus ici — chaque section le
 * rend elle-meme, en haut de sa propre barre laterale, au-dessus de son
 * champ de recherche.
 */
export default function AppShell({
  worldName,
  worldSlug,
  campaignName,
  children,
}: {
  worldName: string;
  worldSlug: string;
  /** Affiché a cote du nom du monde, ecran MJ seulement (retour utilisateur) — `null` si le monde n'a pas encore de campagne. */
  campaignName: string | null;
  children: React.ReactNode;
}) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const isMj = pathname.startsWith(`/m/${worldSlug}/mj`);
  const isJoueur = pathname.startsWith(`/m/${worldSlug}/joueur`);
  return (
    // `flex-1 min-h-0` plutot qu'une hauteur fixe (`h-dvh`) : ce conteneur
    // n'est pas toujours le seul enfant de `<body>` — le bandeau "voir comme"
    // (`ViewAsBanner`, app/layout.tsx) s'empile au-dessus quand il est
    // present, sur TOUTE route (pas seulement la coquille joueur). Une
    // hauteur fixe ignorait cet ajout et poussait la barre d'onglets
    // mobile de la coquille joueur hors de l'ecran (retour utilisateur,
    // constate en testant avec le compte Claude).
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-edge bg-panel px-4 pl-14 print:hidden">
        <div className="flex min-w-0 items-baseline gap-2">
          <Link href={`/m/${worldSlug}`} className="truncate font-chrome text-sm font-semibold text-ink">
            {worldName}
          </Link>
          {isMj && campaignName && (
            <span className="truncate text-sm text-ink-muted">· {campaignName}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <RadioWidget />
          {/* Coquille joueur sur telephone (retour utilisateur) : "pas besoin
              de mettre l'horloge en haut" — masquee sous 640px seulement pour
              l'ecran joueur, MJ/Monde/Regles inchanges. */}
          <div className={isJoueur ? "hidden sm:block" : undefined}>
            <Clock />
          </div>
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            {t("mesMondes")}
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
