"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { logout } from "@/app/login/actions";
import DiceRollProvider from "./DiceRollPanel";
import { LogoApp } from "@/components/brand/LogoApp";
import type { AppLogoKey } from "@/src/core/brand/identity";
import {
  DeBarreBas,
  DeSeulDalle,
  Rail,
  RailPart,
  RailRow,
  TraitSvg,
  useRailReplie,
} from "./Rail";

export type Destination = "mondes" | "compte" | "admin";

/** Où mène une destination quittée pour une autre page (V3.1-87). */
const ADRESSES: Record<Destination, string> = { mondes: "/", compte: "/?vue=compte", admin: "/admin" };

/**
 * Coquille de l'ecran d'accueil. A partir de 768 px (V3.1-35) : le rail du
 * joueur V4 (`Rail.tsx`) — Mondes, Compte, Administration (superadmin
 * seulement), Deconnexion en pied, et une dalle Outils avec le de SEUL (la
 * radio appartient a une campagne). Sous 768 px : la barre d'onglets du bas
 * d'avant (Mondes, Compte, Admin) ; la deconnexion y reste dans la
 * destination Compte, ou la barre ne porte que des destinations.
 *
 * Mondes et Compte sont un etat local de `/` : l'accueil reste une seule
 * page, exactement comme la selection d'un monde l'est deja dans
 * `HomeScreen`. Administration est une ROUTE, `/admin` (V3.1-87) : la page
 * verifie le superadmin cote serveur et repond 404 a tout autre compte, ce
 * qu'une destination locale ne pouvait pas faire. La meme coquille l'habille
 * (`page="admin"`) : ses lignes Mondes et Compte y deviennent des liens vers
 * `/` et `/?vue=compte`.
 *
 * `DiceRollProvider` sans campagne : le de de la dalle ouvre l'outil de des en
 * « jet libre », qui part vers `POST /api/dice-rolls` (le serveur lance, rien
 * n'est enregistre).
 */
export default function HomeShell({
  identite,
  page = "accueil",
  vueInitiale = "mondes",
  mondes = null,
  compte = null,
  admin = null,
  avecAdmin,
}: {
  /** V3.1-86 : la tête du rail porte la marque de l'application (hors d'un monde). */
  identite: { name: string; logoKey: AppLogoKey; logoUrl: string | null };
  /** La page qui monte la coquille : l'accueil (`/`) ou l'administration (`/admin`). */
  page?: "accueil" | "admin";
  /** Accueil : la destination ouverte au chargement (`/?vue=compte`). */
  vueInitiale?: "mondes" | "compte";
  mondes?: React.ReactNode;
  compte?: React.ReactNode;
  /** Le contenu de `/admin` ; absent sur l'accueil. */
  admin?: React.ReactNode;
  /** La destination Administration existe (superadmin seulement, décidé côté serveur). */
  avecAdmin: boolean;
}) {
  const t = useTranslations("accueil");
  const [vue, setVue] = useState<"mondes" | "compte">(vueInitiale);
  const destination: Destination = page === "admin" ? "admin" : vue;
  const { replie, basculer } = useRailReplie();
  const destinations: Destination[] = avecAdmin
    ? ["mondes", "compte", "admin"]
    : ["mondes", "compte"];
  /** Une destination d'une autre page est un lien ; une destination de cette page, un état. */
  const adresse = (d: Destination): string | undefined =>
    (page === "admin") !== (d === "admin") ? ADRESSES[d] : undefined;
  const choisir = (d: Destination) => {
    if (d !== "admin") setVue(d);
  };
  const libelles: Record<Destination, string> = {
    mondes: t("destMondes"),
    compte: t("destCompte"),
    admin: t("destAdmin"),
  };

  return (
    <DiceRollProvider campaignId={null} isGm={false}>
      <div className="flex h-full min-h-0 w-full flex-col-reverse md:flex-row">
        {/* Grand ecran : le rail flottant commun. Il se masque de lui-meme sous 768 px (`barreBasse`). */}
        <Rail ouvert={false} replie={replie} onBasculer={basculer} barreBasse>
          <RailPart className="md:min-h-0 md:flex-1">
            <div className="hidden shrink-0 items-center gap-2.5 px-[14px] py-3 md:flex">
              <LogoApp logoKey={identite.logoKey} logoUrl={identite.logoUrl} taille={26} />
              {!replie && (
                <span className="min-w-0 flex-1 truncate font-chrome text-sm font-semibold text-ink">
                  {identite.name}
                </span>
              )}
            </div>

            <nav
              aria-label={t("navigation")}
              className="hidden min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-2 md:flex"
            >
              {destinations.map((d) => (
                <RailRow
                  key={d}
                  icone={<Icon name={d} />}
                  libelle={libelles[d]}
                  actif={destination === d}
                  href={adresse(d)}
                  onClick={adresse(d) === undefined ? () => choisir(d) : undefined}
                />
              ))}
            </nav>

            <form
              action={logout}
              className="hidden shrink-0 border-t border-edge p-2 md:block"
            >
              <RailRow
                soumettre
                libelle={t("deconnexion")}
                icone={
                  <TraitSvg>
                    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                    <path d="M10 8l-4 4 4 4" />
                    <path d="M6 12h10" />
                  </TraitSvg>
                }
              />
            </form>
          </RailPart>
          <DeSeulDalle />
        </Rail>

        {/* Telephone : la barre d'onglets du bas d'avant. */}
        <nav
          aria-label={t("navigation")}
          className="flex shrink-0 justify-around border-t border-edge bg-panel md:hidden print:hidden"
        >
          {destinations.map((d, i) => {
            const active = destination === d;
            const href = adresse(d);
            const classe = `relative flex flex-col items-center gap-1 rounded-md px-2 py-2 text-xs transition-colors ${
              active ? "text-accent" : "text-ink-muted hover:text-ink"
            }`;
            const contenu = (
              <>
                <span className="relative block h-5 w-5 shrink-0">
                  <Icon name={d} />
                </span>
                {d === "admin" ? t("destAdminCourt") : libelles[d]}
              </>
            );
            return (
              <Fragment key={d}>
                {/* Le de au milieu de la barre (apres la premiere destination), comme dans un monde. */}
                {i === 1 && <DeBarreBas />}
                {href !== undefined ? (
                  <Link href={href} className={classe}>
                    {contenu}
                  </Link>
                ) : (
                  <button type="button" onClick={() => choisir(d)} aria-current={active ? "page" : undefined} className={classe}>
                    {contenu}
                  </button>
                )}
              </Fragment>
            );
          })}
        </nav>

        {/* Chaque destination borne son propre defilement, jamais la page
            (ADR 0025). "Mondes" s'en charge lui-meme ; Compte et
            Administration sont des panneaux ordinaires, qui defilent en bloc.
            Compte est en outre bride en largeur : un formulaire de profil
            etire sur 1600 px ne se lit pas. */}
        <div className="min-h-0 flex-1 overflow-hidden p-4 md:p-6">
          {destination === "mondes" && (
            <div className="mx-auto h-full min-h-0 w-full max-w-[1600px]">
              {mondes}
            </div>
          )}
          {destination === "compte" && (
            // V3.1-80 : la page Compte a un sommaire de 200 px à gauche des cartes, d'où une borne plus large.
            <div className="mx-auto h-full min-h-0 w-full max-w-4xl overflow-y-auto">
              {compte}
            </div>
          )}
          {destination === "admin" && (
            <div className="mx-auto h-full min-h-0 w-full max-w-[1600px] overflow-y-auto">
              {admin}
            </div>
          )}
        </div>
      </div>
    </DiceRollProvider>
  );
}

/**
 * Icones minimales en SVG, comme `PlayerShell.tsx` — trois suffisent,
 * jamais un jeu d'icones complet. Volontairement locales et non partagees
 * avec celles de la coquille joueur : V2.1-24 ne modifie pas `PlayerShell`,
 * et deux `path` recopies coutent moins qu'une extraction imposee a un
 * composant hors perimetre. A extraire si une TROISIEME coquille en a
 * besoin.
 *
 * `width`/`height` a 100% (jamais un nombre de pixels fixe) : la taille
 * reelle vient du conteneur `clamp(...)` pose par l'appelant.
 */
function Icon({ name }: { name: Destination }) {
  const common = {
    width: "100%",
    height: "100%",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
  } as const;
  switch (name) {
    case "mondes":
      return (
        <svg {...common}>
          <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      );
    case "compte":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
  }
}
