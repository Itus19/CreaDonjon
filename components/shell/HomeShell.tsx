"use client";

import { useState } from "react";

type Destination = "mondes" | "compte" | "admin";

const LABELS: Record<Destination, string> = {
  mondes: "Mondes",
  compte: "Compte",
  admin: "Admin",
};

/**
 * Coquille de l'ecran d'accueil (V2.1-24, lot 2) — rail de sections
 * emprunte a `PlayerShell.tsx` sur demande de l'auteur : "le rail de
 * sections qui me rappelle le menu des joueurs, a qui on pourrait
 * emprunter l'esthetique". Meme vocabulaire, aux memes valeurs : 80 px
 * (`md:w-20`), `bg-panel`, filet a droite ; le nom en haut detache par un
 * `border-b` ; une destination = icone + libelle empiles, `text-accent` si
 * active et `text-ink-muted` sinon, SANS pastille de fond ; un pied separe
 * par un `border-t` pour ce qui n'est pas une destination.
 *
 * Et la meme mecanique responsive, qui est la vraie raison de l'emprunt :
 * `flex-col-reverse md:flex-row` donne un rail lateral au-dessus de 768 px
 * et une barre d'onglets en bas en dessous (zone du pouce). L'accueil
 * herite de ce comportement telephone sans qu'on ecrive une ligne pour lui.
 *
 * Les destinations sont un etat local, jamais des routes : l'accueil reste
 * une seule page, exactement comme la selection d'un monde l'est deja dans
 * `HomeScreen`. Rien a precharger, rien a remonter dans l'URL.
 *
 * La barre du haut de `app/page.tsx` (titre, e-mail, deconnexion) a disparu
 * au profit du haut et du pied de ce rail — meme geste que `AppShell.tsx`,
 * qui a cesse de rendre le sien pour la coquille joueur ("retirer cette
 * barre en haut et tout mettre sur la side bar").
 */
export default function HomeShell({
  mondes,
  compte,
  admin,
}: {
  mondes: React.ReactNode;
  compte: React.ReactNode;
  /** Section Administration — `null` pour tout compte non-superadmin, auquel cas la destination n'existe pas non plus. */
  admin: React.ReactNode;
}) {
  const [destination, setDestination] = useState<Destination>("mondes");
  const destinations: Destination[] = admin ? ["mondes", "compte", "admin"] : ["mondes", "compte"];

  return (
    <div className="flex h-full min-h-0 w-full flex-col-reverse md:flex-row">
      <nav className="flex shrink-0 justify-around border-t border-edge bg-panel md:w-20 md:flex-col md:justify-start md:border-t-0 md:border-r print:hidden">
        {/* `px-1` et non le `px-2` de la coquille joueur : "CreaDonjon" est
            plus long qu'un nom de monde court et se faisait tronquer a
            "CreaDonj…" dans les 80 px du rail. Le rembourrage cede, jamais
            la taille de texte — le §4 de la charte pose `text-xs` comme
            plancher. */}
        <span className="hidden shrink-0 truncate border-b border-edge px-1 py-3 text-center text-xs font-semibold text-accent md:block">
          CreaDonjon
        </span>

        {/* Meme dimensionnement fluide que la coquille joueur : la taille
            retrecit avec la hauteur disponible plutot que de deborder, parce
            qu'un rail ne defile pas ("pas d'ascenseur... plutot une
            adaptation de la taille des boutons"). */}
        <div className="flex flex-1 justify-around md:min-h-0 md:flex-col md:items-center md:justify-start md:gap-[clamp(0px,0.8vh,4px)] md:p-2">
          {destinations.map((d) => {
            const active = destination === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDestination(d)}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-[clamp(0px,0.5vh,4px)] rounded-md px-2 py-2 text-[11px] transition-colors md:py-[clamp(2px,1.1vh,12px)] md:text-[clamp(8px,1.3vh,11px)] ${
                  active ? "text-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                <span className="relative block h-5 w-5 shrink-0 md:h-[clamp(14px,2.6vh,20px)] md:w-[clamp(14px,2.6vh,20px)]">
                  <Icon name={d} />
                </span>
                {LABELS[d]}
              </button>
            );
          })}
        </div>

        {/* Pas de pied ici, contrairement a la coquille joueur. L'e-mail ne
            tient pas dans 80 px et n'y rendait qu'une bouillie tronquee ; la
            deconnexion, elle, aurait ete en `md:` comme le pied du joueur,
            et aurait donc DISPARU sous 768 px — ou la barre du bas ne porte
            que des destinations. Les deux vivent dans la destination Compte,
            qui est leur sujet et qui existe a toutes les largeurs. */}
      </nav>

      {/* Chaque destination borne son propre defilement, jamais la page
          (ADR 0025). "Mondes" s'en charge lui-meme — ses deux colonnes
          defilent separement — d'ou un cadre nu ici ; Compte et
          Administration sont des panneaux ordinaires, qui defilent en bloc.
          Compte est en outre bride en largeur : un formulaire de profil
          etire sur 1600 px ne se lit pas. */}
      <div className="min-h-0 flex-1 overflow-hidden p-4 md:p-6">
        {destination === "mondes" && <div className="mx-auto h-full min-h-0 w-full max-w-[1600px]">{mondes}</div>}
        {destination === "compte" && (
          <div className="mx-auto h-full min-h-0 w-full max-w-2xl overflow-y-auto">{compte}</div>
        )}
        {destination === "admin" && (
          <div className="mx-auto h-full min-h-0 w-full max-w-[1600px] overflow-y-auto">{admin}</div>
        )}
      </div>
    </div>
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
  const common = { width: "100%", height: "100%", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
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
