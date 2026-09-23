"use client";

import { useEffect, useState, type ReactNode } from "react";
import BinderTabs from "@/components/shared/BinderTabs";

/**
 * V3-D1 — La coquille a trois colonnes de l'ecran solo.
 *
 * Elle ne sait rien de ce qu'elle porte : trois emplacements, un bandeau,
 * et la mecanique de repli. Le monde connu (V3-D3), le fil et la saisie
 * (V3-D4) et la fiche jouable (V3-D5) s'y posent sans que ce fichier
 * change.
 *
 * **Le repli se commande depuis le bandeau**, par deux boutons poses a ses
 * extremites et toujours visibles : qu'on replie ou qu'on deplie, la
 * commande ne bouge pas de place. Un bouton qui se deplace en meme temps
 * que ce qu'il commande se rattrape a la souris, jamais a l'habitude.
 */

type Colonne = "monde" | "jeu" | "fiche";

/**
 * Le pli d'une colonne, memorise dans `localStorage` — meme precedent que
 * `useCollapsedGroups` et `RadioWidget` : un confort de navigateur, jamais
 * synchronise entre appareils. La cle porte le monde, parce qu'on ne joue
 * pas deux mondes avec la meme disposition.
 *
 * La valeur se lit APRES le montage : la lire pendant le rendu donnerait
 * un HTML serveur different du premier rendu client.
 */
function usePliMemorise(cle: string): [boolean, () => void] {
  const [replie, setReplie] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture de localStorage, disponible seulement cote client, au premier montage
      setReplie(window.localStorage.getItem(cle) === "1");
    } catch {
      // Stockage indisponible (navigation privee stricte) : la colonne reste depliee.
    }
  }, [cle]);

  function basculer() {
    setReplie((v) => {
      const suivant = !v;
      try {
        window.localStorage.setItem(cle, suivant ? "1" : "0");
      } catch {
        // Rien a faire : le pli tient pour cette session.
      }
      return suivant;
    });
  }

  return [replie, basculer];
}

/**
 * Le chevron pointe vers **ce qui va se passer**, pas vers l'etat present :
 * depliee, la fleche va vers l'exterieur (la colonne part se ranger) ;
 * repliee, elle revient vers l'interieur.
 */
function BoutonRepli({
  cote,
  label,
  repliee,
  onBasculer,
}: {
  cote: "gauche" | "droite";
  label: string;
  repliee: boolean;
  onBasculer: () => void;
}) {
  const versExterieur = cote === "gauche" ? "‹" : "›";
  const versInterieur = cote === "gauche" ? "›" : "‹";
  const chevron = repliee ? versInterieur : versExterieur;

  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-expanded={!repliee}
      title={`${repliee ? "Déplier" : "Replier"} ${label}`}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
        repliee ? "border-edge text-ink-muted hover:bg-panel-raised" : "border-accent text-accent"
      }`}
    >
      {cote === "gauche" ? (
        <>
          {chevron} {label}
        </>
      ) : (
        <>
          {label} {chevron}
        </>
      )}
    </button>
  );
}

export default function SoloShell({
  worldSlug,
  entete,
  monde,
  jeu,
  fiche,
}: {
  worldSlug: string;
  /** Le contenu du bandeau, entre les deux boutons de repli (V3-D2). */
  entete: ReactNode;
  monde: ReactNode;
  jeu: ReactNode;
  fiche: ReactNode;
}) {
  const [gaucheRepliee, basculerGauche] = usePliMemorise(`creadonjon:solo:${worldSlug}:gauche`);
  const [droiteRepliee, basculerDroite] = usePliMemorise(`creadonjon:solo:${worldSlug}:droite`);
  const [colonne, setColonne] = useState<Colonne>("jeu");

  /**
   * **Piege verifie le 22 septembre en dessinant l'ecran :**
   * `grid-template-columns` n'interpole pas entre `minmax(200px,1fr)` et un
   * `0px` nu — le navigateur reste bloque sur l'ancienne valeur et la
   * colonne ne se replie jamais. Les deux bornes doivent etre des
   * `minmax()` de meme forme.
   */
  const colGauche = gaucheRepliee ? "minmax(0px,0fr)" : "minmax(200px,1fr)";
  const colDroite = droiteRepliee ? "minmax(0px,0fr)" : "minmax(280px,1.2fr)";

  /**
   * La meme disparition que le volet de des (`DiceRollPanel`) : 200 ms,
   * echelle et opacite, origine du cote de la colonne.
   *
   * Tout est prefixe `lg:` — une colonne repliee sur grand ecran ne doit
   * pas revenir invisible dans son onglet de telephone, ou le pli n'existe
   * pas.
   */
  const volee = (cote: "gauche" | "droite", repliee: boolean) =>
    // Les classes sont ecrites ENTIERES : Tailwind lit les sources au mot,
    // une classe composee (`origin-${...}`) n'existerait dans aucun CSS.
    `min-h-0 overflow-hidden transition-all duration-200 ${cote === "gauche" ? "origin-left" : "origin-right"} ${
      repliee ? "lg:pointer-events-none lg:scale-95 lg:opacity-0" : "lg:scale-100 lg:opacity-100"
    }`;

  /**
   * Les deux colonnes repliees, **le fil ne s'etale pas** : replier sert a
   * enlever le bruit autour du texte, pas a elargir le texte. Une ligne de
   * 200 caracteres se lit moins bien qu'une ligne de 80, et l'oeil perd
   * son retour a la ligne.
   */
  const centreSeul = gaucheRepliee && droiteRepliee;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-edge bg-panel px-3 py-2">
        <div className="hidden lg:block">
          <BoutonRepli cote="gauche" label="Monde" repliee={gaucheRepliee} onBasculer={basculerGauche} />
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">{entete}</div>

        <div className="hidden lg:block">
          <BoutonRepli cote="droite" label="Fiche" repliee={droiteRepliee} onBasculer={basculerDroite} />
        </div>
      </header>

      {/* Sous 1024 px, les trois colonnes deviennent trois onglets, et
          « Jeu » s'ouvre par defaut : c'est la que se joue le tour. */}
      <div className="lg:hidden">
        <BinderTabs
          aria-label="Colonne affichée"
          value={colonne}
          onChange={setColonne}
          items={[
            { value: "monde", label: "Monde" },
            { value: "jeu", label: "Jeu" },
            { value: "fiche", label: "Fiche" },
          ]}
        />
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-1 gap-3 transition-[grid-template-columns] duration-200 lg:grid-cols-[var(--col-gauche)_minmax(0,2fr)_var(--col-droite)]"
        style={{ "--col-gauche": colGauche, "--col-droite": colDroite } as React.CSSProperties}
      >
        <section
          aria-label="Le monde connu"
          className={`${colonne === "monde" ? "" : "hidden"} lg:block ${volee("gauche", gaucheRepliee)}`}
        >
          {monde}
        </section>

        <section
          aria-label="Le fil de la partie"
          className={`min-h-0 ${colonne === "jeu" ? "" : "hidden"} lg:block`}
        >
          <div className={`flex h-full min-h-0 flex-col ${centreSeul ? "mx-auto w-full max-w-[80ch]" : ""}`}>{jeu}</div>
        </section>

        <section
          aria-label="La fiche jouable"
          className={`${colonne === "fiche" ? "" : "hidden"} lg:block ${volee("droite", droiteRepliee)}`}
        >
          {fiche}
        </section>
      </div>
    </div>
  );
}
